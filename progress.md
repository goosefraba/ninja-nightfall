Original prompt: Build and iteratively fix a playable Three.js top-down pixel-art ninja-versus-zombies web game using the provided/generated sprite and scenery assets, then validate it in the integrated Browser.

# Progress Log

## Completed

- Restored actor rendering to use the provided source sheets only:
  - `public/assets/source/ninja-sheet.png`
  - `public/assets/source/zombie-sheet.png`
- Removed actor `sourcePadding` from `src/game/assets/GameAssets.ts` so runtime crops no longer sample neighboring atlas cells.
- Tightened actor frame rectangles in `src/game/assets/frames.ts`:
  - ninja idle is a single static frame
  - ninja run frames keep the full body visible
  - ninja attack frames use isolated bottom-row poses
  - zombie walk and brute frames avoid neighboring sprite fragments
- Kept the regular sword attack directional/front-facing by narrowing `arcRadians` in `src/game/NinjaNightfallGame.ts`.
- Kept ultimate damage radial/360 degrees.
- Kept scenery zoomed out with `CAMERA_ZOOM_PADDING = 1.02`.
- Ran an implementation/verification sub-agent loop:
  - fixer removed actor source padding and revised sheet crops
  - verifier identified source padding as the root cause
  - final verifier found no blocking sprite-sheet issue after the manual crop pass

## Validation

- `npm run build` passes.
- `git diff --check` reports no whitespace issues for the edited files.
- Dev server is listening at `http://127.0.0.1:5174/`.
- Added the CC0 OpenGameArt bamboo-stick swish as player attack SFX:
  - source asset: https://opengameart.org/content/swish-bamboo-stick-weapon-swhoshes
  - source file: `swosh-09.flac`
  - runtime assets: `public/assets/sfx/player-attack-swish.ogg` and `public/assets/sfx/player-attack-swish.mp3`
  - source/license notes: `public/assets/sfx/README.md`
- Updated `AudioSystem.playSlash()` to prefer the real swish with combo pitch variation and keep the old synth slash as a fallback.
- Re-ran `npm run build`; it passes.
- Changed music to be enabled by default. The UI now starts with `Music On`, and the `Asianoriental1` loop starts on the first user gesture because browser autoplay policy still requires interaction.
- Verified on `http://localhost:5174/`:
  - initial debug state reports `musicEnabled=true`
  - menu and HUD music buttons initially read `Music On`
  - pressing `Start Run` starts the `~103.368s` music buffer
  - the music asset returns HTTP 200 as `audio/ogg`
  - toggling the HUD music button turns music off and updates state/text
  - no console/page errors were reported
- Added mobile-only touch controls:
  - left D-pad maps to `KeyW`, `KeyA`, `KeyS`, `KeyD`
  - right-side action buttons map to `Space`, `KeyR`, and `KeyH`
  - controls are hidden on desktop, the main menu, loading, death, and while help/pause is open
- Verified touch controls on a mobile viewport:
  - desktop visibility is false
  - mobile menu/help visibility is false
  - after closing the first help overlay, mobile controls are visible
  - holding right moves `playerX` from `0` to `2.92`
  - tapping attack twice advances combo to `1`
  - tapping ultimate sets cooldown to `~15s`
  - tapping help opens pause/help with `paused=true`
  - no console/page errors were reported
- Captured and inspected `output/web-game-touch-controls/mobile-touch-controls-visible.png`; touch controls fit a 390px mobile viewport without blocking gameplay-critical UI.
- Ran the web-game Playwright client after the touch-control change and inspected `output/web-game-touch-controls-client/shot-0.png`.
- Re-ran `npm run build`; it passes.
- Ran the web-game Playwright client against `http://127.0.0.1:5174/` with start + Space attack input; screenshots were generated in `output/web-game-sfx/`.
- Verified via Playwright network capture that `/assets/sfx/player-attack-swish.ogg` returns HTTP 200 and no console/page errors occur during start + attack.
- Added zombie-contact damage SFX from the CC0 "37 hits/punches" pack:
  - source files: `hit09.mp3.flac` and `hit10.mp3.flac`
  - runtime assets: `public/assets/sfx/player-hurt-impact-1.ogg`, `public/assets/sfx/player-hurt-impact-1.mp3`, `public/assets/sfx/player-hurt-impact-2.ogg`, `public/assets/sfx/player-hurt-impact-2.mp3`
- Added ultimate SFX from the CC0 "Magic Spell SFX" pack:
  - source file: `magical_7.ogg`
  - runtime assets: `public/assets/sfx/player-ultimate-burst.ogg` and `public/assets/sfx/player-ultimate-burst.mp3`
