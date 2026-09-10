@echo off
start "BalkanGuess Admin" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Start-Admin.ps1"
