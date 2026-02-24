# =============================================================================
# run-backend-local.ps1 — Activate venv, set env, run FastAPI with reload
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  GroceryApp — Backend Local Server" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# ---- Prerequisites ----
Write-Step "Checking prerequisites"
if (-not (Test-Path $Backend)) { Write-Fail "backend/ not found at $Backend"; exit 1 }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Fail "Python not found on PATH"; exit 1
}
Write-Ok "Python found: $(python --version 2>&1)"

# ---- Virtual environment ----
$VenvDir = Join-Path $Backend "venv"
$VenvActivate = Join-Path $VenvDir "Scripts\Activate.ps1"

if (-not (Test-Path $VenvDir)) {
    Write-Step "Creating virtual environment"
    python -m venv $VenvDir
    Write-Ok "venv created"
}

Write-Step "Activating virtual environment"
& $VenvActivate
Write-Ok "venv activated"

# ---- Install/update dependencies ----
Write-Step "Installing dependencies"
python -m pip install -q -r (Join-Path $Backend "requirements.txt") 2>&1 | Out-Null
Write-Ok "Dependencies up to date"

# ---- Environment ----
$EnvFile = Join-Path $Backend ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "   [WARN] No .env file found. Copying .env.example..." -ForegroundColor Yellow
    Copy-Item (Join-Path $Backend ".env.example") $EnvFile
    Write-Host "   Edit $EnvFile with your Firebase credentials." -ForegroundColor Yellow
}

# ---- Start server ----
Write-Step "Starting FastAPI server"
Write-Host "   URL:     http://localhost:8000" -ForegroundColor White
Write-Host "   Docs:    http://localhost:8000/docs" -ForegroundColor White
Write-Host "   Health:  http://localhost:8000/health" -ForegroundColor White
Write-Host "   Press Ctrl+C to stop.`n" -ForegroundColor Gray

Push-Location $Backend
python main.py
Pop-Location
