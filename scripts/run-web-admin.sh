#!/bin/bash
# ============================================================
# GroceryApp Web Admin — Local Development Runner
# Starts both the FastAPI backend and Vite dev server
#
# Usage:  bash scripts/run-web-admin.sh
# Stop:   Ctrl+C (kills both processes)
# ============================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEBADMIN_DIR="$BACKEND_DIR/web-admin"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🛒 GroceryApp Web Admin — Local Dev${NC}"
echo "================================================"

# ---------- Pre-flight checks ----------

# Check backend .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}⚠ backend/.env not found. Creating from .env.example...${NC}"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo -e "${RED}  → Edit backend/.env and set FIREBASE_CREDENTIALS_PATH to your service account JSON${NC}"
    echo "  → Download from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key"
    echo ""
fi

# Check web-admin .env
if [ ! -f "$WEBADMIN_DIR/.env" ]; then
    echo -e "${YELLOW}⚠ web-admin/.env not found. Creating from .env.example...${NC}"
    cp "$WEBADMIN_DIR/.env.example" "$WEBADMIN_DIR/.env"
    echo -e "${RED}  → Edit web-admin/.env and set VITE_FIREBASE_* values${NC}"
    echo ""
fi

# Check Python venv
if [ ! -d "$BACKEND_DIR/venv" ] && [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${YELLOW}Setting up Python venv...${NC}"
    cd "$BACKEND_DIR"
    python -m venv venv
    source venv/Scripts/activate 2>/dev/null || source venv/bin/activate
    pip install -r requirements.txt
else
    # Activate existing venv
    if [ -d "$BACKEND_DIR/venv" ]; then
        source "$BACKEND_DIR/venv/Scripts/activate" 2>/dev/null || source "$BACKEND_DIR/venv/bin/activate"
    else
        source "$BACKEND_DIR/.venv/Scripts/activate" 2>/dev/null || source "$BACKEND_DIR/.venv/bin/activate"
    fi
fi

# Check node_modules
if [ ! -d "$WEBADMIN_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing web-admin npm packages...${NC}"
    cd "$WEBADMIN_DIR"
    npm install
fi

# ---------- Start services ----------

# Trap Ctrl+C to kill both processes
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $VITE_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start FastAPI backend
echo -e "${GREEN}Starting FastAPI backend on :8000...${NC}"
cd "$BACKEND_DIR"
python main.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start Vite dev server
echo -e "${GREEN}Starting Vite dev server on :5173...${NC}"
cd "$WEBADMIN_DIR"
npx vite --host &
VITE_PID=$!

echo ""
echo "================================================"
echo -e "${GREEN}✅ Both services running:${NC}"
echo -e "   Backend API:  ${GREEN}http://localhost:8000${NC}"
echo -e "   Web Admin:    ${GREEN}http://localhost:5173${NC}  ← open this"
echo -e "   Health check: http://localhost:8000/health"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"
echo "================================================"

# Wait for either process to exit
wait $BACKEND_PID $VITE_PID
