# =============================================================================
# build-android.ps1 — Clean build, sign, and output release APK
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$MobileApp = Join-Path $Root "mobile-app"
$Android = Join-Path $MobileApp "android"
$BuildsDir = Join-Path $Root "builds"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  GroceryApp — Android Release Build" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# ---- Prerequisites ----
Write-Step "Checking prerequisites"
if (-not (Test-Path $Android)) { Write-Fail "android/ directory not found at $Android"; exit 1 }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { Write-Fail "Java not found. Install JDK 17+."; exit 1 }
Write-Ok "Prerequisites satisfied"

# ---- Clean ----
Write-Step "Cleaning previous build"
Push-Location $Android
try {
    & .\gradlew.bat clean 2>&1 | Out-Null
    Write-Ok "Clean complete"
} catch {
    Write-Fail "Clean failed: $_"
    Pop-Location; exit 1
}

# ---- Build Release APK ----
Write-Step "Building release APK (this may take a few minutes)"
try {
    & .\gradlew.bat assembleRelease 2>&1 | ForEach-Object {
        if ($_ -match "BUILD SUCCESSFUL") { Write-Ok $_ }
        elseif ($_ -match "ERROR|FAILURE") { Write-Host "   $_" -ForegroundColor Red }
    }
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
    Write-Ok "Release APK built"
} catch {
    Write-Fail "Build failed: $_"
    Pop-Location; exit 1
}
Pop-Location

# ---- Copy to builds/ ----
Write-Step "Copying APK to builds/"
if (-not (Test-Path $BuildsDir)) { New-Item -ItemType Directory -Path $BuildsDir | Out-Null }

$ApkSource = Join-Path $Android "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $ApkSource)) {
    # Try unsigned variant
    $ApkSource = Get-ChildItem -Path (Join-Path $Android "app\build\outputs\apk\release") -Filter "*.apk" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}

if ($ApkSource -and (Test-Path $ApkSource)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $dest = Join-Path $BuildsDir "GroceryApp-release-$timestamp.apk"
    Copy-Item $ApkSource $dest
    Write-Ok "APK saved: $dest"
    Write-Host "`n   Size: $([math]::Round((Get-Item $dest).Length / 1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Fail "APK not found at expected path"
    exit 1
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green
