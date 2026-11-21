import type { Rect } from '../core/vec.ts';
import { INBOX, OUTBOX, RACK } from '../game/desk.ts';
import type { Paper } from '../game/paper.ts';
import type { Stamp } from '../game/stamp.ts';
import type { Tool, ToolKind } from '../game/tool.ts';
import { ART_PX, ART_SRC_PX, PAPER, PX_PER_MM, STAMP, TOOL_LIFT, WORLD_H, WORLD_W } from '../game/tuning.ts';
import type { World } from '../game/world.ts';
import type { Assets } from './assets.ts';
import { createPaperTexture } from './paperArt.ts';
import { COLORS, FONT } from './palette.ts';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Draws the world. `pxScale` = device pixels per world pixel; canvas shadow offsets/blur
 * ignore the transform, so they must be scaled by hand.
 */
export class Renderer {
  private deskCache: HTMLCanvasElement | null = null;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly assets: Assets;

  constructor(ctx: CanvasRenderingContext2D, assets: Assets) {
    this.ctx = ctx;
    this.assets = assets;
  }

  render(world: World, pxScale: number, fps: number): void {
    const ctx = this.ctx;
    ctx.save();
    if (world.shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * 2 * world.shake, (Math.random() - 0.5) * 2 * world.shake);
    }
    // Pixel art: nearest-neighbour so the dithering stays crisp.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.desk(), 0, 0, WORLD_W, WORLD_H);

    ctx.imageSmoothingEnabled = true;
    for (const paper of world.papers) this.drawPaper(paper, pxScale);
    for (const stamp of world.stamps) this.drawStamp(stamp, pxScale);
    ctx.restore();

    // Resting tools first, held tool always on top.
    for (const tool of world.tools) if (!tool.held) this.drawTool(tool, pxScale);
    if (world.heldTool) {
      this.drawTool(world.heldTool, pxScale);
      this.drawPointer(world);
    }

