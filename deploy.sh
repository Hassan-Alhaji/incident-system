#!/bin/bash
# ============================================================
# SAFE DEPLOY SCRIPT - incident-system
# يرفع الـ Frontend فقط - يحافظ على قاعدة البيانات والـ Backend
# استخدام: bash deploy.sh
# ============================================================

set -e  # Stop on any error

SERVER="ubuntu@10.39.1.140"
KEY="$HOME/.ssh/hse-incident-uat.key"
REMOTE_DIST="/var/www/incident-system/frontend/dist"
LOCAL_DIST="./frontend/dist"

echo "🔍 Step 1: Checking SSH connection..."
ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$SERVER" "echo '✅ Connected'" || {
    echo "❌ Cannot connect to server. Is VPN on?"
    exit 1
}

echo ""
echo "🔨 Step 2: Building frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "📦 Step 3: Backing up current dist on server..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" \
    "sudo cp -r $REMOTE_DIST ${REMOTE_DIST}_backup_\$(date +%Y%m%d_%H%M) && echo '✅ Backup created'"

echo ""
echo "📤 Step 4: Uploading new dist..."
scp -r -i "$KEY" -o StrictHostKeyChecking=no "$LOCAL_DIST" "$SERVER:/tmp/new_dist"

echo ""
echo "🔄 Step 5: Updating dist on server (zero-downtime chunk sync)..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" "
    sudo mkdir -p $REMOTE_DIST
    # Copy new files over existing dist so active browser sessions with older chunks don't break
    sudo cp -r /tmp/new_dist/* $REMOTE_DIST/
    sudo rm -rf /tmp/new_dist
    sudo chown -R dev:dev $REMOTE_DIST
    sudo chmod -R 755 $REMOTE_DIST
    sudo nginx -s reload
    echo '✅ Deploy complete!'
"

echo ""
echo "🌐 Live at: https://hsedev.saudimotorsport.com"
echo "✅ Done!"
