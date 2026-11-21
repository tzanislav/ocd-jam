import { rng } from '../core/geom.ts';
import { type Vec2, add, rotate, wrapAngle } from '../core/vec.ts';
import type { Paper } from '../game/paper.ts';
import type { Stamp } from '../game/stamp.ts';
import { PX_PER_MM, STAMP_INK, TEX_PX_PER_MM } from '../game/tuning.ts';
import { createPaperTexture } from './paperArt.ts';

/** Scratch canvas for building one impression before it is composited onto a sheet. */
const scratch = document.createElement('canvas');

/**
 * Press the stamp's mark into every sheet under its face. Papers are ordered bottom -> top
 * (as in World.papers); a sheet only gets ink where no sheet above it covers the face.
 * The ink goes into each sheet's texture in paper space, so it moves with the sheet.
 * Returns the papers that received ink.
 */
export function bakeStamp(stamp: Stamp, papers: Paper[]): Paper[] {
  const face = stamp.faceCenter();
  const inked: Paper[] = [];
  // Same ink load for every sheet hit by this one press.
  const alpha = STAMP_INK.alphaMin + Math.random() * (STAMP_INK.alphaMax - STAMP_INK.alphaMin);
  const seed = (Math.random() * 2 ** 32) >>> 0;

  for (let i = papers.length - 1; i >= 0; i--) {
    const paper = papers[i];
    const above = papers.slice(i + 1);
    if (!reachesPaper(stamp, face, paper, above)) continue;
    if (!paper.texture) paper.texture = createPaperTexture(paper.spec);
    const pos = paper.toLocal(face);
    const angle = wrapAngle(stamp.body.angle - paper.body.angle);
    drawImpression(paper, above, stamp, pos, angle, alpha, seed);
    paper.marks.push({ kind: stamp.kind, pos, angle });
    inked.push(paper);
  }
  return inked;
}

/** Does any part of the mark touch this sheet without being covered by a sheet above? */
function reachesPaper(stamp: Stamp, face: Vec2, paper: Paper, above: Paper[]): boolean {
  const { w, h } = stamp.markSize();
  const nx = 12;
  const ny = 4;
  for (let iy = 0; iy <= ny; iy++) {
    for (let ix = 0; ix <= nx; ix++) {
      const local = { x: (ix / nx - 0.5) * w, y: (iy / ny - 0.5) * h };
      const p = add(face, rotate(local, stamp.body.angle));
      if (paper.contains(p) && !above.some((q) => q.contains(p))) return true;
    }
  }
  return false;
}

function drawImpression(
  paper: Paper,
  above: Paper[],
  stamp: Stamp,
  pos: Vec2,
  angle: number,
  alpha: number,
  seed: number,
): void {
  const tex = paper.texture!;
  scratch.width = tex.width;
  scratch.height = tex.height;
  const ctx = scratch.getContext('2d')!;
  const mark = stamp.mark;
  const b = mark.bounds;

  // 1. The mark, in source px, centred on the face position (paper mm -> texture px).
  ctx.save();
  ctx.scale(TEX_PX_PER_MM, TEX_PX_PER_MM);
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  ctx.scale(stamp.k / PX_PER_MM, stamp.k / PX_PER_MM);
  ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mark.img, 0, 0);

  // 2. Uneven ink: knock out a few art-pixel-sized dry specks.
  ctx.globalCompositeOperation = 'destination-out';
  const r = rng(seed);
  const art = 4; // source px per art pixel
  const n = Math.round(((b.w * b.h) / (art * art)) * STAMP_INK.speckle);
  for (let s = 0; s < n; s++) {
    const x = b.x + Math.floor(r() * (b.w / art)) * art;
    const y = b.y + Math.floor(r() * (b.h / art)) * art;
    ctx.globalAlpha = 0.4 + r() * 0.6;
    ctx.fillRect(x, y, art, art);
  }
  ctx.restore();

  // 3. Sheets lying on top of this one shield it from the ink.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.scale(TEX_PX_PER_MM, TEX_PX_PER_MM);
  for (const q of above) {
    ctx.beginPath();
    q.poly.forEach((v, j) => {
      const l = paper.toLocal(q.toWorld(v));
      if (j === 0) ctx.moveTo(l.x, l.y);
      else ctx.lineTo(l.x, l.y);
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 4. Press it into the paper: multiply so the printed form shows through the ink.
  const tctx = tex.getContext('2d')!;
  tctx.save();
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.globalAlpha = alpha;
  tctx.globalCompositeOperation = 'multiply';
  tctx.drawImage(scratch, 0, 0);
  tctx.restore();
}

