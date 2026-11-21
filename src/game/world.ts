import { rng } from '../core/geom.ts';
import { type Vec2, clamp, dist, inRect, rectCenter, rotate, sub } from '../core/vec.ts';
import type { Assets } from '../render/assets.ts';
import { bakeStamp } from '../render/ink.ts';
import { BOUNDS, INBOX, RACK, STAMP_STARTS, type Zone, zoneAt } from './desk.ts';
import type { DeskObject } from './deskObject.ts';
import { Paper, type PaperSpec } from './paper.ts';
import { Stamp } from './stamp.ts';
import { Tool } from './tool.ts';
import { PAPER, STAMP } from './tuning.ts';

// Placeholder documents until the real document data format lands (see docs/TECH.md §8).
const TITLES = [
  'Application for the Allocation of One (1) Teaspoon, Second',
  'Request to Repaint Corridor 4 from Grey to Slightly Different Grey',
  'Notification of Receipt of Notification No. 4471',
  'Permit to Stand in Queue (Temporary)',
  'Complaint Regarding the Length of the Complaints Queue',
  'Petition to Rename a Cat (Cat Not Present)',
  'Certificate Confirming the Absence of a Certificate',
  'Requisition of One (1) Pencil, Used',
];

const SIZES: [number, number][] = [
  [148, 210], // A5 portrait
  [148, 210],
  [148, 210],
  [105, 148], // A6 slip
];

/** Pointer travel (world px) under which a press + release counts as a click, not a drag. */
const CLICK_SLOP = 6;
/** A press held longer than this (seconds) is a hold, not a click, even without moving. */
const CLICK_MAX_TIME = 0.5;

interface Grab {
  obj: DeskObject;
  /** Grabbed point as an unrotated px offset from the object's centre of mass. */
  anchor: Vec2;
  /** Where the press started, for click-vs-drag detection. */
  start: Vec2;
  /** Pressed on the stamp's knob: a click (no drag) slams it. */
  onKnob: boolean;
  /** The pointer left the click slop at some point: this press is a drag, never a click. */
  dragged: boolean;
  /** World time (s) when the press started. */
  startTime: number;
}

export class World {
  papers: Paper[] = [];
  /** Stamps on the desk; the last one is drawn on top. */
  stamps: Stamp[] = [];
  tools: Tool[] = [new Tool('knife'), new Tool('pen')];
  heldTool: Tool | null = null;
  grab: Grab | null = null;
  pointer: Vec2 = rectCenter(BOUNDS);
  /** Smoothed pointer velocity (px/s); the pull direction for dragged objects. */
  pointerVel: Vec2 = { x: 0, y: 0 };
  private prevPointer: Vec2 = rectCenter(BOUNDS);
  /** Screen shake amount (world px), decays over time. */
  shake = 0;
  /** Simulation clock (s). */
  time = 0;
  debug = false;

  private readonly assets: Assets;

  constructor(assets: Assets) {
    this.assets = assets;
    this.reset();
  }

  reset(): void {
    this.papers = [];
    this.grab = null;
    this.stamps = (['yes', 'no'] as const).map(
      (kind) => new Stamp(kind, this.assets.stamps[kind], STAMP_STARTS[kind]),
    );
    const r = rng((Math.random() * 2 ** 32) >>> 0);
    const c = rectCenter(INBOX);
    for (let i = 0; i < 8; i++) {
      const [w, h] = SIZES[Math.floor(r() * SIZES.length)];
      const spec: PaperSpec = {
        title: TITLES[i % TITLES.length],
        formNo: `${Math.floor(r() * 90 + 10)}-${'АБВГДЕЖ'[Math.floor(r() * 7)]}`,
        w,
        h,
        seed: Math.floor(r() * 2 ** 31),
      };
      const pos = { x: c.x + (r() - 0.5) * 16, y: c.y + (r() - 0.5) * 16 };
      this.papers.push(new Paper(spec, pos, (r() - 0.5) * 0.08, 'inbox'));
    }
  }

  // ---------------------------------------------------------------- queries

  /** Only the top sheet of the inbox/outbox can be touched; buried outbox sheets are final. */
  isInteractive(p: Paper): boolean {
    if (p.committed) return false;
    if (p.zone === 'desk') return true;
    return this.topOf(p.zone) === p;
  }

  topOf(zone: Zone): Paper | null {
    for (let i = this.papers.length - 1; i >= 0; i--) {
      if (this.papers[i].zone === zone) return this.papers[i];
    }
    return null;
  }

  /** Topmost paper under the point, or null. A non-interactive sheet blocks those beneath it. */
  paperAt(p: Vec2): Paper | null {
    for (let i = this.papers.length - 1; i >= 0; i--) {
      const paper = this.papers[i];
      if (paper.contains(p)) return this.isInteractive(paper) ? paper : null;
    }
    return null;
  }

  /** Topmost stamp under the point, or null. */
  stampAt(p: Vec2): Stamp | null {
    for (let i = this.stamps.length - 1; i >= 0; i--) {
      if (this.stamps[i].contains(p)) return this.stamps[i];
    }
    return null;
  }

  toolAt(p: Vec2): Tool | null {
    return this.tools.find((t) => !t.held && t.contains(p)) ?? null;
  }

