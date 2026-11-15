import {
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
} from 'three';
import { QUALITY_TIERS } from '../config.js';
import { TITLE_HOLD } from '../director/IntroDirector.js';
import { logoFragmentShader, logoVertexShader } from '../shaders/logo.glsl.js';
import { drawLogoMask, logoFit } from './canvasArt.js';

const MAX_LAYERS = QUALITY_TIERS.high.logoLayers;
const THICKNESS = 0.14; // extrusion depth, in title heights

/**
 * The 3D title, built from a canvas alpha mask (no font files, no fetch):
 * one plane geometry and one texture, drawn as a single InstancedMesh whose
 * instances are slices stacked along -z (fake extrusion). Instance 0 is the
 * brushed-steel front face. The mask is redrawn only when the text or the
 * orientation (one line / two lines) changes.
 */
export class LogoEntity {
  #geometry = new PlaneGeometry(1, 1);
  #material;
  #uniforms;
  #texture = null;
  #canvas = null;
  #aspect = 1;
  #layers;
  #text;
  #fontFamily;
  #loadFont;
  #createCanvas;
  #portrait;
  #buildToken = 0;
  #ready = false;
  #disposed = false;
  #matrix = new Matrix4();
  #warn;

  /**
   * @param {{ shared: object, text: string, fontFamily: string, tier: object, portrait: boolean,
   *   loadFont: (family: string) => Promise<string>, createCanvas: (w: number, h: number) => HTMLCanvasElement,
   *   warn?: (message: string) => void }} options
   */
  constructor({ shared, text, fontFamily, tier, portrait, loadFont, createCanvas, warn = () => {} }) {
    this.#text = text;
    this.#fontFamily = fontFamily;
    this.#loadFont = loadFont;
    this.#createCanvas = createCanvas;
    this.#portrait = portrait;
    this.#warn = warn;
    this.#layers = Math.min(MAX_LAYERS, tier.logoLayers);
    this.#uniforms = {
      uMask: { value: null },
      uTexel: { value: new Vector2(1, 1) },
      uAspect: { value: 1 },
      uLayers: { value: this.#layers },
      uReveal: { value: 0 },
      uFlash: shared.uFlash,
      uTime: shared.uTime,
      uSteel: { value: new Color('#c9d3de') },
      uSteelDark: { value: new Color('#3b4350') },
      uRim: { value: new Color('#8f7bff') },
    };
    this.#material = new ShaderMaterial({
      vertexShader: logoVertexShader,
      fragmentShader: logoFragmentShader,
      uniforms: this.#uniforms,
    });
    this.object3D = new InstancedMesh(this.#geometry, this.#material, MAX_LAYERS);
    this.object3D.count = this.#layers;
    this.object3D.frustumCulled = false;
    this.object3D.visible = false;
    this.#layoutLayers();
    this.ready = this.#build();
  }

  get visible() {
    return this.object3D.visible;
  }

  setText(text) {
    if (text === this.#text) return;
    this.#text = text;
    this.ready = this.#build();
  }

  setPortrait(portrait) {
    if (portrait === this.#portrait) return;
    this.#portrait = portrait;
    this.ready = this.#build();
  }

  setQuality(tier) {
    this.#layers = Math.min(MAX_LAYERS, tier.logoLayers);
    this.object3D.count = this.#layers;
    this.#uniforms.uLayers.value = this.#layers;
    this.#layoutLayers();
  }

  /**
   * @param {{ active: boolean, dist: number, reveal: number }} title  director frame
   * @param {number} tanHalfShort
   * @param {number} viewAspect  width / height
   */
  update(title, tanHalfShort, viewAspect) {
    const mesh = this.object3D;
    if (!title.active || !this.#ready || title.reveal <= 0) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const scale = logoFit(viewAspect, this.#aspect, tanHalfShort, TITLE_HOLD);
    mesh.scale.setScalar(scale);
    mesh.position.set(0, 0, -title.dist);
    // A slow turn during the push-in shows the extrusion.
    // Near-frontal like a title card; a slight turn shows the extruded depth.
    mesh.rotation.set(0.04, -0.06 + 0.03 * (TITLE_HOLD - title.dist), 0);
    this.#uniforms.uReveal.value = title.reveal;
  }

  /** Slices: instance i sits i steps behind the front face. Not per frame. */
  #layoutLayers() {
    const step = THICKNESS / Math.max(1, this.#layers - 1);
    for (let i = 0; i < this.#layers; i++) {
      this.#matrix.makeScale(this.#aspect, 1, 1).setPosition(0, 0, -i * step);
      this.object3D.setMatrixAt(i, this.#matrix);
    }
    this.object3D.instanceMatrix.needsUpdate = true;
  }

  async #build() {
    const token = ++this.#buildToken;
    let family;
    try {
      family = await this.#loadFont(this.#fontFamily);
    } catch {
      family = 'system-ui, sans-serif';
    }
    if (token !== this.#buildToken || this.#disposed) return false;
    try {
      const mask = drawLogoMask(this.#createCanvas, this.#text, family, this.#portrait);
      const texture = new CanvasTexture(mask.canvas); // alpha mask: no colour space
      this.#releaseTexture();
      this.#texture = texture;
      this.#canvas = mask.canvas;
      this.#aspect = mask.aspect;
      this.#uniforms.uMask.value = texture;
      this.#uniforms.uTexel.value.set(1 / mask.canvas.width, 1 / mask.canvas.height);
      this.#uniforms.uAspect.value = mask.aspect;
      this.#layoutLayers();
      this.#ready = true;
      return true;
    } catch (error) {
      this.#warn(`Title could not be drawn (${error?.message ?? error}); hiding it.`);
      this.#ready = false;
      return false;
    }
  }

  #releaseTexture() {
    this.#texture?.dispose();
    this.#texture = null;
    if (this.#canvas) { this.#canvas.width = 0; this.#canvas.height = 0; }
    this.#canvas = null;
  }

  dispose() {
    this.#disposed = true;
    this.#buildToken += 1;
    this.object3D.removeFromParent();
    this.object3D.dispose(); // InstancedMesh: releases its instance buffers
    this.#geometry.dispose();
    this.#material.dispose();
    this.#releaseTexture();
  }
}
