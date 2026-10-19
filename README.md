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
