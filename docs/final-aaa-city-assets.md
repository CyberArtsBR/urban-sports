# Final AAA city assets

Branch: feat/final-aaa-city-assets

This pass is intentionally asset/system scoped. It does not alter skateboard physics, rider controls, trick/grind state, scoring, audio, UI flow, post-processing, or course collision footprints.

## Architecture

The environment remains nine reusable streaming components with fixed InstancedMesh pools. No per-prop realtime lights and no unbounded object creation were introduced. The existing environment-wide 42 draw-call guard remains authoritative.

## Facades and buildings

Seven draw-batched building archetypes now represent a ten-family visual vocabulary: concrete, brick, modern glass, painted commercial, industrial, mixed-use, residential, warehouse, entertainment and event-district. Geometry inside those batches adds structural floor bands, piers, storefront frames, service bays, balconies, fire escapes, roof HVAC/duct/antenna silhouettes and event marquee details.

A shared procedural facade surface set supplies color breakup, panel/brick seams, water staining, grime, roughness variation and bump detail without external texture downloads.

Windows are deterministic per-room panels with dark, dim, warm/cool-tintable and bright states plus occasional blind strips. District palettes provide the per-building tint.

## Hero street assets

The existing street dressing batches now act as the hero tier. HIGH/MAX spend additional instances from the same pools on vehicle hood/trunk segmentation, mirrors, license-plate hints, richer storefront glazing and service hardware, and extra sidewalk/service/repair plates. This adds near-camera shape language without new draw batches.

## Districts

Production presets:
- Downtown
- Commercial
- Construction
- Industrial
- Entertainment / Nightlife
- Event
- Mixed fallback

Districts alter architecture cycles, facade/window palettes, density/setbacks, street-zone weights and vehicle category mix. Legacy shopping/neon/waterfront aliases remain compatible.

The environment exposes setDistrict(), advanceDistrict(), and selectDistrictForDistance(). No main.js edit is required. Integration can call selectDistrictForDistance(playerOrCourseDistance, districtLength) from an existing distance owner.

## Quality tiers

MAX: full density, full hero street detail, full facade lights and LED accents.
HIGH: hero vocabulary retained at lower density and reduced facade accent population.
MEDIUM: reduced population, standard street detail and reduced window/accent density.
LOW: efficient baseline; close-range accent batches are detached and skyline LEDs are disabled.

## Merge risk

urbanMaterials.js, urbanBuildings.js, urbanFacadeSystem.js, urbanDistricts.js, streetDressing.js and urbanEnvironment.js are environment-owned hotspots. Parallel lighting or street/architecture branches touching those files may require a manual semantic merge. main.js is untouched.
