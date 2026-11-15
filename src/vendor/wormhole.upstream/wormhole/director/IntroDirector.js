import { AMBIENT, INTRO_TIMELINE, isValidTimeline } from '../config.js';

/**
 * Pure intro timeline for the storm vortex intro. No DOM, no three.js.
 *
 * - `update(dt, nowMs)` advances time, fires cues in order (each exactly once,
 *   even if one long frame skips past several) and writes the choreography
 *   for this instant into `frame` (mutated in place: zero allocations).
 * - The intro always ends: on completion, skip(), fail(), the wall-clock
 *   watchdog, or a tab hidden for longer than `hiddenLimit`.
 *
 * Cues are frozen objects: { type, at, ... }. Types: 'computerIn', 'strike'
 * ({ strike: 1|2|3, target: 'computer'|'wall'|'title', flash }), 'titleIn',
 * 'titleOut', 'handoff'.
 *
 * Choreography coordinates: `sx`/`sy` are screen offsets in short-side units
 * (the tunnel's own unit, so 0.5 is the edge of the short side); `dist` is the
 * distance in front of the camera in world units. The App converts these with
 * the camera's field of view.
 */

/** Hermite smoothstep on [a, b] (b > a), clamped. */
export function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Interpolate distance in 1/d space: perspective size changes evenly. */
const lerpDistance = (near, far, t) => 1 / lerp(1 / near, 1 / far, t);

/**
 * Whether the intro should play now.
 * @param {{ mode: 'once'|'always'|'off', reducedMotion: boolean, playedThisSession: boolean,
 *   supported?: boolean, look?: string, running?: boolean, replay?: boolean }} input
 */
export function shouldPlayIntro({
  mode, reducedMotion, playedThisSession, supported = true, look = 'storm', running = true, replay = false,
}) {
  if (!supported || reducedMotion || look !== 'storm' || !running) return false;
  if (replay) return true;
  if (mode === 'off') return false;
  if (mode === 'once') return !playedThisSession;
  return mode === 'always';
}

export const END_REASONS = Object.freeze([
  'complete', 'skip', 'watchdog', 'hidden', 'error', 'disabled', 'disposed',
]);

// Distances (world units) used by the choreography.
const COMPUTER_FAR = 28;
const COMPUTER_NEAR = 4.2;
const COMPUTER_GONE = 70;
const TITLE_FAR = 45;
export const TITLE_HOLD = 7; // the title is fitted to the screen at this distance
const TITLE_PUSH = 6.1;
const TITLE_FLY = 3.4;

export class IntroDirector {
  #tl;
  #cues;
  #onCue;
  #onEnd;
  #state = 'idle'; // idle | playing | ended
  #t = 0;
  #next = 0;
  #startMs = 0;
  #hiddenAt = -1;
  #endReason = null;

  /** Choreography for the current instant. Read every frame; never replaced. */
  frame = {
    t: 0,
    active: false,
    fade: 0, // 1 = black (fade from black at the start)
    speedMul: 1, // multiplies the tunnel speed
    ambient: 1, // 0 = full intro grading, 1 = ambient grading
    computer: { active: false, sx: 0, sy: 0, dist: COMPUTER_FAR, scale: 0 },
    title: { active: false, dist: TITLE_FAR, reveal: 0 },
  };

