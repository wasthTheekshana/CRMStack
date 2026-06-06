# DOK CRM - Complete User Guide

> A comprehensive guide to every page, component, card, chart, and calculation in the DOK CRM system.

---

## Table of Contents

1. [Introduction & Overview](#1-introduction--overview)
2. [Login & Authentication](#2-login--authentication)
3. [Dashboard](#3-dashboard)
4. [Sales Pipeline (Kanban Board)](#4-sales-pipeline-kanban-board)
5. [Analytics Page](#5-analytics-page)
6. [Leads Page](#6-leads-page)
7. [Reports Page](#7-reports-page)
8. [Sales Targets](#8-sales-targets)
9. [Admin: Sales Performance (Rep Comparison)](#9-admin-sales-performance-rep-comparison)
10. [Admin: Quarterly Targets](#10-admin-quarterly-targets)
11. [Admin: Team Management](#11-admin-team-management)
12. [Profile & Security](#12-profile--security)
13. [Glossary of All Calculations & Formulas](#13-glossary-of-all-calculations--formulas)

---

## 1. Introduction & Overview

### What is DOK CRM?

DOK CRM is a sales pipeline management system built for DOK (Document Solutions). It helps the sales team track leads, manage deals through various stages, forecast revenue, and analyze sales performance.

### Currency

All monetary values are displayed in **LKR (Sri Lankan Rupee)**. Values are formatted as:
- Full format: `Rs. 1,000,000`
- Compact format: `1.0M` (millions) or `150K` (thousands)

### User Roles

| Role | Description | Access |
|------|-------------|--------|
| **Admin** | Sales Manager / Administrator | Full access to all pages including team management, rep comparison, quarterly targets, and all sales rep data |
| **Sales** | Sales Representative | Access to personal dashboard, pipeline, analytics, leads, reports, and personal sales targets. Can only see their own data |

### Sales Stages

Every deal/lead moves through the following stages (in order):

| Stage | Default Probability | Color | Description |
|-------|---------------------|-------|-------------|
| **On Hold** | 10% | Orange | Deal is paused or on hold |
| **Meeting Pending** | 25% | Blue | Initial contact, meeting yet to happen |
| **Proposal Sent** | 50% | Purple | Proposal/quote has been sent to the client |
| **Negotiated** | 75% | Light Purple | Terms are being negotiated |
| **Verbal Yes** | 90% | Pink | Client has verbally agreed |
| **Closed & Won** | 100% | Green | Deal is finalized and won |

### Solutions

The system tracks these solution types:
- Document Management
- Workflow Automation
- Digital Archiving
- Records Management
- Business Process Management
- Other

---

## 2. Login & Authentication

### Login Page

- **Username or Email**: Enter your username (case-insensitive) or email address
- **Password**: Your account password

### How Login Works

1. If you enter a username, the system converts it to the associated email address
2. Firebase authenticates your credentials
3. If your account is **deactivated**, you will be blocked from logging in
4. On successful login, you are redirected to the Dashboard

### Account Status

- **Active**: Can log in and use the system normally
- **Inactive/Deactivated**: Cannot log in. Contact your admin to reactivate

---

## 3. Dashboard

The Dashboard is the home page after login. Admins and Sales Reps see different views.

### Admin Dashboard Features
- Can filter data by selecting a specific salesperson (dropdown at the top)
- Sees company-wide data by default

### KPI Cards (Key Performance Indicators)

These are the summary cards at the top of the dashboard:

| Card | What It Shows | How It's Calculated |
|------|---------------|---------------------|
| **Companies** | Number of unique companies in the pipeline | Count of distinct company names across all leads |
| **Total Leads** | Total number of leads/deals | Simple count of all leads |
| **Active Deals** | Deals still in progress | Count of leads where stage is NOT "Closed & Won" |
| **Total Revenue** | Total pipeline value | Sum of `Estimated Revenue` from all leads |
| **Weighted Revenue** | Probability-adjusted revenue | Sum of (`Estimated Revenue` x `Probability` / 100) for each lead |

> **Example - Weighted Revenue:**
> If you have a deal worth Rs. 1,000,000 at 50% probability, its weighted revenue is Rs. 500,000.
> This gives a more realistic view of expected income.

### Charts on the Dashboard

#### Pipeline by Stage (Bar Chart)
- **What it shows**: Number of deals in each sales stage
- **X-axis**: Deal count
- **Y-axis**: Stage names
- **Colors**: Each bar uses the stage's assigned color
- **Purpose**: Shows where your deals are concentrated in the pipeline

#### Revenue by Solution (Pie/Donut Chart)
- **What it shows**: How revenue is distributed across different solution types
- **Calculation**: Groups leads by solution, sums their estimated revenue
- **Details**: Shows top 6 solutions; remaining are grouped as "Others"
- **Legend**: Shows solution name, revenue amount, and percentage of total
- **Percentage formula**: `(Solution Revenue / Total Revenue) x 100`

#### Opportunity Heatmap (Bubble Chart)
- **What it shows**: Each lead plotted by probability and revenue
- **X-axis**: Probability (0-100%)
- **Y-axis**: Estimated Revenue (in LKR)
- **Bubble size**: Proportional to estimated revenue (bigger bubble = bigger deal)
- **Bubble color**: Based on the lead's current sales stage color
- **Hover tooltip**: Shows company name, stage, revenue, and probability
- **Purpose**: Quickly identify high-value, high-probability opportunities (top-right corner is ideal)

#### Top Customers
- **What it shows**: Top 5 companies ranked by total estimated revenue
- **Display**: Company name, revenue amount, and a progress bar
- **Progress bar**: Shows each company's revenue as a percentage of the highest revenue company
- **Calculation**: `Bar Width = (Company Revenue / Max Company Revenue) x 100`

#### Recent Activities
- **What it shows**: Last 5 activities in the system
- **Activity types and icons**:
  - Note (blue message icon)
  - Stage Change (purple arrow icon)
  - Call (green phone icon)
  - Email (orange mail icon)
  - Meeting (pink calendar icon)
- **Display**: Activity description + relative time (e.g., "2 hours ago")
- **Admin**: Sees all activities across all reps
- **Sales Rep**: Sees only their own activities

#### Revenue by Stage (Bar Chart)
- **What it shows**: Total estimated revenue in each sales stage
- **X-axis**: Revenue (formatted in compact form: M, K)
- **Y-axis**: Stage names
- **Purpose**: Shows where the money is concentrated in the pipeline

### Revenue Forecasting Section

This section provides different forecast scenarios for your pipeline:

| Card | What It Means | Calculation |
|------|---------------|-------------|
| **Expected This Month** | Revenue likely to close this month | Sum of (Revenue x Probability / 100) for deals with probability >= 50% |
| **Expected This Quarter** | Total weighted pipeline for the quarter | Sum of (Revenue x Probability / 100) for ALL active deals |
| **Best Case** | Maximum possible revenue | Sum of Revenue for ALL active deals (assumes everything closes at 100%) |
| **Worst Case** | Minimum expected revenue | Sum of (Revenue x Probability / 100) only for deals with probability >= 75% |

**Stats Bar:**
- **Total Pipeline**: Sum of all active deal revenues (not "Closed & Won")
- **Closed Won**: Sum of revenue for deals in "Closed & Won" stage
- **Active Deals**: Count of deals not in "Closed & Won"

**Stage Breakdown Chart (in Forecast section):**
- Bar chart showing Pipeline (full revenue) vs Weighted Revenue per stage
- Tooltip shows deal count per stage

**Stage Details Table:**
- Columns: Stage, Deals (count), Pipeline (full revenue), Weighted (probability-adjusted), Probability %

### Dashboard Customizer

Click the settings/gear icon to customize which cards and sections are visible on your dashboard:

**Customizable KPI Cards:**
- Companies, Total Leads, Active Deals, Total Revenue, Weighted

**Customizable Sections:**
- Pipeline by Stage, Revenue by Solution, Opportunity Heatmap, Top Customers, Recent Activities, Revenue by Stage, Revenue Forecasting

**Navigation Items (Admin only):**
- Sales Targets (show/hide in sidebar)
- Quarterly Targets (show/hide in sidebar)

Settings are saved per user and persist across sessions.

---

## 4. Sales Pipeline (Kanban Board)

The Sales Pipeline page displays all your deals as cards organized in columns by sales stage.

### Pipeline Stats Bar

At the top of the pipeline, you'll see:

| Stat | Meaning | Calculation |
|------|---------|-------------|
| **Total Deals** | Number of deals displayed | Count of all leads shown |
| **Pipeline Value** | Total unweighted revenue | Sum of all Estimated Revenue |
| **Weighted Value** | Probability-adjusted revenue | Sum of (Estimated Revenue x Probability / 100) |

### Kanban Columns

Each column represents a sales stage (On Hold, Meeting Pending, Proposal Sent, Negotiated, Verbal Yes, Closed & Won). The column header shows the stage name with its assigned color.

### Deal Cards

Each card shows:
- **Company Name** (with building icon)
- **Solution** (small text below company name)
- **Estimated Revenue** (formatted in LKR)
- **Probability %** with a color-coded progress bar:
  - Red: < 30% (High Risk)
  - Yellow: 30-60% (Medium Risk)
  - Green: > 60% (Low Risk)

### Drag and Drop

**Moving between stages (Horizontal Drag):**
- Drag a card from one column to another to change its sales stage
- The probability will automatically update to the new stage's default value
- An activity log entry is created: "Stage changed from [old] to [new]"
- **Validation**: Moving to "Proposal Sent" requires Estimated Revenue > 0

**Reordering within a stage (Vertical Drag):**
- Drag a card up or down within the same column to prioritize
- Cards at the top are considered higher priority
- Position is saved and persists across sessions

### Deal Modal (Edit a Deal)

Click on any card to open the Deal Modal for editing:

| Field | Description | Rules |
|-------|-------------|-------|
| **Company Name** | Name of the company/client | Required |
| **Solution** | Solution type being offered | Required dropdown |
| **Contacts** | Contact persons at the company | At least 1 required; each needs a name; one must be marked Primary |
| **Sales Stage** | Current deal stage | Changing this auto-updates probability |
| **Estimated Revenue** | Expected deal value (LKR) | Must be > 0 for "Proposal Sent" stage |
| **Probability** | Likelihood of closing (0-100%) | Slider in 5% increments |
| **Image Count** | Number of images (product-specific) | Minimum 0 |
| **Box Count** | Number of boxes (product-specific) | Minimum 0 |
| **Remarks** | Internal notes about the deal | Optional |
| **H/O Update** | Head Office update notes | Optional |

**Contact Management:**
- Click "Add Contact" to add more contact persons
- Each contact has: Name, Phone, Email, Designation
- Click the star icon to mark a contact as Primary
- The primary contact is displayed prominently on lead cards
- Click the trash icon to remove a contact (minimum 1 required)

**Admin-only**: The Delete button is visible only to admin users.

---

## 5. Analytics Page

The Analytics page provides detailed visual analysis of your sales data.

### Filters

- **Sales Stage**: Filter data by specific stage (or "All Stages")
- **Solution**: Filter data by solution type (or "All Solutions")
- **Clear**: Button to reset all filters

All charts and tables below respond to the selected filters.

### Summary Stats Cards

| Card | Description | Calculation |
|------|-------------|-------------|
| **Total Leads** | Number of leads matching filters | Count of filtered leads |
| **Pipeline Value** | Total estimated revenue | Sum of Estimated Revenue for filtered leads |
| **Weighted Value** | Probability-adjusted value | Sum of (Revenue x Probability / 100) |
| **Avg Probability** | Average deal probability | Sum of all probabilities / number of leads |

### Charts

#### Sales Funnel
- **What it shows**: Deal count flowing through each stage, displayed as a funnel shape
- **Data**: Number of deals in each stage
- **Colors**: Stage-specific colors
- **Purpose**: Visualize pipeline flow and identify bottlenecks (stages where deals get stuck)

#### Deals by Stage (Bar Chart)
- **What it shows**: Horizontal bar chart with deal counts per stage
- **Colors**: Each bar matches the stage color
- **Purpose**: Quick comparison of deal distribution across stages

#### Revenue by Solution (Donut Chart)
- **What it shows**: Revenue breakdown by solution type
- **Top 6 + Others**: Groups smaller solutions into "Others"
- **Legend**: Shows solution name, revenue, and percentage
- **Percentage**: `(Solution Revenue / Total Revenue) x 100`

#### Revenue by Stage (Bar Chart)
- **What it shows**: Total estimated revenue in each stage
- **Purpose**: Identify which stages hold the most revenue value

#### Opportunity Distribution (Bubble Chart)
- **What it shows**: Every lead plotted on a scatter chart
- **X-axis**: Probability (0-100%)
- **Y-axis**: Estimated Revenue
- **Bubble size**: Based on revenue value
- **Bubble color**: Stage-specific color
- **Purpose**: Visual overview of all opportunities by size, probability, and stage

### Stage Analysis Table

A detailed breakdown table with the following columns:

| Column | Description | Calculation |
|--------|-------------|-------------|
| **Stage** | Sales stage name | - |
| **Deals** | Number of deals | Count of leads in stage |
| **Revenue** | Total estimated revenue | Sum of Estimated Revenue in stage |
| **Weighted** | Probability-adjusted revenue | Sum of (Revenue x Probability / 100) in stage |
| **% Pipeline** | Stage's share of total pipeline | `(Stage Revenue / Total Revenue) x 100` |

---

## 6. Leads Page

The Leads page shows all your leads in a grid/card layout.

### Search & Filters

- **Search**: Searches across company name, contact name, and solution
- **Stage Filter**: Filter by specific sales stage
- **Solution Filter**: Filter by solution type

### Lead Cards

Each lead card displays:
- **Company Name** with building icon
- **Solution** type
- **Primary Contact**: Name and phone number
- **Sales Stage**: Color-coded badge
- **Estimated Revenue**: Formatted in LKR
- **Probability**: Percentage with a color-coded progress bar

### Risk Level Color Coding

The probability bar on each card uses colors to indicate risk:

| Probability | Risk Level | Color |
|-------------|------------|-------|
| Below 30% | High Risk | Red |
| 30% - 60% | Medium Risk | Yellow |
| Above 60% | Low Risk | Green |

### Actions
- Click any card to open the Deal Modal for editing
- Use the "New Lead" button to create a new lead

---

## 7. Reports Page

The Reports page provides a tabular view of leads with export capabilities.

### Filters
- **Search**: Filter by company name, contact, or solution
- **Stage**: Filter by sales stage
- **Solution**: Filter by solution type

### Export Options

#### Export to CSV
- Downloads a `.csv` file with all filtered leads
- File name format: `leads-export-YYYY-MM-DD.csv`
- Columns: Company Name, Solution, Contact Name, Contact Number, Sales Stage, Image Count, Box Count, Estimated Revenue, Probability (%), Weighted Revenue, Remarks, H/O Update, Owner, Created Date, Updated Date

#### Export to PDF
- Downloads a `.pdf` report with DOK CRM branding
- Includes:
  - Report header with title
  - Summary statistics (Total Leads, Total Revenue, Weighted Revenue, Avg Probability)
  - Applied filters description
  - Data table with all leads

### Report Summary Cards

| Card | Calculation |
|------|-------------|
| **Total Records** | Count of filtered leads |
| **Total Revenue** | Sum of Estimated Revenue |
| **Weighted Revenue** | Sum of (Revenue x Probability / 100) |
| **Avg Probability** | Sum of probabilities / count of leads |

### Report Table Columns

| Column | Description |
|--------|-------------|
| **Company** | Company name |
| **Solution** | Solution type |
| **Contact** | Primary contact name and phone |
| **Stage** | Sales stage (color-coded badge) |
| **Revenue** | Estimated Revenue (LKR) |
| **Probability** | Deal probability percentage |
| **Weighted Revenue** | Revenue x Probability / 100 |

---

## 8. Sales Targets

The Sales Targets page allows each salesperson to set and track monthly revenue targets.

### Year Selector
- Choose the year to view targets (previous year, current year, or next year)

### Summary Cards

| Card | Description | Calculation |
|------|-------------|-------------|
| **Yearly Target** | Total target for the selected year | Sum of all monthly targets |
| **Yearly Achievement** | Total achieved for the selected year | Sum of all monthly achievements |
| **Yearly Variance** | Difference between achievement and target | `Achievement - Target` |
| **Achievement Rate** | Percentage of target achieved | `(Achievement / Target) x 100` |

**Variance Color Coding:**
- Green: Positive variance (exceeded target)
- Red: Negative variance (below target)

### Monthly Breakdown Table

| Column | Description |
|--------|-------------|
| **Month** | Month name (January - December) |
| **Target** | Monthly sales target (LKR) |
| **Achievement** | Actual sales achieved (LKR) |
| **Variance** | `Achievement - Target` |
| **%** | `(Achievement / Target) x 100` |
| **Actions** | Edit or delete the target entry |

**Percentage Color Coding:**
| Range | Color | Meaning |
|-------|-------|---------|
| >= 100% | Green | Target met or exceeded |
| 75% - 99% | Yellow | Close to target |
| < 75% | Red | Significantly below target |

### Add/Edit Target

When adding or editing a target:
- **Year**: Select the year
- **Month**: Select the month
- **Target**: Enter the sales target amount (LKR)
- **Achievement**: Enter the actual achievement amount (LKR)
- **Live Preview**: Shows calculated Variance and Percentage before saving

**Rule**: You cannot create two targets for the same year + month combination.

---

## 9. Admin: Sales Performance (Rep Comparison)

> This page is available to **Admin users only**.

This page compares performance across all sales representatives.

### Company Total Card

Shows aggregated metrics for the entire company:

| Metric | Calculation |
|--------|-------------|
| **Total Accounts** | Sum of all reps' lead counts |
| **Total Pipeline** | Sum of all reps' estimated revenue |
| **Weighted Revenue** | Sum of all reps' weighted revenue |
| **Closed Won** | Sum of all reps' closed & won deals count |
| **Active Deals** | Sum of all reps' active deal counts |

### Per-Rep Performance Cards

Each sales rep has a summary card showing:

| Metric | Calculation |
|--------|-------------|
| **Revenue Contribution %** | `(Rep Revenue / Company Total Revenue) x 100` |
| **Accounts** | Count of the rep's leads |
| **Account Contribution %** | `(Rep Accounts / Company Total Accounts) x 100` |
| **Pipeline** | Sum of rep's estimated revenue |
| **Weighted** | Sum of (Revenue x Probability / 100) for rep's leads |
| **Avg Deal** | `Rep Total Revenue / Rep Lead Count` |
| **Won badge** | Count of "Closed & Won" deals |
| **Active badge** | Count of non-"Closed & Won" deals |

A trophy icon appears next to the rep with the highest pipeline volume.

### Comparison Tab

#### Account Count Comparison (Bar Chart)
- Horizontal bar chart comparing total account counts per rep
- Each bar colored uniquely per rep

#### Volume Comparison (Bar Chart)
- Side-by-side comparison of:
  - **Pipeline** (full estimated revenue - blue)
  - **Weighted** (probability-adjusted revenue - green)

#### Overall Performance Radar Chart
- Spider/radar chart with 6 dimensions comparing all reps:

| Dimension | What It Measures | Calculation |
|-----------|-----------------|-------------|
| **Accounts** | Lead count relative to max | `(Rep Accounts / Max Rep Accounts) x 100` |
| **Pipeline** | Revenue relative to max | `(Rep Revenue / Max Rep Revenue) x 100` |
| **Weighted** | Weighted revenue relative to max | `(Rep Weighted / Max Rep Weighted) x 100` |
| **Avg Deal** | Average deal size relative to max | `(Rep Avg Deal / Max Rep Avg Deal) x 100` |
| **Win Rate** | Percentage of deals won | `(Closed Won Count / Total Leads) x 100` |
| **Avg Prob** | Average probability across deals | `Sum of probabilities / Lead Count` |

> All dimensions are normalized to 0-100 scale for fair comparison.

### Leaderboard Tab

Five ranking categories, each showing reps ordered from best to worst:

| Leaderboard | Ranked By |
|-------------|-----------|
| **By Account Count** | Total number of leads (most = #1) |
| **By Pipeline Volume** | Total estimated revenue (highest = #1) |
| **By Weighted Value** | Total weighted revenue (highest = #1) |
| **By Avg Deal Size** | Average deal size (highest = #1) |
| **By Win Rate** | `(Closed Won / Total Leads) x 100` (highest = #1) |

Medal colors: Gold (#1), Silver (#2), Bronze (#3)

### Probability Tab

#### Probability Buckets

Deals are grouped into 6 probability ranges:

| Bucket | Range | Color |
|--------|-------|-------|
| **<= 10%** | 0% - 10% | Orange |
| **11-25%** | 11% - 25% | Red |
| **26-50%** | 26% - 50% | Yellow |
| **51-75%** | 51% - 75% | Blue |
| **76-90%** | 76% - 90% | Purple |
| **91-100%** | 91% - 100% | Green |

#### Deals by Probability (Bar Chart)
- Grouped bar chart: each probability bucket shows bars for each rep
- Y-axis: Number of deals

#### Revenue by Probability (Bar Chart)
- Same grouping as above but showing revenue instead of count
- Y-axis: Revenue (LKR)

#### Probability Summary Cards
- 6 cards (one per bucket) showing:
  - Total deals across all reps in that bucket
  - Total revenue across all reps in that bucket

#### Probability Breakdown Details Table

| Column | Description |
|--------|-------------|
| **Probability** | Bucket label (e.g., "<=10%") with color dot |
| **Per-Rep: Deals** | Number of deals the rep has in this bucket |
| **Per-Rep: Revenue** | Total estimated revenue for the rep in this bucket |
| **Per-Rep: Weighted** | Sum of (Revenue x Probability / 100) for the rep in this bucket |
| **Total Row** | Sums across all buckets per rep |

### Stages Tab

#### Deals by Stage (Bar Chart)
- Grouped bar chart: each stage shows bars for each rep
- Shows deal count per stage per rep

#### Stage Breakdown Details Table

| Column | Description |
|--------|-------------|
| **Stage** | Stage name with color dot |
| **Per-Rep: Deals** | Number of deals the rep has in this stage |
| **Per-Rep: Revenue** | Total estimated revenue for the rep in this stage |
| **Total Row** | Sums across all stages per rep |

---

## 10. Admin: Quarterly Targets

> This page is available to **Admin users only**.

This page shows a company-wide view of sales targets organized by quarter.

### Year Selector
- Choose the year to view quarterly data

### Yearly Summary Cards

| Card | Calculation |
|------|-------------|
| **Yearly Target** | Sum of all sales reps' targets for the year |
| **Yearly Achievement** | Sum of all sales reps' achievements for the year |
| **Yearly Variance** | `Total Achievement - Total Target` |
| **Achievement Rate** | `(Total Achievement / Total Target) x 100` |

### Quarterly Performance Chart
- Bar chart comparing **Target** vs **Achievement** for each quarter (Q1-Q4)
- Side-by-side bars for easy comparison

### Quarter Grouping

| Quarter | Months Included |
|---------|----------------|
| **Q1** | January, February, March |
| **Q2** | April, May, June |
| **Q3** | July, August, September |
| **Q4** | October, November, December |

### Quarterly Tabs (Q1 - Q4)

Each quarter tab shows:

**Quarter Summary Header:**
- Quarter Target (sum of 3 months' targets)
- Quarter Achievement (sum of 3 months' achievements)
- Variance and Percentage

**Sales Rep Table per Quarter:**

| Column | Description |
|--------|-------------|
| **Rep Name** | Salesperson's display name |
| **Target** | Sum of rep's targets for the 3 months in the quarter |
| **Achievement** | Sum of rep's achievements for the 3 months |
| **Variance** | `Achievement - Target` |
| **%** | `(Achievement / Target) x 100` |

**Total Row**: Company-wide totals for each column.

---

## 11. Admin: Team Management

> This page is available to **Admin users only**.

### Summary Cards

| Card | Description |
|------|-------------|
| **Total Salespeople** | Count of all users with "sales" role |
| **Active** | Count of active sales users |
| **Inactive** | Count of deactivated sales users |

### Sales Team List

Each salesperson entry shows:
- **Avatar**: Circle with initials (e.g., "JD" for John Doe)
- **Name & Username**: Display name and @username
- **Status Badge**: Green "Active" or Red "Inactive"
- **Email**: Contact email
- **Lead Count**: Number of leads assigned to this rep
- **Actions**:
  - **Reassign** button (if rep has leads)
  - **Activate/Deactivate** toggle button

### Add Salesperson

Creates a new sales rep account:

| Field | Rules |
|-------|-------|
| **Full Name** | Required, display name |
| **Username** | Required, 3+ characters, alphanumeric + underscores only, must be unique (case-insensitive) |
| **Email** | Required, valid email format, must be unique |
| **Password** | Required, minimum 6 characters |

### Reassign Leads

When a salesperson is leaving or being deactivated:
1. Click "Reassign" on their entry
2. Select the target salesperson from the dropdown
3. Confirm the reassignment
4. All leads from the original rep are transferred to the target rep
5. Both `ownerId` and `ownerEmail` are updated on every lead

### Activate / Deactivate

- **Deactivate**: Prevents the user from logging in. A warning is shown if the user has active leads (reassign them first).
- **Activate**: Re-enables login access for the user.

---

## 12. Profile & Security

### Profile Tab
- **Display Name**: Editable - change your name shown in the system
- **Email**: Read-only display
- **Role**: Read-only badge (Admin or Sales)
- **Member Since**: Account creation date

### Security Tab (Change Password)

| Field | Rules |
|-------|-------|
| **Current Password** | Required for verification |
| **New Password** | Required, minimum 6 characters, must differ from current |
| **Confirm Password** | Must match new password exactly |

---

## 13. Glossary of All Calculations & Formulas

### Revenue Calculations

| Calculation | Formula | Example |
|-------------|---------|---------|
| **Total Revenue** | `SUM(Estimated Revenue)` for all leads | 3 deals at Rs.100K, Rs.200K, Rs.300K = Rs.600K |
| **Weighted Revenue** | `SUM(Estimated Revenue x Probability / 100)` | Rs.100K at 50% + Rs.200K at 75% = Rs.50K + Rs.150K = Rs.200K |
| **Closed Won Revenue** | `SUM(Revenue)` where stage = "Closed & Won" | Only includes finalized deals |
| **Pipeline Value** | `SUM(Revenue)` for active deals (not "Closed & Won") | Excludes already-won deals |

### Probability & Risk

| Calculation | Formula |
|-------------|---------|
| **Average Probability** | `SUM(all probabilities) / Number of Leads` |
| **Default Probability** | Auto-assigned based on sales stage (see Stage table above) |
| **Risk Level** | < 30% = High (Red), 30-60% = Medium (Yellow), > 60% = Low (Green) |

### Performance Metrics

| Calculation | Formula | Used In |
|-------------|---------|---------|
| **Win Rate** | `(Closed Won Count / Total Leads) x 100` | Rep Comparison |
| **Average Deal Size** | `Total Revenue / Number of Leads` | Rep Comparison |
| **Revenue Contribution %** | `(Rep Revenue / Company Revenue) x 100` | Rep Comparison |
| **Account Contribution %** | `(Rep Accounts / Company Accounts) x 100` | Rep Comparison |

### Forecast Scenarios

| Scenario | Formula | Meaning |
|----------|---------|---------|
| **Expected This Month** | `SUM(Revenue x Prob / 100)` for deals with Probability >= 50% | Revenue likely to close this month |
| **Expected This Quarter** | `SUM(Revenue x Prob / 100)` for ALL active deals | Full weighted pipeline forecast |
| **Best Case** | `SUM(Revenue)` for ALL active deals | If everything closes at 100% |
| **Worst Case** | `SUM(Revenue x Prob / 100)` for deals with Probability >= 75% | Only high-confidence deals |

### Target Metrics

| Calculation | Formula |
|-------------|---------|
| **Variance** | `Achievement - Target` |
| **Achievement Rate %** | `(Achievement / Target) x 100` |
| **Yearly Total** | Sum of all 12 months' targets or achievements |
| **Quarterly Total** | Sum of 3 months' targets or achievements |

### Chart-Specific Calculations

| Chart | Calculation |
|-------|-------------|
| **Solution Pie Chart %** | `(Solution Revenue / Total Revenue) x 100` |
| **Pipeline % (Stage Analysis)** | `(Stage Revenue / Total Revenue) x 100` |
| **Top Customers Progress Bar** | `(Company Revenue / Max Company Revenue) x 100` |
| **Radar Chart (normalized)** | Each dimension: `(Rep Value / Max Value Among All Reps) x 100` |
| **Percentage Change** | `((Current - Previous) / Previous) x 100` |

### Probability Buckets (Rep Comparison)

| Bucket | Range | Includes |
|--------|-------|----------|
| <= 10% | 0 - 10 | On Hold deals (10% probability) |
| 11-25% | 11 - 25 | Meeting Pending deals (25% probability) |
| 26-50% | 26 - 50 | Proposal Sent deals (50% probability) |
| 51-75% | 51 - 75 | Negotiated deals (75% probability) |
| 76-90% | 76 - 90 | Verbal Yes deals (90% probability) |
| 91-100% | 91 - 100 | Closed & Won deals (100% probability) |

---

## Quick Reference: What Does Each Number Mean?

| Term | Simple Explanation |
|------|-------------------|
| **Estimated Revenue** | How much money you expect from this deal if it closes |
| **Probability** | How likely (0-100%) you think this deal will close |
| **Weighted Revenue** | Revenue adjusted for probability. A Rs.1M deal at 50% probability = Rs.500K weighted |
| **Pipeline Value** | Total of all estimated revenues (not adjusted for probability) |
| **Win Rate** | Percentage of all deals that were successfully closed |
| **Average Deal Size** | Your average revenue per deal |
| **Variance** | Difference between what was achieved vs what was targeted. Positive = exceeded target |
| **Active Deals** | Deals that are still being worked on (not yet Closed & Won) |

---

*This guide covers all features of DOK CRM as of February 2026. For technical support, contact your system administrator.*
