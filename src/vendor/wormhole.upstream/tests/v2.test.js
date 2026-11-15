// v2 unit tests. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT, DEFAULTS, INTRO_TIMELINE, LIGHTNING, QUALITY_TIERS, STORM_PALETTE, THEMES,
  isValidTimeline, resolveAmbientFps, resolveAmbientOpacity, resolveLightning, resolveLogoText,
  resolveLook, validateOptions,
} from '../wormhole/config.js';
import { IntroDirector, shouldPlayIntro, smooth } from '../wormhole/director/IntroDirector.js';
import { LightningScheduler, flashEnvelope } from '../wormhole/director/LightningScheduler.js';
import { SpringFollower, Tumble } from '../wormhole/physics/Tumble.js';
import {
  MAX_BOLT_POINTS, MAX_RIBBON_INDICES, MAX_RIBBON_VERTICES, buildRibbon, createBoltBuffers, generateBolt,
} from '../wormhole/entities/boltPath.js';
import { logoFit, splitTitle } from '../wormhole/entities/canvasArt.js';
import { hasPlayedIntro, markIntroPlayed } from '../wormhole/core/introMemory.js';
import { Loop } from '../wormhole/core/Loop.js';
import { QualityManager } from '../wormhole/core/QualityManager.js';

const collect = () => { const msgs = []; return { msgs, warn: (m) => msgs.push(m) }; };

/** Deterministic PRNG (mulberry32). */
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Config validation ───────────────────────────────────────────────────────
test('v2 defaults: storm look, once intro, title text, no warnings', () => {
  const { msgs, warn } = collect();
  const o = validateOptions({}, warn);
  assert.equal(o.look, 'storm');
  assert.equal(o.intro, 'once');
  assert.equal(o.computer, true);
  assert.equal(o.logo, true);
  assert.equal(o.logoText, 'CHRISTOPHER TAPIA');
  assert.equal(o.lightning, 'on');
  assert.equal(o.ambientOpacity, 0.4);
  assert.equal(o.ambientFps, 30);
  assert.equal(o.computerColor, '#7b3fe4');
  assert.equal(o.stormPalette, STORM_PALETTE);
  assert.deepEqual(msgs, []);
});

test('v2 options: bad values fall back to defaults with warnings, never throw', () => {
  const { msgs, warn } = collect();
  const o = validateOptions({
    look: 'neon', intro: 'sometimes', computer: 'yes', logo: 0, logoText: 42, lightning: 'loud',
    ambientOpacity: 3, ambientFps: 45, computerColor: 'purple', logoFont: 'x;}', onIntroEnd: 'nope',
    stormPalette: { core: '#123456', cloudDark: 'red', extra: '#fff' },
  }, warn);
  assert.equal(o.look, 'storm');
  assert.equal(o.intro, 'once');
  assert.equal(o.computer, true);
  assert.equal(o.logo, true);
  assert.equal(o.logoText, 'CHRISTOPHER TAPIA');
  assert.equal(o.lightning, 'on');
  assert.equal(o.ambientOpacity, AMBIENT.opacityMax);
  assert.equal(o.ambientFps, 30);
  assert.equal(o.computerColor, '#7b3fe4');
  assert.equal(o.logoFont, 'Michroma');
  assert.equal(o.onIntroEnd, null);
  assert.equal(o.stormPalette.core, '#123456');
  assert.equal(o.stormPalette.cloudDark, STORM_PALETTE.cloudDark);
  assert.ok(Object.isFrozen(o.stormPalette));
  assert.ok(msgs.length >= 13, msgs.join('\n'));
});

test('logo text: trimmed, collapsed, uppercased, max 32 code points', () => {
  const { msgs, warn } = collect();
  assert.equal(resolveLogoText('  ada\t lovelace\n', warn), 'ADA LOVELACE');
  assert.equal(resolveLogoText('a'.repeat(40), warn), 'A'.repeat(32));
  assert.equal(resolveLogoText('   ', warn, 'KEEP'), 'KEEP');
  assert.equal(Array.from(resolveLogoText('é'.repeat(40), warn)).length, 32);
  assert.equal(msgs.length, 3);
});