  cursor(): string {
    if (this.heldTool) return 'none';
    if (this.grab) return 'grabbing';
    const stamp = this.stampAt(this.pointer);
    if (stamp) return stamp.onKnob(this.pointer) ? 'pointer' : 'grab';
    if (this.toolAt(this.pointer) || this.paperAt(this.pointer)) return 'grab';
    return 'default';
  }

  // ---------------------------------------------------------------- input

  pointerMove(p: Vec2): void {
    this.pointer = { x: clamp(p.x, 0, BOUNDS.w), y: clamp(p.y, 0, BOUNDS.h) };
    if (this.grab && dist(this.grab.start, this.pointer) >= CLICK_SLOP) this.grab.dragged = true;
  }

  pointerDown(p: Vec2, button: number): void {
    this.pointerMove(p);
    if (button === 2) {
      this.putToolBack();
      return;
    }
    if (button !== 0) return;

    if (this.heldTool) {
      const other = this.toolAt(this.pointer);
      if (other) {
        this.putToolBack();
        this.pickUpTool(other);
      } else if (inRect(this.pointer, RACK)) {
        this.putToolBack();
      } else {
        this.heldTool.use();
      }
      return;
    }

    const tool = this.toolAt(this.pointer);
    if (tool) {
      this.pickUpTool(tool);
      return;
    }

    // Stamps sit on top of everything on the desk.
    const stamp = this.stampAt(this.pointer);
    if (stamp) {
      this.stamps.splice(this.stamps.indexOf(stamp), 1);
      this.stamps.push(stamp);
      this.grabObject(stamp, stamp.onKnob(this.pointer));
      return;
    }

    const paper = this.paperAt(this.pointer);
    if (paper) {
      // Bring to front.
      this.papers.splice(this.papers.indexOf(paper), 1);
      this.papers.push(paper);
      this.grabObject(paper, false);
    }
  }

  pointerUp(p: Vec2, button: number): void {
    this.pointerMove(p);
    if (button === 0 && this.grab) this.release();
  }

  keyDown(key: string): void {
    if (key === 'Escape') this.putToolBack();
    if (key === 'r' || key === 'R') this.reset();
    if (key === 'F1' || key === '`') this.debug = !this.debug;
  }

  // ---------------------------------------------------------------- actions

  private pickUpTool(tool: Tool): void {
    tool.held = true;
    this.heldTool = tool;
  }

  private putToolBack(): void {
    if (!this.heldTool) return;
    this.heldTool.held = false;
    this.heldTool = null;
  }

  private grabObject(obj: DeskObject, onKnob: boolean): void {
    obj.held = true;
    const anchor = rotate(sub(this.pointer, obj.body.pos), -obj.body.angle);
    this.grab = { obj, anchor, start: { ...this.pointer }, onKnob, dragged: false, startTime: this.time };
  }

  private release(): void {
    if (!this.grab) return;
    const { obj, onKnob, dragged, startTime } = this.grab;
    obj.release();
    this.grab = null;
    if (obj instanceof Stamp) {
      // Quick press on the knob + release without ever dragging = CLUNK.
      if (onKnob && !dragged && this.time - startTime <= CLICK_MAX_TIME) this.slam(obj);
    } else if (obj instanceof Paper) {
      this.setZone(obj, zoneAt(obj.body.pos));
    }
  }

  private slam(stamp: Stamp): void {
    stamp.slamDown();
    this.shake = STAMP.slamShake;
    bakeStamp(stamp, this.papers);
  }

  private setZone(paper: Paper, zone: Zone): void {
    if (zone === paper.zone) return;
    if (zone === 'outbox') {
      // Landing on the outbox pile seals everything underneath.
      for (const other of this.papers) {
        if (other !== paper && other.zone === 'outbox') other.committed = true;
      }
    }
    paper.zone = zone;
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    this.time += dt;
    this.trackPointerVelocity(dt);
    for (const tool of this.tools) tool.update(dt, this.pointer);
    for (const paper of this.papers) {
      const wasResting = paper.resting;
      paper.update(dt, this.grabInputFor(paper));
      // A flicked sheet may slide into (or out of) a tray before stopping.
      if (!wasResting && paper.resting && !paper.held) this.setZone(paper, zoneAt(paper.body.pos));
    }
    for (const stamp of this.stamps) stamp.update(dt, this.grabInputFor(stamp));
    this.shake *= Math.exp(-dt * 18);
  }

  private grabInputFor(obj: DeskObject) {
    return this.grab?.obj === obj
      ? { anchor: this.grab.anchor, target: this.pointer, pullVel: this.pointerVel }
      : null;
  }

  /** Pointer events arrive at an uneven rate, so low-pass the per-step velocity. */
  private trackPointerVelocity(dt: number): void {
    const raw = sub(this.pointer, this.prevPointer);
    this.prevPointer = { ...this.pointer };
    const k = 1 - Math.exp(-dt / PAPER.align.pointerSmoothing);
    this.pointerVel = {
      x: this.pointerVel.x + (raw.x / dt - this.pointerVel.x) * k,
      y: this.pointerVel.y + (raw.y / dt - this.pointerVel.y) * k,
    };
  }
}
