# Urban Sports progression/replay foundation

## Persistence

Primary key: `chimpions-urban-sports:progression:v1`.

The store is schema-versioned, keeps at most 40 run-history entries, caps individual replay payloads at 96 KiB, and targets an overall serialized budget below 480 KiB. Storage writes are defensive: corrupted JSON resets to a valid empty schema, quota failures return a failure result instead of breaking startup, and the legacy `chimpions-ski-best` distance is migrated and mirrored for backward compatibility.

Personal record categories are independent: best distance, score, combo, trick, bananas, clean-run duration, plus best-distance run per rider, sport and setup.

## Daily challenges

Daily challenges are offline and deterministic. The UTC date key, challenge version and gameplay version feed a stable seed. Definitions are data-driven and contain `id`, `seedPolicy`, `targetType`, `targetValue`, `allowedSport`, `allowedSetup`, `constraints` and medal thresholds. A weekly generator reuses the same contract but is intentionally not wired into presentation yet.

## Replay format

Replay format v1 stores version headers (`gameVersion`, `physicsVersion`, `courseVersion`), seed/sport/setup/rider metadata, run-length encoded semantic input frames, and sparse state checkpoints. Axis values are quantized to signed 8-bit precision; substep duration is quantized at 1/6000 second resolution. No per-frame transforms are stored.

Recorded semantic inputs include steer, manual/vertical intent, jump press/hold (therefore release), trick intent, airborne trick intent, Banana Power activation, and camera actions. Replays with version mismatches are explicitly incompatible unless an intentional migration is added later.

The deterministic verifier replays the compressed input stream through a supplied authoritative simulation callback and compares distance, position, speed, airborne state, course section, score, collision outcome and crash frame. Default tolerances are 0.02 distance units, 0.025 positional units and 0.02 speed units; logical fields must match exactly.

## Ghost foundation

Only one local ghost is allowed. Modes are last run, best distance and best score. Ghost playback is presentation-only, collision-free, silent and must not influence course generation. The current branch exposes checkpoint-based ghost sampling and selection APIs but does not add a renderer; full in-game ghost rendering should be enabled only after the authoritative browser replay harness proves deterministic parity on production physics/course versions.

## Share codes

`USC1.` share codes contain only validated metadata: seed, sport, setup, challenge version and gameplay version. They do not contain executable content or trusted score claims.

## Future online validation

Do not accept browser-submitted score/distance as authoritative. A future service should accept a validated seed, exact game/physics/course versions and the compressed input stream, reject impossible input sequences or impossible run durations, then replay the run in a trusted validator. Only validator-produced results should enter a leaderboard. Version retirement and explicit replay migrations should be policy decisions, never silent fallbacks.
