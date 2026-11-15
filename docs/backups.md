# Backups, rollback, and restore

Owner: **Christopher Tapia**. Status: **seed mode (v1)** — the Ghost halves of this document are
**dormant runbook text** and must not be activated before gate **G-CUT** (plan D13/Phase G).

---

## 1. Seed-period model: git is the backup

From launch until cutover, the repository **is** the content of record. There is no database, no
CMS, no media bucket, and no build that writes outside `dist/`.

| Data | Source of record | Restore mechanism |
| --- | --- | --- |
| Posts (both series) | `src/content/seed/**/*.md` | checkout the commit |
| Case studies / CV copy | `src/content/work/**`, `src/data/cv.ts` | checkout the commit |
| Images, fonts, brand marks | `public/**`, `src/assets/**` | checkout the commit |
| Routes, layouts, SEO, feeds | `src/**` | checkout the commit |
| Hosting config, redirects | `vercel.json`, `astro.config.mjs` | checkout the commit |
| Environment variables | Vercel project settings (secrets) | documented in README; re-set by owner |
| Generated CV PDF | rebuilt from `src/data/cv.ts` by `pnpm build` | regenerate — never hand-edited |

Consequences:

- **RPO** = the last pushed commit. A local-only edit is not backed up; push before stepping away.
- **RTO** = clean clone → `pnpm install --frozen-lockfile` → `pnpm build` → deploy. Target: under
  30 minutes, dominated by the install and the Vercel build queue.
- Deleted or bad content is recovered with `git revert` / `git checkout <sha> -- <path>`, not from a
  backup service.

### 1.1 Seed-period restore (step by step)

1. Identify the last known-good commit on the deploy branch (`git log --oneline`).
2. In a clean directory: `git clone <repo> && cd cv && git checkout <good-sha>`.
3. `pnpm install --frozen-lockfile`.
4. `pnpm build` (runs `astro check`, `svelte-check`, `astro build`, Pagefind, CV PDF).
5. Serve `dist/` locally (`pnpm preview`) and spot-check `/`, `/blog`, both series pages, `/work`,
   `/cv`, `/contact` and `/build-id.json`.
6. Deploy the good commit by re-promoting its Vercel deployment (see §2.2) **or** by reverting the
   bad commit on the branch and letting the push rebuild. Prefer re-promoting for speed; the git
   revert still follows so the branch and production agree.
7. Confirm the heartbeat (§2.3) and record the incident in the table in §5.

---

## 2. Rollback runbook — Phase 6 launch drill

This is the drill that satisfies the Phase 6 launch requirement: **trigger → Vercel rollback →
git revert → named owner → verification**. Execute it once before launch and record the result.

### 2.1 Trigger conditions

Roll back immediately when any of these is true after a production deploy:

- `/build-id.json` or the `<meta name="build-id">` tag is missing, or its SHA does not match the
  branch head after the build has had time to finish.
- A previously working route returns 5xx/404 in production (home, `/work`, `/blog`, a series page,
  `/cv`, `/contact`).
- The contact endpoint returns 2xx to the honeypot drill, or is unreachable (`check-contact.mjs`
  alarms).
- A content or layout regression is visible in production and a forward fix is not minutes away.
- Security/config regression (secrets, redirects, headers).

Do **not** roll back for a typo that can be fixed forward faster than a rollback, but never leave a
broken route live while writing the fix.

### 2.2 Vercel rollback action

**Dashboard (preferred for the drill):**

1. Vercel → project → **Deployments**.
2. Find the last deployment known to be good (check its commit SHA against `git log`).
3. Open its ⋯ menu → **Promote to Production** (older deployments may show **Instant Rollback**).
4. Wait for the alias to move, then verify §2.3.

**CLI (equivalent):**

```bash
npx vercel ls <project>                 # list deployments, newest first
npx vercel promote <deployment-url>     # promote a specific good deployment
# or, to move one step back:
npx vercel rollback                     # rolls production back one deployment
```

Notes:

- `vercel rollback`/`promote` moves the production alias; it does not rewrite git.
- Never point production at a preview URL as a long-term fix. Promote, then fix the branch.

### 2.3 Verification after rollback

```bash
node scripts/check-heartbeat.mjs --url https://<production-origin>   # SHA must equal the good commit
curl -fsS https://<production-origin>/build-id.json                  # buildId/sha/builtAt
node scripts/check-contact.mjs                                       # CONTACT_ENDPOINT from env
```

Also spot-check the routes listed in §1.1. The build-id SHA is the binary proof that production is
serving the intended commit.

### 2.4 Git revert (make the branch match production)

