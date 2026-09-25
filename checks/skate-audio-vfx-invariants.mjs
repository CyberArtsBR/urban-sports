import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  RIDE_AUDIO_PROFILES,
  normalizeRideMode,
  normalizeRideSpeed
} from '../src/rideAudioProfile.js';
import {
  getSkateContinuousMix,
  getSkateEventCue,
  normalizeSkateSurface
} from '../src/skateAudioProfile.js';
import {
  createSkateParticlePool,
  SKATE_PARTICLE_KIND
} from '../src/skateParticles.js';
import {
  BANANA_VFX_PHASE,
  createBananaPowerVfxState
} from '../src/bananaPowerVfx.js';

assert.equal(normalizeRideMode('skateboard'),'skateboard');
assert.equal(RIDE_AUDIO_PROFILES.skateboard.snowboardScrapeGain,0,'Skateboard inherited snowboard scrape');
assert.notEqual(RIDE_AUDIO_PROFILES.skateboard,RIDE_AUDIO_PROFILES.snowboard,'Skateboard profile is not dedicated');
assert.equal(normalizeRideSpeed(300/3.6,'skateboard'),1,'Skateboard speed normalization must reach 1 at 300 km/h');

assert.equal(normalizeSkateSurface('asphalt'),'dry_asphalt');
assert.equal(normalizeSkateSurface('wet asphalt'),'wet_asphalt');
assert.equal(normalizeSkateSurface('rail'),'grind_rail');

const slow=getSkateContinuousMix(.1,0,0,false,'dry_asphalt','none','max',{});
const fast=getSkateContinuousMix(1,0,0,false,'dry_asphalt','none','max',{});
const wet=getSkateContinuousMix(.8,0,1,false,'wet_asphalt','none','high',{});
const air=getSkateContinuousMix(.8,0,0,true,'dry_asphalt','none','high',{});
const lowQuality=getSkateContinuousMix(.8,0,0,false,'dry_asphalt','none','low',{});
assert(fast.lowRoll>slow.lowRoll,'Wheel roll does not respond to speed');
assert(fast.bearing>slow.bearing,'Bearing layer does not respond to speed');
assert(fast.roadHiss>slow.roadHiss,'Road hiss does not respond to speed');
assert(wet.wetHiss>0,'Wet asphalt does not add wheel hiss');
assert.equal(air.lowRoll,0,'Airborne skateboard retained wheel contact audio');
assert.equal(lowQuality.bearing,0,'LOW quality should collapse to the essential wheel layer');
assert.equal(lowQuality.roadHiss,0,'LOW quality should remove the richest road layer');

for(const event of [
  'tailPop','land','hardLand',
  'powerslideStart','powerslideLoop','powerslideEnd',
  'grindStart','grindLoop','grindEnd',
  'manualStart','manualEnd',
  'trickStart','trickLand','trickFail',
  'BananaPowerReady','BananaPowerStart','BananaPowerEnd'
]){
  assert(getSkateEventCue(event,{trick:'KICKFLIP',surface:'metal',speed01:.8}),event+' cue is missing');
}
for(const trick of ['OLLIE','NOLLIE','180','360','KICKFLIP','HEELFLIP','SHOVE-IT','FRONTSIDE SHOVE-IT','GRABS']){
  assert(getSkateEventCue(trick),trick+' event profile is missing');
}
assert.notEqual(
  getSkateEventCue('grindStart',{surface:'metal'}).sound,
  getSkateEventCue('grindStart',{surface:'concrete'}).sound,
  'Metal and concrete grind materials should not share the same transient'
);

const maxPool=createSkateParticlePool({capacity:40,quality:'max'});
const lowPool=createSkateParticlePool({capacity:40,quality:'low'});
const maxSpawn=maxPool.spawnBurst({kind:SKATE_PARTICLE_KIND.SPARK,intensity:1,amount:30});
const lowSpawn=lowPool.spawnBurst({kind:SKATE_PARTICLE_KIND.SPARK,intensity:1,amount:30});
assert(lowSpawn<maxSpawn,'LOW quality did not reduce particle emission');
for(let i=0;i<20;i++)maxPool.spawnBurst({kind:SKATE_PARTICLE_KIND.SPARK,intensity:1,amount:30});
assert(maxPool.diagnostics().activeCount<=40,'Particle pool exceeded fixed capacity');
maxPool.reset();
assert.equal(maxPool.diagnostics().activeCount,0,'Particle reset leaked active particles');

const banana=createBananaPowerVfxState();
const styleRef=banana.getStyle();
banana.markReady();
assert.equal(banana.phase,BANANA_VFX_PHASE.READY);
banana.start();
banana.update(.18);
assert.equal(banana.phase,BANANA_VFX_PHASE.ACTIVE);
assert.equal(styleRef,banana.getStyle(),'Banana VFX allocates a new style object during update');
banana.end();
banana.update(.4);
assert.equal(banana.phase,BANANA_VFX_PHASE.IDLE);
banana.setReducedMotion(true);
banana.start();
const reducedStyle=banana.getStyle();
assert(reducedStyle.flashScale<=.12,'Reduced motion did not cap Banana flash intensity');

const audio=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
const trails=readFileSync(new URL('../src/snowTrails.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const skateVfx=readFileSync(new URL('../src/skateVfx.js',import.meta.url),'utf8');

assert(audio.includes('function playSkateEvent(name,payload={})'),'Authoritative Skateboard event adapter is missing');
assert(audio.includes('MAX_TRANSIENT_SOURCES=24'),'Transient concurrency cap is missing');
assert(audio.includes("activeTransientSources.clear()"),'Restart cleanup does not clear transient audio sources');
assert(audio.includes("'skate-grind-loop':.075"),'Grind loop throttling is missing');
assert(audio.includes('skateWheelLow')&&audio.includes('skateBearing')&&audio.includes('skateRoad'),'Layered wheel graph is missing');
assert(audio.includes("skateSurface='dry_asphalt'"),'Surface reset/fallback is missing');
assert(audio.includes('setAudioQualityProfile'),'Audio quality profile hook is missing');
assert(audio.includes('jumpMusicFailed'),'Existing graceful music fallback was removed');

assert(trails.includes('attribute float aPower;'),'Trail shader lacks normal/powered separation');
assert(trails.includes("powered?(.72+carve*.18):(.10+carve*.18)"),'Normal urban trail is not restrained relative to Banana Power');
assert(main.includes('audio.setRideMode?.(selectedSportMode)'),'Urban runtime does not select the native Skateboard audio profile');
assert(main.includes('powered:bananaPower.active'),'Banana Power is not wired to powered trail presentation');
assert(main.includes('wetness:wet'),'Weather wetness is not wired to Skateboard audio');
assert(main.includes('bananaPowerVfx.markReady()')&&main.includes('bananaPowerVfx.start()')&&main.includes('bananaPowerVfx.end()'),'Banana VFX lifecycle is incomplete');
assert(main.includes('skateVfx.reset()'),'Restart does not reset Skateboard particles');
assert(skateVfx.includes('createSkateParticlePool'),'Skate VFX is not using the bounded pool');
assert(skateVfx.includes('reducedMotion?8:22'),'Reduced motion does not reduce power particles');

console.log(JSON.stringify({
  check:'skate-audio-vfx-invariants',
  audioProfile:'skateboard',
  surfaces:['dry_asphalt','wet_asphalt','oil','metal','concrete','grind_rail'],
  particlePool:'bounded',
  bananaLifecycle:'pass'
}));
