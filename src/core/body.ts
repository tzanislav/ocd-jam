import { type Vec2, add, clamp, cross, rotate, scale, sub, vec } from './vec.ts';

/**
 * Tiny 2D rigid body: position of the centre of mass, rotation, and their velocities.
 * Integrated with semi-implicit Euler at a fixed timestep.
 */
export class RigidBody {
  pos: Vec2;
  angle: number;
  vel: Vec2 = vec();
  angVel = 0;
  mass: number;
  inertia: number;

  constructor(pos: Vec2, angle: number, mass: number, inertia: number) {
    this.pos = { ...pos };
    this.angle = angle;
    this.mass = mass;
    this.inertia = inertia;
  }

  /** Velocity of a point offset `r` (world-space, relative to the centre of mass). */
  pointVelocity(r: Vec2): Vec2 {
    return { x: this.vel.x - this.angVel * r.y, y: this.vel.y + this.angVel * r.x };
  }

  /** Apply force `f` at world-space offset `r` from the centre of mass for `dt` seconds. */
  applyForceAt(f: Vec2, r: Vec2, dt: number, torqueScale = 1): void {
    this.vel = add(this.vel, scale(f, dt / this.mass));
    this.angVel += (torqueScale * cross(r, f) * dt) / this.inertia;
  }

  integrate(dt: number, linDrag: number, angDrag: number, maxAngVel: number): void {
    this.vel = scale(this.vel, Math.exp(-linDrag * dt));
    this.angVel *= Math.exp(-angDrag * dt);
    this.angVel = clamp(this.angVel, -maxAngVel, maxAngVel);
    this.pos = add(this.pos, scale(this.vel, dt));
    this.angle += this.angVel * dt;
  }

  speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }
}

export interface DragAlignParams {
  gain: number;
  /** Absolute softening radius in px. */
  softRadius: number;
  softPower: number;
  response: number;
  /**
   * Minimum share of the pull speed that the far edge (the grab point mirrored through the
   * centre of mass) keeps along the pull direction. 0 = it may stall, never goes backwards;
   * 0.1 = it always creeps forward at >= 10% of the pull speed.
   */
  farMinForward: number;
}

/**
 * "Towed trailer" rotation for a body dragged across a surface by a point.
 * Friction holds back the centre of mass, so the body turns until the vector
 * centre -> grab point lines up with the pull direction.
 *
 * For a trailer hitched at distance L: omega = (r x u) / L^2, i.e. dTheta/dDistance = sin(phi)/L.
 * A falloff L^p / (L^p + R^p) suppresses rotation for grabs near the centre, where real
 * friction (spread over the sheet's whole area) resists turning.
 *
 * The body's linear velocity is corrected so the grab point itself isn't disturbed:
 * the sheet swings *around* the cursor.
 *
 * Speed limit: the far edge (grab point mirrored through the centre, at -r) moves at
 * v_far = u - 2 omega x r, so (v_far . u) = |u|^2 - 2 omega (r x u). Spinning faster than
 * (1 - farMinForward) |u|^2 / (2 (r x u)) would swing the far edge backwards against the
 * pull, so the target spin is capped there. This cap bounds rotation when pulling sideways
 * (phi ~ 90 deg); at shallow angles the gain applies.
 */
export function applyDragAlignment(
  body: RigidBody,
  localAnchor: Vec2,
  pullVel: Vec2,
  p: DragAlignParams,
  dt: number,
): void {
  const r = rotate(localAnchor, body.angle);
  const L2 = r.x * r.x + r.y * r.y;
  if (L2 < 1e-6) return;
  const L = Math.sqrt(L2);
  const lp = L ** p.softPower;
  const falloff = lp / (lp + p.softRadius ** p.softPower);
  const c = cross(r, pullVel);
  let target = (p.gain * falloff * c) / L2;
  // Never spin so fast that the far edge swings against the pull (see above).
  const u2 = pullVel.x * pullVel.x + pullVel.y * pullVel.y;
  const limit = ((1 - p.farMinForward) * u2) / 2;
  if (target * c > limit) target = limit / c;

  const prev = body.angVel;
  body.angVel += (target - prev) * (1 - Math.exp(-p.response * dt));
  const dw = body.angVel - prev;
  // Keep the grab point's velocity unchanged: v_point = v + w x r.
  body.vel = { x: body.vel.x + dw * r.y, y: body.vel.y - dw * r.x };
}

export interface GrabSpringParams {
  stiffness: number;
  damping: number;
  torqueScale: number;
}

/**
 * Pull a point on the body (given in body-local, unrotated offset from the centre of mass)
 * towards `target` with a damped spring. Because the force is applied at the grab point,
 * grabbing off-centre makes the body swing to trail behind the cursor.
 */
export function applyGrabSpring(
  body: RigidBody,
  localAnchor: Vec2,
  target: Vec2,
  p: GrabSpringParams,
  dt: number,
): void {
  const r = rotate(localAnchor, body.angle);
  const q = add(body.pos, r);
  const vq = body.pointVelocity(r);
  const f = sub(scale(sub(target, q), p.stiffness), scale(vq, p.damping));
  body.applyForceAt(f, r, dt, p.torqueScale);
}
