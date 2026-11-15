import { Vector2 } from 'three';

/**
 * Uniforms shared by every layer (one source of truth for time, travel and
 * projection). three.js lets materials share uniform objects, so updating
 * these once per frame updates every shader.
 */
export class FrameUniforms {
  /**
   * @param {{ depthScale: number, twist: number, spin: number, calm: number, flashRadius?: number }} params
   * The v2 uniforms (flash, ambient, fade) are shared too; shaders that do not
   * declare them (the classic look) simply ignore them.
   */
  constructor({ depthScale, twist, spin, calm, flashRadius = 0.25 }) {
    this.uniforms = Object.freeze({
      uResolution: { value: new Vector2(1, 1) },
      uCenter: { value: new Vector2(0, 0) },
      uTime: { value: 0 },
      uOffset: { value: 0 },
      uPixelRatio: { value: 1 },
      uDepthScale: { value: depthScale },
      uTwist: { value: twist },
      uSpin: { value: spin },
      uCalm: { value: calm }, // 0..1 dimming of bright detail behind centred text
      // v2
      uFlash: { value: 0 }, // lightning cloud illumination 0..1
      uFlashPos: { value: new Vector2(0, 0) }, // short-side screen units
      uFlashRadius: { value: flashRadius },
      uAmbient: { value: 1 }, // 0 = intro grading, 1 = ambient grading
      uFade: { value: 0 }, // 1 = black
    });
  }

  /**
   * @param {{ time: number, offset: number, center: { x: number, y: number },
   *   flash?: number, flashX?: number, flashY?: number, ambient?: number, fade?: number }} state
   */
  update({ time, offset, center, flash = 0, flashX = 0, flashY = 0, ambient = 1, fade = 0 }) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uOffset.value = offset;
    u.uCenter.value.set(center.x, center.y);
    u.uFlash.value = flash;
    u.uFlashPos.value.set(flashX, flashY);
    u.uAmbient.value = ambient;
    u.uFade.value = fade;
  }

  /** @param {number} bufferWidth device pixels  @param {number} bufferHeight  @param {number} pixelRatio */
  resize(bufferWidth, bufferHeight, pixelRatio) {
    this.uniforms.uResolution.value.set(Math.max(1, bufferWidth), Math.max(1, bufferHeight));
    this.uniforms.uPixelRatio.value = pixelRatio;
  }
}
