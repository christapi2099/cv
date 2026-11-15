// Minimal, honest stand-in for three.js r170, served in place of the CDN module
// by tests/smoke.py (there is no network in CI). It implements ONLY the
// classes and methods the library uses, with r170's names and signatures and
// real math where the library depends on results (geometry data, matrices,
// quaternions). It does not draw anything. It tracks:
//   - WebGL "contexts" (renderers created / disposed / forceContextLoss),
//   - live geometries, materials and textures (created minus disposed),
//   - per render call: which scene and how many draw calls it would issue,
//   - validation: every ShaderMaterial uniform must be { value }.
// window.__threeStub exposes the stats; set failNextRender to inject an error.

const stats = {
  renderersCreated: 0,
  renderersDisposed: 0,
  contextLossCalls: 0,
  liveContexts: 0,
  live: { geometry: 0, material: 0, texture: 0 },
  liveByType: {},
  renders: 0,
  compiles: 0,
  calls: [], // { t, label, draws }
  failNextRender: false,
  errors: [],
};
globalThis.__threeStub = stats;

const track = (kind, type, delta) => {
  stats.live[kind] += delta;
  stats.liveByType[type] = (stats.liveByType[type] ?? 0) + delta;
};

export const REVISION = '170-stub';
export const AdditiveBlending = 2;
export const NormalBlending = 1;
export const DynamicDrawUsage = 35048;
export const StaticDrawUsage = 35044;
export const SRGBColorSpace = 'srgb';
export const NoColorSpace = '';
export const FrontSide = 0;
export const DoubleSide = 2;

// ── Math ─────────────────────────────────────────────────────────────────────
export class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; this.isVector2 = true; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; this.isVector3 = true; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  lerpVectors(a, b, t) { return this.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  applyQuaternion(q) {
    // v' = q v q*, as in three.js
    const { x: vx, y: vy, z: vz } = this; const { x: qx, y: qy, z: qz, w: qw } = q;
    const tx = 2 * (qy * vz - qz * vy); const ty = 2 * (qz * vx - qx * vz); const tz = 2 * (qx * vy - qy * vx);
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
  applyMatrix4(m) {
    const { x, y, z } = this; const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
    this.x = x; this.y = y; this.z = z; this.order = order; this.isEuler = true; this._onChange = () => {};
  }
  set(x, y, z, order = this.order) { this.x = x; this.y = y; this.z = z; this.order = order; this._onChange(); return this; }
}

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; this.isQuaternion = true; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { return this.set(q.x, q.y, q.z, q.w); }
  identity() { return this.set(0, 0, 0, 1); }
  setFromEuler(e) {
    if (e.order !== 'XYZ') throw new Error('stub: only XYZ order');
    const c1 = Math.cos(e.x / 2); const c2 = Math.cos(e.y / 2); const c3 = Math.cos(e.z / 2);
    const s1 = Math.sin(e.x / 2); const s2 = Math.sin(e.y / 2); const s3 = Math.sin(e.z / 2);
    return this.set(s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3);
  }
  slerp(qb, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(qb);
    const { x, y, z, w } = this;
    let cos = w * qb.w + x * qb.x + y * qb.y + z * qb.z;
    let bx = qb.x; let by = qb.y; let bz = qb.z; let bw = qb.w;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (cos >= 1) return this;
    const sin = Math.sqrt(1 - cos * cos);
    if (sin < 1e-6) return this.set(x + (bx - x) * t, y + (by - y) * t, z + (bz - z) * t, w + (bw - w) * t);
    const angle = Math.atan2(sin, cos);
    const ra = Math.sin((1 - t) * angle) / sin; const rb = Math.sin(t * angle) / sin;
    return this.set(x * ra + bx * rb, y * ra + by * rb, z * ra + bz * rb, w * ra + bw * rb);
  }
}

