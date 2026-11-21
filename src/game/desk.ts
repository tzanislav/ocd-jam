import type { Rect, Vec2 } from '../core/vec.ts';
import { inRect } from '../core/vec.ts';
import { WORLD_H, WORLD_W } from './tuning.ts';

// Desk layout in world pixels (1920x1080 logical screen).

export const BOUNDS: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

export const RACK: Rect = { x: 780, y: 16, w: 540, h: 166 };
export const INBOX: Rect = { x: 40, y: 230, w: 460, h: 640 };
export const OUTBOX: Rect = { x: 1420, y: 230, w: 460, h: 640 };

/** Where each tool rests on the rack (its working point: knife tip, pen nib). */
export const TOOL_HOMES: Record<'knife' | 'pen', Vec2> = {
  knife: { x: 820, y: 91 },
  pen: { x: 1090, y: 91 },
};

/** Where the stamps start: on the desk between the work area and the outbox. */
export const STAMP_STARTS: Record<'yes' | 'no', Vec2> = {
  yes: { x: 1290, y: 400 },
  no: { x: 1290, y: 680 },
};

export type Zone = 'inbox' | 'desk' | 'outbox';

export function zoneAt(p: Vec2): Zone {
  if (inRect(p, INBOX)) return 'inbox';
  if (inRect(p, OUTBOX)) return 'outbox';
  return 'desk';
}
