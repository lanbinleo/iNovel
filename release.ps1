# release.ps1

# 1. Remind user to check git status
Write-Host "Please ensure all changes are committed to git." -ForegroundColor Yellow
$confirmation = Read-Host "Are you ready to proceed? (y/n)"

if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Aborted." -ForegroundColor Red
    exit
}

# 2. Get version number input
$versionRaw = Read-Host "Enter the version number (e.g., 1.0.0)"
$version = $versionRaw.Trim()

if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Host "Version cannot be empty." -ForegroundColor Red
    exit
}

# 3. Write to VERSION file
Set-Content -Path "VERSION" -Value $version -NoNewline
Write-Host "Updated VERSION file to $version" -ForegroundColor Green

# 4. Commit the VERSION file (optional but recommended context)
git add VERSION
git commit -m "chore: bump version to $version"

# 5. Create git tag
$tagName = "v$version"
git tag $tagName
Write-Host "Created git tag: $tagName" -ForegroundColor Green

# 6. Push changes and tags
Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push
git push origin $tagName

Write-Host "Release $tagName completed successfully!" -ForegroundColor Green