export class Matrix4 {
  constructor() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; this.isMatrix4 = true; }
  identity() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; return this; }
  makeTranslation(x, y, z) {
    if (x.isVector3) ({ x, y, z } = x);
    this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; return this;
  }
  makeScale(x, y, z) { this.elements = [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; return this; }
  setPosition(x, y, z) {
    if (x.isVector3) ({ x, y, z } = x);
    this.elements[12] = x; this.elements[13] = y; this.elements[14] = z; return this;
  }
  copy(m) { this.elements = m.elements.slice(); return this; }
}

export class Color {
  constructor(r, g, b) { this.r = 1; this.g = 1; this.b = 1; this.isColor = true; if (r !== undefined) this.set(r, g, b); }
  set(r, g, b) {
    if (g !== undefined) { this.r = r; this.g = g; this.b = b; return this; }
    if (r?.isColor) return this.copy(r);
    if (typeof r === 'number') return this.setHex(r);
    if (typeof r === 'string') {
      const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(r);
      if (!m) throw new Error(`stub Color: unsupported "${r}"`);
      let hex = m[1];
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      return this.setHex(parseInt(hex, 16));
    }
    throw new Error('stub Color.set: bad argument');
  }
  setHex(hex) {
    // three converts sRGB hex to the linear working space.
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    this.r = lin(((hex >> 16) & 255) / 255); this.g = lin(((hex >> 8) & 255) / 255); this.b = lin((hex & 255) / 255);
    return this;
  }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
  lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
}

// ── Event dispatcher / scene graph ──────────────────────────────────────────
class EventDispatcher {
  addEventListener(type, fn) { (this._l ??= {})[type] ??= []; this._l[type].push(fn); }
  removeEventListener(type, fn) { const a = this._l?.[type]; if (a) this._l[type] = a.filter((f) => f !== fn); }
  dispatchEvent(event) { for (const fn of this._l?.[event.type] ?? []) fn.call(this, { ...event, target: this }); }
}

export class Object3D extends EventDispatcher {
  constructor() {
    super();
    this.isObject3D = true;
    this.type = 'Object3D';
    this.parent = null;
    this.children = [];
    this.position = new Vector3();
    this.rotation = new Euler();
    this.quaternion = new Quaternion();
    // As in three.js, setting rotation updates quaternion (stub: one direction only;
    // the library never reads rotation back after setting quaternion).
    this.rotation._onChange = () => this.quaternion.setFromEuler(this.rotation);
    this.scale = new Vector3(1, 1, 1);
    this.visible = true;
    this.renderOrder = 0;
    this.frustumCulled = true;
  }
  add(...objects) {
    for (const o of objects) {
      if (!o?.isObject3D) throw new Error('stub Object3D.add: not an Object3D');
      o.removeFromParent(); o.parent = this; this.children.push(o);
    }
    return this;
  }
  remove(...objects) {
    for (const o of objects) { const i = this.children.indexOf(o); if (i >= 0) { this.children.splice(i, 1); o.parent = null; } }
    return this;
  }
  removeFromParent() { this.parent?.remove(this); return this; }
  clear() { return this.remove(...this.children); }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
  traverseVisible(fn) { if (!this.visible) return; fn(this); for (const c of this.children) c.traverseVisible(fn); }
}
export class Group extends Object3D { constructor() { super(); this.isGroup = true; this.type = 'Group'; } }
export class Scene extends Object3D { constructor() { super(); this.isScene = true; this.type = 'Scene'; } }

export class Mesh extends Object3D {
  constructor(geometry = new BufferGeometry(), material = new MeshBasicMaterial()) {
    super(); this.isMesh = true; this.type = 'Mesh'; this.geometry = geometry; this.material = material;
  }
}
export class Points extends Object3D {
  constructor(geometry, material) { super(); this.isPoints = true; this.type = 'Points'; this.geometry = geometry; this.material = material; }
}
export class InstancedMesh extends Mesh {
  constructor(geometry, material, count) {
    super(geometry, material);
    this.isInstancedMesh = true; this.type = 'InstancedMesh';
    this.instanceMatrix = new BufferAttribute(new Float32Array(count * 16), 16);
    this.count = count;
    for (let i = 0; i < count; i++) this.setMatrixAt(i, new Matrix4());
  }
  setMatrixAt(index, matrix) {
    if (index < 0 || index * 16 >= this.instanceMatrix.array.length) throw new RangeError('stub setMatrixAt: index out of range');
    this.instanceMatrix.array.set(matrix.elements, index * 16);
  }
  dispose() { this.dispatchEvent({ type: 'dispose' }); return this; }
}

