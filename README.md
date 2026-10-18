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

1. `supabase/migrations/0001` to `0017` (schema, RLS, realtime, rates, task links, integrity rules, holidays, timesheet task link, auto close)
2. `supabase/seed.sql` (project/activity types), then optionally the real-estate demo data:
   `supabase/seed_demo.sql`, `supabase/seed_demo_extra.sql` (needs the user `demo@selora.test`).

Roles: sign-ups are always `member`. Promote the first admin yourself:

    update public.profiles set role = 'admin' where email = 'you@example.com';

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
