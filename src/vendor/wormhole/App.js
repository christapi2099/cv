import { OrthographicCamera, Scene } from 'three';
import {
  AMBIENT,
  INTRO_TIMELINE,
  LIGHTNING,
  QUALITY_TIERS,
  VISUAL,
  resolveAmbientFps,
  resolveAmbientOpacity,
  resolveBoolean,
  resolveColor,
  resolveIntensity,
  resolveIntroMode,
  resolveLightning,
  resolveLogoText,
  resolveLook,
  resolveQuality,
  resolveSpeed,
  resolveTheme,
} from './config.js';
import { IntroDirector, shouldPlayIntro } from './director/IntroDirector.js';
import { LightningScheduler } from './director/LightningScheduler.js';
import { isConstrainedDevice, reducedMotionQuery } from './core/featureDetect.js';
import { canvasFactory, loadFont } from './core/fonts.js';
import { hasPlayedIntro, markIntroPlayed } from './core/introMemory.js';
import { Loop } from './core/Loop.js';
import { QualityManager } from './core/QualityManager.js';
import { RendererService } from './core/RendererService.js';
import { ResizeService } from './core/ResizeService.js';
import { RunState } from './core/RunState.js';
import { Visibility } from './core/Visibility.js';
import { ActorStage } from './entities/ActorStage.js';
import { FrameUniforms } from './entities/FrameUniforms.js';
import { PointerInput } from './input/PointerInput.js';
import { LOOKS } from './looks.js';

/**
 * Composition root: builds the services and entities and owns the lifecycle.
 * Whether the loop runs is decided by RunState; #sync() applies that decision.
 *
 * Rendering is two passes (autoClear off): the background look (a screen-
 * space quad, plus streaks or lightning) with an orthographic camera, then,
 * only while the intro shows them, the 3D actors with a perspective camera.
 *
 * The IntroDirector (pure) emits cues; this class routes them to entities.
 * Entities never talk to each other.
 *
 * Usage: `const app = new App(...); if (await app.init()) use(app.handle);`
 */
export class App {
  #options;
  #container;
  #warn;
  #win;
  #doc;
  #abort = new AbortController();

  #renderer;
  #scene = new Scene();
  #camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1); // unused by the shaders; required by render()
  #frame;
  #lookName;
  #background = { entities: [], lightning: null };
  #lookToken = 0;
  #actors = null;
  #director;
  #scheduler;
  #introPending = false;
  #prepareToken = 0;
  #watchdogTimer = 0;
  #hiddenTimer = 0;
  #fonts;
  #loop;
  #resize;
  #visibility;
  #pointer;
  #quality;
  #motionQuery;
  #run;
  #random = Math.random;

