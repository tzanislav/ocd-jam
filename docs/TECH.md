# Technical Approach

## 1. Recommendation: TypeScript + Vite + plain Canvas 2D (no engine)

**Why this is the easiest path for this game:**
- **One static screen.** No levels, tilemaps, cameras or scene graph, so an engine gives us little.
- **The "physics" is custom anyway.** A paper rotating around the grab point, a heavy lagging stamp, friction slides: these are ~100 lines of hand-rolled spring/rigid-body code. A general physics engine (Matter.js, Box2D) would be harder to tune into this specific *feel* than writing it ourselves.
- **Ink baking is trivial in Canvas 2D.** Each document owns an offscreen canvas. Stamps and pen strokes get drawn onto it in paper coordinates, so they move and rotate with the sheet for free.
- **Scoring is pure geometry.** Plain TS functions are easy to unit test.
- **Deploys anywhere.** `npm run build` makes a static folder that runs on itch.io, GitHub Pages, or straight from a file. Instant reload while tuning the feel.
- **Toolchain is already installed** (Node 24, npm 11).

### Alternatives considered
| Option | Verdict |
|---|---|
| **Godot 4** | Great for 2D, and has a visual editor and an audio bus. Baking ink means SubViewports, which is fiddlier, and the toolchain isn't installed. A good choice if you'd rather work in an editor than in code. |
| **Phaser 3** | Adds loaders, tweens and scenes. Fine, but its physics would mostly be bypassed, and it's a bigger API to learn for little gain. |
| **PixiJS** | A faster renderer only. Not needed: we draw about 20 papers. Easy to switch to later if needed. |

Small optional helpers: **Vitest** (tests for scoring and geometry). Everything else (tweens, springs, audio) is small enough to write in-house.

---

## 2. Project Layout (planned)

```
ocd-jam/
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts   (base: './' for itch.io)
├─ public/
│  ├─ fonts/   sfx/   img/
├─ src/
│  ├─ main.ts               boot, resize, game loop
│  ├─ input.ts              pointer / wheel / keys → per-frame input state
│  ├─ audio.ts              WebAudio sfx with random pitch/volume variation
│  ├─ core/
│  │  ├─ vec.ts             Vec2 math, transforms, angle helpers
│  │  ├─ body.ts            RigidBody2D: pos, angle, vel, angVel, grab spring
│  │  ├─ spring.ts          critically-damped follow springs (tools)
│  │  ├─ tween.ts           tiny easing/timeline helper (stamp slam etc.)
│  │  └─ geom.ts            polygon split, point-in-poly, circle fit
│  ├─ game/
│  │  ├─ desk.ts            layout rects: inbox, outbox, rack, bin, work area
│  │  ├─ paper.ts           Paper entity: body + polygon + ink canvas + doc spec
│  │  ├─ tools/
│  │  │  ├─ stamp.ts   knife.ts   pen.ts
│  │  ├─ day.ts             shift timer, inbox queue, state machine
│  │  └─ scoring.ts         PURE functions, unit-tested
│  ├─ render/
│  │  ├─ drawDesk.ts   drawPaper.ts   drawTools.ts   fx.ts (shake, hitstop)
│  ├─ ui/
│  │  ├─ directive.ts       morning memo
│  │  └─ report.ts          Inspector's end-of-day report
│  └─ data/
│     ├─ documents/*.json   document templates
│     └─ days.json          per-day doc lists, rules, timings, memos
└─ tests/
   └─ scoring.test.ts  geom.test.ts
```

---

## 3. Coordinate Systems & Units

- **Paper space is in millimetres.** Origin is the top-left of the *original* sheet. Standard size is A5 (148 × 210 mm). Every task target and every score is in mm, so the Inspector can honestly say "2.3 mm".
- **World space is desk pixels** at a fixed logical resolution (e.g. **1920 × 1080**), letterbox-scaled to the window with `devicePixelRatio` for sharpness.
- Each paper has a transform `world = pos + R(angle) · (local − pivotOffset) · pxPerMm`. Convert between spaces through `paper.toLocal(worldPt)` and `paper.toWorld(localPt)`.
- **Ink canvas resolution:** about 4 px/mm (A5 → 592 × 840 px). That's sharp enough and cheap.

---

## 4. Game Loop

