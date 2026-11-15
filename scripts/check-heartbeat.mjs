#!/usr/bin/env node
/**
 * Gate G5 — deployed build-id heartbeat (plan §4 Phase 5.1).
 *
 * Fetches `<origin>/build-id.json` from a deployed URL and compares its commit
 * SHA with the latest commit on the deploy branch. A stale build (deployed SHA
 * ≠ branch head) exits non-zero, which is how R10's "webhook/rebuild gap"
 * becomes observable without Ghost delivery logs.
 *
 * Usage:
 *   node scripts/check-heartbeat.mjs [--dry-run] [--url <origin>] [--sha <sha>]
 *                                    [--max-age-minutes <n>] [--require-url]
 *
 * URL resolution (first wins): --url, HEARTBEAT_URL, DEPLOY_URL, SITE_URL.
 * Expected SHA resolution: --sha, GIT_SHA, `git rev-parse --short=12 HEAD`.
 *
 * With no URL configured the check SKIPS (exit 0) so CI stays green before the
 * first deploy; `--require-url` turns that skip into a failure for monitors.
 * `--dry-run` prints what would be requested and never touches the network.
 */
import { execFileSync } from 'node:child_process';

const TIMEOUT_MS = 10_000;

function flagValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function firstValue(...values) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function resolveExpectedSha() {
  const explicit = firstValue(flagValue('--sha'), process.env.GIT_SHA);
  if (explicit) return explicit.toLowerCase();
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .toLowerCase();
  } catch {
    return undefined;
  }
}

/** Treat `abc1234` and `abc1234def56...` as the same commit. */
function sameCommit(a, b) {
  if (!a || !b) return false;
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  const shortest = Math.min(left.length, right.length);
  return shortest >= 7 && left.slice(0, shortest) === right.slice(0, shortest);
}

function buildEndpoint(base) {
  const url = new URL(base);
  if (url.pathname.endsWith('.json')) return url;
  url.pathname = '/build-id.json';
  url.search = '';
  url.hash = '';
  return url;
}

function describeError(error) {
  if (error instanceof Error) {
    return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
  }
  return String(error);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const requireUrl = process.argv.includes('--require-url');
  const maxAgeMinutes = Number(flagValue('--max-age-minutes') ?? '0');
  const base = firstValue(
    flagValue('--url'),
    process.env.HEARTBEAT_URL,
    process.env.DEPLOY_URL,
    process.env.SITE_URL,
  );
  const expectedSha = resolveExpectedSha();

  if (!base) {
    const message =
      'no URL configured (set HEARTBEAT_URL, DEPLOY_URL or SITE_URL, or pass --url).';
    if (dryRun) {
      console.log(`[heartbeat] Dry run: ${message} Nothing would be fetched.`);
      return;
    }
    if (requireUrl) {
      console.error(`[heartbeat] FAIL: ${message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[heartbeat] Skipped: ${message}`);
    return;
  }

  const endpoint = buildEndpoint(base);

  if (dryRun) {
    console.log(`[heartbeat] Dry run: GET ${endpoint.href}`);
    console.log(`[heartbeat] Expected branch SHA: ${expectedSha ?? 'unknown (not a git checkout)'}`);
    if (Number.isFinite(maxAgeMinutes) && maxAgeMinutes > 0) {
      console.log(`[heartbeat] Would also require builtAt < ${maxAgeMinutes} minutes old.`);
    }
    console.log('[heartbeat] Would compare the deployed `sha` field and exit 1 on a mismatch.');
    return;
  }

  if (!expectedSha) {
    console.error('[heartbeat] FAIL: cannot resolve the expected commit SHA (not a git checkout).');
    process.exitCode = 1;
    return;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`[heartbeat] FAIL: ${endpoint.href} unreachable — ${describeError(error)}`);
    process.exitCode = 1;
    return;
  }

  if (!response.ok) {
    console.error(`[heartbeat] FAIL: ${endpoint.href} returned HTTP ${response.status}.`);
    process.exitCode = 1;
    return;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    console.error(`[heartbeat] FAIL: response was not JSON — ${describeError(error)}`);
    process.exitCode = 1;
    return;
  }

  const deployedSha = typeof payload?.sha === 'string' ? payload.sha.toLowerCase() : '';
  const builtAt = typeof payload?.builtAt === 'string' ? payload.builtAt : undefined;

  if (!deployedSha) {
    console.error('[heartbeat] FAIL: /build-id.json has no `sha` field.');
    process.exitCode = 1;
    return;
  }

  if (!sameCommit(deployedSha, expectedSha)) {
    console.error(
      `[heartbeat] FAIL: deployed ${deployedSha} is stale; branch head is ${expectedSha}` +
        (builtAt ? ` (built ${builtAt}).` : '.'),
    );
    console.error('[heartbeat] A merge may not have rebuilt — check the Vercel deployment/webhook.');
    process.exitCode = 1;
    return;
  }

  if (Number.isFinite(maxAgeMinutes) && maxAgeMinutes > 0 && builtAt) {
    const ageMinutes = (Date.now() - Date.parse(builtAt)) / 60_000;
    if (!Number.isFinite(ageMinutes) || ageMinutes > maxAgeMinutes) {
      console.error(
        `[heartbeat] FAIL: deployed build is ${ageMinutes.toFixed(1)} minutes old ` +
          `(limit ${maxAgeMinutes}); built ${builtAt}.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `[heartbeat] OK: ${endpoint.href} serves ${deployedSha} (branch head ${expectedSha})` +
      (builtAt ? `, built ${builtAt}.` : '.'),
  );
}

main().catch((error) => {
  console.error(`[heartbeat] FAIL: ${describeError(error)}`);
  process.exitCode = 1;
});
