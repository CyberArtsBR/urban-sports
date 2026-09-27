# Urban Sports Release Hardening V2

Audit date: 2026-09-27

Branch: `test/urban-release-hardening-v2`

Base `main` SHA: `208f15dbb77d7cb5db05d05011d169dac08a4bc1`

## Why this hardening exists

The audited main had recently shipped a black-world failure mode in which HUD/game state could continue while the rendered gameplay world was black. The production-safe main therefore bypassed EffectComposer and rendered directly. A previous final integration step also explicitly skipped extra test/benchmark work.

The hardening treats this as a release-process failure, not only a graphics bug.

## Major changes

### Rendering reliability

- Added `src/renderFailOpen.js`.
- Optional graphics failures are quarantined and the same frame falls back to direct `renderer.render(scene,camera)`.
- Runtime diagnostics expose direct/composed/fallback frame counts, fault count, last fault, context-loss and restore counts.
- Test-only `?test=1&graphicsFault=...` injection supports:
  - half-float
  - framebuffer
  - AO
  - bloom
  - LUT
  - volumetric
  - GPU timer
  - shadow allocation
- Added behavioral `checks/render-fail-open-invariants.mjs`.
- Added real browser `checks/graphics-fallback-browser.mjs`.
- Added `WEBGL_lose_context` loss/restoration test where supported.
- Removed the brittle `main.includes('renderer.render(scene,camera)')` production-path assertion. The important contract is now tested behaviorally.

### Actual rendered-output smoke

`checks/production-smoke.mjs` now samples the visible WebGL canvas and rejects output that is effectively black/transparent/flat. This prevents a DOM/HUD-only smoke test from reporting success while the world is visually absent.

The probe uses downsampled rendered-frame properties (non-black ratio, opacity, luminance range and color diversity), not naive pixel-perfect equality.

### Visual regression evidence

`checks/visual-regression-browser.mjs` captures:
- LOW day
- MEDIUM night
- HIGH rain
- MAX night
- MAX storm

The screenshots are uploaded as CI artifacts. Fixed weather, quality, run seed, viewport and reduced motion improve repeatability while avoiding brittle particle-perfect comparisons.

### Input and flow

Existing behavioral controller checks were retained. They already exercise standard Xbox/PlayStation mappings and a generic mapping fallback, D-pad, analog deadzone/hysteresis, A/Cross, B/Circle, Start, multiple controllers and reconnect quarantine.

New `checks/release-input-browser.mjs` adds real browser coverage for:
- controller start flow
- rider selector
- analog/D-pad navigation
- no immediate double-navigation
- A/Cross and B/Circle
- Start/pause
- settings
- disconnect/reconnect
- touch steer/jump/trick/pause
- pointer cancellation
- multi-touch
- mobile/orientation layout

The audit found no touch control for the existing Banana Power semantic action. Touch now exposes the same existing `special` action through a Banana control; gameplay mechanics were not changed.

### Clean landing regression

The audit found two increments of `cleanLandings` in the same landing path: once from physics landing quality and once from presentation feedback.

The counter is now owned by `src/landingStats.js`. Feedback can add strong-landing presentation stats but cannot count the same clean landing again.

`checks/landing-stats-invariants.mjs` proves exactly-once clean landing accounting.

### Local GLB security

The prior upload path validated basic GLB header/size then passed the container to GLTFLoader. The new preflight parses the embedded JSON chunk before object-URL loading and rejects:
- bad magic/version/length
- oversized file
- oversized or malformed JSON chunk
- excessive nodes/textures/container arrays
- external buffer/image URIs
- excessive animation channels
- malformed accessors

`checks/local-glb-hostile-invariants.mjs` creates hostile synthetic GLBs for these cases. Remote content is forbidden for a local avatar.

### Performance gates

The benchmark already had required phase checks. Hardening adds explicit release budgets and captures avatar-load/frame metrics into benchmark samples.

`scripts/enforce-release-benchmark.mjs` requires real gameplay samples and enforces:
- P50/P95/P99 frame budgets
- >50 ms long-frame ratio
- first playable
- avatar load P95
- graphics resource budgets
- monotonic resource stability
- long-run heap growth when available
- long-run DOM growth

HIGH, LOW and MAX current-branch benchmark artifacts are budget-gated. A job cannot pass solely because a benchmark command returned without entering gameplay.

### SOAK

`checks/release-soak-browser.mjs` exercises continued gameplay streaming, repeated restarts, weather/quality changes and controller reconnect while sampling:
- renderer geometries/textures
- scene/object topology
- DOM nodes
- JS heap where available
- scoped runtime listeners
- persistent WebAudio loops

