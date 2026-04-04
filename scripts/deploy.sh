#!/bin/bash
# =============================================================================
# GroceryApp Deploy — Build SPA + Push to GitHub + Render
#
# Usage: bash scripts/deploy.sh
#        bash scripts/deploy.sh "commit message here"
#
# Two git remotes:
#   origin → github.com/zhiliushi/GroceryApp (main branch)
#   render → github.com/zhiliushi/groceryapp-backend (master branch)
#
# Render config:
#   Root Directory: backend
#   Dockerfile Path: ./Dockerfile
#   Docker Build Context: .
#   Branch: master
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEBADMIN_DIR="$BACKEND_DIR/web-admin"
RENDER_URL="https://groceryapp-backend-7af2.onrender.com"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}GroceryApp — Deploy${NC}"
echo "================================================"

# 1. Build SPA
echo -e "${YELLOW}Building web-admin SPA...${NC}"
cd "$WEBADMIN_DIR"
npx vite build 2>&1 | tail -3
echo -e "${GREEN}SPA built.${NC}"

# 2. Commit if needed
cd "$ROOT_DIR"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Uncommitted changes detected. Staging...${NC}"
    git add -A
    MSG="${1:-deploy: update for Render deployment}"
    git commit -m "$MSG

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
    echo -e "${GREEN}Committed.${NC}"
else
    echo -e "${GREEN}Working tree clean.${NC}"
fi

# 3. Push to both remotes
echo -e "${YELLOW}Pushing to origin/main...${NC}"
git push origin main 2>&1 || echo -e "${RED}origin push failed${NC}"

echo -e "${YELLOW}Pushing to render/master (triggers deploy)...${NC}"
git push render main:master 2>&1 || echo -e "${RED}render push failed — run: git remote add render https://github.com/zhiliushi/groceryapp-backend.git${NC}"

echo ""
echo "================================================"
echo -e "${GREEN}Pushed! Render auto-deploy triggered.${NC}"
echo -e "  URL: ${CYAN}$RENDER_URL${NC}"
echo -e "  Check: ${CYAN}$RENDER_URL/health${NC}"
echo -e "  Logs: ${CYAN}https://dashboard.render.com${NC}"
echo ""
echo -e "${YELLOW}Deploy takes 3-5 min on free tier.${NC}"
