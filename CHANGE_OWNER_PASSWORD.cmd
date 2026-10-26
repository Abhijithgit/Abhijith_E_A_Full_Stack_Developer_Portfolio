@echo off
cd /d "%~dp0"
node server\setup-owner.mjs --change-password
pause
