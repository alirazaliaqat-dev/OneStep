# Clearline CRM — End-to-End Platform Workflows

This document defines the complete operational workflows uniting **Meta Ads & Queries**, **TikTok Messages & Spark Leads**, **CRM Pipeline Management**, **HRMS People Operations**, and **Employee & Organization Governance** inside a single cohesive workspace.

---

## 1. Meta Business & TikTok Business Connection Workflow

1. **Initiate OAuth Connection (Meta & TikTok):**
   - Admin opens **Omnichannel Inbox** or **Channels & Setup** and clicks **Connect Meta** or **Connect TikTok**.
   - Client requests `/api/meta/auth/url` or `/api/tiktok/auth/url` from the Express backend.
   - Meta builds the official Graph API v21.0 OAuth dialog (`ads_read`, `ads_management`, `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_messaging`, `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `business_management`); TikTok builds the TikTok OAuth v2 flow (`user.info.basic`, `business.get`, `message.list`, `message.send`, `lead.read`).
2. **Popup Authorization & Token Exchange:**
   - Client opens the provider URL directly in a popup window (respecting cross-origin iframe rules).
   - Providers redirect to `/auth/meta/callback` or `/auth/tiktok/callback`, persist tokens in SQLite (`meta_connections` / `tiktok_connections`), and notify the opener via `window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider }, '*')`.
3. **Real-Time Webhook & Manual Sync:**
   - Meta sends `leadgen`, `messages`, and `feed` comment events to `/api/meta/webhook`; TikTok sends Direct Message (`TikTok DM`) and Spark Lead Form (`TikTok Lead`) events to `/api/tiktok/webhook`.
   - Users trigger on-demand **Sync Meta** (`POST /api/meta/sync`) or **Sync TikTok** (`POST /api/tiktok/sync`) from the Overview or Settings drawer.

---

## 2. Main Screen Omnichannel Inbox & One-Stop Query Triage Workflow

Every role's main dashboard screen (`Overview & Inbox`) embeds the **Live Omnichannel Inbox** showing real queries from **Facebook Lead Forms**, **Facebook Ad Comments**, **Instagram DMs**, **Messenger**, **TikTok DMs**, and **TikTok Spark Leads** scoped to the active role (`all` vs. `assigned`):

1. **Platform Filtering & Inline Response on Main Screen:**
   - Users filter immediately by `All`, `Facebook`, `Instagram`, `Messenger`, or `TikTok`, update inquiry status (`New` → `In Progress` → `Replied` → `Qualified` → `Resolved`), reassign agents (if permitted), and send replies right from the main dashboard.

1. **Ingestion, Ad Creative & Campaign Attribution:**
   - Each Facebook or Instagram inquiry captures `customer_name`, `customer_email`, `customer_phone`, `campaign_id`, `platform`, `ad_creative_id`, `ad_creative_name`, `ad_creative_format`, and `ad_set_name`.
   - Priority and SLA window are assigned based on channel urgency and matching assignment rules.
2. **Predefined Automated Assignment Rules (`routingService.ts`):**
   - Active `assignment_rules` evaluate incoming inquiries in priority order against `channel`, `platform`, and `campaign_id` using `specific_agent`, `least_loaded`, or `round_robin` strategies while respecting `max_capacity`.
   - Managers can also trigger **Run Auto-Assign** across unassigned backlog items or create/pause rules in **Meta Queries → Auto-Assign Rules**.
3. **One-Stop Response & Agent Status Progression:**
   - Agents inspect the creative viewed, campaign context, and full message thread in the split-pane workspace.
   - Agents update inquiry status (`New` → `In Progress` → `Replied` → `Qualified` → `Resolved`) and click **Send Reply** to dispatch and log responses.
4. **One-Click Conversion to CRM Lead:**
   - When commercial intent is confirmed, clicking **Convert Deal** creates a linked CRM pipeline record preserving campaign and ad creative attribution.

---

## 3. Customizable Visual Dashboard & Reporting Workflow

- **KPIs & Interactive Charts:** Displays Total Leads, Conversion Rate, Active Meta Campaigns, Meta Ad Spend, Return on Ad Spend (ROAS), Deals Closed, SVG Spend vs. ROAS bar chart, Lead Conversion Funnel, and Employee Performance metrics (`leadsContacted`, `dealsClosed`, `wonRevenue`).
- **User Customization:** Via **Customize Dashboard**, users reorder KPI priority (`Move Up` / `Move Down`), show/hide individual KPI cards, and toggle chart widgets—persisted in SQLite (`/api/dashboard/preferences`).

---

## 4. Integrated HRMS & People Operations Workflow

1. **Daily Attendance & Shift Tracking (`/api/hrms/attendance/clock`):**
   - Employees clock in and out directly from **HRMS → Attendance**, selecting `On-Site`, `Hybrid`, or `Remote` work mode. Hours worked calculate automatically upon clock-out.
2. **Leave & Time-Off Approval (`/api/hrms/leaves`):**
   - Team members submit time-off requests (`Annual`, `Sick`, `Personal`, `Parental`) with date range and coverage notes.
   - Managers and Administrators approve or decline pending requests (`PATCH /api/hrms/leaves/:id`); approval automatically deducts the requested days from the employee's `leave_balance`.
3. **CRM-Commission-Linked Payroll (`/api/hrms/payroll/run`):**
   - Payroll merges employee `base_salary` with live **5% CRM commission** computed directly from each employee's closed `Won` deals in the CRM pipeline. Visibility is protected by RBAC (`viewFinancialRoas` / `manageTeam`).
4. **Performance Reviews:**
   - Managers log structured reviews combining attendance discipline (`attendance_score`) and CRM quota attainment (`crm_attainment_pct`).

---

## 5. Granular Roles, Permissions & Organization Workflow

1. **Core & Custom RBAC Roles:**
   - **Administrator:** Full data access (`all`), all modification rights, financial ROAS/payroll reporting, team governance, and custom role management.
   - **Manager:** Views organization-wide leads/inquiries and team performance metrics, approves leaves, logs reviews, assigns tasks/inquiries, and manages deals, campaigns, and assignment rules.
   - **Agent:** Scoped to assigned leads/inquiries, replies to clients, updates inquiry statuses, clocks attendance, submits leave requests, and progresses owned deals; restricted from org settings and financial ROAS/payroll figures.
   - **Custom Roles:** Administrators can create new custom roles (`POST /api/roles`), toggle granular Data Access, Modification, and Reporting permissions live, or remove custom roles (`DELETE /api/roles/:id`).

---

## 6. Role-Based Sidebar & Responsive Touch + Haptic Workflow

- **Role-Based Desktop Sidebar (`268px`):** Dynamically displays grouped sections based on the active role's permissions:
  - **Workspace:** `Overview & Inbox`, `Omnichannel Inbox`, `CRM Pipeline`, `HRMS & Attendance`
  - **Ads & Automation:** `Ad Campaigns` (`viewCampaigns`), `Auto-Assign Rules` (`manageAssignmentRules`)
  - **Organization & Access:** `Employees & Org` (`viewOrganization`), `Roles & Permissions` (`manageRoles`)
- **Mobile:** Compact single-row top bar + `< 15%` viewport bottom tab bar (`Overview`, `Queries`, `Pipeline`, `HRMS`, and `Team` when `viewOrganization` is permitted). Master/detail views transition smoothly with spring drawers and deliver subtle tactile vibration (`selection`, `light`, `medium`, `success`) on every tap.