test('runtime resolvers keep the current value on bad input', () => {
  const { msgs, warn } = collect();
  assert.equal(resolveLook('classic', warn, 'storm'), 'classic');
  assert.equal(resolveLook('x', warn, 'classic'), 'classic');
  assert.equal(resolveLightning('intro-only', warn), 'intro-only');
  assert.equal(resolveAmbientOpacity(0.05, warn, 0.4), AMBIENT.opacityMin);
  assert.equal(resolveAmbientOpacity('0.5', warn, 0.4), 0.4);
  assert.equal(resolveAmbientFps(60, warn), 60);
  assert.equal(resolveAmbientFps(120, warn, 60), 60);
  assert.equal(msgs.length, 4);
});

test('storm theme exists in v1 key format; tiers carry storm settings', () => {
  assert.equal(THEMES.storm.deep, STORM_PALETTE.deep);
  assert.deepEqual([QUALITY_TIERS.high.stormOctaves, QUALITY_TIERS.medium.stormOctaves, QUALITY_TIERS.low.stormOctaves], [5, 4, 3]);
  assert.equal(QUALITY_TIERS.low.stormWarp, false);
  assert.equal(DEFAULTS.look, 'storm');
});

test('intro timeline is valid and its strikes respect the flash gap', () => {
  assert.ok(isValidTimeline(INTRO_TIMELINE));
  assert.equal(isValidTimeline({ ...INTRO_TIMELINE, strike2: 2.9 }), false, 'strikes 0.4 s apart must be rejected');
  assert.equal(isValidTimeline({ ...INTRO_TIMELINE, duration: 'x' }), false);
  assert.throws(() => new IntroDirector({ timeline: { ...INTRO_TIMELINE, titleIn: 99 } }), RangeError);
});

// ── IntroDirector ───────────────────────────────────────────────────────────
function runDirector(director, seconds, step = 1 / 60, startMs = 0) {
  let ms = startMs;
  for (let t = 0; t < seconds && director.active; t += step) { ms += step * 1000; director.update(step, ms); }
  return ms;
}

test('IntroDirector: cues fire once, in timeline order, then it completes', () => {
  const cues = []; const ends = [];
  const d = new IntroDirector({ onCue: (c) => cues.push(c.type === 'strike' ? `strike${c.strike}` : c.type), onEnd: (e) => ends.push(e) });
  d.start(0);
  runDirector(d, 11);
  assert.deepEqual(cues, ['computerIn', 'strike1', 'strike2', 'titleIn', 'strike3', 'titleOut', 'handoff']);
  assert.deepEqual(ends, [{ reason: 'complete', skipped: false }]);
  assert.equal(d.active, false);
  assert.equal(d.frame.ambient, 1);
  assert.ok(Math.abs(d.frame.speedMul - AMBIENT.speed) < 1e-9);
});

test('IntroDirector: a long frame still fires every skipped cue in order', () => {
  const cues = [];
  const d = new IntroDirector({ onCue: (c) => cues.push(c.at) });
  d.start(0);
  d.update(4.5, 4500);
  assert.deepEqual(cues, [0.8, 2.5, 4.2]);
});

test('IntroDirector: skip ends at once with skipped: true and no further cues', () => {
  const cues = []; const ends = [];
  const d = new IntroDirector({ onCue: (c) => cues.push(c.type), onEnd: (e) => ends.push(e) });
  d.start(0);
  runDirector(d, 1.0);
  d.skip();
  d.skip(); // idempotent
  runDirector(d, 5);
  assert.deepEqual(ends, [{ reason: 'skip', skipped: true }]);
  assert.deepEqual(cues, ['computerIn']);
  assert.equal(d.frame.active, false);
  assert.equal(d.frame.computer.active, false);
});

test('IntroDirector: watchdog ends it after 14 s of wall clock, even if animation time stalls', () => {
  const ends = [];
  const d = new IntroDirector({ onEnd: (e) => ends.push(e.reason) });
  d.start(1000);
  d.update(0.016, 2000);
  assert.equal(d.poll(14999), false);
  assert.equal(d.poll(15000), true);
  assert.deepEqual(ends, ['watchdog']);
  const d2 = new IntroDirector({ onEnd: (e) => ends.push(e.reason) });
  d2.start(0);
  d2.update(0, 14000); // the frame-driven check fires too
  assert.deepEqual(ends, ['watchdog', 'watchdog']);
});

test('IntroDirector: tab hidden for more than 2 s ends it; a short hide does not', () => {
  const ends = [];
  const d = new IntroDirector({ onEnd: (e) => ends.push(e.reason) });
  d.start(0);
  d.setPageHidden(true, 1000);
  d.setPageHidden(false, 2500); // 1.5 s hidden
  assert.equal(d.active, true);
  d.setPageHidden(true, 3000);
  assert.equal(d.poll(4900), false);
  assert.equal(d.poll(5100), true); // timer path
  assert.deepEqual(ends, ['hidden']);
  const d2 = new IntroDirector({ onEnd: (e) => ends.push(e.reason) });
  d2.start(0);
  d2.setPageHidden(true, 100);
  d2.setPageHidden(false, 2300); // visibility path
  assert.deepEqual(ends, ['hidden', 'hidden']);
});

