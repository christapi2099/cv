/**
 * Canvas 2D artwork for textures, drawn once (never per frame). No three.js
 * and no document access: the caller injects `createCanvas(w, h)`, so this is
 * shared by the entities and the shader harness.
 */

const MAX_CANVAS = 2048;

/** Split "FIRST LAST NAME" at the space nearest the middle (for portrait). */
export function splitTitle(text) {
  const spaces = [];
  for (let i = 0; i < text.length; i++) if (text[i] === ' ') spaces.push(i);
  if (!spaces.length) return [text];
  const mid = text.length / 2;
  let best = spaces[0];
  for (const s of spaces) if (Math.abs(s - mid) < Math.abs(best - mid)) best = s;
  return [text.slice(0, best), text.slice(best + 1)];
}

/**
 * White text on transparent, used as an alpha mask.
 * @param {(w: number, h: number) => HTMLCanvasElement} createCanvas
 * @param {string} text           already validated / uppercased
 * @param {string} fontFamilyCss  e.g. '"Michroma", "Arial Black", sans-serif'
 * @param {boolean} twoLines      wrap to two lines (portrait screens)
 * @returns {{ canvas: HTMLCanvasElement, aspect: number, lines: number }}
 */
export function drawLogoMask(createCanvas, text, fontFamilyCss, twoLines) {
  const lines = twoLines ? splitTitle(text) : [text];
  let size = 160;
  const pad = Math.round(size * 0.35);
  const measureCanvas = createCanvas(4, 4);
  const m = measureCanvas.getContext('2d');
  const font = (px) => `900 ${px}px ${fontFamilyCss}`;
  m.font = font(size);
  if ('letterSpacing' in m) m.letterSpacing = `${Math.round(size * 0.04)}px`;
  let widest = Math.max(...lines.map((line) => m.measureText(line).width));
  if (widest + pad * 2 > MAX_CANVAS) {
    size = Math.floor(size * (MAX_CANVAS - pad * 2) / widest);
    m.font = font(size);
    widest = Math.max(...lines.map((line) => m.measureText(line).width));
  }
  measureCanvas.width = 0; measureCanvas.height = 0; // release

  const lineHeight = Math.round(size * 1.15);
  const width = Math.min(MAX_CANVAS, Math.ceil(widest + pad * 2));
  const height = Math.ceil(lineHeight * lines.length + pad * 2);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.font = font(size);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.04)}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, pad + lineHeight * (i + 0.5));
  });
  return { canvas, aspect: width / height, lines: lines.length };
}

/**
 * World-unit height for the title plane so that, at distance `dist`, it spans
 * 80% of the viewport width, never more than 1.5× the short side, and never
 * taller than 30% of the viewport height.
 */
export function logoFit(viewAspect, maskAspect, tanHalfShort, dist) {
  const shortWorld = 2 * dist * tanHalfShort;
  const landscape = viewAspect >= 1;
  const widthWorld = landscape ? shortWorld * viewAspect : shortWorld;
  const heightWorld = landscape ? shortWorld : shortWorld / viewAspect;
  const targetWidth = Math.min(0.8 * widthWorld, 1.5 * shortWorld);
  return Math.min(targetWidth / maskAspect, 0.3 * heightWorld);
}

/**
 * CRT screen: green-on-black prompt "> hello world" plus scanlines. The
 * blinking "_" cursor is drawn by the shader in the returned uv rect
 * (uv origin bottom-left, as three's CanvasTexture uses flipY = true).
 * @returns {{ canvas: HTMLCanvasElement, cursor: [number, number, number, number] }}
 */
export function drawScreenTexture(createCanvas) {
  const width = 512;
  const height = 384;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const bg = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.7);
  bg.addColorStop(0, '#031509');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const size = 38;
  const x = 46;
  const y = 120;
  ctx.font = `600 ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5dff8a';
  ctx.shadowColor = 'rgba(93, 255, 138, 0.8)';
  ctx.shadowBlur = 14;
  const prompt = '> hello world';
  ctx.fillText(prompt, x, y);
  ctx.globalAlpha = 0.55;
  ctx.font = `500 ${Math.round(size * 0.6)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText('READY.', x, y + 64);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.font = `600 ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace`;
  const end = x + ctx.measureText(prompt).width + 3;

  // Scanlines.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  for (let row = 0; row < height; row += 4) ctx.fillRect(0, row, width, 2);

  const cursorW = size * 0.6;
  const cursorTop = y - 4; // underscore just below the baseline
  const cursorBottom = y + 4;
  const cursor = [end / width, 1 - cursorBottom / height, (end + cursorW) / width, 1 - cursorTop / height];
  return { canvas, cursor };
}