// ── Cameras / lights ────────────────────────────────────────────────────────
export class Camera extends Object3D { constructor() { super(); this.isCamera = true; this.projectionMatrix = new Matrix4(); } }
export class OrthographicCamera extends Camera {
  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
    super(); this.isOrthographicCamera = true; Object.assign(this, { left, right, top, bottom, near, far });
  }
  updateProjectionMatrix() {}
}
export class PerspectiveCamera extends Camera {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super(); this.isPerspectiveCamera = true; Object.assign(this, { fov, aspect, near, far }); this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    const top = this.near * Math.tan((Math.PI / 180) * 0.5 * this.fov);
    const height = 2 * top; const width = this.aspect * height;
    const n = this.near; const f = this.far;
    this.projectionMatrix.elements = [2 * n / width, 0, 0, 0, 0, 2 * n / height, 0, 0, 0, 0, -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0];
  }
}
export class Light extends Object3D {
  constructor(color, intensity = 1) { super(); this.isLight = true; this.color = new Color(color); this.intensity = intensity; }
  dispose() {}
}
export class HemisphereLight extends Light {
  constructor(skyColor, groundColor, intensity) { super(skyColor, intensity); this.isHemisphereLight = true; this.groundColor = new Color(groundColor); }
}
export class PointLight extends Light {
  constructor(color, intensity, distance = 0, decay = 2) { super(color, intensity); this.isPointLight = true; this.distance = distance; this.decay = decay; }
}

// ── Geometry ────────────────────────────────────────────────────────────────
export class BufferAttribute {
  constructor(array, itemSize, normalized = false) {
    if (!ArrayBuffer.isView(array)) throw new TypeError('stub BufferAttribute: array must be a TypedArray');
    this.isBufferAttribute = true; this.array = array; this.itemSize = itemSize; this.normalized = normalized;
    this.usage = StaticDrawUsage; this.version = 0;
  }
  get count() { return this.array.length / this.itemSize; }
  set needsUpdate(v) { if (v === true) this.version++; }
  setUsage(usage) { this.usage = usage; return this; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setX(i, v) { this.array[i * this.itemSize] = v; return this; }
  setY(i, v) { this.array[i * this.itemSize + 1] = v; return this; }
  setZ(i, v) { this.array[i * this.itemSize + 2] = v; return this; }
}
export class Float32BufferAttribute extends BufferAttribute { constructor(array, itemSize) { super(new Float32Array(array), itemSize); } }

export class BufferGeometry extends EventDispatcher {
  constructor() {
    super(); this.isBufferGeometry = true; this.type = 'BufferGeometry';
    this.attributes = {}; this.index = null; this.drawRange = { start: 0, count: Infinity };
    this._disposed = false; track('geometry', this.constructor.name, 1);
  }
  setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
  getAttribute(name) { return this.attributes[name]; }
  setIndex(index) {
    this.index = Array.isArray(index) ? new BufferAttribute(new Uint32Array(index), 1) : index; return this;
  }
  setDrawRange(start, count) { this.drawRange.start = start; this.drawRange.count = count; }
  applyMatrix4(m) {
    const p = this.attributes.position; const n = this.attributes.normal; const v = new Vector3();
    if (p) for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m); p.setX(i, v.x).setY(i, v.y).setZ(i, v.z); }
    if (n) {
      const e = m.elements;
      for (let i = 0; i < n.count; i++) {
        const x = n.getX(i); const y = n.getY(i); const z = n.getZ(i);
        v.set(e[0] * x + e[4] * y + e[8] * z, e[1] * x + e[5] * y + e[9] * z, e[2] * x + e[6] * y + e[10] * z).normalize();
        n.setX(i, v.x).setY(i, v.y).setZ(i, v.z);
      }
    }
    return this;
  }
  computeVertexNormals() {
    const p = this.attributes.position; const idx = this.index?.array;
    if (!p || !idx) return;
    const normals = new Float32Array(p.count * 3);
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
      const ab = new Vector3(p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a));
      const ac = new Vector3(p.getX(c) - p.getX(a), p.getY(c) - p.getY(a), p.getZ(c) - p.getZ(a));
      const n = new Vector3().crossVectors(ab, ac);
      for (const k of [a, b, c]) { normals[k * 3] += n.x; normals[k * 3 + 1] += n.y; normals[k * 3 + 2] += n.z; }
    }
    for (let k = 0; k < p.count; k++) {
      const l = Math.hypot(normals[k * 3], normals[k * 3 + 1], normals[k * 3 + 2]) || 1;
      normals[k * 3] /= l; normals[k * 3 + 1] /= l; normals[k * 3 + 2] /= l;
    }
    this.setAttribute('normal', new BufferAttribute(normals, 3));
  }
  dispose() {
    if (this._disposed) return;
    this._disposed = true; track('geometry', this.constructor.name, -1); this.dispatchEvent({ type: 'dispose' });
  }
}

