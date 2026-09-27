# Urban Sports Release Checklist

This checklist is the release gate for Chimpions Urban Sports. A release is not approved because the game "looks fine" locally or because one integration job passed. Every applicable gate below must have evidence.

## Release flow

```
feature branch
  -> pull request
  -> FAST
  -> STANDARD
  -> BROWSER
  -> GRAPHICS
  -> PERFORMANCE
  -> preview/staging
  -> release validation + SOAK
  -> main
  -> manual production deployment
  -> production smoke + security headers + MAX graphics audit
```

`render.yaml` keeps `autoDeploy: false`. Merging to `main` must not implicitly publish production.

## Tier definitions

### FAST

Target: fast PR feedback.

Required:
- `npm ci`
- `npm audit --audit-level=high`
- `npm run check:fast`

FAST includes:
- syntax checks for the release-critical renderer and local GLB path
- behavioral fail-open rendering tests
- hostile local GLB container tests
- controller semantic input tests
- menu repeat/no-double-navigation tests
- static Render security/deployment policy guard
- clean-landing exactly-once accounting

### STANDARD

Target: core correctness.

Required:
- `npm run check:standard`
- `npm run build`
- `node checks/assets.mjs`

The existing project checks remain authoritative and include physics, deterministic course generation, collision safety, tricks, skateboard gameplay, manuals, grind, powerslide, Banana Power, UI, touch semantics, audio/haptics, avatar compatibility, graphics/resource invariants, and performance invariants.

Course stress currently includes the existing large deterministic suites:
- `checks/course-invariants.mjs`
- `checks/course-collision-lategame-invariants.mjs`
- `checks/urban-course-grind-invariants.mjs`

They must continue to prove deterministic repeatability, reachable/safe routes, late-game safety, ramp protection, collision integrity, and bounded grind opportunities.

### BROWSER

Target: real Chromium UI/input/runtime behavior.

Required:
- production build served through `vite preview`
- `node checks/desktop-browser.mjs`
- `npm run check:browser`

`check:browser` includes:
- start flow
- avatar selector
- Skateboard selection
- beginning a run
- pause/resume/restart
- local GLB flow
- meaningful WebGL gameplay output, not DOM/HUD-only smoke
- controller A/Cross, B/Circle, Start, D-pad, analog navigation, no double navigation, settings, rider selector, disconnect/reconnect quarantine
- touch steering, jump, trick, Banana Power, pause, pointer cancellation, multi-touch and mobile/orientation layout

### GRAPHICS

Target: WebGL rendering safety and visual/runtime contracts.

Required:
- `npm run check:graphics`
- browser graphics matrix for LOW, MEDIUM, HIGH and MAX
- `npm run audit:graphics-fallback`
- `npm run audit:visual`

Fault injection must prove that gameplay still renders through the direct renderer when an optional path fails for:
- HalfFloat
- framebuffer
- AO
- bloom
- LUT
- volumetric
- GPU timer
- shadow allocation

Where `WEBGL_lose_context` is supported, context loss/restoration must recover to meaningful gameplay rendering.

Controlled screenshot artifacts:
- LOW day
- MEDIUM night
- HIGH rain
- MAX night
- MAX storm

Visual artifacts use fixed viewport, deterministic run seed, fixed weather/quality and reduced motion. Stochastic weather is **not** gated by naive pixel-perfect comparison; runtime contracts and meaningful-frame metrics are the automated gate.

### PERFORMANCE

Target: prevent a benchmark from passing without executing gameplay and enforce resource/frame budgets.

Required:
- `Performance quality profiles / benchmark`
- each required benchmark phase reports `PASS`
- benchmark artifacts exist for HIGH, LOW and MAX
- `scripts/enforce-release-benchmark.mjs` passes

Default release budgets:
- frame P50 <= 35 ms
- frame P95 <= 55 ms
- frame P99 <= 95 ms
- frames over 50 ms <= 12%
- first playable <= 45,000 ms in CI browser
- avatar load P95 <= 12,000 ms
- long-run JS heap growth <= 64 MiB when Chromium exposes precise heap data
- long-run DOM growth <= 120 nodes
- graphics resource counts must remain within the active quality profile budget
- monotonic resource growth detection must pass

The benchmark must fail if gameplay, selector, restart or another required phase never actually executes. `PENDING` is not a release pass for required phases.

### NETWORK / PRODUCTION

Target: validate the deployed artifact, not merely the repository build.

After a manual production deploy:
- `node checks/production-browser.mjs`
- `npm run smoke:production`
- `node checks/production-security-headers.mjs`
- deployed MAX graphics audit

