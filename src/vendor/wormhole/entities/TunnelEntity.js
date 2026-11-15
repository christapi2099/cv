import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { tunnelFragmentShader, tunnelVertexShader } from '../shaders/tunnel.glsl.js';

/**
 * Layer 1: the procedural tunnel, drawn as one full-screen quad.
 * Implements the entity lifecycle: setQuality · setTheme · setIntensity · dispose.
 */
export class TunnelEntity {
  #geometry;
  #material;
  #uniforms;

  /**
   * @param {{ shared: object, theme: object, tier: object, intensity: number }} options
   */
  constructor({ shared, theme, tier, intensity }) {
    this.#uniforms = {
      ...shared, // shared objects, not copies
      uOctaves: { value: tier.octaves },
      uIntensity: { value: intensity },
      uDeep: { value: new Color() },
      uMid: { value: new Color() },
      uEnergy: { value: new Color() },
      uFilament: { value: new Color() },
    };

    this.#geometry = new PlaneGeometry(2, 2);
    this.#material = new ShaderMaterial({
      vertexShader: tunnelVertexShader,
      fragmentShader: tunnelFragmentShader,
      uniforms: this.#uniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.object3D = new Mesh(this.#geometry, this.#material);
    this.object3D.frustumCulled = false; // positioned in clip space by the shader
    this.object3D.renderOrder = 0;

    this.setTheme(theme);
  }

  setQuality(tier) {
    this.#uniforms.uOctaves.value = tier.octaves;
  }

  /** Hex strings are sRGB; Color.set converts them to the linear working space. */
  setTheme(theme) {
    const u = this.#uniforms;
    u.uDeep.value.set(theme.deep);
    u.uMid.value.set(theme.mid);
    u.uEnergy.value.set(theme.energy);
    u.uFilament.value.set(theme.filament);
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