/** Fill a geometry from plain arrays. */
function fill(geometry, positions, normals, uvs, indices) {
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  const count = positions.length / 3;
  geometry.setIndex(new BufferAttribute(count > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), 1));
}

export class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1) {
    super(); this.type = 'PlaneGeometry'; this.parameters = { width, height };
    const w = width / 2; const h = height / 2;
    fill(this, [-w, h, 0, w, h, 0, -w, -h, 0, w, -h, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 1, 1, 0, 0, 1, 0], [0, 2, 1, 2, 3, 1]);
  }
}

export class BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1) {
    super(); this.type = 'BoxGeometry'; this.parameters = { width, height, depth };
    const P = []; const N = []; const U = []; const I = [];
    const face = (u, v, w, udir, vdir, size) => {
      // Same layout as three.js buildPlane with 1×1 segments: 4 vertices, 2 triangles.
      const [sw, sh, sd] = size; const base = P.length / 3;
      for (let iy = 0; iy < 2; iy++) {
        for (let ix = 0; ix < 2; ix++) {
          const vec = [0, 0, 0];
          vec[u] = (ix - 0.5) * sw * udir; vec[v] = (0.5 - iy) * sh * vdir; vec[w] = sd / 2;
          P.push(...vec);
          const n = [0, 0, 0]; n[w] = sd > 0 ? 1 : -1; N.push(...n);
          U.push(ix, 1 - iy);
        }
      }
      I.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    };
    face(2, 1, 0, -1, -1, [depth, height, width]); // px
    face(2, 1, 0, 1, -1, [depth, height, -width]); // nx
    face(0, 2, 1, 1, 1, [width, depth, height]); // py
    face(0, 2, 1, 1, -1, [width, depth, -height]); // ny
    face(0, 1, 2, 1, -1, [width, height, depth]); // pz
    face(0, 1, 2, -1, -1, [width, height, -depth]); // nz
    fill(this, P, N, U, I);
  }
}

/** Generic surface of revolution / sweep used by the capsule and tube stubs. */
function gridIndices(rows, cols) {
  const I = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c; const b = a + cols + 1;
      I.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return I;
}

export class CapsuleGeometry extends BufferGeometry {
  constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
    super(); this.type = 'CapsuleGeometry'; this.parameters = { radius, length, capSegments, radialSegments };
    const rows = capSegments * 2 + 1; const P = []; const N = []; const U = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows; const phi = Math.PI * t; // pole to pole
      const y = -Math.cos(phi) * radius + (t < 0.5 ? -length / 2 : length / 2);
      const ring = Math.sin(phi) * radius;
      for (let c = 0; c <= radialSegments; c++) {
        const th = (c / radialSegments) * Math.PI * 2;
        P.push(Math.cos(th) * ring, y, Math.sin(th) * ring);
        const n = new Vector3(Math.cos(th) * Math.sin(phi), -Math.cos(phi), Math.sin(th) * Math.sin(phi)).normalize();
        N.push(n.x, n.y, n.z); U.push(c / radialSegments, t);
      }
    }
    fill(this, P, N, U, gridIndices(rows, radialSegments));
  }
}