- Refactored `AudioSystem` to preload named SFX groups and play randomized variants through one buffered-audio path with synth fallbacks.
- Re-ran `npm run build`; it passes.
- Verified live asset serving on `http://localhost:5174/`:
  - hurt impact `.ogg` assets return HTTP 200 as `audio/ogg`
  - ultimate `.ogg` asset returns HTTP 200 as `audio/ogg`
- Verified event-level playback in browser automation:
  - pressing `R` starts the ultimate buffered SFX (`~1.184s`)
  - a real zombie contact drops health to 91 and starts the hurt buffered SFX (`~0.464s`)
  - no console/page errors were reported.
- Replaced the ultimate SFX with a more swoosh-like weapon sound:
  - source file: `swosh-28.flac` from "Swish - bamboo stick weapon swhoshes"
  - runtime assets: `public/assets/sfx/player-ultimate-swoosh.ogg` and `public/assets/sfx/player-ultimate-swoosh.mp3`
  - removed the prior `player-ultimate-burst` assets
- Added player-on-zombie hit impact SFX:
  - source files: `hit12.mp3.flac` and `hit25.mp3.flac` from "37 hits/punches"
  - runtime assets: `public/assets/sfx/zombie-hit-impact-1.ogg`, `public/assets/sfx/zombie-hit-impact-1.mp3`, `public/assets/sfx/zombie-hit-impact-2.ogg`, `public/assets/sfx/zombie-hit-impact-2.mp3`
- Updated `AudioSystem.playHit()` to use the real zombie-hit impact variants with a short cooldown to avoid stacked noise on multi-hit frames.
- Verified `npm run build` passes after the audio changes.
- Verified on `http://localhost:5174/`:
  - `player-ultimate-swoosh.ogg`, `zombie-hit-impact-1.ogg`, and `zombie-hit-impact-2.ogg` return HTTP 200 as `audio/ogg`
  - pressing `R` starts the new ultimate swoosh buffer (`~1.324s`)
  - a normal sword attack on a zombie starts the new zombie-hit buffer (`~0.302s`) and the run state reached 1 kill
  - no console/page errors were reported
- Ran the web-game Playwright client after the change and inspected the latest screenshot in `output/web-game-sfx-swoosh-hit/`; gameplay visuals remain intact.
- Added the CC0 `Asianoriental1` background music:
  - source: https://opengameart.org/content/asianoriental1
  - author: Tozan
  - runtime assets: `public/assets/music/asianoriental1.ogg` and `public/assets/music/asianoriental1.mp3`
  - source/license notes: `public/assets/music/README.md`
- Replaced the old synth music with looped buffered playback through `AudioSystem`, with a dedicated music volume level.
- Added main-menu music controls:
  - `#menu-music-toggle`
  - `#menu-music-volume`
  - `#menu-music-volume-value`
- Added two more zombie-hit variants:
  - `zombie-hit-impact-3.ogg/.mp3`
  - `zombie-hit-impact-4.ogg/.mp3`
- Verified `npm run build` passes after the music/menu/hit-variety changes.
- Verified live audio behavior on `http://localhost:5174/`:
  - `asianoriental1.ogg`, `zombie-hit-impact-3.ogg`, and `zombie-hit-impact-4.ogg` return HTTP 200 as `audio/ogg`
  - main-menu music toggle starts a `~103.368s` looped music buffer
  - main-menu volume set to 22% updates debug state and the visible menu volume text
  - a normal sword hit on a zombie starts a zombie-hit impact buffer (`~0.348s`)
  - no console/page errors were reported
- Captured and inspected menu screenshots in `output/web-game-music-menu/`; the new controls fit the menu panel.
- Ran the web-game Playwright client and inspected `output/web-game-music-audio/shot-1.png`; gameplay visuals remain intact.
- Added a pause-backed help menu:
  - main menu `Help` button
  - HUD `Help` button
  - `H` / `P` toggles help and pause
  - `Esc` / `Enter` resumes from help
  - the help overlay lists WASD, Space, R, H/P, Esc, and Enter shortcuts
- The help menu is shown automatically the first time a run starts.
- Verified pause behavior in Playwright:
  - after first `Start Run`, help is open, `paused=true`, and `phaseTimer=4`
  - after 1.2s with help open, `phaseTimer` remains `4`
  - after closing help, `phaseTimer` resumes ticking down
  - pressing `H` opens help again and freezes `phaseTimer`
  - pressing `Escape` closes help
  - no console/page errors were reported
- Ran the web-game Playwright client and inspected `output/web-game-help-menu/shot-0.png`; the help overlay is visually correct on desktop.
- Captured and inspected `output/web-game-help-menu/mobile-help.png`; the help overlay fits on a 390px mobile viewport.
- Re-ran `npm run build`; it passes.

