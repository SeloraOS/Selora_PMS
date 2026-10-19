# Selora PMS

Project Management frontend, extracted from the `bos` client (`bos/client/src/modules/projects`),
backed by a self-hosted Supabase (`supabase-pms`) with Supabase Auth, RLS and Realtime.

## Setup

    cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
    npm install
    npm run dev

The first account created (Sign up on the login page) becomes `admin`; later ones are `member`.

## Database

SQL lives in `supabase/`. The database runs on the VPS; apply files in order with:

    ssh oracle "docker exec -i supabase-pms-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < supabase/migrations/0001_helpers.sql

1. `supabase/migrations/0001` to `0021` (schema, RLS, realtime, rates, task links, integrity rules, holidays, timesheet task link, auto close, roles/files/comments/audit)
2. `supabase/seed.sql` (project/activity types), then optionally the real-estate demo data:
   `supabase/seed_demo.sql`, `seed_demo_extra.sql`, `seed_demo_more.sql` (needs the user `demo@seloraos.online`).

Roles: sign-ups are always `member`. Promote the first admin yourself:

    update public.profiles set role = 'admin' where email = 'you@example.com';

## Theme and calendar

- **Dark mode:** Light / Dark / System toggle in the top bar (and on the login page). The choice is stored in `localStorage`
  (`selora-theme`); `public/theme-init.js` applies it before first paint. Colors come from CSS variables in
  `src/styles/globals.css` (`[data-theme="dark"]`); charts use `src/lib/useChartTheme.js`.
- **Calendar** (`/projects/calendar`): month / week / agenda views of tasks, project dates, timesheet hours, holidays (the default
  holiday list from Project Settings) and project updates. Click an empty day to create a task, drag a task to move its dates.

## Access model, invitations and files (beta, Phase 1)

| Role | Sees | Can |
|---|---|---|
| `admin` / `manager` (staff) | everything | manage users (admin), invite, members, setup, settings, delete |
| `member` (internal) | all projects (or only their own when *Members see all projects* is off in Settings) | create/edit records, comment, upload |
| `client` | only projects they are a member of, only items **shared** with them, never timesheets or rates | read, comment (if allowed) |
| `contractor` | same as client, plus their assigned tasks | update status/actual dates of **their** tasks, upload photos, comment |

- **Invite users:** Users page > *Invite user* (edge function `invite-user`). Without SMTP the invitee gets a one-time temporary
  password that must be changed at first sign-in. Public sign-up is disabled (`DISABLE_SIGNUP=true` on the server).
- **Project members:** project > *Members* tab (role per project). **Files / Discussion / Activity** tabs on projects and tasks.
  Items are *Internal* by default; tick *Share with clients and contractors* to expose them to the portal.
- **Settings:** *Access & Files* section (upload limit, allowed types, client comments, activity retention, member visibility).
- **Server side:** `./scripts/deploy-functions.sh` copies `supabase/functions/*` to the VPS edge runtime; the API gateway CORS is limited
  to this app's origins (see `volumes/api/envoy/lds.template.yaml` on the VPS).
- **Tests:** `SERVICE_ROLE_KEY=... npm run test:access` creates throwaway users in every role and checks row-level security, storage
  access, the audit log and the invite function.

## Site reality (beta, Phase 2)

Migrations `0022`-`0025` (additive): `trades`, `snag_categories`, `daily_reports` (+ `daily_report_work`, `daily_report_manpower`), `snags`, `approvals`, task `percent_complete` and baseline columns, and the Phase 2 `pm_settings` columns. Demo data: `supabase/seed_demo_site.sql`.

- **Daily reports** (`/projects/daily-report`): mobile-first form, one report per project and day; submitting pushes each work line's progress to its task (100% completes it). Contractors can file reports on their projects (own drafts only); staff can share a submitted report with the client. Reports written offline wait in `localStorage` and are sent when the connection returns. A manifest and a small service worker (production build only) make the form installable and openable offline.
- **Snags** (`/projects/snags`): severity, status Open / Fixed / Verified / Rejected, assignee, due date (default from settings), photos through the Files panel. Clients and contractors can report snags (always shared); contractors can only mark their assigned snags Fixed; staff verify.
- **Approvals** (`/projects/approvals`): RERA, commencement, fire NOC, environmental and occupancy templates ("Add standard set"), expiry badges (valid / expiring / expired), internal only.
- **Gantt** (`/projects/gantt`): bars from task dates, critical path (finish-to-start dependencies, `src/lib/gantt.js`), baseline overlay (staff "Set baseline"), drag to move, drag the right edge to change the end date. Dependency arrows are not drawn; critical tasks are highlighted instead.
- **Alerts and calendar:** the notification drawer lists expiring/expired approvals, overdue snags and projects with no report after the cut-off; the calendar gains Approval expiry and Snags due events.
- **Settings (Projects Settings > Site):** daily report required + cut-off time, approval warning days, snag default due days, working days. Trades and snag categories are managed under Setup.

## Money (beta, Phase 3)

Migrations `0026`-`0029` (additive): `cost_heads`, `vendors`, `budgets` (+ `budget_revisions`), `work_orders`, `ra_bills`, `payments`, `material_requests`, the `finance_summary` view and the Phase 3 `pm_settings` columns. Demo data: `supabase/seed_demo_finance.sql`. The money rules live in the database (triggers), the UI mirrors them in `src/lib/finance.js`.

