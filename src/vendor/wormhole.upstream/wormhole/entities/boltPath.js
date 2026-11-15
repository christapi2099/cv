/**
 * Pure lightning-bolt path generation (no DOM, no three.js).
 *
 * The main channel is built by recursive midpoint displacement, done in place
 * in a preallocated Float32Array; 1–3 tapering branches split off it. Runs
 * only when a bolt spawns, never per frame, and allocates nothing.
 *
 * Coordinates are 2D screen units (short-side units, centred), like the
 * tunnel shader's `screen` space.
 */

export const BOLT_LEVELS = 5; // main channel: 2^5 + 1 = 33 points
export const BRANCH_LEVELS = 4; // each branch: 2^4 + 1 = 17 points
export const MAX_BRANCHES = 3;

const MAIN_POINTS = (1 << BOLT_LEVELS) + 1;
const BRANCH_POINTS = (1 << BRANCH_LEVELS) + 1;
export const MAX_BOLT_POINTS = MAIN_POINTS + MAX_BRANCHES * BRANCH_POINTS;
export const MAX_BOLT_LINES = 1 + MAX_BRANCHES;

/** Preallocated output for generateBolt(). Reuse it for every bolt. */
export function createBoltBuffers() {
  return {
    points: new Float32Array(MAX_BOLT_POINTS * 2), // x, y
    widths: new Float32Array(MAX_BOLT_POINTS), // half width of the core at each point
    lineStart: new Int32Array(MAX_BOLT_LINES),
    lineCount: new Int32Array(MAX_BOLT_LINES),
    lines: 0,
    pointCount: 0,
  };
}

/**
 * Subdivide the 2-point segment stored at `base` in place, `levels` times.
 * Returns the resulting point count (2^levels + 1).
 */
function subdivide(points, base, levels, displacement, random) {
  let n = 2;
  let d = displacement;
  for (let level = 0; level < levels; level++) {
    // Spread existing points to even slots, from the end so nothing is overwritten.
    for (let i = n - 1; i >= 1; i--) {
      points[(base + 2 * i) * 2] = points[(base + i) * 2];
      points[(base + 2 * i) * 2 + 1] = points[(base + i) * 2 + 1];
    }
    for (let i = 0; i < n - 1; i++) {
      const a = (base + 2 * i) * 2;
      const b = (base + 2 * i + 2) * 2;
      const ax = points[a]; const ay = points[a + 1];
      const dx = points[b] - ax; const dy = points[b + 1] - ay;
      const offset = (random() * 2 - 1) * d; // proportional to segment length
      points[a + 2] = ax + dx * 0.5 - dy * offset;
      points[a + 3] = ay + dy * 0.5 + dx * offset;
    }
    n = 2 * n - 1;
    d *= 0.62;
  }
  return n;
}

/**
 * Fill `out` with a bolt from (x0, y0) to (x1, y1).
 * @param {ReturnType<typeof createBoltBuffers>} out
 * @param {() => number} random  uniform [0, 1)
 * @param {{ width?: number, displacement?: number, branches?: number }} [options]
 *   branches: how many branches (clamped to 1..3); random when omitted.
 */
