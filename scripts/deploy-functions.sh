#!/usr/bin/env bash
# Copy supabase/functions/* to the self-hosted Supabase edge runtime on the VPS.
#   ./scripts/deploy-functions.sh [function-name ...]     (default: all)
# Functions are picked up on the next request; no restart is needed.
# Secrets (SMTP password, WhatsApp token ...) are NOT stored here: set them in /srv/supabase-pms/.env and the
# functions service environment on the VPS.
set -euo pipefail
cd "$(dirname "$0")/.."
names=("$@"); [ ${#names[@]} -gt 0 ] || names=($(ls supabase/functions))
for n in "${names[@]}"; do
  [ -f "supabase/functions/$n/index.ts" ] || { echo "no such function: $n" >&2; exit 1; }
  ssh oracle "mkdir -p /srv/supabase-pms/volumes/functions/$n"
  scp -q "supabase/functions/$n/index.ts" "oracle:/srv/supabase-pms/volumes/functions/$n/index.ts"
  echo "deployed $n"
done