test('IntroDirector: choreography is continuous (no teleporting) and bounded', () => {
  const d = new IntroDirector();
  d.start(0);
  let prev = null;
  for (let t = 0; t < 9.99; t += 1 / 240) {
    d.update(1 / 240, t * 1000);
    if (!d.active) break;
    const c = d.frame.computer; const ti = d.frame.title;
    const snap = { sx: c.sx, sy: c.sy, dist: c.dist, scale: c.scale, tdist: ti.dist, reveal: ti.reveal, speed: d.frame.speedMul };
    if (prev) {
      assert.ok(Math.abs(snap.sx - prev.sx) < 0.01, `computer x jump at ${t}`);
      assert.ok(Math.abs(snap.sy - prev.sy) < 0.01, `computer y jump at ${t}`);
      assert.ok(Math.abs(1 / snap.dist - 1 / prev.dist) < 0.01, `computer depth jump at ${t}`);
      assert.ok(Math.abs(snap.reveal - prev.reveal) < 0.02, `title reveal jump at ${t}`);
      assert.ok(Math.abs(snap.speed - prev.speed) < 0.02, `speed jump at ${t}`);
    }
    assert.ok(Math.hypot(c.sx, c.sy) <= 0.25 && c.scale >= 0 && c.scale <= 1);
    prev = snap;
  }
  assert.ok(prev.speed < 0.3, 'eases to ambient speed');
});

test('IntroDirector: the computer is close at strike 1 and the title is formed at strike 3', () => {
  let atStrike1; let atStrike3;
  const d = new IntroDirector({
    onCue: (c) => {
      if (c.strike === 1) atStrike1 = { ...d.frame.computer };
      if (c.strike === 3) atStrike3 = { ...d.frame.title };
    },
  });
  d.start(0);
  runDirector(d, 7);
  assert.ok(atStrike1.active && atStrike1.dist < 5, JSON.stringify(atStrike1));
  assert.ok(atStrike3.reveal > 0.95, JSON.stringify(atStrike3));
});

test('shouldPlayIntro: once/always/off, session memory, reduced motion, look, replay', () => {
  const base = { mode: 'once', reducedMotion: false, playedThisSession: false };
  assert.equal(shouldPlayIntro(base), true);
  assert.equal(shouldPlayIntro({ ...base, playedThisSession: true }), false);
  assert.equal(shouldPlayIntro({ ...base, mode: 'always', playedThisSession: true }), true);
  assert.equal(shouldPlayIntro({ ...base, mode: 'off' }), false);
  assert.equal(shouldPlayIntro({ ...base, reducedMotion: true }), false, 'reduced motion: never');
  assert.equal(shouldPlayIntro({ ...base, reducedMotion: true, replay: true }), false, 'not even on replay');
  assert.equal(shouldPlayIntro({ ...base, look: 'classic' }), false);
  assert.equal(shouldPlayIntro({ ...base, supported: false }), false);
  assert.equal(shouldPlayIntro({ ...base, running: false }), false);
  assert.equal(shouldPlayIntro({ ...base, mode: 'off', replay: true }), true);
});

test('smooth(): clamped Hermite', () => {
  assert.equal(smooth(0, 1, -1), 0);
  assert.equal(smooth(0, 1, 2), 1);
  assert.equal(smooth(0, 1, 0.5), 0.5);
});

// ── LightningScheduler ──────────────────────────────────────────────────────
test('flash envelope: smooth 60 ms rise, eased decay >= 350 ms, never a hard square', () => {
  assert.equal(flashEnvelope(0), 0);
  assert.equal(flashEnvelope(LIGHTNING.rise), 1);
  assert.ok(LIGHTNING.decay >= 0.35);
  assert.ok(flashEnvelope(LIGHTNING.rise + 0.35) > 0, 'still decaying at 350 ms');
  assert.equal(flashEnvelope(LIGHTNING.rise + LIGHTNING.decay + 0.001), 0);
  let max = 0;
  for (let ms = 0; ms < 600; ms += 1) {
    max = Math.max(max, Math.abs(flashEnvelope((ms + 1) / 1000) - flashEnvelope(ms / 1000)));
  }
  assert.ok(max <= 0.03, `largest 1 ms step ${max}`); // 60 ms rise ⇒ ≤ 2.5% per ms
});