## Final Validation

- Added a `typecheck` script so validation matches the companion hobby project workflow.
- Added project README documentation with commands, gameplay controls, asset notes, and current validation status.
- Expanded `.gitignore` to keep `.vercel`, `node_modules/`, `dist/`, `output/`, and `.DS_Store` out of source control.
- Re-ran `npm run build`; it passes. Vite still reports the existing large bundle warning because the game ships as one browser bundle.
- Re-ran `npm audit --omit=dev --audit-level=moderate`; it reports zero vulnerabilities.
- Completed integrated Browser validation at `http://127.0.0.1:5174/`:
  - menu loaded with `musicEnabled=true`
  - first `Start Run` opened the pause-backed help overlay
  - dismissing help resumed the run
  - keyboard movement changed player position
  - `Space` advanced the sword combo state
  - `R` triggered the ultimate cooldown
  - `H` reopened help and paused the run
  - `Esc` resumed from help
  - the run reached active wave spawning with visible zombie count in debug state
- Re-inspected existing visual evidence:
  - `output/web-game-help-menu/shot-0.png` shows the desktop help overlay fitting the playfield.
  - `output/web-game-touch-controls/mobile-touch-controls-visible.png` shows the 390px mobile touch controls fitting under the HUD without blocking the player.

## Blocker

- None currently.

## Current Turn - iPad Joystick Controls

- Replaced the mobile four-button D-pad with a left analog joystick control:
  - `index.html` now renders `#touch-joystick` with a movable stick element.
  - `InputController` tracks a touch joystick vector, directional key compatibility, dead zone, clamped stick travel, and source-aware key/button presses.
  - player movement now uses keyboard plus joystick vectors with analog strength.
- Replaced the right-side touch actions with two round buttons:
  - `ATK` maps to `Space`
  - `ULT` maps to `KeyR`
- Expanded the touch-control media query so the iPad-sized Browser viewport can show and validate the tablet layout.
- Added hidden debug-state `attacking` so Browser validation can prove the transient attack button state.
- Validation completed:
  - `npm run typecheck` passes.
  - `npm run build` passes; Vite still reports the existing single-bundle size warning.
  - `git diff --check` passes.
  - Web-game client run against `http://127.0.0.1:5174/` produced screenshots in `output/web-game-joystick-client/` with no console error artifacts.
  - Integrated Browser iPad viewport check at 1024x768:
    - touch controls displayed as `flex`
    - joystick rendered at 170px with the stick visible
    - attack and ultimate buttons both reported `border-radius: 50%`
    - joystick drag moved `playerX` from `0` to `0.59`
    - attack tap produced `attacking=true`
    - ultimate tap set cooldown to about `14.99s`
  - Captured Browser screenshot: `output/browser-ipad-controls.png`.

## Current Turn - iPad Audio And Zoom Fixes

- Improved iPad/Safari audio startup:
  - audio unlock now retries on each real interaction instead of only the first gesture
  - WebAudio output is primed after resume to make iOS audio start more reliably
  - audio assets are loaded in browser-supported format order so Safari can prefer MP3 before unsupported formats
  - music volume is slightly louder while preserving the existing menu volume controls
- Added hidden audio debug state for Browser validation:
  - audio context state
  - music loaded state
  - music playing state
- Prevented fast attack taps from zooming the page:
  - locked the mobile viewport scale
  - disabled browser touch gestures on the game surface and touch controls
  - guarded touch end, double-click, and Safari gesture events around the touch controls
- Validation completed:
  - `npm run typecheck` passes.
  - `npm run build` passes; Vite still reports the existing single-bundle size warning.
  - `git diff --check` passes.
  - Integrated Browser iPad viewport check at 1024x768 confirmed music was loaded and playing with the audio context running after interaction.
  - Rapid attack tapping kept `visualViewport.scale` at `1`, confirming the page did not zoom.
  - The web-game smoke client passed against `http://127.0.0.1:5174/`.

## Current Turn - iPad Visible-Area Layout Fix

- Adjusted the app shell to use dynamic viewport height where supported so iPad Safari lays the game out against the visible area instead of the larger layout viewport.
- Reduced tablet touch-control and HUD sizing:
  - joystick max size lowered from 170px to 150px
  - attack and ultimate buttons lowered to 96px and 82px max
  - top HUD buttons and stats are more compact on coarse/tablet viewports
- Added safe-area-aware tablet HUD insets so the top-right Help/Music buttons keep breathing room from the edge.
- Browser validation at 1024x768 confirmed:
  - joystick bounds are fully visible
  - attack and ultimate buttons are fully visible
  - top-right HUD buttons are fully visible
  - `visualViewport.scale` remains `1`
