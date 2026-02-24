# =============================================================================
# test-all.ps1 — Run all tests with coverage report
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$MobileApp = Join-Path $Root "mobile-app"
$Backend = Join-Path $Root "backend"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }
function Write-Divider    { Write-Host ("=" * 50) -ForegroundColor DarkGray }

$totalPassed = 0
$totalFailed = 0

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  GroceryApp — Full Test Suite" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# ====================================================================
# Mobile App Tests
# ====================================================================

Write-Divider
Write-Step "Mobile App — Unit Tests"

Push-Location $MobileApp
try {
    $output = npx jest --ci --forceExit --passWithNoTests 2>&1
    $output | ForEach-Object {
        if ($_ -match "Tests:.*(\d+) passed") { $totalPassed += [int]$Matches[1] }
        if ($_ -match "Tests:.*(\d+) failed") { $totalFailed += [int]$Matches[1] }
        if ($_ -match "PASS|FAIL|Tests:|Suites:") { Write-Host "   $_" }
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Mobile unit tests passed"
    } else {
        Write-Fail "Some mobile tests failed"
    }
} catch {
    Write-Fail "Mobile tests error: $_"
}
Pop-Location

# ====================================================================
# Mobile App — Coverage
# ====================================================================

Write-Divider
Write-Step "Mobile App — Coverage Report"

Push-Location $MobileApp
try {
    npx jest --coverage --ci --forceExit --passWithNoTests 2>&1 | ForEach-Object {
        if ($_ -match "Stmts|Branch|Funcs|Lines|File|All files|---") {
            Write-Host "   $_"
        }
    }
    Write-Ok "Coverage report generated: mobile-app/coverage/"
} catch {
    Write-Fail "Coverage generation failed: $_"
}
Pop-Location

# ====================================================================
# Backend — Syntax Check
# ====================================================================

Write-Divider
Write-Step "Backend — Python Syntax Check"

if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyFiles = Get-ChildItem -Path $Backend -Filter "*.py" -Recurse | Where-Object { $_.FullName -notmatch "__pycache__" }
    $pyPassed = 0
    $pyFailed = 0

    foreach ($f in $pyFiles) {
        try {
            python -m py_compile $f.FullName 2>&1 | Out-Null
            $pyPassed++
        } catch {
            Write-Fail "$($f.Name): $_"
            $pyFailed++
        }
    }
    Write-Ok "$pyPassed Python files compiled, $pyFailed errors"
    $totalPassed += $pyPassed
    $totalFailed += $pyFailed
} else {
    Write-Host "   [SKIP] Python not available" -ForegroundColor Yellow
}

# ====================================================================
# Mobile App — TypeScript Check
# ====================================================================

Write-Divider
Write-Step "Mobile App — TypeScript Type Check"

Push-Location $MobileApp
try {
    npx tsc --noEmit 2>&1 | ForEach-Object {
        if ($_ -match "error TS") {
            Write-Host "   $_" -ForegroundColor Red
            $totalFailed++
        }
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "No TypeScript errors"
    } else {
        Write-Fail "TypeScript errors found"
    }
} catch {
    Write-Fail "TypeScript check error: $_"
}
Pop-Location

# ====================================================================
# Mobile App — Lint
# ====================================================================

Write-Divider
Write-Step "Mobile App — ESLint"

Push-Location $MobileApp
try {
    $lintOutput = npx eslint src/ --ext .ts,.tsx --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "No lint errors"
    } else {
        $lintErrors = ($lintOutput | Select-String "error" | Measure-Object).Count
        Write-Fail "$lintErrors lint errors found"
        $totalFailed += $lintErrors
    }
} catch {
    Write-Host "   [SKIP] ESLint not configured" -ForegroundColor Yellow
}
Pop-Location

# ====================================================================
# Summary
# ====================================================================

Write-Host "`n" -NoNewline
Write-Host "============================================" -ForegroundColor $(if ($totalFailed -eq 0) { "Green" } else { "Red" })
Write-Host "  Test Summary" -ForegroundColor $(if ($totalFailed -eq 0) { "Green" } else { "Red" })
Write-Host "============================================" -ForegroundColor $(if ($totalFailed -eq 0) { "Green" } else { "Red" })
Write-Host "   Passed: $totalPassed" -ForegroundColor Green
if ($totalFailed -gt 0) {
    Write-Host "   Failed: $totalFailed" -ForegroundColor Red
} else {
    Write-Host "   Failed: 0" -ForegroundColor Green
}
Write-Host ""

exit $(if ($totalFailed -eq 0) { 0 } else { 1 })
