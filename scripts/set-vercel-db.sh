#!/usr/bin/env bash
# Point the deployed app at a hosted libSQL (Turso) database.
#
#   ./scripts/set-vercel-db.sh 'libsql://your-db.turso.io' 'your-auth-token'
#
# Until this is run, the production site serves its static pages but every
# page that reads data returns 500: Vercel's filesystem is read-only, so the
# `file:./keel.db` fallback in lib/db/index.ts has nothing to open.
set -euo pipefail

URL="${1:?usage: set-vercel-db.sh <libsql-url> <auth-token>}"
TOKEN="${2:?usage: set-vercel-db.sh <libsql-url> <auth-token>}"
PROJECT="keel"
SCOPE="mahad-khalid-ghafoors-projects"

need_token() {
  [[ -n "${VERCEL_TOKEN:-}" ]] || {
    echo "Set VERCEL_TOKEN first, or pass --token to the vercel calls below." >&2
    exit 1
  }
}
need_token

for target in production preview development; do
  printf '%s' "$URL"   | vercel env add DATABASE_URL "$target" \
    --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" --force
  printf '%s' "$TOKEN" | vercel env add DATABASE_AUTH_TOKEN "$target" \
    --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" --force
done

echo
echo "Set. Apply the schema to the remote database, then redeploy:"
echo "  DATABASE_URL='$URL' DATABASE_AUTH_TOKEN='<token>' npm run db:migrate"
echo "  vercel deploy --prod --yes --project $PROJECT --scope $SCOPE --token \$VERCEL_TOKEN"
