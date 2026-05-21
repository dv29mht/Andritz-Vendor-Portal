# Build & package the Andritz Vendor Portal server bundle for the office IIS team.
#
# Outputs:  publish_out\        (raw publish folder - everything the server needs)
#           publish_out.zip     (same contents, zipped with forward-slash entries)
#
# What's included in the zip:
#   - Compiled .NET 8 app DLLs and runtime files
#   - wwwroot\ (React SPA built by the csproj's BuildFrontend target)
#   - appsettings.json              (production template, contains SMTP config)
#   - appsettings.Development.json  (left in for parity with the publish folder)
#   - web.config                    (auto-emitted by `dotnet publish` for IIS)
#   - GIT_COMMIT.txt                (so /api/health can confirm what's deployed)
#
# Why a custom zip step: PowerShell's Compress-Archive and .NET's
# ZipFile.CreateFromDirectory both emit zip entries with backslashes on Windows,
# which some unzip tools treat as literal filenames. This script rewrites every
# entry path to use '/'.
#
# DEPLOYMENT NOTES FOR THE OFFICE IIS TEAM
#   1. The app is mounted at https://qnfsms025.andritz.com/SOT
#      (App:PathBase = "/SOT" in appsettings.json, must match the IIS sub-app).
#   2. Connection string in appsettings.json points at localhost\AndritzVendorPortal
#      with Trusted_Connection. Adjust if the SQL host or auth differs.
#   3. SMTP relay is mail.andritz.com:25 with SCMVendoApprovalNotification creds.
#   4. First boot: DbInitializer calls Database.MigrateAsync() which creates the
#      schema if absent. The DB itself must exist (or the SQL login must have
#      dbcreator) - or RESTORE from the provided .bak. See ARCHITECTURE.md.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# 1. Clean previous output
if (Test-Path 'publish_out')     { Remove-Item -Recurse -Force 'publish_out' }
if (Test-Path 'publish_out.zip') { Remove-Item -Force 'publish_out.zip' }

# 2. Capture current git commit so /api/health (and the marker file) can confirm
#    what's deployed.
$gitCommit = (& git rev-parse --short HEAD) 2>$null
if (-not $gitCommit) { $gitCommit = 'unknown' }
$env:GIT_COMMIT = $gitCommit
Write-Host ("Embedding GIT_COMMIT={0}" -f $gitCommit) -ForegroundColor Cyan

# 3. Publish (the csproj's BuildFrontend + CopyFrontendDist targets are gated on Release).
#    dotnet publish auto-emits web.config for the AspNetCoreModuleV2 handler when
#    targeting an ASP.NET Core web project - we keep that file.
Write-Host "Running dotnet publish..." -ForegroundColor Cyan
dotnet publish src/API/API.csproj -c Release -o publish_out "/p:Version=1.0.0+$gitCommit"
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }

# 3a. Write the commit into a marker file. Env vars don't survive across the IIS
#     app pool restart, but a file in the publish dir does.
Set-Content -Path 'publish_out\GIT_COMMIT.txt' -Value $gitCommit -Encoding utf8 -NoNewline

# 3b. Sanity checks - the artifacts the office team relies on must all be present.
$mustExist = @(
    'publish_out\wwwroot\index.html',
    'publish_out\appsettings.json',
    'publish_out\appsettings.Development.json',
    'publish_out\web.config',
    'publish_out\AndritzVendorPortal.API.dll'
)
foreach ($f in $mustExist) {
    if (-not (Test-Path $f)) { throw "Required artifact missing after publish: $f" }
}
Write-Host "  All required artifacts present (wwwroot, appsettings, web.config, app dll)." -ForegroundColor DarkGray

# 4. Build the zip with forward-slash entry names. We include EVERYTHING in
#    publish_out\ - the client explicitly requested appsettings, appsettings.Development
#    and web.config be shipped in the bundle.
Write-Host "Building publish_out.zip with spec-compliant paths..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$srcDir  = (Resolve-Path 'publish_out').Path
$zipPath = Join-Path $root 'publish_out.zip'

$fs = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $included = 0
    foreach ($f in Get-ChildItem -Path $srcDir -Recurse -File) {
        $relative = $f.FullName.Substring($srcDir.Length).TrimStart('\','/').Replace('\','/')
        $entry = $zip.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        try {
            $fileStream = [System.IO.File]::OpenRead($f.FullName)
            try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose() }
        } finally { $entryStream.Dispose() }
        $included++
    }
    Write-Host ("  Included: {0} files" -f $included) -ForegroundColor DarkGray
} finally {
    $zip.Dispose()
    $fs.Dispose()
}

$zipInfo = Get-Item $zipPath
$mb = [math]::Round($zipInfo.Length / 1MB, 2)
Write-Host ("Done. publish_out.zip = {0} MB" -f $mb) -ForegroundColor Green
