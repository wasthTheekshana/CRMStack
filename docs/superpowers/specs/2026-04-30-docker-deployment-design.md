# Docker Deployment Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy DOK CRM (Express backend + React frontend + PostgreSQL) on a Linux server using Docker with wildcard HTTPS, automatic SSL renewal, and a one-command deploy script.

**Architecture:** 4 Docker containers orchestrated by a single `docker-compose.yml`. Nginx is the only internet-facing container (ports 80/443). It serves the React SPA as static files and reverse-proxies `/api/*` to the backend. Certbot manages the wildcard Let's Encrypt certificate via DNS-01 challenge.

**Tech Stack:** Docker, Docker Compose, Nginx Alpine, Node 20 Alpine, PostgreSQL 15 Alpine, Certbot

**Server:** `34.94.101.04` — domain `*.onlrvice.lk` (wildcard A record points to this IP)

---

## Container Architecture

```
Internet
  │
  ▼ :80 (HTTP → HTTPS redirect)
  ▼ :443 (HTTPS)
┌──────────────────────────────────────────────┐
│  nginx (nginx:alpine)                        │
│  ├─ serves /           → React SPA static   │
│  ├─ proxies /api/*     → backend:4000        │
│  ├─ SSL cert from certbot_certs volume       │
│  └─ passes Host header (tenant subdomain)    │
└────────────────┬─────────────────────────────┘
                 │ internal network (dokcrm_net)
        ┌────────▼────────┐
        │ backend          │
        │ (node:20-alpine) │
        │ port 4000        │
        │ reads req.hostname│
        │ for tenant ID    │
        └────────┬─────────┘
                 │
        ┌────────▼────────┐
        │ postgres         │
        │ (postgres:15-    │
        │  alpine)         │
        │ port 5432        │
        │ (internal only)  │
        └─────────────────┘

        ┌─────────────────┐
        │ certbot          │
        │ renews wildcard  │
        │ cert every 12h   │
        │ shares volume    │
        │ with nginx       │
        └─────────────────┘
```

---

## File Map

**Create:**
- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `nginx/nginx.conf`
- `nginx/certbot.sh`
- `deploy.sh`
- `.env.production`

**Replace:**
- `docker-compose.yml` — extend from postgres-only to all 4 services

---

## Service Definitions

### postgres
- Image: `postgres:15-alpine`
- Env: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` from `.env.production`
- Volume: `postgres_data:/var/lib/postgresql/data`
- Healthcheck: `pg_isready -U dokcrm -d dokcrm`
- **Not exposed** to host (internal network only)

### backend
- Build: `./backend/Dockerfile` (multi-stage)
- Env file: `.env.production`
- Depends on: postgres (healthcheck)
- Restart: `unless-stopped`
- **Not exposed** to host (nginx proxies internally)

### frontend
- Build: `./frontend/Dockerfile` (multi-stage)
- Produces static files into shared volume `frontend_dist`
- Restart policy: `no` — build-only, outputs to volume then exits

### nginx
- Image: `nginx:alpine`
- Ports: `80:80`, `443:443`
- Volumes:
  - `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`
  - `certbot_certs:/etc/letsencrypt:ro`
  - `frontend_dist:/usr/share/nginx/html:ro`
- Depends on: backend
- Restart: `unless-stopped`

### certbot
- Image: `certbot/certbot`
- Volume: `certbot_certs:/etc/letsencrypt`
- Command: `sh -c "trap exit TERM; while :; do certbot renew --quiet; sleep 12h & wait $!; done"`
- Restart: `unless-stopped`

---

## Dockerfile Specs

### `backend/Dockerfile` (multi-stage)

```
Stage 1 — builder (node:20-alpine):
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY tsconfig.json ./
  COPY src ./src
  RUN npm run build        # tsc → dist/

Stage 2 — runner (node:20-alpine):
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY package*.json ./
  COPY migrations ./migrations   # needed for migrate script
  EXPOSE 4000
  CMD ["node", "dist/index.js"]
```

### `frontend/Dockerfile` (multi-stage)

```
Stage 1 — builder (node:20-alpine):
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build        # vite build → dist/

