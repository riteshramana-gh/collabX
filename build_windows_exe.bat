@echo off
echo ======================================================================
echo    CollabBoard X - Server and Client Windows Executable Builder
echo ======================================================================
echo.

echo [*] Building React frontend production bundle...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [-] Frontend build failed!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo [*] Compiling CollabBoardX-Server.exe and CollabBoardX-Client.exe...
py -3.13 package_executable.py all
if %ERRORLEVEL% NEQ 0 (
    echo [-] PyInstaller build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo [+] Build successful! Executables are located in:
echo     1. dist\CollabBoardX-Server.exe (Central Dedicated Server)
echo     2. dist\CollabBoardX-Client.exe (Native Desktop GUI Client)
echo ======================================================================
pause
