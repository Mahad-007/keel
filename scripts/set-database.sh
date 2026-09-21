#!/usr/bin/env bash
# Point both the deployed app and the daily workflow at a hosted libSQL
# (Turso) database.
#
#   VERCEL_TOKEN=... ./scripts/set-database.sh 'libsql://<db>.turso.io' '<auth-token>'
#
# Sets the credentials in two places, because two things need them:
#   - Vercel env vars, so the running app can read data
#   - GitHub secrets, so the daily workflow can apply migrations
#
# Until this runs, the site serves static pages but every data page returns
# 500: Vercel's filesystem is read-only, so the `file:./keel.db` fallback in
# lib/db/index.ts has nothing to open.
set -euo pipefail

URL="${1:?usage: set-database.sh <libsql-url> <auth-token>}"
TOKEN="${2:?usage: set-database.sh <libsql-url> <auth-token>}"
REPO="Mahad-007/keel"
PROJECT="keel"
SCOPE="mahad-khalid-ghafoors-projects"

[[ "$URL" == libsql://* || "$URL" == https://* ]] || {
  echo "error: expected a libsql:// URL, got: $URL" >&2; exit 1; }

echo "1/3  GitHub secrets on $REPO"
printf '%s' "$URL"   | gh secret set DATABASE_URL        --repo "$REPO"
printf '%s' "$TOKEN" | gh secret set DATABASE_AUTH_TOKEN --repo "$REPO"
echo "     done"

echo "2/3  Vercel environment variables"
: "${VERCEL_TOKEN:?set VERCEL_TOKEN before running this}"
for target in production preview development; do
  printf '%s' "$URL"   | vercel env add DATABASE_URL "$target" \
    --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" --force >/dev/null
  printf '%s' "$TOKEN" | vercel env add DATABASE_AUTH_TOKEN "$target" \
    --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" --force >/dev/null
done
echo "     done"

echo "3/3  Applying the schema to the remote database"
DATABASE_URL="$URL" DATABASE_AUTH_TOKEN="$TOKEN" npm run db:migrate
echo "     done"

echo
echo "Redeploy to pick up the new environment:"
echo "  vercel deploy --prod --yes --project $PROJECT --scope $SCOPE --token \$VERCEL_TOKEN"