- `requestAnimationFrame` → **fixed timestep** update (1/120 s substeps) for stable springs, then render with no interpolation (it isn't needed at these speeds).
- Hit-stop is a global `timeScale` that drops to 0 for ~50 ms on a stamp impact.
- Screen shake is a decaying random offset applied to the whole render transform.

---

## 5. The Physical Feel

### 5.1 Paper dragging (spring for position, towed-trailer rotation)
Each paper is a 2D rigid body. While it's held, two things act on it ([src/core/body.ts](../src/core/body.ts)):

**1. The grab spring (position only).** It pulls the grabbed point to the cursor:
```
r   = R(θ) · g                      // grab point relative to the centre of mass (world)
q   = p + r                         // grab point in world space
v_q = v + ω × r                     // velocity of the grab point
F   = k · (cursor − q) − c · v_q    // spring + damper
v  += (F / m) · dt                  // linear only; no torque
```

**2. Drag alignment (rotation).** Desk friction holds back the centre of mass, so a sheet dragged by one point behaves like a towed trailer. It turns until the vector *centre → grab point* lines up with the pull direction `u` (the smoothed cursor velocity):
```
L       = |r|
falloff = Lᵖ / (Lᵖ + Rᵖ)            // R = softRadius · half-diagonal, p = 4
ω*      = gain · falloff · (r × u) / L²
ω      += (ω* − ω) · (1 − exp(−response · dt))
v      -= Δω × r                    // keep the grab point pinned: the sheet swings around the cursor
```
- With `gain = 1` this is exactly trailer kinematics, `dφ/ds = sin φ / L`. Rotation is **per distance dragged**, not per second, so a sheet held still never turns.
- **Speed limit:** the far edge (the grab point mirrored through the centre, at `−r`) moves at `v_far = u − 2ω × r`. If the sheet spins faster than `(1 − farMinForward)·|u|² / (2·(r × u))`, the far edge swings *backwards* against the pull, which looks wrong. So `ω*` is capped there. With `farMinForward = 0.1` the far edge always creeps forward at about 10% of the pull speed. This cap is what limits rotation when pulling sideways (φ ≈ 90°). At shallow angles `gain` applies.
- **Edge grabs** on an A5 sheet turn about 16° per 200 px of sideways drag, and about 80° over 800 px.
- **Grabs near the centre** barely rotate. The `falloff` term stands in for friction spread over the whole sheet, which a single-point trailer model lacks.
- On release, spin is clamped (`releaseSpinMax`). After that, free sheets decay with `exp(−friction · dt)` and come to rest.
- Tuning knobs are in [src/game/tuning.ts](../src/game/tuning.ts) under `PAPER.grab` and `PAPER.align`.
- **Lift:** while held, draw scale is ×1.03 and the shadow offset/blur grows. Tween back on drop with a tiny settle squash.

### 5.2 Tools (follow springs)
- A held tool follows the cursor with a **critically damped spring**. The stamp gets a low stiffness (heavy and laggy), the pen a high one (light).
- **Stamp slam timeline** (tweens): lift 80 ms → drop 60 ms (ease-in) → **impact** (bake ink, sound, shake, hit-stop) → hold 100 ms → rise 120 ms. The ink is baked at the stamp's **actual** position at impact, not the cursor's.
- The stamp's rotation is a separate value (Q/E or wheel) with a gentle spring, so it turns smoothly.

### 5.3 Picking & z-order
- Papers live in an array where the last item is drawn on top. Hit-test from top to bottom with `pointInPolygon(paper.toLocal(pt), paper.polygon)`.
- The touched paper moves to the end of the array.
- Inbox: only the top paper is interactive. Outbox: only the top paper can be nudged. Papers underneath are frozen (`body.static = true`).

---

## 6. Ink, Cutting & Rendering Papers

### 6.1 Ink baking
`paper.ink` is an `OffscreenCanvas` (or a regular canvas) in paper-mm × 4 px. The printed form (text, boxes, lines) is drawn onto it **once** at spawn. After that:
- **Stamp:** draw the stamp image transformed into paper space. Use `globalCompositeOperation='multiply'` and a noise mask for uneven ink. Add slight random alpha and offset jitter per impression.
- **Pen:** append points and draw a smoothed polyline (quadratic midpoints) with slight width variation.

Each action is **also recorded as data** (`{type:'stamp', pos, angle, stampId}`, `{type:'stroke', points[]}`) for scoring and for the end-of-day report replay.

### 6.2 Cutting
- The paper shape is a **convex polygon** in paper-mm, starting as a rectangle. Straight cuts keep it convex, which keeps the maths simple.
- A cut is an infinite line through the press and release points (in paper space). `splitConvexPolygon(poly, line) → [a, b]`.
- The piece that contains the "keep" marker stays as the document. The other becomes a **new Paper body** that *shares the same ink canvas*, with its own polygon, and gets an impulse plus spin.
- Rendering: `ctx.clip()` to the polygon path, then draw the ink canvas. Draw the cut edge with a slight highlight line.

---

## 7. Scoring Maths (`scoring.ts`, pure functions)

Helper: `grade(err, perfect, fail)` returns 1 if `err ≤ perfect`, 0 if `err ≥ fail`, and is linear in between.

### Stamp
```
posErr   = |stampPos − target|                  (mm)
angleErr = |wrapAngle(stampAngle − targetAngle)| (deg)
score    = grade(posErr, 0.5, 8) * grade(angleErr, 1, 12) * (correctStamp ? 1 : 0)
```

### Cut
Intersect the player's cut line and the target line with the paper's left and right edges (or top and bottom for vertical cuts):
```
e1, e2   = distances between the corresponding intersection points (mm)
angleErr = angle between the lines (deg)
score    = grade(max(e1, e2), 0.5, 6)
```
Report e1 and e2 separately ("left edge 1.5 mm high").

### Circle (pen stroke)
1. **Least-squares circle fit** (Kåsa method: a linear solve for centre `c` and radius `r`).
2. `roundness = RMS(|pᵢ − c| − r) / r`
3. `coverage` = total angle swept around `c`. Must be ≥ ~330°.
4. `closureGap = |p_first − p_last|` relative to `r`.
5. `centreErr = |c − option.centre|`, and a size check of `r` against the option's label box.
6. `selected` = the option whose centre lies inside the circle. If it isn't the correct one, the score is 0.
```
score = grade(roundness, 0.03, 0.25) * grade(centreErr, 1, 6) * closureFactor
```

### Outbox neatness
For each sheet in the pile, take the offset of its centre from the tray centre and its angle error against the tray. Neatness = `grade(maxOffset, 2, 25) * grade(maxAngle, 1, 10)`, blended with the variance between neighbouring sheets. Scraps left on the desk subtract a flat amount each.

> All thresholds live in data/tuning so they can be balanced without touching code.

---

## 8. Document Data Format

`src/data/documents/teaspoon.json`
```json
{
  "id": "teaspoon-application",
  "title": "ЗАЯВЛЕНИЕ / Application for the Allocation of One (1) Teaspoon, Second",
  "size": [148, 210],
  "body": [
    { "type": "text", "at": [12, 30], "text": "I, the undersigned, request a second teaspoon..." },
    { "type": "box",  "at": [95, 170], "size": [40, 30], "dotted": true, "label": "М.П." }
  ],
  "tasks": [
    {
      "type": "circle",
      "id": "q1",
      "options": [
        { "id": "da",  "label": "ДА",  "at": [40, 120] },
        { "id": "net", "label": "НЕТ", "at": [80, 120] }
      ],
      "answer": { "rule": "cutlery-denied", "default": "net" }
    },
    {
      "type": "stamp",
      "stamp": { "rule": "cutlery-denied", "default": "denied" },
      "target": [115, 185],
      "angle": 0
    },
    {
      "type": "cut",
      "from": [0, 150], "to": [148, 150],
      "keep": "top"
    }
  ]
}
```
`days.json` lists, for each day: the document ids (or a random pool), the shift length, the active rules, the tools available, and the Directive memo text.

**Rules** are small named predicates (`"cutlery-denied"`), with the logic in code and the text in the Directive. That keeps the "Papers Please" judgment layer tiny and optional.

---

## 9. Audio
- WebAudio: decode all SFX at boot. `play(name, {pitchVar: 0.06, volVar: 0.1})` so repeated clunks never sound identical.
- Resume the `AudioContext` on the first click (browser autoplay rules). The title screen "Begin shift" button handles this.
- Sources: record your own (a real rubber stamp on a wooden table is perfect) or use CC0 sounds from freesound.org.

---

## 10. Debug Tooling (build early, it pays off)
- **F1 overlay:** draws hidden task targets, polygons, grab points, velocity vectors, and the live score of the paper under the cursor.
- **Tuning panel:** sliders for spring, friction and lag constants (a tiny DOM panel, or `lil-gui` as a dev dependency).
- **Day skip / doc spawn** hotkeys.

---

## 11. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | **Scaffold** | Vite + TS runs, canvas scales to the window, fixed-step loop, desk zones drawn as plain rectangles |
| M1 | **Paper feel** ⭐ | Papers drag with grab-point rotation, slide with friction, lift on grab, z-order works, inbox → desk → outbox. *Spend real time tuning here; this is the game's soul.* |
| M2 | **Stamp** | Pick up and rotate, laggy follow, slam timeline with shake/sound, ink baked, stamp score shown in the debug overlay |
| M3 | **Pen** | Freehand ink strokes, circle fit + scoring |
| M4 | **Knife** | Ruler aim, polygon split, scrap physics, bin, cut score |
| M5 | **Day loop** | Timer, document queue from JSON, outbox neatness, end-of-day report (basic) |
| M6 | **Content & juice** | Real art, fonts, SFX, 8+ documents, 5 days, Directive memos, Inspector report with ruler overlay |
| M7 | **Ship** | `vite build`, zip `dist/`, upload to itch.io as HTML5 |

MVP = M0–M5 with placeholder art. That's a fully playable loop, and everything after it is polish.
