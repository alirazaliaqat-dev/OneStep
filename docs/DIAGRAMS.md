# Clearline CRM — System Architecture & Workflow Diagrams

All diagrams use standard Mermaid notation reflecting the exact implemented frontend, Express backend, Meta Graph API v21.0 integration, and SQLite schema.

---

## 1. Full-Stack System Architecture

```mermaid
flowchart TB
    subgraph Client["React 19 + Liquid Glass UI (Inter Only · #091F5C – #F9FBFF)"]
        UI_Nav["Role-Based Sidebar & Mobile Nav\n(Permission-Gated Sections)"]
        UI_Overview["Main Screen Overview + Live Inbox\n(Meta + TikTok Queries · ROAS · SLA)"]
        UI_Meta["Omnichannel Workbench\n(Meta + TikTok Queue · Campaigns · Rules)"]
        UI_CRM["CRM Pipeline\n(Board · Directory · Drawer)"]
        UI_HRMS["HRMS People Ops\n(Attendance · Leave · Payroll · Reviews)"]
        UI_Org["Organization & Employees\n(Org Profile · Departments · Roles)"]
        Haptics["Haptic & Motion Engine\n(Vibration API + Spring Physics)"]
    end

    subgraph Server["Express + TypeScript Backend (server.ts · Port 3000)"]
        API_Router["REST API Router (/api/*)"]
        Meta_OAuth["Meta & TikTok OAuth Controllers\n(/auth/meta/callback · /auth/tiktok/callback)"]
        Webhooks["Omnichannel Webhooks\n(/api/meta/webhook · /api/tiktok/webhook)"]
        Channel_Services["Meta Graph v21 & TikTok Services\n(metaService.ts · tiktokService.ts)"]
        DB_Layer["SQLite Persistence Layer\n(node:sqlite · data/clearline.db)"]
    end

    subgraph External["Meta & TikTok Platforms"]
        OAuth_Dialogs["Meta OAuth & TikTok OAuth v2"]
        Platform_APIs["Meta Graph v21 & TikTok Business Messages\n(FB · IG · Messenger · TikTok DM & Leads)"]
    end

    UI_Nav --> UI_Overview & UI_Meta & UI_CRM & UI_HRMS & UI_Org
    UI_Overview & UI_Meta & UI_CRM & UI_HRMS & UI_Org --> Haptics
    UI_Overview & UI_Meta & UI_CRM & UI_HRMS & UI_Org -->|JSON / REST| API_Router
    UI_Meta -->|Popup Flow| Meta_OAuth
    Meta_OAuth --> OAuth_Dialogs
    OAuth_Dialogs -->|Auth Code| Meta_OAuth
    Meta_OAuth --> Channel_Services
    API_Router --> Channel_Services
    API_Router --> DB_Layer
    Channel_Services <-->|HTTPS| Platform_APIs
    Platform_APIs -->|Real-time Events| Webhooks
    Webhooks --> DB_Layer
```

---

## 2. Meta OAuth 2.0 & Real-Time Query Sync Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Workspace Admin
    participant App as Clearline UI (Iframe)
    participant Popup as Meta OAuth Popup
    participant API as Express Server
    participant Meta as Meta Graph API v21.0
    participant DB as SQLite (clearline.db)

    Admin->>App: Click "Connect Meta" (Light Haptic)
    App->>API: GET /api/meta/auth/url
    API-->>App: { url: "https://www.facebook.com/v21.0/dialog/oauth?..." }
    App->>Popup: window.open(url, "meta_oauth")
    Admin->>Popup: Grant Ads, Leads & Messaging Scopes
    Popup->>API: GET /auth/meta/callback?code=...
    API->>Meta: Exchange code for Access Token
    Meta-->>API: { access_token, expires_in }
    API->>Meta: GET /me/adaccounts & /me/accounts
    Meta-->>API: Ad Accounts & Connected Pages
    API->>DB: Save meta_connections record
    API-->>Popup: postMessage({ type: "OAUTH_AUTH_SUCCESS" }) & window.close()
    App->>API: POST /api/meta/sync
    API->>Meta: Fetch Campaigns, Insights & Leadgen Queries
    Meta-->>API: Live Campaign & Query Payloads
    API->>DB: Upsert campaigns & queries
    API-->>App: Updated Meta Status + Synced Data (Success Haptic)
```

---

## 3. Meta Query Triage & CRM Deal State Machine

```mermaid
stateDiagram-v2
    [*] --> NewQuery: Inbound Meta Ad Form / IG DM / Messenger / Comment
    NewQuery --> Assigned: Assign to Employee (Capacity Check)
    Assigned --> InProgress: Specialist Opens Thread
    InProgress --> Replied: Send Reply (Graph API / Logged)
    Replied --> InProgress: Customer Follow-up
    Replied --> Resolved: Support Query Closed
    Replied --> ConvertedDeal: Click "Convert Deal"

    state ConvertedDeal {
        [*] --> NewLead
        NewLead --> Qualified: Discovery Completed
        Qualified --> ProposalSent: Quote Delivered
        ProposalSent --> Negotiation: Terms Review
        Negotiation --> Won: Closed Won (Quota Credited)
        Negotiation --> ClosedLost: Closed Lost
    }

    Resolved --> [*]
    ConvertedDeal --> [*]