test('LightningScheduler: flashes are always at least 1 s apart (< 3 per second)', () => {
  const s = new LightningScheduler({ mode: 'on', random: rng(3) });
  s.setPhase('intro');
  assert.equal(s.trigger(0.9, 0, 0), true);
  s.update(0.5);
  assert.equal(s.trigger(0.9, 0, 0), false, '0.5 s later: refused');
  s.update(0.49);
  assert.equal(s.trigger(0.9, 0, 0), false, '0.99 s later: refused');
  s.update(0.02);
  assert.equal(s.trigger(0.9, 0, 0), true, '1.01 s later: allowed');
  // Hammer it: count flash starts per sliding second.
  const starts = [];
  let t = 0;
  for (let i = 0; i < 6000; i++) { t += 1 / 120; s.update(1 / 120); if (s.trigger(1, 0, 0)) starts.push(t); }
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= LIGHTNING.minGap - 1e-9);
});

test('LightningScheduler: ambient bolts every 8–15 s, flash capped at 0.25', () => {
  const s = new LightningScheduler({ mode: 'on', random: rng(7) });
  s.setPhase('ambient');
  const times = []; let t = 0; let peak = 0;
  for (let i = 0; i < 60 * 60 * 10; i++) { // 10 minutes at 60 Hz
    t += 1 / 60;
    if (s.update(1 / 60)) times.push(t);
    peak = Math.max(peak, s.flash);
    assert.ok(Math.hypot(s.flashX, s.flashY) >= 0.4 || s.flash === 0, 'ambient bolts stay out of the calm zone');
  }
  assert.ok(times.length >= 40 && times.length <= 75, `${times.length} bolts`);
  assert.ok(times[0] >= LIGHTNING.ambientGapMin - 1 / 60 && times[0] <= LIGHTNING.ambientGapMax + 1 / 60);
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    assert.ok(gap >= LIGHTNING.ambientGapMin - 1 / 30 && gap <= LIGHTNING.ambientGapMax + 1 / 30, `gap ${gap}`);
  }
  assert.ok(peak > 0.2 && peak <= LIGHTNING.ambientFlashCap + 1e-9, `peak ${peak}`);
  assert.ok(!s.trigger(1, 0, 0) || s.flash <= LIGHTNING.ambientFlashCap);
});

test('LightningScheduler: off / intro-only / reduced motion', () => {
  const off = new LightningScheduler({ mode: 'off', random: rng(1) });
  off.setPhase('intro');
  assert.equal(off.trigger(1, 0, 0), false);
  off.setPhase('ambient');
  let fired = 0;
  for (let i = 0; i < 60 * 120; i++) if (off.update(1 / 60)) fired++;
  assert.equal(fired, 0);
  assert.equal(off.flash, 0);

  const introOnly = new LightningScheduler({ mode: 'intro-only', random: rng(1) });
  introOnly.setPhase('intro');
  assert.equal(introOnly.trigger(0.9, 0, 0), true);
  introOnly.setPhase('ambient');
  for (let i = 0; i < 60 * 120; i++) if (introOnly.update(1 / 60)) fired++;
  assert.equal(fired, 0, 'no ambient bolts');
  assert.equal(introOnly.flash, 0);

  const reduced = new LightningScheduler({ mode: 'on', reducedMotion: true, random: rng(1) });
  reduced.setPhase('intro');
  assert.equal(reduced.trigger(1, 0, 0), false);
  reduced.setPhase('ambient');
  for (let i = 0; i < 60 * 120; i++) if (reduced.update(1 / 60)) fired++;
  assert.equal(fired, 0);

  const live = new LightningScheduler({ mode: 'on', random: rng(1) });
  live.setPhase('intro');
  live.trigger(1, 0, 0);
  live.update(0.05);
  assert.ok(live.flash > 0);
  live.setMode('off');
  live.update(0.01);
  assert.equal(live.flash, 0, 'switching off clears a running flash');
});

