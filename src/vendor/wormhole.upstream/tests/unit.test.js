// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, THEMES, VISUAL, validateOptions, resolveTheme } from '../wormhole/config.js';
import { QualityManager } from '../wormhole/core/QualityManager.js';
import { Loop } from '../wormhole/core/Loop.js';
import { Visibility } from '../wormhole/core/Visibility.js';

const collect = () => { const msgs = []; return { msgs, warn: (m) => msgs.push(m) }; };

test('validateOptions: defaults, frozen, no warnings', () => {
  const { msgs, warn } = collect();
  const o = validateOptions({}, warn);
  assert.equal(o.speed, DEFAULTS.speed);
  assert.equal(o.theme, THEMES.vortex);
  assert.ok(Object.isFrozen(o));
  assert.deepEqual(msgs, []);
});

test('validateOptions: bad values fall back with warnings and never throw', () => {
  const { msgs, warn } = collect();
  const o = validateOptions({
    speed: 'fast', intensity: NaN, maxDpr: 9, sway: -1, quality: 'ultra',
    theme: { deep: 'nope', energy: '#abc' }, pointerParallax: 'yes', fallbackClass: 'a b',
    onQualityChange: 42, bogus: true,
  }, warn);
  assert.equal(o.speed, 1);
  assert.equal(o.intensity, DEFAULTS.intensity);
  assert.equal(o.maxDpr, 2);
  assert.equal(o.sway, 0);
  assert.equal(o.quality, 'auto');
  assert.equal(o.theme.deep, THEMES.vortex.deep);
  assert.equal(o.theme.energy, '#abc');
  assert.equal(o.pointerParallax, true);
  assert.equal(o.fallbackClass, DEFAULTS.fallbackClass);
  assert.equal(o.onQualityChange, null);
  assert.ok(msgs.length >= 9, msgs.join('\n'));
});

test('validateOptions: non-object input', () => {
  const { msgs, warn } = collect();
  assert.equal(validateOptions(null, warn).speed, 1);
  assert.equal(msgs.length, 1);
});

test('resolveTheme: unknown name and prototype keys are rejected', () => {
  assert.equal(resolveTheme('toString'), THEMES.vortex);
  assert.equal(resolveTheme('nebula'), THEMES.nebula);
});

test('wrap is a multiple of the streak depth (no streak jump on wrap)', () => {
  assert.equal(VISUAL.wrap % VISUAL.streakDepth, 0);
});

// ── QualityManager ───────────────────────────────────────────────────────────
function run(qm, ms, frames, start = 0) {
  let now = start;
  for (let i = 0; i < frames; i++) { now += ms; qm.sample(ms, now); }
  return now;
}

test('QualityManager: steps down when slow from the first frame', () => {
  const changes = [];
  const qm = new QualityManager({ initialTier: 'high', adaptive: true, onChange: (t) => changes.push(t) });
  run(qm, 40, 200);
  assert.deepEqual(changes, ['medium', 'low']);
});

test('QualityManager: stable 60 Hz and 120 Hz never step down', () => {
  for (const ms of [1000 / 60, 1000 / 120]) {
    const changes = [];
    const qm = new QualityManager({ initialTier: 'high', adaptive: true, onChange: (t) => changes.push(t) });
    run(qm, ms, 5000);
    assert.deepEqual(changes, [], `at ${ms}ms`);
  }
});

test('QualityManager: 120 Hz screen running at 60 fps is not degraded', () => {
  const changes = [];
  const qm = new QualityManager({ initialTier: 'high', adaptive: true, onChange: (t) => changes.push(t) });
  let now = run(qm, 1000 / 120, 600);
  run(qm, 1000 / 60, 2000, now);
  assert.deepEqual(changes, []);
});

test('QualityManager: steps up when fast, with cooldown, and never re-tries a failed tier', () => {
  const changes = [];
  const qm = new QualityManager({ initialTier: 'medium', adaptive: true, onChange: (t) => changes.push(t) });
  let now = run(qm, 1000 / 60, 60 * 40); // 40 s smooth
  assert.deepEqual(changes, ['high']);
  now = run(qm, 40, 80, now); // high is too slow for ~3 s
  assert.deepEqual(changes, ['high', 'medium']);
  run(qm, 1000 / 60, 60 * 120, now); // smooth again for 2 minutes
  assert.deepEqual(changes, ['high', 'medium'], 'must not oscillate back to high');
});

test('QualityManager: pinned tier never adapts', () => {
  const changes = [];
  const qm = new QualityManager({ initialTier: 'high', adaptive: false, onChange: (t) => changes.push(t) });
  run(qm, 50, 500);
  assert.deepEqual(changes, []);
  qm.setTier('low');
  assert.deepEqual(changes, ['low']);
  assert.equal(qm.tier, 'low');
});

