/**
 * Observes the container's size (ResizeObserver) and the screen's pixel ratio
 * (matchMedia), coalescing bursts into at most one callback per frame.
 */
export class ResizeService {
  #el;
  #onResize;
  #win;
  #observer = null;
  #dprQuery = null;
  #pending = 0;
  #disposed = false;

  /**
   * @param {Element} el
   * @param {(size: { width: number, height: number }) => void} onResize
   * @param {{ win?: Window }} [options]
   */
  constructor(el, onResize, { win = globalThis.window } = {}) {
    this.#el = el;
    this.#onResize = onResize;
    this.#win = win;

    if (typeof win.ResizeObserver === 'function') {
      this.#observer = new win.ResizeObserver(this.#schedule);
      this.#observer.observe(el);
    }
    this.#watchPixelRatio();
  }

  /** Current CSS-pixel size of the container, never below 1×1. */
  measure() {
    const rect = this.#el.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  }

  dispose() {
    this.#disposed = true;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#dprQuery?.removeEventListener('change', this.#onPixelRatioChange);
    this.#dprQuery = null;
    if (this.#pending) this.#win.cancelAnimationFrame(this.#pending);
    this.#pending = 0;
  }

  #schedule = () => {
    if (this.#pending || this.#disposed) return;
    this.#pending = this.#win.requestAnimationFrame(() => {
      this.#pending = 0;
      if (!this.#disposed) this.#onResize(this.measure());
    });
  };

  // A resolution media query only matches one DPR, so re-arm it after each change
  // (e.g. dragging the window to another monitor or zooming the page).
  #watchPixelRatio() {
    if (typeof this.#win.matchMedia !== 'function') return;
    const dpr = this.#win.devicePixelRatio || 1;
    this.#dprQuery = this.#win.matchMedia(`(resolution: ${dpr}dppx)`);
    this.#dprQuery.addEventListener('change', this.#onPixelRatioChange, { once: true });
  }

  #onPixelRatioChange = () => {
    if (this.#disposed) return;
    this.#watchPixelRatio();
    this.#schedule();
  };
}