```

---

## 4. Relational Database Schema (ER Diagram)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ DEPARTMENTS : contains
    ORGANIZATIONS ||--o{ EMPLOYEES : employs
    ORGANIZATIONS ||--o| META_CONNECTIONS : connects
    ORGANIZATIONS ||--o| TIKTOK_CONNECTIONS : connects
    DEPARTMENTS ||--o{ EMPLOYEES : groups
    META_CONNECTIONS ||--o{ CAMPAIGNS : tracks
    TIKTOK_CONNECTIONS ||--o{ CAMPAIGNS : tracks
    CAMPAIGNS ||--o{ QUERIES : generates
    EMPLOYEES ||--o{ QUERIES : handles
    QUERIES ||--o| LEADS : converts_to
    CAMPAIGNS ||--o{ LEADS : attributes
    EMPLOYEES ||--o{ LEADS : owns
    LEADS ||--o{ ACTIVITIES : logs
    EMPLOYEES ||--o{ HR_ATTENDANCE : logs
    EMPLOYEES ||--o{ HR_LEAVE_REQUESTS : submits
    EMPLOYEES ||--o{ HR_PAYROLL_RECORDS : receives
    EMPLOYEES ||--o{ HR_REVIEWS : evaluated_in

    ORGANIZATIONS {
        text id PK
        text name
        text industry
        text timezone
        text meta_business_id
        integer sla_target_minutes
    }
    DEPARTMENTS {
        text id PK
        text name
        text head_employee_id
        text routing_channel
        text description
    }
    EMPLOYEES {
        text id PK
        text department_id FK
        text full_name
        text email
        text role
        text status
        integer max_capacity
        integer monthly_quota
        real base_salary
        text employment_type
        text hire_date
        integer leave_balance
        text work_location
    }
    HR_ATTENDANCE {
        text id PK
        text employee_id FK
        text work_date
        text clock_in
        text clock_out
        real hours_worked
        text work_mode
        text status
    }
    HR_LEAVE_REQUESTS {
        text id PK
        text employee_id FK
        text leave_type
        text start_date
        text end_date
        integer days_count
        text reason
        text status
        text reviewed_by
    }
    HR_PAYROLL_RECORDS {
        text id PK
        text employee_id FK
        text pay_period
        real base_salary
        real crm_commission
        real bonus
        real deductions
        real net_pay
        text status
    }
    HR_REVIEWS {
        text id PK
        text employee_id FK
        text reviewer_name
        text review_cycle
        real rating
        integer attendance_score
        integer crm_attainment_pct
        text summary
    }
    META_CONNECTIONS {
        text id PK
        text status
        text business_name
        text ad_account_id
        text page_name
        text access_token
        text last_synced_at
    }
    TIKTOK_CONNECTIONS {
        text id PK
        text status
        text account_name
        text advertiser_id
        text tiktok_handle
        text access_token
        text last_synced_at
    }
    CAMPAIGNS {
        text id PK
        text name
        text objective
        text status
        real daily_budget
        real spend
        integer impressions
        integer clicks
        integer leads_count
        real roas
    }
    QUERIES {
        text id PK
        text campaign_id FK
        text assigned_employee_id FK
        text customer_name
        text customer_handle
        text channel
        text priority
        text status
        text message_preview
        text messages_json
        text created_at
    }
    LEADS {
        text id PK
        text query_id FK
        text campaign_id FK
        text owner_id FK
        text contact_name
        text company
        text email
        text phone
        text stage
        real deal_value
        text notes
        text updated_at
    }
    ACTIVITIES {
        text id PK
        text entity_type
        text entity_id
        text actor_name
        text summary
        text created_at
    }
```

---

## 5. Organization, Department & RBAC Hierarchy

```mermaid
flowchart TD
    Org["Clearline Organization\n(Global Settings · Meta Business ID · SLA Policy)"]
    Org --> DeptGrowth["Performance Marketing\n(Ad Spend · Campaign Optimization · Lead Forms)"]
    Org --> DeptSales["Inbound Sales\n(Deal Pipeline · Proposals · Quotas)"]
    Org --> DeptSupport["Customer Care\n(IG DMs · Messenger · Ad Comments)"]

    DeptGrowth --> RoleAdMgr["Ad Manager\nManage Campaigns, Sync Meta, Route Leads"]
    DeptSales --> RoleSales["Sales Lead\nOwn Deals, Advance Stages, Convert Queries"]
    DeptSupport --> RoleSupport["Support Specialist\nReply to Meta Queries, Escalate Deals"]
    Org --> RoleAdmin["Admin\nFull Org Governance, RBAC, Meta OAuth"]
```
