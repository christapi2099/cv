import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  Mesh,
  ShaderMaterial,
} from 'three';
import { LIGHTNING } from '../config.js';
import { lightningFragmentShader, lightningVertexShader } from '../shaders/lightning.glsl.js';
import {
  MAX_RIBBON_INDICES,
  MAX_RIBBON_VERTICES,
  buildRibbon,
  createBoltBuffers,
  generateBolt,
} from './boltPath.js';

/**
 * Lightning bolts: a pool of `poolSize` ribbon meshes with preallocated
 * buffers. A bolt's path is generated in JS when it spawns (never per frame);
 * update() only changes one uniform per visible bolt. Invisible bolts cost no
 * draw call. Lifecycle: setQuality · setTheme · setIntensity · dispose.
 */
export class LightningEntity {
  #bolts = [];
  #scratch = createBoltBuffers();
  #random;
  #coreColor = new Color();
  #glowColor = new Color();
  #cfg;

  /**
   * @param {{ shared: object, palette: object, random?: () => number, config?: object }} options
   */
  constructor({ shared, palette, random = Math.random, config = LIGHTNING }) {
    this.#random = random;
    this.#cfg = config;
    this.object3D = new Group();
    this.object3D.renderOrder = 2;
    for (let i = 0; i < config.poolSize; i++) {
      const geometry = new BufferGeometry();
      const positions = new Float32Array(MAX_RIBBON_VERTICES * 3);
      const ribbon = new Float32Array(MAX_RIBBON_VERTICES * 2);
      const indices = new Uint16Array(MAX_RIBBON_INDICES);
      geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
      geometry.setAttribute('aRibbon', new BufferAttribute(ribbon, 2).setUsage(DynamicDrawUsage));
      geometry.setIndex(new BufferAttribute(indices, 1).setUsage(DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const uniforms = {
        uResolution: shared.uResolution,
        uCoreColor: { value: this.#coreColor },
        uGlowColor: { value: this.#glowColor },
        uAlpha: { value: 0 },
      };
      const material = new ShaderMaterial({
        vertexShader: lightningVertexShader,
        fragmentShader: lightningFragmentShader,
        uniforms,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false; // positioned in clip space by the shader
      mesh.renderOrder = 2;
      mesh.visible = false;
      this.object3D.add(mesh);
      this.#bolts.push({ mesh, geometry, material, uniforms, positions, ribbon, indices, age: Infinity, gain: 1, born: 0 });
    }
    this.setPalette(palette);
  }

  /** Number of bolts currently drawn. */
  get activeCount() {
    let n = 0;
    for (const bolt of this.#bolts) if (bolt.mesh.visible) n++;
    return n;
  }

  /**
   * Spawn a bolt from (x0, y0) to (x1, y1), in short-side screen units.
   * Reuses a free pool slot, or the oldest bolt.
   */
  spawn(x0, y0, x1, y1, gain = 1, width = 0.007) {
    let slot = this.#bolts[0];
    for (const bolt of this.#bolts) {
      if (!bolt.mesh.visible) { slot = bolt; break; }
      if (bolt.age > slot.age) slot = bolt;
    }
    generateBolt(this.#scratch, x0, y0, x1, y1, this.#random, { width });
    const count = buildRibbon(this.#scratch, slot.positions, slot.ribbon, slot.indices);
    const { geometry } = slot;
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('aRibbon').needsUpdate = true;
    geometry.index.needsUpdate = true;
    geometry.setDrawRange(0, count);
    slot.age = 0;
    slot.gain = gain;
    slot.uniforms.uAlpha.value = 0;
    slot.mesh.visible = true;
  }

  /** Advance bolt lives: brief rise, 2–3 frame flicker (≤ 30%), hold, fade. */
  update(dt) {
    const { boltLife, boltFade, flickerAmp } = this.#cfg;
    const bolts = this.#bolts;
    for (let i = 0; i < bolts.length; i++) { // indexed: no iterator allocation per frame
      const bolt = bolts[i];
      if (!bolt.mesh.visible) continue;
      bolt.age += dt;
      const age = bolt.age;
      if (age >= boltLife + boltFade) {
        bolt.mesh.visible = false;
        bolt.uniforms.uAlpha.value = 0;
        continue;
      }
      const rise = Math.min(1, age / 0.03);
      const flicker = age < 0.1 ? 1 - flickerAmp * (Math.floor(age * 30) % 2) : 1;
      const tail = age > boltLife ? 1 - (age - boltLife) / boltFade : 1;
      bolt.uniforms.uAlpha.value = bolt.gain * rise * flicker * tail * tail;
    }
  }

  /** Hide every bolt at once (lightning switched off, reduced motion). */
  clear() {
    for (const bolt of this.#bolts) {
      bolt.mesh.visible = false;
      bolt.age = Infinity;
      bolt.uniforms.uAlpha.value = 0;
    }
  }

  setPalette(palette) {
    this.#coreColor.set(palette.lightning);
    this.#glowColor.set(palette.core).lerp(this.#coreColor, 0.35);
  }

  setQuality() {}

  setTheme() {}

  setIntensity() {}

  dispose() {
    this.object3D.removeFromParent();
    for (const bolt of this.#bolts) {
      bolt.geometry.dispose();
      bolt.material.dispose();
    }
    this.#bolts = [];
  }
}
