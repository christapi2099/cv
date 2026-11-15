import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from 'three';
import { streaksFragmentShader, streaksVertexShader } from '../shaders/streaks.glsl.js';

/** Small deterministic PRNG so every load looks the same (mulberry32). */
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Layer 2: star streaks. The buffer is allocated once for the richest tier;
 * quality changes only move the draw range, so nothing is ever reallocated.
 * Implements the entity lifecycle: setQuality · setTheme · setIntensity · dispose.
 */
export class StreaksEntity {
  #geometry;
  #material;
  #uniforms;

  /**
   * @param {{ shared: object, theme: object, tier: object, intensity: number,
   *           maxPoints: number, range: number, near: number, seed?: number }} options
   */
  constructor({ shared, theme, tier, intensity, maxPoints, range, near, seed = 0x5eed }) {
    this.#geometry = StreaksEntity.#buildGeometry(maxPoints, seed);

    this.#uniforms = {
      ...shared,
      uRange: { value: range },
      uNear: { value: near },
      uIntensity: { value: intensity },
      uStar: { value: new Color() },
      uFilament: { value: new Color() },
    };

    this.#material = new ShaderMaterial({
      vertexShader: streaksVertexShader,
      fragmentShader: streaksFragmentShader,
      uniforms: this.#uniforms,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.object3D = new Points(this.#geometry, this.#material);
    this.object3D.frustumCulled = false; // projected in the vertex shader
    this.object3D.renderOrder = 1;

    this.setQuality(tier);
    this.setTheme(theme);
  }

  static #buildGeometry(count, seed) {
    const random = createRandom(seed);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = random() * Math.PI * 2; // angle
      seeds[i * 3 + 1] = 0.75 + random() * 0.9; // radius factor
      seeds[i * 3 + 2] = random(); // depth seed
    }
    const geometry = new BufferGeometry();
    // three.js derives the vertex count from `position`; values are unused.
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    return geometry;
  }

  setQuality(tier) {
    const max = this.#geometry.getAttribute('position').count;
    this.#geometry.setDrawRange(0, Math.min(tier.points, max));
  }

  setTheme(theme) {
    this.#uniforms.uStar.value.set(theme.star);
    this.#uniforms.uFilament.value.set(theme.filament);
  }

  setIntensity(intensity) {
    this.#uniforms.uIntensity.value = intensity;
  }

  dispose() {
    this.object3D.removeFromParent();
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
