#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║         HSE Incident System — Smart Deploy Script           ║
# ║  Deploys to OCI + runs QA Agent + Rollback on failure       ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Usage (from Windows, called via PowerShell after build):
#   This script runs ON the OCI server via SSH
#
# Called from PowerShell deploy commands as:
#   ssh -i $KEY dev@10.39.1.140 "bash /var/www/incident-system/deploy_server.sh"

set -e  # Exit immediately on error

APP_DIR="/var/www/incident-system"
BACKUP_DIR="/var/www/incident-system-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMMIT=$(cd "$APP_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()    { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success(){ echo -e "${GREEN}[✅ OK]${NC} $1"; }
warning(){ echo -e "${YELLOW}[⚠️  WARN]${NC} $1"; }
error()  { echo -e "${RED}[❌ FAIL]${NC} $1"; }

# ── Step 1: Create Backup ──────────────────────────────────────────────────────
log "Creating backup of current deployment (commit: $COMMIT)..."
mkdir -p "$BACKUP_DIR"

# Backup backend controllers and routes (fastest-changing code)
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
mkdir -p "$BACKUP_PATH"
cp -r "$APP_DIR/backend/controllers" "$BACKUP_PATH/" 2>/dev/null || true
cp -r "$APP_DIR/backend/routes"      "$BACKUP_PATH/" 2>/dev/null || true
cp -r "$APP_DIR/frontend/dist"       "$BACKUP_PATH/" 2>/dev/null || true
echo "$COMMIT" > "$BACKUP_PATH/.commit"

# Keep only last 5 backups
ls -dt "$BACKUP_DIR"/backup_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
success "Backup created at $BACKUP_PATH"

# ── Step 2: Restart Backend ────────────────────────────────────────────────────
log "Restarting backend..."
pm2 restart incident-backend --update-env
sleep 3

# Quick health check before QA
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  success "Backend health check passed (HTTP $HTTP_STATUS)"
else
  error "Backend health check FAILED (HTTP $HTTP_STATUS)"
  error "Immediate rollback triggered!"
  bash "$APP_DIR/rollback_server.sh" "$BACKUP_PATH"
  exit 1
fi

# ── Step 3: Run QA Agent ───────────────────────────────────────────────────────
log "Running QA Agent..."
QA_ADMIN_TOKEN="${QA_ADMIN_TOKEN:-}"
QA_NOTIFY_EMAIL="${QA_NOTIFY_EMAIL:-}"
QA_BASE_URL="http://localhost:3000"
QA_FRONTEND_URL="https://hsedev.saudimotorsport.com"

# Run QA agent with timeout
set +e  # Don't exit on QA failure — we handle it below
timeout 120 node "$APP_DIR/qa_agent.js" \
  --url="$QA_BASE_URL" \
  --frontend="$QA_FRONTEND_URL"
QA_EXIT=$?
set -e

# ── Step 4: Handle QA Results ─────────────────────────────────────────────────
if [ $QA_EXIT -eq 0 ]; then
  success "QA PASSED — All checks green. Deployment complete! ✅"
  
elif [ $QA_EXIT -eq 2 ]; then
  warning "QA finished with non-critical warnings."
  warning "Deployment kept — but review the QA report in $APP_DIR/qa_reports/"
  log "Latest report:"
  ls -t "$APP_DIR/qa_reports/"*.json 2>/dev/null | head -1 | xargs cat | python3 -c "
import sys,json
r=json.load(sys.stdin)
print(f'  Status: {r[\"summary\"][\"status\"]}')
print(f'  Passed: {r[\"summary\"][\"passed\"]}')
print(f'  Failed: {r[\"summary\"][\"failed\"]}')
print(f'  Warnings: {r[\"summary\"][\"warnings\"]}')
for f in r.get('failures',[]):
    print(f'  ⚠️  {f[\"name\"]}: {f[\"detail\"]}')
" 2>/dev/null || true
  exit 0  # Keep deployment

elif [ $QA_EXIT -eq 1 ] || [ $QA_EXIT -eq 124 ]; then
  if [ $QA_EXIT -eq 124 ]; then
    error "QA Agent TIMED OUT after 120 seconds!"
  else
    error "QA FAILED — Critical failures detected!"
  fi
  error "Starting automatic ROLLBACK to previous version (commit: $COMMIT)..."

  # Restore from backup
  if [ -d "$BACKUP_PATH/controllers" ]; then
    cp -r "$BACKUP_PATH/controllers" "$APP_DIR/backend/"
    cp -r "$BACKUP_PATH/routes"      "$APP_DIR/backend/"
    success "Backend code restored"
  fi
  if [ -d "$BACKUP_PATH/dist" ]; then
    sudo rm -rf "$APP_DIR/frontend/dist"
    sudo cp -r  "$BACKUP_PATH/dist" "$APP_DIR/frontend/dist"
    sudo chown -R www-data:www-data "$APP_DIR/frontend/dist"
    success "Frontend dist restored"
  fi

  pm2 restart incident-backend --update-env
  sleep 2

  # Verify rollback
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    success "Rollback successful — previous version restored and running ✅"
    warning "Review QA report and fix issues before next deployment"
  else
    error "ROLLBACK ALSO FAILED — Manual intervention required!"
    error "Backend status: HTTP $HTTP_STATUS"
  fi
  exit 1
fi
