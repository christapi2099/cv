#!/usr/bin/env node
/**
 * Gate G5 — contact endpoint drill (plan §4 Phase 5.1, D12).
 *
 * Posts a honeypot-marked synthetic payload to CONTACT_ENDPOINT. The endpoint
 * contract is: a submission that fills the hidden honeypot is rejected with a
 * clear non-2xx failure. That is the proof the function is alive *and* still
 * filtering spam, without ever delivering a message.
 *
 * Failure taxonomy:
 *   - network/TLS/timeout               → alarm (exit 1): function unreachable
 *   - HTTP 5xx                          → alarm (exit 1): reachable but unhealthy
 *   - HTTP 2xx to a honeypot payload    → alarm (exit 1): contract violation
 *   - HTTP 4xx with a failure body      → alive (exit 0)
 *
 * Usage:
 *   node scripts/check-contact.mjs [--dry-run] [--url <endpoint>] [--require-url]
 *
 * URL resolution: --url, CONTACT_ENDPOINT. With no endpoint the check SKIPS
 * (exit 0) — CI must stay green before Lane 0B provisions the function.
 * `--dry-run` prints the request it would make and never touches the network.
 */

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

function describeError(error) {
  if (error instanceof Error) {
    return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
  }
  return String(error);
}

const PAYLOAD = {
  name: 'Heartbeat Bot',
  email: 'heartbeat@example.invalid',
  message:
    'Automated contact-endpoint health check (G5). This honeypot-marked payload must be rejected; it is not a real inquiry.',
  // The site form's hidden anti-spam field (src/pages/contact.astro).
  company: 'heartbeat-honeypot',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const requireUrl = process.argv.includes('--require-url');
  const endpoint = firstValue(flagValue('--url'), process.env.CONTACT_ENDPOINT);

  if (!endpoint) {
    const message = 'no endpoint configured (set CONTACT_ENDPOINT or pass --url).';
    if (dryRun) {
      console.log(`[contact] Dry run: ${message} Nothing would be posted.`);
      return;
    }
    if (requireUrl) {
      console.error(`[contact] FAIL: ${message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[contact] Skipped: ${message}`);
    return;
  }

  let target;
  try {
    target = new URL(endpoint);
  } catch {
    console.error(`[contact] FAIL: CONTACT_ENDPOINT is not a valid URL (${endpoint}).`);
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(`[contact] Dry run: POST ${target.href}`);
    console.log(`[contact] Payload: ${JSON.stringify(PAYLOAD)}`);
    console.log('[contact] Would expect HTTP 4xx (honeypot rejected) and exit 1 on 2xx/5xx/network failure.');
    return;
  }

  let response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: {
        accept: 'text/html, application/json',
        'content-type': 'application/json',
        'user-agent': 'tapia-site-heartbeat/1.0 (+contact endpoint drill)',
      },
      body: JSON.stringify(PAYLOAD),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`[contact] FAIL: ${target.href} unreachable — ${describeError(error)}`);
    process.exitCode = 1;
    return;
  }

  const body = (await response.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 200);

  if (response.status >= 500) {
    console.error(
      `[contact] FAIL: endpoint is reachable but unhealthy (HTTP ${response.status})` +
        (body ? ` — ${body}` : '.'),
    );
    process.exitCode = 1;
    return;
  }

  if (response.status >= 200 && response.status < 300) {
    console.error(
      `[contact] FAIL: honeypot payload was accepted (HTTP ${response.status}); ` +
        'the spam contract expects a clear 4xx rejection.' +
        (body ? ` Body: ${body}` : ''),
    );
    process.exitCode = 1;
    return;
  }

  if (response.status >= 400 && response.status < 500) {
    console.log(
      `[contact] OK: endpoint alive and rejected the honeypot payload (HTTP ${response.status})` +
        (body ? ` — ${body}` : '.'),
    );
    return;
  }

  console.error(`[contact] FAIL: unexpected HTTP ${response.status} from the contact endpoint.`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[contact] FAIL: ${describeError(error)}`);
  process.exitCode = 1;
});
