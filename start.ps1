# GroceryApp launcher -- dev mode (terminal visible).
#
# CONTRACT (modeled on Luqman's start.ps1, 2026-04-29):
#   1. While the terminal is alive, services stay alive.
#      A service dying on its own does NOT terminate the terminal or the
#      other service. The user keeps full control.
#   2. When the terminal closes (Ctrl+C, X button, OS shutdown, hard kill,
#      anything), every spawned service dies with it -- guaranteed by a
#      Win32 Job Object with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE. Even if
#      PowerShell never reaches its `finally` block, the OS still kills the
#      job's children when the last handle to the job closes (which happens
#      automatically when the PowerShell process exits, however it exits).
#   3. The user's only kill switch is the terminal: closing it = stopping
#      GroceryApp. No more orphan python.exe blocking port 8000.
#
# Why a Job Object instead of relying on PowerShell cleanup?
#   The previous "raw cmd window" approach left orphans: when the cmd
#   closed without graceful exit, Windows force-terminated PowerShell after
#   a few seconds, and any uvicorn child still running was orphaned. The
#   Job Object fixes that: the OS kills the job's children when the handle
#   closes, no race, no rescue logic needed.
#
# Ports:
#   - Backend (FastAPI, uvicorn) : 8000
#   - Web admin SPA (Vite)       : 5173 (strictPort)
# These are the only ports we sweep -- Luqman's 1420/8741 are NOT touched.
#
# ENCODING: ASCII only. Windows PowerShell 5.1 reads .ps1 as Windows-1252
# without a UTF-8 BOM, which corrupts em-dashes. Stick to -- and ->.
#
# Do NOT set $ErrorActionPreference = 'Stop'. Under 5.1 that combines badly
# with `2>&1` on native executables (npm, npx) -- stderr lines wrap as
# ErrorRecords and become terminating. Default 'Continue' is correct.
trap {
    Write-Host ''
    Write-Host "[!] Unhandled error on line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'backend\web-admin'
$venvPy   = Join-Path $backend 'venv\Scripts\python.exe'
$logDir   = Join-Path $root 'logs'
$pidFile  = Join-Path $logDir 'pids.txt'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# Backend interpreter: prefer the venv's python, else system 'python' on PATH.
if (Test-Path $venvPy) {
    $pythonCmd = $venvPy
} else {
    $pythonCmd = 'python'
}

# --- Reserved ports (single source of truth) ---
$groceryBackendPort  = 8000
$groceryFrontendPort = 5173
$groceryPorts        = @($groceryBackendPort, $groceryFrontendPort)

# ===========================================================================
# Win32 Job Object -- the kill switch tied to this PowerShell process
# ===========================================================================
# When PowerShell exits (gracefully OR by hard kill), its handle to the job
# is closed. With JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE set, the OS terminates
# every process in the job at that moment. No race, no orphan.
$jobObjectSrc = @'
using System;
using System.Runtime.InteropServices;

public static class GroceryJobObjectWin32 {
    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public Int64 PerProcessUserTimeLimit;
        public Int64 PerJobUserTimeLimit;
        public UInt32 LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public UInt32 ActiveProcessLimit;
        public UIntPtr Affinity;
        public UInt32 PriorityClass;
        public UInt32 SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct IO_COUNTERS {
        public UInt64 ReadOperationCount;
        public UInt64 WriteOperationCount;
        public UInt64 OtherOperationCount;
        public UInt64 ReadTransferCount;
        public UInt64 WriteTransferCount;
        public UInt64 OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetInformationJobObject(
        IntPtr hJob, int infoClass, IntPtr info, uint cbInfo);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(
        uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    public const uint PROCESS_TERMINATE = 0x0001;
    public const uint PROCESS_SET_QUOTA = 0x0100;
    public const uint PROCESS_QUERY_INFORMATION = 0x0400;
    public const int  JobObjectExtendedLimitInformation = 9;
    public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

    public static IntPtr CreateKillOnCloseJob() {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) return IntPtr.Zero;
        var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        int len = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr ptr = Marshal.AllocHGlobal(len);
        try {
            Marshal.StructureToPtr(info, ptr, false);
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ptr, (uint)len)) {
                CloseHandle(job);
                return IntPtr.Zero;
            }
        } finally {
            Marshal.FreeHGlobal(ptr);
        }
        return job;
    }

    public static bool AddPidToJob(IntPtr job, int pid) {
        IntPtr proc = OpenProcess(
            PROCESS_TERMINATE | PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION,
            false, pid);
        if (proc == IntPtr.Zero) return false;
        try { return AssignProcessToJobObject(job, proc); }
        finally { CloseHandle(proc); }
    }
}
'@

try {
    Add-Type -TypeDefinition $jobObjectSrc -ErrorAction Stop
} catch {
    # Already loaded in this session -- ignore.
}

$script:groceryJob = [GroceryJobObjectWin32]::CreateKillOnCloseJob()
if ($script:groceryJob -eq [IntPtr]::Zero) {
    Write-Host '[!] Failed to create Job Object. Falling back to legacy cleanup.' -ForegroundColor Yellow
}

