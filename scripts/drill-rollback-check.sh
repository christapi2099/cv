#!/usr/bin/env bash
#
# Gate G6 — rollback drill preflight (plan.md §4 Phase 6.4, docs/backups.md §2).
#
# This script demonstrates the drill's binary check — deployed build-id SHA vs
# the deploy branch HEAD — and prints the decision the owner would act on.
# It NEVER promotes, rolls back, reverts, or writes anything in production.
#
# Usage:
#   bash scripts/drill-rollback-check.sh --dry-run
#   DEPLOY_URL=https://example.com bash scripts/drill-rollback-check.sh
#   bash scripts/drill-rollback-check.sh --url https://example.com
#
# Exit 0  → production serves the branch head (no rollback indicated).
# Exit 1  → stale/mismatched deployment: follow docs/backups.md §2 (owner-run
#           Vercel promote + git revert), then re-run this script.
# Exit 2  → no URL configured; nothing was checked (preflight only).
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=0
URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --url) URL="${2:-}"; shift 2 ;;
    --url=*) URL="${1#--url=}"; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      if [[ "$1" != -* ]]; then URL="$1"; fi
      shift
      ;;
  esac
done

URL="${URL:-${DEPLOY_URL:-${HEARTBEAT_URL:-${SITE_URL:-}}}}"
BRANCH="${DEPLOY_BRANCH:-revamp/astro}"
HEAD_SHA="$(git rev-parse --short=12 HEAD)"

echo "rollback-drill: branch=${BRANCH} head=${HEAD_SHA}"
echo "rollback-drill: this is a READ-ONLY preflight; no production action is taken."

if [[ "${DRY_RUN}" -eq 1 || -z "${URL}" ]]; then
  REASON="no URL configured"
  [[ "${DRY_RUN}" -eq 1 ]] && REASON="dry-run requested"
  echo "rollback-drill: no live check performed (${REASON})."
  echo "rollback-drill: the drill step the owner runs is:"
  echo "  1. node scripts/check-heartbeat.mjs --url <production-origin>   # deployed sha == ${HEAD_SHA}?"
  echo "  2. if stale: Vercel → Deployments → Promote the last good deployment"
  echo "  3. git revert --no-edit <bad-sha> && git push origin ${BRANCH}"
  echo "  4. node scripts/check-heartbeat.mjs --url <production-origin>   # re-verify; record docs/backups.md §2.5"
  exit 2
fi

if node scripts/check-heartbeat.mjs --url "${URL}"; then
  echo "rollback-drill: OK — production matches ${HEAD_SHA}; no rollback indicated."
  exit 0
fi

echo "rollback-drill: STALE — owner action required (docs/backups.md §2.2–§2.4):"
echo "  Vercel: Deployments → Promote last known-good deployment"
echo "  git:    git revert --no-edit <bad-sha> && git push origin ${BRANCH}"
echo "  verify: node scripts/check-heartbeat.mjs --url ${URL}"
exit 1
