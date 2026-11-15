/**
 * Intro music (R1 / D6). One `<audio>` element, one WebAudio graph.
 *
 * Rules encoded here:
 *  - the source is attached only when the intro starts (`preload="none"`),
 *  - loudness is controlled by a `GainNode` only (never `audio.volume`):
 *    0 → 0.4 over 500 ms on start, 0.4 → 0 over 2 s on every intro end,
 *  - a rejected `play()` is reported to the caller so the UI can persist
 *    `sound=off` and tell the visitor the truth.
 *
 * The audio asset itself is licensed as a derivative work (plan R1); the
 * visible credit lives in `SoundToggle.astro`.
 */

export const INTRO_AUDIO_SRC = '/audio/intro-8bit.mp3';
export const MUSIC_CREDIT = 'Music: Lichttrager (YouTube) — I do not own this music';
export const SOUND_BLOCKED_MESSAGE =
  'Sound was blocked by your browser — tap to enable';

export const TARGET_GAIN = 0.4;
export const FADE_IN_MS = 500;
export const FADE_OUT_MS = 2000;

export interface IntroSoundOptions {
  readonly src?: string;
  readonly targetGain?: number;
  readonly fadeInMs?: number;
  readonly fadeOutMs?: number;
}

export interface IntroSound {
  /** True only while the element is actually producing audio. */
  readonly playing: boolean;
  /** Resolves true when playback really started. Never throws. */
  play(): Promise<boolean>;
  /** Fade to silence, then detach the source and pause. */
  fadeOut(durationMs?: number): void;
  /** Immediate silence (theme change / dispose). */
  stop(): void;
  dispose(): void;
}

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = window.AudioContext;
  return typeof ctor === 'function' ? ctor : null;
}

export function createIntroSound(
  audio: HTMLAudioElement,
  options: IntroSoundOptions = {},
): IntroSound {
  const src = options.src ?? INTRO_AUDIO_SRC;
  const targetGain = options.targetGain ?? TARGET_GAIN;
  const fadeInMs = options.fadeInMs ?? FADE_IN_MS;
  const fadeOutMs = options.fadeOutMs ?? FADE_OUT_MS;

  audio.preload = 'none';
  audio.loop = true;

  let context: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let sourceNode: MediaElementAudioSourceNode | null = null;
  let fadeTimer = 0;
  let pending: Promise<boolean> | null = null;
  let abortPending = false;
  let disposed = false;

  const isPlaying = (): boolean => !audio.paused && !audio.ended;

  /** Build the graph once. Returns false when WebAudio is unavailable. */
  const ensureGraph = (): boolean => {
    if (context && gainNode) return true;
    const Ctor = audioContextCtor();
    if (!Ctor) return false;
    try {
      context = new Ctor();
      gainNode = context.createGain();
      gainNode.gain.value = 0;
      sourceNode = context.createMediaElementSource(audio);
      sourceNode.connect(gainNode);
      gainNode.connect(context.destination);
      return true;
    } catch {
      context = null;
      gainNode = null;
      sourceNode = null;
      return false;
    }
  };

  const rampFromSilence = (): void => {
    if (!context || !gainNode) return;
    const now = context.currentTime;
    const gain = gainNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(targetGain, now + fadeInMs / 1000);
  };

  const clearFadeTimer = (): void => {
    if (fadeTimer !== 0) {
      window.clearTimeout(fadeTimer);
      fadeTimer = 0;
    }
  };

  const detachSource = (): void => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };

  const stop = (): void => {
    clearFadeTimer();
    abortPending = true;
    if (gainNode && context) {
      const gain = gainNode.gain;
      const now = context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0, now);
    }
    detachSource();
  };

  const play = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false);
    if (isPlaying()) return Promise.resolve(true);
    if (pending) return pending;

    abortPending = false;
    pending = (async (): Promise<boolean> => {
      if (!ensureGraph() || !context) return false;
      clearFadeTimer();
      if (audio.getAttribute('src') !== src) {
        audio.src = src;
      }
      try {
        // Both calls happen synchronously inside the initiating gesture.
        const resumed = context.resume();
        const played = audio.play();
        await Promise.all([resumed, played]);
        // An intro end (or an explicit mute) can land while play() is
        // resolving; never ramp back up over a fade that already began.
        if (abortPending) {
          abortPending = false;
          stop();
          return true;
        }
        rampFromSilence();
        return true;
      } catch {
        stop();
        return false;
      }
    })().finally(() => {
      pending = null;
    });

    return pending;
  };

  const fadeOut = (durationMs = fadeOutMs): void => {
    if (pending !== null) abortPending = true;
    if (!context || !gainNode) {
      stop();
      return;
    }
    if (audio.paused) {
      stop();
      return;
    }
    clearFadeTimer();
    const now = context.currentTime;
    const gain = gainNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + durationMs / 1000);
    // A looped element never fires `ended`; pause after the tail is silent.
    fadeTimer = window.setTimeout(() => {
      fadeTimer = 0;
      detachSource();
    }, durationMs + 60);
  };

  return {
    get playing(): boolean {
      return isPlaying();
    },
    play,
    fadeOut,
    stop,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stop();
      sourceNode?.disconnect();
      gainNode?.disconnect();
      sourceNode = null;
      gainNode = null;
      void context?.close().catch(() => undefined);
      context = null;
    },
  };
}