    this.drawHelp();
    if (world.debug) this.drawDebug(world, fps);
  }

  // ---------------------------------------------------------------- desk (cached)

  private desk(): HTMLCanvasElement {
    if (this.deskCache) return this.deskCache;
    const c = document.createElement('canvas');
    c.width = WORLD_W;
    c.height = WORLD_H;
    const ctx = c.getContext('2d')!;
    // Tiled pixel-art wood, scaled so one art pixel = ART_PX world px
    const pattern = ctx.createPattern(this.assets.wood, 'repeat')!;
    const k = ART_PX / ART_SRC_PX;
    pattern.setTransform(new DOMMatrix().scale(k, k));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Tool rack: felt-lined wooden tray
    roundRect(ctx, RACK, 14, COLORS.woodDark);
    roundRect(ctx, inset(RACK, 10), 8, COLORS.felt);
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = 'rgba(232,223,196,0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('НОЖ', 930, RACK.y + RACK.h - 14);
    ctx.fillText('РУЧКА', 1190, RACK.y + RACK.h - 14);

    this.drawTray(ctx, INBOX, 'ВХОДЯЩИЕ · INBOX');
    this.drawTray(ctx, OUTBOX, 'ИСХОДЯЩИЕ · OUTBOX');

    this.deskCache = c;
    return c;
  }

  private drawTray(ctx: CanvasRenderingContext2D, rect: Rect, label: string): void {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, rect, 10, COLORS.trayRim);
    ctx.restore();
    roundRect(ctx, inset(rect, 12), 6, COLORS.trayBase);
    // Label plate on the front lip
    const plate = { x: rect.x + rect.w / 2 - 130, y: rect.y + rect.h - 2, w: 260, h: 30 };
    roundRect(ctx, plate, 4, COLORS.brass);
    ctx.fillStyle = COLORS.print;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, plate.x + plate.w / 2, plate.y + plate.h / 2 + 1);
  }

  // ---------------------------------------------------------------- paper

  private drawPaper(paper: Paper, pxScale: number): void {
    const ctx = this.ctx;
    if (!paper.texture) paper.texture = createPaperTexture(paper.spec);
    const b = paper.body;
    const s = lerp(1, PAPER.liftScale, paper.lift);
    const sh = lerp(PAPER.restShadow, PAPER.liftShadow, paper.lift);

    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(b.angle);
    ctx.scale(s, s);

    // Outline path in px, relative to the centre of mass
    ctx.beginPath();
    paper.poly.forEach((p, i) => {
      const x = (p.x - paper.com.x) * PX_PER_MM;
      const y = (p.y - paper.com.y) * PX_PER_MM;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Shadow cast by the sheet (light from top-left)
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = sh * pxScale;
    ctx.shadowOffsetX = sh * 0.35 * pxScale;
    ctx.shadowOffsetY = sh * 0.55 * pxScale;
    ctx.fillStyle = COLORS.paper;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Printed texture, clipped to the (possibly cut) outline
    ctx.save();
    ctx.clip();
    ctx.drawImage(
      paper.texture,
      -paper.com.x * PX_PER_MM,
      -paper.com.y * PX_PER_MM,
      paper.spec.w * PX_PER_MM,
      paper.spec.h * PX_PER_MM,
    );
    ctx.restore();

    ctx.strokeStyle = COLORS.paperEdge;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Buried outbox sheets get a slight dim so the playable top sheet reads clearly
    if (paper.committed) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- stamp

  private drawStamp(stamp: Stamp, pxScale: number): void {
    const ctx = this.ctx;
    const { img, w, h } = stamp.sprite;
    const b = stamp.body;
    const slam = stamp.slam * stamp.slam;
    // Slam: briefly pressed flat (less lift, less shadow) and squashed onto its base.
    const lift = Math.max(0, stamp.lift - slam);
    const s = lerp(1, STAMP.liftScale, lift);
    const sh = lerp(STAMP.restShadow, STAMP.liftShadow, lift) * (1 - slam * 0.6);
    const squash = slam * STAMP.slamSquash;
    const k = stamp.k;
    // Bottom of the sprite, relative to the centre of mass, in world px (squash anchor).
    const baseY = (h - stamp.com.y) * k;

    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(b.angle);
    ctx.scale(s, s);
    ctx.translate(0, baseY);
    ctx.scale(1 + squash * 0.5, 1 - squash);
    ctx.translate(0, -baseY);

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = sh * pxScale;
    ctx.shadowOffsetX = sh * 0.35 * pxScale;
    ctx.shadowOffsetY = sh * 0.55 * pxScale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -stamp.com.x * k, -stamp.com.y * k, w * k, h * k);
    ctx.restore();
  }

  // ---------------------------------------------------------------- tools

  private drawTool(tool: Tool, pxScale: number): void {
    const ctx = this.ctx;
    const pressK = tool.press * tool.press;
    const lift = Math.max(0, tool.lift - pressK * 0.9);
    const s = lerp(1, TOOL_LIFT.scale, lift);
    const sh = lerp(TOOL_LIFT.restShadow, TOOL_LIFT.shadow, lift);

    ctx.save();
    ctx.translate(tool.pos.x, tool.pos.y);
    ctx.rotate(tool.angle);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = sh * pxScale;
    ctx.shadowOffsetX = sh * 0.35 * pxScale;
    ctx.shadowOffsetY = sh * 0.55 * pxScale;
    TOOL_SHAPES[tool.kind](ctx);
    ctx.restore();
  }

  /** Small crosshair at the real cursor while a (laggy) tool is held. */
  private drawPointer(world: World): void {
    const ctx = this.ctx;
    const p = world.pointer;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y);
    ctx.lineTo(p.x + 7, p.y);
    ctx.moveTo(p.x, p.y - 7);
    ctx.lineTo(p.x, p.y + 7);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- overlays

  private drawHelp(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = 'rgba(232,223,196,0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      'Drag papers & stamps · Click a stamp knob to stamp · Click a tool to pick it up · Right-click / Esc / click rack to put it back · R reset · F1 debug',
      WORLD_W / 2,
      WORLD_H - 10,
    );
    ctx.restore();
  }

  private drawDebug(world: World, fps: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = COLORS.debug;
    ctx.fillStyle = COLORS.debug;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    for (const r of [INBOX, OUTBOX, RACK]) ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);

    for (const p of world.papers) {
      const c = p.body.pos;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
      // velocity vector
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + p.body.vel.x * 0.1, c.y + p.body.vel.y * 0.1);
      ctx.stroke();
      ctx.font = `12px ${FONT}`;
      ctx.fillText(
        `${p.zone}${p.committed ? '*' : ''} ${((p.body.angle * 180) / Math.PI).toFixed(1)}°`,
        c.x + 8,
        c.y - 8,
      );
    }

    // Stamp faces: where the mark will land
    for (const s of world.stamps) {
      const c = s.faceCenter();
      const { w, h } = s.markSize();
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(s.body.angle);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    if (world.grab) {
      const { obj, anchor } = world.grab;
      const b = obj.body;
      const q = {
        x: b.pos.x + anchor.x * Math.cos(b.angle) - anchor.y * Math.sin(b.angle),
        y: b.pos.y + anchor.x * Math.sin(b.angle) + anchor.y * Math.cos(b.angle),
      };
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(world.pointer.x, world.pointer.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${fps.toFixed(0)} fps · papers ${world.papers.length}`, 12, 12);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- placeholder tool art
// Each shape is drawn with its origin at the tool's working point, extending along +x.

const TOOL_SHAPES: Record<ToolKind, (ctx: CanvasRenderingContext2D) => void> = {
  knife(ctx) {
    // Blade
    ctx.fillStyle = COLORS.steel;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(26, -9);
    ctx.lineTo(122, -9);
    ctx.lineTo(122, 9);
    ctx.lineTo(10, 9);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(26, -2, 96, 2);
    // Handle
    roundRect(ctx, { x: 118, y: -13, w: 108, h: 26 }, 9, COLORS.handle);
    circle(ctx, 140, 0, 3, COLORS.brass);
    circle(ctx, 200, 0, 3, COLORS.brass);
  },
  pen(ctx) {
    // Barrel
    roundRect(ctx, { x: 24, y: -8, w: 172, h: 16 }, 8, COLORS.penBody);
    ctx.shadowColor = 'transparent';
    // Nib
    ctx.fillStyle = COLORS.brass;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(26, -6);
    ctx.lineTo(26, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.print;
    ctx.fillRect(4, -0.5, 18, 1);
    // Bands + highlight
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(56, -8, 4, 16);
    ctx.fillRect(150, -8, 3, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(30, -5, 160, 2);
  },
};

// ---------------------------------------------------------------- helpers

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
}

function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}
