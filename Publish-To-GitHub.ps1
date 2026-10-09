$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
Set-Location -LiteralPath $project
$repo = 'https://github.com/yueling043210-cpu/daniya-block-pk.git'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git for Windows is not found in PATH. Restart PowerShell after installing Git.'
}
if (-not (Test-Path -LiteralPath (Join-Path $project 'docs/index.html'))) {
    throw 'Missing docs/index.html. This is not the game project root.'
}
if (-not (Test-Path -LiteralPath (Join-Path $project '.gitignore'))) {
    throw 'Missing .gitignore. Refusing to publish.'
}
if (-not (Test-Path -LiteralPath (Join-Path $project '.git'))) {
    & git init
    if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
}
$remotes = @(& git remote)
if ($LASTEXITCODE -ne 0) { throw 'git remote failed.' }
if ($remotes -contains 'origin') {
    $currentOrigin = ((& git remote get-url origin) | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read origin remote.' }
    if ($currentOrigin -ne $repo) {
        throw ('Refusing to change existing origin: ' + $currentOrigin)
    }
} else {
    & git remote add origin $repo
    if ($LASTEXITCODE -ne 0) { throw 'git remote add failed.' }
}

& git add --all
if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }
$tracked = @(& git ls-files)
if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed.' }
$secretMatches = @($tracked | Where-Object {
    $_ -match '^(server-data/|\.env($|\.)|node_modules/)' -or
    $_ -match '\.(sqlite|sqlite3|db|key|pem)$'
})
if ($secretMatches.Count -gt 0) {
    throw ('Refusing to upload potentially sensitive files: ' + ($secretMatches -join ', '))
}
Write-Host ''
Write-Host ('Project: ' + $project) -ForegroundColor Cyan
Write-Host ('GitHub:  ' + $repo) -ForegroundColor Cyan
Write-Host 'Files to upload / changes:' -ForegroundColor Cyan
& git status --short
if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
Write-Host ''
$confirm = Read-Host 'Type PUBLISH to commit and push to this PUBLIC GitHub repository'
if ($confirm -cne 'PUBLISH') {
    Write-Host 'Cancelled. Nothing was pushed.' -ForegroundColor Yellow
    exit 0
}

& git diff --cached --quiet
$stagedExitCode = $LASTEXITCODE
if ($stagedExitCode -eq 1) {
    & git commit -m 'Initial Daniya Block PK v0.1'
    if ($LASTEXITCODE -ne 0) {
        throw 'git commit failed. Configure git user.name and user.email, then retry.'
    }
} elseif ($stagedExitCode -ne 0) {
    throw ('git diff failed (exit ' + $stagedExitCode + ').')
}
& git branch -M main
if ($LASTEXITCODE -ne 0) { throw 'git branch -M main failed.' }
& git push -u origin main
if ($LASTEXITCODE -ne 0) {
    throw 'git push failed. Check GitHub sign-in or whether the remote already has commits.'
}
Write-Host ''
Write-Host 'PUBLISH SUCCEEDED. Next: GitHub repo Settings > Pages > main > /docs > Save.' -ForegroundColor Green
