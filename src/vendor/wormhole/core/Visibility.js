/**
 * Reports whether the effect is worth rendering: the document is visible AND
 * the container intersects the viewport. Emits only on change.
 */
export class Visibility {
  #onChange;
  #doc;
  #observer = null;
  #pageVisible;
  #inView = true;
  #last;

  /**
   * @param {Element} el
   * @param {(visible: boolean) => void} onChange
   * @param {{ signal: AbortSignal, doc?: Document, win?: Window }} options
   */
  constructor(el, onChange, { signal, doc = globalThis.document, win = globalThis.window }) {
    this.#onChange = onChange;
    this.#doc = doc;
    this.#pageVisible = !doc.hidden;
    this.#last = this.visible;

    doc.addEventListener('visibilitychange', this.#onPageVisibility, { signal });

    if (typeof win.IntersectionObserver === 'function') {
      this.#observer = new win.IntersectionObserver(this.#onIntersect, { threshold: 0 });
      this.#observer.observe(el);
    }
  }

  get visible() {
    return this.#pageVisible && this.#inView;
  }

  dispose() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #onPageVisibility = () => {
    this.#pageVisible = !this.#doc.hidden;
    this.#emit();
  };

  #onIntersect = (entries) => {
    // Entries arrive in time order; only the latest state matters.
    const latest = entries[entries.length - 1];
    if (!latest) return;
    this.#inView = latest.isIntersecting;
    this.#emit();
  };

  #emit() {
    const visible = this.visible;
    if (visible === this.#last) return;
    this.#last = visible;
    this.#onChange(visible);
  }
}
