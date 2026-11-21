# Game Design Document — *Precisely, Comrade!* (working title)

> A tactile desk game about stamping, cutting and circling Soviet paperwork **exactly right**, because your superior will measure it with a ruler.

---

## 1. Pitch

It is 1983. You are a **Clerk 3rd Class** at the *Regional Directorate of Paper Affairs* (ОБЛБУМУПР). Every morning a stack of forms lands in your inbox. Each one needs a stamp, a cut or a circled answer. You don't have to decide anyone's fate. You just have to do it **perfectly**.

Your superior, **Comrade Inspector V. I. Akkuratov** (from *аккуратный*, "neat"), checks every sheet after you, using a ruler, a protractor and a magnifying glass. A stamp 2 mm off-centre ruins his evening. A crooked outbox pile ruins his week.

Gameplay is close to *Papers, Please*: one desk, one shift, a growing pile of paperwork. The challenge is **physical precision and neatness**, not detective work.

### Pillars
1. **Physical and weighty.** Papers slide and spin, and the stamp lands with a *clunk*. Everything is dragged, nothing is clicked through a menu.
2. **Precision is the game.** Every action can be measured in millimetres and degrees, and the game tells you those numbers.
3. **Silly bureaucratic deadpan.** The absurdity comes from treating trivial things with total seriousness.
4. **Short and readable.** A day lasts a few minutes. Every task is visible on the paper itself.

---

## 2. The Desk (main screen)

Top-down 2D view of a wooden office desk, filling the screen.

```
┌──────────────────────────────────────────────────────────────┐
│   [ STAMP ]   [ KNIFE + RULER ]   [ PEN ]        🕘 09:47    │  ← tool rack
│                                                              │
│  ┌───────┐                                      ┌───────┐    │
│  │ INBOX │        ┌─────────────────┐           │OUTBOX │    │
│  │ ▤▤▤▤▤ │        │                 │           │  ▤▤   │    │
│  │ ▤▤▤▤  │        │   WORK AREA     │           │       │    │
│  └───────┘        │  (paper here)   │           └───────┘    │
│                   │                 │                        │
│  [ DIRECTIVE ]    └─────────────────┘            [ BIN ]     │
│  (today's rules)                                 (scraps)    │
└──────────────────────────────────────────────────────────────┘
```

| Zone | Purpose |
|---|---|
| **Inbox** (left) | Stack of unprocessed documents. Only the top sheet can be grabbed. |
| **Work area** (centre) | Open desk space where you lay a paper flat to work on it. Not a hard slot: papers can sit anywhere on the desk. |
| **Tool rack** (top) | Stamp (with ink pad), knife + steel ruler, fountain pen. |
| **Outbox** (right) | Finished documents go here. The pile's neatness is scored. |
| **Bin** (bottom right) | Cut-off scraps fall or get dragged here. Scraps left on the desk count as untidiness. |
| **Directive** (bottom left) | Today's memo from the Inspector: rules, reminders and passive-aggressive notes. |
| **Wall clock** | Shift time remaining. |

---

## 3. Core Loop

```
Morning memo ─► Take top paper from inbox ─► Lay it on desk
      ▲                                          │
      │                              Read it: what does it need?
      │                                          │
      │                     Pick up tool ─► Apply precisely ─► Put tool back
      │                                          │ (repeat per task)
      │                                          ▼
      │                          Drag finished paper onto outbox (neatly!)
      │                                          │
      └──── End of shift ◄── Clock runs out OR inbox empty
                 │
                 ▼
       Inspector's Report (measured, annotated, judged)
```

**Shift length:** about 3–4 real minutes (09:00–17:00 in game time). Tunable per day.

---

## 4. Interactions (the important part)

### 4.1 Papers
- **Grab** anywhere on a paper to drag it. The paper is pulled *by the point you grabbed*, so:
  - grabbing the **centre** moves it straight;
  - grabbing a **corner** makes it swing and rotate as it trails behind the cursor, like a real sheet.
- A held paper **lifts** a little: it scales up slightly and gets a bigger shadow.
- On release it **slides** and slows to a stop with friction. A quick flick sends it skating.
- **Straightening:** a small rotation sneaks in every time you move a paper. To fix it, nudge it by a corner. *(Open question: also allow a "square it up" key/right-click tap? See §10.)*
- Papers overlap. The one you touched last goes on top.

