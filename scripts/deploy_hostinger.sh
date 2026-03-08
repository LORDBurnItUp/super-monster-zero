#!/usr/bin/env bash
# ============================================================
# HOSTINGER DEPLOY SCRIPT — Super Monster Zero
# Run this from YOUR LOCAL MACHINE (Windows: use Git Bash/WSL)
#
# Usage:  chmod +x deploy_hostinger.sh && ./deploy_hostinger.sh
# ============================================================

set -euo pipefail
G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

HOST="46.202.197.97"
PORT="65002"
USER="u142089309"
PASS="3Strada666!"
REMOTE_DIR="/home/u142089309/super-monster-zero"
GITHUB_REPO="https://github.com/LORDBurnItUp/super-monster-zero.git"

echo -e "${BOLD}${C}  Deploying Super Monster Zero → Hostinger${NC}"

# ── Require sshpass ──────────────────────────────────────────
if ! command -v sshpass &>/dev/null; then
  echo -e "${Y}Install sshpass first:${NC}"
  echo "  macOS:  brew install hudochenkov/sshpass/sshpass"
  echo "  Ubuntu: sudo apt install sshpass"
  echo "  Windows: use WSL2"
  exit 1
fi

SSH="sshpass -p '$PASS' ssh -o StrictHostKeyChecking=no -p $PORT $USER@$HOST"
SCP="sshpass -p '$PASS' scp -o StrictHostKeyChecking=no -P $PORT"

echo -e "${C}→${NC} Connecting to $HOST:$PORT..."

# ── Full remote deploy ────────────────────────────────────────
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -p "$PORT" "$USER@$HOST" << 'REMOTE'
set -e
echo "→ Connected to Hostinger server"

# Install Node.js 20 if not present
if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs -qq
fi

echo "→ Node: $(node --version) | npm: $(npm --version)"

# Install PM2 globally
npm install -g pm2 --quiet 2>/dev/null || true
echo "→ PM2: $(pm2 --version)"

# Clone or pull repo
if [ -d ~/super-monster-zero/.git ]; then
  echo "→ Pulling latest from GitHub..."
  cd ~/super-monster-zero && git pull origin main
else
  echo "→ Cloning from GitHub..."
  cd ~ && git clone https://github.com/LORDBurnItUp/super-monster-zero.git
fi

cd ~/super-monster-zero

# Install production deps
echo "→ Installing npm dependencies..."
npm ci --omit=dev --quiet

# Create logs directory
mkdir -p logs

# Write .env if not present (will be overwritten below)
if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ Created .env from template"
fi

# Start or reload with PM2
if pm2 list 2>/dev/null | grep -q 'super-monster-zero'; then
  echo "→ Reloading PM2 (zero downtime)..."
  pm2 reload ecosystem.config.js --env production
else
  echo "→ Starting PM2..."
  pm2 start ecosystem.config.js --env production
fi

pm2 save
pm2 startup 2>/dev/null | tail -1 || true

echo "→ Deploy complete!"
pm2 status super-monster-zero
REMOTE

# ── Upload .env securely ──────────────────────────────────────
echo -e "${C}→${NC} Uploading .env securely..."
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -P "$PORT" \
  .env "$USER@$HOST:$REMOTE_DIR/.env"

# ── Reload after .env upload ──────────────────────────────────
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -p "$PORT" "$USER@$HOST" \
  "cd $REMOTE_DIR && pm2 reload ecosystem.config.js --env production && pm2 save"

echo ""
echo -e "${G}${BOLD}══════════════════════════════════════${NC}"
echo -e "${G}${BOLD}  DEPLOYED TO HOSTINGER               ${NC}"
echo -e "${G}${BOLD}══════════════════════════════════════${NC}"
echo ""
echo -e "  URL:   ${C}http://$HOST:3000${NC}"
echo -e "  Logs:  ssh -p $PORT $USER@$HOST 'pm2 logs super-monster-zero'"
echo -e "  Status: ssh -p $PORT $USER@$HOST 'pm2 status'"
echo ""
echo -e "${Y}Next: Point your domain to $HOST in Hostinger hPanel → DNS${NC}"
