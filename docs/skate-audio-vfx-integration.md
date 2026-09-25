# Skateboard Audio / VFX Integration Contract

Branch: `feat/final-skate-audio-vfx`

This layer intentionally does not own gameplay physics, trick legality, grind collision, scoring, course generation, camera code, or the rider rig. It consumes authoritative gameplay state and events.

## Runtime selection

Urban Sports keeps its legacy Snowboard handling profile for physics compatibility, but audio selects the native `skateboard` presentation profile. The Skateboard audio profile never enables the Snowboard scrape layer.

## Continuous state

Call the existing `audio.update(...)` once per frame with the normal runtime fields. Skateboard-specific optional fields are:

- `surface`: `dry_asphalt | wet_asphalt | oil | metal | concrete | grind_rail`
- `wetness`: normalized 0..1
- `slideAmount`: normalized 0..1 when an authoritative slide state exists
- `manual`: `none | manual | nose_manual`

For discrete state changes or future gameplay modules, `audio.updateSkateState({...})` also accepts:

- `surface`
- `wetness`
- `slideAmount`
- `manual`
- `district`: for example `downtown | commercial | industrial | entertainment | construction`
- `grind: {active, intensity, type, surface}`

The current main runtime already supplies speed, air/ground state, rain-derived wetness, surface, landing grip loss, and Banana Power state.

## Authoritative event adapter

Use `audio.playSkateEvent(name, payload)` when gameplay exposes the corresponding event.

Supported contract:

- `wheelRoll` — continuous state should normally flow through `audio.update`
- `powerslideStart`
- `powerslideLoop` with `payload.intensity` / `payload.amount`
- `powerslideEnd`
- `tailPop`
- `land`
- `hardLand`
- `grindStart`
- `grindLoop`
- `grindEnd`
- `manualStart` with `payload.type`
- `manualEnd`
- `trickStart` with `payload.trick`
- `trickLand` with `payload.trick`
- `trickFail`
- `crash` remains handled by the existing gameplay-critical crash path
- `surfaceChanged` with `payload.surface`
- `BananaPowerReady`
- `BananaPowerStart`
- `BananaPowerEnd`

Trick names handled by the profile include `OLLIE`, `NOLLIE`, `180`, `360`, `KICKFLIP`, `HEELFLIP`, `SHOVE-IT`, `FRONTSIDE SHOVE-IT`, and `GRABS`.

Grind payloads may provide `type` values such as `50-50`, `5-0`, `NOSEGRIND`, `BOARDSLIDE`, or `LIPSLIDE`, plus a material/surface hint. Metal/rail cues emphasize truck/deck metal texture; concrete falls back toward ledge scrape/dust.

## VFX contract

`createSkateVfx` owns one fixed-capacity particle pool. It exposes:

- `emitWheelContact`
- `emitLanding`
- `emitGrind`
- `emitBananaPower`
- `update`
- `reset`
- `setQuality`
- `setReducedMotion`
- `dispose`

The current runtime wires wheel contact, wet spray, landing dust, Banana activation, quality, reduced motion, and restart cleanup. Grind sparks remain ready for the authoritative grind gameplay branch; this branch does not infer grind collision.

## Trail contract

Urban trail segments carry a per-segment `powered` flag.

Normal riding:
- dark rubber / road dust
- restrained opacity
- stronger only with carve intensity

Banana Power:
- blue/white energy color
- stronger emissive response
- powered segments keep fading after power ends, producing a short residual afterglow without a global screen wash

## Performance / cleanup

- One AudioContext is reused.
- Continuous Skateboard wheel/bearing/road/wet/slide/city layers are persistent nodes, not per-frame node allocations.
- Transient WebAudio concurrency is capped.
- Transient sources disconnect and are cleared on run reset.
- Particle capacity is fixed and quality-scaled.
- LOW keeps the essential wheel layer and sharply reduces particle work.
- Reduced motion cuts power flashes/streak-equivalent particle intensity while audio cues remain active.

## Integration limitation

The current branch does not create gameplay grind or powerslide detection. When those systems expose authoritative states/events, connect them through `updateSkateState`, `playSkateEvent`, and `emitGrind` rather than duplicating collision/physics logic here.
