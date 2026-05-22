# DOK CRM — User Guide

**Version:** 1.0  
**Support:** support@crmstack.com  
**Access your CRM:** `https://yourcompany.crmstack.site`

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Leads](#3-leads)
4. [Pipeline (Kanban Board)](#4-pipeline-kanban-board)
5. [Analytics](#5-analytics)
6. [Reports](#6-reports)
7. [Sales Targets](#7-sales-targets)
8. [Notifications](#8-notifications)
9. [Admin — Team Management](#9-admin--team-management)
10. [Admin — Workspace Settings](#10-admin--workspace-settings)
11. [Profile & Password](#11-profile--password)
12. [Roles & Permissions](#12-roles--permissions)
13. [FAQ](#13-faq)

---

## 1. Getting Started

### Logging In

1. Open your company's CRM URL — e.g. `https://acme.crmstack.site`
2. Enter your **username** and **password**
3. Click **Sign In**

> Your login URL is unique to your company. Using `crmstack.site` directly will not work — you must use your subdomain.

### Forgot Password

1. On the login page click **Forgot password?**
2. Enter the email address linked to your account
3. Check your inbox for a reset link (expires in 1 hour)
4. Click the link and set a new password

### Trial Banner

If your company is on a free trial, a banner at the top of every page shows how many days remain. When it turns red your trial is ending soon. Contact support to upgrade before it expires.

---

## 2. Dashboard

The Dashboard gives you an at-a-glance view of your sales performance.

### KPI Cards

| Card | What it shows |
|---|---|
| Total Leads | All active leads in the system |
| Revenue Forecast | Sum of estimated revenue × probability |
| Won This Quarter | Closed & Won deals in the current quarter |
| Conversion Rate | % of leads that reached a Won stage |

### Widgets

- **Revenue Forecast** — bar chart showing expected revenue by stage
- **Top Customers** — leads with the highest estimated revenue
- **Recent Activities** — latest actions taken on any lead

### Customising Your Dashboard (Admin)

Admins can click the **Customise** button to show or hide widgets and reorder them to match your team's priorities.

---

## 3. Leads

The Leads page is your master list of all deals.

### Adding a Lead

1. Click **+ New Lead**
2. Fill in the required fields:
   - **Company Name** — the client company
   - **Solution** — which product/service they are interested in
   - **Sales Stage** — current stage in your pipeline
   - **Estimated Revenue** — expected deal value
   - **Probability (%)** — your confidence of closing (0–100)
3. Add one or more **contacts** — name, phone, email. Mark the primary contact.
4. Optionally add **Remarks** or **HO Update**
5. Click **Save**

### Editing a Lead

Click any lead row to open the detail view. Make your changes and click **Save**.

### Deleting a Lead

Open the lead detail, scroll to the bottom and click **Delete**. Deleted leads move to the Recycle Bin and can be restored by an admin.

### Searching & Filtering

Use the search bar to find leads by company name or contact name. Use the filter panel to narrow by:

- **Stage** — e.g. show only Proposal Sent
- **Solution** — e.g. show only a specific product line
- **Age** (admin) — leads older than 30 / 60 / 90 days
- **Expiry** (admin) — leads expiring soon or already expired

### Lead Age & Expiry Badges

Each lead card shows two badges:

- **Age badge** — how long the lead has been in the system (green → yellow → red as it ages)
- **Expiry badge** — if a lead has been in the same stage too long, it will be flagged as expiring. Admins receive a notification and the lead is highlighted.

### Importing Leads from Excel

1. Click **Import** (upload icon in the toolbar)
2. **Step 1** — download the template, fill it in, then upload your `.xlsx` file
3. **Step 2** — preview the data and fix any errors shown
4. **Step 3** — confirm the import. Successfully imported leads appear immediately.

### Reassigning a Lead (Admin)

Open the lead detail and use the **Owner** dropdown to reassign it to another sales rep.

---

## 4. Pipeline (Kanban Board)

The Pipeline page shows all your leads as cards arranged in columns by sales stage. It is the visual way to manage deals.

### Moving a Deal

Drag a card from one column to another to change its stage. The change is saved immediately.

### Reordering Cards

Within a column, drag cards up or down to change their display order.

### Filtering by Sales Rep (Admin)

Use the **Sales Rep** dropdown at the top to view only that person's deals, or select **All** to see the full pipeline.

### Opening a Deal

Click any card to open the deal detail panel where you can edit all fields, add contacts, and log remarks.

---

## 5. Analytics

The Analytics page gives you visual insights into your pipeline and revenue.

### Charts Available

| Chart | What it shows |
|---|---|
| **Pipeline Chart** | Deal count and revenue value by stage |
| **Revenue by Solution** | Pie chart — which solutions make up your revenue. Click a slice to see the individual leads underneath |
| **Bubble Chart** | Each lead plotted by probability vs. revenue — helps spot high-value, high-confidence deals |
| **Funnel Chart** | Conversion drop-off from top of pipeline to close |

### Filters

Use the **Filter** panel to scope all charts to a specific stage or solution. Toggle **Include Closed & Won** to include or exclude completed deals from the view.

---

## 6. Reports

The Reports page provides tabular data exports and summaries.

- Filter by date range, stage, and solution
- View aggregated revenue and lead counts
- Download data as CSV for use in Excel

---

## 7. Sales Targets

### Setting Targets (Admin)

1. Go to **Sales Targets** from the sidebar
2. Select the **Quarter** and **Year**
3. Enter a target revenue amount per sales rep
4. Click **Save**

### Viewing Progress

Each rep can see their own target vs. actual revenue for the current quarter on the Sales Targets page. Admins see all reps.

### Quarterly Comparison (Admin)

The **Quarterly Targets** view shows side-by-side performance across quarters.

### Rep Comparison (Admin)

The **Rep Comparison** view ranks all sales reps by revenue, win rate, and lead count.

---

## 8. Notifications

The bell icon in the top navigation shows real-time alerts for:

- A lead has been assigned to you
- A lead you own is expiring soon
- A lead has been updated by another team member

Click a notification to jump directly to that lead. Mark individual notifications as read, or clear all at once.

---

## 9. Admin — Team Management

> Available to **Admin** role only.

### Inviting a Team Member

1. Go to **Team Management** from the sidebar
2. Click **Add User**
3. Enter their name, email, username, password, and role (Admin or Sales)
4. Click **Create**

The new user can log in immediately at your company subdomain URL.

### Editing a Team Member

Click the pencil icon next to any user to update their name, email, or role.

### Deactivating a User

Toggle the user's status to **Inactive**. They can no longer log in but their leads remain in the system.

### Reassigning All Leads

When deactivating a user you can choose to **Reassign all their leads** to another team member in one step.

---

## 10. Admin — Workspace Settings

> Available to **Admin** role only.

### Pipeline Stages

Add, rename, reorder or remove the stages in your sales pipeline. All leads and the kanban board update immediately.

### Products / Solutions

Manage the list of solutions (products or services) your team can assign to leads. Add new ones or deactivate old ones.

### Lead Fields

Add custom fields to the lead form (text, number, dropdown, date). These appear on every lead and can be used for filtering.

### Branding

Upload your company logo and set a primary colour. This is displayed across the CRM interface for your team.

---

## 11. Profile & Password

Click your **avatar / name** in the top-right corner and select **Profile**.

- Update your display name
- Change your password — enter your current password and then the new one (minimum 6 characters)

---

## 12. Roles & Permissions

| Feature | Sales Rep | Admin |
|---|---|---|
| View own leads | ✅ | ✅ |
| View all leads | — | ✅ |
| Create / edit leads | ✅ | ✅ |
| Delete leads | — | ✅ |
| Reassign leads | — | ✅ |
| Import leads | ✅ | ✅ |
| View pipeline | ✅ | ✅ |
| Filter pipeline by rep | — | ✅ |
| View analytics | ✅ | ✅ |
| View reports | ✅ | ✅ |
| Set sales targets | — | ✅ |
| Manage team members | — | ✅ |
| Workspace settings | — | ✅ |
| View deleted leads | — | ✅ |

---

## 13. FAQ

**Q: I cannot log in — it says "Please log in via your company subdomain".**  
A: You are visiting `crmstack.site` directly. Use your company-specific URL, e.g. `https://acme.crmstack.site`.

**Q: I forgot my username.**  
A: Contact your company admin — they can see all usernames in Team Management.

**Q: I imported leads but some are missing.**  
A: The import preview (Step 2) shows any rows with errors. Common issues are a missing Company Name or an invalid Sales Stage value. Fix the Excel file and re-import.

**Q: Can two people have the same name?**  
A: Yes — display names are not required to be unique. Login uses the username, not the display name.

**Q: My trial expired — I can't log in.**  
A: Contact support at support@crmstack.com to upgrade your account and restore access.

**Q: How do I export my data?**  
A: Go to the **Reports** page and use the CSV download button, or ask your DOK CRM account manager for a full data export.

---

*For further help contact **support@crmstack.com***
