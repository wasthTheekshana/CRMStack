# DOK CRM - Sales Funnel System
## 2-Minute Presentation Script

---

### Opening (10 seconds)
"I'd like to present our new DOK CRM system - a modern, cloud-based sales pipeline management tool that replaces our Excel-based tracking with real-time collaboration and powerful analytics."

---

### System Overview (20 seconds)

**Live URL:** https://dok-crm.web.app

**Technology Stack:**
- React + TypeScript (Modern web framework)
- Firebase (Cloud database & hosting)
- Real-time data sync across all users

**User Roles:**
| Role | Access |
|------|--------|
| Admin | Full access to all data, team management, comparison reports |
| Sales | Own leads only, personal targets |

---

### Key Features (60 seconds)

#### 1. Admin Dashboard
- **KPI Cards:** Companies, Total Leads, Active Deals, Total Revenue, Weighted Revenue
- **Salesperson Filter:** View data for all reps or filter by individual salesperson
- **Visual Charts:** Pipeline by stage, Revenue by solution, Opportunity heatmap
- **Top Customers:** Top 5 customers by revenue
- **Revenue Forecasting:** Expected revenue this month/quarter, best case vs worst case scenarios
- **Customizable:** Hide/show any section based on preference

#### 2. Revenue Forecasting (NEW)
- **This Month:** Expected revenue from high-probability deals (50%+)
- **This Quarter:** Weighted forecast for current quarter
- **Best Case:** Total pipeline if all deals close
- **Worst Case:** Only high probability (75%+) deals
- **Stage Breakdown:** Visual chart showing pipeline vs weighted revenue by stage
- **Detailed Table:** Deals, pipeline, weighted revenue per stage

#### 3. Sales Pipeline (Kanban Board)
- **Drag & Drop:** Move deals between stages visually
- **5 Sales Stages:** Meeting Pending (25%) → Proposal Sent (50%) → Negotiated (75%) → Verbal Yes (90%) → Closed & Won (100%)
- **Validation:** Requires estimated revenue > 0 before moving to Proposal Sent
- **Admin Filter:** View pipeline by salesperson with real-time stats
- **Real-time Stats:** Deals count, Pipeline value, Weighted revenue

#### 4. Rep Comparison (Admin Only)
- **Company Totals:** Overall accounts, pipeline, weighted revenue
- **Individual Performance:** Each salesperson's contribution percentage
- **Leaderboards:** Rankings by accounts, volume, weighted value, win rate, avg deal size
- **Probability Analysis:** Deals grouped by probability buckets
- **Stage Analysis:** Deals breakdown by sales stage

#### 5. Sales Targets
- **Monthly Tracking:** Target vs Achievement for each salesperson
- **Over/Under Achievement:** Automatic calculation with percentage
- **Quarterly View (Admin):** Aggregated quarterly performance across all reps
- **Visual Charts:** Bar charts showing target vs achievement trends

#### 6. Analytics & Reports
- **Analytics Page:** Funnel chart, stage analysis, solution breakdown
- **Dynamic Filters:** Filter by stage and solution (auto-populated from actual data)
- **Reports:** Export data to CSV/PDF with filters
- **Leads Management:** Full CRUD operations with search and filters

#### 7. Additional Features
- **Dashboard Customization:** Users can show/hide sections and navigation items
- **Mobile Responsive:** Works on desktop, tablet, and mobile
- **Activities Tracking:** Log notes, calls, stage changes

---

### Data Security (15 seconds)
- Role-based access control (Sales see only their own data)
- Firebase security rules prevent unauthorized access
- Admin can view all data, sales users are restricted
- Secure authentication with email/password

---

### Benefits (15 seconds)

| Before (Excel) | After (DOK CRM) |
|----------------|-----------------|
| Manual updates | Real-time sync |
| No access control | Role-based security |
| Single user at a time | Multi-user collaboration |
| No mobile access | Works on any device |
| Basic calculations | Automated KPIs & analytics |
| Email for sharing | Instant cloud sync |
| No forecasting | Revenue predictions |

---

### Closing (10 seconds)
"This system streamlines our sales tracking, provides real-time visibility into our pipeline, predicts future revenue, and enables better decision-making with comprehensive analytics. It's live and ready to use at dok-crm.web.app"

---

## Quick Demo Flow (If showing live)

1. **Login as Admin** → Show dashboard with all KPIs
2. **Filter by Salesperson** → Show how data changes across all charts
3. **Revenue Forecasting** → Show expected revenue, best/worst case scenarios
4. **Sales Pipeline** → Filter by salesperson, drag a deal to show stage change
5. **Analytics** → Show filters working (stage & solution filters)
6. **Rep Comparison** → Show company totals and individual performance
7. **Dashboard Customizer** → Show hide/show functionality

---

## Login Credentials

| User | Email | Role |
|------|-------|------|
| Admin | dokadmin@gmail.com | Full access |
| Sales A | salesA@gmail.com | Own leads only |
| Sales B | salesB@gmail.com | Own leads only |

---

## Summary of Pages

| Page | Description | Access |
|------|-------------|--------|
| Dashboard | KPIs, charts, forecasting, top customers | All users |
| Sales Pipeline | Kanban board with salesperson filter | All users |
| Analytics | Funnel, charts, stage analysis with filters | All users |
| Leads | List view of all leads with CRUD | All users |
| Reports | Data export (CSV/PDF) with filters | All users |
| Sales Targets | Monthly target tracking | All users |
| Rep Comparison | Salesperson performance comparison | Admin only |
| Quarterly Targets | Quarterly performance overview | Admin only |
| Team Management | User management | Admin only |

---

## New Features Highlights

### Revenue Forecasting
The dashboard now includes a comprehensive revenue forecasting section:
- **Summary Cards:** Quick view of expected revenue for different scenarios
- **Stage Breakdown Chart:** Visual comparison of pipeline vs weighted revenue
- **Detailed Table:** Full breakdown by sales stage with probability

### Dynamic Solution Filters
All pages now use dynamic solution filtering:
- Filters automatically populate from actual data
- No mismatch between filter options and actual values
- Works across Analytics, Leads, and Reports pages

### Salesperson Filtering
Admin can filter data by salesperson on:
- Dashboard (all KPIs and charts update)
- Sales Pipeline (Kanban view with stats)

---

*Total Presentation Time: ~2 minutes*
