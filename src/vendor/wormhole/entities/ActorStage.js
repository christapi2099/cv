import { Color, HemisphereLight, PerspectiveCamera, PointLight, Scene } from 'three';
import { ComputerEntity } from './ComputerEntity.js';
import { LogoEntity } from './LogoEntity.js';

/** Field of view across the short side of the screen (degrees). */
export const SHORT_SIDE_FOV = 50;
const TAN_HALF_SHORT = Math.tan((SHORT_SIDE_FOV * Math.PI) / 360);

/**
 * The intro's 3D actors (computer + title) in their own scene, drawn after
 * the background with a PerspectiveCamera. The camera sits at the origin
 * looking down -z; its field of view is fixed across the SHORT side of the
 * screen, matching the tunnel's short-side normalisation, so an object
 * `d` units away at a short-side offset s is at x = s · 2d · tan(fov/2).
 *
 * Built when an intro starts, disposed when it ends (rebuilt for replay).
 * Entities never talk to each other: the App routes director cues here.
 */
export class ActorStage {
  scene = new Scene();
  camera = new PerspectiveCamera(SHORT_SIDE_FOV, 1, 0.1, 200);
  #shared;
  #palette;
  #tier;
  #fonts;
  #warn;
  #computer = null;
  #logo = null;
  #computerColor;
  #logoText;
  #logoFont;
  #hemi;
  #point;
  #aspect = 1;
  #width = 1;
  #height = 1;
  #lightTarget = { x: 0, y: 0, z: -5 };

  /**
   * @param {{ shared: object, palette: object, tier: object, computer: boolean, logo: boolean,
   *   computerColor: string, logoText: string, logoFont: string,
   *   fonts: { loadFont: (family: string) => Promise<string>, createCanvas: (w: number, h: number) => HTMLCanvasElement },
   *   warn?: (message: string) => void }} options
   */
  constructor({ shared, palette, tier, computer, logo, computerColor, logoText, logoFont, fonts, warn = () => {} }) {
    this.#shared = shared;
    this.#palette = palette;
    this.#tier = tier;
    this.#fonts = fonts;
    this.#warn = warn;
    this.#computerColor = computerColor;
    this.#logoText = logoText;
    this.#logoFont = logoFont;
    // Physically based light units (three r155+): hemisphere ≈ π for unit albedo.
    this.#hemi = new HemisphereLight(new Color(palette.cloudLight), new Color(palette.cloudDark), 3.2);
    this.#point = new PointLight(new Color(palette.lightning), 0, 0, 2);
    this.scene.add(this.#hemi, this.#point);
    this.setComputerEnabled(computer);
    this.setLogoEnabled(logo);
  }

  /** True while anything in the actor scene is drawn. */
  get visible() {
    return Boolean(this.#computer?.visible || this.#logo?.visible);
  }

  get hasComputer() {
    return this.#computer !== null;
  }

  get hasLogo() {
    return this.#logo !== null;
  }

  /** Resolves when the title texture is ready (or immediately without a title). */
  get ready() {
    return this.#logo ? this.#logo.ready : Promise.resolve(true);
  }

  setComputerEnabled(enabled) {
    if (enabled && !this.#computer) {
      this.#computer = new ComputerEntity({
        shared: this.#shared,
        color: this.#computerColor,
        palette: this.#palette,
        createCanvas: this.#fonts.createCanvas,
      });
      this.scene.add(this.#computer.object3D);
    } else if (!enabled && this.#computer) {
      this.#computer.dispose();
      this.#computer = null;
    }
  }

  setLogoEnabled(enabled) {
    if (enabled && !this.#logo) {
      this.#logo = new LogoEntity({
        shared: this.#shared,
        text: this.#logoText,
        fontFamily: this.#logoFont,
        tier: this.#tier,
        portrait: this.#aspect < 1,
        loadFont: this.#fonts.loadFont,
        createCanvas: this.#fonts.createCanvas,
        warn: this.#warn,
      });
      this.scene.add(this.#logo.object3D);
    } else if (!enabled && this.#logo) {
      this.#logo.dispose();
      this.#logo = null;
    }
  }

  setLogoText(text) {
    this.#logoText = text;
    this.#logo?.setText(text);
  }

  setComputerColor(hex) {
    this.#computerColor = hex;
    this.#computer?.setColor(hex);
  }

  setQuality(tier) {
    this.#tier = tier;
    this.#logo?.setQuality(tier);
  }

  /** @param {number} width CSS px  @param {number} height CSS px */
  resize(width, height) {
    this.#width = Math.max(1, width);
    this.#height = Math.max(1, height);
    const aspect = this.#width / this.#height;
    this.#aspect = aspect;
    // Keep the field of view fixed across the short side (vertical fov for three).
    this.camera.fov = aspect >= 1
      ? SHORT_SIDE_FOV
      : (2 * Math.atan(TAN_HALF_SHORT / aspect) * 180) / Math.PI;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.#logo?.setPortrait(aspect < 1);
  }

  /**
   * @param {number} dt
   * @param {object} intro   IntroDirector.frame
   * @param {{ x: number, y: number }} center  vanishing-point offset (short-side units)
   * @param {number} flash   0..1
   */
  update(dt, intro, center, flash) {
    // Shift the projection like the tunnel's vanishing point (off-axis shear),
    // so actors stay "in" the tunnel when it is steered.
    const unit = Math.min(this.#width, this.#height);
    const e = this.camera.projectionMatrix.elements;
    e[8] = -(center.x * 2 * unit) / this.#width;
    e[9] = -(center.y * 2 * unit) / this.#height;

    this.#computer?.update(dt, intro.computer, TAN_HALF_SHORT);
    this.#logo?.update(intro.title, TAN_HALF_SHORT, this.#aspect);

    // The point light sits at the last strike and pulses with the flash.
    const t = this.#lightTarget;
    this.#point.position.set(t.x, t.y + 0.8, t.z + 1.2);
    this.#point.intensity = flash * 40;
  }

  /** Apply a lightning kick to the computer (screen-space bolt direction). */
  strikeComputer(dirX, dirY) {
    if (!this.#computer?.visible) return;
    this.#computer.strike(dirX, dirY);
    const p = this.#computer.worldPosition;
    this.#lightTarget.x = p.x; this.#lightTarget.y = p.y; this.#lightTarget.z = p.z;
  }

  /** Where a bolt behind the title should light from. */
  lightBehindTitle(dist) {
    this.#lightTarget.x = 0; this.#lightTarget.y = 0.6; this.#lightTarget.z = -dist - 2.5;
  }

  /**
   * Screen position of the computer in short-side units (centred, like the
   * tunnel's `screen` space). Returns false when the computer is not shown.
   * @param {{ x: number, y: number }} out
   * @param {{ x: number, y: number }} center
   */
  computerScreenPosition(out, center) {
    if (!this.#computer?.visible) return false;
    const p = this.#computer.worldPosition;
    const depth = Math.max(0.1, -p.z);
    out.x = p.x / (2 * depth * TAN_HALF_SHORT) + center.x;
    out.y = p.y / (2 * depth * TAN_HALF_SHORT) + center.y;
    return true;
  }

  dispose() {
    this.#computer?.dispose();
    this.#logo?.dispose();
    this.#computer = null;
    this.#logo = null;
    this.#hemi.dispose();
    this.#point.dispose();
    this.scene.clear();
  }
}
