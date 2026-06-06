# DOK CRM — Hosting & Pricing Plan

**Hosted & Managed by DOK Technology**
**Platform:** Google Cloud Platform · **Database:** PostgreSQL 15 · **Deployment:** Docker

---

## Standard Plan

| | |
|-|-|
| **Monthly Price** | **LKR 50,000 / month** |
| **Users Included** | 5 users |
| **Additional User** | LKR 3,000 / user / month |
| **Billing** | Monthly, paid in advance |
| **Contract** | Month to month (no lock-in) |

---

## What's Included — LKR 50,000/month

| Category | Feature | Included |
|----------|---------|----------|
| **CRM Features** | Sales pipeline (Kanban board) | ✅ |
| | Lead management (create, edit, delete) | ✅ |
| | All pipeline stages (On Hold → Closed & Won) | ✅ |
| | Deal modal with full lead details | ✅ |
| | Deleted leads recovery page | ✅ |
| | Sales dashboard & KPI cards | ✅ |
| | Sales funnel chart | ✅ |
| | Opportunity distribution chart | ✅ |
| | Rep performance analytics | ✅ |
| | Rep comparison report | ✅ |
| | Revenue forecasting | ✅ |
| | Sales targets (per rep) | ✅ |
| | Custom dashboard layout | ✅ |
| **Access** | Admin account (1) | ✅ |
| | Sales rep accounts (up to 5 total) | ✅ |
| | Role-based access control | ✅ |
| | Secure login (email + password) | ✅ |
| **Hosting** | Google Cloud hosting (Mumbai region) | ✅ |
| | Your own subdomain: `company.dokcrm.com` | ✅ |
| | HTTPS SSL certificate (auto-renewed) | ✅ |
| | Docker-based deployment | ✅ |
| **Database** | PostgreSQL 15 (Cloud SQL managed) | ✅ |
| | Up to 10,000 lead records | ✅ |
| | 50 GB data storage | ✅ |
| **Maintenance** | Server maintenance & OS updates | ✅ |
| | Bug fixes | ✅ |
| | Feature updates | ✅ |
| | Daily automated database backup | ✅ |
| | 7-day backup retention | ✅ |
| **Support** | Email support | ✅ |
| | User guide & documentation | ✅ |
| | Initial onboarding setup | ✅ |
| **Uptime** | 99.5% uptime guarantee | ✅ |

---

## Additional License Pricing

When more than 5 users are needed, additional user licenses can be added at any time.

| | Price |
|-|-------|
| **Additional user license** | **LKR 3,000 / user / month** |
| Minimum add | 1 user |
| Maximum users | No limit |
| Changes | Add or remove at start of any billing month |

### Monthly Cost by User Count

| Total Users | Base Plan | Extra Licenses | **Total / Month** |
|-------------|-----------|---------------|-------------------|
| 5 users | LKR 50,000 | — | **LKR 50,000** |
| 6 users | LKR 50,000 | LKR 3,000 (×1) | **LKR 53,000** |
| 7 users | LKR 50,000 | LKR 6,000 (×2) | **LKR 56,000** |
| 8 users | LKR 50,000 | LKR 9,000 (×3) | **LKR 59,000** |
| 9 users | LKR 50,000 | LKR 12,000 (×4) | **LKR 62,000** |
| 10 users | LKR 50,000 | LKR 15,000 (×5) | **LKR 65,000** |
| 15 users | LKR 50,000 | LKR 30,000 (×10) | **LKR 80,000** |
| 20 users | LKR 50,000 | LKR 45,000 (×15) | **LKR 95,000** |

---

## Google Cloud Infrastructure — Full Specs

All DOK CRM hosting runs on Google Cloud Platform (GCP). DOK manages all infrastructure. The client does not need any server or IT setup.

### Application Server

| Spec | Detail |
|------|--------|
| **GCP Service** | Compute Engine |
| **Machine Type** | e2-standard-2 |
| **CPU** | 2 vCPU |
| **RAM** | 8 GB |
| **Boot Disk** | 50 GB SSD (pd-balanced) |
| **Operating System** | Ubuntu 22.04 LTS |
| **Region** | asia-south1 — Mumbai, India |
| **Deployment** | Docker Compose |
| **Containers** | Nginx (proxy + SSL) · DOK CRM App (Node.js) · Certbot (SSL) |

### Database Server

| Spec | Detail |
|------|--------|
| **GCP Service** | Cloud SQL (fully managed) |
| **Database** | PostgreSQL 15 |
| **Instance Type** | db-custom-1-3840 |
| **CPU** | 1 vCPU (dedicated) |
| **RAM** | 3.75 GB |
| **Storage** | 50 GB SSD (auto-increase enabled) |
| **Connection** | Private IP only (not exposed to internet) |
| **Encryption** | TLS required for all connections |
| **Backups** | Automatic daily, 7-day retention |
| **Multi-tenant** | Separate schema per client (full data isolation) |

