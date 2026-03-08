#!/usr/bin/env bash
# ============================================================
# CREATE GITHUB REPO + PUSH — Super Monster Zero
# Run this ONCE to create the GitHub repo and push the code
#
# Usage:
#   chmod +x scripts/create_github_repo.sh
#   GITHUB_TOKEN=your_token_here ./scripts/create_github_repo.sh
#
# Or: export GITHUB_TOKEN=your_token && ./scripts/create_github_repo.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✓${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
log() { echo -e "${CYAN}→${NC} $*"; }

# ── Require token ─────────────────────────────────────────────────────────────
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo ""
  echo -e "${BOLD}${YELLOW}GITHUB_TOKEN is not set.${NC}"
  echo ""
  echo "  1. Go to: https://github.com/settings/tokens/new"
  echo "  2. Name: super-monster-zero-deploy"
  echo "  3. Scopes: check 'repo' (full repo access)"
  echo "  4. Click 'Generate token'"
  echo "  5. Run:  GITHUB_TOKEN=<your-token> ./scripts/create_github_repo.sh"
  echo ""
  exit 1
fi

# ── Config ────────────────────────────────────────────────────────────────────
REPO_NAME="${REPO_NAME:-super-monster-zero}"
GITHUB_USERNAME=$(curl -sf -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | python3 -c "import json,sys; print(json.load(sys.stdin)['login'])" 2>/dev/null || true)

if [[ -z "$GITHUB_USERNAME" ]]; then
  err "Could not fetch GitHub username — is your GITHUB_TOKEN valid?"
fi

REPO_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME"
API_BASE="https://api.github.com"

log "GitHub user: $GITHUB_USERNAME"
log "Repo: $REPO_URL"
echo ""

# ── Create repo on GitHub ─────────────────────────────────────────────────────
log "Creating GitHub repository '$REPO_NAME'..."

HTTP_RESP=$(curl -sf -X POST "$API_BASE/user/repos" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d "{
    \"name\": \"$REPO_NAME\",
    \"description\": \"Supreme Commander AI — agent-zero fused with openclaw, oh-my-opencode, ottomator-agents, pydantic-ai, LiveKit. Node.js + Hostinger deployment.\",
    \"private\": false,
    \"has_issues\": true,
    \"has_wiki\": false,
    \"auto_init\": false,
    \"topics\": [\"ai-agent\", \"agent-zero\", \"mcp\", \"nodejs\", \"cyberpunk\"]
  }" 2>&1 || true)

if echo "$HTTP_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if 'html_url' in d else 1)" 2>/dev/null; then
  CLONE_URL=$(echo "$HTTP_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['clone_url'])")
  ok "Repository created: $REPO_URL"
elif echo "$HTTP_RESP" | grep -q "already exists"; then
  warn "Repository already exists — skipping creation"
  CLONE_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
  ok "Using existing repo: $REPO_URL"
else
  echo "$HTTP_RESP"
  err "Failed to create repository"
fi

# ── Init git & push ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

log "Initializing git repository..."

if [[ ! -d .git ]]; then
  git init
  git branch -M main
fi

# Write .gitignore
cat > .gitignore << 'GITEOF'
node_modules/
.env
logs/
*.log
.DS_Store
Thumbs.db
npm-debug.log*
.npm
.node_repl_history
.nyc_output
coverage/
dist/
build/
GITEOF

# Credential helper for push
git config credential.helper store
echo "https://$GITHUB_USERNAME:$GITHUB_TOKEN@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials

# Configure remote
if git remote get-url origin &>/dev/null 2>&1; then
  git remote set-url origin "$CLONE_URL"
else
  git remote add origin "$CLONE_URL"
fi

# Stage + commit
git add -A
git diff --cached --quiet || git commit -m "feat: initial Super Monster Zero — Node.js + Hostinger deployment

Supreme Commander AI fusing 6 elite agent repos:
- agent-zero: core runtime, memory, MCP, tools
- openclaw: GOTCHA framework, GOD MODE, Voxcode
- oh-my-opencode: Sisyphus orchestrator, LSP, AST-Grep
- ottomator-agents: 60+ specialist agents
- pydantic-ai: structured sub-agents
- livekit-agents: real-time voice intelligence

Node.js Express server with:
- Cyberpunk glassmorphism dashboard (index.html)
- Auth-protected agent proxy to Agent Zero backend
- WebSocket relay for real-time agent comms
- 15 MCP server army configuration
- PM2 cluster deployment (ecosystem.config.js)
- GitHub Actions CI/CD → Hostinger auto-deploy
- Rate limiting, compression, secure sessions"

log "Pushing to GitHub..."
git push -u origin main --force

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  SUPER MONSTER ZERO — PUSHED TO GITHUB  ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  Repo:     ${CYAN}$REPO_URL${NC}"
echo -e "  Clone:    ${CYAN}git clone $CLONE_URL${NC}"
echo ""
echo -e "${BOLD}  Next: Set GitHub Secrets for auto-deploy:${NC}"
echo ""
echo "  Go to: $REPO_URL/settings/secrets/actions"
echo ""
echo "  Add these secrets:"
echo "    HOSTINGER_SSH_KEY   → your SSH private key"
echo "    HOSTINGER_HOST      → srv123456789.hstgr.cloud"
echo "    HOSTINGER_USER      → u123456789"
echo "    HOSTINGER_URL       → https://yourdomain.com"
echo "    HOSTINGER_DOMAIN    → yourdomain.com"
echo ""
echo "  Then push any commit to main → auto-deploys to Hostinger!"
echo ""