- **Budgets** per project and cost head; every change to an amount is a new revision. Admin/manager edit, other internal users read.
- **Work orders**: draft, pending approval, approved, closed, cancelled. Admins and managers approve any value; other internal users only up to the approval limit (Settings > Finance). Approved orders cannot go back to draft, and the value cannot drop below what has been billed.
- **RA bills**: raised against an approved work order. Retention (from the order), TDS and GST (from settings) are snapshotted on the bill; net = gross + GST - retention - TDS. Flow: draft, submitted, approved (same value-limit rule), rejected; the status becomes paid automatically when payments reach the net amount. The sum of a work order's bills can never exceed its value; payments can never exceed the net amount and only exist on approved bills (admin/manager record them).
- **Vendors** can be linked to a contractor login (Setup > Vendors). That contractor sees only their own work orders, bills and payments (Work Orders / RA Bills), can raise and submit bills, and never sees budgets, other vendors or the finance dashboard. Clients see no finance data.
- **Finance dashboard** (`/projects/finance`): budget vs committed vs billed vs paid by cost head, budget warnings, overdue payables, cash-flow forecast by due month, planned-vs-actual S-curve per project. **Project wise Cost** now also shows budget, committed, approved bills and paid out.
- **Material requests** (lite): item, quantity, needed by, status.
- **Settings (Projects Settings > Finance):** retention %, GST %, TDS %, approval limit, budget warning %, payment terms, financial-year start month, RA bill prefix.

## Scale and polish (beta, Phase 5)

Migration `0030` (additive): notification settings, `notification_log`, branding columns, the calendar-feed token and `rotate_ics_token()`. Edge Functions: `notify`, `calendar-feed` (deploy with `./scripts/deploy-functions.sh`). Not included on purpose: AI assist, multi-tenancy, native apps.

- **Role dashboards** (`/projects`): admins and managers get an owner view (budget committed, billed-not-paid, overdue payables, budget lines at risk, overdue tasks, expiring approvals, open snags, missing daily reports); internal members get a site view (my tasks, overdue, my snags, reports still to file); clients and contractors keep the portal home.
- **Exports:** every list has Export > CSV / Excel for the rows currently shown (CSV cells starting with `=`, `+`, `-` or `@` are neutralised); reports have CSV, Excel and Print / PDF. RA bills ("Print bill / PDF") and the Demand Letter page print on the company letterhead and logo (Projects Settings > Branding) through the browser's print dialog; choose "Save as PDF". Pop-ups must be allowed.
- **Accounting export** (`/projects/accounting-export`): Tally Prime import XML (purchase vouchers with GST input, TDS and retention, payment vouchers), Zoho Books bills CSV and a payments CSV for a date range (defaults to the financial year). Ledger names must exist in the accounting software (vendor name, cost head, `GST Input`, `TDS Payable`, `Retention Payable`, `Bank Account`, `Cash`). The XML follows the Tally voucher import format but has not been imported into a real Tally here.
- **Calendar feed** (Projects Settings > Branding & integrations): an ICS link with a secret token (tasks, project dates, approval expiries, snag due dates, holidays) for Google/Outlook/Apple Calendar. Anyone with the link can read it; "New link" invalidates the old one.
- **Notifications:** a daily digest (overdue tasks, expiring approvals, bills due, missing daily reports) by e-mail and/or a WhatsApp webhook. Everything is off until configured: channels, recipients, sender, digest time, the four content toggles, WhatsApp numbers and a Dry run switch are in Projects Settings > Notifications, which also shows whether the server has credentials and offers "Preview (dry run)" and "Send now". Delivery is once per recipient, channel and day (`notification_log`).

Server setup for notifications (secrets are Edge Function environment variables, never stored in the database or the browser):

1. `./scripts/deploy-functions.sh` copies `notify`, `calendar-feed` and `invite-user` to `/srv/supabase-pms/volumes/functions/`.
2. The functions service passes `NOTIFY_*` variables through (already added to `/srv/supabase-pms/docker-compose.yml`; backup `docker-compose.yml.bak.*`). Put the values in `/srv/supabase-pms/.env` and run `docker compose up -d functions`:
   `NOTIFY_SMTP_HOST`, `NOTIFY_SMTP_PORT` (465 = TLS, otherwise STARTTLS when offered), `NOTIFY_SMTP_USER`, `NOTIFY_SMTP_PASS`, `NOTIFY_SMTP_FROM`, `NOTIFY_WHATSAPP_URL`, `NOTIFY_WHATSAPP_TOKEN` (the webhook receives `POST {to, message}` with `Authorization: Bearer <token>`), optional `NOTIFY_TZ_OFFSET_MINUTES` (default 330).
3. Schedule it on the VPS (the function honours the Dry run switch):
   `0 8 * * * curl -s -X POST https://supabase-pms.seloraos.online/functions/v1/notify -H "apikey: <anon key>" -H "Authorization: Bearer <service role key>" -H "Content-Type: application/json" -d '{"action":"run"}'`
   (keep the key in a root-only file, not in the crontab line).

Verified here against fake servers: SMTP over a plain connection with AUTH LOGIN, the WhatsApp webhook, once-a-day delivery, the dry-run path and the "not configured" path. Not verified: TLS/STARTTLS against a real mail server, a real WhatsApp provider, real Tally import.

## Tests and verification

    npm test          # unit tests: report aggregation, rates, field mappers
    npm run verify:db # live check: mapped fields vs real columns, relations, round trips, constraints
    ssh oracle "docker exec -i supabase-pms-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < supabase/verify.sql

## Deployment (VPS, Caddy)

The app is a static build served by Caddy from `/srv/selora-pms/live` at https://pms.seloraos.online.

    ssh oracle "cd /srv/selora-pms && ./scripts/deploy.sh"

`.env.production` lives only on the VPS (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; the anon key is public by design,
the service-role key must never be used in the frontend). Row level security is the access control.
Do not set `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` in production unless you intentionally want the demo login prefilled.
