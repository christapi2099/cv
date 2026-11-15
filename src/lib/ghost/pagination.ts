/**
 * Ghost 6 Content API pagination (plan.md §3, R9).
 *
 * `limit: 'all'` is banned: the API silently caps it at 100. Every live feed
 * must page with `limit=100`, follow `meta.pagination.next`, delay briefly
 * between pages, and assert the collected count equals the reported total.
 * Any inconsistency throws — the facade then falls back to the snapshot.
 */
import { setTimeout as delay } from 'node:timers/promises';

export interface GhostPage<T> {
  items: readonly T[];
  /** `meta.pagination.next` — the next page number, or null on the last page. */
  next: number | null;
  /** `meta.pagination.total`. */
  total: number;
}

export interface CollectPagesOptions {
  /** Hard bound; a runaway `next` can never page forever. */
  maxPages?: number;
  /** Inter-page delay (Ghost asks integrations to be polite). */
  delayMs?: number;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
}

export interface CollectedPages<T> {
  items: T[];
  total: number;
  pages: number;
}

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_DELAY_MS = 250;

export async function collectAllPages<T>(
  fetchPage: (page: number) => Promise<GhostPage<T>>,
  options: CollectPagesOptions = {},
): Promise<CollectedPages<T>> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => delay(ms));

  const items: T[] = [];
  let page = 1;
  let pages = 0;
  let total = 0;

  for (;;) {
    if (pages >= maxPages) {
      throw new Error(
        `Ghost pagination exceeded the ${maxPages}-page safety bound. Refusing to follow next=${String(page)}.`,
      );
    }

    const result = await fetchPage(page);
    pages += 1;
    total = result.total;
    items.push(...result.items);

    if (result.next === null) break;
    if (result.next !== page + 1) {
      throw new Error(
        `Ghost pagination returned next=${String(result.next)} after page ${page}; expected ${page + 1}.`,
      );
    }

    if (delayMs > 0) await sleep(delayMs);
    page = result.next;
  }

  if (items.length !== total) {
    throw new Error(
      `Ghost pagination integrity failure: fetched ${items.length} posts but the API reports a total of ${total}.`,
    );
  }

  return { items, total, pages };
}
