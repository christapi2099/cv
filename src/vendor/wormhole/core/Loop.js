/**
 * requestAnimationFrame loop with a clamped delta time.
 * The first frame after every start() reports dt = 0, so resuming after a
 * hidden tab or an offscreen scroll never produces a jump.
 *
 * Optional frame cap (setFrameCap(fps), 0 = display rate): rAF keeps firing,
 * but ticks are skipped until a full cap interval has passed since the last
 * tick. dt is measured between ticks and still clamped to maxDt.
 */
export class Loop {
  #tick;
  #maxDt;
  #win;
  #rafId = 0;
  #last = -1;
  #running = false;
  #capMs = 0;

  /**
   * @param {(dt: number, nowMs: number) => void} tick
   * @param {{ maxDt: number, win?: Window }} options
   */
  constructor(tick, { maxDt, win = globalThis.window }) {
    this.#tick = tick;
    this.#maxDt = maxDt;
    this.#win = win;
  }

  get running() {
    return this.#running;
  }

  /** @param {number} fps  0 (or anything not positive) = no cap */
  setFrameCap(fps) {
    this.#capMs = fps > 0 ? 1000 / fps : 0;
  }

  get frameCapMs() {
    return this.#capMs;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = -1;
    this.#rafId = this.#win.requestAnimationFrame(this.#frame);
  }

  stop() {
    if (!this.#running) return;
    this.#running = false;
    this.#win.cancelAnimationFrame(this.#rafId);
    this.#rafId = 0;
  }

  #frame = (now) => {
    if (!this.#running) return;
    this.#rafId = this.#win.requestAnimationFrame(this.#frame);
    const elapsed = this.#last < 0 ? 0 : Math.max(now - this.#last, 0);
    // 1 ms tolerance: rAF timestamps jitter around the display interval.
    if (this.#capMs && this.#last >= 0 && elapsed < this.#capMs - 1) return;
    const dt = Math.min(elapsed / 1000, this.#maxDt);
    this.#last = now;
    this.#tick(dt, now);
  };
}
