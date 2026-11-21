import markNoUrl from '../../assets/mark_no.png';
import markYesUrl from '../../assets/mark_yes.png';
import stampNoUrl from '../../assets/stamp_no.png';
import stampYesUrl from '../../assets/stamp_yes.png';
import woodUrl from '../../assets/Wood_Back.png';
import type { Rect } from '../core/vec.ts';

export interface Sprite {
  img: HTMLImageElement;
  /** Alpha channel at source resolution, for pixel-accurate hit tests. */
  alpha: Uint8Array;
  w: number;
  h: number;
  /** Bounding box of the non-transparent pixels, in source px. */
  bounds: Rect;
}

export type StampKind = 'yes' | 'no';

export interface StampArt {
  /** The stamp itself, as it sits on the desk. */
  sprite: Sprite;
  /** The ink impression it leaves on paper. */
  mark: Sprite;
}

export interface Assets {
  wood: HTMLImageElement;
  stamps: Record<StampKind, StampArt>;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function toSprite(img: HTMLImageElement): Sprite {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const alpha = new Uint8Array(c.width * c.height);
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < alpha.length; i++) {
    const a = data[i * 4 + 3];
    alpha[i] = a;
    if (a === 0) continue;
    const x = i % c.width;
    const y = (i - x) / c.width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const bounds = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return { img, alpha, w: c.width, h: c.height, bounds };
}

async function loadSprite(url: string): Promise<Sprite> {
  return toSprite(await loadImage(url));
}

export async function loadAssets(): Promise<Assets> {
  const [wood, stampYes, markYes, stampNo, markNo] = await Promise.all([
    loadImage(woodUrl),
    loadSprite(stampYesUrl),
    loadSprite(markYesUrl),
    loadSprite(stampNoUrl),
    loadSprite(markNoUrl),
  ]);
  return {
    wood,
    stamps: {
      yes: { sprite: stampYes, mark: markYes },
      no: { sprite: stampNo, mark: markNo },
    },
  };
}
