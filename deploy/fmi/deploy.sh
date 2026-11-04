#!/bin/bash
# FMI deploy / update. Run on the server from ~/crm-fmi-stack/deploy/fmi
set -e

echo "==> Pulling latest code (deploy/fmi)..."
git pull origin deploy/fmi

echo "==> Checking data disk..."
findmnt /mnt/disks/data
[ -d /mnt/disks/data/db/crm-fmi ] || { sudo mkdir -p /mnt/disks/data/db/crm-fmi && sudo chown -R 70:70 /mnt/disks/data/db/crm-fmi; }

echo "==> Building and starting (migrations run on backend start)..."
docker compose up -d --build

echo "==> Status..."
docker compose ps
docker compose logs --tail=30 backend

echo "==> Reloading shared nginx..."
cd ~/dok-stack
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload

echo "==> FMI deploy complete: https://fmi.crmstack.site"
