#!/bin/bash
set -euo pipefail

# ============================================================
# Crewdeck — Quick Pi Update
# Build, rsync, restart. No DB/systemd setup.
# ============================================================

PI_HOST="pi@homepi.local"
PI_DIR="/opt/crewdeck"
SERVICE_NAME="crewdeck"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
info()  { echo -e "${GREEN}[update]${NC} $*"; }
warn()  { echo -e "${YELLOW}[update]${NC} $*"; }

# ----------------------------------------------------------
# 1. Build locally
# ----------------------------------------------------------
info "Building project..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile
pnpm build

# ----------------------------------------------------------
# 2. Rsync built files to Pi
# ----------------------------------------------------------
info "Syncing to Pi..."
rsync -az --delete \
  --include='package.json' \
  --include='pnpm-workspace.yaml' \
  --include='pnpm-lock.yaml' \
  --include='.npmrc' \
  --include='server/' --include='server/dist/***' \
  --include='server/package.json' \
  --include='server/skills/***' \
  --include='ui/' --include='ui/dist/***' \
  --include='ui/package.json' \
  --include='packages/' \
  --include='packages/*/' \
  --include='packages/*/dist/***' \
  --include='packages/*/package.json' \
  --include='packages/adapters/' \
  --include='packages/adapters/*/' \
  --include='packages/adapters/*/dist/***' \
  --include='packages/adapters/*/package.json' \
  --include='cli/' \
  --include='cli/package.json' \
  --exclude='*' \
  "$PROJECT_DIR/" "$PI_HOST:$PI_DIR/"

if [ -d "$PROJECT_DIR/server/ui-dist" ]; then
  rsync -az "$PROJECT_DIR/server/ui-dist/" "$PI_HOST:$PI_DIR/server/ui-dist/"
fi

# ----------------------------------------------------------
# 3. Install deps if lockfile changed
# ----------------------------------------------------------
info "Installing production dependencies..."
ssh "$PI_HOST" "cd $PI_DIR && pnpm install --prod --frozen-lockfile"

# ----------------------------------------------------------
# 4. Run migrations
# ----------------------------------------------------------
info "Running migrations..."
ssh "$PI_HOST" "cd $PI_DIR && set -a && source .env && set +a && pnpm --filter @crewdeck/db migrate" || {
  warn "Migration skipped or failed — check manually if needed."
}

# ----------------------------------------------------------
# 5. Restart service
# ----------------------------------------------------------
info "Restarting $SERVICE_NAME..."
ssh "$PI_HOST" "sudo systemctl restart $SERVICE_NAME"

sleep 2
ssh "$PI_HOST" "sudo systemctl status $SERVICE_NAME --no-pager" || true

info "Update complete!"
