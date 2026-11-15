import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { stormFragmentShader, stormVertexShader } from '../shaders/storm.glsl.js';

/**
 * v2 storm look: the cloud tunnel, one full-screen quad.
 * Lifecycle: setQuality · setTheme · setIntensity · dispose.
 * Flash, ambient grading and fade come from the shared FrameUniforms.
 */
export class StormEntity {
  #geometry;
  #material;
  #uniforms;

  /**
   * @param {{ shared: object, palette: object, tier: object, intensity: number }} options
   */
  constructor({ shared, palette, tier, intensity }) {
    this.#uniforms = {
      ...shared, // shared uniform objects, not copies
      uOctaves: { value: tier.stormOctaves },
      uWarp: { value: tier.stormWarp ? 1 : 0 },
      uIntensity: { value: intensity },
      uDeep: { value: new Color() },
      uCloudDark: { value: new Color() },
      uCloudMid: { value: new Color() },
      uCloudLight: { value: new Color() },
      uCore: { value: new Color() },
      uLightning: { value: new Color() },
    };
    this.#geometry = new PlaneGeometry(2, 2);
    this.#material = new ShaderMaterial({
      vertexShader: stormVertexShader,
      fragmentShader: stormFragmentShader,
      uniforms: this.#uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.object3D = new Mesh(this.#geometry, this.#material);
    this.object3D.frustumCulled = false;
    this.object3D.renderOrder = 0;
    this.setPalette(palette);
  }

  setQuality(tier) {
    this.#uniforms.uOctaves.value = tier.stormOctaves;
    this.#uniforms.uWarp.value = tier.stormWarp ? 1 : 0;
  }

  /** The storm look uses its own palette; v1 `theme` applies to the classic look. */
  setTheme() {}

  /** @param {{ deep: string, cloudDark: string, cloudMid: string, cloudLight: string, core: string, lightning: string }} palette */
  setPalette(palette) {
    const u = this.#uniforms;
    u.uDeep.value.set(palette.deep);
    u.uCloudDark.value.set(palette.cloudDark);
    u.uCloudMid.value.set(palette.cloudMid);
    u.uCloudLight.value.set(palette.cloudLight);
    u.uCore.value.set(palette.core);
    u.uLightning.value.set(palette.lightning);
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