# ===========================================================================
# Helpers
# ===========================================================================

function Stop-ByPort {
    param([int[]]$Ports)
    foreach ($port in $Ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    }
}

function Test-PortListening {
    param([int]$Port)
    return [bool](
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
    )
}

function Get-PortPid {
    param([int]$Port)
    return (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty OwningProcess)
}

function Add-PidToGroceryJob {
    param([int]$ProcessId, [string]$Label)
    if ($script:groceryJob -eq [IntPtr]::Zero) { return $false }
    if (-not $ProcessId) { return $false }
    $ok = [GroceryJobObjectWin32]::AddPidToJob($script:groceryJob, $ProcessId)
    if (-not $ok) {
        Write-Host "      [!] Could not assign $Label PID $ProcessId to Job Object." -ForegroundColor Yellow
    }
    return $ok
}

function Wait-ForUrl {
    param([string]$Url, [int]$MaxAttempts = 20, [int]$DelaySeconds = 2)
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        Start-Sleep -Seconds $DelaySeconds
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { return $true }
        } catch {}
    }
    return $false
}

function Save-PidFile {
    param([hashtable]$Pids)
    if ($Pids.Count -eq 0) {
        Remove-Item $pidFile -ErrorAction SilentlyContinue
        return
    }
    $lines = @()
    foreach ($k in $Pids.Keys) { $lines += "$k=$($Pids[$k])" }
    $lines | Set-Content -Path $pidFile -Encoding ASCII
}

# ===========================================================================
# Boot sequence
# ===========================================================================

Write-Host '============================================' -ForegroundColor Green
Write-Host '  GroceryApp - Starting Services'             -ForegroundColor Green
Write-Host '============================================' -ForegroundColor Green
Write-Host ''

# --- [1/3] Clean slate: kill stale listeners on OUR ports only ---
Write-Host "[1/3] Freeing GroceryApp ports $($groceryPorts -join ', ')..."
Stop-ByPort -Ports $groceryPorts
Start-Sleep -Milliseconds 500

# --- [2/3] Backend ---
if (-not (Test-Path (Join-Path $backend 'main.py'))) {
    Write-Host "[!] Backend main.py not found in $backend" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}
Write-Host "[2/3] Starting backend (port $groceryBackendPort) using $pythonCmd..."

# Quick venv-health probe: try importing a couple of deps that have
# bitten us before (numpy + sentry_sdk pulled in transitively). If
# either is missing, auto-install requirements.txt so the launcher
# survives a partially-built venv. Captured 2026-05-03 after a fresh
# `start.bat` failed because the venv was stale.
$probeOut = & $pythonCmd -c 'import numpy, sentry_sdk' 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Venv missing deps -- running 'pip install -r requirements.txt' (one-time, ~30s)..." -ForegroundColor Yellow
    $reqFile = Join-Path $backend 'requirements.txt'
    if (Test-Path $reqFile) {
        & $pythonCmd -m pip install -r $reqFile --quiet 2>&1 | Out-File (Join-Path $logDir 'pip-install.log') -Encoding utf8
        if ($LASTEXITCODE -ne 0) {
            Write-Host "      [!] pip install failed. See $(Join-Path $logDir 'pip-install.log')." -ForegroundColor Red
        } else {
            Write-Host '      Deps installed.'
        }
    } else {
        Write-Host "      [!] requirements.txt not found at $reqFile" -ForegroundColor Red
    }
}

$backendProc = Start-Process -FilePath $pythonCmd `
    -ArgumentList '-m', 'uvicorn', 'main:app', '--reload', '--port', $groceryBackendPort `
    -WorkingDirectory $backend `
    -PassThru -NoNewWindow `
    -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'backend.err.log')

# Best-effort: assign the wrapper PID to the job immediately so any descendants
# inherit job membership.
Add-PidToGroceryJob -ProcessId $backendProc.Id -Label 'backend (wrapper)' | Out-Null

if (Wait-ForUrl -Url "http://127.0.0.1:$groceryBackendPort/health" -MaxAttempts 20) {
    Write-Host '      Backend ready.'
} else {
    Write-Host '      [!] Backend slow -- continuing anyway.' -ForegroundColor Yellow
    Write-Host "      Tail logs: $(Join-Path $logDir 'backend.err.log')"
}

# Now resolve the REAL backend PID via the listening port, not the wrapper.
$childPids = @{}
$realBackendPid = Get-PortPid -Port $groceryBackendPort
if ($realBackendPid) {
    $childPids['backend'] = [int]$realBackendPid
    Add-PidToGroceryJob -ProcessId $realBackendPid -Label 'backend' | Out-Null
}

# --- [3/3] Web admin SPA ---
if (-not (Test-Path (Join-Path $frontend 'package.json'))) {
    Write-Host "[!] web-admin package.json not found in $frontend" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}
Write-Host "[3/3] Starting web-admin SPA (port $groceryFrontendPort)..."

