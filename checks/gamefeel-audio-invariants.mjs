import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calculateCarveFeedback,
  calculateCrashFeedback,
  calculateLandingFeedback,
  createEdgeContactGate
} from '../src/gameFeelFeedback.js';

const bounded=value=>value>=0&&value<=1;
for(const edge of [-3,0,.1,.5,1,4]){
  const carve=calculateCarveFeedback({
    edge,carveLoad:edge,speed:300/3.6,baseSpeed:150/3.6,maxSpeed:300/3.6,
    lateralVelocity:14,grounded:true,groundRoll:.03,groundPitch:.02
  });
  assert(bounded(carve.intensity));
  assert(bounded(carve.snowSpray));
}
assert.equal(calculateCarveFeedback({edge:1,carveLoad:1,air:true}).intensity,0);

const tinyLanding=calculateLandingFeedback({landed:true,impact:2.6,quality:'clean'});
const cleanLanding=calculateLandingFeedback({landed:true,impact:8.2,quality:'clean',jumpSource:'manual'});
const hardLanding=calculateLandingFeedback({landed:true,impact:20.5,quality:'hard',jumpSource:'ramp'});
assert(hardLanding.intensity>cleanLanding.intensity&&cleanLanding.intensity>tinyLanding.intensity);
assert.equal(tinyLanding.particleBurst,0);
assert.equal(tinyLanding.dramatic,false);
assert(hardLanding.cameraKick>0&&hardLanding.hapticStrength>cleanLanding.hapticStrength);
for(const landing of [tinyLanding,cleanLanding,hardLanding]){
  assert(bounded(landing.intensity));assert(bounded(landing.particleBurst));assert(bounded(landing.cameraKick));assert(bounded(landing.hapticStrength));
}

const crash=calculateCrashFeedback({kind:'rock',velocity:{x:7,y:-5,z:300/3.6}});
assert(bounded(crash.intensity)&&bounded(crash.snowBurst)&&bounded(crash.cameraPunch)&&bounded(crash.hapticStrength));

const edgeGate=createEdgeContactGate({cooldownSeconds:.1});
assert.equal(edgeGate.request(.72,1).play,true);
assert.equal(edgeGate.request(.72,1.05).play,false);
assert.equal(edgeGate.request(.72,1.11).play,true);
edgeGate.reset();
assert.equal(edgeGate.request(.72,1.12).play,true);

const audioSource=fs.readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
const mixerSource=fs.readFileSync(new URL('../src/audio/AudioMixer.js',import.meta.url),'utf8');
const musicSource=fs.readFileSync(new URL('../src/audio/MusicSystem.js',import.meta.url),'utf8');
const mainSource=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const feedbackSource=fs.readFileSync(new URL('../src/gameFeedback.js',import.meta.url),'utf8');

assert(mixerSource.includes("const variation=type==='go'?0:"),'GO cue still has random pitch variation');
assert(audioSource.includes('function playGoCue({allowVoiceFallback=false}={})'));
assert(audioSource.includes("const chip=play('go',.76,1.0)"));
assert(audioSource.includes('if(chip||!allowVoiceFallback)return chip;'));
assert(audioSource.includes('return playGoVoice();'));
assert(mixerSource.includes('edgeScrape:.115'),'Edge scrape cooldown missing');
assert(audioSource.includes('function playEdgeContact(edgeContactIntensity=0)'));
assert(audioSource.includes('const carveFeedback=calculateCarveFeedback({'));
assert(audioSource.includes('function getSemanticFeedback()'));
assert(mixerSource.includes('if(graph||!context||disposed)return graph;'),'Persistent audio graph duplicate-loop guard missing');
assert(mixerSource.includes('context??=new AudioContextClass()'),'AudioContext reuse guard missing');
assert(mixerSource.includes("if(context.state==='suspended')context.resume().catch(()=>{});"),'Autoplay-safe resume handling missing');
assert(audioSource.includes("addListener(globalThis.document,'pointerdown',unlockHandler,{once:true,capture:true})"),'Pointer unlock lifecycle missing');
assert(audioSource.includes("addListener(globalThis.document,'keydown',unlockHandler,{once:true,capture:true})"),'Keyboard unlock lifecycle missing');
assert(audioSource.includes("addListener(globalThis.document,'visibilitychange',handleVisibility)"),'Visibility lifecycle missing');
assert(audioSource.includes("addListener(globalThis.navigator?.mediaDevices,'devicechange',handleDeviceChange)"),'Device-change lifecycle missing');
assert(audioSource.includes('function dispose()'),'Audio teardown API missing');
assert(mixerSource.includes('activeTransientSources.delete(source)'),'Transient source cleanup missing');
assert(mixerSource.includes('eventLast.clear();'),'Run reset does not clear event cooldown state');
assert(audioSource.includes('if(mixer.getGraph())applyState(pendingState,true);'),'Run reset does not immediately neutralize persistent ride feedback');

// Music must not attenuate merely because an ordinary jump is airborne.
assert(!musicSource.includes('jumpSource'),'Music system regained jump-based attenuation');
assert(!musicSource.includes('airborne'),'Music system regained airborne attenuation');
assert(musicSource.includes("['crash','bananaPower','majorTrick','results','important']"),'Intentional music duck event allowlist missing');

for(const required of ['carveLoad:state.carveLoad','lateralVelocity:state.vx','grounded:state.grounded','landingGripLoss:state.landingGripLoss']){
  assert(mainSource.includes(required),'Missing real gameplay audio input: '+required);
}
assert(mainSource.includes('const landingFeedback=feedback.onLanding('));
assert(mainSource.includes('landingFeedback?.hapticStrength'));
assert(mainSource.includes('const crashFeedback=feedback.onCrash('));
assert(mainSource.includes('crashFeedback?.hapticStrength'));
assert(feedbackSource.includes('function onEdgeContact(edgeContactIntensity,timeSeconds=0)'));
assert(feedbackSource.includes("remember('landing',feedback)"));
assert(feedbackSource.includes("remember('crash',feedback)"));

console.log(JSON.stringify({
  check:'gamefeel-audio-invariants',
  goCue:'deterministic procedural WebAudio primary',
  carve:'bounded gameplay-derived intensity',
  landing:{tiny:tinyLanding.intensity,clean:cleanLanding.intensity,hard:hardLanding.intensity},
  crashIntensity:crash.intensity,
  lifecycle:'visibility + focus + device changes + teardown',
  musicJumpDucking:'absent'
}));
