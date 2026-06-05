# DOK CRM — Improvement Roadmap

> Based on full codebase analysis — June 2026  
> Grouped by priority: fix first, high value, commercial launch blockers, future.

---

## Group 1: Fix First (Partially built — easy to complete)

These features have backend + partial frontend already done. Just need wiring up.

| # | Feature | What's missing |
|---|---|---|
| 1 | **Sales Rep Dashboard** | `SalesDashboard.tsx` is nearly empty. Needs: own pipeline summary, today's tasks, overdue follow-ups, targets vs actuals. |
| 2 | **Custom Lead Fields in Form** | Backend + admin settings UI exist. `LeadForm.tsx` doesn't dynamically render custom fields yet. |
| 3 | **Tenant Branding Applied in UI** | `BrandingSettings.tsx` saves data but sidebar/login page ignores `primaryColor` and `companyName`. |
| 4 | **Reports Export (PDF / CSV)** | `ReportsPage` has charts but no export button. Managers can see data but can't share it. |

---

## Group 2: High Value (Customers will ask for these)

| # | Feature | Why it matters |
|---|---|---|
| 5 | **Bulk Actions on Leads** | No bulk reassign, bulk stage change, or bulk delete. When a rep leaves, admin must reassign one by one. |
| 6 | **Lead Filtering & Saved Views** | All leads load and filter client-side. No way to save "My overdue leads" or "High-value proposals." Every visit starts from scratch. |
| 7 | **Email Send + Auto-Log** | Calls/emails are manually logged. Even basic "send email and auto-log it" via SMTP would save reps significant time. Email service infrastructure already exists. |

---

## Group 3: Before Commercial Launch (Must-haves for SaaS)

| # | Feature | Risk if missing |
|---|---|---|
| 8 | **License Enforcement** | Plans exist in DB but nothing enforced. A Starter tenant can add unlimited users. Must block at plan limits. |
| 9 | **Per-Tenant Pipeline & Field Customization (Phase 2)** | `PipelineSettings`, `ProductSettings`, `LeadFieldSettings` exist but need end-to-end verification and polish. |
| 10 | **Wildcard SSL + Subdomain Routing on Production** | New tenants can't get working subdomains without manual server config. Blocks self-serve onboarding. |

---

## Group 4: Bigger Features (Phase 2+)

| # | Feature | Notes |
|---|---|---|
| 11 | **Contact & Company Separation** | Currently one lead = one company + one contact. A proper CRM separates them: one Company → many Contacts → many Deals. |
| 12 | **Pipeline Automation** | Auto-move leads when a task is completed. Auto-notify when a deal is stuck in a stage too long. |
| 13 | **Two-Factor Authentication** | Enterprise customers will require 2FA before signing contracts. |
| 14 | **Webhook / Integration Layer** | Outbound webhooks to Slack, Zapier, or custom URLs when leads change stage or tasks become overdue. |

---

## Recommended Build Order

| Priority | Feature | Effort | Value |
|---|---|---|---|
| 1 | Sales Rep Dashboard | Small | High |
| 2 | Custom fields in lead form | Small | High |
| 3 | License enforcement | Small | Critical |
| 4 | Tenant branding applied in UI | Small | Medium |
| 5 | Bulk lead actions | Medium | High |
| 6 | Lead filtering / saved views | Medium | High |
| 7 | Reports export (PDF / CSV) | Medium | Medium |
| 8 | Per-Tenant Customization polish | Medium | High |
| 9 | Wildcard SSL + subdomain routing | Medium | Critical |
| 10 | Email send + auto-log | Large | High |
| 11 | Contact & Company separation | Large | High |
| 12 | Pipeline Automation | Large | Medium |
| 13 | Two-Factor Authentication | Medium | High |
| 14 | Webhook / Integration Layer | Large | Medium |

---

*Last updated: 2026-06-05*