```bash
git checkout <deploy-branch>
git revert --no-edit <bad-sha>          # revert the offending commit (or a range)
git push origin <deploy-branch>         # Vercel rebuilds on push
```

- Use `git revert`; **do not** force-push the deploy branch.
- If several commits are involved, revert them in reverse order or revert the merge commit with
  `-m 1`.
- A revert triggers a new build. Re-check the heartbeat after it finishes; production should now
  serve the revert commit's SHA.

### 2.5 Drill record (fill in at Phase 6)

| Field | Value |
| --- | --- |
| Drill date | _pending_ |
| Trigger simulated | _pending_ |
| Bad deployment promoted / reverted | _pending_ |
| Vercel action used | _pending_ (dashboard promote / CLI) |
| Heartbeat SHA before → after | _pending_ |
| Git revert commit | _pending_ |
| Restore duration | _pending_ |
| Owner | Christopher Tapia |

### 2.6 Drill preflight command (read-only)

Phase 6 prepares the drill with a script that performs **only the verification half** — it never
promotes, rolls back, or reverts. The owner executes the same command before and after the manual
Vercel action:

```bash
bash scripts/drill-rollback-check.sh --dry-run          # prints the exact step list, no network
DEPLOY_URL=https://<production-origin> bash scripts/drill-rollback-check.sh
# exit 0 → production serves the deploy-branch HEAD (no rollback indicated)
# exit 1 → stale deployment; owner follows §2.2–§2.4, then re-runs
```

The comparison is the same binary check as §2.3: the deployed `/build-id.json` SHA versus
`git rev-parse --short=12 HEAD`. A stale result is the drill trigger; the rollback action itself is
deliberately manual and owner-owned.

---

## 3. Phase G cutover runbook — DORMANT

> **Do not execute any step in this section before G-CUT.** In seed mode there is no Ghost
> instance, no snapshot job, no webhook, and no backup bucket consumer. The scripts referenced here
> exist and pass `--dry-run`; they are not scheduled.

### 3.1 Snapshot writer schedule (activates at cutover)

- **Workflow:** a scheduled GitHub Actions job (added at cutover) runs,
  daily at **05:07 UTC**, plus `workflow_dispatch` for manual refreshes:
  `pnpm exec tsx scripts/snapshot-ghost.ts`.
- **What it does:** fetches the Ghost Content API (paginated), mirrors Ghost-hosted images to
  checksum-addressed paths under `public/media/`, records media checksums in the snapshot, rewrites
  image URLs, and writes `src/content/ghost-snapshot/current.json` plus a rotating
  `versions/<ISO>.json` (last 10).
- **If the content hash is unchanged:** no files are written.
- **If it changed:** the job opens a PR with both files plus mirrored media. The PR build is the
  review gate; merging triggers a redeploy. The script itself never commits or pushes.
- **Purpose:** catch tag renames and missed webhook deliveries (D3/D4) — a daily diff is the
  backstop, not the primary publish path.
- **Failure handling:** a failed run pages via `scripts/notify.ts`; a second consecutive failure is
  an incident (snapshot is going stale).
- **Builds never run this:** the build only reads `current.json` on a live-fetch failure.

### 3.2 Nightly backups (activates at cutover)

Schedule: **03:17 UTC daily**, off-peak, after the snapshot writer has established a baseline.

1. `pnpm exec tsx scripts/backup-ghost.ts` with `BACKUP_DIR` set to a local staging directory →
   timestamped Content API JSON export (`ghost-content-<ISO>.json`).
2. `mysqldump --single-transaction --routines --triggers ghost > ghost-db-<ISO>.sql` (self-hosted
   Ghost; for Ghost(Pro) use the provider export).
3. Encrypt both artifacts and upload to the encrypted off-site bucket (`BACKUP_BUCKET`, Lane E
   credentials). Never commit them.
4. Retention: **30 daily**, **12 monthly** (first of month kept), plus the snapshot PR history in
   git. Record the object keys in the backup log.
5. A non-zero exit or missing upload alerts via `scripts/notify.ts`.

### 3.3 Verified webhook set (D3) — exact six events

Configure in Ghost → Integrations → Custom integration → Webhooks, all delivered to the Vercel
**deploy hook URL** (a rotatable bearer secret stored only in Ghost + Vercel):

| Event | Why |
| --- | --- |
| `post.published` | new post appears on `/blog`, its series, RSS, search |
| `post.published.edited` | edits to published posts |
| `post.unpublished` | removes the post from all surfaces |
| `post.deleted` | removes it permanently |
| `post.tag.attached` | series/topical tag membership changes |
| `post.tag.detached` | series/topical tag membership changes |