Production smoke must:
- reach actual `mode=playing`
- validate meaningful WebGL canvas output
- verify the selected built-in avatar flow
- verify local GLB remains local-only
- reject invalid/hostile local GLB files
- verify pause/restart and runtime diagnostics
- report runtime/page/network failures

### SOAK

Target: long-running stability. Not recommended as a per-commit branch-protection check because of runtime cost, but required for release-candidate validation.

Run:
- scheduled `Urban Sports SOAK / SOAK`, or
- manual `npm run audit:soak` against the release candidate

SOAK exercises:
- continued course streaming
- repeated restart
- weather changes
- quality changes
- controller disconnect/reconnect
- memory growth
- renderer geometry/texture/object growth
- scoped event-listener growth
- persistent WebAudio loop growth
- final meaningful rendered output

Existing production/browser avatar tests remain the release gate for built-in/local avatar switching.

## Recommended branch-protection required checks

Do not configure these automatically from this branch. Repository administrators should review and set them explicitly.

Recommended required checks for `main`:
1. `Chimpions Urban Sports build and checks / FAST`
2. `Chimpions Urban Sports build and checks / STANDARD`
3. `Chimpions Urban Sports build and checks / BROWSER`
4. `AAA urban graphics regression / static-and-build`
5. all four `AAA urban graphics regression / browser-audit` matrix jobs (low, medium, high, max)
6. `AAA urban graphics regression / GRAPHICS fallback + visual matrix`
7. `Performance quality profiles / benchmark`

Production audit and SOAK are release gates, but are intentionally not recommended as every-PR branch-protection checks.

Also recommended:
- require pull requests before merging
- require branches to be up to date before merge
- dismiss stale approvals after new commits
- block force pushes/deletion on `main`
- no direct workflow push to `main`

## Preview / staging gate

Before merging the release candidate:
- build from the exact candidate SHA
- deploy that exact SHA to an isolated preview/staging target
- run BROWSER, GRAPHICS and PERFORMANCE against that target
- run SOAK against the candidate
- record the candidate SHA and test run URLs in the PR/release record

If no isolated staging/preview target exists, create one before treating the release process as fully hardened. Do not substitute production for staging.

## Production deployment

1. Confirm all required PR checks are green for the exact merge candidate.
2. Confirm release-candidate SOAK is green.
3. Merge through the reviewed PR.
4. Confirm `main` is green.
5. Manually deploy the exact `main` SHA to production.
6. Run production browser, gameplay smoke, security headers and MAX graphics audit.
7. Confirm the production revision equals the intended SHA.
8. If any post-deploy gate fails, stop promotion/traffic changes and roll back to the last known-green production revision.

## Security gate

Required static policy:
- CSP present
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- `frame-ancestors 'none'` plus `X-Frame-Options: DENY`
- no COOP/COEP unless a documented feature requirement is introduced and all external assets are validated under cross-origin isolation

The CSP intentionally permits:
- self-hosted scripts/assets
- inline styles required by current UI styling
- `blob:` for local-only GLB loading
- current Chimpion portrait image origins

Do not broaden CSP sources without a concrete asset requirement.

## Local GLB gate

A local avatar must be rejected before GLTF parsing when any of these are detected:
- invalid GLB magic/version
- declared length mismatch
- file over size limit
- JSON chunk over limit
- malformed JSON chunk
- excessive nodes/textures/container structures
- external buffer/image URI
- pathological animation channel count
- malformed accessor type/component/bufferView references

Local avatar content must never trigger remote asset execution/loading.

## Dependency policy

Current pinned direct dependencies:
- Three.js 0.180.0
- Vite 7.3.5
- Playwright 1.55.1
- Node.js 22.23.2 in CI

Policy:
- keep `package-lock.json` committed
- CI/release uses `npm ci`, never an unlocked `npm install`
- HIGH/CRITICAL npm audit findings block PR/release
- LOW/MODERATE findings are triaged, not silently ignored
- Dependabot opens controlled monthly npm and GitHub Actions updates
- Three.js/Vite/Playwright changes require BROWSER + GRAPHICS + PERFORMANCE before merge
- major updates require an explicit compatibility PR; do not bundle them with unrelated gameplay work

## PR hygiene

Historical integration PRs must be reviewed and closed manually when confirmed superseded. Never mass-close or delete branches automatically.

See `docs/RELEASE_HARDENING_V2.md` for the audited list.

## Release record

Record:
- base/merge candidate SHA
- final `main` SHA
- production revision SHA
- required-check run links
- staging/preview target
- SOAK run
- performance artifact
- visual-regression artifact
- production smoke run
- security-header run
- rollback revision
