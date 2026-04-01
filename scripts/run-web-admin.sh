#!/bin/bash
# ============================================================
# GroceryApp Web Admin — Local Development Runner
# Starts both the FastAPI backend and Vite dev server
#
# Usage:  bash scripts/run-web-admin.sh
# Stop:   Ctrl+C (kills both processes)
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEBADMIN_DIR="$BACKEND_DIR/web-admin"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}GroceryApp Web Admin — Local Dev${NC}"
echo "================================================"

# ---------- Resolve Python ----------
# If venv already exists, use its python directly (most reliable).
# Otherwise, search for a system Python to create the venv.
VENV_PYTHON="$BACKEND_DIR/venv/Scripts/python.exe"

if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${YELLOW}No venv found. Creating one...${NC}"
    echo ""
    echo -e "${RED}  The venv must be created manually (Git Bash Python detection is unreliable).${NC}"
    echo ""
    echo "  Run one of these in CMD or PowerShell, then re-run this script:"
    echo ""
    echo "    cd $(cygpath -w "$BACKEND_DIR")"
    echo "    python -m venv venv"
    echo "    venv\\Scripts\\pip install -r requirements.txt"
    echo ""
    exit 1
fi

echo -e "  Python: ${CYAN}$("$VENV_PYTHON" --version 2>&1)${NC}"

# ---------- Pre-flight checks ----------

# Check backend .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        echo -e "${YELLOW}backend/.env not found. Creating from .env.example...${NC}"
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        echo -e "${RED}  Edit backend/.env and set FIREBASE_CREDENTIALS_PATH${NC}"
    fi
fi

# Check web-admin .env
if [ ! -f "$WEBADMIN_DIR/.env" ]; then
    if [ -f "$WEBADMIN_DIR/.env.example" ]; then
        echo -e "${YELLOW}web-admin/.env not found. Creating from .env.example...${NC}"
        cp "$WEBADMIN_DIR/.env.example" "$WEBADMIN_DIR/.env"
        echo -e "${RED}  Edit web-admin/.env and set VITE_FIREBASE_* values${NC}"
    fi
fi

# Check node_modules
if [ ! -d "$WEBADMIN_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing web-admin npm packages...${NC}"
    cd "$WEBADMIN_DIR"
    npm install
fi

# ---------- Start services ----------

# On Windows/Git Bash, `kill` only kills the shell wrapper, not the actual
# python.exe/node.exe child. Use taskkill /T to kill the entire process tree,
# then fall back to kill + port-based cleanup as a safety net.
kill_tree() {
    local pid=$1
    if [ -n "$pid" ]; then
        taskkill //F //T //PID "$pid" 2>/dev/null
        kill "$pid" 2>/dev/null
    fi
}

kill_port() {
    local port=$1
    local pid
    pid=$(netstat -ano 2>/dev/null | grep ":${port} " | grep LISTENING | awk '{print $5}' | head -1)
    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
        taskkill //F //PID "$pid" 2>/dev/null
    fi
}

cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    kill_tree $BACKEND_PID
    kill_tree $VITE_PID
    sleep 1
    # Safety net: kill anything still holding the ports
    kill_port 8000
    kill_port 5173
    echo -e "${GREEN}Done.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start FastAPI backend (use venv python directly — no activate needed)
echo -e "${GREEN}Starting FastAPI backend on :8000...${NC}"
cd "$BACKEND_DIR"
"$VENV_PYTHON" main.py &
BACKEND_PID=$!

# Wait for backend
echo -n "  Waiting for backend..."
for i in $(seq 1 20); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e " ${GREEN}ready${NC}"
        break
    fi
    [ "$i" -eq 20 ] && echo -e " ${YELLOW}timeout (continuing)${NC}"
    sleep 1
done

# Start Vite dev server
echo -e "${GREEN}Starting Vite dev server on :5173...${NC}"
cd "$WEBADMIN_DIR"
npx vite --host &
VITE_PID=$!

sleep 2

echo ""
echo "================================================"
echo -e "${GREEN}Both services running:${NC}"
echo -e "   Backend API:  ${CYAN}http://localhost:8000${NC}"
echo -e "   Swagger docs: ${CYAN}http://localhost:8000/docs${NC}"
echo -e "   Web Admin:    ${CYAN}http://localhost:5173${NC}  <- open this"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"
echo "================================================"

wait $BACKEND_PID $VITE_PID
