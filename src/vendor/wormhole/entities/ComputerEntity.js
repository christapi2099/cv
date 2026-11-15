import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { SpringFollower, Tumble } from '../physics/Tumble.js';
import { screenFragmentShader, screenVertexShader } from '../shaders/screen.glsl.js';
import { drawScreenTexture } from './canvasArt.js';

/**
 * Merge indexed geometries (position, normal, uv) into one, after applying a
 * matrix to each. Inputs are disposed. Runs only when the rig is built.
 * @param {Array<[BufferGeometry, Matrix4]>} parts
 */
export function mergeIndexed(parts) {
  let vertices = 0;
  let indices = 0;
  for (const [geometry, matrix] of parts) {
    geometry.applyMatrix4(matrix);
    vertices += geometry.getAttribute('position').count;
    indices += geometry.index.count;
  }
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let v = 0;
  let i = 0;
  for (const [geometry] of parts) {
    const count = geometry.getAttribute('position').count;
    position.set(geometry.getAttribute('position').array, v * 3);
    normal.set(geometry.getAttribute('normal').array, v * 3);
    uv.set(geometry.getAttribute('uv').array, v * 2);
    const source = geometry.index.array;
    for (let k = 0; k < source.length; k++) index[i + k] = source[k] + v;
    v += count;
    i += source.length;
    geometry.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(position, 3));
  merged.setAttribute('normal', new BufferAttribute(normal, 3));
  merged.setAttribute('uv', new BufferAttribute(uv, 2));
  merged.setIndex(new BufferAttribute(index, 1));
  return merged;
}