// ── Loop ─────────────────────────────────────────────────────────────────────
function fakeWin() {
  let id = 0; const queue = new Map();
  return {
    requestAnimationFrame: (cb) => { queue.set(++id, cb); return id; },
    cancelAnimationFrame: (h) => queue.delete(h),
    flush(now) { const cbs = [...queue.values()]; queue.clear(); cbs.forEach((cb) => cb(now)); },
    get pending() { return queue.size; },
  };
}

test('Loop: first dt is 0, dt is clamped, resume does not jump', () => {
  const win = fakeWin(); const dts = [];
  const loop = new Loop((dt) => dts.push(dt), { maxDt: 0.05, win });
  loop.start(); loop.start(); // idempotent
  assert.equal(win.pending, 1);
  win.flush(1000); win.flush(1016); win.flush(3000);
  assert.deepEqual(dts.map((d) => +d.toFixed(3)), [0, 0.016, 0.05]);
  loop.stop();
  assert.equal(win.pending, 0);
  loop.start(); win.flush(90000);
  assert.equal(dts.at(-1), 0);
});

// ── Visibility ───────────────────────────────────────────────────────────────
test('Visibility: combines page visibility and intersection, emits on change only', () => {
  const listeners = {};
  const doc = { hidden: false, addEventListener: (t, f) => { listeners[t] = f; } };
  let ioCb;
  const win = { IntersectionObserver: class { constructor(cb) { ioCb = cb; } observe() {} disconnect() {} } };
  const seen = [];
  const v = new Visibility({}, (x) => seen.push(x), { signal: new AbortController().signal, doc, win });
  ioCb([{ isIntersecting: false }]);
  ioCb([{ isIntersecting: false }]);
  doc.hidden = true; listeners.visibilitychange();
  ioCb([{ isIntersecting: true }]);
  doc.hidden = false; listeners.visibilitychange();
  assert.deepEqual(seen, [false, true]);
  v.dispose();
});

// ── Review fixes ─────────────────────────────────────────────────────────────
import { RunState } from '../wormhole/core/RunState.js';
import { resolveSpeed, resolveIntensity } from '../wormhole/config.js';

test('RunState: runs only when every condition allows', () => {
  const run = new RunState({ wantsRun: true });
  assert.equal(run.shouldRun, true);
  for (const [key, value] of [['visible', false], ['contextLost', true], ['reducedMotion', true], ['wantsRun', false]]) {
    run.set(key, value);
    assert.equal(run.shouldRun, false, key);
    run.set(key, !value);
    assert.equal(run.shouldRun, true, key);
  }
  assert.throws(() => run.set('bogus', true), RangeError);
});

test('RunState: still frames only when idle, visible and the context is alive', () => {
  const run = new RunState({ wantsRun: true, reducedMotion: true });
  assert.equal(run.shouldRenderStill, true);
  run.set('visible', false);
  assert.equal(run.shouldRenderStill, false);
  run.set('visible', true); run.set('contextLost', true);
  assert.equal(run.shouldRenderStill, false);
});

test('runtime setters keep the current value for missing or bad input', () => {
  const { msgs, warn } = collect();
  assert.equal(resolveSpeed(undefined, warn, 2.5), 2.5);
  assert.equal(resolveSpeed('3', warn, 2.5), 2.5);
  assert.equal(resolveSpeed(9, warn, 2.5), 4);
  assert.equal(resolveIntensity(0.3, warn, 0.8), 0.3);
  assert.equal(msgs.length, 3);
});

test('validateOptions: calm and onStateChange', () => {
  const fn = () => {};
  const o = validateOptions({ calm: 0.2, onStateChange: fn });
  assert.equal(o.calm, 0.2);
  assert.equal(o.onStateChange, fn);
});

test('QualityManager: a 30 Hz-capped display is detected and the tier restored', () => {
  const changes = [];
  const qm = new QualityManager({ initialTier: 'high', adaptive: true, onChange: (t) => changes.push(t) });
  run(qm, 1000 / 30, 30 * 60); // a full minute at a steady, capped 30 Hz
  assert.deepEqual(changes, ['medium', 'low', 'high'], 'probe down, find no gain, restore');
});

test('QualityManager: GPU-bound with vsync quantisation keeps the tier that helped', () => {
  const changes = [];
  const cost = { high: 33.3, medium: 33.3, low: 16.7 }; // medium alone does not help, low does
  const qm = new QualityManager({ initialTier: 'high', adaptive: true, onChange: (t) => changes.push(t) });
  let now = 0;
  for (let i = 0; i < 60 * 60; i++) { const ms = cost[qm.tier]; now += ms; qm.sample(ms, now); }
  assert.deepEqual(changes, ['medium', 'low']);
});
