#!/usr/bin/env bash
# GroceryApp Backend — Local Development Setup (macOS/Linux)

set -e

echo "=== GroceryApp Backend Setup ==="
echo

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed."
    echo "Install via: brew install python3  (macOS)"
    echo "             sudo apt install python3 python3-venv  (Ubuntu)"
    exit 1
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists."
fi

# Activate and install
echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo
    echo "[ACTION REQUIRED] Edit .env with your Firebase credentials:"
    echo "  1. Set FIREBASE_CREDENTIALS_PATH to your serviceAccountKey.json path"
    echo "  2. Set FIREBASE_DATABASE_URL to your Firestore URL"
    echo
else
    echo ".env already exists."
fi

# Check for Firebase credentials
if [ ! -f "serviceAccountKey.json" ]; then
    echo "[WARNING] No serviceAccountKey.json found."
    echo "  Download from Firebase Console > Project Settings > Service Accounts"
    echo "  Save as serviceAccountKey.json in this directory."
    echo
fi

echo
echo "=== Setup Complete ==="
echo
echo "To start the server:"
echo "  source venv/bin/activate"
echo "  python main.py"
echo
echo "Server will run at http://localhost:8000"
echo "API docs at http://localhost:8000/docs"
