# iNovel Windows Installer
# Usage: irm https://raw.githubusercontent.com/lanbinleo/novel-writer/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

$installDir = "$env:USERPROFILE\.inovel"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\iNovel.lnk"

Write-Host "iNovel Installer" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host ""

# Get latest release info
Write-Host "Fetching latest release..." -ForegroundColor Yellow
try {
    $releaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/lanbinleo/novel-writer/releases/latest"
    $version = $releaseInfo.tag_name
    $downloadUrl = $releaseInfo.assets | Where-Object { $_.name -like "*windows-amd64.exe" } | Select-Object -ExpandProperty browser_download_url
} catch {
    Write-Host "Failed to fetch release info: $_" -ForegroundColor Red
    exit 1
}

if (-not $downloadUrl) {
    Write-Host "No Windows release found!" -ForegroundColor Red
    exit 1
}

Write-Host "Latest version: $version" -ForegroundColor Green
Write-Host ""

# Create install directory
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$exePath = "$installDir\iNovel.exe"

# Download
Write-Host "Downloading iNovel..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $exePath -UseBasicParsing
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Downloaded to: $exePath" -ForegroundColor Green

# Create desktop shortcut
Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $exePath
$Shortcut.WorkingDirectory = $installDir
$Shortcut.Description = "iNovel - Novel Writer"
$Shortcut.Save()

Write-Host "Shortcut created: $shortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Cyan
Write-Host "You can now launch iNovel from your desktop." -ForegroundColor Cyan
