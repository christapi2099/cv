/**
 * Tiny rigid-body integrator for the tumbling computer. Pure: plain objects,
 * no DOM, no three.js, no allocations in step().
 *
 * - Position: a spring-damper pulls an `offset` back to 0 (the choreography
 *   anchor), so a lightning shove moves the body smoothly and it drifts back:
 *   no teleporting.
 * - Orientation: a unit quaternion integrated from an angular velocity that
 *   relaxes toward a slow idle spin. A strike adds an angular kick.
 * - Bounded: offset and angular speed are clamped, and large dt is split into
 *   fixed sub-steps (at most `maxSubsteps`), so it cannot blow up.
 */
export class Tumble {
  offset = { x: 0, y: 0, z: 0 };
  velocity = { x: 0, y: 0, z: 0 };
  quaternion = { x: 0, y: 0, z: 0, w: 1 };
  angular = { x: 0, y: 0, z: 0 };
  #base = { x: 0, y: 0, z: 0 };
  #k;
  #c;
  #angularDamping;
  #maxOffset;
  #maxAngular;
  #maxStep;
  #maxSubsteps;

  /**
   * @param {{ stiffness?: number, damping?: number, angularDamping?: number,
   *   maxOffset?: number, maxAngular?: number, maxStep?: number, maxSubsteps?: number }} [options]
   */
  constructor({
    stiffness = 14, damping = 5, angularDamping = 1.4, maxOffset = 1.5, maxAngular = 14,
    maxStep = 1 / 120, maxSubsteps = 8,
  } = {}) {
    this.#k = stiffness;
    this.#c = damping;
    this.#angularDamping = angularDamping;
    this.#maxOffset = maxOffset;
    this.#maxAngular = maxAngular;
    this.#maxStep = maxStep;
    this.#maxSubsteps = maxSubsteps;
  }

  /** Idle spin (rad/s) the angular velocity relaxes toward. */
  setBaseSpin(x, y, z) {
    this.#base.x = x;
    this.#base.y = y;
    this.#base.z = z;
  }

  reset() {
    for (const v of [this.offset, this.velocity, this.angular]) { v.x = 0; v.y = 0; v.z = 0; }
    const q = this.quaternion;
    q.x = 0; q.y = 0; q.z = 0; q.w = 1;
  }

  /** Set the orientation (normalised). */
  setOrientation(x, y, z, w) {
    const q = this.quaternion;
    const n = Math.hypot(x, y, z, w) || 1;
    q.x = x / n; q.y = y / n; q.z = z / n; q.w = w / n;
  }

  /** Current angular speed (rad/s). */
  get angularSpeed() {
    const a = this.angular;
    return Math.hypot(a.x, a.y, a.z);
  }

  /** Current offset length. */
  get offsetLength() {
    const o = this.offset;
    return Math.hypot(o.x, o.y, o.z);
  }

  /**
   * Apply a strike: a linear shove along (dx, dy, dz) and an angular kick
   * about an axis perpendicular to it (so the body spins away from the bolt).
   */
  impulse(dx, dy, dz, linear, angular) {
    const n = Math.hypot(dx, dy, dz);
    if (!(n > 1e-9) || !Number.isFinite(linear) || !Number.isFinite(angular)) return;
    const x = dx / n; const y = dy / n; const z = dz / n;
    this.velocity.x += x * linear;
    this.velocity.y += y * linear;
    this.velocity.z += z * linear;
    // Torque axis = direction × view axis (0, 0, 1); fall back to x when parallel.
    let ax = y; let ay = -x; let az = 0;
    const an = Math.hypot(ax, ay);
    if (an < 1e-6) { ax = 1; ay = 0; } else { ax /= an; ay /= an; }
    this.angular.x += ax * angular;
    this.angular.y += ay * angular;
    this.angular.z += (x >= 0 ? 0.6 : -0.6) * angular; // a little roll reads as "knocked"
    this.#clamp();
  }