  /**
   * @param {{ timeline?: object, onCue?: (cue: object) => void,
   *   onEnd?: (result: { reason: string, skipped: boolean }) => void }} [options]
   */
  constructor({ timeline = INTRO_TIMELINE, onCue = () => {}, onEnd = () => {} } = {}) {
    if (!isValidTimeline(timeline)) throw new RangeError('IntroDirector: invalid timeline');
    this.#tl = timeline;
    this.#onCue = onCue;
    this.#onEnd = onEnd;
    const tl = timeline;
    this.#cues = Object.freeze([
      Object.freeze({ type: 'computerIn', at: tl.computerIn }),
      Object.freeze({ type: 'strike', at: tl.strike1, strike: 1, target: 'computer', flash: tl.strike1Flash }),
      Object.freeze({ type: 'strike', at: tl.strike2, strike: 2, target: 'wall', flash: tl.strike2Flash }),
      Object.freeze({ type: 'titleIn', at: tl.titleIn }),
      Object.freeze({ type: 'strike', at: tl.strike3, strike: 3, target: 'title', flash: tl.strike3Flash }),
      Object.freeze({ type: 'titleOut', at: tl.titleHoldEnd }),
      Object.freeze({ type: 'handoff', at: tl.handoff, duration: tl.duration - tl.handoff }),
    ].sort((a, b) => a.at - b.at));
    this.#compute(this.#tl.duration);
    this.frame.active = false;
  }

  get active() {
    return this.#state === 'playing';
  }

  get state() {
    return this.#state;
  }

  get time() {
    return this.#t;
  }

  get endReason() {
    return this.#endReason;
  }

  get cues() {
    return this.#cues;
  }

  get timeline() {
    return this.#tl;
  }

  /** Start (or restart) from t = 0. */
  start(nowMs = 0) {
    this.#state = 'playing';
    this.#t = 0;
    this.#next = 0;
    this.#startMs = nowMs;
    this.#hiddenAt = -1;
    this.#endReason = null;
    this.frame.active = true;
    this.#compute(0);
  }

  /**
   * @param {number} dt seconds of animation time (the loop clamps it)
   * @param {number} nowMs wall clock, for the watchdog
   */
  update(dt, nowMs) {
    if (!this.active) return;
    if (this.#checkWatchdog(nowMs)) return;
    this.#t += Math.max(0, dt);
    const cues = this.#cues;
    while (this.#next < cues.length && cues[this.#next].at <= this.#t) {
      const cue = cues[this.#next++];
      this.#onCue(cue);
      if (!this.active) return; // a cue handler ended the intro
    }
    if (this.#t >= this.#tl.duration) {
      this.#end('complete');
      return;
    }
    this.#compute(this.#t);
  }

  /** Wall-clock check without advancing time (e.g. from a timer). Returns true if it ended. */
  poll(nowMs) {
    if (!this.active) return false;
    if (this.#checkWatchdog(nowMs)) return true;
    if (this.#hiddenAt >= 0 && nowMs - this.#hiddenAt > this.#tl.hiddenLimit * 1000) {
      this.#end('hidden');
      return true;
    }
    return false;
  }

  /** The page became hidden (true) or visible again (false). */
  setPageHidden(hidden, nowMs) {
    if (!this.active) return;
    if (hidden) {
      if (this.#hiddenAt < 0) this.#hiddenAt = nowMs;
      return;
    }
    const ended = this.poll(nowMs);
    if (!ended) this.#hiddenAt = -1;
  }

  skip() {
    if (this.active) this.#end('skip');
  }

  /** End for an external reason ('error', 'disabled', 'disposed', ...). */
  stop(reason = 'disabled') {
    if (this.active) this.#end(END_REASONS.includes(reason) ? reason : 'disabled');
  }

  #checkWatchdog(nowMs) {
    if (nowMs - this.#startMs >= this.#tl.watchdog * 1000) {
      this.#end('watchdog');
      return true;
    }
    return false;
  }

  #end(reason) {
    this.#state = 'ended';
    this.#endReason = reason;
    this.#hiddenAt = -1;
    this.#compute(this.#tl.duration);
    this.frame.active = false;
    this.frame.computer.active = false;
    this.frame.title.active = false;
    this.#onEnd({ reason, skipped: reason === 'skip' });
  }

  /** Choreography at time t. Pure function of t and the timeline. */
  #compute(t) {
    const tl = this.#tl;
    const f = this.frame;
    f.t = t;
    f.fade = 1 - smooth(0, tl.fadeIn, t);
    f.speedMul = tl.rushSpeed
      + (tl.cruiseSpeed - tl.rushSpeed) * smooth(tl.fadeIn, tl.strike1, t)
      + (tl.outroSpeed - tl.cruiseSpeed) * smooth(tl.titleHoldEnd, tl.titleOut, t)
      + (AMBIENT.speed - tl.outroSpeed) * smooth(tl.handoff, tl.duration, t);
    f.ambient = smooth(tl.handoff, tl.duration, t);

    // Computer: approaches on a slow spiral, gets struck, falls back into the swirl.
    const c = f.computer;
    c.active = t >= tl.computerIn && t < tl.computerOut;
    const approach = smooth(tl.computerIn, tl.strike1, t);
    const away = Math.min(1, Math.max(0, (t - tl.strike1) / (tl.computerOut - tl.strike1)));
    const angle = 0.6 + t * 1.5 + away * away * 4.0;
    const radius = lerp(0.2, 0.09, approach) * (1 - smooth(0, 1, away));
    c.sx = Math.cos(angle) * radius;
    c.sy = Math.sin(angle) * radius * 0.75;
    c.dist = t < tl.strike1
      ? lerpDistance(COMPUTER_FAR, COMPUTER_NEAR, approach)
      : lerpDistance(COMPUTER_NEAR, COMPUTER_GONE, away * away);
    c.scale = smooth(tl.computerIn, tl.computerIn + 0.35, t) * (1 - smooth(tl.computerOut - 0.6, tl.computerOut, t));

    // Title: emerges from the centre, holds with a push-in, dissolves forward.
    const title = f.title;
    title.active = t >= tl.titleIn && t < tl.titleOut;
    if (t < tl.strike3) {
      title.dist = lerpDistance(TITLE_FAR, TITLE_HOLD, smooth(tl.titleIn, tl.strike3, t));
    } else if (t < tl.titleHoldEnd) {
      title.dist = lerp(TITLE_HOLD, TITLE_PUSH, (t - tl.strike3) / (tl.titleHoldEnd - tl.strike3));
    } else {
      const k = Math.min(1, (t - tl.titleHoldEnd) / (tl.titleOut - tl.titleHoldEnd));
      title.dist = lerp(TITLE_PUSH, TITLE_FLY, k * k);
    }
    title.reveal = smooth(tl.titleIn, tl.titleIn + 0.6, t) * (1 - smooth(tl.titleHoldEnd, tl.titleOut, t));
  }
}
