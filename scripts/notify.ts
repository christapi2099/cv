/**
 * Notification hook — DORMANT until Phase G.
 *
 * Posts a plain-text alert to NOTIFY_WEBHOOK_URL. Used by the cutover-era
 * monitoring jobs (snapshot staleness, backup failure). The URL is a secret:
 * it is read from the environment and never printed.
 *
 *   pnpm tsx scripts/notify.ts --dry-run "snapshot stale"
 *   NOTIFY_WEBHOOK_URL=https://… pnpm tsx scripts/notify.ts "snapshot stale"
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const message = args.filter((arg) => arg !== '--dry-run').join(' ').trim();

  if (!message) {
    throw new Error('Usage: pnpm tsx scripts/notify.ts [--dry-run] "message"');
  }

  if (dryRun) {
    console.log(`[notify] Dry run: ${message}`);
    return;
  }

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error('NOTIFY_WEBHOOK_URL is not set.');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    throw new Error(`Notification webhook returned HTTP ${response.status}.`);
  }

  console.log('[notify] Notification delivered.');
}

main().catch((error: unknown) => {
  console.error(`[notify] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