  step(dt) {
    if (!(dt > 0)) return;
    const steps = Math.min(this.#maxSubsteps, Math.ceil(dt / this.#maxStep));
    const h = Math.min(dt, this.#maxStep * this.#maxSubsteps) / steps;
    for (let i = 0; i < steps; i++) this.#substep(h);
  }

  #substep(h) {
    const o = this.offset; const v = this.velocity;
    // Semi-implicit Euler spring-damper toward offset = 0.
    v.x += (-this.#k * o.x - this.#c * v.x) * h;
    v.y += (-this.#k * o.y - this.#c * v.y) * h;
    v.z += (-this.#k * o.z - this.#c * v.z) * h;
    o.x += v.x * h; o.y += v.y * h; o.z += v.z * h;

    const a = this.angular; const b = this.#base;
    const relax = 1 - Math.exp(-this.#angularDamping * h);
    a.x += (b.x - a.x) * relax;
    a.y += (b.y - a.y) * relax;
    a.z += (b.z - a.z) * relax;
    this.#clamp();

    // q += 0.5 * (0, ω) ⊗ q * h, then normalise.
    const q = this.quaternion;
    const hx = 0.5 * h * a.x; const hy = 0.5 * h * a.y; const hz = 0.5 * h * a.z;
    const qx = q.x; const qy = q.y; const qz = q.z; const qw = q.w;
    q.x = qx + hx * qw + hy * qz - hz * qy;
    q.y = qy + hy * qw + hz * qx - hx * qz;
    q.z = qz + hz * qw + hx * qy - hy * qx;
    q.w = qw - hx * qx - hy * qy - hz * qz;
    const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    q.x /= n; q.y /= n; q.z /= n; q.w /= n;
  }

  #clamp() {
    const o = this.offset;
    const len = Math.hypot(o.x, o.y, o.z);
    if (len > this.#maxOffset) {
      const s = this.#maxOffset / len;
      o.x *= s; o.y *= s; o.z *= s;
      // Remove the outward velocity component so it does not push against the wall.
      const v = this.velocity;
      const radial = (v.x * o.x + v.y * o.y + v.z * o.z) / this.#maxOffset;
      if (radial > 0) {
        const k = radial / this.#maxOffset;
        v.x -= o.x * k; v.y -= o.y * k; v.z -= o.z * k;
      }
    }
    const a = this.angular;
    const speed = Math.hypot(a.x, a.y, a.z);
    if (speed > this.#maxAngular) {
      const s = this.#maxAngular / speed;
      a.x *= s; a.y *= s; a.z *= s;
    }
  }
}

/**
 * Critically-damped-ish spring follower for a 3D point (the keyboard and
 * mouse trailing the monitor). Pure; no allocations in step().
 */
export class SpringFollower {
  value = { x: 0, y: 0, z: 0 };
  velocity = { x: 0, y: 0, z: 0 };
  #k;
  #c;

  /** @param {{ stiffness?: number, damping?: number }} [options] */
  constructor({ stiffness = 60, damping = 2 * Math.sqrt(60) } = {}) {
    this.#k = stiffness;
    this.#c = damping;
  }

  snap(x, y, z) {
    this.value.x = x; this.value.y = y; this.value.z = z;
    this.velocity.x = 0; this.velocity.y = 0; this.velocity.z = 0;
  }

  step(dt, tx, ty, tz) {
    if (!(dt > 0)) return;
    const steps = Math.min(8, Math.ceil(dt / (1 / 120)));
    const h = Math.min(dt, 8 / 120) / steps;
    const p = this.value; const v = this.velocity;
    for (let i = 0; i < steps; i++) {
      v.x += (this.#k * (tx - p.x) - this.#c * v.x) * h;
      v.y += (this.#k * (ty - p.y) - this.#c * v.y) * h;
      v.z += (this.#k * (tz - p.z) - this.#c * v.z) * h;
      p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;
    }
  }
}
