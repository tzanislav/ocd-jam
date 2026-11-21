import { type Vec2, add, rotate, scale, sub } from '../core/vec.ts';
import type { Sprite, StampArt, StampKind } from '../render/assets.ts';
import { DeskObject, type GrabInput } from './deskObject.ts';
import { ART_PX, ART_SRC_PX, STAMP } from './tuning.ts';

/** Source-image rows above this are the knob + collar: clicking there slams the stamp. */
const KNOB_MAX_SRC_Y = 205;

/**
 * Centre of the stamp's rubber face in source px: the base frame at the bottom of the
 * sprite (x 76..391, y ~396..487). The ink mark is printed centred here.
 */
const FACE_SRC: Vec2 = { x: 233.5, y: 441 };

/** Extra shift of the printed mark below the measured face centre, in world px. */
const MARK_DROP_PX = 5;

/**
 * A rubber stamp. Dragged exactly like a sheet of paper; a click (press + release
 * without moving) on its knob slams it down and inks whatever paper is under its face.
 */
export class Stamp extends DeskObject {
  readonly kind: StampKind;
  readonly sprite: Sprite;
  /** The ink impression this stamp leaves. */
  readonly mark: Sprite;
  /** World px per source px (same for the stamp and its mark art). */
  readonly k: number;
  /** Centre of mass in source px (centroid of the opaque pixels: the heavy frame pulls it low). */
  readonly com: Vec2;
  /** Slam animation: 1 right after impact, decays to 0. */
  slam = 0;

  constructor(kind: StampKind, art: StampArt, pos: Vec2) {
    const k = ART_PX / ART_SRC_PX;
    const { bounds } = art.sprite;
    super(pos, 0, bounds.w * k, bounds.h * k, STAMP);
    this.kind = kind;
    this.sprite = art.sprite;
    this.mark = art.mark;
    this.k = k;
    this.com = centroid(art.sprite);
  }

  /** World px -> source image px. */
  toSrc(p: Vec2): Vec2 {
    return add(scale(rotate(sub(p, this.body.pos), -this.body.angle), 1 / this.k), this.com);
  }

  /** Source image px -> world px. */
  srcToWorld(s: Vec2): Vec2 {
    return add(this.body.pos, rotate(scale(sub(s, this.com), this.k), this.body.angle));
  }

  /** Centre of the rubber face in world px: where the mark lands. */
  faceCenter(): Vec2 {
    return this.srcToWorld({ x: FACE_SRC.x, y: FACE_SRC.y + MARK_DROP_PX / this.k });
  }

  /** Size of the printed mark in world px (its opaque area). */
  markSize(): { w: number; h: number } {
    return { w: this.mark.bounds.w * this.k, h: this.mark.bounds.h * this.k };
  }

  contains(p: Vec2): boolean {
    const s = this.toSrc(p);
    const x = Math.floor(s.x);
    const y = Math.floor(s.y);
    if (x < 0 || y < 0 || x >= this.sprite.w || y >= this.sprite.h) return false;
    return this.sprite.alpha[y * this.sprite.w + x] > 0;
  }

  /** Is this point on the knob (the "top" you press to stamp)? */
  onKnob(p: Vec2): boolean {
    return this.contains(p) && this.toSrc(p).y < KNOB_MAX_SRC_Y;
  }

  slamDown(): void {
    this.slam = 1;
  }

  override update(dt: number, grab: GrabInput | null): void {
    super.update(dt, grab);
    this.slam = Math.max(0, this.slam - dt * 5);
  }
}

function centroid(s: Sprite): Vec2 {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.alpha[y * s.w + x] === 0) continue;
      sx += x;
      sy += y;
      n++;
    }
  }
  return { x: sx / n, y: sy / n };
}
