# =============================================================================
# run-android-debug.ps1 — Start Metro, build debug APK, install, view logs
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$MobileApp = Join-Path $Root "mobile-app"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  GroceryApp — Android Debug Run" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# ---- Prerequisites ----
Write-Step "Checking prerequisites"
if (-not (Test-Path $MobileApp)) { Write-Fail "mobile-app/ not found"; exit 1 }

$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) { Write-Fail "adb not found. Ensure Android SDK platform-tools is on PATH."; exit 1 }

# Check for connected device/emulator
$devices = & adb devices 2>&1 | Select-String "device$"
if (-not $devices) {
    Write-Host "   No device/emulator connected." -ForegroundColor Yellow
    Write-Host "   Start an emulator or connect a device via USB." -ForegroundColor Yellow
    Write-Host "   Continuing anyway — React Native will wait for a device..." -ForegroundColor Gray
}
else {
    Write-Ok "Device connected: $($devices -replace '\s+device','')"
}

# ---- Install dependencies if needed ----
$nodeModules = Join-Path $MobileApp "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Step "Installing npm dependencies"
    Push-Location $MobileApp
    npm install
    Pop-Location
    Write-Ok "Dependencies installed"
}

# ---- Start Metro in background ----
Write-Step "Starting Metro bundler (background)"
$metroJob = Start-Process -FilePath "npx" -ArgumentList "react-native start --reset-cache" -WorkingDirectory $MobileApp -PassThru -WindowStyle Normal
Write-Ok "Metro started (PID: $($metroJob.Id))"
Start-Sleep -Seconds 3

# ---- Build and install ----
Write-Step "Building debug APK and installing on device"
Push-Location $MobileApp
try {
    npx react-native run-android
    Write-Ok "App installed and launched"
} catch {
    Write-Fail "Build/install failed: $_"
    Pop-Location; exit 1
}
Pop-Location

# ---- Logcat ----
Write-Step "Streaming logcat (Ctrl+C to stop)"
Write-Host "   Filtering for GroceryApp and ReactNative..." -ForegroundColor Gray
& adb logcat *:S ReactNative:V ReactNativeJS:V GroceryApp:V
