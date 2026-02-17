# release.ps1
# iNovel 发布脚本 - 支持 SEMVER 预发布版本

# 1. Remind user to check git status
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "iNovel Release Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please ensure all changes are committed to git." -ForegroundColor Yellow
$confirmation = Read-Host "Are you ready to proceed? (y/n)"

if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Aborted." -ForegroundColor Red
    exit
}

Write-Host ""

# 2. Get version number input
Write-Host "SEMVER Format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]" -ForegroundColor Cyan
Write-Host "Examples:" -ForegroundColor Cyan
Write-Host "  0.1.0          - Stable release" -ForegroundColor White
Write-Host "  0.1.0-alpha.1  - Pre-release" -ForegroundColor White
Write-Host "  0.1.0-beta.1   - Pre-release" -ForegroundColor White
Write-Host "  0.1.0-rc.1     - Release candidate" -ForegroundColor White
Write-Host ""

$versionRaw = Read-Host "Enter the version number"
$version = $versionRaw.Trim()

if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Host "Version cannot be empty." -ForegroundColor Red
    exit
}

# 3. Detect if this is a pre-release version
$isPrerelease = $version -match '-(alpha|beta|rc)\.'

if ($isPrerelease) {
    Write-Host ""
    Write-Host "This is a PRE-RELEASE version." -ForegroundColor Yellow
    Write-Host "The GitHub release will be marked as pre-release." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "This is a STABLE release." -ForegroundColor Green
}

Write-Host ""
$continue = Read-Host "Continue? (y/n)"
if ($continue -ne 'y' -and $continue -ne 'Y') {
    Write-Host "Aborted." -ForegroundColor Red
    exit
}

# 4. Write to VERSION file
Set-Content -Path "VERSION" -Value $version -NoNewline
Write-Host "Updated VERSION file to $version" -ForegroundColor Green

# 5. Commit the VERSION file
Write-Host ""
Write-Host "Committing VERSION file..." -ForegroundColor Cyan
git add VERSION
git commit -m "chore: bump version to $version"

# 6. Create git tag
$tagName = "v$version"
git tag $tagName -a -m "Release $tagName"
Write-Host "Created git tag: $tagName" -ForegroundColor Green

# 7. Push changes and tags
Write-Host ""
Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push
git push origin $tagName

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Release $tagName completed successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Wait for GitHub Actions to build the release" -ForegroundColor White
Write-Host "  2. Go to: https://github.com/lanbinleo/iNovel/releases" -ForegroundColor White
if ($isPrerelease) {
    Write-Host "  3. Verify the release is marked as pre-release" -ForegroundColor White
} else {
    Write-Host "  3. Edit the release notes if needed" -ForegroundColor White
    Write-Host "  4. Publish the release" -ForegroundColor White
}
Write-Host ""