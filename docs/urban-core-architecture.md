# Urban Core Architecture v2

This branch moves Chimpions Urban Sports toward Urban/Sports-native ownership without replacing proven gameplay systems.

## Runtime ownership

- **RunController** composes shared run state, RunSession, and GameFlow. It owns lifecycle construction/reset, not per-frame simulation.
- **SportController** owns the active SportDefinition and the temporary legacy ride-mode compatibility mapping.
- **PlayerController / native sport physics** own movement and airborne state.
- **CourseDirector** owns course progress, seed-facing course state, difficulty, and safe-route state.
- **CollisionRuntime** owns broadphase queries and active ramp collision state.
- **BananaPowerSystem** owns Banana Power charge/activation state.
- **PresentationController (current UI/score modules)** owns score/combo presentation-facing state.
- **EnvironmentSystem** owns the shared Urban/alpine-compatibility environment lifecycle.
- **CameraSystem** owns the camera facade while skiCamera remains the compatibility backend.
- **AudioSystem** owns the sport-aware audio facade while createSkiAudio remains the compatibility backend.

The machine-readable field map is in `src/stateOwnership.js`.

## SportDefinition

Every sport is represented by a formal definition with:

- id
- physics
- equipment
- animator
- inputMap
- scoring
- cameraTuning
- audioProfile
- courseProfile
- uiCopy
- displaySpeed
- setupProfiles
- diagnostics

Skateboard is active and native. Inline and BMX are registered as planned contracts only; no Inline/BMX physics are implemented here.

## Persistence

Urban-native keys use:

`chimpions-urban-sports:v1:*`

Legacy `chimpions-ski-*` values are copied only when the Urban key is missing. Migration is idempotent and old values are never deleted. During this compatibility phase, writes are mirrored to legacy keys after the Urban write succeeds.

## Compatibility adapters intentionally retained

- `src/sportMode.js` preserves the previous sport profile API for existing modules/checks.
- `src/systems/cameraSystem.js` wraps `createSkiCamera`.
- `src/systems/audioSystem.js` wraps `createSkiAudio`.
- `src/systems/environmentSystem.js` wraps `createSkiEnvironment` while pairing it with the native Urban environment.
- Legacy `rideMode` / `skiPhysics` remain available because shared speed, jump and compatibility behavior are still authoritative for the shipped skateboard game.

## Deliberately not changed

- Skateboard physics tuning, collision shapes, trick scoring, manuals/grinds, Banana Power behavior.
- Course generation behavior or deterministic seed rules.
- Rendering quality profiles, weather visuals, post-processing policy, asset budgets.
- Audio content/design.
- UI visual design.
- Inline/BMX gameplay.

Those areas should be handled by their dedicated specialists after this architecture branch is integrated.
