# Urban UI & Accessibility v2

Repository: `CyberArtsBR/urban-sports`

Branch: `feat/urban-ui-accessibility-v2`

Base: `208f15dbb77d7cb5db05d05011d169dac08a4bc1`

Resumed head: `1e828c4031d2744c01f6b7a46133ec86730cde7b`

PR: https://github.com/CyberArtsBR/urban-sports/pull/38

The feature branch starts from the current main base above. No merge or deployment is part of this work. Physics, collision, procedural difficulty, deterministic seed generation, and avatar transport are preserved relative to that base.

## Interface and input

- The avatar selector creates Urban markup directly. Legacy Choose Ride, SKI/SNOWBOARD cards, and the misleading speed/setup presentation are removed. Internal compatibility identifiers remain where gameplay still uses them.
- Skateboard is playable. Inline and BMX are labeled future sports and are not interactive focus targets.
- `urbanUiContract.js` accepts gameplay-owned setup profiles. With no real profiles supplied, selecting a rider starts the run without a fake STREET/PARK decision. The UI contains no new physics parameters.
- Keyboard and controller menus share semantic navigation and repeat handling. Start receives default focus; D-pad and analog movement are normalized before menu dispatch.
- Pause offers Resume, Restart, Settings and Leave. Results prioritize distance, score and bananas, with secondary and tertiary statistics below.
- Settings groups Gameplay, Controls, Camera, Graphics, Audio and Accessibility. Modal menus trap Tab and restore focus after closing nested dialogs. The native rider dialog handles browser modal focus.
- Controller disconnection/reconnection uses a polite status announcement. Input retains reconnect guards and existing controller button defaults.
- `actionMap.js` centralizes gameplay bindings and provides a programmatic remapping contract.

## Accessibility, touch and localization

- Persisted UI scale, high contrast, reduced motion, reduced VFX, reduced flashes, camera shake amount, controller deadzone, steering sensitivity, haptics intensity and caption preference.
- CSS retains system `prefers-reduced-motion`; explicit reduced motion suppresses menu animations. High contrast strengthens focus outlines, HUD readability, and disabled-sport shapes/text.
- Camera choices: Chase, Fixed, High + Far, First Person; Full, Reduced and Fixed motion, with independent shake amount.
- Touch controls include Banana Power, jump/tricks, steering and pause, larger targets, opacity feedback, landscape guidance and safe-area spacing. Gesture suppression is scoped to active gameplay.
- Main interface resources cover `en-US` and `pt-BR`, with English and caller-provided fallback. Menus/results/settings use translation attributes; significant selector and touch text uses the shared dictionary.
- HUD text updates avoid rewriting unchanged distance/speed/banana values. Rapid HUD values are not live-announced.
- Local GLB validation, session-local object URLs and no-upload behavior remain intact.

## Continuation fixes

The benchmark previously completed rider selection only after the artwork Start button. Its selector/search phases close that artwork and leave the menu Start button active. That button can reopen rider selection, so the benchmark stalled in the selector for every quality tier and even the unchanged baseline. The harness now follows the actual selector/tutorial/countdown state after either Start entry.

The MAX graphics audit expected SSAO even though the base already uses direct rendering to fix black screens. Its assertion now preserves that production contract while still enforcing MAX shadows, resolution, anisotropy, resource budgets and restart stability. Rendering behavior is unchanged.

Benchmark summaries now include reasons for non-passing phases, so CI logs identify the failed transition rather than only reporting PENDING.

## Verification

- `npm run check`: static, core, input, UI, accessibility, localization, touch, physics, visual, performance and graphics invariants.
- `npm run build` and `node checks/assets.mjs`.
- `node checks/desktop-browser.mjs`: keyboard, responsive layouts, settings/focus restoration and touch lifecycle.
- `node checks/urban-ui-accessibility-browser.mjs`: production controller adapter with queued gamepad samples; Start, selector cancel/reopen, D-pad plus stick deduplication, analog input, pause/restart/settings/leave, Tab trap, focus restoration, disconnect/reconnect, contrast, reduced motion and language switching. Results navigation uses the production UI's public `showResults` contract in a separate browser component fixture, without a renderer or forced collision. No gameplay state is patched.
- `npm run smoke:production` with the local preview: built-in and local GLB flows, resource and upload checks.
- `npm run audit:graphics` for LOW/MEDIUM/HIGH/MAX in CI.
- `node scripts/benchmark-ski-runtime.mjs` for baseline and LOW/HIGH/MAX in CI. Every required gameplay phase must PASS; optional legacy Ski/Snowboard comparison phases may remain PENDING because those controls are intentionally absent in Urban v2.

The short local benchmark is a transition regression check, not a hardware performance certification. CI retains the longer configured sample windows and comparison artifacts.

## Known limits

- Gamepads are emulated at the browser Gamepad API boundary. Physical Xbox/PlayStation hardware, rumble strength, mobile Safari and assistive-technology user testing still require manual device checks.
- Remapping has a data-driven interface; there is no end-user remapping editor or complete hold/toggle customization UI yet.
- Captions expose persisted preference/hooks; there is no complete caption event/subtitle track system.
- Reduced VFX/flashes currently target presentation CSS. They do not provide a comprehensive reduction of every 3D effect or world hazard. World hazard accessibility needs dedicated visual/device validation.
- Localization intentionally covers the main interface, not every tutorial, HUD callout, validation error or text baked into artwork. Some initially rendered labels require reload after changing language.
- No real STREET/PARK profile is exposed until gameplay supplies that contract. Inline/BMX remain unavailable.
- The optional ten-minute runtime probe is not supplied by `npm run check`; static long-run invariants and the bounded CI benchmark are separate evidence.

## Changed implementation files

`src/actionMap.js`, `src/avatar-system.js`, `src/controlCopy.js`, `src/floatingUI.css`, `src/gameplayInput.js`, `src/haptics.js`, `src/input.js`, `src/localization.js`, `src/main.js`, `src/menuNavigation.js`, `src/skiCamera.js`, `src/startScreen.js`, `src/style.css`, `src/touchControls.js`, `src/ui.js`, `src/uiAccessibility.js`, `src/urbanUiContract.js`, `src/userPreferences.js`.

Regression/configuration files: `checks/aaa-urban-graphics-browser.mjs`, `checks/desktop-browser.mjs`, `checks/input-collision-invariants.mjs`, `checks/input-invariants.mjs`, `checks/leave-backflip-lift-invariants.mjs`, `checks/production-smoke.mjs`, `checks/rider-selector-invariants.mjs`, `checks/touch-settings-invariants.mjs`, `checks/urban-ui-accessibility-v2-invariants.mjs`, `checks/urban-ui-accessibility-browser.mjs`, `scripts/benchmark/gameplay.mjs`, `scripts/benchmark-ski-runtime.mjs`, `package.json`, `.github/workflows/check.yml`, and this report.