### 4.2 Tools: general rules
- **Click a tool** on the rack to pick it up. It follows the cursor with weight and lag (the stamp is heaviest).
- **Left mouse** uses the tool. **Right-click** or **clicking the rack** puts it back.
- With a tool in hand you can't move papers. You only have one hand, comrade.
- Every mark is **baked into the paper's own texture**, so it moves and rotates with the sheet forever.

### 4.3 Stamp (печать)
- **Q / E or mouse wheel** rotates the stamp. Its outline is shown as a faint shadow on the paper.
- **Click** to slam: a quick lift, then a heavy drop. *CLUNK*, a small screen shake, a few frames of hit-stop, and a violet ink impression.
- The stamp lags behind the cursor, so you need to **wait for it to settle** before slamming. A rushed slam lands off-target.
- Documents mark where the stamp goes with the real Soviet convention **"М.П."** (*место печати*, "place of the seal"): a dotted box or circle.
- Different stamps later on (ОДОБРЕНО / APPROVED, ОТКАЗАНО / DENIED, ПОЛУЧЕНО / RECEIVED). Choosing the right one follows the Directive.
- *Stretch:* the ink pad. Each impression gets fainter until you re-ink.

### 4.4 Knife + steel ruler (cutting)
- The document shows a **dashed cut line** with a ✂ icon ("линия отреза").
- **Press** to place the knife, **drag** to aim (the ruler swings with you), **release** to cut. The blade travels along the ruler with a satisfying *shhhk*.
- The cut is a **straight line**. The sheet splits into two pieces, and the scrap drops with a little spin.
- Scraps go in the bin. Scraps left on the desk lose neatness points.
- Scored on **angle** and **offset** against the dashed line, reported as "left edge 1.5 mm high, right edge 0.5 mm low".

### 4.5 Pen (circling answers)
- Some forms have multiple-choice fields: ДА / НЕТ (YES / NO), checkbox-style options and so on.
- **Hold and draw** freehand. Pen strokes are baked into the paper as ink.
- Scored on:
  - **correctness:** the right option is circled (the wrong one is a big fail);
  - **roundness:** how close the stroke is to a true circle;
  - **closure:** the loop closes without a gap or a big overshoot;
  - **centring and size:** centred on the answer and not touching the neighbours.
- The Inspector prefers circles to perfect ellipses. Ellipses are "decadent".

### 4.6 Outbox
- Drop the finished paper onto the outbox tray. It stays exactly where and how it landed.
- You can still nudge the **top** paper. Once another paper lands on it, it's committed.
- **Neatness** is measured from how well each sheet lines up with the tray and with the sheets underneath (offset and rotation).

---

## 5. Documents

Each document is data: a title, filler text, and a list of **tasks** with exact targets. Content is silly but delivered deadpan.

Example documents:
- *Application for the Allocation of One (1) Teaspoon, Second*
- *Request to Repaint Corridor 4 from Grey to Slightly Different Grey*
- *Notification of Receipt of Notification No. 4471*
- *Permit to Stand in Queue (Temporary)*
- *Complaint Regarding the Length of the Complaints Queue*
- *Petition to Rename a Cat (Cat Not Present)*
- *Certificate Confirming the Absence of a Certificate*

Example task combinations:
| Document | Tasks |
|---|---|
| Notification of Receipt | Stamp ПОЛУЧЕНО in М.П. box |
| Teaspoon Application | Circle ДА or НЕТ (per Directive), stamp |
| Queue Permit | Cut off the tear-away stub, stamp the stub-less part |
| Corridor Repaint | Circle shade option, cut along line, stamp ОТКАЗАНО |

Every task's location is **printed on the paper**: dotted boxes, dashed lines, answer fields. The only "thinking" is the occasional Directive rule (*"All requests involving cutlery are to be DENIED"*).

---

## 6. Day Structure and Progression