- **Do not** subscribe `post.updated` — it does not exist; a silently misconfigured hook is worse
  than none.
- **Do not** subscribe `site.changed` by default — with a direct deploy hook it double-triggers
  normal changes. Tag *renames* are caught by the daily content-hash PR (§3.1). `site.changed` is an
  opt-in escape hatch only.
- The optional Ghost HMAC signature cannot be verified by a Vercel deploy hook; the documented
  upgrade path is a verifying receiver function plus `GHOST_WEBHOOK_SECRET`.
- Verify at cutover: publish a test post in each series, edit it, unpublish it, delete it, attach
  and detach a series tag — each must produce a build whose build-id advances. Rotate the deploy
  hook URL after the drill and update Ghost.

### 3.4 Monthly restore drill (activates at cutover)

First Saturday of each month, on scratch infrastructure — never over production:

1. Restore the latest MySQL dump into a scratch database and the latest JSON export into a scratch
   Ghost instance (or validate the JSON with the snapshot parser).
2. Compare counts: posts, tags/authors, series membership against the export manifest. A mismatch
   is an incident.
3. Run a build against the restored snapshot (`GHOST_URL` unset or the scratch instance) and verify
   `/blog`, both series, RSS, and JSON-LD render.
4. Record: backup object key, restore start/end, counts, pass/fail, owner.
5. RPO target = last nightly run (≤ 24 h). RTO target = under 2 h for a self-hosted Ghost restore.

### 3.5 Monitoring and alerting

- **Heartbeat:** `scripts/check-heartbeat.mjs` compares the deployed build-id SHA to the deploy
  branch after every publish (manual or webhook); stale = missed rebuild (R10).
- **Contact drill:** `scripts/check-contact.mjs` (honeypot payload, 4xx expected).
- **Snapshot staleness:** the daily job's missing/changed hash and two consecutive failures alert.
- **Backup failure:** non-zero exit from the backup job alerts.
- Alerts go through `scripts/notify.ts` (`NOTIFY_WEBHOOK_URL`, secret, never printed).

### 3.6 Cutover activation checklist

- [ ] Ghost installed (+ MySQL 8, SMTP, TLS) or Ghost(Pro) provisioned; admin login verified.
- [ ] Content API key created (read-only) and stored in Vercel.
- [ ] Both series internal tags exist at the exact registry slugs.
- [ ] `scripts/seed-to-ghost.ts` migration run; post/tag/series counts match the seed manifest.
- [ ] `GHOST_URL` + `GHOST_CONTENT_API_KEY` set in Vercel; first live build green.
- [ ] Snapshot writer workflow enabled; first refresh mirrors media to `/media/`.
- [ ] Six webhooks configured and E2E-verified (§3.3); deploy hook rotated.
- [ ] Nightly backup job scheduled; one backup uploaded and restore-tested (§3.4).
- [ ] Monitoring/alert routes tested with a forced failure.
- [ ] Seed content remains in git as the migration source of record.

### 3.7 Rollback of the cutover itself

If live mode fails at cutover: **delete `GHOST_URL` and `GHOST_CONTENT_API_KEY` from Vercel and
redeploy.** The seed loader is still in the code until G-CUT passes, so the site returns to seed
mode with no data loss. Disable the snapshot/backup schedules, then follow §2 for a Vercel
deployment rollback if the deleted-env build is not sufficient.

---

## 4. Script inventory

| Script | Mode | Dry run |
| --- | --- | --- |
| `scripts/snapshot-ghost.ts` | scheduled snapshot writer (dormant) | `pnpm exec tsx scripts/snapshot-ghost.ts --dry-run` — clean no-op without Ghost envs |
| `scripts/backup-ghost.ts` | nightly content export (dormant) | `pnpm exec tsx scripts/backup-ghost.ts --dry-run` — clean no-op without Ghost envs |
| `scripts/notify.ts` | alert webhook (dormant) | `pnpm exec tsx scripts/notify.ts --dry-run "message"` |
| `scripts/check-heartbeat.mjs` | build-id freshness | `node scripts/check-heartbeat.mjs --dry-run` |
| `scripts/check-contact.mjs` | contact endpoint drill | `node scripts/check-contact.mjs --dry-run` |
| `scripts/drill-rollback-check.sh` | rollback drill preflight (read-only) | `bash scripts/drill-rollback-check.sh --dry-run` |

## 5. Incident and drill log

| Date | Event | Action | Owner | Outcome |
| --- | --- | --- | --- | --- |
| _pending_ | Phase 6 rollback drill | See §2.5 | Christopher Tapia | _pending_ |
