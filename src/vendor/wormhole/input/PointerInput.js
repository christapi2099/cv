/**
 * Normalised pointer position in [-1, 1] (y up), eased exponentially so the
 * camera drifts rather than snaps. Listens on window because the canvas has
 * pointer-events: none and sits behind the page content.
 */
export class PointerInput {
  #win;
  #target = { x: 0, y: 0 };
  #enabled;
  /** Eased value read by the scene each frame. Mutated in place (no allocations). */
  value = { x: 0, y: 0 };

  /**
   * @param {{ signal: AbortSignal, enabled: boolean, win?: Window }} options
   */
  constructor({ signal, enabled, win = globalThis.window }) {
    this.#win = win;
    this.#enabled = enabled;
    win.addEventListener('pointermove', this.#onMove, { passive: true, signal });
    // Touch has no hover: ease back to centre when the finger lifts, or when the
    // browser takes the gesture over for scrolling (pointercancel).
    win.addEventListener('pointerup', this.#onTouchEnd, { passive: true, signal });
    win.addEventListener('pointercancel', this.#onTouchEnd, { passive: true, signal });
    win.addEventListener('blur', this.#recenter, { signal });
    win.document.documentElement.addEventListener('pointerleave', this.#recenter, { signal });
  }

  setEnabled(enabled) {
    this.#enabled = enabled;
    if (!enabled) this.#recenter();
  }

  /** @param {number} dt seconds  @param {number} rate easing rate (1/s) */
  update(dt, rate) {
    const k = 1 - Math.exp(-rate * dt);
    this.value.x += (this.#target.x - this.value.x) * k;
    this.value.y += (this.#target.y - this.value.y) * k;
  }

  #onMove = (event) => {
    if (!this.#enabled) return;
    const w = this.#win.innerWidth || 1;
    const h = this.#win.innerHeight || 1;
    this.#target.x = (event.clientX / w) * 2 - 1;
    this.#target.y = 1 - (event.clientY / h) * 2;
  };

  #onTouchEnd = (event) => {
    if (event.pointerType !== 'mouse') this.#recenter();
  };

  #recenter = () => {
    this.#target.x = 0;
    this.#target.y = 0;
  };
}
