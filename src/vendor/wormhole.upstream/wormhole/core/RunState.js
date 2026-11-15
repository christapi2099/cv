/**
 * Pure run-state machine: the loop runs only when every condition allows it.
 * Kept free of DOM and three.js so the decision logic is unit-testable.
 */
export class RunState {
  #flags;

  /** @param {{ wantsRun: boolean, visible?: boolean, reducedMotion?: boolean }} initial */
  constructor({ wantsRun, visible = true, reducedMotion = false }) {
    this.#flags = { wantsRun, visible, reducedMotion, contextLost: false };
  }

  /**
   * @param {'wantsRun'|'visible'|'reducedMotion'|'contextLost'} key
   * @param {boolean} value
   */
  set(key, value) {
    if (!Object.hasOwn(this.#flags, key)) throw new RangeError(`Unknown run flag "${key}"`);
    this.#flags[key] = Boolean(value);
  }

  get(key) {
    return this.#flags[key];
  }

  get shouldRun() {
    const f = this.#flags;
    return f.wantsRun && f.visible && !f.contextLost && !f.reducedMotion;
  }

  /** A still frame is useful only when idle, on screen, and with a live context. */
  get shouldRenderStill() {
    const f = this.#flags;
    return !this.shouldRun && f.visible && !f.contextLost;
  }
}
