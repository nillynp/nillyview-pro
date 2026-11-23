# ============================================================================
# NillyView Pro — Clean Uninstaller (Registry + Shortcuts only)
# created by Nilly graphics (Sotiris Christos) — https://nillygraphics.com/
# ============================================================================
param([switch]$Silent)

$ErrorActionPreference = 'SilentlyContinue'
Write-Host ''
Write-Host '  Απεγκατάσταση συντομεύσεων & εγγραφών του NillyView Pro...' -ForegroundColor Yellow

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
    Remove-ItemProperty -Path "HKCU:\Software\Classes\$ext\OpenWithProgids" -Name 'NillyViewPro.Image' -Force
}

Remove-Item -Path 'HKCU:\Software\Classes\NillyViewPro.Image' -Recurse -Force
Remove-Item -Path 'HKCU:\Software\Classes\Applications\NillyViewPro.exe' -Recurse -Force
Remove-Item -Path 'HKCU:\Software\NillyGraphics\NillyViewPro' -Recurse -Force
Remove-ItemProperty -Path 'HKCU:\Software\RegisteredApplications' -Name 'NillyViewPro' -Force

$desktopLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'NillyView Pro.lnk'
$startLnk   = Join-Path ([Environment]::GetFolderPath('Programs')) 'Nilly graphics\NillyView Pro.lnk'
if (Test-Path $desktopLnk) { Remove-Item $desktopLnk -Force }
if (Test-Path $startLnk)   { Remove-Item $startLnk -Force }

try {
    Add-Type -Namespace NillyViewShell -Name NotifyUn -MemberDefinition '[System.Runtime.InteropServices.DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, int uFlags, System.IntPtr dwItem1, System.IntPtr dwItem2);' -ErrorAction SilentlyContinue
    [NillyViewShell.NotifyUn]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host '  Ολοκληρώθηκε! Οι προσωπικές σου φωτογραφίες ΔΕΝ επηρεάστηκαν.' -ForegroundColor Green
if (-not $Silent) { Read-Host '  Πάτα Enter για έξοδο' }
