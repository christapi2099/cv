/** Ghost environment contract (plan.md §3 env table, D13). */

export interface GhostCredentials {
  url: string;
  key: string;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function hasGhostUrl(env: NodeJS.ProcessEnv = process.env): boolean {
  return clean(env.GHOST_URL) !== null;
}

export function hasGhostCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return clean(env.GHOST_URL) !== null && clean(env.GHOST_CONTENT_API_KEY) !== null;
}

/**
 * Throws with an actionable message when the pair is incomplete. The facade
 * catches this like any other live-fetch failure, so a snapshot can still
 * serve the build; without a snapshot the build fails loudly.
 */
export function readGhostCredentials(env: NodeJS.ProcessEnv = process.env): GhostCredentials {
  const url = clean(env.GHOST_URL);
  if (!url) {
    throw new Error(
      'GHOST_URL is not set. Unset both Ghost variables to build from seed content, or set GHOST_URL and GHOST_CONTENT_API_KEY for live mode.',
    );
  }

  const key = clean(env.GHOST_CONTENT_API_KEY);
  if (!key) {
    throw new Error(
      'GHOST_URL is set but GHOST_CONTENT_API_KEY is missing. Set both (Phase G cutover) or unset GHOST_URL to build from seed content.',
    );
  }

  return { url: url.replace(/\/+$/, ''), key };
}