export function generateBolt(out, x0, y0, x1, y1, random, { width = 0.006, displacement = 0.22, branches } = {}) {
  const { points, widths } = out;
  points[0] = x0; points[1] = y0;
  points[2] = x1; points[3] = y1;
  const mainCount = subdivide(points, 0, BOLT_LEVELS, displacement, random);
  // Pin the end exactly (subdivision never moves endpoints, but be explicit).
  points[(mainCount - 1) * 2] = x1;
  points[(mainCount - 1) * 2 + 1] = y1;
  for (let i = 0; i < mainCount; i++) widths[i] = width * (1 - 0.4 * (i / (mainCount - 1)));
  out.lineStart[0] = 0;
  out.lineCount[0] = mainCount;
  out.lines = 1;
  let used = mainCount;

  const wanted = branches === undefined ? 1 + Math.floor(random() * MAX_BRANCHES) : branches;
  const branchCount = Math.max(1, Math.min(MAX_BRANCHES, Math.round(wanted)));
  const mainLength = Math.hypot(x1 - x0, y1 - y0);
  for (let b = 0; b < branchCount; b++) {
    // Branch from somewhere in the upper two thirds of the main channel.
    const from = 3 + Math.floor(random() * (mainCount * 0.6));
    const fx = points[from * 2]; const fy = points[from * 2 + 1];
    const nx = points[(from + 1) * 2] - fx; const ny = points[(from + 1) * 2 + 1] - fy;
    const nlen = Math.hypot(nx, ny) || 1;
    const turn = (0.35 + random() * 0.45) * (random() < 0.5 ? -1 : 1);
    const cos = Math.cos(turn); const sin = Math.sin(turn);
    const length = mainLength * (0.18 + random() * 0.22);
    const dirx = (nx * cos - ny * sin) / nlen; const diry = (nx * sin + ny * cos) / nlen;
    const base = used;
    points[base * 2] = fx; points[base * 2 + 1] = fy;
    points[(base + 1) * 2] = fx + dirx * length; points[(base + 1) * 2 + 1] = fy + diry * length;
    const count = subdivide(points, base, BRANCH_LEVELS, displacement * 1.1, random);
    const startWidth = widths[from] * 0.6;
    for (let i = 0; i < count; i++) widths[base + i] = startWidth * (1 - 0.92 * (i / (count - 1)));
    out.lineStart[out.lines] = base;
    out.lineCount[out.lines] = count;
    out.lines += 1;
    used += count;
  }
  out.pointCount = used;
  return out;
}

/** Ribbon half-width = core half-width × RIBBON_GLOW (room for the glow falloff). */
export const RIBBON_GLOW = 7;
export const MAX_RIBBON_VERTICES = MAX_BOLT_POINTS * 2;
export const MAX_RIBBON_INDICES = (MAX_BOLT_POINTS - MAX_BOLT_LINES) * 6;

/**
 * Expand a generated bolt into a screen-facing triangle ribbon, writing into
 * preallocated arrays. Returns the number of indices written.
 * @param {ReturnType<typeof createBoltBuffers>} bolt
 * @param {Float32Array} positions  MAX_RIBBON_VERTICES × 3 (x, y, 0)
 * @param {Float32Array} ribbon     MAX_RIBBON_VERTICES × 2 (side -1..1, brightness)
 * @param {Uint16Array} indices     MAX_RIBBON_INDICES
 */
export function buildRibbon(bolt, positions, ribbon, indices, glow = RIBBON_GLOW) {
  const { points, widths } = bolt;
  let v = 0;
  let n = 0;
  for (let line = 0; line < bolt.lines; line++) {
    const start = bolt.lineStart[line];
    const count = bolt.lineCount[line];
    for (let i = 0; i < count; i++) {
      const k = start + i;
      const prev = start + Math.max(i - 1, 0);
      const next = start + Math.min(i + 1, count - 1);
      const tx = points[next * 2] - points[prev * 2];
      const ty = points[next * 2 + 1] - points[prev * 2 + 1];
      const len = Math.hypot(tx, ty) || 1;
      const half = widths[k] * glow;
      const nx = (-ty / len) * half;
      const ny = (tx / len) * half;
      const x = points[k * 2];
      const y = points[k * 2 + 1];
      const brightness = line === 0 ? 1 : 0.8 * (1 - 0.6 * (i / (count - 1)));
      positions[v * 3] = x + nx; positions[v * 3 + 1] = y + ny; positions[v * 3 + 2] = 0;
      ribbon[v * 2] = -1; ribbon[v * 2 + 1] = brightness;
      positions[v * 3 + 3] = x - nx; positions[v * 3 + 4] = y - ny; positions[v * 3 + 5] = 0;
      ribbon[v * 2 + 2] = 1; ribbon[v * 2 + 3] = brightness;
      v += 2;
      if (i > 0) {
        const a = v - 4;
        indices[n++] = a; indices[n++] = a + 1; indices[n++] = a + 2;
        indices[n++] = a + 1; indices[n++] = a + 3; indices[n++] = a + 2;
      }
    }
  }
  return n;
}