// ── Tumble physics ──────────────────────────────────────────────────────────
test('Tumble: a strike impulse moves smoothly, then decays back', () => {
  const t = new Tumble();
  t.impulse(1, 0.4, -0.3, 2.6, 8);
  const speed0 = t.angularSpeed;
  let maxOffset = 0; let prev = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 60 * 4; i++) {
    t.step(1 / 60);
    const o = t.offset;
    assert.ok(Math.hypot(o.x - prev.x, o.y - prev.y, o.z - prev.z) < 0.1, 'no teleporting');
    prev = { ...o };
    maxOffset = Math.max(maxOffset, t.offsetLength);
  }
  assert.ok(maxOffset > 0.1, 'the shove is visible');
  assert.ok(t.offsetLength < 0.01, `offset decays (${t.offsetLength})`);
  assert.ok(t.angularSpeed < speed0 * 0.05, 'spin decays to the idle spin (0 here)');
});

test('Tumble: stays bounded and finite under absurd impulses and time steps', () => {
  const t = new Tumble({ maxOffset: 1.5, maxAngular: 14 });
  t.setBaseSpin(0.3, 0.6, 0.1);
  for (let i = 0; i < 2000; i++) {
    if (i % 50 === 0) t.impulse(Math.cos(i), Math.sin(i), 0.5, 1e6, 1e6);
    t.step(i % 7 === 0 ? 5 : 1 / 60); // includes multi-second hitches
    assert.ok(t.offsetLength <= 1.5 + 1e-9);
    assert.ok(t.angularSpeed <= 14 + 1e-9);
    const q = t.quaternion;
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-9, 'unit quaternion');
    assert.ok([q.x, q.y, q.z, q.w, t.offset.x].every(Number.isFinite));
  }
  t.impulse(0, 0, 0, 5, 5); // zero direction is ignored
  t.impulse(1, 0, 0, NaN, 1);
  assert.ok(Number.isFinite(t.velocity.x));
});

test('Tumble: dt <= 0 is a no-op; idle spin rotates the body', () => {
  const t = new Tumble();
  t.setBaseSpin(0, 1, 0);
  t.step(0); t.step(-1);
  assert.deepEqual(t.quaternion, { x: 0, y: 0, z: 0, w: 1 });
  for (let i = 0; i < 600; i++) t.step(1 / 60);
  assert.ok(Math.abs(t.angular.y - 1) < 1e-3);
  assert.ok(Math.abs(t.quaternion.w) < 0.999);
});

test('SpringFollower: converges with lag', () => {
  const f = new SpringFollower({ stiffness: 55, damping: 11 });
  f.snap(0, 0, 0);
  f.step(1 / 60, 1, 0, 0);
  assert.ok(f.value.x > 0 && f.value.x < 0.1, 'lags behind');
  for (let i = 0; i < 180; i++) f.step(1 / 60, 1, 0, 0);
  assert.ok(Math.abs(f.value.x - 1) < 0.01);
});

// ── Bolt paths ──────────────────────────────────────────────────────────────
test('generateBolt: exact endpoints, 1–3 tapering branches, bounded buffers', () => {
  const out = createBoltBuffers();
  const random = rng(11);
  for (let i = 0; i < 200; i++) {
    generateBolt(out, 0, 0.6, 0.1, -0.1, random);
    assert.ok(out.lines >= 2 && out.lines <= 4, `${out.lines - 1} branches`);
    assert.ok(out.pointCount <= MAX_BOLT_POINTS);
    const last = out.lineCount[0] - 1;
    assert.equal(out.points[0], 0); assert.ok(Math.abs(out.points[1] - 0.6) < 1e-6);
    assert.ok(Math.abs(out.points[last * 2] - 0.1) < 1e-6 && Math.abs(out.points[last * 2 + 1] + 0.1) < 1e-6);
    for (let l = 1; l < out.lines; l++) {
      const s = out.lineStart[l]; const n = out.lineCount[l];
      assert.ok(out.widths[s + n - 1] < out.widths[s], 'branch tapers');
    }
    for (let k = 0; k < out.pointCount * 2; k++) assert.ok(Number.isFinite(out.points[k]));
  }
  generateBolt(out, 0, 0, 1, 0, random, { branches: 9 });
  assert.equal(out.lines, 4, 'branches clamp to 3');
});

test('buildRibbon: indices stay inside the vertices written and the preallocated arrays', () => {
  const out = createBoltBuffers();
  const positions = new Float32Array(MAX_RIBBON_VERTICES * 3);
  const ribbon = new Float32Array(MAX_RIBBON_VERTICES * 2);
  const indices = new Uint16Array(MAX_RIBBON_INDICES);
  generateBolt(out, -0.2, 0.6, 0.1, 0, rng(5), { branches: 3 });
  const count = buildRibbon(out, positions, ribbon, indices);
  assert.ok(count > 0 && count <= MAX_RIBBON_INDICES && count % 3 === 0);
  const vertices = out.pointCount * 2;
  for (let i = 0; i < count; i++) assert.ok(indices[i] < vertices);
  for (let v = 0; v < vertices; v++) assert.ok(Math.abs(ribbon[v * 2]) === 1);
});

