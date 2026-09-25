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