| Day | New element | Directive flavour |
|---|---|---|
| 1 | Stamp only. 5–6 documents. | "Welcome. The stamp goes in the box. *In* the box." |
| 2 | Two stamps (APPROVED / DENIED) chosen by a simple rule | "Yesterday, Clerk, I saw daylight between your pile and the tray." |
| 3 | Knife introduced | "Scissors are for children. You will use the knife." |
| 4 | Pen and circling | "A circle has one centre. *One.*" |
| 5 | Everything mixed, more volume, less time | "The Minister may visit. He may not." |

**Between days:** the Inspector's Report (see §7). Optional later: small upgrades bought with your wages, such as a better stamp handle (less lag), a heavier ruler or a desk lamp.

**Failure (silly):** three bad reports in a row and you are "transferred to the Norilsk branch". Game over screen, then retry.

---

## 7. Scoring

All measurements are in **paper millimetres and degrees**. The game shows these real numbers because that *is* the joke.

### 7.1 Per task → 0–100%
Each error value goes through a tolerance curve: **100% inside a "perfect" zone**, a linear fall-off, and **0% past a "fail" threshold**.

| Task | Measured errors |
|---|---|
| Stamp | centre offset (mm), rotation error (°), wrong stamp type, ink outside M.P. box |
| Cut | offset at each paper edge (mm), angle error (°) |
| Circle | wrong option, roundness (RMS radial deviation / radius), closure gap, centring offset |

Extra penalties: **stray marks** (stamping or inking where nothing was asked), **missing tasks**.

### 7.2 Per document
The average of its task scores, minus penalties. A document with a missing task is capped low.

### 7.3 Per day
| Component | What |
|---|---|
| **Precision** | Average document score |
| **Neatness** | Outbox pile alignment + scraps left on desk |
| **Throughput** | Documents finished / documents in inbox |

These are combined into the **Day Grade** (Soviet school marks *5 / 4 / 3 / 2*, where 5 is best) and your **wage in roubles**.

### 7.4 The Inspector's Report (end-of-day screen)
This is the payoff screen. The Inspector goes over your worst (and best) sheets with a **ruler and protractor overlay**, red-pen annotations ("2.3 mm!!"), and a dry comment. His **eye twitch** gets worse the lower your score.

---

## 8. Tone and Presentation

**Tone:** dry, deadpan, quietly absurd. Nothing is ever *wrong*, only "not in accordance". The Inspector never shouts. He writes memos.

**Visual style: 80s Soviet office**
- Palette: varnished brown wood desk, beige and off-white paper, institutional green and grey walls, **violet stamp ink** (Soviet seals were typically violet or blue), blue-black fountain pen ink, a red pencil for the Inspector.
- Typography: typewriter text on forms, Cyrillic headings with English underneath for readability. Candidate fonts (Cyrillic, OFL licence): **PT Mono / PT Serif / PT Sans**, IBM Plex Mono.
- Props for flavour: tea glass in a metal *podstakannik*, an abacus, a rotary phone that rings and nobody answers, a portrait frame on the wall (outside view, implied).
- Subtle paper grain, slightly uneven stamp ink, worn edges.

**Audio**
- Must have: stamp *CLUNK* (pitch-varied), paper slide/rustle, knife *shhhk*, pen scratch, wall clock tick.
- Ambience: distant typewriters, a radio murmuring a five-year-plan report, a fluorescent light hum.
- End of shift: a factory-style bell.

---

## 9. Scope (jam-sized)

**MVP:** one desk, three tools, about 8 document templates, 3–5 days, an end-of-day report, and the core sounds.

**Out of scope for now:** a story campaign, multiple desks/locations, save files, mobile/touch, localisation beyond EN + Cyrillic flavour.

---

## 10. Open Questions
1. Can the player rotate papers directly (key or right-click tap to square up), or only by corner-nudging? *Corner-nudging only is more "physical" but may frustrate.*
2. Should the stamp lag be a skill element (rushed = sloppy) or purely cosmetic?
3. Knife as a pure straight line (ruler) or freehand with a wobble penalty? *Straight is simpler and recommended for the MVP.*
4. Does the Inspector ever appear on screen (a hand reaching in, a silhouette), or only through memos and the report?
5. Final title. Candidates: *Precisely, Comrade!*, *М.П.*, *Form 7-Б*, *Akkuratov*.
