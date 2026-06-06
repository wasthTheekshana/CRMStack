# DOK CRM — Commercial Hosting Guide
### Hosted & Managed by DOK Technology Team

> **Model:** DOK hosts the CRM infrastructure. Clients access via browser. No installation on client side.
> **Platform:** Google Cloud Platform (GCP)
> **Database:** PostgreSQL 15 (Cloud SQL — Managed)
> **Deployment:** Docker containers on Compute Engine VM
> **Budget:** USD 150/month (≈ LKR 48,750/month)
> **Exchange Rate:** 1 USD = LKR 325 (approximate, March 2026)

---

## Table of Contents

1. [Hosting Model Overview](#1-hosting-model-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [GCP Hosting Options Compared](#3-gcp-hosting-options-compared)
4. [Recommended Setup — Stage 1 (Combined)](#4-recommended-setup--stage-1-combined)
5. [Server Specifications](#5-server-specifications)
6. [PostgreSQL Database on GCP](#6-postgresql-database-on-gcp)
7. [Docker Deployment Architecture](#7-docker-deployment-architecture)
8. [Multi-Tenant Client Management](#8-multi-tenant-client-management)
9. [Full Cost Breakdown — USD & LKR](#9-full-cost-breakdown--usd--lkr)
10. [How Many Clients Can We Host?](#10-how-many-clients-can-we-host)
11. [Backup Strategy](#11-backup-strategy)
12. [Security & Access Control](#12-security--access-control)
13. [Monitoring & Alerts](#13-monitoring--alerts)
14. [Client Onboarding Process](#14-client-onboarding-process)
15. [Scaling Plan — When to Upgrade](#15-scaling-plan--when-to-upgrade)

---

## 1. Hosting Model Overview

DOK CRM uses a **fully managed SaaS hosting model**. DOK Technology manages all infrastructure. Clients only need a browser and internet connection.

```
CLIENT (Browser)
     |
     | HTTPS
     ▼
GOOGLE CLOUD (DOK-managed)
  ├── Nginx (reverse proxy + SSL)
  ├── DOK CRM App (Docker container)
  ├── PostgreSQL (Cloud SQL managed DB)
  └── Cloud Storage (backups + uploads)
```

### What DOK Manages
- Server provisioning and maintenance
- Docker deployment and updates
- Database management and backups
- SSL certificates (auto-renewed)
- Security patches and monitoring
- Client subdomain setup

### What the Client Gets
- A unique URL: `clientname.dokcrm.com`
- Login credentials for their team
- Data fully isolated from other clients
- Browser-only access — no software installation

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNET                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS (443)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE CLOUD PLATFORM                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Compute Engine VM  (e2-standard-2)           │  │
│  │                                                      │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Docker Compose Stack                           │ │  │
│  │  │                                                 │ │  │
│  │  │  ┌───────────┐   ┌───────────┐                 │ │  │
│  │  │  │   Nginx   │──▶│  DOK CRM  │                 │ │  │
│  │  │  │  (Proxy)  │   │   App     │                 │ │  │
│  │  │  │  Port 80  │   │ Port 3000 │                 │ │  │
│  │  │  │  Port 443 │   └─────┬─────┘                 │ │  │
│  │  │  └───────────┘         │                       │ │  │
│  │  │                        │                       │ │  │
│  │  └────────────────────────┼───────────────────────┘ │  │
│  │                           │ Private VPC              │  │
│  │                           ▼                          │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Cloud SQL — PostgreSQL 15                   │   │  │
│  │  │  (Fully Managed — Private IP Only)           │   │  │
│  │  │  Schema per tenant:                          │   │  │
│  │  │   tenant_dokgroup | tenant_abc | tenant_xyz  │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Cloud Storage                               │   │  │
│  │  │  - Daily DB backups                          │   │  │
│  │  │  - File uploads (documents, attachments)     │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Static IP → Cloud DNS → dokcrm.com                        │
└─────────────────────────────────────────────────────────────┘
```

### DNS Routing (per client)

| Client Subdomain | Tenant DB Schema |
|-----------------|-----------------|
| `dokgroup.dokcrm.com` | `tenant_dokgroup` |
| `clientabc.dokcrm.com` | `tenant_abc` |
| `clientxyz.dokcrm.com` | `tenant_xyz` |

All subdomains point to the same server IP. Nginx routes to the correct tenant based on subdomain.

---

## 3. GCP Hosting Options Compared

| Option | Description | Cost | Best For | Recommendation |
|--------|-------------|------|----------|----------------|
| **Compute Engine + Docker** | VM with Docker Compose | ~$50–70/month | Full control, cost-effective | ✅ **Recommended** |
| **Cloud Run** | Serverless containers | Pay-per-request | Variable/low traffic | ⚠️ DB connection issues |
| **Google Kubernetes Engine (GKE)** | Container orchestration | ~$150–300/month | Large scale only | ❌ Too expensive |
| **App Engine** | Managed platform | Variable | Simple apps | ❌ Less control |
| **Cloud Run + Cloud SQL** | Serverless + managed DB | ~$30–80/month | Low traffic | ⚠️ Cold starts |

### Why Compute Engine + Docker?

- **Full control** over server config and Docker setup
- **Predictable cost** — fixed monthly VM price
- **PostgreSQL via Cloud SQL** — fully managed, automatic backups
- **Easy to scale** — upgrade VM size as clients grow
- **Docker Compose** — simple multi-container management
- **No vendor lock-in** — Docker runs anywhere

---

## 4. Recommended Setup — Stage 1 (Combined)

> Stage 1 and Stage 2 are combined into a single initial deployment. This setup handles internal DOK Group companies AND initial commercial clients on one server.

### Infrastructure Summary

| Component | GCP Service | Specification |
|-----------|-------------|---------------|
| Application Server | Compute Engine | e2-standard-2 (2 vCPU, 8 GB RAM) |
| Database | Cloud SQL | PostgreSQL 15, db-custom-2-7680 (2 vCPU, 7.5 GB) |
| Storage | Cloud Storage | Standard, 50 GB |
| Networking | VPC + Static IP | Private VPC, 1 static external IP |
| DNS | Cloud DNS | dokcrm.com managed zone |
| SSL | Let's Encrypt (Certbot) | Auto-renewed, wildcard `*.dokcrm.com` |
| CDN | Cloud CDN (optional) | Static asset caching |
| Monitoring | Cloud Monitoring | Free tier |

### Region Selection

| Region | Location | Monthly Price Index | Latency (Sri Lanka) | Recommendation |
|--------|----------|--------------------|--------------------|----------------|
| `asia-south1` | Mumbai, India | Medium | ~50ms | ✅ Best for SL/South Asia |
| `asia-southeast1` | Singapore | Medium | ~80ms | ✅ Good alternative |
| `us-central1` | Iowa, USA | Lowest | ~200ms | ❌ Too far for SL clients |
| `europe-west1` | Belgium | Low | ~180ms | ❌ Too far for SL clients |

> **Recommendation:** Use `asia-south1` (Mumbai) for lowest latency to Sri Lanka and South Asia clients.

---

## 5. Server Specifications

### Application Server — Compute Engine VM

| Specification | Value | Notes |
|--------------|-------|-------|
| **Machine Type** | e2-standard-2 | Cost-optimized, good performance |
| **vCPU** | 2 cores | Handles 5–25 concurrent users |
| **RAM** | 8 GB | Docker containers + OS |
| **Boot Disk** | 50 GB SSD (pd-balanced) | OS + Docker images + logs |
| **OS** | Ubuntu 22.04 LTS | Long-term support until 2027 |
| **Region** | asia-south1 (Mumbai) | Low latency to Sri Lanka |
| **Network** | Standard Tier | Cost-effective |

**What runs on this VM:**
```
Ubuntu 22.04
├── Docker Engine 24+
├── Docker Compose 2+
└── Containers:
    ├── Nginx (reverse proxy, SSL terminator)
    ├── DOK CRM App (Node.js/React)
    ├── Certbot (SSL certificate management)
    └── Redis (session caching — optional)
```

### When to Upgrade VM

| Concurrent Users | Recommended Machine | vCPU | RAM | Monthly Cost |
|-----------------|--------------------|----|-----|-------------|
| 5–25 users | e2-standard-2 | 2 | 8 GB | ~$49 |
| 25–60 users | e2-standard-4 | 4 | 16 GB | ~$98 |
| 60–150 users | e2-standard-8 | 8 | 32 GB | ~$195 |

---

## 6. PostgreSQL Database on GCP

### Cloud SQL — PostgreSQL 15

**Why Cloud SQL instead of self-hosted PostgreSQL on VM:**

| Feature | Cloud SQL (Managed) | Self-hosted on VM |
|---------|--------------------|--------------------|
| Automatic backups | ✅ Yes | ❌ Manual setup |
| High availability failover | ✅ Yes | ❌ Complex setup |
| Point-in-time recovery | ✅ Yes (7 days) | ❌ Manual |
| Security patches | ✅ Automatic | ❌ Manual |
| Monitoring | ✅ Built-in | ❌ Manual |
| Cost | ~$46–92/month | Free (but adds VM load) |

### Recommended Cloud SQL Tier

| Tier | vCPU | RAM | Storage | Cost/month | For |
|------|------|-----|---------|------------|-----|
| `db-f1-micro` | Shared | 0.6 GB | 10 GB | ~$7 | Dev/Testing only |
| `db-g1-small` | Shared | 1.7 GB | 20 GB | ~$25 | Very small (1–5 clients) |
| **`db-custom-2-7680`** | **2** | **7.5 GB** | **50 GB SSD** | **~$92** | **✅ Recommended** |
| `db-custom-4-15360` | 4 | 15 GB | 100 GB SSD | ~$184 | 10+ clients / high traffic |

> **For $150/month budget:** Use `db-g1-small` (~$25) or `db-custom-1-3840` (~$46) to stay within budget. Upgrade to `db-custom-2-7680` when revenue grows beyond 5 clients.

### Multi-Tenant Database Design (Schema-per-Tenant)

```sql
-- One PostgreSQL instance, multiple schemas
-- Each client gets isolated schema

CREATE SCHEMA tenant_dokgroup;    -- DOK Group internal
CREATE SCHEMA tenant_clientabc;  -- Client ABC
CREATE SCHEMA tenant_clientxyz;  -- Client XYZ

-- Each schema has identical tables:
-- tenant_xxx.leads
-- tenant_xxx.users
-- tenant_xxx.sales_targets
-- tenant_xxx.settings
-- tenant_xxx.activities
```

**Benefits:**
- Complete data isolation between clients
- One DB instance = lower cost
- Easy to migrate one client if needed
- Schema can be exported/deleted per client

### Cloud SQL Configuration

```yaml
Database version:    POSTGRES_15
Instance type:       db-custom-1-3840
Region:              asia-south1
Storage:             50 GB SSD, auto-increase enabled
Backups:             Daily automatic, 7-day retention
High availability:   Disabled (enable at $185+/month when needed)
Private IP:          Yes (no public internet exposure)
SSL:                 Required for all connections
Maintenance window:  Sunday 2:00 AM (low traffic time)
```

---

## 7. Docker Deployment Architecture

### Docker Compose Stack

```yaml
# docker-compose.yml (on the GCP VM)

version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - app
    restart: always

  app:
    image: doktech/dok-crm:latest   # your Docker Hub image
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://dokcrm:PASSWORD@CLOUD_SQL_IP:5432/dokcrm
      - JWT_SECRET=your-secret-key
      - APP_DOMAIN=dokcrm.com
    restart: always

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: >
      sh -c "trap exit TERM;
             while :; do
               certbot renew;
               sleep 12h & wait $${!};
             done"
```

### Nginx Configuration (Multi-Tenant Subdomain Routing)

```nginx
# /nginx/conf.d/dokcrm.conf

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name *.dokcrm.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

# HTTPS - all subdomains → same app container
server {
    listen 443 ssl;
    server_name *.dokcrm.com;

    ssl_certificate     /etc/letsencrypt/live/dokcrm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dokcrm.com/privkey.pem;

    # Pass tenant ID from subdomain to app
    location / {
        proxy_pass         http://app:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Tenant-ID $subdomain;  # app reads this
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### Deployment Commands

```bash
# Initial setup on VM
git clone https://github.com/doktech/dok-crm-server
cd dok-crm-server
docker compose up -d

# Deploy new version (zero downtime)
docker compose pull app
docker compose up -d --no-deps app

# View logs
docker compose logs -f app

# Add a new client tenant
docker compose exec app node scripts/create-tenant.js --name "clientabc" --email "admin@clientabc.com"
```

---

## 8. Multi-Tenant Client Management

### How Clients are Onboarded

```
Step 1: DOK adds DNS record
        clientabc.dokcrm.com → server IP

Step 2: DOK runs tenant creation script
        Creates schema: tenant_clientabc
        Creates admin user for client

Step 3: DOK sends credentials to client
        URL: https://clientabc.dokcrm.com
        Admin email + temp password

Step 4: Client logs in, changes password, adds team
```

### Tenant Isolation

Each tenant (client) has:
- Isolated PostgreSQL schema (no shared tables)
- Separate subdomain
- Their own admin account
- No visibility into other clients' data

DOK admin has:
- Access to all tenant schemas (for support)
- Server monitoring dashboard
- Ability to create/suspend/delete tenants

---

## 9. Full Cost Breakdown — USD & LKR

> Exchange rate: **1 USD = LKR 325** (March 2026, approximate)

### Monthly Infrastructure Cost (Target: USD 150/month)

#### Option A — Budget Setup (5–10 clients, up to 30 users)

| GCP Service | Specification | USD/month | LKR/month |
|-------------|--------------|-----------|-----------|
| Compute Engine VM | e2-standard-2, 2 vCPU, 8 GB, 50 GB SSD | $49.00 | LKR 15,925 |
| Cloud SQL PostgreSQL | db-g1-small, 1.7 GB RAM, 20 GB SSD | $25.00 | LKR 8,125 |
| Static External IP | 1 reserved IP address | $7.20 | LKR 2,340 |
| Cloud DNS | 1 managed zone + queries | $0.40 | LKR 130 |
| Cloud Storage | 50 GB (backups + files) | $1.00 | LKR 325 |
| Network Egress | ~50 GB outbound/month | $4.00 | LKR 1,300 |
| SSL Certificate | Let's Encrypt (free) | $0.00 | LKR 0 |
| Cloud Monitoring | Free tier | $0.00 | LKR 0 |
| **Subtotal Infrastructure** | | **$86.60** | **LKR 28,145** |
| **Buffer (contingency)** | Spikes, extra egress | **$13.40** | **LKR 4,355** |
| **Total Infrastructure** | | **~$100/month** | **~LKR 32,500** |
| **Remaining from $150 budget** | For support/ops | **$50** | **LKR 16,250** |

#### Option B — Standard Setup (10–25 clients, up to 80 users) ✅ Recommended

| GCP Service | Specification | USD/month | LKR/month |
|-------------|--------------|-----------|-----------|
| Compute Engine VM | e2-standard-2, 2 vCPU, 8 GB, 50 GB SSD | $49.00 | LKR 15,925 |
| Cloud SQL PostgreSQL | db-custom-1-3840, 1 vCPU, 3.75 GB, 50 GB SSD | $46.00 | LKR 14,950 |
| Static External IP | 1 reserved IP address | $7.20 | LKR 2,340 |
| Cloud DNS | 1 managed zone + queries | $0.40 | LKR 130 |
| Cloud Storage | 100 GB (backups + uploads) | $2.00 | LKR 650 |
| Network Egress | ~100 GB outbound/month | $8.00 | LKR 2,600 |
| SSL Certificate | Let's Encrypt wildcard | $0.00 | LKR 0 |
| Cloud Monitoring | Free tier | $0.00 | LKR 0 |
| Cloud Armor (basic DDoS) | Free tier | $0.00 | LKR 0 |
| **Subtotal Infrastructure** | | **$112.60** | **LKR 36,595** |
| **Buffer (contingency)** | | **$12.40** | **LKR 4,030** |
| **Total Infrastructure** | | **~$125/month** | **~LKR 40,625** |
| **Remaining from $150 budget** | For ops/support tools | **$25** | **LKR 8,125** |

#### Option C — Growth Setup (25+ clients, 80–150 users)

| GCP Service | Specification | USD/month | LKR/month |
|-------------|--------------|-----------|-----------|
| Compute Engine VM | e2-standard-4, 4 vCPU, 16 GB, 100 GB SSD | $97.00 | LKR 31,525 |
| Cloud SQL PostgreSQL | db-custom-2-7680, 2 vCPU, 7.5 GB, 100 GB SSD | $92.00 | LKR 29,900 |
| Static External IP | | $7.20 | LKR 2,340 |
| Cloud DNS | | $0.40 | LKR 130 |
| Cloud Storage | 200 GB | $4.00 | LKR 1,300 |
| Network Egress | ~200 GB | $14.00 | LKR 4,550 |
| Cloud Monitoring | | $0.00 | LKR 0 |
| **Total Infrastructure** | | **~$215/month** | **~LKR 69,875** |

> ℹ️ Option C exceeds $150/month. Revenue from 5+ clients at USD 99+/month comfortably covers this.

### Annual Cost Summary

| Setup | Monthly (USD) | Monthly (LKR) | Annual (USD) | Annual (LKR) |
|-------|--------------|---------------|-------------|--------------|
| Option A (Budget) | ~$100 | ~LKR 32,500 | ~$1,200 | ~LKR 390,000 |
| Option B (Standard) ✅ | ~$125 | ~LKR 40,625 | ~$1,500 | ~LKR 487,500 |
| Option C (Growth) | ~$215 | ~LKR 69,875 | ~$2,580 | ~LKR 838,500 |

### Break-Even Analysis

With DOK CRM Starter plan at USD 99/month per client:

| Clients | Monthly Revenue | Infrastructure Cost (B) | Gross Profit | LKR Profit |
|---------|----------------|------------------------|-------------|------------|
| 1 client | $99 | $125 | -$26 (loss) | -LKR 8,450 |
| 2 clients | $198 | $125 | **$73 profit** | **LKR 23,725** |
| 3 clients | $297 | $125 | $172 profit | LKR 55,900 |
| 5 clients | $495 | $125 | $370 profit | LKR 120,250 |
| 10 clients | $990 | $125 | $865 profit | LKR 281,125 |

> **Break-even: 2 clients** covers all infrastructure costs.

---

## 10. How Many Clients Can We Host?

On **Option B** (e2-standard-2, db-custom-1-3840):

| Metric | Capacity |
|--------|---------|
| Max clients (tenants) | 15–25 |
| Max concurrent users | 30–50 |
| Max total users (all clients) | 200–500 |
| Max leads per tenant | 100,000+ |
| Database storage limit | 50 GB (auto-increase) |
| Bandwidth | 100 GB/month egress |

**Performance limits:**
- If more than 30 users active simultaneously → upgrade to e2-standard-4
- If DB storage exceeds 40 GB → Cloud SQL auto-increases (extra cost ~$0.17/GB)
- If response time exceeds 2 seconds → add Redis caching container

---

## 11. Backup Strategy

### Automated Backups (Cloud SQL Built-in)

Cloud SQL automatically backs up the entire PostgreSQL instance:

```
Daily backups:          Retained for 7 days (included in Cloud SQL cost)
Point-in-time recovery: Last 7 days (logs retained)
Backup location:        asia-south1 (same region)
```

### Additional Backup to Cloud Storage

```bash
# Runs daily via cron on the VM (2:00 AM)
# /opt/dok-crm/scripts/backup.sh

#!/bin/bash
DATE=$(date +%Y-%m-%d)
BUCKET="gs://dok-crm-backups"

# Export all PostgreSQL schemas
pg_dump $DATABASE_URL | gzip > /tmp/dok-backup-$DATE.sql.gz

# Upload to Cloud Storage
gsutil cp /tmp/dok-backup-$DATE.sql.gz $BUCKET/daily/

# Delete local temp file
rm /tmp/dok-backup-$DATE.sql.gz

echo "Backup completed: $DATE"
```

**Add to VM crontab:**
```bash
0 2 * * * /opt/dok-crm/scripts/backup.sh >> /var/log/dok-backup.log 2>&1
```

### Backup Retention Policy

| Backup Type | Frequency | Retention | Storage Cost |
|-------------|-----------|-----------|-------------|
| Cloud SQL automatic | Daily | 7 days | Included |
| Custom SQL dump to GCS | Daily | 30 days | ~$0.50/month |
| Monthly archive | Monthly | 12 months | ~$0.50/month |
| **Total backup cost** | | | **~$1–2/month** |

### Restore Procedure

```bash
# Restore entire database from GCS backup
gsutil cp gs://dok-crm-backups/daily/dok-backup-2026-03-04.sql.gz /tmp/
gunzip /tmp/dok-backup-2026-03-04.sql.gz
psql $DATABASE_URL < /tmp/dok-backup-2026-03-04.sql

# Restore single tenant schema only
pg_restore --schema=tenant_clientabc -d $DATABASE_URL /tmp/dok-backup-2026-03-04.sql
```

---

## 12. Security & Access Control

### Network Security

```
Internet → Cloud Armor (DDoS protection, free basic)
         → Cloud Load Balancer (optional, $18/month)
         → Compute Engine VM
              - Port 80 (HTTP → redirect to HTTPS)
              - Port 443 (HTTPS only)
              - Port 22 (SSH — restricted to DOK office IP only)
         → Cloud SQL (Private IP only — not reachable from internet)
```

### Firewall Rules (GCP)

```
Allow inbound:
  - Port 443 (HTTPS) — all IPs
  - Port 80 (HTTP) — all IPs (redirect only)
  - Port 22 (SSH) — DOK office IP only (e.g., 203.xxx.xxx.xxx/32)

Deny all other inbound traffic
```

### Data Security

| Layer | Implementation |
|-------|---------------|
| Transit encryption | TLS 1.3 (HTTPS + Cloud SQL SSL) |
| At-rest encryption | GCP default AES-256 (free, automatic) |
| DB access | Private IP only, password auth + SSL |
| App authentication | JWT tokens, bcrypt password hashing |
| Tenant isolation | PostgreSQL schema-per-tenant |
| Admin SSH access | Key-based authentication only (no passwords) |

### Secret Management

Use GCP Secret Manager for sensitive credentials:
```bash
# Store secrets securely
gcloud secrets create db-password --data-file=- <<< "your-db-password"
gcloud secrets create jwt-secret --data-file=- <<< "your-jwt-secret"

# Access in app (Docker env via Secret Manager)
DATABASE_PASSWORD=$(gcloud secrets versions access latest --secret="db-password")
```

---

## 13. Monitoring & Alerts

### Free Monitoring (Cloud Monitoring)

GCP includes free monitoring for:
- CPU usage
- Memory usage
- Disk usage
- Network traffic
- Cloud SQL performance

### Recommended Alert Policies

| Alert | Threshold | Action |
|-------|-----------|--------|
| CPU > 80% for 5 min | Warning | Investigate / scale |
| Memory > 85% | Warning | Add swap or scale |
| Disk > 80% | Warning | Clean logs or expand |
| Cloud SQL disk > 70% | Warning | Enable auto-increase |
| App health check fails | Critical | Restart container |
| Backup failed | Critical | Run manual backup |

**Setup uptime monitoring (free):**
- Use **UptimeRobot** (free) → monitors `https://dokcrm.com` every 5 minutes
- Sends email/SMS alert if site goes down

### Log Management

```bash
# View app logs
docker compose logs -f app

# View Nginx access logs
docker compose logs -f nginx

# GCP Cloud Logging (automatic for Cloud SQL)
gcloud logging read "resource.type=cloudsql_database" --limit=50
```

---

## 14. Client Onboarding Process

### Steps to Add a New Client

**Step 1 — Create subdomain (5 minutes)**
```bash
# In Cloud DNS — add A record
# clientabc.dokcrm.com → VM static IP
gcloud dns record-sets create clientabc.dokcrm.com \
  --zone=dokcrm-zone \
  --type=A \
  --ttl=300 \
  --rrdatas=YOUR_STATIC_IP
```

**Step 2 — Create tenant in database (2 minutes)**
```bash
docker compose exec app node scripts/create-tenant.js \
  --tenant-id clientabc \
  --company "Client ABC Ltd" \
  --admin-email "admin@clientabc.com" \
  --plan starter
```

**Step 3 — Send credentials to client (5 minutes)**
```
URL: https://clientabc.dokcrm.com
Admin Email: admin@clientabc.com
Temp Password: [generated]
Support: support@dokcrm.com
```

**Total onboarding time: ~15 minutes per client**

### Client Offboarding (Contract Ends)

```bash
# Suspend client (keeps data 30 days)
docker compose exec app node scripts/suspend-tenant.js --tenant-id clientabc

# Export client data (provide to client)
pg_dump --schema=tenant_clientabc $DATABASE_URL > clientabc-data-export.sql

# Delete client permanently (after 30 days)
docker compose exec app node scripts/delete-tenant.js --tenant-id clientabc
```

---

## 15. Scaling Plan — When to Upgrade

### Upgrade Triggers

| Signal | Current Load | Action Required |
|--------|-------------|----------------|
| CPU consistently > 70% | e2-standard-2 | Upgrade to e2-standard-4 ($98/month) |
| Page load > 3 seconds | Any | Add Redis caching |
| DB connections maxed | db-custom-1-3840 | Upgrade DB tier |
| 25+ clients onboarded | Any | Move to Option C |
| Client demands isolated server | Any | Dedicated VM per client |

### Scaling Path

```
Stage 1 (Now)          Stage 2 (25+ clients)        Stage 3 (50+ clients)
─────────────────      ─────────────────────         ──────────────────────
1x VM e2-standard-2    1x VM e2-standard-4           2x VMs (load balanced)
Cloud SQL db-custom-1  Cloud SQL db-custom-2          Cloud SQL HA + replica
~$125/month            ~$215/month                    ~$400+/month
Up to 25 clients       Up to 50 clients               100+ clients
```

### Revenue Milestone to Upgrade

| Upgrade | Infrastructure Cost Jump | Revenue Needed First |
|---------|------------------------|---------------------|
| Option A → B | +$25/month | 2+ clients (already covered) |
| Option B → C | +$90/month | 5+ clients at USD 99 |
| Add Load Balancer | +$18/month | 10+ clients |
| Cloud SQL HA | +$92/month | 8+ clients |

---

## Summary

| Item | Value |
|------|-------|
| **Hosting platform** | Google Cloud Platform (GCP) |
| **Region** | asia-south1 (Mumbai) — low latency to Sri Lanka |
| **Deployment** | Docker Compose on Compute Engine VM |
| **Database** | Cloud SQL — PostgreSQL 15 (managed) |
| **Multi-tenant** | Schema-per-tenant in single PostgreSQL instance |
| **SSL** | Let's Encrypt wildcard (*.dokcrm.com) — free |
| **Backups** | Cloud SQL daily automatic + custom GCS export |
| **Monthly cost** | ~USD 100–125 (≈ LKR 32,500–40,625) |
| **Budget headroom** | USD 25–50 remaining from $150 budget |
| **Break-even** | 2 clients at USD 99/month |
| **Max clients (current)** | 15–25 clients |
| **Upgrade trigger** | 25+ clients or 50+ concurrent users |

---

*Document prepared by DOK Technology Team — March 2026*
*Infrastructure pricing based on GCP asia-south1 region. Prices subject to change.*
*LKR conversion at 1 USD = LKR 325 (approximate, March 2026)*