/** A box whose back face (z < 0) is shrunk and dropped: a CRT's tapered housing. */
function taperedBox(width, height, depth, taper, drop) {
  const geometry = new BoxGeometry(width, height, depth);
  const position = geometry.getAttribute('position');
  for (let k = 0; k < position.count; k++) {
    if (position.getZ(k) < 0) {
      position.setX(k, position.getX(k) * taper);
      position.setY(k, position.getY(k) * taper - drop);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals(); // box faces have their own vertices: flat normals
  return geometry;
}

const at = (x, y, z) => new Matrix4().makeTranslation(x, y, z);

// Rest offsets of the trailing parts, in monitor space (monitor width = 1).
const KEYBOARD_OFFSET = Object.freeze({ x: 0, y: -0.62, z: 0.62 });
const MOUSE_OFFSET = Object.freeze({ x: 0.72, y: -0.66, z: 0.6 });

/**
 * The purple retro desktop computer, built only from primitives:
 * CRT monitor (bezel + tapered housing + base/stand, merged into one mesh),
 * an emissive screen, a keyboard (wedge + ~60 instanced keys), a capsule
 * mouse and two tube cables. Draw calls: case, screen, cables, keyboard,
 * keys, mouse (6).
 *
 * The monitor is a rigid body driven by Tumble (spring-damper offset +
 * angular integrator); keyboard and mouse trail it with spring followers.
 */
export class ComputerEntity {
  #disposables = [];
  #tumble = new Tumble();
  #keyboardFollow = new SpringFollower({ stiffness: 170, damping: 24 });
  #mouseFollow = new SpringFollower({ stiffness: 120, damping: 19 });
  #caseMaterial;
  #screenUniforms;
  #monitor = new Group();
  #keyboard = new Group();
  #mouse = new Group();
  #tmp = new Vector3();
  #shown = false;
  #canvas = null;

  /**
   * @param {{ shared: object, color: string, palette: object, createCanvas: (w: number, h: number) => HTMLCanvasElement }} options
   */
  constructor({ shared, color, palette, createCanvas }) {
    this.object3D = new Group();
    this.object3D.visible = false;
    this.object3D.add(this.#monitor, this.#keyboard, this.#mouse);

    const own = (thing) => { this.#disposables.push(thing); return thing; };

    this.#caseMaterial = own(new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.55,
      metalness: 0.1,
      emissive: new Color(color).multiplyScalar(0.18), // keeps it purple in a dark storm
    }));
    const keyMaterial = own(new MeshStandardMaterial({ color: new Color('#cbb8ff'), roughness: 0.6, metalness: 0.05 }));
    const cableMaterial = own(new MeshStandardMaterial({ color: new Color('#251d31'), roughness: 0.8, metalness: 0 }));

    // ── Monitor case: bezel frame + tapered housing + stand + base, one mesh.
    const caseGeometry = own(mergeIndexed([
      [new BoxGeometry(1.0, 0.09, 0.12), at(0, 0.365, 0)], // bezel top
      [new BoxGeometry(1.0, 0.13, 0.12), at(0, -0.345, 0)], // bezel bottom
      [new BoxGeometry(0.11, 0.6, 0.12), at(-0.445, 0.02, 0)], // bezel left
      [new BoxGeometry(0.11, 0.6, 0.12), at(0.445, 0.02, 0)], // bezel right
      [taperedBox(0.92, 0.76, 0.62, 0.62, 0.06), at(0, 0, -0.37)], // CRT housing
      [new BoxGeometry(0.34, 0.1, 0.34), at(0, -0.46, -0.25)], // stand
      [new BoxGeometry(0.8, 0.06, 0.7), at(0, -0.53, -0.25)], // base
    ]));
    this.#monitor.add(new Mesh(caseGeometry, this.#caseMaterial));

    // ── Screen: inset plane, CanvasTexture drawn once, cursor blink by uniform.
    const art = drawScreenTexture(createCanvas);
    const texture = own(new CanvasTexture(art.canvas));
    texture.colorSpace = SRGBColorSpace;
    this.#screenUniforms = {
      uMap: { value: texture },
      uCursor: { value: art.cursor },
      uTime: shared.uTime,
      uFlash: shared.uFlash,
      uPhosphor: { value: new Color('#5dff8a') },
      uGlint: { value: new Color(palette.lightning) },
    };
    const screenMaterial = own(new ShaderMaterial({
      vertexShader: screenVertexShader,
      fragmentShader: screenFragmentShader,
      uniforms: this.#screenUniforms,
    }));
    const screen = new Mesh(own(new PlaneGeometry(0.78, 0.6)), screenMaterial);
    screen.position.set(0, 0.02, 0.03);
    this.#monitor.add(screen);
    this.#canvas = art.canvas;

    // ── Keyboard: a slightly tilted wedge with instanced keys on top.
    const keyboardBase = new Mesh(own(taperedBox(1.0, 0.05, 0.36, 1, -0.015)), this.#caseMaterial);
    this.#keyboard.add(keyboardBase);
    const keys = this.#buildKeys(own(new BoxGeometry(0.062, 0.026, 0.062)), keyMaterial);
    own(keys);
    this.#keyboard.add(keys);

    // ── Mouse: a flattened capsule lying along z.
    const mouse = new Mesh(own(new CapsuleGeometry(0.05, 0.06, 4, 10)), this.#caseMaterial);
    mouse.rotation.set(Math.PI / 2, 0, 0);
    mouse.scale.set(1, 1, 0.55);
    this.#mouse.add(mouse);

    // ── Cables: two tubes from the back of the monitor to the rest positions
    // of keyboard and mouse, merged into one mesh. Built once.
    const cable = (points) => new TubeGeometry(new CatmullRomCurve3(points), 28, 0.013, 6, false);
    const kb = KEYBOARD_OFFSET; const ms = MOUSE_OFFSET;
    const cables = own(mergeIndexed([
      [cable([
        new Vector3(-0.1, -0.45, -0.55), new Vector3(-0.25, -0.8, -0.3),
        new Vector3(-0.2, -0.78, kb.z - 0.35), new Vector3(kb.x - 0.1, kb.y - 0.02, kb.z - 0.18),
      ]), new Matrix4()],
      [cable([
        new Vector3(0.12, -0.45, -0.55), new Vector3(0.45, -0.85, -0.2),
        new Vector3(ms.x + 0.05, ms.y - 0.08, ms.z - 0.3), new Vector3(ms.x, ms.y, ms.z - 0.08),
      ]), new Matrix4()],
    ]));
    this.#monitor.add(new Mesh(cables, cableMaterial));

    // Initial pose and idle spin.
    const q = new Quaternion().setFromEuler(new Euler(0.35, -0.6, 0.18));
    this.#tumble.setOrientation(q.x, q.y, q.z, q.w);
    this.#tumble.setBaseSpin(0.35, 0.75, 0.2);
  }

  #buildKeys(geometry, material) {
    const rows = [12, 13, 13, 12, 11]; // function row + 4 typing rows
    const total = rows.reduce((a, b) => a + b, 0) + 1; // + space bar
    const keys = new InstancedMesh(geometry, material, total);
    const matrix = new Matrix4();
    const pitch = 0.072;
    let n = 0;
    rows.forEach((count, row) => {
      const z = -0.13 + row * 0.058;
      const offset = (row % 2) * 0.018;
      for (let k = 0; k < count; k++) {
        matrix.makeTranslation((k - (count - 1) / 2) * pitch + offset, 0.038 + row * 0.003, z);
        keys.setMatrixAt(n++, matrix);
      }
    });
    matrix.makeScale(5.2, 1, 1).setPosition(0, 0.038 + 5 * 0.003, -0.13 + 5 * 0.058);
    keys.setMatrixAt(n, matrix);
    keys.instanceMatrix.needsUpdate = true;
    keys.frustumCulled = false;
    return keys;
  }

  get visible() {
    return this.object3D.visible;
  }

  setColor(hex) {
    this.#caseMaterial.color.set(hex);
    this.#caseMaterial.emissive.set(hex).multiplyScalar(0.18);
  }

  /** A bolt hit: shove along the bolt direction (screen space) and spin away. */
  strike(dirX, dirY) {
    this.#tumble.impulse(dirX, dirY, -0.35, 2.6, 6.5);
  }

  /**
   * World position of the monitor's centre (shared vector; read, don't keep).
   */
  get worldPosition() {
    return this.#monitor.position;
  }

  /**
   * @param {number} dt
   * @param {{ active: boolean, sx: number, sy: number, dist: number, scale: number }} c  director frame
   * @param {number} tanHalfShort  tan(half field of view across the short side)
   */
  update(dt, c, tanHalfShort) {
    if (!c.active || c.scale <= 0) {
      this.object3D.visible = false;
      this.#shown = false;
      return;
    }
    this.object3D.visible = true;
    const tumble = this.#tumble;
    tumble.step(dt);
    const d = c.dist;
    const span = 2 * d * tanHalfShort; // world units per short-side unit at this depth
    const k = Math.max(1, d / 4.2); // keep a shove visible at any distance
    const o = tumble.offset;
    const monitor = this.#monitor;
    monitor.position.set(c.sx * span + o.x * k, c.sy * span + o.y * k, -d + o.z * k);
    const q = tumble.quaternion;
    monitor.quaternion.set(q.x, q.y, q.z, q.w);
    monitor.scale.setScalar(c.scale);

    this.#follow(this.#keyboard, this.#keyboardFollow, KEYBOARD_OFFSET, c.scale, dt, 18);
    this.#follow(this.#mouse, this.#mouseFollow, MOUSE_OFFSET, c.scale, dt, 14);
    this.#shown = true;
  }

  #follow(part, follower, offset, scale, dt, turnRate) {
    const target = this.#tmp.set(offset.x, offset.y, offset.z)
      .multiplyScalar(scale)
      .applyQuaternion(this.#monitor.quaternion)
      .add(this.#monitor.position);
    if (!this.#shown) {
      follower.snap(target.x, target.y, target.z);
      part.quaternion.copy(this.#monitor.quaternion);
    } else {
      follower.step(dt, target.x, target.y, target.z);
      part.quaternion.slerp(this.#monitor.quaternion, 1 - Math.exp(-turnRate * dt));
    }
    const v = follower.value;
    part.position.set(v.x, v.y, v.z);
    part.scale.setScalar(scale);
  }

  dispose() {
    this.object3D.removeFromParent();
    for (const thing of this.#disposables) thing.dispose();
    this.#disposables = [];
    if (this.#canvas) { this.#canvas.width = 0; this.#canvas.height = 0; } // free the bitmap now
    this.#canvas = null;
  }
}
