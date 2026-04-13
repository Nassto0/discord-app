@echo off
echo ========================================
echo    Nasscord - Setup & Launch
echo ========================================
echo.

echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Download it from https://nodejs.org
    pause
    exit /b 1
)
echo Node.js found: 
node --version

echo.
echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Setting up database...
cd server
call npx prisma db push --accept-data-loss
cd ..

echo.
echo [4/4] Starting Nasscord...
echo.
echo ========================================
echo    Nasscord is starting!
echo    Open http://localhost:5173
echo ========================================
echo.

start "Nasscord Server" cmd /c "cd server && npx tsx src/index.ts"
timeout /t 2 /nobreak >nul
start "Nasscord Client" cmd /c "cd client && npx vite --open"

echo.
echo Both servers are running.
echo Close this window to stop everything.
echo.
pause