  // Per-frame state, mutated in place (zero allocations per frame).
  #state = {
    time: 0, offset: 0, center: { x: 0, y: 0 }, flash: 0, flashX: 0, flashY: 0, ambient: 1, fade: 0,
  };
  #boltStart = { x: 0, y: 0 };
  #boltEnd = { x: 0, y: 0 };
  #speed;
  #targetSpeed;
  #speedMul = 1;
  #intensity;
  #size = { width: 1, height: 1 };
  #settings;
  #themeValue = null; // last theme set at runtime (re-applied when switching to classic)

  #ready = false;
  #failed = false;
  #disposed = false;
  #lastReported = '';

  /**
   * @param {Element} container
   * @param {Readonly<object>} options  output of validateOptions()
   * @param {{ win: Window, doc: Document, warn: (msg: string) => void }} env
   */
  constructor(container, options, { win, doc, warn }) {
    this.#container = container;
    this.#options = options;
    this.#warn = warn;
    this.#win = win;
    this.#doc = doc;
    this.#speed = this.#targetSpeed = options.speed;
    this.#intensity = options.intensity;
    this.#lookName = options.look;
    this.#settings = {
      intro: options.intro,
      computer: options.computer,
      logo: options.logo,
      logoText: options.logoText,
      lightning: options.lightning,
      ambientOpacity: options.ambientOpacity,
      ambientFps: options.ambientFps,
      computerColor: options.computerColor,
    };
    this.#fonts = Object.freeze({
      createCanvas: canvasFactory(doc),
      loadFont: (family) => loadFont(doc, win, family),
    });
    const { signal } = this.#abort;

    try {
      const initialTier = options.quality === 'auto'
        ? (isConstrainedDevice(win) ? 'medium' : 'high')
        : options.quality;
      this.#quality = new QualityManager({
        initialTier,
        adaptive: options.quality === 'auto',
        onChange: this.#onTierChange,
      });
      const tier = QUALITY_TIERS[this.#quality.tier];

      this.#renderer = new RendererService(container, {
        maxDpr: options.maxDpr,
        signal,
        win,
        onContextLost: this.#onContextLost,
        onContextRestored: this.#onContextRestored,
        onError: this.#fail,
      });
      this.#renderer.setDprCap(tier.dprCap);

      this.#frame = new FrameUniforms({ ...VISUAL, calm: options.calm, flashRadius: LIGHTNING.flashRadius });
      this.#background = this.#createBackground(this.#lookName, tier);
      for (const entity of this.#background.entities) this.#scene.add(entity.object3D);

      this.#motionQuery = options.respectReducedMotion ? reducedMotionQuery(win) : null;
      this.#motionQuery?.addEventListener('change', this.#onMotionPreference, { signal });
      const reducedMotion = Boolean(this.#motionQuery?.matches);

      this.#director = new IntroDirector({ timeline: INTRO_TIMELINE, onCue: this.#onCue, onEnd: this.#onIntroEnded });
      this.#scheduler = new LightningScheduler({ mode: options.lightning, reducedMotion, random: this.#random });
      this.#scheduler.setPhase('ambient');

      this.#run = new RunState({ wantsRun: options.autoStart, reducedMotion });
      this.#pointer = new PointerInput({ signal, win, enabled: this.#parallaxEnabled });
      this.#loop = new Loop(this.#tick, { maxDt: VISUAL.maxDt, win });
      this.#visibility = new Visibility(container, this.#onVisibility, { signal, doc, win });
      this.#run.set('visible', this.#visibility.visible);
      this.#resize = new ResizeService(container, this.#onResize, { win });
      doc.addEventListener('visibilitychange', this.#onPageVisibility, { signal });
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /**
   * Compiles shaders before the first frame (no jank, and compile errors are
   * known before a handle is returned). Resolves to false if the effect failed.
   */
  async init() {
    if (!this.#usable) return false;
    let playIntro = false;
    try {
      const size = this.#resize.measure();
      this.#size.width = size.width;
      this.#size.height = size.height;
      this.#renderer.setSize(size.width, size.height);
      await this.#renderer.compile(this.#scene, this.#camera);
      playIntro = !this.#doc.hidden && shouldPlayIntro({
        mode: this.#settings.intro,
        reducedMotion: this.#run.get('reducedMotion'),
        playedThisSession: hasPlayedIntro(this.#win),
        look: this.#lookName,
        running: this.#run.shouldRun,
      });
      if (playIntro) playIntro = await this.#prepareIntro();
    } catch (error) {
      this.#fail(error);
    }
    await Promise.resolve(); // let a deferred onShaderError report land
    if (!this.#usable) return false;

    this.#ready = true;
    this.#introPending = playIntro; // starts on the first loop frame (t = 0 aligned with a rendered frame)
    this.#state.ambient = playIntro ? 0 : 1;
    this.#state.fade = playIntro ? 1 : 0;
    this.#speedMul = this.#lookName === 'storm' && !playIntro ? AMBIENT.speed : 1;
    this.#onResize(this.#resize.measure());
    this.#applyFrameCap();
    this.#sync();
    const reduced = this.#run.get('reducedMotion');
    this.#renderer.reveal({ animate: !reduced && !playIntro, opacity: this.#targetOpacity() });
    return this.#usable;
  }

  /** The public, framework-agnostic handle. */
  get handle() {
    const app = this;
    return Object.freeze({
      get supported() {
        return !app.state.failed;
      },
      start: () => app.start(),
      stop: () => app.stop(),
      setSpeed: (speed) => app.setSpeed(speed),
      setTheme: (theme) => app.setTheme(theme),
      setQuality: (quality) => app.setQuality(quality),
      setIntensity: (intensity) => app.setIntensity(intensity),
      dispose: () => app.dispose(),
      // v2
      skipIntro: () => app.skipIntro(),
      replayIntro: () => app.replayIntro(),
      setLook: (look) => app.setLook(look),
      setIntro: (mode) => app.setIntro(mode),
      setComputer: (enabled) => app.setComputer(enabled),
      setLogo: (enabled) => app.setLogo(enabled),
      setLogoText: (text) => app.setLogoText(text),
      setLightning: (mode) => app.setLightning(mode),
      setAmbientOpacity: (opacity) => app.setAmbientOpacity(opacity),
      setAmbientFps: (fps) => app.setAmbientFps(fps),
      setComputerColor: (hex) => app.setComputerColor(hex),
      get state() {
        return app.state;
      },
    });
  }

  get state() {
    const s = this.#settings;
    return Object.freeze({
      running: Boolean(this.#loop?.running),
      tier: this.#quality?.tier ?? null,
      speed: this.#targetSpeed,
      intensity: this.#intensity,
      visible: this.#run?.get('visible') ?? false,
      reducedMotion: this.#run?.get('reducedMotion') ?? false,
      contextLost: this.#run?.get('contextLost') ?? false,
      failed: this.#failed,
      disposed: this.#disposed,
      // v2
      look: this.#lookName,
      intro: this.#introState,
      introMode: s.intro,
      computer: s.computer,
      logo: s.logo,
      logoText: s.logoText,
      lightning: s.lightning,
      ambientOpacity: s.ambientOpacity,
      ambientFps: s.ambientFps,
      computerColor: s.computerColor,
    });
  }

  // ── Public commands ────────────────────────────────────────────────────────

  start() {
    if (!this.#usable) return;
    this.#run.set('wantsRun', true);
    this.#sync();
  }

  stop() {
    if (!this.#usable) return;
    this.#endIntro('disabled'); // a frozen intro must never cover the page
    this.#run.set('wantsRun', false);
    this.#sync();
  }

  setSpeed(speed) {
    if (!this.#usable) return;
    this.#targetSpeed = resolveSpeed(speed, this.#warn, this.#targetSpeed);
    this.#report();
  }

  setTheme(theme) {
    if (!this.#usable) return;
    const resolved = resolveTheme(theme, this.#warn);
    this.#themeValue = resolved;
    for (const entity of this.#background.entities) entity.setTheme(resolved);
    this.#renderStillIfIdle();
  }

  setQuality(quality) {
    if (!this.#usable) return;
    this.#quality.setTier(resolveQuality(quality, this.#warn));
  }

  setIntensity(intensity) {
    if (!this.#usable) return;
    this.#intensity = resolveIntensity(intensity, this.#warn, this.#intensity);
    for (const entity of this.#background.entities) entity.setIntensity(this.#intensity);
    this.#renderStillIfIdle();
  }

  /** End the intro now (no-op when none is playing). */
  skipIntro() {
    if (!this.#usable) return;
    if (this.#director.active) {
      this.#director.skip();
    } else if (this.#introPending) {
      this.#cancelPendingIntro();
    }
  }

  /**
   * Play the intro again (storm look only; never under reduced motion).
   * Returns true when the intro will play. Actors are rebuilt for it.
   */
  replayIntro() {
    if (!this.#usable || !this.#ready) return false;
    const allowed = shouldPlayIntro({
      mode: this.#settings.intro,
      reducedMotion: this.#run.get('reducedMotion'),
      playedThisSession: true,
      look: this.#lookName,
      running: this.#run.shouldRun,
      replay: true,
    });
    if (!allowed) {
      this.#warn('replayIntro(): needs look "storm", a running effect and no reduced-motion preference.');
      return false;
    }
    if (this.#director.active) {
      this.#background.lightning?.clear();
      this.#director.start(this.#win.performance.now());
      this.#armWatchdog();
      return true;
    }
    if (this.#introPending) return true;
    this.#prepareIntro().then((ok) => {
      if (!ok || !this.#usable) return;
      this.#introPending = true;
      this.#applyFrameCap();
      this.#report();
    }, this.#fail);
    return true;
  }

  setLook(look) {
    if (!this.#usable) return;
    const name = resolveLook(look, this.#warn, this.#lookName);
    if (name === this.#lookName && this.#lookToken === 0) return;
    this.#switchLook(name);
  }

  setIntro(mode) {
    if (!this.#usable) return;
    this.#settings.intro = resolveIntroMode(mode, this.#warn, this.#settings.intro);
    if (this.#settings.intro === 'off') this.skipIntro();
    this.#report();
  }

  setComputer(enabled) {
    if (!this.#usable) return;
    this.#settings.computer = resolveBoolean(enabled, this.#warn, this.#settings.computer, 'computer');
    this.#actors?.setComputerEnabled(this.#settings.computer);
    this.#report();
  }

  setLogo(enabled) {
    if (!this.#usable) return;
    this.#settings.logo = resolveBoolean(enabled, this.#warn, this.#settings.logo, 'logo');
    this.#actors?.setLogoEnabled(this.#settings.logo);
    this.#report();
  }

  setLogoText(text) {
    if (!this.#usable) return;
    this.#settings.logoText = resolveLogoText(text, this.#warn, this.#settings.logoText);
    this.#actors?.setLogoText(this.#settings.logoText);
    this.#report();
  }

  setLightning(mode) {
    if (!this.#usable) return;
    this.#settings.lightning = resolveLightning(mode, this.#warn, this.#settings.lightning);
    this.#scheduler.setMode(this.#settings.lightning);
    if (this.#settings.lightning === 'off'
      || (this.#settings.lightning === 'intro-only' && !this.#director.active)) {
      this.#background.lightning?.clear();
    }
    this.#renderStillIfIdle();
    this.#report();
  }

  setAmbientOpacity(opacity) {
    if (!this.#usable) return;
    this.#settings.ambientOpacity = resolveAmbientOpacity(opacity, this.#warn, this.#settings.ambientOpacity);
    if (this.#ready) this.#renderer.setOpacity(this.#targetOpacity(), 250);
    this.#report();
  }

  setAmbientFps(fps) {
    if (!this.#usable) return;
    this.#settings.ambientFps = resolveAmbientFps(fps, this.#warn, this.#settings.ambientFps);
    this.#applyFrameCap();
    this.#report();
  }

  setComputerColor(hex) {
    if (!this.#usable) return;
    this.#settings.computerColor = resolveColor(hex, this.#warn, this.#settings.computerColor);
    this.#actors?.setComputerColor(this.#settings.computerColor);
    this.#report();
  }

  /** Idempotent. Releases every listener, observer, GPU resource and the canvas. */
  dispose() {
    if (this.#disposed) return;
    this.#endIntro('disposed'); // emits onIntroEnd so overlays are never left behind
    this.#disposed = true;
    this.#introPending = false;
    this.#prepareToken += 1;
    this.#lookToken += 1;
    this.#clearTimers();
    this.#loop?.stop();
    this.#abort.abort(); // removes every DOM listener registered with `signal`
    this.#resize?.dispose();
    this.#visibility?.dispose();
    this.#disposeActors();
    for (const entity of this.#background.entities) entity.dispose();
    this.#background = { entities: [], lightning: null };
    this.#renderer?.dispose();
    this.#report();
  }

  // ── Run-state application ──────────────────────────────────────────────────

  get #usable() {
    return !this.#disposed && !this.#failed;
  }

  get #parallaxEnabled() {
    return this.#options.pointerParallax && !this.#run?.get('reducedMotion');
  }

  get #introState() {
    if (this.#director?.active) return 'playing';
    return this.#introPending ? 'pending' : 'idle';
  }

  get #isStorm() {
    return this.#lookName === 'storm';
  }

  #targetOpacity() {
    if (!this.#isStorm) return 1; // classic: exactly v1
    return this.#director.active || this.#introPending ? 1 : this.#settings.ambientOpacity;
  }

  /** Ambient storm is capped (default 30 fps); the intro and classic run at the display rate. */
  #applyFrameCap() {
    if (!this.#loop) return;
    const capped = this.#isStorm && !this.#director.active && !this.#introPending;
    const fps = capped ? this.#settings.ambientFps : 0;
    this.#loop.setFrameCap(fps);
    this.#quality.setFrameCap(fps ? 1000 / fps : 0);
  }

  /** Applies RunState's decision. The only place the loop is started or stopped. */
  #sync() {
    if (!this.#usable || !this.#ready) return;
    const shouldRun = this.#run.shouldRun;
    if (shouldRun && !this.#loop.running) {
      this.#quality.reset(); // timings from before a pause are meaningless
      this.#loop.start();
    } else if (!shouldRun && this.#loop.running) {
      this.#loop.stop();
    }
    this.#renderStillIfIdle();
    this.#report();
  }

  /** Keeps the canvas correct (never blank or stretched) while the loop is stopped. */
  #renderStillIfIdle() {
    if (!this.#usable || !this.#ready || this.#loop.running || !this.#run.shouldRenderStill) return;
    this.#render();
  }

  /** Every render goes through here, so any GL/three error becomes a clean fallback. */
  #render() {
    try {
      this.#frame.update(this.#state);
      this.#renderer.render(this.#scene, this.#camera);
      const actors = this.#actors;
      if (actors && actors.visible) {
        this.#renderer.clearDepth();
        this.#renderer.render(actors.scene, actors.camera);
      }
    } catch (error) {
      this.#fail(error);
    }
  }

  #tick = (dt, now) => {
    if (this.#introPending) {
      this.#introPending = false;
      this.#beginIntro(now);
      dt = 0;
    }
    this.#quality.sample(dt * 1000, now);
    if (this.#director.active) this.#director.update(dt, now);
    this.#advance(dt);
    if (!this.#usable) return; // a cue handler may have failed
    this.#render();
  };

  #advance(dt) {
    const state = this.#state;
    const director = this.#director;
    const intro = director.active;
    this.#speed += (this.#targetSpeed - this.#speed) * (1 - Math.exp(-VISUAL.speedEase * dt));

    // Storm: the director drives speed and grading; afterwards they ease to ambient.
    const ease = 1 - Math.exp(-AMBIENT.ease * dt);
    if (!this.#isStorm) {
      this.#speedMul = 1;
      state.ambient = 1;
      state.fade = 0;
    } else if (intro) {
      this.#speedMul = director.frame.speedMul;
      state.ambient = director.frame.ambient;
      state.fade = director.frame.fade;
    } else {
      this.#speedMul += (AMBIENT.speed - this.#speedMul) * ease;
      state.ambient += (1 - state.ambient) * ease;
      state.fade += (0 - state.fade) * Math.min(1, ease * 4);
    }

    state.time += dt;
    state.offset = (state.offset + dt * this.#speed * this.#speedMul * VISUAL.travel) % VISUAL.wrap;

    const lightning = this.#background.lightning;
    if (lightning) {
      if (this.#scheduler.update(dt)) this.#spawnAmbientBolt();
      lightning.update(dt);
    }
    state.flash = lightning ? this.#scheduler.flash : 0;
    state.flashX = this.#scheduler.flashX;
    state.flashY = this.#scheduler.flashY;

    this.#pointer.update(dt, VISUAL.pointerEase);
    const sway = this.#options.sway * VISUAL.swayAmplitude;
    const pointer = this.#pointer.value;
    state.center.x = pointer.x * VISUAL.pointerStrength + Math.sin(state.time * 0.21) * sway;
    state.center.y = pointer.y * VISUAL.pointerStrength + Math.sin(state.time * 0.17 + 1.3) * sway * 0.6;

    this.#actors?.update(dt, director.frame, state.center, state.flash);
  }

  // ── Intro ──────────────────────────────────────────────────────────────────

  /** Build (and compile) the actors for an intro. Resolves false if superseded. */
  async #prepareIntro() {
    const token = ++this.#prepareToken;
    this.#disposeActors();
    const tier = QUALITY_TIERS[this.#quality.tier];
    const actors = new ActorStage({
      shared: this.#frame.uniforms,
      palette: this.#options.stormPalette,
      tier,
      computer: this.#settings.computer,
      logo: this.#settings.logo,
      computerColor: this.#settings.computerColor,
      logoText: this.#settings.logoText,
      logoFont: this.#options.logoFont,
      fonts: this.#fonts,
      warn: this.#warn,
    });
    actors.resize(this.#size.width, this.#size.height);
    try {
      await this.#renderer.compile(actors.scene, actors.camera);
    } catch (error) {
      actors.dispose();
      throw error;
    }
    if (token !== this.#prepareToken || !this.#usable) {
      actors.dispose();
      return false;
    }
    this.#actors = actors;
    return true;
  }

  #beginIntro(now) {
    if (!this.#isStorm || this.#run.get('reducedMotion')) {
      this.#disposeActors();
      return;
    }
    this.#director.start(now);
    this.#scheduler.setPhase('intro');
    this.#background.lightning?.clear();
    this.#state.ambient = 0;
    this.#speedMul = this.#director.frame.speedMul;
    markIntroPlayed(this.#win);
    this.#renderer.setOpacity(1, 0);
    this.#applyFrameCap();
    this.#armWatchdog();
    if (this.#doc.hidden) this.#onPageVisibility();
    this.#callback('onIntroStart', Object.freeze({ timeline: INTRO_TIMELINE }));
    this.#report();
  }

  #cancelPendingIntro() {
    this.#introPending = false;
    this.#prepareToken += 1;
    this.#disposeActors();
    this.#applyFrameCap();
    this.#renderer.setOpacity(this.#targetOpacity(), 300);
    this.#report();
  }

  /** End a playing intro for an external reason; cancel a pending one. */
  #endIntro(reason) {
    if (this.#director?.active) this.#director.stop(reason);
    else if (this.#introPending && this.#usable) this.#cancelPendingIntro();
  }

  /** Director callback: every way an intro ends comes through here, exactly once. */
  #onIntroEnded = ({ reason, skipped }) => {
    this.#clearTimers();
    try {
      this.#scheduler.setPhase('ambient');
      this.#disposeActors();
      if (this.#usable) {
        this.#background.lightning?.clear();
        this.#applyFrameCap();
        // A natural end already crossfaded during the handoff; anything else fades quickly.
        this.#renderer.setOpacity(this.#targetOpacity(), reason === 'complete' ? 0 : 400);
      }
    } catch (error) {
      this.#warn(`Intro teardown: ${error?.message ?? error}`);
    }
    this.#callback('onIntroEnd', Object.freeze({ skipped, reason }));
    this.#report();
    this.#renderStillIfIdle();
  };

  #onCue = (cue) => {
    switch (cue.type) {
      case 'strike':
        this.#strike(cue);
        break;
      case 'handoff':
        this.#renderer.setOpacity(this.#targetOpacityAfterIntro(), cue.duration * 1000);
        this.#callback('onIntroHandoff', Object.freeze({ duration: cue.duration }));
        break;
      default:
        break; // computerIn / titleIn / titleOut are expressed in the director frame
    }
  };

  #targetOpacityAfterIntro() {
    return this.#isStorm ? this.#settings.ambientOpacity : 1;
  }

  /** Route a strike cue: bolt + cloud flash (if the policy allows) and the computer's kick. */
  #strike(cue) {
    const random = this.#random;
    const end = this.#boltEnd;
    const start = this.#boltStart;
    const center = this.#state.center;
    const top = 0.5 * this.#size.height / Math.min(this.#size.width, this.#size.height) + 0.06;
    let hitComputer = false;
    if (cue.target === 'computer' && this.#actors?.computerScreenPosition(end, center)) {
      hitComputer = true;
    } else if (cue.target === 'title') {
      end.x = (random() - 0.5) * 0.3; end.y = 0.06 + random() * 0.06;
      this.#actors?.lightBehindTitle(this.#director.frame.title.dist);
    } else {
      const angle = random() * Math.PI * 2;
      end.x = Math.cos(angle) * 0.45; end.y = Math.sin(angle) * 0.35;
    }
    start.x = end.x + (random() - 0.5) * 0.5;
    start.y = top;
    const fired = this.#scheduler.trigger(cue.flash, end.x, end.y);
    if (fired) {
      this.#background.lightning?.spawn(start.x, start.y, end.x, end.y, 1, cue.strike === 2 ? 0.005 : 0.007);
    }
    if (hitComputer) {
      // With lightning off the computer still gets its kick (a gust), so the choreography holds.
      const dx = end.x - start.x; const dy = end.y - start.y;
      this.#actors.strikeComputer(dx, dy);
    }
  }

  #spawnAmbientBolt() {
    const s = this.#scheduler;
    const len = Math.hypot(s.flashX, s.flashY) || 1;
    // A short bolt running along the cloud wall, outside the calm zone.
    this.#background.lightning.spawn(
      s.flashX * (1 + 0.45 / len), s.flashY * (1 + 0.45 / len) + 0.08,
      s.flashX, s.flashY,
      LIGHTNING.ambientBoltGain, 0.005,
    );
  }

  #armWatchdog() {
    if (this.#watchdogTimer) this.#win.clearTimeout(this.#watchdogTimer);
    // The director also checks wall-clock time every frame; this timer covers a stopped loop.
    this.#watchdogTimer = this.#win.setTimeout(() => {
      this.#watchdogTimer = 0;
      this.#director.poll(this.#win.performance.now());
    }, INTRO_TIMELINE.watchdog * 1000 + 50);
  }

  #clearTimers() {
    if (this.#watchdogTimer) this.#win.clearTimeout(this.#watchdogTimer);
    if (this.#hiddenTimer) this.#win.clearTimeout(this.#hiddenTimer);
    this.#watchdogTimer = 0;
    this.#hiddenTimer = 0;
  }

  #disposeActors() {
    this.#actors?.dispose();
    this.#actors = null;
  }

  #callback(name, detail) {
    const callback = this.#options[name];
    if (callback) this.#safeCall(callback, detail, name);
  }

  // ── Looks ──────────────────────────────────────────────────────────────────

  #createBackground(name, tier) {
    return LOOKS[name].createBackground({
      shared: this.#frame.uniforms,
      tier,
      theme: this.#themeValue ?? this.#options.theme,
      palette: this.#options.stormPalette,
      intensity: this.#intensity,
      random: this.#random,
    });
  }

  /** Build the new look, compile it, then swap: the old look keeps rendering meanwhile. */
  async #switchLook(name) {
    const token = ++this.#lookToken;
    if (name !== 'storm') this.#endIntro('disabled');
    const tier = QUALITY_TIERS[this.#quality.tier];
    let next;
    const scene = new Scene();
    try {
      next = this.#createBackground(name, tier);
      for (const entity of next.entities) scene.add(entity.object3D);
      await this.#renderer.compile(scene, this.#camera);
    } catch (error) {
      for (const entity of next?.entities ?? []) entity.dispose();
      this.#fail(error);
      return;
    }
    if (token !== this.#lookToken || !this.#usable) {
      for (const entity of next.entities) entity.dispose();
      return;
    }
    this.#lookToken = 0;
    if (name !== 'storm') this.#endIntro('disabled');
    for (const entity of this.#background.entities) entity.dispose();
    this.#background = next;
    this.#scene = scene;
    this.#lookName = name;
    this.#scheduler.setPhase(this.#director.active ? 'intro' : 'ambient');
    if (name === 'storm' && !this.#director.active) {
      this.#speedMul = AMBIENT.speed;
      this.#state.ambient = 1;
    }
    this.#applyFrameCap();
    if (this.#ready) this.#renderer.setOpacity(this.#targetOpacity(), 300);
    this.#renderStillIfIdle();
    this.#report();
  }

  /** Notifies onStateChange only when something a UI would show has changed. */
  #report() {
    const callback = this.#options.onStateChange;
    if (!callback) return;
    const state = this.state;
    const key = `${state.running}|${state.tier}|${state.reducedMotion}|${state.contextLost}|${state.failed}|${state.disposed}|${state.speed}`
      + `|${state.look}|${state.intro}|${state.introMode}|${state.computer}|${state.logo}|${state.logoText}`
      + `|${state.lightning}|${state.ambientOpacity}|${state.ambientFps}|${state.computerColor}`;
    if (key === this.#lastReported) return;
    this.#lastReported = key;
    this.#safeCall(callback, state, 'onStateChange');
  }

  #safeCall(callback, value, name) {
    try {
      callback(value);
    } catch (error) {
      this.#warn(`${name} threw: ${error?.message ?? error}`);
    }
  }

  // ── Event handlers (arrow functions keep `this` bound) ─────────────────────

  #onResize = ({ width, height }) => {
    if (!this.#usable) return;
    this.#size.width = width;
    this.#size.height = height;
    this.#renderer.setSize(width, height);
    this.#syncBufferSize();
    this.#actors?.resize(width, height);
    this.#renderStillIfIdle();
  };

  #syncBufferSize() {
    const buffer = this.#renderer.bufferSize;
    this.#frame.resize(buffer.x, buffer.y, this.#renderer.pixelRatio);
  }

  #onTierChange = (name) => {
    if (!this.#usable) return;
    const tier = QUALITY_TIERS[name];
    this.#renderer.setDprCap(tier.dprCap);
    this.#syncBufferSize();
    for (const entity of this.#background.entities) entity.setQuality(tier);
    this.#actors?.setQuality(tier);
    this.#renderStillIfIdle();
    if (this.#options.onQualityChange) this.#safeCall(this.#options.onQualityChange, name, 'onQualityChange');
    this.#report();
  };

  #onVisibility = (visible) => {
    if (!this.#usable) return;
    this.#run.set('visible', visible);
    this.#sync();
  };

  /** Tab hidden for longer than the limit ends the intro (never resume half-played). */
  #onPageVisibility = () => {
    if (!this.#usable || !this.#director.active) return;
    const now = this.#win.performance.now();
    this.#director.setPageHidden(this.#doc.hidden, now);
    if (this.#hiddenTimer) this.#win.clearTimeout(this.#hiddenTimer);
    this.#hiddenTimer = 0;
    if (this.#doc.hidden && this.#director.active) {
      this.#hiddenTimer = this.#win.setTimeout(() => {
        this.#hiddenTimer = 0;
        this.#director.poll(this.#win.performance.now());
      }, INTRO_TIMELINE.hiddenLimit * 1000 + 50);
    }
  };

  #onMotionPreference = () => {
    if (!this.#usable) return;
    const reduced = Boolean(this.#motionQuery?.matches);
    this.#run.set('reducedMotion', reduced);
    this.#scheduler.setReducedMotion(reduced);
    this.#pointer.setEnabled(this.#parallaxEnabled);
    if (reduced) {
      this.#endIntro('disabled');
      this.#background.lightning?.clear();
      // The still frame should be the neutral, centred, ambient composition.
      this.#state.center.x = 0;
      this.#state.center.y = 0;
      this.#state.flash = 0;
      this.#state.fade = 0;
      if (this.#isStorm) this.#state.ambient = 1;
    }
    this.#sync();
  };

  // A lost context may never come back (e.g. GPU reset on a busy phone), so
  // show the CSS fallback underneath until it does.
  #onContextLost = () => {
    if (!this.#usable) return;
    this.#endIntro('error');
    this.#container.classList.add(this.#options.fallbackClass);
    this.#run.set('contextLost', true);
    this.#sync();
  };

  #onContextRestored = () => {
    if (!this.#usable) return;
    this.#container.classList.remove(this.#options.fallbackClass);
    this.#run.set('contextLost', false);
    this.#sync();
  };

  /** Unrecoverable error: tear down and show the CSS fallback. Never throws. */
  #fail = (error) => {
    if (this.#failed || this.#disposed) return;
    this.#endIntro('error'); // first, so the intro overlay is always released
    this.#failed = true;
    this.#warn(`Disabled after an error; showing fallback. ${error?.message ?? error}`);
    this.#container.classList.add(this.#options.fallbackClass);
    this.dispose();
  };
}
