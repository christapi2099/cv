/**
 * Capability checks. Pure functions that take their environment as arguments
 * so they can be tested with fakes.
 */

/**
 * three.js r163+ requires WebGL 2. Software-only WebGL counts as unsupported
 * (failIfMajorPerformanceCaveat), so slow machines get the CSS fallback.
 * The probe context is released at once so it doesn't count against the
 * browser's context limit.
 */
export function detectWebGL2(doc = globalThis.document) {
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return { supported: false };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { supported: true };
  } catch {
    return { supported: false };
  }
}

/** Returns the reduced-motion MediaQueryList, or null where unsupported. */
export function reducedMotionQuery(win = globalThis.window) {
  return typeof win?.matchMedia === 'function'
    ? win.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
}

/** Heuristic used only to pick a starting tier; adaptive quality corrects it. */
export function isConstrainedDevice(win = globalThis.window) {
  const coarse = typeof win?.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;
  const cores = win?.navigator?.hardwareConcurrency ?? 8;
  return coarse || cores <= 4;
}
