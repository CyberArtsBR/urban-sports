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

Placement helpers return lightweight decorative descriptors with predictable y=0 origins and bounds metadata:

- `createParkedVehicle({type, side, z, color, scale})`
- `createStreetFurnitureCluster(...)`
- `createBusStop(...)`
- `createUtilityCluster(...)`
- `createSidewalkDetailSet(...)`
- `createCommercialStreetCluster(...)`

Pass descriptors through `createUrbanStreetDressing({placements:[...]})` for streamed custom placements. They remain collision-free by default.

The integrated `createUrbanEnvironment()` now includes this street-dressing controller as `components.dressing`, so integration code that already updates the environment needs no gameplay-file changes.
