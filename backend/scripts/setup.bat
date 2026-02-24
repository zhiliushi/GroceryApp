@echo off
REM GroceryApp Backend — Local Development Setup (Windows)

echo === GroceryApp Backend Setup ===
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not on PATH.
    echo Download from https://www.python.org/downloads/
    exit /b 1
)

REM Create virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
) else (
    echo Virtual environment already exists.
)

REM Activate and install
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

REM Create .env if missing
if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo [ACTION REQUIRED] Edit .env with your Firebase credentials:
    echo   1. Set FIREBASE_CREDENTIALS_PATH to your serviceAccountKey.json path
    echo   2. Set FIREBASE_DATABASE_URL to your Firestore URL
    echo.
) else (
    echo .env already exists.
)

REM Check for Firebase credentials
if not exist "serviceAccountKey.json" (
    echo [WARNING] No serviceAccountKey.json found.
    echo   Download from Firebase Console ^> Project Settings ^> Service Accounts
    echo   Save as serviceAccountKey.json in this directory.
    echo.
)

echo.
echo === Setup Complete ===
echo.
echo To start the server:
echo   venv\Scripts\activate
echo   python main.py
echo.
echo Server will run at http://localhost:8000
echo API docs at http://localhost:8000/docs
