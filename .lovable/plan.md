# Multi-Tenant SaaS CRM — Build Plan

A full multi-tenant CRM with Super Admin, Company Admin, Team Leader, and Operator roles, lead pipeline management, analytics, and Google Sheets/Zapier integration.

## Tech & Backend

- React + TypeScript + Vite (existing), Tailwind + shadcn/ui, React Router, Recharts
- **Lovable Cloud** (Supabase) for DB, Auth, Storage, RLS, and Edge Functions
- Email/password auth with role-based redirect; invite flow via email link

## Database Schema

Tables (all with RLS enabled):

- `companies` — id, name, logo_url, plan, status (active/suspended), created_at
- `profiles` — id (= auth.uid), email, full_name, avatar_url, company_id, created_at
- `user_roles` — id, user_id, company_id, role (`super_admin` | `company_admin` | `team_leader` | `operator`) — separate table to prevent privilege escalation
- `pipeline_stages` — id, company_id, name, order, color
- `leads` — id, company_id, assigned_to_user_id, first_name, last_name, email, phone, company_name, source, pipeline_stage_id, value, notes, created_at, updated_at
- `lead_activities` — id, lead_id, user_id, type (call/email/note/meeting/status_change), content, created_at
- `tasks` — id, lead_id, assigned_to, title, due_date, completed, created_at
- `company_webhook_tokens` — id, company_id, token (unique), created_at

### Security Definer Functions

- `has_role(user_id, role)` — checks user_roles
- `is_super_admin(user_id)` — shortcut
- `get_user_company(user_id)` — returns company_id
- `is_lead_assignee(user_id, lead_id)` — for operator scoping

### RLS Policies (key examples)

- **Operators**: SELECT/UPDATE leads where `assigned_to_user_id = auth.uid()`
- **Team Leaders & Company Admins**: full SELECT/UPDATE/INSERT within their `company_id`; only Admins can DELETE
- **Super Admin**: bypass via `is_super_admin(auth.uid())` in every policy
- Activities/tasks inherit lead access; pipeline_stages writable only by Company Admin

### Auto-provision

- DB trigger on `auth.users` insert → create `profiles` row
- Invite acceptance edge function assigns `company_id` + role

## Pages & Routes

**Public**
- `/login`, `/reset-password`, `/accept-invite`

**Super Admin** (role-gated)
- `/admin` — global dashboard: total companies, total leads, MRR, 12-mo growth line chart
- `/admin/companies` — table with status badges, suspend/delete, "impersonate"
- `/admin/companies/new` — create company + invite admin
- `/admin/companies/:id` — members, lead counts, activity log

**Main App** (Admin / TL / Operator)
- `/dashboard` — role-aware widgets (donut by stage, team table, my leads, tasks due)
- `/leads` — table + Kanban toggle, filters, search, "Add Lead", "Import" modal
- `/leads/:id` — info card, activity timeline, stage selector, tasks panel, quick actions (Log Call/Email/Note)
- `/team` — Admin/TL only: operator list, drill into their leads, invite member
- `/analytics` — Admin/TL only: pipeline bar, source pie, conversion funnel, leaderboard, date range
- `/settings` — profile + (Admin) company profile, pipeline editor, invites, billing view, **Integrations** tab

## Lead Import / Google Sheets / Zapier

**Edge function `webhook-leads`** (public, JWT off):
- `POST /webhook-leads/:company_token` → validates token, parses JSON, dedupes by email, inserts leads, returns `{ created, skipped }`

**Settings → Integrations tab** (Company Admin):
- Show unique webhook URL + regenerate button
- Step-by-step Zapier setup instructions
- JSON field mapping reference
- "Import from Google Sheet URL" — paste public sheet, fetched via edge function, shows column mapping UI then preview + confirm
- "Import CSV" — upload, map columns, preview first 5 rows, confirm

## UI Design

- Dark navy sidebar (`#1e2433`), white content, indigo accent (`#6366f1`)
- All colors via HSL design tokens in `index.css` + `tailwind.config.ts` (no hard-coded colors in components)
- Sidebar with `shadcn/ui sidebar`, role-filtered nav items, collapsible mini variant
- Top bar: company name/logo, notification bell, avatar dropdown
- Kanban: white cards, colored left border per stage, drag-and-drop between stages
- Status badges: pill-shaped, color-coded (New blue, Contacted yellow, Qualified teal, Proposal purple, Won green, Lost red)
- Skeleton loaders, empty states with illustration + CTA, toast on every CRUD, confirm dialogs for destructive actions
- Responsive: collapsed sidebar on mobile, table → card layout on small screens

## Seed Data

Demo company **"Acme Sales Co"** seeded via SQL:
- 1 Company Admin, 2 Team Leaders, 4 Operators (with login credentials shown after build)
- Custom pipeline: Prospecting → First Contact → Qualified → Demo Scheduled → Proposal Sent → Negotiation → Closed Won / Closed Lost
- 50 leads spread across operators and stages, with activity history on ~15 leads
- 1 Super Admin account

## Build Order

1. Enable Lovable Cloud, create schema + RLS + security definer functions + triggers
2. Auth pages + role-based router guard + role-aware sidebar layout
3. Company Admin/TL/Operator dashboards (role-aware widgets)
4. Leads table + Kanban + filters + Add/Edit lead side panel
5. Lead detail page (timeline, tasks, stage selector, activity logging)
6. Team page + invite flow (edge function for invites)
7. Analytics page (Recharts)
8. Settings (profile, pipeline editor, integrations tab)
9. Webhook edge function + CSV/Sheets import flow
10. Super Admin panel (companies CRUD, global dashboard, impersonation)
11. Seed data + demo credentials

## Notes / Limitations

- "Impersonation" implemented as a Super Admin view-only mode scoped by selected `company_id` (no auth swap, to keep RLS safe)
- MRR/billing on Super Admin dashboard derives from `companies.plan` (no real payments wired unless requested later)
- Email invites use Supabase Auth invite links via an edge function
