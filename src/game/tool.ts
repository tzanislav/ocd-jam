import { springStep1D, springStep2D } from '../core/spring.ts';
import { type Rect, type Vec2, clamp, inRect, rotate, sub, vec, wrapAngle } from '../core/vec.ts';
import { TOOL_HOMES } from './desk.ts';
import { TOOLS, TOOL_LIFT, type ToolFeel } from './tuning.ts';

export type ToolKind = 'knife' | 'pen';

/** Hit areas in tool-local px. The origin is the working point (blade tip / nib). */
const HIT: Record<ToolKind, Rect> = {
  knife: { x: -8, y: -18, w: 236, h: 36 },
  pen: { x: -8, y: -14, w: 206, h: 28 },
};

/**
 * A tool on the rack. When held it follows the cursor on a damped spring, so heavier tools
 * (lower frequency) lag and sway more. Released tools spring back to their rack slot.
 */
export class Tool {
  readonly kind: ToolKind;
  readonly feel: ToolFeel;
  readonly home: Vec2;
  readonly homeAngle = 0;

  pos: Vec2;
  vel: Vec2 = vec();
  angle = 0;
  angVel = 0;
  held = false;
  /** 0 on the rack, 1 in the hand (visual only). */
  lift = 0;
  /** Placeholder "use" animation: 1 right after a click, decays to 0. */
  press = 0;

  constructor(kind: ToolKind) {
    this.kind = kind;
    this.feel = TOOLS[kind];
    this.home = TOOL_HOMES[kind];
    this.pos = { ...this.home };
  }

  contains(p: Vec2): boolean {
    return inRect(rotate(sub(p, this.pos), -this.angle), HIT[this.kind]);
  }

  /** Placeholder for the real tool actions (stamp slam, cut, draw). */
  use(): void {
    this.press = 1;
  }

  update(dt: number, pointer: Vec2): void {
    const f = this.feel;
    const target = this.held ? pointer : this.home;
    springStep2D(this.pos, this.vel, target, f.freq, f.zeta, dt);

    const sway = this.held ? clamp(this.vel.x * f.sway, -0.3, 0.3) : 0;
    const targetAngle = (this.held ? f.heldAngle : this.homeAngle) + sway;
    // Spring the shortest way round.
    const goal = this.angle + wrapAngle(targetAngle - this.angle);
    [this.angle, this.angVel] = springStep1D(this.angle, this.angVel, goal, f.freq * 0.8, 0.9, dt);

    const targetLift = this.held ? 1 : 0;
    this.lift += (targetLift - this.lift) * Math.min(1, TOOL_LIFT.speed * dt);
    this.press = Math.max(0, this.press - dt * 6);
  }
}