$frontendProc = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run', 'dev' `
    -WorkingDirectory $frontend `
    -PassThru -NoNewWindow `
    -RedirectStandardOutput (Join-Path $logDir 'frontend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'frontend.err.log')

Add-PidToGroceryJob -ProcessId $frontendProc.Id -Label 'frontend (wrapper)' | Out-Null

if (Wait-ForUrl -Url "http://127.0.0.1:$groceryFrontendPort" -MaxAttempts 15) {
    Write-Host '      Web admin ready.'
} else {
    Write-Host '      [!] Web admin slow -- continuing anyway.' -ForegroundColor Yellow
    Write-Host "      Tail logs: $(Join-Path $logDir 'frontend.err.log')"
}

$realFrontendPid = Get-PortPid -Port $groceryFrontendPort
if ($realFrontendPid) {
    $childPids['frontend'] = [int]$realFrontendPid
    Add-PidToGroceryJob -ProcessId $realFrontendPid -Label 'frontend' | Out-Null
}

Save-PidFile -Pids $childPids

# --- Summary + browser ---
Write-Host ''
Write-Host '============================================' -ForegroundColor Green
Write-Host '  GroceryApp is running.'                      -ForegroundColor Green
Write-Host "    Web admin: http://localhost:$groceryFrontendPort"
Write-Host "    Backend:   http://localhost:$groceryBackendPort"
Write-Host "    Logs:      $logDir"
Write-Host ''
Write-Host '  Lifecycle contract:' -ForegroundColor Cyan
Write-Host '    * Closing this window kills both services (Job Object).'
Write-Host '    * Press Ctrl+C in this window to stop everything cleanly.'
Write-Host '    * If a service dies on its own, this terminal stays open and'
Write-Host '      reports it -- the other service keeps running.'
Write-Host '============================================' -ForegroundColor Green
Write-Host ''
Start-Process "http://localhost:$groceryFrontendPort" | Out-Null

# ===========================================================================
# Monitor loop -- never exits on a service dying.
# ===========================================================================
$alertedDown = @{}
try {
    while ($true) {
        Start-Sleep -Seconds 5

        foreach ($svc in @(
            @{ name = 'backend';  port = $groceryBackendPort  },
            @{ name = 'frontend'; port = $groceryFrontendPort }
        )) {
            $listening = Test-PortListening $svc.port
            $wasDown = $alertedDown.ContainsKey($svc.name)

            if (-not $listening -and -not $wasDown) {
                Write-Host ''
                Write-Host "[!] $($svc.name) (port $($svc.port)) stopped listening at $(Get-Date -Format 'HH:mm:ss')." -ForegroundColor Yellow
                Write-Host "    Other services keep running. Close this window or press Ctrl+C to stop everything." -ForegroundColor Yellow
                Write-Host "    Tail $logDir\$($svc.name).err.log for the cause." -ForegroundColor Yellow
                $alertedDown[$svc.name] = $true
                $childPids.Remove($svc.name) | Out-Null
                Save-PidFile -Pids $childPids
            }
            elseif ($listening -and $wasDown) {
                Write-Host ''
                Write-Host "[ok] $($svc.name) (port $($svc.port)) is listening again at $(Get-Date -Format 'HH:mm:ss')." -ForegroundColor Green
                $alertedDown.Remove($svc.name) | Out-Null
                # Refresh real PID + re-add to job so the new instance dies with the terminal too.
                $newPid = Get-PortPid -Port $svc.port
                if ($newPid) {
                    $childPids[$svc.name] = [int]$newPid
                    Add-PidToGroceryJob -ProcessId $newPid -Label $svc.name | Out-Null
                    Save-PidFile -Pids $childPids
                }
            }
        }
    }
} finally {
    Write-Host ''
    Write-Host 'Shutting down GroceryApp...' -ForegroundColor Yellow

    # Graceful first: politely ask each child to exit (no /F yet).
    foreach ($name in @('frontend', 'backend')) {
        if ($childPids.ContainsKey($name)) {
            $cpid = $childPids[$name]
            cmd /c "taskkill /T /PID $cpid >nul 2>&1"
        }
    }
    Start-Sleep -Milliseconds 800

    # Force-kill anything still listening on our ports.
    Stop-ByPort -Ports $groceryPorts

    # Force-kill by PID tree as belt-and-suspenders.
    foreach ($name in @('frontend', 'backend')) {
        if ($childPids.ContainsKey($name)) {
            $cpid = $childPids[$name]
            cmd /c "taskkill /F /T /PID $cpid >nul 2>&1"
        }
    }

    Remove-Item $pidFile -ErrorAction SilentlyContinue

    # Final guarantee: closing the Job Object handle kills any process still
    # left in the job. This fires automatically when PowerShell exits, but we
    # do it explicitly here so the message ordering is clean.
    if ($script:groceryJob -ne [IntPtr]::Zero) {
        [GroceryJobObjectWin32]::CloseHandle($script:groceryJob) | Out-Null
        $script:groceryJob = [IntPtr]::Zero
    }

    Write-Host 'Stopped.' -ForegroundColor Green
}
