/**
 * Canvas and web-font helpers for the procedural title. Only this module and
 * the element touch fonts. No network access of its own: the font comes from
 * a Google Fonts stylesheet the element adds to <head> (see element.js).
 */

/** Heavy system fonts used when the web font is unavailable. */
export const FALLBACK_FONTS = '"Arial Black", "Helvetica Neue", Impact, Arial, system-ui, sans-serif';

/** @param {Document} doc @returns {(w: number, h: number) => HTMLCanvasElement} */
export function canvasFactory(doc) {
  return (width, height) => {
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  };
}

/**
 * Wait (at most `timeoutMs`) for `family` to load, then return a CSS font
 * list for canvas drawing: the family first, then heavy system fallbacks.
 * Never rejects. If the font never arrives the canvas simply falls back.
 */
export async function loadFont(doc, win, family, timeoutMs = 1500) {
  const list = `"${family}", ${FALLBACK_FONTS}`;
  const fonts = doc?.fonts;
  if (!fonts || typeof fonts.load !== 'function') return list;
  let timer = 0;
  const timeout = new Promise((resolve) => { timer = win.setTimeout(resolve, timeoutMs); });
  try {
    await Promise.race([fonts.load(`900 128px "${family}"`), timeout]);
  } catch {
    // An invalid or blocked font is fine: the fallbacks take over.
  } finally {
    win.clearTimeout(timer);
  }
  return list;
}
