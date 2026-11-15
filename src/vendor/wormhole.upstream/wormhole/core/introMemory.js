/**
 * "Played this session" memory for intro="once". sessionStorage can throw
 * (privacy modes, sandboxed iframes, storage disabled): every access is
 * guarded and failure simply means "not played".
 */
const KEY = 'wormhole:intro-played';

export function hasPlayedIntro(win) {
  try {
    return win?.sessionStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroPlayed(win) {
  try {
    win?.sessionStorage?.setItem(KEY, '1');
  } catch {
    // Storage unavailable: the intro may play again on the next load. Harmless.
  }
}
