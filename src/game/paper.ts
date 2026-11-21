import { pointInPolygon, polygonCentroid, rectPolygon } from '../core/geom.ts';
import { type Rect, type Vec2, add, rotate, scale, sub } from '../core/vec.ts';
import type { StampKind } from '../render/assets.ts';
import type { Zone } from './desk.ts';
import { DeskObject } from './deskObject.ts';
import { PAPER, PX_PER_MM, STAMP_FIELD_MM } from './tuning.ts';

export interface PaperSpec {
  title: string;
  formNo: string;
  /** Size in millimetres. */
  w: number;
  h: number;
  seed: number;
}

/** One stamp impression on a sheet, recorded for scoring. */
export interface StampMark {
  kind: StampKind;
  /** Centre of the mark in paper mm. */
  pos: Vec2;
  /** Rotation relative to the sheet (radians). */
  angle: number;
}

/** The printed "place of the seal" box in paper mm: bottom right, sized to the stamp's face. */
export function stampField(spec: PaperSpec): Rect {
  const m = 10;
  const { w, h } = STAMP_FIELD_MM;
  return { x: spec.w - m - w, y: spec.h - m - 2 - h, w, h };
}

/**
 * A sheet of paper on the desk. Its shape lives in paper space (millimetres, origin at the
 * top-left of the original sheet) so that later cuts and scoring can work in real units.
 * The rigid body tracks the centre of mass in world pixels.
 */
export class Paper extends DeskObject {
  readonly spec: PaperSpec;
  /** Outline in paper mm. A rectangle for now; becomes a convex polygon after cuts. */
  poly: Vec2[];
  /** Centre of mass in paper mm. */
  com: Vec2;
  /** Printed form + any ink, drawn in paper space. Assigned by the renderer. */
  texture: HTMLCanvasElement | null = null;
  /** Every stamp impression on this sheet, in the order they were made. */
  marks: StampMark[] = [];

  zone: Zone;
  /** Buried under a newer sheet in the outbox: can no longer be touched. */
  committed = false;

  constructor(spec: PaperSpec, pos: Vec2, angle: number, zone: Zone) {
    super(pos, angle, spec.w * PX_PER_MM, spec.h * PX_PER_MM, PAPER);
    this.spec = spec;
    this.poly = rectPolygon(spec.w, spec.h);
    this.com = polygonCentroid(this.poly);
    this.zone = zone;
  }

  /** Paper mm -> world px. */
  toWorld(mm: Vec2): Vec2 {
    return add(this.body.pos, rotate(scale(sub(mm, this.com), PX_PER_MM), this.body.angle));
  }

  /** World px -> paper mm. */
  toLocal(p: Vec2): Vec2 {
    return add(scale(rotate(sub(p, this.body.pos), -this.body.angle), 1 / PX_PER_MM), this.com);
  }

  contains(p: Vec2): boolean {
    return pointInPolygon(this.toLocal(p), this.poly);
  }
}
