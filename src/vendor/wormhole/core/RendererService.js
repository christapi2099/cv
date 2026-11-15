import { Vector2, WebGLRenderer } from 'three';

/**
 * Owns the WebGLRenderer and its canvas: creation, pixel-ratio policy,
 * shader compilation, context-loss events and teardown. Knows nothing about
 * what is drawn.
 */
export class RendererService {
  #renderer;
  #win;
  #maxDpr;
  #dprCap = 2;
  #width = 1;
  #height = 1;
  #lost = false;
  #bufferSize = new Vector2();

  /**
   * @param {Element} container
   * @param {{
   *   maxDpr: number, signal: AbortSignal,
   *   onContextLost: () => void, onContextRestored: () => void,
   *   onError: (error: Error) => void, win?: Window
   * }} options
   */
  constructor(container, { maxDpr, signal, onContextLost, onContextRestored, onError, win = globalThis.window }) {
    this.#win = win;
    this.#maxDpr = maxDpr;
    this.#renderer = new WebGLRenderer({
      antialias: false, // full-screen shader: MSAA buys nothing
      alpha: false,
      // v2: the intro's 3D actors need a depth buffer. The background quads
      // never test or write depth, so the classic look renders identically.
      depth: true,
      stencil: false,
      // A decorative background must not wake a laptop's discrete GPU, and
      // software rasterisers should get the CSS fallback instead.
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: true,
      preserveDrawingBuffer: false,
    });
    this.#renderer.autoClear = false; // the opaque tunnel quad covers every pixel; depth is cleared per actor pass

    // Surface shader compile/link failures so the app can fall back gracefully.
    // Deferred: tearing down from inside renderer.render() is unsafe.
    this.#renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
      const log = [
        gl.getShaderInfoLog(vertexShader),
        gl.getShaderInfoLog(fragmentShader),
        gl.getProgramInfoLog(program),
      ].filter(Boolean).join('\n').trim() || 'unknown error';
      queueMicrotask(() => onError(new Error(`Shader program failed: ${log}`)));
    };

    const canvas = this.#renderer.domElement;
    canvas.className = 'vortex-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
      opacity: '0', // hidden until the first real frame, so no black flash over the fallback
    });

    // three.js also calls preventDefault on loss; we only coordinate the loop.
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.#lost = true;
      onContextLost();
    }, { signal });
    // three.js re-initialises its GL state on restore and re-uploads programs and
    // buffers lazily on the next render, so the scene graph can be reused as-is.
    canvas.addEventListener('webglcontextrestored', () => {
      this.#lost = false;
      onContextRestored();
    }, { signal });

    container.prepend(canvas);
  }

  get pixelRatio() {
    return Math.min(this.#win.devicePixelRatio || 1, this.#maxDpr, this.#dprCap);
  }

  /** Drawing-buffer size in device pixels (shared vector; read, don't keep). */
  get bufferSize() {
    return this.#renderer.getDrawingBufferSize(this.#bufferSize);
  }

  /** Compile every program up front (non-blocking where KHR_parallel_shader_compile exists). */
  compile(scene, camera) {
    return this.#renderer.compileAsync(scene, camera);
  }

  /** Show the canvas once a real frame has been drawn (fading to `opacity`). */
  reveal({ animate, opacity = 1 }) {
    this.setOpacity(opacity, animate ? 700 : 0, 'ease-out');
  }

  /**
   * Canvas opacity (the storm look's ambient layer is translucent).
   * @param {number} opacity 0..1  @param {number} durationMs CSS transition, 0 = instant
   */
  setOpacity(opacity, durationMs = 0, easing = 'ease-in-out') {
    const { style } = this.#renderer.domElement;
    style.transition = durationMs > 0 ? `opacity ${Math.round(durationMs)}ms ${easing}` : 'none';
    style.opacity = String(opacity);
  }

  setSize(width, height) {
    this.#width = width;
    this.#height = height;
    this.#renderer.setPixelRatio(this.pixelRatio);
    this.#renderer.setSize(width, height, false); // CSS size is handled by styles
  }

  /** Quality tiers cap the pixel ratio; re-applies the current size. */
  setDprCap(cap) {
    this.#dprCap = cap;
    this.setSize(this.#width, this.#height);
  }

  render(scene, camera) {
    this.#renderer.render(scene, camera);
  }

  /** Before an overlay pass (the 3D actors drawn over the background). */
  clearDepth() {
    this.#renderer.clearDepth();
  }

  dispose() {
    this.#renderer.dispose();
    // Free the context now rather than at GC time (already gone if it was lost).
    if (!this.#lost) this.#renderer.forceContextLoss();
    this.#renderer.domElement.remove();
  }
}
