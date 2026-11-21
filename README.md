# Precisely, Comrade! *(working title)*

A small, silly, tactile desk game. You're a clerk in an 80s Soviet administration bureau. You stamp, cut and circle documents **exactly** right, because your superior, Comrade Inspector Akkuratov, will measure every millimetre.

- **Genre:** desk sim / precision toy (in the spirit of *Papers, Please*, but the stakes are neatness)
- **Platform:** web browser (HTML5), mouse
- **Stack:** TypeScript + Vite + Canvas 2D

## Docs
- [Game Design Document](docs/GDD.md): concept, interactions, scoring, tone, scope
- [Technical Approach](docs/TECH.md): stack choice, architecture, physics/scoring maths, data format, milestones

## Running
```bash
npm install
npm run dev        # http://localhost:5173, hot reload
npm run build      # typecheck + static build in dist/ (itch.io-ready)
```

**Controls:** drag papers and the stamps with the mouse · click a stamp's knob to slam it (inks any sheet under its face) · click a tool (knife/pen) to pick it up · left-click uses it (placeholder press for now) · right-click / Esc / click the rack to put it back · **R** reset desk · **F1** debug overlay.

## Code map
| Path | What |
|---|---|
| [src/main.ts](src/main.ts) | Canvas setup, letterboxed 1920×1080 view, input wiring, fixed-step loop |
| [src/game/tuning.ts](src/game/tuning.ts) | **All feel constants**: paper spring/friction, tool lag/sway, lift |
| [src/game/world.ts](src/game/world.ts) | Game state + interaction rules (grab, z-order, inbox/outbox, tools) |
| [src/game/deskObject.ts](src/game/deskObject.ts) | Shared drag physics for anything on the desk (papers, stamp) |
| [src/game/paper.ts](src/game/paper.ts) | Paper: shape in paper-mm, mm↔world transforms, inbox/outbox zone |
| [src/game/stamp.ts](src/game/stamp.ts) | Stamps (ПРИЕТО yes / ОТКАЗ no): sprite-based, pixel-accurate hit test, knob click → slam, face position |
| [src/render/ink.ts](src/render/ink.ts) | Bakes a stamp mark into the sheets under the face (multiply, speckle, occluded by sheets on top) and records it in `paper.marks` |
| [src/game/tool.ts](src/game/tool.ts) | Tools: spring-follow, sway, hit areas |
| [src/game/desk.ts](src/game/desk.ts) | Desk layout rects and tool rack slots |
| [src/core/](src/core/) | Vector maths, rigid body + grab spring, damped springs, polygon helpers |
| [src/render/](src/render/) | Rendering: asset loading, desk, paper texture, tool shapes, debug overlay |
| [assets/](assets/) | Pixel art (exported at 4× ; drawn at `ART_PX` world px per art pixel, see tuning.ts) |

## Status
- [x] M0 scaffold
- [x] M1 paper feel (first pass): grab-point rotation, slide/flick, lift, inbox/outbox stacking
- [x] Tool pick-up / follow / put-back (no tool actions yet)
- [x] First real art: tiled wood desk, Commodore-style stamp (drag + knob-click slam)
- [x] Two stamps (yes/no) with ink baked onto paper; rectangular М.П. stamp field on every form
- [ ] M2 stamp: scoring against the field, aiming aids, sound
