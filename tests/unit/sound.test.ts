import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FADE_IN_MS, FADE_OUT_MS, TARGET_GAIN, createIntroSound } from '../../src/lib/sound';

/**
 * Replay-inside-the-fade regression (review pass 1, m1).
 *
 * `play()` used to return early whenever the element was still un-paused. Right
 * after a fade-out starts, the element *is* still un-paused (the ramp runs for
 * FADE_OUT_MS before the detach timer pauses it), so a replay within that
 * window left the old timer armed: 2 s later it paused and stripped the src of
 * the track that had just restarted. These tests pin the corrected contract.
 */

interface GainCall {
  method: string;
  value: number;
  time: number;
}

class FakeAudioParam {
  value = 0;
  readonly calls: GainCall[] = [];

  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.calls.push({ method: 'setValueAtTime', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ method: 'linearRampToValueAtTime', value, time });
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.calls.push({ method: 'cancelScheduledValues', value: Number.NaN, time });
    return this;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static currentTime = 0;

  readonly destination = {};
  readonly gains: FakeGainNode[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  get currentTime(): number {
    return FakeAudioContext.currentTime;
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createMediaElementSource(): { connect: () => void; disconnect: () => void } {
    return { connect: () => undefined, disconnect: () => undefined };
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

interface FakeAudio extends HTMLAudioElement {
  readonly pauseCount: number;
  readonly playCount: number;
}

function fakeAudio(): FakeAudio {
  let srcAttribute: string | null = null;
  let pauseCount = 0;
  let playCount = 0;

  const element = {
    paused: true,
    ended: false,
    preload: '',
    loop: false,
    get pauseCount() {
      return pauseCount;
    },
    get playCount() {
      return playCount;
    },
    getAttribute(name: string): string | null {
      return name === 'src' ? srcAttribute : null;
    },
    removeAttribute(name: string): void {
      if (name === 'src') srcAttribute = null;
    },
    get src(): string {
      return srcAttribute ?? '';
    },
    set src(value: string) {
      srcAttribute = value;
    },
    load(): void {},
    pause(): void {
      pauseCount += 1;
      element.paused = true;
    },
    play(): Promise<void> {
      playCount += 1;
      element.paused = false;
      return Promise.resolve();
    },
  };

  return element as unknown as FakeAudio;
}

const originalWindow = globalThis.window;

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  FakeAudioContext.currentTime = 0;
  (globalThis as { window?: unknown }).window = {
    AudioContext: FakeAudioContext,
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  };
});

afterEach(() => {
  vi.useRealTimers();
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

describe('createIntroSound', () => {
  it('fades in from silence over the owner-amended window', async () => {
    const audio = fakeAudio();
    const sound = createIntroSound(audio, { fadeInMs: FADE_IN_MS, fadeOutMs: FADE_OUT_MS });

    await expect(sound.play()).resolves.toBe(true);
    expect(sound.playing).toBe(true);

    const gain = FakeAudioContext.instances[0]?.gains[0]?.gain;
    const ramp = gain?.calls.find((call) => call.method === 'linearRampToValueAtTime');
    expect(ramp?.value).toBe(TARGET_GAIN);
    expect(ramp?.time).toBeCloseTo(FADE_IN_MS / 1000, 6);
    sound.dispose();
  });

  it('a replay inside the fade-out window keeps the source attached', async () => {
    const audio = fakeAudio();
    const sound = createIntroSound(audio, { fadeInMs: 10, fadeOutMs: FADE_OUT_MS });

    await sound.play();
    const pausesBeforeFade = audio.pauseCount;

    sound.fadeOut();
    // Still un-paused: the detach timer has not fired yet.
    expect(audio.paused).toBe(false);

    // Replay ~inside the 2 s window instead of returning early with the old
    // timer armed.
    await expect(sound.play()).resolves.toBe(true);
    expect(sound.playing).toBe(true);

    vi.advanceTimersByTime(FADE_OUT_MS + 500);

    // The stale timer must not have paused or detached the restarted track.
    expect(audio.paused).toBe(false);
    expect(audio.getAttribute('src')).toBe('/audio/intro-8bit.mp3');
    expect(audio.pauseCount).toBe(pausesBeforeFade);

    // ...and the pending 0.4 → 0 ramp was cancelled, then the gentle fade-in
    // re-armed from silence: the last scheduled ramp targets the full gain.
    const gain = FakeAudioContext.instances[0]?.gains[0]?.gain;
    const ramps = (gain?.calls ?? []).filter(
      (call) => call.method === 'linearRampToValueAtTime',
    );
    expect(ramps.at(-1)?.value).toBe(TARGET_GAIN);
    expect(gain?.calls.some((call) => call.method === 'cancelScheduledValues')).toBe(true);
    sound.dispose();
  });

  it('replaying after the fade completed starts the source again', async () => {
    const audio = fakeAudio();
    const sound = createIntroSound(audio, { fadeInMs: 10, fadeOutMs: 20 });

    await sound.play();
    sound.fadeOut();
    vi.advanceTimersByTime(200);

    expect(audio.paused).toBe(true);
    expect(audio.getAttribute('src')).toBeNull();

    await expect(sound.play()).resolves.toBe(true);
    expect(audio.paused).toBe(false);
    expect(audio.getAttribute('src')).toBe('/audio/intro-8bit.mp3');
    sound.dispose();
  });
});