A final meaningful rendered-frame check is required.

### CI organization

Verification is organized into:
- FAST
- STANDARD
- BROWSER
- GRAPHICS
- PERFORMANCE
- NETWORK / PRODUCTION
- SOAK

CI uses Node.js `22.23.2` and a committed npm lockfile. Relevant validation workflows use `npm ci`.

The old one-time GLB migration workflow previously pushed directly to `main`. It now refuses `main` as a target and publishes only to an explicitly named review branch.

### Deployment policy

`render.yaml` now uses `npm ci && npm run build` and `autoDeploy: false`.

Intended release path:

```
feature -> PR -> CI -> preview/staging -> validation -> main
        -> manual production deploy -> production smoke
```

No deployment is performed by this hardening task.

### Static-site security

Added:
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame protections

COOP/COEP is intentionally not enabled because the game has no demonstrated requirement for cross-origin isolation and currently consumes cross-origin portrait assets.

Static config is guarded by `checks/render-security-invariants.mjs`; deployed headers are checked by `checks/production-security-headers.mjs`.

### Dependencies

Pinned direct versions audited:
- Three.js 0.180.0
- Vite 7.3.5
- Playwright 1.55.1

A pre-hardening CI `npm install` reported one LOW severity npm audit finding. The hardening blocks HIGH/CRITICAL via `npm audit --audit-level=high`, preserves visibility of lower findings, commits a deterministic lockfile and adds monthly Dependabot updates for npm and GitHub Actions.

## Existing deterministic course coverage preserved

The standard suite already includes large deterministic generation/safety coverage. During this audit the existing check run reported:
- `course-invariants`: 12 seeds / 1,440 sections / ~207.9 virtual km
- `course-collision-lategame-invariants`: 32 seeds / 5,120 sections / ~726.8 virtual km

These cover route safety, late-game pressure, collision margins, ramp behavior, repeatability and streaming bounds. Urban grind generation additionally has deterministic grind-target validation.

## Stale/open PR audit

No PR was closed and no branch was deleted.

| PR | Branch | Audit finding | Recommendation |
| --- | --- | --- | --- |
| #10 | `test/urban-sports-regression` | Historical regression branch; current main and this hardening branch contain substantially broader regression coverage. | Manually review for any unique check, then close if none remains. |
| #25 | `feat/final-aaa-max-rendering` -> main | Historical final rendering draft; rendering work was subsequently integrated/evolved and main later required black-screen hotfixes. | Treat as superseded after manual unique-commit review. |
| #27 | `feat/final-native-skate-gameplay` | Main history contains the native skateboard gameplay integration. Branch now diverges from main. | Candidate for manual close as integrated/superseded. |
| #28 | `feat/final-skate-rider-animation` | Main history contains rider animation integration. Branch now diverges. | Candidate for manual close as integrated/superseded. |
| #29 | `feat/final-aaa-max-rendering` | Main history contains the prior MAX rendering integration; subsequent rendering fixes supersede its release state. | Candidate for manual close after unique-commit review. |
| #30 | `feat/final-aaa-city-assets` | Main history contains final urban city asset integration. Branch now diverges. | Candidate for manual close as integrated/superseded. |
| #31 | `feat/final-skate-audio-vfx` | Main history contains skateboard audio/VFX integration. Branch now diverges. | Candidate for manual close as integrated/superseded. |
| #35 | `feat/urban-max-cinematic-rendering` | Current draft rendering work, not treated as historical stale work. | Keep under active review; it must preserve the fail-open rendering contract before integration. |

"Integrated/superseded" here is based on audited main commit history and current branch divergence, not on automatic ancestry closure. Human review should confirm no unique desired commits before closing.

## Branch protection

The repository branch response exposed no active protection/required-status configuration at audit time. The administrative protection endpoint was not available to the connector, and this task deliberately did not mutate protection.

Recommended required checks are defined in `RELEASE_CHECKLIST.md`.

## Remaining process recommendations

- Provision or formally designate an isolated preview/staging environment for the exact candidate SHA. The repo can enforce validation commands, but it cannot create organizational release policy by itself.
- Consider pinning GitHub Actions to immutable commit SHAs in a dedicated supply-chain PR; Dependabot can then maintain those pins.
- Gradually replace remaining source-text contract tests when the same requirement can be observed behaviorally. Source guards remain acceptable for narrow wiring/presentation contracts, but critical renderer/input/release behavior should stay behavioral.
- Keep optional cinematic rendering behind the fail-open controller until representative production hardware coverage proves it safe.
