# ============================================================================
# NillyView Pro — Universal Windows 10/11 Installer (Zero Admin · Multi-PC)
# created by Nilly graphics (Sotiris Christos) — https://nillygraphics.com/
# Registers 62+ Image, Vector, Camera RAW & PSD formats in HKCU (100% portable)
# ============================================================================
param(
    [switch]$Silent,
    [switch]$OpenDefaultApps
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exePath = Join-Path $root 'NillyViewPro.exe'
$icoPath = Join-Path $root 'NillyViewPro.ico'
$srcPath = Join-Path $root 'desktop\NillyViewPro.cs'

Write-Host ''
Write-Host '  ============================================================' -ForegroundColor Cyan
Write-Host '   NillyView Pro — Εγκατάσταση & Σύνδεση 62+ Image/RAW Formats' -ForegroundColor White
Write-Host '   created by Nilly graphics (Sotiris Christos)' -ForegroundColor DarkGray
Write-Host '   https://nillygraphics.com/' -ForegroundColor DarkGray
Write-Host '  ============================================================' -ForegroundColor Cyan
Write-Host ''

# 1. Unblock downloaded files if extracted from GitHub Portable ZIP
Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

# 2. Auto-compile NillyViewPro.exe on any Windows 10/11 PC if missing or older than source
$needBuild = (-not (Test-Path $exePath)) -or ((Test-Path $srcPath) -and ((Get-Item $srcPath).LastWriteTimeUtc -gt (Get-Item $exePath).LastWriteTimeUtc))
if ($needBuild) {
    $fxDir = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
    if (-not (Test-Path "$fxDir\csc.exe")) { $fxDir = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319' }
    $csc = Join-Path $fxDir 'csc.exe'
    $wpf = Join-Path $fxDir 'WPF'
    if (-not (Test-Path $csc)) { throw 'Δεν βρέθηκε ο .NET Framework 4.x C# compiler (csc.exe).' }
    Write-Host '  [1/3] Μεταγλώττιση NillyViewPro.exe (Native Windows 62-Format Host)...' -ForegroundColor Yellow
    $cscArgs = @(
        '/nologo', '/target:winexe', '/optimize+', "/out:$exePath",
        '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll',
        "/r:$wpf\PresentationCore.dll", "/r:$wpf\WindowsBase.dll", "/r:$fxDir\System.Xaml.dll"
    )
    if (Test-Path $icoPath) { $cscArgs += "/win32icon:$icoPath" }
    $cscArgs += $srcPath
    & $csc @cscArgs
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exePath)) {
        throw "Αποτυχία μεταγλώττισης NillyViewPro.exe (exit $LASTEXITCODE)"
    }
    Write-Host ("        OK -> " + [math]::Round((Get-Item $exePath).Length / 1KB, 1) + " KB") -ForegroundColor Green
} else {
    Write-Host '  [1/3] NillyViewPro.exe έτοιμο.' -ForegroundColor Green
}

# 3. Register NillyView Pro for 62+ Image, Vector, RAW & Design formats in HKCU (Zero Admin!)
Write-Host '  [2/3] Εγγραφή του NillyView Pro στα Windows για 62+ τύπους αρχείων...' -ForegroundColor Yellow
$iconRef = if (Test-Path $icoPath) { "$icoPath,0" } else { "$exePath,0" }
$openCmd = "`"$exePath`" `"%1`""

$progKey = 'HKCU:\Software\Classes\NillyViewPro.Image'
New-Item -Path "$progKey\DefaultIcon" -Force | Out-Null
New-Item -Path "$progKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $progKey -Name '(Default)' -Value 'NillyView Pro Image'
Set-ItemProperty -Path $progKey -Name 'FriendlyTypeName' -Value 'NillyView Pro Image'
Set-ItemProperty -Path "$progKey\DefaultIcon" -Name '(Default)' -Value $iconRef
Set-ItemProperty -Path "$progKey\shell\open" -Name 'FriendlyAppName' -Value 'NillyView Pro'
Set-ItemProperty -Path "$progKey\shell\open\command" -Name '(Default)' -Value $openCmd

$appKey = 'HKCU:\Software\Classes\Applications\NillyViewPro.exe'
New-Item -Path "$appKey\DefaultIcon" -Force | Out-Null
New-Item -Path "$appKey\shell\open\command" -Force | Out-Null
New-Item -Path "$appKey\SupportedTypes" -Force | Out-Null
Set-ItemProperty -Path $appKey -Name 'FriendlyAppName' -Value 'NillyView Pro'
Set-ItemProperty -Path "$appKey\DefaultIcon" -Name '(Default)' -Value $iconRef
Set-ItemProperty -Path "$appKey\shell\open\command" -Name '(Default)' -Value $openCmd

