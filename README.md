# Ninja Nightfall

A compact Three.js wave-defense game built with Vite and TypeScript. The game opens directly into a playable top-down arena where a pixel-art ninja survives escalating zombie waves with movement, sword combos, a radial ultimate, pause/help controls, music, SFX, and mobile touch controls.

## Deployment

Production: https://ninja-nightfall.vercel.app

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

The development server runs on `http://127.0.0.1:5173/` by default. Use `npm run dev -- --port 5174` if another local Vite app is already using the default port.

## Gameplay

- `WASD` moves the ninja through the arena.
- `Space` triggers directional sword combo attacks.
- `R` triggers the ultimate attack when it is ready.
- `H` or `P` opens the pause-backed help overlay.
- `Esc` resumes from help.
- Mobile viewports get a left joystick plus round attack and ultimate buttons after the first-run help overlay is dismissed.

## Assets

The actor and scenery artwork is project-local:

- `public/assets/source/ninja-sheet.png`
- `public/assets/source/zombie-sheet.png`
- `public/assets/source/approved-combat-night.png`
- `public/assets/source/approved-bridge-ultimate.png`
- `public/assets/source/environment-vfx-sheet.png`
- `public/assets/generated/arena-scenery.png`

Audio assets are stored under `public/assets/sfx/` and `public/assets/music/`. Source and license notes are kept beside those files in their local README files.

## Validation

Current validation status:

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm audit --omit=dev --audit-level=moderate` reports zero vulnerabilities.
- Browser validation covered menu load, first-run help/pause, movement, sword combo, ultimate cooldown, help toggle/resume, music-on state, and live wave spawning at `http://127.0.0.1:5174/`.
- Mobile viewport evidence in `output/web-game-touch-controls/mobile-touch-controls-visible.png` shows the touch controls fitting a 390px-wide gameplay viewport without blocking the core HUD.