export class CatmullRomCurve3 {
  constructor(points = [], closed = false, curveType = 'centripetal', tension = 0.5) {
    if (points.length < 2) throw new Error('stub CatmullRomCurve3: need 2+ points');
    Object.assign(this, { points, closed, curveType, tension }); this.isCatmullRomCurve3 = true;
  }
  /** Piecewise-linear approximation (the stub does not need the exact spline). */
  getPointAt(u, target = new Vector3()) {
    const n = this.points.length - 1; const f = Math.min(n - 1e-9, Math.max(0, u * n)); const i = Math.floor(f);
    return target.lerpVectors(this.points[i], this.points[i + 1], f - i);
  }
}

export class TubeGeometry extends BufferGeometry {
  constructor(path, tubularSegments = 64, radius = 1, radialSegments = 8, closed = false) {
    super(); this.type = 'TubeGeometry'; this.parameters = { path, tubularSegments, radius, radialSegments, closed };
    if (!path?.getPointAt) throw new Error('stub TubeGeometry: path must be a Curve');
    const P = []; const N = []; const U = [];
    for (let i = 0; i <= tubularSegments; i++) {
      const c = path.getPointAt(i / tubularSegments);
      for (let j = 0; j <= radialSegments; j++) {
        const th = (j / radialSegments) * Math.PI * 2;
        P.push(c.x + Math.cos(th) * radius, c.y + Math.sin(th) * radius, c.z);
        N.push(Math.cos(th), Math.sin(th), 0); U.push(i / tubularSegments, j / radialSegments);
      }
    }
    fill(this, P, N, U, gridIndices(tubularSegments, radialSegments));
  }
}

// ── Materials / textures ────────────────────────────────────────────────────
export class Material extends EventDispatcher {
  constructor() { super(); this.isMaterial = true; this._disposed = false; track('material', this.constructor.name, 1); }
  setValues(values = {}) {
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) throw new Error(`stub Material: parameter "${k}" is undefined`);
      if (this[k]?.isColor && (typeof v === 'string' || typeof v === 'number')) this[k].set(v); else this[k] = v;
    }
  }
  dispose() {
    if (this._disposed) return;
    this._disposed = true; track('material', this.constructor.name, -1); this.dispatchEvent({ type: 'dispose' });
  }
}
export class MeshBasicMaterial extends Material { constructor(p) { super(); this.isMeshBasicMaterial = true; this.color = new Color(0xffffff); this.setValues(p); } }
export class MeshStandardMaterial extends Material {
  constructor(p) {
    super(); this.isMeshStandardMaterial = true; this.type = 'MeshStandardMaterial';
    this.color = new Color(0xffffff); this.roughness = 1; this.metalness = 0; this.emissive = new Color(0x000000); this.emissiveIntensity = 1;
    this.setValues(p);
  }
}
export class ShaderMaterial extends Material {
  constructor(p = {}) {
    super(); this.isShaderMaterial = true; this.type = 'ShaderMaterial';
    this.uniforms = {}; this.vertexShader = ''; this.fragmentShader = ''; this.transparent = false; this.depthTest = true; this.depthWrite = true;
    this.setValues(p);
  }
}

export class Texture extends EventDispatcher {
  constructor(image = null) {
    super(); this.isTexture = true; this.image = image; this.colorSpace = NoColorSpace; this.version = 0;
    this.generateMipmaps = true; this._disposed = false; track('texture', this.constructor.name, 1);
  }
  set needsUpdate(v) { if (v) this.version++; }
  dispose() {
    if (this._disposed) return;
    this._disposed = true; track('texture', this.constructor.name, -1); this.dispatchEvent({ type: 'dispose' });
  }
}
export class CanvasTexture extends Texture {
  constructor(canvas) {
    super(canvas);
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('stub CanvasTexture: needs a canvas');
    this.isCanvasTexture = true; this.needsUpdate = true;
  }
}

