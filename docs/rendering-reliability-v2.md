# Urban Sports Rendering Reliability v2

## Scope

This branch starts from production-safe main `208f15dbb77d7cb5db05d05011d169dac08a4bc1` and reuses the MAX CINEMATIC implementation inspected at PR #35 head `a1246ee6792b8495dd9a63a4417fd0db6bf3740f`.

The invariant is simple: premium rendering is additive. Direct `WebGLRenderer.render(scene,camera)` remains the universal presentation path whenever optional composition is unavailable, fails initialization, produces invalid output, hits a critical GL error, or is recovering from context loss.

## Runtime capability probes

`src/renderCapabilities.js` performs runtime tests rather than user-agent detection.

It records:

- WebGL2 capability
- relevant extensions
- actual framebuffer completeness for UnsignedByte, HalfFloat nearest, HalfFloat linear, Float nearest, and depth-texture targets
- MAX_TEXTURE_SIZE
- MAX_RENDERBUFFER_SIZE
- MAX_SAMPLES
- maximum anisotropy
- vertex/fragment precision
- GPU timer-query support
- context-lost state

A supported extension alone is not treated as proof that a render-target combination works.

## Quality tiers

| Tier | Presentation | Resolution | Shadows | Premium post |
| --- | --- | --- | --- | --- |
| LOW | direct renderer | DPR cap 0.90 | contact grounding | none |
| MEDIUM / BALANCED | direct renderer | DPR cap 1.15 | contact grounding | none |
| HIGH | direct renderer | DPR cap 1.50 | budgeted 1024 directional | none |
| MAX | direct renderer | DPR cap 2.00 | budgeted 2048 directional | none |
| MAX CINEMATIC | composer when verified, direct fallback otherwise | DPR cap 1.60 | contact shadow | capability-gated GTAO, bloom, LUT, sharpen, atmosphere/light shafts; presentation-only DOF |

AUTO uses HIGH / MEDIUM / LOW only. It never promotes into MAX or MAX CINEMATIC. Adaptive resolution changes independently of profile transitions and uses hysteresis/cooldowns.

## Fallback matrix

| Failure | Runtime response |
| --- | --- |
| HalfFloat framebuffer fails | compatible UnsignedByte target |
| HalfFloat linear filtering fails | HalfFloat nearest may support basic composition; GTAO/bloom remain disabled |
| Depth texture fails | GTAO and dependent volumetrics disabled |
| GTAO construction/runtime failure | GTAO disabled |
| Bloom construction/runtime failure | bloom disabled |
| LUT failure | LUT disabled |
| Volumetric failure | atmosphere/light shafts disabled |
| Sharpen/DOF failure | only that pass disabled |
| Composer target unavailable | direct renderer |
| Critical framebuffer/out-of-memory GL error | same-frame direct renderer plus conservative degradation |
| Near-black/invalid composer output | same-frame direct renderer; HalfFloat first degrades to byte target, then optional passes, then composition is disabled if necessary |
| WebGL context lost | composition stops; browser context restoration is allowed |
| Context restored | capability reprobe, two direct frames first, conservative byte target rebuild |

No optional effect is allowed to stop gameplay state or require a page reload.

## Shadow budget

Realtime shadow maps are reserved for gameplay-relevant objects such as rider/skateboard, nearby obstacles, street props, and important vehicles. Instanced skyline buildings are explicitly excluded from directional shadow casting. MAX CINEMATIC uses contact grounding instead of a city-scale shadow map.

## Road and city lighting

The reused Urban rendering work already provides:

- procedural multi-frequency asphalt color/roughness/bump detail
- cracks and repairs
- skid marks
- damp patches and localized puddles
- drain covers and grime
- restrained wet-response values rather than mirror-like global asphalt
- emissive windows, building LED accents, streetlight bulbs, and fake light pools
- quality-scaled real street lights with shadow casting disabled
- anisotropy capped by actual renderer capability

## Color pipeline

- renderer output: sRGB
- renderer tone mapping: ACES Filmic
- offscreen composer color targets: NoColorSpace
- final OutputPass owns tone-map/output conversion for composed frames
- LUT operates before OutputPass
- direct rendering uses the same renderer tone mapping/output color-space settings

This avoids applying output conversion twice.

## Telemetry

Diagnostics expose:

- CPU frame timing P50/P95/P99
- GPU frame timing average/P50/P95/P99/max where timer queries exist
- direct-render CPU timing
- shadow-map CPU timing
- per-post-pass CPU timing
- draw calls, triangles, textures, geometries, materials, lights, instances
- estimated render-target memory
- active render path
- feature failures/degradations
- context-loss/restoration counts

## GPU capability simulations

Automated capability envelopes are provided for:

- Intel integrated GPU
- AMD desktop GPU
- NVIDIA desktop GPU
- Apple Silicon
- Adreno mobile
- Mali mobile

These simulations validate decision logic only. They do **not** emulate vendor shader compilers, driver bugs, tile-memory pressure, thermals, browser GPU-process behavior, device bandwidth, real framebuffer quirks, or OS compositor behavior.

## Browser coverage

CI contains:

- full Chromium/SwiftShader graphics regression
- forced render-target failure
- forced black-output recovery
- forced optional shader/pass failures
- `WEBGL_lose_context` restoration where supported
- lightweight Chromium, Firefox and Playwright WebKit engine smoke

Chromium provides engine-level coverage relevant to Chrome and Edge, but Microsoft Edge itself remains a physical/browser installation test. Playwright WebKit is useful engine coverage but is not a substitute for Safari on macOS/iOS.

## Physical-device release gate

MAX CINEMATIC should remain manual and outside AUTO until it passes representative physical tests on:

- Intel integrated Windows laptop: Chrome, Edge, Firefox
- AMD Windows desktop/laptop: Chrome/Edge/Firefox
- NVIDIA Windows desktop/laptop: Chrome/Edge/Firefox
- Apple Silicon macOS: Safari, Chrome, Firefox
- recent Adreno Android device: Chrome
- recent Mali Android device: Chrome
- context loss/background-resume/fullscreen/resize paths on those devices

The direct renderer tiers remain the production safety baseline.
