@echo off
setlocal
cd /d "%~dp0"
title DZ Lead Form Pro - Local Demo
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
node.exe -e "process.exit(process.versions.node.split('.')[0] === '24' ? 0 : 1)"
if errorlevel 1 goto wrong_node
if not exist "node_modules\next\package.json" (
  echo Installing dependencies. Internet is needed for this first step only.
  call npm.cmd ci
  if errorlevel 1 goto failed
)
echo.
echo Local demo only. No hosting, Docker or Shopify account is required.
echo Keep this window open while using the app.
echo Form:      http://localhost:3000/form
echo Dashboard: http://localhost:3000/dashboard
echo Wait for Ready, then double-click OPEN-FORM.cmd or OPEN-DASHBOARD.cmd.
echo.
call npm.cmd run dev:local
if errorlevel 1 goto failed
goto finished
:missing_node
echo Install Node.js 24 LTS from https://nodejs.org/ then reopen this file.
goto failed
:wrong_node
echo This project requires Node.js 24.x. Install it from https://nodejs.org/.
:failed
echo.
echo Startup stopped. Read the error above and see WINDOWS-START-HERE.md.
:finished
pause
endlocal
