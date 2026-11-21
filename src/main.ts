import type { Vec2 } from './core/vec.ts';
import { STEP, WORLD_H, WORLD_W } from './game/tuning.ts';
import { World } from './game/world.ts';
import { type Assets, loadAssets } from './render/assets.ts';
import { Renderer } from './render/draw.ts';
import { COLORS } from './render/palette.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

/** Letterboxed mapping from the fixed 1920x1080 world to the window. */
const view = { scale: 1, offX: 0, offY: 0, dpr: 1 };

function resize(): void {
  view.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * view.dpr);
  canvas.height = Math.round(window.innerHeight * view.dpr);
  view.scale = Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H);
  view.offX = (canvas.width - WORLD_W * view.scale) / 2;
  view.offY = (canvas.height - WORLD_H * view.scale) / 2;
}
window.addEventListener('resize', resize);
resize();

function toWorld(e: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * view.dpr - view.offX) / view.scale,
    y: ((e.clientY - rect.top) * view.dpr - view.offY) / view.scale,
  };
}

loadAssets().then(start, (err) => {
  console.error(err);
  document.body.textContent = String(err);
});

function start(assets: Assets): void {
  const world = new World(assets);
  // Exposed for poking at from the browser console / automated checks.
  (window as unknown as { world: World }).world = world;
  const renderer = new Renderer(ctx, assets);

  // -------------------------------------------------------------- input

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    world.pointerDown(toWorld(e), e.button);
  });
  canvas.addEventListener('pointermove', (e) => world.pointerMove(toWorld(e)));
  canvas.addEventListener('pointerup', (e) => world.pointerUp(toWorld(e), e.button));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') e.preventDefault();
    world.keyDown(e.key);
  });

  // -------------------------------------------------------------- loop

  let last = performance.now();
  let acc = 0;
  let fps = 60;

  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;

    acc += dt;
    while (acc >= STEP) {
      world.update(STEP);
      acc -= STEP;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.offX, view.offY);
    renderer.render(world, view.scale, fps);

    canvas.style.cursor = world.cursor();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