Stage 2 — output (alpine):
  COPY --from=builder /app/dist /dist
  VOLUME ["/dist"]
  CMD ["sh", "-c", "cp -r /dist/. /output/ && echo 'Frontend copied'"]
  # Copies built files to mounted frontend_dist volume on startup
```

---

## Nginx Configuration

### HTTP → HTTPS redirect
```nginx
server {
    listen 80;
    server_name *.onlrvice.lk onlrvice.lk;
    return 301 https://$host$request_uri;
}
```

### HTTPS wildcard block
```nginx
server {
    listen 443 ssl;
    server_name *.onlrvice.lk onlrvice.lk;

    ssl_certificate     /etc/letsencrypt/live/onlrvice.lk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/onlrvice.lk/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # API reverse proxy — preserves Host header for tenant detection
    location /api/ {
        proxy_pass         http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # React SPA — all unknown paths fall back to index.html
    location / {
        root       /usr/share/nginx/html;
        try_files  $uri $uri/ /index.html;
        expires    1h;
        add_header Cache-Control "public, must-revalidate";
    }
}
```

---

## SSL Certificate — First-Time Issuance

`nginx/certbot.sh` — run **once** on the server before starting nginx:

```bash
docker run --rm -it \
  -v dokcrm_certbot_certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email admin@onlrvice.lk \
  --agree-tos \
  --no-eff-email \
  -d "*.onlrvice.lk" \
  -d "onlrvice.lk"
```

Certbot prints a DNS TXT value. Add `_acme-challenge.onlrvice.lk TXT <value>` at your registrar. Wait ~60 seconds for propagation, then press Enter. Cert is stored in the `certbot_certs` Docker volume.

Auto-renewal runs every 12 hours inside the certbot container. After renewal, nginx must reload:
```bash
docker compose exec nginx nginx -s reload
```
This reload can be added to a host cron job: `0 */12 * * * docker compose -f /home/user/dok-stack/docker-compose.yml exec nginx nginx -s reload`

---

## `.env.production` Template

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=dokcrm
DB_USER=dokcrm
DB_PASSWORD=<strong-random-password>

# JWT
JWT_SECRET=<random-64-char-string>
JWT_EXPIRES_IN=7d
SA_JWT_SECRET=<random-64-char-string>

# Server
PORT=4000
NODE_ENV=production

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your@outlook.com
SMTP_PASS=<app-password>
SMTP_FROM=noreply@onlrvice.lk
APP_BASE_URL=https://docrm.onlrvice.lk
```

**Never commit this file to git.** Add `.env.production` to `.gitignore`.

---

## `deploy.sh`

```bash
#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Building images..."
docker compose build

echo "==> Starting database..."
docker compose up -d postgres
sleep 5  # wait for postgres healthcheck

echo "==> Running migrations..."
docker compose run --rm backend node dist/lib/migrate.js

echo "==> Starting all services..."
docker compose up -d

echo "==> Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "==> Deploy complete."
docker compose ps
```

---

## Server Directory Layout

```
~/dok-stack/
├── docker-compose.yml
├── .env.production          ← never in git
├── deploy.sh
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── src/
│   ├── migrations/
│   └── package.json
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── src/
│   └── package.json
└── nginx/
    ├── nginx.conf
    └── certbot.sh
```

---

## First-Time Server Setup Sequence

1. SSH into server, install Docker + Docker Compose
2. Clone repo to `~/dok-stack/`
3. Copy `.env.production` to server and fill in values
4. Run `nginx/certbot.sh` to issue wildcard cert
5. Run `docker compose up -d` to start all services
6. Run `docker compose run --rm backend node dist/lib/migrate.js` for DB migration
7. Run `docker compose exec nginx nginx -s reload`
8. Visit `https://docrm.onlrvice.lk` — app should be live

---

## Security Notes

- `postgres` and `backend` containers are on internal Docker network only — not reachable from outside
- `.env.production` must never be committed to git
- Use strong random values for `DB_PASSWORD`, `JWT_SECRET`, `SA_JWT_SECRET`
- SSL via Let's Encrypt wildcard cert, auto-renewed every 12h check
- `proxy_set_header Host $host` ensures `req.hostname` in Node.js correctly reflects the tenant subdomain