$capKey = 'HKCU:\Software\NillyGraphics\NillyViewPro\Capabilities'
New-Item -Path "$capKey\FileAssociations" -Force | Out-Null
Set-ItemProperty -Path $capKey -Name 'ApplicationName' -Value 'NillyView Pro'
Set-ItemProperty -Path $capKey -Name 'ApplicationDescription' -Value 'Ultra-light Image, Camera RAW (38+), SVG & PSD Studio — created by Nilly graphics (Sotiris Christos) — https://nillygraphics.com/'

$allExts = @(
    '.jpg','.jpeg','.jpe','.jfif','.png','.webp','.avif','.gif','.bmp','.dib','.ico','.svg','.svgz',
    '.heic','.heif','.hif','.jxl','.tif','.tiff','.dds','.jxr','.wdp','.hdp',
    '.cr2','.cr3','.crw','.nef','.nrw','.arw','.sr2','.srf','.dng','.raf',
    '.orf','.ori','.rw2','.rwl','.pef','.ptx','.srw','.3fr','.fff','.iiq',
    '.x3f','.kdc','.dcr','.mrw','.mef','.mos','.erf','.raw','.ari','.bay',
    '.cap','.dcs','.drf','.eip','.k25','.pxn',
    '.psd','.psb','.tga','.afdesign','.afphoto','.afpub'
)

foreach ($ext in $allExts) {
    $owp = "HKCU:\Software\Classes\$ext\OpenWithProgids"
    New-Item -Path $owp -Force | Out-Null
    Set-ItemProperty -Path $owp -Name 'NillyViewPro.Image' -Value ([byte[]]@()) -Type Binary
    Set-ItemProperty -Path "$appKey\SupportedTypes" -Name $ext -Value ''
    Set-ItemProperty -Path "$capKey\FileAssociations" -Name $ext -Value 'NillyViewPro.Image'
}

New-Item -Path 'HKCU:\Software\RegisteredApplications' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\RegisteredApplications' -Name 'NillyViewPro' -Value 'Software\NillyGraphics\NillyViewPro\Capabilities'

try {
    Add-Type -Namespace NillyViewShell -Name Notify -MemberDefinition '[System.Runtime.InteropServices.DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, int uFlags, System.IntPtr dwItem1, System.IntPtr dwItem2);' -ErrorAction SilentlyContinue
    [NillyViewShell.Notify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host ("        OK -> Εγγράφηκαν " + $allExts.Count + " formats στο Άνοιγμα με... & στις Προεπιλεγμένες Εφαρμογές!") -ForegroundColor Green

# 4. Desktop & Start Menu Shortcuts
Write-Host '  [3/3] Δημιουργία συντομεύσεων (Επιφάνεια Εργασίας & Start Menu)...' -ForegroundColor Yellow
$wsh = New-Object -ComObject WScript.Shell
$desktopDir = [Environment]::GetFolderPath('Desktop')
$startMenuDir = Join-Path ([Environment]::GetFolderPath('Programs')) 'Nilly graphics'
New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null

foreach ($lnkPath in @(
    (Join-Path $desktopDir 'NillyView Pro.lnk'),
    (Join-Path $startMenuDir 'NillyView Pro.lnk')
)) {
    $sc = $wsh.CreateShortcut($lnkPath)
    $sc.TargetPath = $exePath
    $sc.WorkingDirectory = $root
    $sc.Description = 'NillyView Pro — Image & RAW Studio | created by Nilly graphics (Sotiris Christos) — https://nillygraphics.com/'
    if (Test-Path $icoPath) { $sc.IconLocation = "$icoPath,0" }
    $sc.Save()
}
Write-Host '        OK -> Έτοιμες οι συντομεύσεις!' -ForegroundColor Green
Write-Host ''
Write-Host '  ΟΛΟΚΛΗΡΩΘΗΚΕ! Για να ανοίγουν οι εικόνες σου αυτόματα με διπλό κλικ:' -ForegroundColor Cyan
Write-Host '   -> Ρυθμίσεις Windows -> Προεπιλεγμένες εφαρμογές -> NillyView Pro' -ForegroundColor White
Write-Host '   -> Ή δεξί κλικ σε εικόνα (π.χ. JPG/PNG/WebP/SVG/RAW) -> Άνοιγμα με -> NillyView Pro -> "Πάντα"' -ForegroundColor White
Write-Host ''

if ($OpenDefaultApps) {
    Start-Process 'ms-settings:defaultapps'
} elseif (-not $Silent) {
    $ans = Read-Host '  Θες να ανοίξω τώρα τις Προεπιλεγμένες Εφαρμογές των Windows (Ν/Ο)?'
    if ($ans -match '^[yYνΝ]') { Start-Process 'ms-settings:defaultapps' }
}
