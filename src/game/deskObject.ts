import { RigidBody, applyDragAlignment, applyGrabSpring } from '../core/body.ts';
import { type Vec2, clamp } from '../core/vec.ts';
import { BOUNDS } from './desk.ts';
import type { BodyFeel } from './tuning.ts';

export interface GrabInput {
  /** Grabbed point as an unrotated px offset from the centre of mass. */
  anchor: Vec2;
  target: Vec2;
  pullVel: Vec2;
}

/**
 * Anything that sits on the desk and can be dragged around by a point: papers, the stamp.
 * Shares the grab spring + towed-trailer rotation (see docs/TECH.md §5.1).
 */
export abstract class DeskObject {
  body: RigidBody;
  readonly feel: BodyFeel;
  /** Half-diagonal in px; scales the drag-alignment soft radius. */
  readonly halfDiagPx: number;
  held = false;
  resting = true;
  /** 0 = flat on the desk, 1 = fully lifted (visual only). */
  lift = 0;

  constructor(pos: Vec2, angle: number, wPx: number, hPx: number, feel: BodyFeel) {
    this.feel = feel;
    const inertia = (feel.mass * (wPx * wPx + hPx * hPx)) / 12;
    this.body = new RigidBody(pos, angle, feel.mass, inertia);
    this.halfDiagPx = Math.hypot(wPx, hPx) / 2;
  }

  abstract contains(p: Vec2): boolean;

  update(dt: number, grab: GrabInput | null): void {
    const b = this.body;
    const f = this.feel;
    if (grab) {
      this.resting = false;
      applyGrabSpring(b, grab.anchor, grab.target, f.grab, dt);
      applyDragAlignment(
        b,
        grab.anchor,
        grab.pullVel,
        { ...f.align, softRadius: f.align.softRadius * this.halfDiagPx },
        dt,
      );
      b.integrate(dt, f.linDragHeld, f.angDragHeld, f.maxAngVel);
    } else if (!this.resting) {
      b.integrate(dt, f.linDragFree, f.angDragFree, f.maxAngVel);
      this.bounceOffEdges();
      if (b.speed() < f.restSpeed && Math.abs(b.angVel) < f.restAngVel) {
        b.vel = { x: 0, y: 0 };
        b.angVel = 0;
        this.resting = true;
      }
    }
    const targetLift = this.held ? 1 : 0;
    this.lift += (targetLift - this.lift) * Math.min(1, f.liftSpeed * dt);
  }

  /** Let go: keep some spin, but not a helicopter. */
  release(): void {
    this.held = false;
    this.body.angVel = clamp(this.body.angVel, -this.feel.releaseSpinMax, this.feel.releaseSpinMax);
  }

  /** Keep the centre on the desk so nothing can be flicked off-screen. */
  private bounceOffEdges(): void {
    const b = this.body;
    const m = 40;
    const k = this.feel.wallBounce;
    if (b.pos.x < BOUNDS.x + m) { b.pos.x = BOUNDS.x + m; b.vel.x = Math.abs(b.vel.x) * k; }
    if (b.pos.x > BOUNDS.x + BOUNDS.w - m) { b.pos.x = BOUNDS.x + BOUNDS.w - m; b.vel.x = -Math.abs(b.vel.x) * k; }
    if (b.pos.y < BOUNDS.y + m) { b.pos.y = BOUNDS.y + m; b.vel.y = Math.abs(b.vel.y) * k; }
    if (b.pos.y > BOUNDS.y + BOUNDS.h - m) { b.pos.y = BOUNDS.y + BOUNDS.h - m; b.vel.y = -Math.abs(b.vel.y) * k; }
  }
}