// ── Renderer ────────────────────────────────────────────────────────────────
function validateMaterial(material, where) {
  if (!material?.isMaterial) throw new Error(`stub: ${where} has no material`);
  if (material._disposed) throw new Error(`stub: ${where} renders a disposed material`);
  if (material.isShaderMaterial) {
    if (!material.vertexShader || !material.fragmentShader) throw new Error(`stub: ${where} ShaderMaterial without shaders`);
    for (const [name, u] of Object.entries(material.uniforms)) {
      if (!u || !('value' in u)) throw new Error(`stub: ${where} uniform ${name} is not { value }`);
      if (u.value?.isTexture && u.value._disposed) throw new Error(`stub: ${where} uniform ${name} uses a disposed texture`);
    }
  }
}

function countDraws(scene, validate) {
  let draws = 0;
  scene.traverseVisible((o) => {
    if (!(o.isMesh || o.isPoints)) return;
    const where = `${o.type}`;
    if (o.geometry?._disposed) throw new Error(`stub: ${where} renders a disposed geometry`);
    validate(o.material, where);
    const g = o.geometry;
    const total = g.index ? g.index.count : g.attributes.position?.count ?? 0;
    const count = Math.min(total - g.drawRange.start, g.drawRange.count);
    if (count > 0 && (!o.isInstancedMesh || o.count > 0)) draws++;
  });
  return draws;
}

export class WebGLRenderer {
  constructor(parameters = {}) {
    this.parameters = parameters;
    this.domElement = document.createElement('canvas');
    this.autoClear = true;
    this.outputColorSpace = SRGBColorSpace;
    this.debug = { checkShaderErrors: true, onShaderError: null };
    this._pixelRatio = 1; this._width = 1; this._height = 1; this._disposed = false; this._lost = false;
    stats.renderersCreated++; stats.liveContexts++;
  }
  setPixelRatio(value) { this._pixelRatio = value; }
  getPixelRatio() { return this._pixelRatio; }
  setSize(width, height, updateStyle = true) {
    this._width = width; this._height = height;
    this.domElement.width = Math.floor(width * this._pixelRatio);
    this.domElement.height = Math.floor(height * this._pixelRatio);
    if (updateStyle) { this.domElement.style.width = `${width}px`; this.domElement.style.height = `${height}px`; }
  }
  getDrawingBufferSize(target) { return target.set(Math.floor(this._width * this._pixelRatio), Math.floor(this._height * this._pixelRatio)); }
  compileAsync(scene, camera) {
    stats.compiles++;
    return new Promise((resolve, reject) => {
      queueMicrotask(() => {
        try {
          if (!camera?.isCamera) throw new Error('stub compileAsync: camera required');
          countDraws(scene, validateMaterial);
          resolve(scene);
        } catch (error) { reject(error); }
      });
    });
  }
  render(scene, camera) {
    if (this._disposed) throw new Error('stub: render after dispose');
    if (!camera?.isCamera) throw new Error('stub render: camera required');
    if (stats.failNextRender) { stats.failNextRender = false; throw new Error('stub: injected render failure'); }
    const draws = countDraws(scene, validateMaterial);
    stats.renders++;
    stats.calls.push({ t: performance.now(), label: camera.isPerspectiveCamera ? 'actors' : 'background', draws });
    if (stats.calls.length > 2000) stats.calls.splice(0, 1000);
  }
  clear() {}
  clearDepth() {}
  dispose() { if (!this._disposed) { this._disposed = true; stats.renderersDisposed++; } }
  forceContextLoss() {
    stats.contextLossCalls++;
    if (!this._lost) { this._lost = true; stats.liveContexts--; }
    setTimeout(() => this.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true })), 0);
  }
}
