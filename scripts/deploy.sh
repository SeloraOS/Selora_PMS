#!/usr/bin/env bash
# Deploy on the VPS: pull the latest main, build, and swap the served folder atomically.
#   ssh oracle "cd /srv/selora-pms && ./scripts/deploy.sh"
# Caddy serves /srv/selora-pms/dist (see the pms.seloraos.online block in /etc/caddy/Caddyfile).
# Needs /srv/selora-pms/.env.production with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (never committed).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.production ] || { echo "missing .env.production" >&2; exit 1; }

git fetch --quiet origin main
git merge --ff-only origin/main

npm ci --no-audit --no-fund
npm test --silent
npm run build

# Never ship demo credentials in a production bundle
if grep -rqE "demo@selora\.test|demo1234" dist/; then
  if grep -q "^VITE_DEMO_" .env.production; then echo "note: demo credentials prefill is enabled in .env.production"; else
    echo "demo credentials found in dist/ but not requested in .env.production" >&2; exit 1; fi
fi

# Atomic swap so visitors never see a half-written build
rm -rf dist.new dist.old
cp -r dist dist.new
[ -d live ] && mv live dist.old || true
mv dist.new live
rm -rf dist.old
echo "deployed $(git rev-parse --short HEAD) to $(pwd)/live"
