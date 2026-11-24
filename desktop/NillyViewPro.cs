// ============================================================================
// NillyView Pro — Native 62-Format Windows Image, RAW, SVG & PSD Host
// created by Nilly graphics (Sotiris Christos) — https://nillygraphics.com/
// Strictly C# 5 compatible (.NET Framework 4.x csc.exe — 0 external DLLs)
// 0 MB background RAM when closed · 4-Tier Universal Image Decoder Pipeline
// ============================================================================

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Windows.Media;
using System.Windows.Media.Imaging;

[assembly: AssemblyTitle("NillyView Pro")]
[assembly: AssemblyDescription("Ultra-lightweight Image, RAW, SVG & PSD Studio — created by Nilly graphics (Sotiris Christos)")]
[assembly: AssemblyCompany("Nilly graphics (Sotiris Christos) — https://nillygraphics.com/")]
[assembly: AssemblyProduct("NillyView Pro")]
[assembly: AssemblyCopyright("Copyright (c) Nilly graphics (Sotiris Christos)")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace NillyViewPro
{
    static class Program
    {
        private static string _webRoot;
        private static string _token;
        private static readonly object _listLock = new object();
        private static List<string> _files = new List<string>();
        private static int _currentIndex = -1;
        private static string _currentFolder = "";

        private static volatile bool _running = true;
        private static volatile bool _sawClient = false;
        private static volatile bool _byeReceived = false;
        private static long _lastPingTicks = DateTime.UtcNow.Ticks;
        private static long _byeTicks = 0;
        private static long _startTicks = DateTime.UtcNow.Ticks;
        private static TcpListener _listener;

        // Tier 1: Direct browser-native stream (< 3 ms, zero decode latency!)
        private static readonly HashSet<string> WebNativeExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".webp", ".avif", ".gif", ".bmp", ".dib", ".ico", ".svg"
        };

        // All 62 supported image, vector, Camera RAW & graphic design extensions
        private static readonly HashSet<string> SupportedExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            // Web & Standard
            ".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".webp", ".avif", ".gif", ".bmp", ".dib", ".ico", ".svg", ".svgz",
            // Apple, Next-Gen & Pro Raster (Windows 11 WIC)
            ".heic", ".heif", ".hif", ".jxl", ".tif", ".tiff", ".dds", ".jxr", ".wdp", ".hdp",
            // 38 Camera RAW formats (Native Windows 11 WIC Raw Image Extension / libraw)
            ".cr2", ".cr3", ".crw", ".nef", ".nrw", ".arw", ".sr2", ".srf", ".dng", ".raf",
            ".orf", ".ori", ".rw2", ".rwl", ".pef", ".ptx", ".srw", ".3fr", ".fff", ".iiq",
            ".x3f", ".kdc", ".dcr", ".mrw", ".mef", ".mos", ".erf", ".raw", ".ari", ".bay",
            ".cap", ".dcs", ".drf", ".eip", ".k25", ".pxn",
            // Graphic Design & Binary Decoders + Shell Preview
            ".psd", ".psb", ".tga", ".ppm", ".pgm", ".pbm", ".afdesign", ".afphoto", ".afpub", ".ai", ".eps"
        };

        [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
        private static extern int StrCmpLogicalW(string psz1, string psz2);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct SHFILEOPSTRUCT
        {
            public IntPtr hwnd;
            public uint wFunc;
            public string pFrom;
            public string pTo;
            public ushort fFlags;
            public bool fAnyOperationsAborted;
            public IntPtr hNameMappings;
            public string lpszProgressTitle;
        }

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern int SHFileOperation(ref SHFILEOPSTRUCT FileOp);

        [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellItemImageFactory
        {
            [PreserveSig]
            int GetImage(SHELL_SIZE size, int flags, out IntPtr phbm);
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct SHELL_SIZE { public int cx; public int cy; }

        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
        private static extern int SHCreateItemFromParsingName(string pszPath, IntPtr pbc, ref Guid riid, out IShellItemImageFactory ppv);

        [DllImport("gdi32.dll")]
        private static extern bool DeleteObject(IntPtr hObject);

        [STAThread]
        static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool testServerMode = false;
            string infoFile = null;
            string inputPath = null;

            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i];
                if (string.Equals(a, "--test-server", StringComparison.OrdinalIgnoreCase))
                    testServerMode = true;
                else if (string.Equals(a, "--info-file", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    infoFile = args[++i];
                else if (!a.StartsWith("--") && inputPath == null)
                    inputPath = a;
            }

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            _webRoot = Path.GetFullPath(Path.Combine(exeDir, "web"));
            if (!Directory.Exists(_webRoot))
            {
                string parentWeb = Path.GetFullPath(Path.Combine(exeDir, "..\\web"));
                if (Directory.Exists(parentWeb)) _webRoot = parentWeb;
            }

            if (!File.Exists(Path.Combine(_webRoot, "index.html")))
            {
                if (!testServerMode)
                    MessageBox.Show("Δεν βρέθηκε ο φάκελος web\\index.html δίπλα στο NillyViewPro.exe.", "NillyView Pro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 2;
            }

            if (!string.IsNullOrEmpty(inputPath))
            {
                LoadPathIntoFolderList(inputPath);
            }

            _token = GenerateToken();
            int port = StartLoopbackListener();
            if (port <= 0)
            {
                if (!testServerMode)
                    MessageBox.Show("Αδυναμία εκκίνησης τοπικού loopback port (127.0.0.1).", "NillyView Pro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 3;
            }

            string appUrl = "http://127.0.0.1:" + port + "/?t=" + _token + "&desktop=1";
            if (!string.IsNullOrEmpty(infoFile))
            {
                try { File.WriteAllText(infoFile, appUrl, Encoding.UTF8); } catch { }
            }

            Thread acceptThread = new Thread(AcceptLoop);
            acceptThread.IsBackground = true;
            acceptThread.Start();

            if (!testServerMode)
            {
                LaunchAppWindow(appUrl);
            }

            // Watchdog: exit cleanly to 0 MB RAM when window closes
            while (_running)
            {
                Thread.Sleep(500);
                DateTime now = DateTime.UtcNow;

                if (_byeReceived)
                {
                    DateTime byeAt = new DateTime(Interlocked.Read(ref _byeTicks), DateTimeKind.Utc);
                    if ((now - byeAt).TotalSeconds >= 2.2) { _running = false; break; }
                }
                if (_sawClient)
                {
                    DateTime lastPing = new DateTime(Interlocked.Read(ref _lastPingTicks), DateTimeKind.Utc);
                    if ((now - lastPing).TotalSeconds >= 10.0) { _running = false; break; }
                }
                else
                {
                    DateTime started = new DateTime(Interlocked.Read(ref _startTicks), DateTimeKind.Utc);
                    if ((now - started).TotalSeconds >= (testServerMode ? 30.0 : 45.0)) { _running = false; break; }
                }
            }

            try { _listener.Stop(); } catch { }
            return 0;
        }

        private static void LoadPathIntoFolderList(string path)
        {
            try
            {
                string full = Path.GetFullPath(path);
                string dir;
                string targetFile = null;

                if (Directory.Exists(full))
                {
                    dir = full;
                }
                else if (File.Exists(full))
                {
                    dir = Path.GetDirectoryName(full);
                    targetFile = full;
                }
                else return;

                List<string> found = new List<string>();
                try
                {
                    string[] raw = Directory.GetFiles(dir);
                    for (int i = 0; i < raw.Length; i++)
                    {
                        string ext = Path.GetExtension(raw[i]);
                        if (SupportedExts.Contains(ext) ||
                            (targetFile != null && string.Equals(raw[i], targetFile, StringComparison.OrdinalIgnoreCase)))
                        {
                            found.Add(raw[i]);
                        }
                    }
                }
                catch { }

                found.Sort(delegate(string a, string b)
                {
                    return StrCmpLogicalW(Path.GetFileName(a), Path.GetFileName(b));
                });

                int idx = found.Count > 0 ? 0 : -1;
                if (targetFile != null)
                {
                    for (int i = 0; i < found.Count; i++)
                    {
                        if (string.Equals(found[i], targetFile, StringComparison.OrdinalIgnoreCase))
                        {
                            idx = i;
                            break;
                        }
                    }
                }

                lock (_listLock)
                {
                    _files = found;
                    _currentIndex = idx;
                    _currentFolder = dir;
                }
            }
            catch { }
        }

        private static string GetFileAt(int index)
        {
            lock (_listLock)
            {
                if (index < 0 || index >= _files.Count) return null;
                return _files[index];
            }
        }

        private static string GenerateToken()
        {
            byte[] buf = new byte[16];
            using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider()) { rng.GetBytes(buf); }
            StringBuilder sb = new StringBuilder(32);
            for (int i = 0; i < buf.Length; i++) sb.Append(buf[i].ToString("x2"));
            return sb.ToString();
        }

        // Preferred ports 17951..17970 so localStorage persists across sessions & never collides with NillyDoc Pro (17921)
        private static int StartLoopbackListener()
        {
            for (int p = 17951; p <= 17970; p++)
            {
                try
                {
                    TcpListener l = new TcpListener(IPAddress.Loopback, p);
                    l.Start();
                    _listener = l;
                    return p;
                }
                catch { }
            }
            try
            {
                TcpListener l = new TcpListener(IPAddress.Loopback, 0);
                l.Start();
                _listener = l;
                return ((IPEndPoint)l.LocalEndpoint).Port;
            }
            catch { return -1; }
        }

        private static void LaunchAppWindow(string url)
        {
            string browser = FindChromiumBrowser();
            if (!string.IsNullOrEmpty(browser))
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browser;
                    psi.Arguments = "--app=\"" + url + "\" --window-size=1320,860";
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                    return;
                }
                catch { }
            }
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
        }

        private static string FindChromiumBrowser()
        {
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] cands = new string[]
            {
                Path.Combine(pf86, "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(pf,   "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(pf,   "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
                Path.Combine(pf86, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
                Path.Combine(local,"BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
                Path.Combine(pf,   "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(pf86, "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(local,"Google\\Chrome\\Application\\chrome.exe")
            };
            for (int i = 0; i < cands.Length; i++)
                if (!string.IsNullOrEmpty(cands[i]) && File.Exists(cands[i])) return cands[i];
            return null;
        }

        private static void AcceptLoop()
        {
            while (_running)
            {
                try
                {
                    TcpClient client = _listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch { if (!_running) break; }
            }
        }

        private class HttpRequest
        {
            public string Method;
            public string Path;
            public Dictionary<string, string> Query = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, string> Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public byte[] Body;
        }

        private static void HandleClient(object obj)
        {
            TcpClient client = (TcpClient)obj;
            try
            {
                client.ReceiveTimeout = 30000;
                client.SendTimeout = 45000;
                using (client)
                using (NetworkStream stream = client.GetStream())
                {
                    HttpRequest req = ReadHttpRequest(stream);
                    if (req == null) return;
                    if (req.Path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
                        HandleApi(stream, req);
                    else
                        HandleStaticFile(stream, req);
                }
            }
            catch { }
        }

        private static HttpRequest ReadHttpRequest(NetworkStream stream)
        {
            MemoryStream hbuf = new MemoryStream();
            byte[] buf = new byte[8192];
            int headerEnd = -1;
            while (hbuf.Length < 65536)
            {
                int n = stream.Read(buf, 0, buf.Length);
                if (n <= 0) return null;
                hbuf.Write(buf, 0, n);
                headerEnd = FindHeaderEnd(hbuf.ToArray());
                if (headerEnd >= 0) break;
            }
            if (headerEnd < 0) return null;

            byte[] all = hbuf.ToArray();
            string[] lines = Encoding.ASCII.GetString(all, 0, headerEnd).Split(new string[] { "\r\n" }, StringSplitOptions.None);
            if (lines.Length == 0) return null;
            string[] parts = lines[0].Split(' ');
            if (parts.Length < 2) return null;

            HttpRequest req = new HttpRequest();
            req.Method = parts[0].ToUpperInvariant();
            string target = parts[1];
            int qIdx = target.IndexOf('?');
            if (qIdx >= 0)
            {
                req.Path = target.Substring(0, qIdx);
                ParseQuery(target.Substring(qIdx + 1), req.Query);
            }
            else req.Path = target;

            for (int i = 1; i < lines.Length; i++)
            {
                int col = lines[i].IndexOf(':');
                if (col > 0) req.Headers[lines[i].Substring(0, col).Trim()] = lines[i].Substring(col + 1).Trim();
            }

            string exp;
            if (req.Headers.TryGetValue("Expect", out exp) && exp.IndexOf("100-continue", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                byte[] cont = Encoding.ASCII.GetBytes("HTTP/1.1 100 Continue\r\n\r\n");
                stream.Write(cont, 0, cont.Length);
            }

            int contentLen = 0;
            string lenVal;
            if (req.Headers.TryGetValue("Content-Length", out lenVal)) int.TryParse(lenVal, out contentLen);
            int bodyStart = headerEnd + 4;
            int already = all.Length - bodyStart;

            if (contentLen > 0)
            {
                if (contentLen > 250 * 1024 * 1024) return null;
                byte[] body = new byte[contentLen];
                int copied = Math.Min(already, contentLen);
                if (copied > 0) Buffer.BlockCopy(all, bodyStart, body, 0, copied);
                int off = copied;
                while (off < contentLen)
                {
                    int n = stream.Read(body, off, contentLen - off);
                    if (n <= 0) break;
                    off += n;
                }
                req.Body = body;
            }
            else req.Body = new byte[0];

            return req;
        }

        private static int FindHeaderEnd(byte[] a)
        {
            for (int i = 0; i <= a.Length - 4; i++)
                if (a[i] == 13 && a[i + 1] == 10 && a[i + 2] == 13 && a[i + 3] == 10) return i;
            return -1;
        }

        private static void ParseQuery(string qs, Dictionary<string, string> dest)
        {
            string[] pairs = qs.Split('&');
            for (int i = 0; i < pairs.Length; i++)
            {
                if (string.IsNullOrEmpty(pairs[i])) continue;
                int eq = pairs[i].IndexOf('=');
                if (eq >= 0)
                    dest[Uri.UnescapeDataString(pairs[i].Substring(0, eq).Replace('+', ' '))] =
                        Uri.UnescapeDataString(pairs[i].Substring(eq + 1).Replace('+', ' '));
                else
                    dest[Uri.UnescapeDataString(pairs[i])] = "";
            }
        }

        private static bool VerifyToken(HttpRequest req)
        {
            string t;
            if (!req.Query.TryGetValue("t", out t) || string.IsNullOrEmpty(t) || t.Length != _token.Length) return false;
            int diff = 0;
            for (int i = 0; i < _token.Length; i++) diff |= (t[i] ^ _token[i]);
            return diff == 0;
        }

        private static int ParseQueryIndex(HttpRequest req)
        {
            string s;
            int idx;
            if (req.Query.TryGetValue("i", out s) && int.TryParse(s, out idx)) return idx;
            return _currentIndex;
        }

        private static void HandleApi(NetworkStream stream, HttpRequest req)
        {
            if (!VerifyToken(req))
            {
                SendResponse(stream, 403, "Forbidden", "text/plain", Encoding.ASCII.GetBytes("Invalid token"), null);
                return;
            }

            if (string.Equals(req.Path, "/api/heartbeat", StringComparison.OrdinalIgnoreCase))
            {
                _sawClient = true; _byeReceived = false;
                Interlocked.Exchange(ref _lastPingTicks, DateTime.UtcNow.Ticks);
                SendResponse(stream, 204, "No Content", null, null, null);
                return;
            }

            if (string.Equals(req.Path, "/api/bye", StringComparison.OrdinalIgnoreCase))
            {
                _sawClient = true; _byeReceived = true;
                Interlocked.Exchange(ref _byeTicks, DateTime.UtcNow.Ticks);
                SendResponse(stream, 204, "No Content", null, null, null);
                return;
            }

            if (string.Equals(req.Path, "/api/list", StringComparison.OrdinalIgnoreCase))
            {
                SendJson(stream, BuildFolderListJson());
                return;
            }

            if (string.Equals(req.Path, "/api/open-file", StringComparison.OrdinalIgnoreCase) && req.Method == "POST")
            {
                string chosen = null;
                Thread sta = new Thread(delegate()
                {
                    try
                    {
                        using (OpenFileDialog dlg = new OpenFileDialog())
                        {
                            dlg.Title = "NillyView Pro — Άνοιγμα Εικόνας / RAW / SVG / PSD";
                            dlg.Filter = "Όλες οι εικόνες & RAW (62 formats)|*.jpg;*.jpeg;*.png;*.webp;*.avif;*.gif;*.svg;*.svgz;*.bmp;*.ico;*.heic;*.heif;*.jxl;*.tif;*.tiff;*.cr2;*.cr3;*.nef;*.arw;*.dng;*.raf;*.orf;*.rw2;*.pef;*.srw;*.raw;*.psd;*.tga;*.afdesign;*.afphoto;*.ai;*.eps|Camera RAW|*.cr2;*.cr3;*.crw;*.nef;*.nrw;*.arw;*.dng;*.raf;*.orf;*.rw2;*.pef;*.srw;*.raw;*.3fr;*.fff;*.iiq;*.x3f|Όλα τα αρχεία|*.*";
                            if (!string.IsNullOrEmpty(_currentFolder) && Directory.Exists(_currentFolder))
                                dlg.InitialDirectory = _currentFolder;
                            if (dlg.ShowDialog() == DialogResult.OK) chosen = dlg.FileName;
                        }
                    }
                    catch { }
                });
                sta.SetApartmentState(ApartmentState.STA);
                sta.Start();
                sta.Join();

                if (!string.IsNullOrEmpty(chosen)) LoadPathIntoFolderList(chosen);
                SendJson(stream, BuildFolderListJson());
                return;
            }

            if (string.Equals(req.Path, "/api/img", StringComparison.OrdinalIgnoreCase))
            {
                int idx = ParseQueryIndex(req);
                string filePath = GetFileAt(idx);
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    SendResponse(stream, 404, "Not Found", "text/plain", Encoding.ASCII.GetBytes("Image not found"), null);
                    return;
                }
                ServeDecodedImage(stream, filePath);
                return;
            }

            if (string.Equals(req.Path, "/api/thumb", StringComparison.OrdinalIgnoreCase))
            {
                int idx = ParseQueryIndex(req);
                string filePath = GetFileAt(idx);
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    SendResponse(stream, 404, "Not Found", "text/plain", Encoding.ASCII.GetBytes("Not found"), null);
                    return;
                }
                ServeThumbnail(stream, filePath);
                return;
            }

            if (string.Equals(req.Path, "/api/meta", StringComparison.OrdinalIgnoreCase))
            {
                int idx = ParseQueryIndex(req);
                string filePath = GetFileAt(idx);
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    SendResponse(stream, 404, "Not Found", "text/plain", Encoding.ASCII.GetBytes("Not found"), null);
                    return;
                }
                SendJson(stream, ExtractMetadataJson(filePath));
                return;
            }

            if (string.Equals(req.Path, "/api/reveal", StringComparison.OrdinalIgnoreCase) && req.Method == "POST")
            {
                string filePath = GetFileAt(ParseQueryIndex(req));
                if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath))
                {
                    try { Process.Start("explorer.exe", "/select,\"" + filePath + "\""); } catch { }
                }
                SendResponse(stream, 204, "No Content", null, null, null);
                return;
            }

            if (string.Equals(req.Path, "/api/delete", StringComparison.OrdinalIgnoreCase) && req.Method == "POST")
            {
                int idx = ParseQueryIndex(req);
                string filePath = GetFileAt(idx);
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    SendResponse(stream, 404, "Not Found", "text/plain", Encoding.ASCII.GetBytes("Not found"), null);
                    return;
                }
                bool ok = SendToRecycleBin(filePath);
                if (ok)
                {
                    lock (_listLock)
                    {
                        if (idx >= 0 && idx < _files.Count && string.Equals(_files[idx], filePath, StringComparison.OrdinalIgnoreCase))
                        {
                            _files.RemoveAt(idx);
                            if (_files.Count == 0) _currentIndex = -1;
                            else _currentIndex = Math.Min(idx, _files.Count - 1);
                        }
                    }
                    SendJson(stream, BuildFolderListJson());
                }
                else
                {
                    SendResponse(stream, 500, "Error", "text/plain", Encoding.ASCII.GetBytes("Recycle failed"), null);
                }
                return;
            }

            if (string.Equals(req.Path, "/api/save", StringComparison.OrdinalIgnoreCase) && req.Method == "POST")
            {
                int idx = ParseQueryIndex(req);
                string target = GetFileAt(idx);
                if (string.IsNullOrEmpty(target))
                {
                    HandleSaveAs(stream, req);
                    return;
                }
                try
                {
                    AtomicWriteFile(target, req.Body);
                    Dictionary<string, string> extra = new Dictionary<string, string>();
                    extra["X-Saved-Name"] = Uri.EscapeDataString(Path.GetFileName(target));
                    SendResponse(stream, 200, "OK", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("SAVED"), extra);
                }
                catch (Exception ex)
                {
                    SendResponse(stream, 500, "Error", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes(ex.Message), null);
                }
                return;
            }

            if (string.Equals(req.Path, "/api/saveas", StringComparison.OrdinalIgnoreCase) && req.Method == "POST")
            {
                HandleSaveAs(stream, req);
                return;
            }

            SendResponse(stream, 404, "Not Found", "text/plain", Encoding.ASCII.GetBytes("Not found"), null);
        }

        private static void HandleSaveAs(NetworkStream stream, HttpRequest req)
        {
            string suggested = "image.webp";
            string qName;
            if (req.Query.TryGetValue("name", out qName) && !string.IsNullOrEmpty(qName))
                suggested = Path.GetFileName(qName);

            string ext = Path.GetExtension(suggested).TrimStart('.').ToLowerInvariant();
            if (string.IsNullOrEmpty(ext)) ext = "png";

            string chosenPath = null;
            string initDir = !string.IsNullOrEmpty(_currentFolder) && Directory.Exists(_currentFolder)
                ? _currentFolder
                : Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);

            Thread sta = new Thread(delegate()
            {
                try
                {
                    using (SaveFileDialog dlg = new SaveFileDialog())
                    {
                        dlg.Title = "NillyView Pro — Αποθήκευση Εικόνας";
                        dlg.Filter = "WebP Image (*.webp)|*.webp|JPEG Image (*.jpg)|*.jpg|PNG Image (*.png)|*.png|Windows Icon (*.ico)|*.ico|All files (*.*)|*.*";
                        dlg.FilterIndex = ext == "webp" ? 1 : (ext == "jpg" || ext == "jpeg" ? 2 : (ext == "ico" ? 4 : 3));
                        dlg.DefaultExt = ext;
                        dlg.AddExtension = true;
                        dlg.OverwritePrompt = true;
                        dlg.InitialDirectory = initDir;
                        dlg.FileName = suggested;
                        if (dlg.ShowDialog() == DialogResult.OK) chosenPath = dlg.FileName;
                    }
                }
                catch { }
            });
            sta.SetApartmentState(ApartmentState.STA);
            sta.Start();
            sta.Join();

            if (string.IsNullOrEmpty(chosenPath))
            {
                SendResponse(stream, 204, "No Content", "text/plain", Encoding.ASCII.GetBytes("CANCELLED"), null);
                return;
            }

            try
            {
                AtomicWriteFile(chosenPath, req.Body);
                Dictionary<string, string> extra = new Dictionary<string, string>();
                extra["X-Saved-Name"] = Uri.EscapeDataString(Path.GetFileName(chosenPath));
                SendResponse(stream, 200, "OK", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("SAVED"), extra);
            }
            catch (Exception ex)
            {
                SendResponse(stream, 500, "Error", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes(ex.Message), null);
            }
        }

        private static bool SendToRecycleBin(string path)
        {
            try
            {
                SHFILEOPSTRUCT op = new SHFILEOPSTRUCT();
                op.wFunc = 0x0003; // FO_DELETE
                op.pFrom = path + "\0\0";
                op.fFlags = 0x0040 | 0x0010 | 0x0004; // FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT
                return SHFileOperation(ref op) == 0 && !op.fAnyOperationsAborted;
            }
            catch { return false; }
        }

        // ====================================================================
        // 4-TIER UNIVERSAL IMAGE DECODER (62 FORMATS — ZERO EXTERNAL DLLs!)
        // ====================================================================
        private static void ServeDecodedImage(NetworkStream stream, string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            Dictionary<string, string> hdr = new Dictionary<string, string>();

            // TIER 1: Direct web-native stream (< 3 ms!)
            if (WebNativeExts.Contains(ext))
            {
                byte[] raw = File.ReadAllBytes(filePath);
                hdr["X-Decode-Tier"] = "Native";
                SendResponse(stream, 200, "OK", GetMimeType(ext), raw, hdr);
                return;
            }

            // TIER 1B: Compressed SVG (.svgz)
            if (ext == ".svgz")
            {
                try
                {
                    using (FileStream fs = File.OpenRead(filePath))
                    using (GZipStream gz = new GZipStream(fs, CompressionMode.Decompress))
                    using (MemoryStream ms = new MemoryStream())
                    {
                        gz.CopyTo(ms);
                        hdr["X-Decode-Tier"] = "GZip-SVG";
                        SendResponse(stream, 200, "OK", "image/svg+xml; charset=utf-8", ms.ToArray(), hdr);
                        return;
                    }
                }
                catch { }
            }

            // TIER 3A: Pure-C# Adobe Photoshop (.psd) composite / embedded preview
            if (ext == ".psd")
            {
                string mime;
                byte[] psdImg = TryDecodePsd(filePath, out mime);
                if (psdImg != null && psdImg.Length > 0)
                {
                    hdr["X-Decode-Tier"] = "PSD-Native";
                    SendResponse(stream, 200, "OK", mime, psdImg, hdr);
                    return;
                }
            }

            // TIER 3B: Pure-C# Targa (.tga)
            if (ext == ".tga")
            {
                byte[] tgaPng = TryDecodeTga(filePath);
                if (tgaPng != null)
                {
                    hdr["X-Decode-Tier"] = "TGA-Native";
                    SendResponse(stream, 200, "OK", "image/png", tgaPng, hdr);
                    return;
                }
            }

            // TIER 2: Native Windows 11 WIC (38 Camera RAW + HEIC + JXL + TIFF + DDS + JXR!)
            string wicMime;
            byte[] wicBytes = TryDecodeWithWic(filePath, out wicMime);
            if (wicBytes != null && wicBytes.Length > 0)
            {
                hdr["X-Decode-Tier"] = "Windows-WIC";
                SendResponse(stream, 200, "OK", wicMime, wicBytes, hdr);
                return;
            }

            // TIER 4: Universal Windows Shell High-Res Preview Fallback (Affinity .afdesign/.afphoto, .ai, .eps, etc.)
            byte[] shellPng = TryDecodeWithShell(filePath, 1600);
            if (shellPng != null && shellPng.Length > 0)
            {
                hdr["X-Decode-Tier"] = "Windows-Shell";
                SendResponse(stream, 200, "OK", "image/png", shellPng, hdr);
                return;
            }

            SendResponse(stream, 415, "Unsupported Media Type", "text/plain; charset=utf-8",
                Encoding.UTF8.GetBytes("Αδυναμία αποκωδικοποίησης αυτού του αρχείου (" + ext + ")."), null);
        }

        private static void ServeThumbnail(NetworkStream stream, string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            // SVG thumbnails render natively in browser!
            if (ext == ".svg")
            {
                SendResponse(stream, 200, "OK", "image/svg+xml", File.ReadAllBytes(filePath), null);
                return;
            }

            byte[] thumb = TryDecodeWithShell(filePath, 180);
            if (thumb != null && thumb.Length > 0)
            {
                SendResponse(stream, 200, "OK", "image/png", thumb, null);
                return;
            }

            // Fallback to full decoded image
            ServeDecodedImage(stream, filePath);
        }

        // Windows 11 WIC Decoder (handles 38 RAW formats, HEIC, JXL, TIFF, DDS, JXR + auto EXIF rotation!)
        private static byte[] TryDecodeWithWic(string filePath, out string mime)
        {
            mime = "image/png";
            try
            {
                using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    BitmapDecoder decoder = BitmapDecoder.Create(fs, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
                    if (decoder == null || decoder.Frames.Count == 0) return null;

                    BitmapSource src = decoder.Frames[0];
                    // Apply automatic EXIF Orientation (1..8)
                    int orient = GetExifOrientation(decoder.Frames[0].Metadata as BitmapMetadata);
                    src = ApplyExifOrientation(src, orient);

                    // Convert CMYK / 48-bit RAW / Gray16 cleanly into displayable Bgra32
                    if (src.Format != PixelFormats.Bgra32 && src.Format != PixelFormats.Bgr32 && src.Format != PixelFormats.Bgr24)
                    {
                        FormatConvertedBitmap conv = new FormatConvertedBitmap();
                        conv.BeginInit();
                        conv.Source = src;
                        conv.DestinationFormat = PixelFormats.Bgra32;
                        conv.EndInit();
                        src = conv;
                    }

                    // For huge >10 MP camera RAWs, encode crisp high-quality JPEG (q93) for sub-150ms transfer; otherwise lossless PNG!
                    long pixels = (long)src.PixelWidth * (long)src.PixelHeight;
                    bool hasAlpha = HasMeaningfulAlpha(src, filePath);
                    using (MemoryStream ms = new MemoryStream())
                    {
                        if (!hasAlpha && pixels > 8000000)
                        {
                            JpegBitmapEncoder jpg = new JpegBitmapEncoder();
                            jpg.QualityLevel = 93;
                            jpg.Frames.Add(BitmapFrame.Create(src));
                            jpg.Save(ms);
                            mime = "image/jpeg";
                        }
                        else
                        {
                            PngBitmapEncoder png = new PngBitmapEncoder();
                            png.Frames.Add(BitmapFrame.Create(src));
                            png.Save(ms);
                            mime = "image/png";
                        }
                        return ms.ToArray();
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        private static bool HasMeaningfulAlpha(BitmapSource src, string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            if (ext == ".tif" || ext == ".tiff" || ext == ".dds" || ext == ".png" || ext == ".jxl" || ext == ".heic")
                return true;
            return false;
        }

        private static int GetExifOrientation(BitmapMetadata meta)
        {
            if (meta == null) return 1;
            try
            {
                object o = meta.GetQuery("System.Photo.Orientation");
                if (o != null) return Convert.ToInt32(o);
            }
            catch { }
            try
            {
                if (meta.ContainsQuery("/app1/ifd/{ushort=274}"))
                    return Convert.ToInt32(meta.GetQuery("/app1/ifd/{ushort=274}"));
            }
            catch { }
            return 1;
        }

        private static BitmapSource ApplyExifOrientation(BitmapSource src, int orient)
        {
            if (orient <= 1 || orient > 8) return src;
            TransformGroup tg = new TransformGroup();
            if (orient == 2) tg.Children.Add(new ScaleTransform(-1, 1));
            else if (orient == 3) tg.Children.Add(new RotateTransform(180));
            else if (orient == 4) tg.Children.Add(new ScaleTransform(1, -1));
            else if (orient == 5) { tg.Children.Add(new RotateTransform(90)); tg.Children.Add(new ScaleTransform(-1, 1)); }
            else if (orient == 6) tg.Children.Add(new RotateTransform(90));
            else if (orient == 7) { tg.Children.Add(new RotateTransform(270)); tg.Children.Add(new ScaleTransform(-1, 1)); }
            else if (orient == 8) tg.Children.Add(new RotateTransform(270));
            return new TransformedBitmap(src, tg);
        }

        // Pure-C# Adobe Photoshop (.PSD) Decoder: embedded JPEG preview OR full Raw/RLE composite!
        private static byte[] TryDecodePsd(string filePath, out string mime)
        {
            mime = "image/jpeg";
            try
            {
                using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (BinaryReader br = new BinaryReader(fs))
                {
                    if (fs.Length < 34) return null;
                    byte[] sig = br.ReadBytes(4);
                    if (sig[0] != '8' || sig[1] != 'B' || sig[2] != 'P' || sig[3] != 'S') return null;
                    int version = ReadBE16(br);
                    if (version != 1) return null; // Classic PSD
                    br.ReadBytes(6); // reserved
                    int channels = ReadBE16(br);
                    int height = (int)ReadBE32(br);
                    int width = (int)ReadBE32(br);
                    int depth = ReadBE16(br);
                    int colorMode = ReadBE16(br); // 1=Gray, 3=RGB, 4=CMYK

                    uint colorDataLen = ReadBE32(br);
                    fs.Seek(colorDataLen, SeekOrigin.Current);

                    // Image Resources Section (check for embedded JPEG preview 1036/1033 as fallback)
                    uint resLen = ReadBE32(br);
                    long resEnd = fs.Position + resLen;
                    byte[] embeddedJpg = null;
                    while (fs.Position + 12 <= resEnd)
                    {
                        byte[] rSig = br.ReadBytes(4);
                        if (rSig[0] != '8' || rSig[1] != 'B' || rSig[2] != 'I' || rSig[3] != 'M') break;
                        int resId = ReadBE16(br);
                        byte nameLen = br.ReadByte();
                        int namePad = ((nameLen + 1) % 2 == 0) ? nameLen : (nameLen + 1);
                        fs.Seek(namePad, SeekOrigin.Current);
                        uint dataLen = ReadBE32(br);
                        long nextPos = fs.Position + dataLen + (dataLen % 2);
                        if ((resId == 1036 || resId == 1033) && dataLen > 28)
                        {
                            fs.Seek(28, SeekOrigin.Current);
                            embeddedJpg = br.ReadBytes((int)(dataLen - 28));
                        }
                        fs.Seek(nextPos, SeekOrigin.Begin);
                    }
                    fs.Seek(resEnd, SeekOrigin.Begin);

                    // Skip Layer & Mask Info to reach Composite Image Data!
                    uint layerLen = ReadBE32(br);
                    fs.Seek(layerLen, SeekOrigin.Current);

                    // Attempt full-res Composite decode for 8-bit RGB/RGBA/Gray/CMYK (<= 6000px)
                    if (depth == 8 && width > 0 && height > 0 && width <= 6000 && height <= 6000 &&
                        (colorMode == 1 || colorMode == 3 || colorMode == 4) && fs.Position + 2 < fs.Length)
                    {
                        int comp = ReadBE16(br); // 0=Raw, 1=RLE PackBits
                        if (comp == 0 || comp == 1)
                        {
                            int planeCount = Math.Min(channels, 4);
                            byte[][] planes = new byte[planeCount][];
                            int planeSize = width * height;

                            if (comp == 0)
                            {
                                for (int c = 0; c < planeCount; c++) planes[c] = br.ReadBytes(planeSize);
                            }
                            else
                            {
                                ushort[] rowLens = new ushort[channels * height];
                                for (int r = 0; r < rowLens.Length; r++) rowLens[r] = (ushort)ReadBE16(br);
                                for (int c = 0; c < planeCount; c++)
                                {
                                    byte[] p = new byte[planeSize];
                                    for (int y = 0; y < height; y++)
                                    {
                                        byte[] srcRow = br.ReadBytes(rowLens[c * height + y]);
                                        UnpackBits(srcRow, p, y * width, width);
                                    }
                                    planes[c] = p;
                                }
                            }

                            byte[] png = ComposePsdPlanesToPng(width, height, colorMode, planeCount, planes);
                            if (png != null) { mime = "image/png"; return png; }
                        }
                    }

                    if (embeddedJpg != null && embeddedJpg.Length > 100)
                    {
                        mime = "image/jpeg";
                        return embeddedJpg;
                    }
                }
            }
            catch { }
            return null;
        }

        private static void UnpackBits(byte[] src, byte[] dst, int dstOff, int count)
        {
            int si = 0, di = 0;
            while (si < src.Length && di < count)
            {
                sbyte n = (sbyte)src[si++];
                if (n >= 0)
                {
                    int len = Math.Min(n + 1, Math.Min(src.Length - si, count - di));
                    Buffer.BlockCopy(src, si, dst, dstOff + di, len);
                    si += len; di += len;
                }
                else if (n != -128)
                {
                    if (si >= src.Length) break;
                    byte val = src[si++];
                    int len = Math.Min(1 - n, count - di);
                    for (int k = 0; k < len; k++) dst[dstOff + di + k] = val;
                    di += len;
                }
            }
        }

        private static byte[] ComposePsdPlanesToPng(int w, int h, int colorMode, int planeCount, byte[][] planes)
        {
            int stride = w * 4;
            byte[] bgra = new byte[stride * h];
            int total = w * h;
            for (int i = 0; i < total; i++)
            {
                byte r = 0, g = 0, b = 0, a = 255;
                if (colorMode == 1)
                {
                    r = g = b = planes[0][i];
                    if (planeCount >= 2) a = planes[1][i];
                }
                else if (colorMode == 3 && planeCount >= 3)
                {
                    r = planes[0][i]; g = planes[1][i]; b = planes[2][i];
                    if (planeCount >= 4) a = planes[3][i];
                }
                else if (colorMode == 4 && planeCount >= 4)
                {
                    // PSD CMYK is inverted (255 = 0% ink, 0 = 100% ink)
                    float c = 1f - planes[0][i] / 255f;
                    float m = 1f - planes[1][i] / 255f;
                    float y = 1f - planes[2][i] / 255f;
                    float k = 1f - planes[3][i] / 255f;
                    r = (byte)(255f * (1f - c) * (1f - k));
                    g = (byte)(255f * (1f - m) * (1f - k));
                    b = (byte)(255f * (1f - y) * (1f - k));
                }
                int o = i * 4;
                bgra[o] = b; bgra[o + 1] = g; bgra[o + 2] = r; bgra[o + 3] = a;
            }
            BitmapSource bmp = BitmapSource.Create(w, h, 96, 96, PixelFormats.Bgra32, null, bgra, stride);
            using (MemoryStream ms = new MemoryStream())
            {
                PngBitmapEncoder enc = new PngBitmapEncoder();
                enc.Frames.Add(BitmapFrame.Create(bmp));
                enc.Save(ms);
                return ms.ToArray();
            }
        }

        // Pure-C# Targa (.TGA) 24/32-bit Uncompressed & RLE Decoder
        private static byte[] TryDecodeTga(string filePath)
        {
            try
            {
                byte[] d = File.ReadAllBytes(filePath);
                if (d.Length < 18) return null;
                int idLen = d[0];
                int imgType = d[2]; // 2=Uncompressed TrueColor, 10=RLE TrueColor
                if (imgType != 2 && imgType != 10) return null;
                int w = d[12] | (d[13] << 8);
                int h = d[14] | (d[15] << 8);
                int bpp = d[16];
                bool topOrigin = (d[17] & 0x20) != 0;
                if (w <= 0 || h <= 0 || (bpp != 24 && bpp != 32)) return null;

                int bytesPerPx = bpp / 8;
                int pos = 18 + idLen;
                byte[] bgra = new byte[w * h * 4];
                int total = w * h;
                int px = 0;

                if (imgType == 2)
                {
                    for (; px < total && pos + bytesPerPx <= d.Length; px++)
                    {
                        WriteTgaPixel(bgra, w, h, px, topOrigin, d[pos], d[pos + 1], d[pos + 2], bytesPerPx == 4 ? d[pos + 3] : (byte)255);
                        pos += bytesPerPx;
                    }
                }
                else
                {
                    while (px < total && pos < d.Length)
                    {
                        byte hdr = d[pos++];
                        int cnt = (hdr & 0x7F) + 1;
                        if ((hdr & 0x80) != 0)
                        {
                            if (pos + bytesPerPx > d.Length) break;
                            byte b = d[pos], g = d[pos + 1], r = d[pos + 2], a = bytesPerPx == 4 ? d[pos + 3] : (byte)255;
                            pos += bytesPerPx;
                            for (int k = 0; k < cnt && px < total; k++, px++)
                                WriteTgaPixel(bgra, w, h, px, topOrigin, b, g, r, a);
                        }
                        else
                        {
                            for (int k = 0; k < cnt && px < total && pos + bytesPerPx <= d.Length; k++, px++)
                            {
                                WriteTgaPixel(bgra, w, h, px, topOrigin, d[pos], d[pos + 1], d[pos + 2], bytesPerPx == 4 ? d[pos + 3] : (byte)255);
                                pos += bytesPerPx;
                            }
                        }
                    }
                }

                BitmapSource bmp = BitmapSource.Create(w, h, 96, 96, PixelFormats.Bgra32, null, bgra, w * 4);
                using (MemoryStream ms = new MemoryStream())
                {
                    PngBitmapEncoder enc = new PngBitmapEncoder();
                    enc.Frames.Add(BitmapFrame.Create(bmp));
                    enc.Save(ms);
                    return ms.ToArray();
                }
            }
            catch { return null; }
        }

        private static void WriteTgaPixel(byte[] bgra, int w, int h, int px, bool topOrigin, byte b, byte g, byte r, byte a)
        {
            int x = px % w;
            int y = topOrigin ? (px / w) : (h - 1 - (px / w));
            int o = (y * w + x) * 4;
            bgra[o] = b; bgra[o + 1] = g; bgra[o + 2] = r; bgra[o + 3] = a;
        }

        private static int ReadBE16(BinaryReader br) { byte[] b = br.ReadBytes(2); return (b[0] << 8) | b[1]; }
        private static uint ReadBE32(BinaryReader br) { byte[] b = br.ReadBytes(4); return ((uint)b[0] << 24) | ((uint)b[1] << 16) | ((uint)b[2] << 8) | b[3]; }

        // Windows Shell High-Res Thumbnail/Preview Fallback (STA COM)
        private static byte[] TryDecodeWithShell(string filePath, int maxDim)
        {
            byte[] result = null;
            Thread sta = new Thread(delegate()
            {
                try
                {
                    Guid g = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
                    IShellItemImageFactory factory;
                    int hr = SHCreateItemFromParsingName(filePath, IntPtr.Zero, ref g, out factory);
                    if (hr != 0 || factory == null) return;
                    IntPtr hbm;
                    SHELL_SIZE sz = new SHELL_SIZE { cx = maxDim, cy = maxDim };
                    hr = factory.GetImage(sz, 0x00000008 /* SIIGBF_BIGGERSIZEOK */, out hbm);
                    if (hr != 0 || hbm == IntPtr.Zero) return;
                    try
                    {
                        using (Bitmap bmp = Image.FromHbitmap(hbm))
                        using (MemoryStream ms = new MemoryStream())
                        {
                            bmp.Save(ms, ImageFormat.Png);
                            result = ms.ToArray();
                        }
                    }
                    finally { DeleteObject(hbm); }
                }
                catch { }
            });
            sta.SetApartmentState(ApartmentState.STA);
            sta.Start();
            sta.Join();
            return result;
        }

        // ====================================================================
        // EXIF & PREPRESS METADATA EXTRACTOR
        // ====================================================================
        private static string ExtractMetadataJson(string filePath)
        {
            FileInfo fi = new FileInfo(filePath);
            string ext = fi.Extension.ToLowerInvariant();
            int w = 0, h = 0;
            double dpiX = 96, dpiY = 96;
            string pixelFmt = "", camMake = "", camModel = "", lens = "", iso = "", aperture = "", shutter = "", focal = "", dateTaken = "";

            if (ext == ".psd")
            {
                try
                {
                    using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                    using (BinaryReader br = new BinaryReader(fs))
                    {
                        byte[] sig = br.ReadBytes(4);
                        if (sig.Length == 4 && sig[0] == '8' && sig[1] == 'B' && sig[2] == 'P' && sig[3] == 'S')
                        {
                            ReadBE16(br); br.ReadBytes(6);
                            int ch = ReadBE16(br); h = (int)ReadBE32(br); w = (int)ReadBE32(br);
                            int dp = ReadBE16(br); int cm = ReadBE16(br);
                            string cmName = cm == 4 ? "CMYK" : (cm == 3 ? "RGB" : (cm == 1 ? "Grayscale" : "Mode " + cm));
                            pixelFmt = cmName + " " + dp + "-bit (" + ch + " ch)";
                        }
                    }
                }
                catch { }
            }
            else if (ext != ".svg" && ext != ".svgz")
            {
                try
                {
                    using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                    {
                        BitmapDecoder dec = BitmapDecoder.Create(fs, BitmapCreateOptions.DelayCreation, BitmapCacheOption.None);
                        if (dec != null && dec.Frames.Count > 0)
                        {
                            BitmapFrame fr = dec.Frames[0];
                            w = fr.PixelWidth; h = fr.PixelHeight;
                            dpiX = fr.DpiX > 1 ? fr.DpiX : 96;
                            dpiY = fr.DpiY > 1 ? fr.DpiY : 96;
                            pixelFmt = fr.Format.ToString();

                            BitmapMetadata m = fr.Metadata as BitmapMetadata;
                            if (m != null)
                            {
                                int orient = GetExifOrientation(m);
                                if (orient >= 5 && orient <= 8) { int t = w; w = h; h = t; }
                                camMake = SafeMetaStr(m, "System.Photo.CameraManufacturer", m.CameraManufacturer);
                                camModel = SafeMetaStr(m, "System.Photo.CameraModel", m.CameraModel);
                                lens = SafeMetaStr(m, "System.Photo.LensModel", "");
                                dateTaken = SafeMetaStr(m, "System.Photo.DateTaken", m.DateTaken);
                                iso = SafeMetaNum(m, "System.Photo.ISOSpeed", "");
                                aperture = SafeMetaAperture(m);
                                shutter = SafeMetaShutter(m);
                                focal = SafeMetaFocal(m);
                            }
                        }
                    }
                }
                catch { }
            }

            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            sb.Append("\"name\":").Append(JsonStr(fi.Name)).Append(",");
            sb.Append("\"fullPath\":").Append(JsonStr(fi.FullName)).Append(",");
            sb.Append("\"ext\":").Append(JsonStr(ext.TrimStart('.').ToUpperInvariant())).Append(",");
            sb.Append("\"size\":").Append(fi.Length).Append(",");
            sb.Append("\"mtime\":").Append(JsonStr(fi.LastWriteTime.ToString("dd/MM/yyyy HH:mm"))).Append(",");
            sb.Append("\"width\":").Append(w).Append(",");
            sb.Append("\"height\":").Append(h).Append(",");
            sb.Append("\"dpiX\":").Append(Math.Round(dpiX).ToString(CultureInfo.InvariantCulture)).Append(",");
            sb.Append("\"dpiY\":").Append(Math.Round(dpiY).ToString(CultureInfo.InvariantCulture)).Append(",");
            sb.Append("\"pixelFormat\":").Append(JsonStr(pixelFmt)).Append(",");
            sb.Append("\"cameraMake\":").Append(JsonStr(camMake)).Append(",");
            sb.Append("\"cameraModel\":").Append(JsonStr(camModel)).Append(",");
            sb.Append("\"lens\":").Append(JsonStr(lens)).Append(",");
            sb.Append("\"iso\":").Append(JsonStr(iso)).Append(",");
            sb.Append("\"aperture\":").Append(JsonStr(aperture)).Append(",");
            sb.Append("\"shutter\":").Append(JsonStr(shutter)).Append(",");
            sb.Append("\"focal\":").Append(JsonStr(focal)).Append(",");
            sb.Append("\"dateTaken\":").Append(JsonStr(dateTaken));
            sb.Append("}");
            return sb.ToString();
        }

        private static string SafeMetaStr(BitmapMetadata m, string q, string fallback)
        {
            try { object v = m.GetQuery(q); if (v != null && !string.IsNullOrEmpty(v.ToString())) return v.ToString().Trim(); } catch { }
            return fallback != null ? fallback.Trim() : "";
        }

        private static string SafeMetaNum(BitmapMetadata m, string q, string suffix)
        {
            try { object v = m.GetQuery(q); if (v != null) return Convert.ToString(v, CultureInfo.InvariantCulture) + suffix; } catch { }
            return "";
        }

        private static string SafeMetaAperture(BitmapMetadata m)
        {
            try
            {
                object v = m.GetQuery("System.Photo.FNumber");
                if (v != null) return "f/" + Convert.ToDouble(v, CultureInfo.InvariantCulture).ToString("0.#", CultureInfo.InvariantCulture);
            }
            catch { }
            return "";
        }

        private static string SafeMetaShutter(BitmapMetadata m)
        {
            try
            {
                object v = m.GetQuery("System.Photo.ExposureTime");
                if (v != null)
                {
                    double sec = Convert.ToDouble(v, CultureInfo.InvariantCulture);
                    if (sec > 0 && sec < 0.5) return "1/" + Math.Round(1.0 / sec) + "s";
                    if (sec >= 0.5) return sec.ToString("0.#", CultureInfo.InvariantCulture) + "s";
                }
            }
            catch { }
            return "";
        }

        private static string SafeMetaFocal(BitmapMetadata m)
        {
            try
            {
                object v = m.GetQuery("System.Photo.FocalLength");
                if (v != null) return Math.Round(Convert.ToDouble(v, CultureInfo.InvariantCulture)) + " mm";
            }
            catch { }
            return "";
        }

        private static string BuildFolderListJson()
        {
            StringBuilder sb = new StringBuilder();
            lock (_listLock)
            {
                sb.Append("{\"currentIndex\":").Append(_currentIndex);
                sb.Append(",\"folder\":").Append(JsonStr(_currentFolder));
                sb.Append(",\"items\":[");
                for (int i = 0; i < _files.Count; i++)
                {
                    if (i > 0) sb.Append(",");
                    string p = _files[i];
                    long sz = 0;
                    try { sz = new FileInfo(p).Length; } catch { }
                    sb.Append("{\"i\":").Append(i)
                      .Append(",\"name\":").Append(JsonStr(Path.GetFileName(p)))
                      .Append(",\"ext\":").Append(JsonStr(Path.GetExtension(p).TrimStart('.').ToUpperInvariant()))
                      .Append(",\"size\":").Append(sz).Append("}");
                }
                sb.Append("]}");
            }
            return sb.ToString();
        }

        private static string JsonStr(string s)
        {
            if (s == null) return "\"\"";
            StringBuilder sb = new StringBuilder(s.Length + 4);
            sb.Append('"');
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (c == '\\') sb.Append("\\\\");
                else if (c == '"') sb.Append("\\\"");
                else if (c == '\r') sb.Append("\\r");
                else if (c == '\n') sb.Append("\\n");
                else if (c == '\t') sb.Append("\\t");
                else if (c < 32) sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            sb.Append('"');
            return sb.ToString();
        }

        private static void AtomicWriteFile(string targetPath, byte[] data)
        {
            string tmp = targetPath + ".nvtmp";
            File.WriteAllBytes(tmp, data);
            if (File.Exists(targetPath)) File.Replace(tmp, targetPath, null);
            else File.Move(tmp, targetPath);
        }

        private static void HandleStaticFile(NetworkStream stream, HttpRequest req)
        {
            string rel = req.Path;
            if (string.IsNullOrEmpty(rel) || rel == "/") rel = "/index.html";
            rel = Uri.UnescapeDataString(rel).TrimStart('/').Replace('/', '\\');
            string full = Path.GetFullPath(Path.Combine(_webRoot, rel));
            string rootSep = _webRoot.EndsWith("\\") ? _webRoot : _webRoot + "\\";
            if (!full.StartsWith(rootSep, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            {
                SendResponse(stream, 404, "Not Found", "text/plain", Encoding.ASCII.GetBytes("404"), null);
                return;
            }
            SendResponse(stream, 200, "OK", GetMimeType(Path.GetExtension(full)), File.ReadAllBytes(full), null);
        }

        private static string GetMimeType(string ext)
        {
            string e = (ext ?? "").ToLowerInvariant();
            if (e == ".html") return "text/html; charset=utf-8";
            if (e == ".css") return "text/css; charset=utf-8";
            if (e == ".js") return "application/javascript; charset=utf-8";
            if (e == ".json") return "application/json; charset=utf-8";
            if (e == ".svg") return "image/svg+xml";
            if (e == ".png") return "image/png";
            if (e == ".jpg" || e == ".jpeg" || e == ".jpe" || e == ".jfif") return "image/jpeg";
            if (e == ".webp") return "image/webp";
            if (e == ".avif") return "image/avif";
            if (e == ".gif") return "image/gif";
            if (e == ".bmp" || e == ".dib") return "image/bmp";
            if (e == ".ico") return "image/x-icon";
            return "application/octet-stream";
        }

        private static void SendJson(NetworkStream stream, string json)
        {
            SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json), null);
        }

        private static void SendResponse(NetworkStream stream, int status, string reason, string contentType, byte[] body, Dictionary<string, string> extraHeaders)
        {
            int len = body != null ? body.Length : 0;
            StringBuilder sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(status).Append(' ').Append(reason).Append("\r\n");
            if (!string.IsNullOrEmpty(contentType)) sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
            sb.Append("Content-Length: ").Append(len).Append("\r\n");
            sb.Append("Cache-Control: no-store\r\n");
            sb.Append("Connection: close\r\n");
            if (extraHeaders != null)
                foreach (KeyValuePair<string, string> kv in extraHeaders)
                    sb.Append(kv.Key).Append(": ").Append(kv.Value).Append("\r\n");
            sb.Append("\r\n");

            byte[] hdr = Encoding.ASCII.GetBytes(sb.ToString());
            stream.Write(hdr, 0, hdr.Length);
            if (body != null && len > 0) stream.Write(body, 0, len);
            stream.Flush();
        }
    }
}
