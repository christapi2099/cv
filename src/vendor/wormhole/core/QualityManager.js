import { TIER_ORDER } from '../config.js';

/**
 * Adaptive quality from frame timing.
 *
 * rAF intervals are quantised to the display's refresh rate, so fixed
 * millisecond thresholds misjudge 60 Hz vs 120 Hz screens. Instead we learn
 * the refresh interval (the fastest smoothed interval seen, assumed no slower
 * than 60 Hz) and compare against it:
 *   - step down when frames stay > 1.35× the refresh interval (and slower
 *     than 18 ms) for 1.5 s
 *   - step up when they stay < 1.1× for 6 s, at most once every 30 s
 *
 * Capped displays (battery saver, iOS Low Power Mode: rAF at 30 Hz) look slow
 * but are not GPU-bound. Each run of step-downs is therefore a probe: if even
 * the lowest tier is no faster than where the probe started, the slowness
 * was the display's cadence, so the original tier is restored and that
 * cadence becomes the learned refresh interval.
 *
 * A tier that was stepped down from (and did help) is never tried again, so
 * the manager cannot oscillate.
 *
 * Under a deliberate frame cap (the storm look's 30 fps ambient), the cap
 * interval is the reference instead of the display's refresh interval, so
 * on-time capped frames never look slow.
 */
export class QualityManager {
  static EMA_ALPHA = 0.1;
  static DOWN_RATIO = 1.35;
  static UP_RATIO = 1.1;
  static DOWN_AFTER_MS = 1500;
  static UP_AFTER_MS = 6000;
  static UP_COOLDOWN_MS = 30000;
  static WARMUP_FRAMES = 30;
  /** Frames at or under this are smooth enough on any display; never step down. */
  static SMOOTH_ENOUGH_MS = 18;
  /** Assume at least a 60 Hz display; faster screens are learned. */
  static MAX_REFRESH_MS = 1000 / 60;
  /** A probe "helped" if frames got at least this much faster. */
  static MIN_GAIN = 0.15;

  #index;
  #adaptive;
  #onChange;
  #ceiling = TIER_ORDER.length - 1;
  #ema = 0;
  #refresh = QualityManager.MAX_REFRESH_MS;
  #frames = 0;
  #slowSince = -1;
  #fastSince = -1;
  #lastUpgrade = -Infinity;
  #probe = null; // { origin: tier index, baseline: ms } while stepping down
  #capMs = 0;

  /**
   * @param {{ initialTier: string, adaptive: boolean, onChange: (tierName: string) => void }} options
   */
  constructor({ initialTier, adaptive, onChange }) {
    this.#index = Math.max(0, TIER_ORDER.indexOf(initialTier));
    this.#adaptive = adaptive;
    this.#onChange = onChange;
  }

  get tier() {
    return TIER_ORDER[this.#index];
  }

  /** Manually pin a tier ('auto' re-enables adaptation from the current tier). */
  setTier(name) {
    this.#probe = null;
    if (name === 'auto') {
      this.#adaptive = true;
      this.#ceiling = TIER_ORDER.length - 1;
      this.reset();
      return;
    }
    const index = TIER_ORDER.indexOf(name);
    if (index < 0) return;
    this.#adaptive = false;
    this.#apply(index);
  }

  /** Tell the manager about a deliberate frame cap (ms per frame; 0 = none). */
  setFrameCap(capMs) {
    const next = capMs > 0 ? capMs : 0;
    if (next === this.#capMs) return;
    this.#capMs = next;
    this.#probe = null;
    this.reset();
  }

  /** Forget timing history, e.g. after the loop was paused. */
  reset() {
    this.#ema = 0;
    this.#frames = 0;
    this.#slowSince = -1;
    this.#fastSince = -1;
  }

  /**
   * @param {number} dtMs  frame interval in milliseconds (0 = skip)
   * @param {number} nowMs monotonic timestamp
   */
  sample(dtMs, nowMs) {
    if (!this.#adaptive || dtMs <= 0) return;

    const { EMA_ALPHA, WARMUP_FRAMES } = QualityManager;
    this.#ema = this.#frames === 0 ? dtMs : this.#ema + EMA_ALPHA * (dtMs - this.#ema);
    this.#frames += 1;
    if (this.#frames < WARMUP_FRAMES) return;

    if (!this.#capMs) this.#refresh = Math.min(this.#refresh, this.#ema);
    this.#evaluate(nowMs);
  }

  #evaluate(now) {
    const { DOWN_RATIO, UP_RATIO, DOWN_AFTER_MS, SMOOTH_ENOUGH_MS } = QualityManager;
    const reference = Math.max(this.#refresh, this.#capMs);
    const slow = this.#ema / reference > DOWN_RATIO && this.#ema > SMOOTH_ENOUGH_MS;

    if (!slow) {
      this.#slowSince = -1;
      this.#probe = null; // a step-down (if any) fixed it: keep the lower tier
      if (this.#ema / reference < UP_RATIO) this.#considerUpgrade(now);
      else this.#fastSince = -1;
      return;
    }

    this.#fastSince = -1;
    if (this.#slowSince < 0) {
      this.#slowSince = now;
      return;
    }
    if (now - this.#slowSince < DOWN_AFTER_MS) return;

    this.#probe ??= { origin: this.#index, baseline: this.#ema };
    if (this.#index > 0) {
      this.#ceiling = this.#index - 1;
      this.#apply(this.#index - 1);
      return;
    }
    this.#concludeProbe();
  }

  /** At the lowest tier and still slow: decide whether quality was ever the cause. */
  #concludeProbe() {
    const probe = this.#probe;
    this.#probe = null;
    this.#slowSince = -1;
    if (!probe) return;
    const gain = 1 - this.#ema / probe.baseline;
    if (gain >= QualityManager.MIN_GAIN) return; // genuinely slow device: stay low

    // Not GPU-bound: the display or browser caps the frame rate.
    if (!this.#capMs) this.#refresh = probe.baseline;
    this.#ceiling = TIER_ORDER.length - 1;
    this.#apply(probe.origin);
  }

  #considerUpgrade(now) {
    const { UP_AFTER_MS, UP_COOLDOWN_MS } = QualityManager;
    if (this.#index >= this.#ceiling) return;
    if (this.#fastSince < 0) {
      this.#fastSince = now;
    } else if (now - this.#fastSince >= UP_AFTER_MS && now - this.#lastUpgrade >= UP_COOLDOWN_MS) {
      this.#lastUpgrade = now;
      this.#apply(this.#index + 1);
    }
  }

  #apply(index) {
    if (index === this.#index) return;
    this.#index = index;
    this.reset();
    this.#onChange(this.tier);
  }
}
