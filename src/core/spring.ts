import type { Vec2 } from './vec.ts';

/**
 * Damped spring step (semi-implicit Euler). `freq` is the natural frequency in rad/s
 * (higher = snappier), `zeta` the damping ratio (1 = critically damped, <1 = overshoots).
 * Mutates and returns nothing; works on plain numbers via the 1D helper below.
 */
export function springStep1D(
  x: number,
  v: number,
  target: number,
  freq: number,
  zeta: number,
  dt: number,
): [number, number] {
  const a = freq * freq * (target - x) - 2 * zeta * freq * v;
  v += a * dt;
  x += v * dt;
  return [x, v];
}

export function springStep2D(
  pos: Vec2,
  vel: Vec2,
  target: Vec2,
  freq: number,
  zeta: number,
  dt: number,
): void {
  const [x, vx] = springStep1D(pos.x, vel.x, target.x, freq, zeta, dt);
  const [y, vy] = springStep1D(pos.y, vel.y, target.y, freq, zeta, dt);
  pos.x = x;
  pos.y = y;
  vel.x = vx;
  vel.y = vy;
}
