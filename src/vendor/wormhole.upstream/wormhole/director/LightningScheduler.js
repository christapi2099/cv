import { LIGHTNING } from '../config.js';

/**
 * Pure lightning policy: decides when flashes may happen and shapes their
 * envelope. No DOM, no three.js.
 *
 * Safety (WCAG 2.3.1):
 * - flash starts are at least `minGap` (1 s) apart, whatever asks for them;
 * - every flash is a smooth rise (`rise`, 60 ms) and an eased decay
 *   (`decay`, >= 350 ms), never a hard on/off square;
 * - in the ambient phase the flash peak is capped at `ambientFlashCap` (0.25);
 * - nothing at all when the mode is 'off' or reduced motion is on.
 *
 * Modes: 'on' (intro strikes + rare ambient bolts), 'intro-only', 'off'.
 */

/**
 * Flash envelope at `age` seconds after a flash started, for a peak of 1.
 * Smoothstep rise, then a smooth (cubic ease-out shaped) decay to exactly 0.
 */
export function flashEnvelope(age, rise = LIGHTNING.rise, decay = LIGHTNING.decay) {
  if (!(age >= 0)) return 0;
  if (age < rise) {
    const t = age / rise;
    return t * t * (3 - 2 * t);
  }
  const t = (age - rise) / decay;
  if (t >= 1) return 0;
  const u = 1 - t;
  // u^2 (3 - 2u) reversed: starts flat at the peak, ends flat at zero.
  return u * u * (3 - 2 * u);
}

export class LightningScheduler {
  #cfg;
  #random;
  #mode;
  #reducedMotion;
  #phase = 'intro';
  #sinceFlash = Infinity; // s since the last flash started
  #flashAge = Infinity;
  #flashPeak = 0;
  #untilAmbient = Infinity;

  /** Current cloud flash (0..1) and where it is (short-side screen units). Read each frame. */
  flash = 0;
  flashX = 0;
  flashY = 0;

  /**
   * @param {{ mode?: string, reducedMotion?: boolean, random?: () => number, config?: object }} [options]
   */
  constructor({ mode = 'on', reducedMotion = false, random = Math.random, config = LIGHTNING } = {}) {
    this.#cfg = config;
    this.#random = random;
    this.#mode = mode;
    this.#reducedMotion = reducedMotion;
  }

  get mode() {
    return this.#mode;
  }

  get phase() {
    return this.#phase;
  }

  /** Seconds until the next ambient bolt (Infinity when none is scheduled). */
  get untilAmbient() {
    return this.#untilAmbient;
  }

  setMode(mode) {
    this.#mode = mode;
    if (!this.#allowed()) this.#clear();
    else if (this.#phase === 'ambient' && !Number.isFinite(this.#untilAmbient)) this.#scheduleAmbient();
  }

  setReducedMotion(reduced) {
    this.#reducedMotion = Boolean(reduced);
    if (this.#reducedMotion) this.#clear();
    else if (this.#phase === 'ambient') this.#scheduleAmbient();
  }

  /** 'intro' while the intro plays, 'ambient' afterwards. */
  setPhase(phase) {
    this.#phase = phase === 'ambient' ? 'ambient' : 'intro';
    if (this.#phase === 'ambient') this.#scheduleAmbient();
    else this.#untilAmbient = Infinity;
  }

  /** True if a flash could start right now. */
  canFlash() {
    return this.#allowed() && this.#sinceFlash >= this.#cfg.minGap;
  }

  /**
   * Ask for a flash (an intro strike, or an ambient bolt). Returns false when
   * the policy refuses it, in which case no bolt should be drawn either.
   */
  trigger(peak, x, y) {
    if (!this.canFlash()) return false;
    const cap = this.#phase === 'ambient' ? this.#cfg.ambientFlashCap : 1;
    this.#flashPeak = Math.min(Math.max(0, peak), cap);
    this.#flashAge = 0;
    this.#sinceFlash = 0;
    this.flashX = x;
    this.flashY = y;
    this.flash = 0;
    return true;
  }

  /**
   * Advance time. Returns true when an ambient bolt fired this step; the
   * bolt's end point is then (flashX, flashY).
   */
  update(dt) {
    const step = Math.max(0, dt);
    this.#sinceFlash += step;
    this.#flashAge += step;
    this.flash = this.#allowed() ? this.#flashPeak * flashEnvelope(this.#flashAge, this.#cfg.rise, this.#cfg.decay) : 0;

    if (this.#phase !== 'ambient' || !Number.isFinite(this.#untilAmbient)) return false;
    this.#untilAmbient -= step;
    if (this.#untilAmbient > 0) return false;
    // Pick a point on the cloud wall, outside the calm zone behind centred text.
    const angle = this.#random() * Math.PI * 2;
    const radius = 0.55 + this.#random() * 0.25;
    const fired = this.trigger(this.#cfg.ambientFlashCap, Math.cos(angle) * radius, Math.sin(angle) * radius * 0.75);
    this.#scheduleAmbient();
    if (!fired) return false;
    this.flash = 0;
    return true;
  }

  #allowed() {
    if (this.#reducedMotion || this.#mode === 'off') return false;
    return this.#mode === 'on' || this.#phase === 'intro';
  }

  #scheduleAmbient() {
    const { ambientGapMin, ambientGapMax } = this.#cfg;
    const ambientAllowed = !this.#reducedMotion && this.#mode === 'on';
    this.#untilAmbient = ambientAllowed
      ? ambientGapMin + this.#random() * (ambientGapMax - ambientGapMin)
      : Infinity;
  }

  #clear() {
    this.flash = 0;
    this.#flashPeak = 0;
    this.#flashAge = Infinity;
    this.#untilAmbient = Infinity;
  }
}
