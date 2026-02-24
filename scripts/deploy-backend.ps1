# =============================================================================
# deploy-backend.ps1 — Deploy to Render and verify health
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"

$RenderServiceUrl = "https://groceryapp-api.onrender.com"
$HealthEndpoint = "$RenderServiceUrl/health"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  GroceryApp — Backend Deployment" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# ---- Prerequisites ----
Write-Step "Checking prerequisites"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Fail "git not found"; exit 1 }
Write-Ok "git available"

# ---- Check for uncommitted changes ----
Write-Step "Checking git status"
Push-Location $Root
$status = git status --porcelain -- backend/
if ($status) {
    Write-Host "   Uncommitted changes in backend/:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    $confirm = Read-Host "   Commit and push? (y/N)"
    if ($confirm -ne 'y') {
        Write-Host "   Aborted." -ForegroundColor Yellow
        Pop-Location; exit 0
    }
    git add backend/
    git commit -m "deploy: update backend for Render deployment"
}
else {
    Write-Ok "Working tree clean"
}

# ---- Push to remote ----
Write-Step "Pushing to remote (triggers Render auto-deploy)"
try {
    git push origin main 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    Write-Ok "Pushed to origin/main"
} catch {
    Write-Fail "Push failed: $_"
    Pop-Location; exit 1
}
Pop-Location

# ---- Wait for deployment ----
Write-Step "Waiting for Render deployment (checking health endpoint)"
$maxAttempts = 20
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
    Start-Sleep -Seconds 15
}

if ($deployed) {
    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "  Deployment successful!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "`n   API:     $RenderServiceUrl" -ForegroundColor White
    Write-Host "   Docs:    $RenderServiceUrl/docs" -ForegroundColor White
    Write-Host "   Health:  $HealthEndpoint`n" -ForegroundColor White
} else {
    Write-Fail "Health check failed after $maxAttempts attempts."
    Write-Host "   Check Render dashboard: https://dashboard.render.com" -ForegroundColor Yellow
    exit 1
}