// ── Title layout ────────────────────────────────────────────────────────────
test('splitTitle and logoFit', () => {
  assert.deepEqual(splitTitle('CHRISTOPHER TAPIA'), ['CHRISTOPHER', 'TAPIA']);
  assert.deepEqual(splitTitle('A B C D'), ['A B', 'C D']);
  assert.deepEqual(splitTitle('MONONYM'), ['MONONYM']);
  const tan = Math.tan(Math.PI / 180 * 25);
  const shortWorld = 2 * 7 * tan;
  // Landscape 16:9, wide one-line mask: width = 80% of the viewport width (≤ 1.5× short side).
  const h = logoFit(16 / 9, 7, tan, 7);
  assert.ok(Math.abs(h * 7 - Math.min(0.8 * shortWorld * 16 / 9, 1.5 * shortWorld)) < 1e-9);
  // Portrait: 80% of the short side (the width).
  const hp = logoFit(390 / 844, 3, tan, 7);
  assert.ok(Math.abs(hp * 3 - 0.8 * shortWorld) < 1e-9);
  // Never taller than 30% of the viewport height.
  assert.ok(logoFit(16 / 9, 0.5, tan, 7) <= 0.3 * shortWorld + 1e-9);
});

// ── Session memory, loop cap, quality under cap ─────────────────────────────
test('introMemory: sessionStorage guarded (throws → not played)', () => {
  const store = new Map();
  const win = { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  assert.equal(hasPlayedIntro(win), false);
  markIntroPlayed(win);
  assert.equal(hasPlayedIntro(win), true);
  const hostile = { get sessionStorage() { throw new Error('SecurityError'); } };
  assert.equal(hasPlayedIntro(hostile), false);
  assert.doesNotThrow(() => markIntroPlayed(hostile));
  assert.equal(hasPlayedIntro(undefined), false);
});

function fakeWin() {
  let id = 0; const queue = new Map();
  return {
    requestAnimationFrame: (cb) => { queue.set(++id, cb); return id; },
    cancelAnimationFrame: (h) => queue.delete(h),
    flush(now) { const cbs = [...queue.values()]; queue.clear(); cbs.forEach((cb) => cb(now)); },
  };
}

test('Loop: 30 fps cap on 60 and 120 Hz displays, dt still clamped, uncapping works', () => {
  for (const hz of [60, 120]) {
    const win = fakeWin(); const dts = [];
    const loop = new Loop((dt) => dts.push(dt), { maxDt: 0.05, win });
    loop.setFrameCap(30);
    loop.start();
    let now = 1000;
    for (let i = 0; i < hz * 2; i++) { win.flush(now); now += 1000 / hz; }
    assert.ok(dts.length >= 59 && dts.length <= 61, `${hz} Hz → ${dts.length} ticks in 2 s`);
    assert.ok(dts.slice(1).every((dt) => Math.abs(dt - 1 / 30) < 0.002));
    loop.setFrameCap(0);
    const before = dts.length;
    for (let i = 0; i < hz; i++) { win.flush(now); now += 1000 / hz; }
    assert.ok(dts.length - before >= hz - 1, 'uncapped: every frame ticks');
    loop.stop();
  }
  const win = fakeWin(); const dts = [];
  const loop = new Loop((dt) => dts.push(dt), { maxDt: 0.05, win });
  loop.setFrameCap(30);
  loop.start(); win.flush(0); win.flush(5000);
  assert.deepEqual(dts, [0, 0.05], 'long gap is still clamped');
});

test('QualityManager: on-time capped 30 fps frames never step down; slow capped frames do', () => {
  const changes = [];
  const qm = new QualityManager({ initialTier: 'high', adaptive: true, onChange: (t) => changes.push(t) });
  qm.setFrameCap(1000 / 30);
  let now = 0;
  for (let i = 0; i < 30 * 120; i++) { now += 1000 / 30; qm.sample(1000 / 30, now); }
  assert.deepEqual(changes, []);
  for (let i = 0; i < 30 * 10; i++) { now += 60; qm.sample(60, now); }
  assert.deepEqual(changes.slice(0, 1), ['medium'], 'genuinely slow under the cap');
});
