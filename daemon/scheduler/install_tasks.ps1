# ABM Malaya ERP — Install Daemon Tasks to Windows Task Scheduler
# Run this script as Administrator once to register background tasks.
#
# Usage (PowerShell as Admin):
#   .\daemon\scheduler\install_tasks.ps1

$ErrorActionPreference = "Stop"

$basePath = "C:\Users\ilhampradani\.gemini\antigravity-ide\scratch\erp-abmalaya"
$schedulerPath = "$basePath\daemon\scheduler"

Write-Host "=== ABM Malaya ERP — Registering Background Daemon Tasks ===" -ForegroundColor Cyan

# ── Task 1: AI Scanner (every 10 minutes) ────────────────────────────────────
$task1Name = "ABMalaya-AIScan"
try {
    $existingTask1 = Get-ScheduledTask -TaskName $task1Name -ErrorAction SilentlyContinue
    if ($existingTask1) {
        Unregister-ScheduledTask -TaskName $task1Name -Confirm:$false
        Write-Host "Removed existing task: $task1Name" -ForegroundColor Yellow
    }
    $xml1 = Get-Content "$schedulerPath\task_ai_scan.xml" -Raw -Encoding Unicode
    Register-ScheduledTask -Xml $xml1 -TaskName $task1Name -Force | Out-Null
    Write-Host "Registered: $task1Name (every 10 minutes)" -ForegroundColor Green
} catch {
    Write-Host "Failed to register $task1Name`: $_" -ForegroundColor Red
}

# ── Task 2: Gmail Sync Fallback (every 15 minutes) ───────────────────────────
$task2Name = "ABMalaya-SyncFallback"
try {
    $existingTask2 = Get-ScheduledTask -TaskName $task2Name -ErrorAction SilentlyContinue
    if ($existingTask2) {
        Unregister-ScheduledTask -TaskName $task2Name -Confirm:$false
        Write-Host "Removed existing task: $task2Name" -ForegroundColor Yellow
    }
    $xml2 = Get-Content "$schedulerPath\task_sync_fallback.xml" -Raw -Encoding Unicode
    Register-ScheduledTask -Xml $xml2 -TaskName $task2Name -Force | Out-Null
    Write-Host "Registered: $task2Name (every 15 minutes)" -ForegroundColor Green
} catch {
    Write-Host "Failed to register $task2Name`: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Cyan
Write-Host "To verify: open Task Scheduler → Task Scheduler Library → look for 'ABMalaya-*'" -ForegroundColor Gray
Write-Host "To test manually: php daemon\scan_ai.php" -ForegroundColor Gray
Write-Host "Logs: daemon\logs\ai_scan_YYYY-MM-DD.log" -ForegroundColor Gray
