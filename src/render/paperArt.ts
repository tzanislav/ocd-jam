import { rng } from '../core/geom.ts';
import { type PaperSpec, stampField } from '../game/paper.ts';
import { TEX_PX_PER_MM } from '../game/tuning.ts';
import { COLORS, FONT } from './palette.ts';

/**
 * Bake the printed form into a canvas in paper space (TEX_PX_PER_MM px per mm).
 * Later, stamps and pen ink get drawn onto this same canvas so they move with the sheet.
 * PLACEHOLDER ART: grey bars stand in for typed text.
 */
export function createPaperTexture(spec: PaperSpec): HTMLCanvasElement {
  const k = TEX_PX_PER_MM;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.w * k);
  canvas.height = Math.round(spec.h * k);
  const ctx = canvas.getContext('2d')!;
  const r = rng(spec.seed);
  ctx.scale(k, k); // draw in millimetres from here on

  // Paper
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, spec.w, spec.h);
  // Grain speckle
  for (let i = 0; i < spec.w * spec.h * 0.08; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(120,100,60,0.06)' : 'rgba(255,255,255,0.10)';
    ctx.fillRect(r() * spec.w, r() * spec.h, 0.4 + r() * 0.6, 0.4 + r() * 0.6);
  }

  const m = 10; // margin mm
  const small = spec.w < 120;

  // Header
  ctx.fillStyle = COLORS.print;
  ctx.font = `bold 4.6px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText('СССР · ОБЛБУМУПР', m, m);
  ctx.textAlign = 'right';
  ctx.font = `4.2px ${FONT}`;
  ctx.fillText(`Форма № ${spec.formNo}`, spec.w - m, m);
  ctx.textAlign = 'left';
  ctx.fillRect(m, m + 6.5, spec.w - 2 * m, 0.4);

  // Title (wrapped)
  ctx.font = `bold ${small ? 5.2 : 6.4}px ${FONT}`;
  let y = m + 11;
  for (const line of wrap(ctx, spec.title, spec.w - 2 * m)) {
    ctx.fillText(line, m, y);
    y += small ? 6.4 : 7.8;
  }
  y += 4;

  // Bottom block: stamp field on the right; the signature sits beside it, or above it on
  // narrow slips where they would collide.
  const field = stampField(spec);
  const sigW = small ? 40 : 55;
  const sigY = m + sigW + 4 < field.x ? spec.h - 30 : field.y - 8;
  const bodyEnd = Math.min(spec.h - (small ? 38 : 60), sigY - 12, field.y - 10);

  // "Typed" body text as grey bars
  ctx.fillStyle = COLORS.printFaint;
  while (y < bodyEnd) {
    const paragraphLines = 2 + Math.floor(r() * 4);
    for (let i = 0; i < paragraphLines && y < bodyEnd; i++) {
      const last = i === paragraphLines - 1;
      const w = (spec.w - 2 * m) * (last ? 0.3 + r() * 0.5 : 0.92 + r() * 0.08);
      ctx.fillRect(m, y, w, 1.3);
      y += 3.4;
    }
    y += 3;
  }

  // Signature line
  ctx.fillStyle = COLORS.print;
  ctx.font = `2.8px ${FONT}`;
  ctx.fillText('Подпись / Signature', m, sigY - 4);
  ctx.fillRect(m, sigY, sigW, 0.3);

  // М.П. (place of the stamp): dotted rectangle the size of the stamp's face
  ctx.strokeStyle = COLORS.print;
  ctx.lineWidth = 0.35;
  ctx.setLineDash([1, 1.2]);
  ctx.strokeRect(field.x, field.y, field.w, field.h);
  ctx.setLineDash([]);
  ctx.font = `2.6px ${FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.fillText('М.П. / Place of stamp', field.x, field.y - 1);

  return canvas;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
