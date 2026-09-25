# Chimpions Urban Sports conversion roadmap

The Urban Sports repository starts from the stable Chimpions Ski gameplay baseline.
The conversion should remain playable at every milestone instead of replacing the engine all at once.

## Phase 1 — shared foundation

- Keep the existing course, collision, camera, scoring, tricks, input, avatar and special systems operational.
- Introduce a top-level Urban Sports identity.
- Introduce sport profiles for Skateboard, Inline and BMX.
- Skateboard is the first playable urban sport.
- During the first prototype, each urban sport may map to a proven Ski/Snowboard handling profile internally.

## Phase 2 — Skateboard prototype

- Replace snowboard equipment with a skateboard visual rig.
- Replace the snow course surface with asphalt.
- Replace alpine props with an initial urban obstacle set.
- Replace the mountain horizon with a procedural city corridor.
- Retain current jumps, collisions, tricks, Banana Power, controller support and run flow.

## Phase 3 — urban presentation

- Urban start arch.
- City-light day/night/weather presentation.
- Wet-road reflections and rain treatment.
- Street barriers, large traffic cones, lamps, signs, hydrants, dumpsters and parked vehicles.
- Urban menu/start-screen artwork and copy.

## Phase 4 — Inline

- Add inline-skate equipment and rider stance.
- Tune steering and lateral response independently from Skateboard.
- Add inline-specific trick labels and grind presentation.

## Phase 5 — BMX

- Add BMX visual rig with rotating wheels, steering bars and rider attachment.
- Add arcade BMX handling without requiring fully simulated bicycle-wheel physics.
- Add bunny-hop/manual/barspin/tailwhip presentation.

## Parallel-work rule

Multiple assistants can work in parallel only when they own separate branches and mostly separate file groups.

Suggested ownership:

- **Foundation/Integration:** main loop, sport profiles, state, shared contracts.
- **Urban Environment:** terrain material, city buildings, roadside props, start structure.
- **Equipment/Rider:** skateboard, inline and BMX meshes/rig integration.
- **UI/Presentation:** menus, selector, start screen, labels and urban styling.
- **QA/Performance:** invariants, browser checks, performance regression checks.

Do not have two assistants edit `src/main.js`, `src/skier.js` or `src/course.js` at the same time. Those are integration hotspots.
