@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-To-GitHub.ps1"
if errorlevel 1 echo [FAILED] Read the error message above.
pause
