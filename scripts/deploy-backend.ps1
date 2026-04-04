# =============================================================================
# deploy-backend.ps1 — Build SPA + Deploy to Render
#
# This script:
#   1. Builds the web-admin SPA locally (Vite)
#   2. Commits any changes
#   3. Pushes to GitHub (origin/main) AND Render repo (render/master)
#   4. Waits for Render health check
#
# Render Setup:
#   - Repo: zhiliushi/groceryapp-backend (separate from main GroceryApp repo)
#   - Branch: master
#   - Root Directory: backend
#   - Dockerfile Path: ./Dockerfile
#   - Docker Build Context: .
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"
$WebAdmin = Join-Path $Backend "web-admin"

$RenderServiceUrl = "https://groceryapp-backend-7af2.onrender.com"
$HealthEndpoint = "$RenderServiceUrl/health"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  GroceryApp — Backend Deployment" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# ---- Build SPA ----
Write-Step "Building web-admin SPA"
Push-Location $WebAdmin
try {
    npx vite build 2>&1 | ForEach-Object {
        if ($_ -match "built in|error") { Write-Host "   $_" }
    }
    Write-Ok "SPA built to backend/static/spa/"
} catch {
    Write-Fail "SPA build failed: $_"
    Pop-Location; exit 1
}
Pop-Location

# ---- Check for uncommitted changes ----
Write-Step "Checking git status"
Push-Location $Root
$status = git status --porcelain
if ($status) {
    Write-Host "   Changes detected:" -ForegroundColor Yellow
    $status | Select-Object -First 10 | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    if (($status | Measure-Object).Count -gt 10) {
        Write-Host "     ... and more" -ForegroundColor Gray
    }
    $confirm = Read-Host "   Commit and deploy? (y/N)"
    if ($confirm -ne 'y') {
        Write-Host "   Aborted." -ForegroundColor Yellow
        Pop-Location; exit 0
    }
    git add -A
    $msg = Read-Host "   Commit message (or Enter for default)"
    if (-not $msg) { $msg = "deploy: update for Render deployment" }
    git commit -m "$msg`n`nCo-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
} else {
    Write-Ok "Working tree clean"
}

# ---- Push to both remotes ----
Write-Step "Pushing to GitHub (origin/main)"
try {
    git push origin main 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    Write-Ok "Pushed to origin/main"
} catch {
    Write-Fail "Push to origin failed: $_"
}

Write-Step "Pushing to Render repo (render/master)"
try {
    git push render main:master 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    Write-Ok "Pushed to render/master (triggers auto-deploy)"
} catch {
    Write-Fail "Push to render failed. Run: git remote add render https://github.com/zhiliushi/groceryapp-backend.git"
    Pop-Location; exit 1
}
Pop-Location

# ---- Wait for deployment ----
Write-Step "Waiting for Render deployment (checking health endpoint)"
Write-Host "   This may take 3-5 minutes on free tier..." -ForegroundColor Gray
$maxAttempts = 30
$attempt = 0
$deployed = $false

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "   Attempt $attempt/$maxAttempts..." -ForegroundColor Gray -NoNewline
    try {
        $response = Invoke-RestMethod -Uri $HealthEndpoint -Method Get -TimeoutSec 10 -ErrorAction Stop
        if ($response.status -eq "healthy") {
            $deployed = $true
            Write-Host " Healthy!" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host " Not ready yet" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 10
}

if ($deployed) {
    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "  Deployment successful!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "`n   URL:     $RenderServiceUrl" -ForegroundColor White
    Write-Host "   Docs:    $RenderServiceUrl/docs" -ForegroundColor White
    Write-Host "   Health:  $HealthEndpoint`n" -ForegroundColor White
} else {
    Write-Fail "Health check timed out after $maxAttempts attempts."
    Write-Host "   Check Render dashboard: https://dashboard.render.com" -ForegroundColor Yellow
    exit 1
}
