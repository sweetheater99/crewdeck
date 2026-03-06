#!/bin/bash
set -euo pipefail

# ============================================================
# Crewdeck — Full Pi 5 Deployment
# Idempotent: safe to run multiple times.
# Builds locally on Mac, deploys to Pi via rsync + SSH.
# ============================================================

PI_HOST="pi@homepi.local"
PI_DIR="/opt/crewdeck"
DB_NAME="crewdeck"
PORT=3100
SERVICE_NAME="crewdeck"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ----------------------------------------------------------
# 1. Build locally
# ----------------------------------------------------------
info "Building project locally..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile
pnpm build

# ----------------------------------------------------------
# 2. Ensure Pi directory exists
# ----------------------------------------------------------
info "Creating $PI_DIR on Pi (if needed)..."
ssh "$PI_HOST" "sudo mkdir -p $PI_DIR && sudo chown pi:pi $PI_DIR"

# ----------------------------------------------------------
# 3. Rsync built project to Pi
# ----------------------------------------------------------
info "Syncing files to Pi..."
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
  --include='packages/*/src/***' \
  --include='packages/*/package.json' \
  --include='packages/*/tsconfig.json' \
  --include='packages/adapters/' \
  --include='packages/adapters/*/' \
  --include='packages/adapters/*/dist/***' \
  --include='packages/adapters/*/src/***' \
  --include='packages/adapters/*/package.json' \
  --include='cli/' \
  --include='cli/package.json' \
  --exclude='*' \
  "$PROJECT_DIR/" "$PI_HOST:$PI_DIR/"

# Also sync server ui-dist if it exists (built UI served by server)
if [ -d "$PROJECT_DIR/server/ui-dist" ]; then
  rsync -az "$PROJECT_DIR/server/ui-dist/" "$PI_HOST:$PI_DIR/server/ui-dist/"
fi

# ----------------------------------------------------------
# 4. Install dependencies on Pi
# ----------------------------------------------------------
info "Installing production dependencies on Pi..."
ssh "$PI_HOST" "sudo corepack enable && corepack prepare pnpm@9 --activate 2>/dev/null || sudo npm install -g pnpm@9"
ssh "$PI_HOST" "cd $PI_DIR && pnpm install --prod --frozen-lockfile"

# ----------------------------------------------------------
# 5. Set up PostgreSQL database
# ----------------------------------------------------------
info "Setting up PostgreSQL database (if needed)..."
ssh "$PI_HOST" <<DBEOF
  if command -v psql &>/dev/null; then
    if ! psql -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
      createdb "$DB_NAME"
      echo "Database '$DB_NAME' created."
    else
      echo "Database '$DB_NAME' already exists."
    fi
  else
    echo "WARNING: psql not found. Install PostgreSQL on Pi or point DATABASE_URL to an external DB."
  fi
DBEOF

# ----------------------------------------------------------
# 6. Create .env if it doesn't exist
# ----------------------------------------------------------
info "Ensuring .env exists on Pi..."
ssh "$PI_HOST" <<ENVEOF
  if [ ! -f "$PI_DIR/.env" ]; then
    cat > "$PI_DIR/.env" <<'ENV'
NODE_ENV=production
PORT=$PORT
DATABASE_URL=postgresql://pi@localhost:5432/$DB_NAME
# CREWDECK_AUTH_SECRET=         # generate with: openssl rand -hex 32
# CREWDECK_BASE_URL=http://homepi.local:$PORT
ENV
    echo ".env created at $PI_DIR/.env — edit it with your actual values."
  else
    echo ".env already exists, skipping."
  fi
ENVEOF

# ----------------------------------------------------------
# 7. Run database migrations
# ----------------------------------------------------------
info "Running database migrations on Pi..."
ssh "$PI_HOST" "cd $PI_DIR && set -a && source .env && set +a && pnpm --filter @crewdeck/db migrate" || {
  warn "Migration failed or no migrations to run. You may need to run manually."
}

# ----------------------------------------------------------
# 8. Create systemd service
# ----------------------------------------------------------
info "Setting up systemd service..."
ssh "$PI_HOST" "sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null" <<SVCEOF
[Unit]
Description=Crewdeck Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=$PI_DIR/server
EnvironmentFile=$PI_DIR/.env
ExecStart=/usr/bin/env node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$PI_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

ssh "$PI_HOST" "sudo systemctl daemon-reload && sudo systemctl enable $SERVICE_NAME"

# ----------------------------------------------------------
# 9. Start / restart service
# ----------------------------------------------------------
info "Starting $SERVICE_NAME service..."
ssh "$PI_HOST" "sudo systemctl restart $SERVICE_NAME"

# Give it a moment, then check status
sleep 2
ssh "$PI_HOST" "sudo systemctl status $SERVICE_NAME --no-pager" || true

# ----------------------------------------------------------
# 10. Done
# ----------------------------------------------------------
echo ""
info "Deployment complete!"
info "  Service:  sudo systemctl status $SERVICE_NAME"
info "  Logs:     journalctl -u $SERVICE_NAME -f"
info "  URL:      http://homepi.local:$PORT"
echo ""
warn "Reminders:"
warn "  - Edit $PI_DIR/.env on Pi with correct DATABASE_URL and secrets"
warn "  - Run 'claude login' on Pi if Claude OAuth is needed"