### Networking & Security

| Spec | Detail |
|------|--------|
| **External IP** | 1 static IP address |
| **DNS** | Cloud DNS — managed zone for `dokcrm.com` |
| **SSL** | Let's Encrypt wildcard `*.dokcrm.com` — auto-renewed |
| **Firewall** | Port 443 (HTTPS) open · Port 22 (SSH) — DOK office IP only |
| **DDoS Protection** | Cloudflare / GCP Cloud Armor (basic, free tier) |
| **Data at Rest** | AES-256 encryption (GCP default) |
| **Data in Transit** | TLS 1.3 |

### Storage & Backup

| Spec | Detail |
|------|--------|
| **GCP Service** | Cloud Storage |
| **Capacity** | 50 GB (database backups + file storage) |
| **Backup Schedule** | Daily at 2:00 AM |
| **Backup Retention** | 7 days rolling |
| **Restore Time** | Within 4 hours |

### Infrastructure Capacity

| Metric | Capacity |
|--------|---------|
| Concurrent users | Up to 30 |
| Total users (all clients) | Up to 500 |
| Lead records per client | Up to 10,000 |
| Uptime target | 99.5% |
| Response time | < 2 seconds (from Sri Lanka) |

---

## What DOK Manages (Client Does Nothing)

| Managed by DOK | Detail |
|----------------|--------|
| Server provisioning | GCP VM setup and configuration |
| Docker deployment | App container builds and updates |
| Database management | PostgreSQL setup, tuning, monitoring |
| SSL certificates | Auto-renewed, never expires |
| Security patches | OS and software updates |
| Daily backups | Automated, verified |
| Monitoring & alerts | 24/7 uptime monitoring |
| Bug fixes | All bugs fixed at no extra charge |
| Feature releases | New features deployed automatically |
| Client subdomain | `company.dokcrm.com` setup |

**Client only needs:** A web browser and internet connection.

---

## DOK Internal — Monthly Infrastructure Cost

> This section is for DOK team reference only. Not shown to clients.

| GCP Service | Spec | USD/month | LKR/month |
|-------------|------|-----------|-----------|
| Compute Engine VM | e2-standard-2, 2 vCPU, 8 GB RAM, 50 GB SSD | $49.00 | LKR 15,925 |
| Cloud SQL PostgreSQL | db-custom-1-3840, 50 GB SSD | $46.00 | LKR 14,950 |
| Static External IP | 1 reserved address | $7.20 | LKR 2,340 |
| Cloud DNS | Managed zone | $0.40 | LKR 130 |
| Cloud Storage | 50 GB (backups) | $1.00 | LKR 325 |
| Network Egress | ~100 GB/month | $8.00 | LKR 2,600 |
| SSL / Monitoring | Let's Encrypt + free tier | $0.00 | LKR 0 |
| **Total Infrastructure** | | **$111.60** | **LKR 36,270** |
| Buffer / contingency | | $13.40 | LKR 4,355 |
| **Total Monthly** | | **~$125** | **~LKR 40,625** |

### Gross Profit per Client Added

| Clients | Revenue (LKR) | Infrastructure (LKR) | Gross Profit (LKR) |
|---------|--------------|---------------------|-------------------|
| 1 client | LKR 50,000 | LKR 40,625 | **LKR 9,375** |
| 2 clients | LKR 100,000 | LKR 40,625 | **LKR 59,375** |
| 3 clients | LKR 150,000 | LKR 40,625 | **LKR 109,375** |
| 5 clients | LKR 250,000 | LKR 40,625 | **LKR 209,375** |
| 10 clients | LKR 500,000 | LKR 40,625 | **LKR 459,375** |

> Infrastructure is shared across all clients. Revenue grows linearly. Infrastructure stays flat until 25+ clients.

---

## Summary

| | |
|-|-|
| **Plan** | Standard |
| **Client monthly price** | LKR 50,000 |
| **Additional user** | LKR 3,000 / user / month |
| **Hosting platform** | Google Cloud Platform — Mumbai region |
| **App server** | e2-standard-2 · 2 vCPU · 8 GB RAM |
| **Database** | Cloud SQL PostgreSQL 15 · 1 vCPU · 3.75 GB |
| **Deployment** | Docker on Compute Engine VM |
| **SSL** | Free — Let's Encrypt wildcard |
| **Backups** | Daily automatic — 7-day retention |
| **DOK infrastructure cost** | ~LKR 40,625 / month |
| **Break-even** | 1 client (covers infrastructure) |
| **Max clients (current setup)** | 15–25 clients |

---

*DOK Technology Team — March 2026*
*For client inquiries: sales@dokcrmapp.com*
