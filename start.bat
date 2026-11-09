@echo off
setlocal
cd /d "%~dp0"
echo.
echo  LeadPilot - Lead-to-Visit Sales Agent (Paytm Builder's Hackathon, Pune)
echo  ------------------------------------------------------------------------
if not exist "backend\.venv\Scripts\python.exe" (
  echo  [1/3] Creating Python environment...
  python -m venv backend\.venv || goto :err
)
backend\.venv\Scripts\python -m pip install -q -r backend\requirements.txt || goto :err
if not exist "backend\.env" echo  NOTE: backend\.env missing - add SARVAM_API_KEY=... for voice and AI features.
if not exist "frontend\node_modules" (
  echo  [2/3] Installing dashboard packages...
  pushd frontend & call npm install --no-audit --no-fund & popd
)
echo  [3/3] Building dashboard + standalone LeadPilot.html...
pushd frontend & call npx vite build --logLevel error & call npx vite build -c vite.single.config.js --logLevel error & popd
copy /y frontend\dist-single\index.html LeadPilot.html >nul
echo.
echo  Open http://localhost:8000   (or double-click LeadPilot.html while this window is running)
echo  Use Chrome or Edge and allow the microphone for live voice calls. Ctrl+C to stop.
start "" http://localhost:8000
backend\.venv\Scripts\python -m uvicorn main:app --app-dir backend --port 8000 --timeout-graceful-shutdown 2
goto :eof
:err
echo  Setup failed. Check that Python 3.11+ and Node 18+ are installed.
pause
