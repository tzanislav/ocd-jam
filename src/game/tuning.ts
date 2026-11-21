// All feel-related constants in one place. Tweak freely.

export const WORLD_W = 1920;
export const WORLD_H = 1080;

/** Fixed physics timestep (seconds). */
export const STEP = 1 / 120;

/** Desk pixels per paper millimetre. A5 (148x210mm) -> ~385x546px. */
export const PX_PER_MM = 2.6;
/** Resolution of each paper's ink/texture canvas. */
export const TEX_PX_PER_MM = 4;

/**
 * Pixel art: the source PNGs are exported at 4 image px per art pixel. ART_PX is how many
 * world px one art pixel covers on the desk. Keep it the same for all art so pixel sizes match.
 */
export const ART_SRC_PX = 4;
export const ART_PX = 2;

/**
 * The printed stamp field on each form (mm). The stamp's mark is ~59 x 19 mm, so this
 * leaves ~1.5 mm of slack on each side.
 */
export const STAMP_FIELD_MM = { w: 62, h: 22 };

/** Ink look of a stamp impression. */
export const STAMP_INK = {
  /** Opacity range per impression (some presses are inkier than others). */
  alphaMin: 0.78,
  alphaMax: 0.95,
  /** Share of the mark knocked out as tiny dry specks. */
  speckle: 0.12,
};

export const PAPER: BodyFeel = {
  mass: 1,
  /**
   * Spring pulling the grabbed point to the cursor. Linear only (torqueScale 0):
   * rotation while held comes from `align` below.
   */
  grab: { stiffness: 4000, damping: 115, torqueScale: 0 },
  /**
   * Towed-trailer alignment while held: the sheet turns so the line centre -> grab point
   * points along the drag direction. Rotation is per distance dragged, not per second.
   */
  align: {
    /** 1 = physical trailer. Higher = aligns over less drag distance. */
    gain: 1.75,
    /**
     * Grabs closer to the centre than this (fraction of the half-diagonal) barely rotate:
     * models friction spread over the whole sheet.
     */
    softRadius: 0.45,
    /** Sharpness of the centre -> edge falloff. */
    softPower: 4,
    /** How fast spin follows the target (1/s). Lower = more rotational inertia. */
    response: 60,
    /**
     * The far edge (opposite the grab point) never swings against the pull: it always creeps
     * forward at at least this share of the pull speed. Higher = slower, heavier turns.
     */
    farMinForward: 0.1,
    /** Pointer velocity smoothing time constant (s). */
    pointerSmoothing: 0.03,
  },
  /** Desk friction while held (paper still drags on the desk). */
  linDragHeld: 6,
  angDragHeld: 0,
  /** Desk friction once released (controls how far a flick slides). */
  linDragFree: 5,
  angDragFree: 7,
  maxAngVel: 30,
  /** Spin kept on release, clamped so flicks don't turn into helicopters. */
  releaseSpinMax: 3,
  /** Below these speeds a free paper snaps to rest. */
  restSpeed: 4,
  restAngVel: 0.02,
  /** Visual lift while held. */
  liftScale: 1.03,
  liftShadow: 18,
  restShadow: 4,
  liftSpeed: 14,
  /** Bounce factor when hitting the edge of the desk. */
  wallBounce: 0.3,
};

/** Physical feel of a draggable desk object (see DeskObject). */
export interface BodyFeel {
  mass: number;
  grab: { stiffness: number; damping: number; torqueScale: number };
  align: {
    gain: number;
    softRadius: number;
    softPower: number;
    response: number;
    farMinForward: number;
    pointerSmoothing: number;
  };
  linDragHeld: number;
  angDragHeld: number;
  linDragFree: number;
  angDragFree: number;
  maxAngVel: number;
  releaseSpinMax: number;
  restSpeed: number;
  restAngVel: number;
  liftScale: number;
  liftShadow: number;
  restShadow: number;
  liftSpeed: number;
  wallBounce: number;
}

/**
 * The stamp drags like paper but is heavier: it turns to trail the cursor at ~30% of
 * the paper's rate, lifts higher and slides less.
 */
export const STAMP: BodyFeel & { slamSquash: number; slamShake: number } = {
  ...PAPER,
  align: { ...PAPER.align, gain: PAPER.align.gain * 0.3 },
  linDragFree: 9,
  liftScale: 1.06,
  liftShadow: 30,
  restShadow: 6,
  /** Vertical squash on slam (fraction of height). */
  slamSquash: 0.08,
  /** Screen shake amplitude on slam (world px). */
  slamShake: 7,
};

export interface ToolFeel {
  /** Follow spring natural frequency (rad/s). Lower = heavier/laggier. */
  freq: number;
  zeta: number;
  /** Rotation while held (radians) - the "in hand" pose. */
  heldAngle: number;
  /** How much horizontal velocity tilts the tool (rad per px/s). */
  sway: number;
}

export const TOOLS: Record<'knife' | 'pen', ToolFeel> = {
  knife: { freq: 20, zeta: 0.8, heldAngle: 0.65, sway: 0.00015 },
  pen: { freq: 28, zeta: 0.85, heldAngle: 0.75, sway: 0.0001 },
};

export const TOOL_LIFT = { scale: 1.08, shadow: 26, restShadow: 5, speed: 12 };
