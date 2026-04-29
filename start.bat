@echo off
:: GroceryApp launcher -- forwards to start.ps1.
::
:: The real logic is in start.ps1 because batch cannot reliably trap window
:: close or Ctrl+C. PowerShell's try/finally + Win32 Job Object around the
:: monitor loop handle both.
::
:: Closing this cmd window kills GroceryApp's backend + web admin
:: automatically: they are assigned to a kill-on-close Job Object, so the
:: OS terminates them when PowerShell exits, however it exits.
::
:: ASCII-only on purpose. Windows PowerShell 5.1 reads .ps1 files as
:: Windows-1252 when no UTF-8 BOM is present, and cmd's echo does the same.
:: Em-dashes and arrows get corrupted. Keep both files plain ASCII.
title GroceryApp - Waste-prevention dev launcher
color 0A
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
