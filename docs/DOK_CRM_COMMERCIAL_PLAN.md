# DOK CRM — Commercial Deployment & Pricing Plan

> Full technical and commercial guide for deploying DOK CRM at Internal Group level and Global Commercial level.

---

## Table of Contents

1. [Overview & Commercial Stages](#1-overview--commercial-stages)
2. [Stage 1: Internal Commercial Deployment](#2-stage-1-internal-commercial-deployment)
3. [Stage 2: Global Commercial Deployment](#3-stage-2-global-commercial-deployment)
4. [Oracle Database — Server Specifications](#4-oracle-database--server-specifications)
5. [System Architecture](#5-system-architecture)
6. [Global Licensing & Pricing Model](#6-global-licensing--pricing-model)
7. [What Is Included in Every Plan](#7-what-is-included-in-every-plan)
8. [Service Level Agreement (SLA)](#8-service-level-agreement-sla)
9. [Onboarding & Implementation](#9-onboarding--implementation)
10. [Support Tiers](#10-support-tiers)
11. [Commercial Readiness Checklist](#11-commercial-readiness-checklist)

---

## 1. Overview & Commercial Stages

DOK CRM is a sales pipeline management system built for document solutions businesses. The commercial rollout is planned in **two phases**:

| Stage | Target | Infrastructure | Database | Timeline |
|-------|--------|---------------|----------|----------|
| **Stage 1 — Internal Commercial** | DOK Group subsidiaries & internal companies | Private network / on-premise | Oracle DB (Standard Edition) | Immediate |
| **Stage 2 — Global Commercial** | External businesses worldwide | Cloud (OCI / AWS) | Oracle DB (Enterprise Edition + RAC) | After internal validation |

---

## 2. Stage 1: Internal Commercial Deployment

### 2.1 Who Is This For?

Internal deployment targets companies within the **DOK Group** — subsidiaries, sister companies, and affiliated business units that need a sales pipeline management solution. Each company operates as an isolated tenant with its own:

- Admin user(s)
- Sales representative accounts
- Lead data (not shared with other companies)
- Dashboard and reporting

### 2.2 Deployment Model

```
DOK Group HQ Network
│
├── Central Oracle DB Server (shared, with schema isolation per company)
│
├── Application Server (DOK CRM backend)
│
├── Company A ──── Admin + Sales Reps (their own data)
├── Company B ──── Admin + Sales Reps (their own data)
├── Company C ──── Admin + Sales Reps (their own data)
└── Company N ──── Admin + Sales Reps (their own data)
```

### 2.3 Internal Deployment Infrastructure

| Component | Specification |
|-----------|---------------|
| **Network** | Private LAN / VPN — no public internet required |
| **Application** | Hosted on internal web server (Apache Tomcat or Nginx) |
| **Database** | Oracle DB — one central instance, schema-per-tenant or row-level isolation |
| **Authentication** | Firebase Authentication (can operate in private mode) or replace with LDAP/AD |
| **Backup** | Nightly automated backup to NAS / secondary server |
| **Access** | Internal URL (e.g., `crm.dokgroup.local`) or VPN-only |

### 2.4 Internal Pricing (Intra-Group)

For internal group companies, pricing is typically a **cost-sharing model** rather than a commercial subscription. Recommended approach:

| Model | Description |
|-------|-------------|
| **Cost Recovery** | Each company contributes to shared server + maintenance costs |
| **Flat Annual Fee** | Fixed annual fee per company regardless of user count |
| **Per-User Annual** | Charged per active user per year |

> **Suggested Internal Rate:** LKR 150,000 – 300,000 per company per year (depending on user count), covering hosting, maintenance, and support.

### 2.5 Internal Rollout Steps

1. **Deploy central server** with Oracle DB and application
2. **Create one Admin account** per internal company
3. **Onboard admin** — 2-hour training session
4. **Admin creates sales rep accounts** for their team
5. **Migrate existing lead data** (CSV import if needed)
6. **Go live** — 30-day monitoring period

---

## 3. Stage 2: Global Commercial Deployment

### 3.1 Who Is This For?

Global commercial targets **any business worldwide** in the document solutions, workflow automation, or records management industry. Each customer (tenant) has completely isolated data.

### 3.2 Deployment Model

```
Global Cloud Infrastructure (OCI or AWS)
│
├── Load Balancer / CDN (Cloudflare or OCI Load Balancer)
│
├── Application Servers (2+ nodes, auto-scaling)
│   ├── App Node 1
│   └── App Node 2
│
├── Oracle DB Enterprise Edition (RAC — Real Application Clusters)
│   ├── DB Node 1 (Primary)
│   └── DB Node 2 (Standby / Read Replica)
│
├── Redis Cache (session & real-time data)
│
└── Object Storage (document attachments, exports, backups)
    └── OCI Object Storage / AWS S3
```

### 3.3 Multi-Tenancy Architecture

Each customer company is isolated at the **database schema level**:

```
Oracle DB (Enterprise)
│
├── Schema: TENANT_001 (Company A)
├── Schema: TENANT_002 (Company B)
├── Schema: TENANT_003 (Company C)
└── Schema: TENANT_NNN (Company N)
```

This ensures:
- Zero data leakage between tenants
- Easy individual backup/restore per tenant
- Simple offboarding (drop schema)

---

## 4. Oracle Database — Server Specifications

### 4.1 Stage 1 — Internal Deployment (Oracle Standard Edition)

**Recommended for up to 5 companies / 50 total users**

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Oracle Version** | Oracle Database 19c Standard Edition 2 | Oracle Database 21c Standard Edition 2 |
| **CPU** | 4 cores (Intel Xeon or AMD EPYC) | 8 cores |
| **RAM** | 16 GB | 32 GB |
| **Storage (OS + App)** | 100 GB SSD | 200 GB NVMe SSD |
| **Storage (Database)** | 500 GB SSD (with room to grow) | 1 TB NVMe SSD |
| **Storage (Backups)** | 2 TB HDD (separate disk) | 4 TB HDD RAID-1 |
| **Network** | 1 Gbps LAN | 10 Gbps LAN |
| **OS** | Oracle Linux 8 / RHEL 8 | Oracle Linux 8 |
| **Oracle Options** | Base license | Base license + Partitioning option |

**Estimated Oracle License Cost (Stage 1):**
- Oracle Database Standard Edition 2: ~USD 17,500 per socket (perpetual) or ~USD 350/month per socket (cloud)
- For 2-socket server: ~USD 35,000 one-time or ~USD 700/month

---

### 4.2 Stage 2 — Global Cloud Deployment (Oracle Enterprise Edition)

**Recommended for 10–500+ companies / 1,000+ total users**

#### Primary DB Nodes (RAC Cluster — 2 nodes)

| Component | Per Node Spec |
|-----------|--------------|
| **Oracle Version** | Oracle Database 21c Enterprise Edition |
| **CPU** | 16 cores (OCI: VM.Standard.E4.Flex or BM.Standard3.64) |
| **RAM** | 128 GB per node |
| **Storage (Redo Logs)** | 500 GB NVMe SSD (low latency) |
| **Storage (Data)** | 5 TB per node (expandable) |
| **Shared Storage (ASM)** | Oracle ASM on shared SAN — 10 TB initial |
| **Network** | 25 Gbps between nodes |
| **OS** | Oracle Linux 8 (Oracle-supported kernel) |

#### Oracle Enterprise Options Required

| Option | Purpose |
|--------|---------|
| **Real Application Clusters (RAC)** | High availability, no single point of failure |
| **Active Data Guard** | Real-time standby database for disaster recovery |
| **Partitioning** | Efficient multi-tenant schema isolation |
| **Advanced Security** | Data encryption at rest and in transit |
| **Multitenant (CDB/PDB)** | Container database for tenant isolation |
| **Database Vault** | Prevent privileged user access to tenant data |

**Estimated Oracle License Cost (Stage 2):**
- Oracle Database Enterprise Edition: ~USD 47,500 per processor (perpetual)
- RAC option: ~USD 23,000 per processor (perpetual)
- For 2-node, 2-socket cluster (4 processors total): ~USD 280,000+ one-time
- **OCI Oracle Cloud alternative:** BYOL on OCI or pay-as-you-go from ~USD 2,000–8,000/month depending on shape

#### Application Servers (Stage 2)

| Component | Spec |
|-----------|------|
| **Nodes** | Minimum 2 (auto-scaling to 6+) |
| **CPU per node** | 8 vCPUs |
| **RAM per node** | 32 GB |
| **Storage per node** | 100 GB SSD (OS + app) |
| **Load Balancer** | OCI Load Balancer / AWS ALB |
| **Cache** | Redis 7.x — 16 GB RAM |
| **CDN** | Cloudflare (global) or OCI CDN |

#### Backup & Disaster Recovery (Stage 2)

| Item | Specification |
|------|---------------|
| **Backup frequency** | Full: Weekly, Incremental: Daily, Redo logs: Every 15 minutes |
| **Backup destination** | OCI Object Storage (geo-redundant) |
| **Retention** | 90 days for daily backups, 1 year for monthly backups |
| **RTO (Recovery Time Objective)** | < 4 hours |
| **RPO (Recovery Point Objective)** | < 15 minutes |
| **Disaster Recovery** | Active Data Guard — hot standby in separate region |

---

## 5. System Architecture

### 5.1 Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite | Current production stack |
| **UI Components** | Shadcn/UI + Tailwind CSS | |
| **State Management** | Zustand | |
| **Charts** | Recharts | |
| **Drag & Drop** | @dnd-kit | |
| **Current Backend** | Firebase (Firestore + Auth) | Phase 1 |
| **Target Backend (Stage 2)** | Oracle DB + Node.js / Java Spring Boot API | Phase 2 migration |
| **Authentication (Stage 2)** | OAuth 2.0 / OpenID Connect + Oracle Identity Cloud | |
| **File Storage** | OCI Object Storage / AWS S3 | |
| **Email Service** | Oracle Email Delivery / AWS SES | |

### 5.2 Firebase → Oracle Migration Path

The current system uses Firebase. For Stage 2 (Oracle), a migration path is required:

```
Phase 1 (Now):        Firebase (Firestore + Auth)
                       ↓
Phase 2 (Internal):   Hybrid — Firebase Auth + Oracle DB for data
                       ↓
Phase 3 (Global):     Full Oracle stack — Oracle IDCS + Oracle DB + REST API
```

**Migration effort estimate:** 3–5 months for a 2-developer team.

---

## 6. Global Licensing & Pricing Model

### 6.1 Subscription Tiers

DOK CRM is sold as a **monthly subscription** with three tiers based on the number of active user licenses.

---

### TIER 1 — Starter
**Best for small sales teams just getting started**

| Item | Detail |
|------|--------|
| **Included Licenses** | 3 user licenses |
| **Monthly Price** | USD 99 / month |
| **Annual Price** | USD 990 / year (2 months free) |
| **Billed** | Monthly or Annually |

**Includes:**
- 1 Admin account + 2 Sales Rep accounts
- Full pipeline management (Kanban board)
- Analytics & Reports
- Sales Targets tracking
- PDF & CSV Export
- Email support (48-hour response)
- Maintenance & bug fixes
- Monthly software updates

---

### TIER 2 — Business
**Best for growing teams with multiple sales reps**

| Item | Detail |
|------|--------|
| **Included Licenses** | 10 user licenses |
| **Monthly Price** | USD 249 / month |
| **Annual Price** | USD 2,490 / year (2 months free) |
| **Billed** | Monthly or Annually |

**Includes everything in Starter, plus:**
- Up to 10 user licenses (1 Admin + 9 Sales Reps)
- Rep Performance Comparison dashboard
- Quarterly Targets (Admin)
- Priority email support (24-hour response)
- Quarterly system health report
- Data backup & restore on request

---

### TIER 3 — Enterprise
**Best for large organizations with unlimited users**

| Item | Detail |
|------|--------|
| **Included Licenses** | Unlimited |
| **Monthly Price** | USD 599 / month |
| **Annual Price** | USD 5,990 / year (2 months free) |
| **Billed** | Monthly or Annually |

**Includes everything in Business, plus:**
- Unlimited user licenses
- Custom branding (logo, color scheme)
- Dedicated account manager
- Phone + email support (4-hour response)
- Monthly system health report
- Custom feature development (2 requests/year)
- SLA guarantee: 99.5% uptime
- Priority bug fixing (24-hour fix guarantee)
- On-site training session (1 per year, if local)

---

### 6.2 Additional License Pricing (Beyond Tier Limits)

If a customer on Starter or Business needs more users than their tier includes, they can add individual licenses:

| Situation | Additional License Price |
|-----------|------------------------|
| Starter customer needs 4th–10th user | USD 25 per extra user / month |
| Business customer needs 11th–unlimited user | USD 20 per extra user / month |
| Enterprise | Included (unlimited) |

**Example calculation:**
> A Business customer (USD 249/month for 10 users) needs 15 users.
> Extra 5 users × USD 20 = USD 100/month additional.
> **Total: USD 349/month**

---

### 6.3 Pricing Summary Table

| Tier | Base Users | Monthly | Annual | Extra User/Month |
|------|-----------|---------|--------|-----------------|
| **Starter** | 3 | USD 99 | USD 990 | USD 25 |
| **Business** | 10 | USD 249 | USD 2,490 | USD 20 |
| **Enterprise** | Unlimited | USD 599 | USD 5,990 | Included |

---

### 6.4 One-Time Setup Fee

| Setup Type | Fee |
|-----------|-----|
| Standard onboarding (remote) | USD 199 one-time |
| Enterprise onboarding (with training) | USD 499 one-time |
| Data migration from existing system | USD 299 one-time |
| Custom configuration | Quoted separately |

---

### 6.5 LKR Pricing (Internal Sri Lankan Market)

For the internal market (Sri Lanka), pricing can be offered in LKR:

| Tier | Monthly (LKR) | Annual (LKR) |
|------|--------------|-------------|
| **Starter** | LKR 32,000 | LKR 320,000 |
| **Business** | LKR 80,000 | LKR 800,000 |
| **Enterprise** | LKR 195,000 | LKR 1,950,000 |
| **Extra User** | LKR 7,500 – 8,500/user | — |

> *LKR rates based on approximate USD/LKR exchange rate. Subject to revision quarterly.*

---

## 7. What Is Included in Every Plan

Every subscription plan — regardless of tier — includes the following:

### 7.1 Maintenance

| Item | Description |
|------|-------------|
| **Server maintenance** | OS patching, database maintenance, disk cleanup |
| **Application updates** | Feature improvements and enhancements pushed monthly |
| **Database optimization** | Quarterly index analysis, query tuning, storage management |
| **Security patches** | Critical security updates applied within 48 hours of release |
| **SSL certificate renewal** | Automatic renewal — no downtime |
| **Dependency updates** | Node.js, React, and library updates tested and applied |

### 7.2 Bug Fixing

| Priority | Definition | Response Time | Fix Time |
|----------|-----------|--------------|----------|
| **Critical** | System down, data loss, login failure | 2 hours | 24 hours |
| **High** | Major feature broken, incorrect data shown | 8 hours | 3 days |
| **Medium** | Feature partially working, workaround available | 24 hours | 7 days |
| **Low** | Minor UI issues, cosmetic defects | 48 hours | Next release |

**Bug reporting:** Via email to support@dokcrmapp.com or through in-app feedback button.

### 7.3 Testing

Before every software update is pushed to production, the following testing is performed:

| Test Type | Description |
|-----------|-------------|
| **Unit Testing** | Individual functions tested in isolation |
| **Integration Testing** | Firebase / Oracle DB integration verified |
| **UI Testing** | All pages checked on desktop and mobile |
| **Regression Testing** | Existing features verified after any change |
| **Performance Testing** | Response time benchmarks checked (< 2 sec load time) |
| **Security Testing** | Firestore rules / Oracle DB permissions reviewed |
| **Browser Compatibility** | Tested on Chrome, Firefox, Safari, Edge |
| **Mobile Responsiveness** | Tested on iOS Safari and Android Chrome |

### 7.4 Service & Support

| Channel | Starter | Business | Enterprise |
|---------|---------|----------|-----------|
| Email support | ✅ 48h | ✅ 24h | ✅ 4h |
| Phone support | ❌ | ❌ | ✅ |
| Live chat | ❌ | ✅ | ✅ |
| Dedicated account manager | ❌ | ❌ | ✅ |
| On-site support | ❌ | ❌ | ✅ (1/year) |
| Video call support | ❌ | ✅ | ✅ |
| Knowledge base access | ✅ | ✅ | ✅ |

---

## 8. Service Level Agreement (SLA)

### 8.1 Uptime Guarantees

| Tier | Monthly Uptime Guarantee | Max Allowed Downtime/Month |
|------|------------------------|--------------------------|
| **Starter** | 99.0% | ~7.3 hours |
| **Business** | 99.2% | ~5.8 hours |
| **Enterprise** | 99.5% | ~3.6 hours |

### 8.2 SLA Breach Compensation

If uptime falls below the guaranteed level in any calendar month:

| Downtime Exceeded By | Credit |
|---------------------|--------|
| Up to 1 hour | 5% of monthly fee |
| 1–4 hours | 10% of monthly fee |
| 4–8 hours | 25% of monthly fee |
| More than 8 hours | 50% of monthly fee |

Credits are applied to the next billing cycle automatically.

### 8.3 Planned Maintenance Windows

| Window | Schedule | Duration |
|--------|---------|---------|
| Regular maintenance | Sunday 01:00–03:00 (local time) | Up to 2 hours |
| Emergency patches | As needed — 1 hour notice | Up to 1 hour |
| Major upgrades | Announced 7 days in advance | Up to 4 hours |

Customers are notified by email before all planned maintenance.

---

## 9. Onboarding & Implementation

### 9.1 Onboarding Timeline

| Step | Activity | Duration |
|------|---------|---------|
| 1 | Account creation & admin setup | Day 1 |
| 2 | Data migration (if needed) | Day 1–3 |
| 3 | Admin training session | Day 3–5 |
| 4 | Sales rep onboarding | Day 5–7 |
| 5 | Go-live & monitoring | Day 7 |
| 6 | 30-day post go-live support | Days 7–37 |

### 9.2 Data Migration

If the customer has existing lead data (in Excel, CSV, or another CRM):

| Format | Migration Support |
|--------|-----------------|
| Excel (.xlsx) | ✅ Supported — automated import tool |
| CSV | ✅ Supported |
| Google Sheets | ✅ Export to CSV then import |
| Another CRM | Quoted separately based on complexity |

The migration script maps the following fields automatically:
- Company Name
- Contact Name & Phone
- Sales Stage (mapped to DOK CRM stages)
- Estimated Revenue
- Probability
- Remarks

### 9.3 Training

| Session | Duration | Who Attends |
|---------|---------|------------|
| Admin training | 2 hours | System admin |
| Sales rep training | 1.5 hours | All sales reps |
| Advanced features session | 1 hour | Admin (analytics, reports) |

Training is conducted via **video call** (Zoom or Google Meet). Session recordings are provided to the customer.

---

## 10. Support Tiers

### 10.1 Support Contact Details

| Channel | Address / Number |
|---------|----------------|
| Support email | support@dokcrmapp.com |
| Sales email | sales@dokcrmapp.com |
| WhatsApp (Enterprise) | +94 XX XXX XXXX |
| Support portal | https://support.dokcrmapp.com |

### 10.2 Escalation Path

```
Level 1: First-line support (email / chat)
    ↓ (if unresolved in SLA time)
Level 2: Technical engineer (code-level investigation)
    ↓ (if unresolved)
Level 3: Lead developer / CTO direct involvement
```

---

## 11. Commercial Readiness Checklist

Use this checklist before going live commercially:

### 11.1 Technical Readiness

- [ ] Oracle DB server provisioned and configured
- [ ] Oracle DB user accounts and schemas created
- [ ] Application deployed on production server
- [ ] SSL certificate installed (HTTPS enforced)
- [ ] Domain name configured (e.g., app.dokcrmapp.com)
- [ ] Firebase Auth or Oracle IDCS configured
- [ ] Backup system tested (restore tested successfully)
- [ ] Load testing completed (target: 100 concurrent users minimum)
- [ ] Security audit completed (OWASP Top 10 review)
- [ ] Email delivery system configured (notifications work)
- [ ] Monitoring alerts configured (server CPU, memory, disk)

### 11.2 Business Readiness

- [ ] Pricing structure finalized and approved
- [ ] Invoice / billing system ready (payment gateway integrated)
- [ ] Standard subscription agreement (legal contract) drafted
- [ ] Support email inbox monitored
- [ ] Knowledge base / user documentation published
- [ ] Onboarding checklist prepared
- [ ] Support team trained

### 11.3 For Each New Internal Company (Stage 1)

- [ ] Admin account created in the system
- [ ] Company data schema created in Oracle DB
- [ ] Admin trained (2-hour session completed)
- [ ] Sales rep accounts created by admin
- [ ] Initial lead data migrated (if applicable)
- [ ] Test transaction done (create, edit, move, delete lead)
- [ ] Access to deleted leads page verified
- [ ] Analytics page confirmed working with real data

### 11.4 For Each New Global Customer (Stage 2)

- [ ] Subscription plan confirmed and payment received
- [ ] Tenant schema provisioned in Oracle DB
- [ ] Admin account created and credentials sent securely
- [ ] Welcome email sent with login URL and user guide PDF
- [ ] Onboarding call scheduled
- [ ] SLA agreement signed
- [ ] Customer added to support portal

---

## Appendix A: Oracle DB License Comparison

| Edition | Max CPUs | RAC | Multitenant | Price (Approx) |
|---------|---------|-----|------------|---------------|
| Standard Edition 2 | 2 sockets | ❌ | ❌ | ~USD 17,500/socket |
| Enterprise Edition | Unlimited | ✅ (extra) | ✅ (extra) | ~USD 47,500/processor |
| Oracle Cloud (BYOL) | Flexible | ✅ | ✅ | From USD 0.03/OCPU/hour |

> **Recommendation for Stage 1:** Oracle Standard Edition 2 (sufficient for internal group use)
> **Recommendation for Stage 2:** Oracle Enterprise Edition on OCI (Oracle Cloud Infrastructure) — start with BYOL (Bring Your Own License) to reduce initial cost

---

## Appendix B: Monthly Recurring Revenue Projection

Hypothetical revenue scenarios for global commercial:

| Scenario | Customers | Avg Plan | MRR |
|---------|-----------|---------|-----|
| Early stage | 10 customers | Business (USD 249) | USD 2,490 |
| Growth | 50 customers | Business (USD 249) | USD 12,450 |
| Scale | 150 customers | Mix of Business + Enterprise | ~USD 55,000 |
| Mature | 500 customers | Mix across all tiers | ~USD 180,000 |

---

## Appendix C: Competitive Positioning

| CRM | Starting Price | Target Market | Key Difference vs DOK CRM |
|-----|--------------|--------------|--------------------------|
| Salesforce | USD 25/user/month | Enterprise | Much more complex, expensive |
| HubSpot CRM | Free – USD 90/user | SMB | General-purpose, not document-specific |
| Zoho CRM | USD 14/user/month | SMB | General-purpose |
| **DOK CRM** | **USD 99/3 users** | **Document Solutions industry** | **Industry-specific, Oracle DB, includes maintenance** |

**DOK CRM advantage:** Built specifically for document solutions and workflow automation businesses. Competitors are general-purpose CRMs that require heavy customization. DOK CRM works out-of-the-box for this industry.

---

*Document prepared by DOK Technology Team — March 2026*
*For pricing queries: sales@dokcrmapp.com*
*Subject to revision based on market conditions and Oracle licensing changes.*

---

## Appendix A: Sri Lanka Small Business Deployment Guide

> **Target:** Small companies in Sri Lanka with a total IT budget of approximately **LKR 50,000/month** for CRM infrastructure

---

### Why NOT Oracle Database for This Budget

Oracle Database Standard Edition 2 licensing starts at **~USD 350/month** (≈ LKR 113,000+/month) on cloud — that alone exceeds the total LKR 50,000 budget before any server or support costs. Oracle is therefore **not recommended** for Sri Lanka small company deployments.

**Recommended Alternative:** **PostgreSQL** — enterprise-grade, fully open-source, zero licensing cost, excellent performance, and a strong drop-in alternative to Oracle for this scale.

---

### Stage 1 — Internal Deployment (Sri Lanka Small Company)

**Goal:** Host DOK CRM for a single company with 3–10 users internally.

#### Recommended Database: PostgreSQL 15+
- **Cost:** Free (open source)
- **Why:** Handles 100K+ leads easily, supports JSON columns, full-text search, and ACID compliance — no licence fees
- **Hosting:** Self-hosted on the same VPS or a dedicated DB instance

#### Server Specifications

| Component | Specification | Notes |
|-----------|---------------|-------|
| CPU | 2 vCPU | Handles 3–10 concurrent users |
| RAM | 4 GB | Sufficient for app + PostgreSQL |
| Storage | 50 GB SSD | ~3–5 years of CRM data |
| OS | Ubuntu 22.04 LTS | Free, widely supported |
| Web Server | Nginx | Reverse proxy + static file serving |
| Runtime | Node.js 20 LTS | For API/backend |
| DB | PostgreSQL 15 | Self-hosted on same VPS |

#### Hosting Options (Stage 1)

| Provider | Plan | Monthly Cost (LKR) | Notes |
|----------|------|--------------------|-------|
| **Hetzner Cloud** (Germany/Helsinki) | CX22 – 2 vCPU / 4 GB RAM | ~LKR 3,500–4,500 | Best value, reliable |
| **DigitalOcean** | Basic Droplet – 2 vCPU / 4 GB RAM | ~LKR 5,500–6,500 | Good support, easy setup |
| **Vultr** | Cloud Compute – 2 vCPU / 4 GB RAM | ~LKR 5,000–6,000 | Good uptime |
| **Dialog Enterprise Cloud** (local SL) | Entry VM | ~LKR 8,000–12,000 | Local support, SL data residency |
| **Lanka Internet Services (LKNIC)** | VPS Basic | ~LKR 6,000–9,000 | Local provider, SL-based |

> **Recommendation:** Use **Hetzner CX22** (international) for best cost-performance, or **Dialog Enterprise** if data must reside in Sri Lanka.

#### Stage 1 Monthly Cost Breakdown (LKR)

| Item | Monthly Cost |
|------|-------------|
| VPS Server (Hetzner CX22) | LKR 4,000 |
| Domain + SSL (Let's Encrypt) | LKR 1,000 (domain annual ÷ 12) |
| Database (PostgreSQL) | Free |
| Email Notifications (SMTP/SendGrid free tier) | Free |
| Backup Storage (5 GB) | LKR 500 |
| **DOK CRM Maintenance & Support** | LKR 25,000–30,000 |
| Contingency / Miscellaneous | LKR 2,000 |
| **Total Estimated** | **LKR 32,500–37,500/month** |

> **Well within LKR 50,000 budget.** Remaining LKR 12,500–17,500 can go toward future upgrades or additional support hours.

---

### Stage 2 — Scaled Deployment (Sri Lanka Small Company, Multiple Users/Locations)

**Goal:** Host DOK CRM for 10–30 users across multiple branches or locations with better uptime and performance.

#### Recommended Database: PostgreSQL 15+ (Managed or Self-Hosted Cluster)

| Option | Cost | Notes |
|--------|------|-------|
| **Self-hosted PostgreSQL + daily backups** | Free | 1 primary + 1 replica VPS |
| **Supabase Pro** (managed PostgreSQL) | ~USD 25/month ≈ LKR 8,000 | Managed, automatic backups, dashboard |
| **DigitalOcean Managed DB** | ~USD 15–25/month ≈ LKR 5,000–8,000 | Zero maintenance, automatic failover |

> **Recommendation for Stage 2:** Use **Supabase Pro** or **DigitalOcean Managed PostgreSQL** to reduce maintenance overhead. Self-hosted PostgreSQL with replication is viable if a technical administrator is available.

#### Server Specifications (Stage 2)

| Component | Specification | Notes |
|-----------|---------------|-------|
| App Server | 2–4 vCPU / 8 GB RAM | Handles 10–30 concurrent users |
| DB Server | Managed PostgreSQL OR 2 vCPU / 4 GB RAM VPS | Separated from app server |
| Storage | 100 GB SSD | Larger dataset, logs, attachments |
| CDN | Cloudflare Free | Static asset caching, DDoS protection |
| OS | Ubuntu 22.04 LTS | |
| Load Balancer | Nginx / Cloudflare | Optional at this scale |
| Monitoring | UptimeRobot (free) | Uptime alerts |

#### Stage 2 Monthly Cost Breakdown (LKR)

| Item | Monthly Cost |
|------|-------------|
| App VPS (Hetzner CX32 – 4 vCPU / 8 GB) | LKR 7,500 |
| Managed PostgreSQL (Supabase Pro) | LKR 8,000 |
| Cloudflare Free (CDN + DDoS) | Free |
| Domain + SSL | LKR 1,000 |
| Backup Storage (20 GB) | LKR 1,500 |
| Email Service (SendGrid Essentials) | LKR 2,500 |
| **DOK CRM Maintenance & Support** | LKR 25,000–30,000 |
| Contingency / Miscellaneous | LKR 3,000 |
| **Total Estimated** | **LKR 48,500–53,500/month** |

> **Approximately at LKR 50,000 target.** To stay under budget, use self-hosted PostgreSQL (saves ~LKR 8,000) and reduce contingency — total drops to ~LKR 40,000–45,000/month.

---

### Summary Comparison

| | Stage 1 (Small — Internal) | Stage 2 (Scaled — Multi-branch) |
|--|---------------------------|----------------------------------|
| **Users** | 3–10 | 10–30 |
| **Database** | PostgreSQL (self-hosted) | Managed PostgreSQL (Supabase/DO) |
| **Server** | 2 vCPU / 4 GB RAM VPS | 4 vCPU / 8 GB RAM VPS |
| **Estimated Monthly** | LKR 32,500–37,500 | LKR 48,500–53,500 |
| **Oracle DB?** | ❌ Not recommended | ❌ Not recommended |
| **Firebase?** | ✅ Current stack, viable | ✅ Scalable, pay-as-you-go |
| **PostgreSQL?** | ✅ Best value | ✅ Best value |

### Option: Keep Firebase (Current Stack)

If migrating to PostgreSQL is not planned soon, **Firebase Firestore** (current DOK CRM stack) remains a valid option for Sri Lanka deployments:

- **Stage 1 Firebase cost:** Free tier covers up to ~50K reads/day — **LKR 0/month** for small usage
- **Stage 2 Firebase cost:** Blaze pay-as-you-go ~USD 5–20/month ≈ **LKR 1,500–6,500/month** depending on usage
- **No server management needed** — Firebase handles all infrastructure
- **Maintenance budget** can then be fully allocated to support and feature development

> **Bottom line for Sri Lanka small companies:** PostgreSQL + affordable VPS (Hetzner/DigitalOcean) is the most cost-effective path to move beyond Firebase. Oracle DB is not suitable at this budget level. Total infrastructure + maintenance comfortably fits within LKR 50,000/month.

---

*Appendix A prepared for Sri Lanka market — March 2026. Prices in LKR are approximate based on USD/LKR exchange rate ~325. Subject to change.*
