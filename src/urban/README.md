# Urban environment module

This folder is intentionally independent from rider physics, sport handling and the current ski gameplay integration.

`createUrbanEnvironment()` builds a recyclable Three.js environment group composed of reusable factories for:

- asphalt road and sidewalks
- lane/center markings
- emissive-mesh streetlights (no per-lamp realtime lights)
- instanced building skyline and lit facade panels
- large traffic cones
- roadside barriers and signs
- bollards, planters, shrubs and utility boxes

All repeating props use shared geometries/materials and `InstancedMesh`. The environment exposes `update(dt, worldSpeed)`, `reset()`, `setQualityProfile(profileOrSettings)`, `getDiagnostics()` and `dispose()` so the main game can integrate it later without coupling this branch to sport physics.

Future integration entry point:

    import {createUrbanEnvironment} from './urban/index.js';

    const urban=createUrbanEnvironment({
      parent:world,
      renderer,
      quality:quality.getSettings(),
      seed:'downtown-01'
    });

    urban.update(dt,worldSpeed);

The visual cones/barriers/signs deliberately set `gameplayCollision=false`; gameplay collision or obstacle semantics should be added by the gameplay integration owner rather than this environment-only branch.


## AAA street dressing

`createUrbanStreetDressing()` is the dense decorative city layer. It adds parked vehicles, bus shelters, hydrants, bins, benches, bike racks, utility cabinets, mail/newspaper/service props, commercial awnings/boards/crates, construction signage, gutter strips, painted curb regions, manhole/utility covers and tactile sidewalk hints.

Composition is intentionally zoned rather than uniformly random. A deterministic 18 m slot grid alternates parking, storefront, downtown, transit, construction, utility and cleaner breathing-space sections. Fine props are reduced at distance while large vehicle and shelter silhouettes remain readable at gameplay speed.

All repeating geometry is pooled into a small fixed set of `InstancedMesh` batches. The layer creates no realtime lights and all vehicle/street-light accents are material-only. It exposes `update(dt, worldSpeed)`, `reset()`, `setDensity(profileOrSettings)`, `getDiagnostics()` and `dispose()`.

The integrated `createUrbanEnvironment()` includes this street-dressing controller as `components.dressing`.


## Final AAA city asset pass

The final city pass keeps the nine-component streaming topology and the 42-draw-call environment guard. Quality is added inside the existing instanced batches rather than by spawning independent meshes.

The skyline now uses procedural facade surface maps plus architecture-specific material families, richer merged structural geometry, storefront framing, rooftop HVAC/communications silhouettes, fire escapes, balconies, service bays and event marquees. Window panels use deterministic room-by-room illumination states instead of a uniform cyan grid.

Street dressing uses a two-tier strategy without extra draw batches: MEDIUM/LOW retain the efficient procedural baseline, while HIGH/MAX spend more instances inside the existing pools on segmented vehicle bodies, mirrors, plate hints, storefront glazing/service hardware and additional sidewalk service/repair detail. MAX uses full density; HIGH uses the same hero vocabulary at reduced density.

District identity is exposed independently of gameplay. Supported production districts are downtown, commercial, construction, industrial, entertainment and event, plus the mixed fallback. District changes affect skyline architecture cycles, colors/windows and street-zone/vehicle composition.

Runtime integration may use the environment API directly:

    urban.setDistrict('commercial');
    urban.advanceDistrict();
    urban.selectDistrictForDistance(distanceMeters, 720);

No main.js hook is required by this branch. A gameplay/integration owner can call selectDistrictForDistance() from existing course/player distance when desired.
