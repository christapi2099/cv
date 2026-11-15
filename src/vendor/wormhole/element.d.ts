/**
 * Types for the vendored `<wormhole-bg>` element (D6).
 *
 * The element is plain JavaScript upstream; this declaration lets the site
 * import it from TypeScript without weakening `allowJs`/`strict`. It mirrors
 * only the public surface the bridge uses (`controller`, `ready`).
 */

export interface WormholeHandleState {
  readonly running: boolean;
  readonly intro: 'idle' | 'pending' | 'playing';
  readonly introMode: 'off' | 'once' | 'always';
  readonly look: 'storm' | 'classic';
  readonly reducedMotion: boolean;
  readonly contextLost: boolean;
  readonly failed: boolean;
  readonly disposed: boolean;
  readonly ambientOpacity: number;
}

export interface WormholeController {
  readonly supported: boolean;
  start(): void;
  stop(): void;
  skipIntro(): void;
  replayIntro(): boolean;
  dispose(): void;
  readonly state: WormholeHandleState;
}

export interface WormholeReadyDetail {
  readonly supported: boolean;
  readonly controller: WormholeController | null;
}

export interface WormholeIntroEndDetail {
  readonly skipped: boolean;
  readonly reason: string;
}

export class WormholeBackground extends HTMLElement {
  static readonly observedAttributes: readonly string[];
  readonly controller: WormholeController | null;
  readonly ready: Promise<WormholeController | null>;
}

export function defineWormhole(tagName?: string): void;
