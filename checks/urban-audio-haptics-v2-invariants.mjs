import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSkiAudio} from '../src/audio.js';
import {createAudioEventRouter} from '../src/audio/AudioEventRouter.js';
import {loadAudioSettings,writeAudioSetting} from '../src/audio/AudioPersistence.js';
import {createSkateboardAudio} from '../src/audio/SkateboardAudio.js';
import {MIX_SNAPSHOTS} from '../src/audio/MusicSystem.js';
import {getSkateContinuousMix,getSkateEventCue,normalizeSkateSurface} from '../src/skateAudioProfile.js';
import {createHaptics,HAPTIC_INTENSITY,hapticIntensityScale} from '../src/haptics.js';

const mixerSource=fs.readFileSync(new URL('../src/audio/AudioMixer.js',import.meta.url),'utf8');
const facadeSource=fs.readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
const musicSource=fs.readFileSync(new URL('../src/audio/MusicSystem.js',import.meta.url),'utf8');
const weatherSource=fs.readFileSync(new URL('../src/audio/WeatherAudio.js',import.meta.url),'utf8');
const worldSource=fs.readFileSync(new URL('../src/audio/WorldAudio.js',import.meta.url),'utf8');
const mainSource=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const prefsSource=fs.readFileSync(new URL('../src/userPreferences.js',import.meta.url),'utf8');

for(const path of [
  'src/audio/AudioMixer.js',
  'src/audio/SkateboardAudio.js',
  'src/audio/WorldAudio.js',
  'src/audio/WeatherAudio.js',
  'src/audio/MusicSystem.js',
  'src/audio/UIAudio.js',
  'src/audio/AudioEventRouter.js',
  'src/audio/AudioPersistence.js'
])assert(fs.existsSync(path),'Missing modular audio component: '+path);

assert(mixerSource.includes('export const MAX_TRANSIENT_SOURCES=24'));
assert(mixerSource.includes('activeTransientSources.size>=MAX_TRANSIENT_SOURCES'),'Transient budget is not enforced');
assert(mixerSource.includes('activeTransientSources.delete(source)'),'Transient sources do not self-clean');
assert(mixerSource.includes('stopTransientSources()'),'Restart/teardown source cleanup is missing');
assert(mixerSource.includes('peakTransientCount'),'Transient peak diagnostics missing');
assert(mixerSource.includes('activeNodeEstimate:graph?39+activeTransientSources.size*3:0'),'Active node diagnostics do not cover the full mixer graph');
assert(mixerSource.includes('bufferCountEstimate'),'Mixer buffer estimate diagnostics missing');
assert(facadeSource.includes('activeEnvironmentalTransientCount'),'Whole-runtime environmental transient diagnostics missing');
assert(facadeSource.includes('bufferCountEstimate:(m.bufferCountEstimate??m.bufferCount)+w.bufferCount+wa.bufferCount'),'Whole-runtime buffer aggregation missing');
assert(!mixerSource.includes('createPanner('),'Mixer should not create expensive PannerNodes for routine events');
assert(mixerSource.includes('Math.min(.92'),'Transient peak gain clamp missing');

for(const snapshot of ['MENU','COUNTDOWN','PLAYING','BANANA_POWER','PAUSED','CRASH','RESULTS']){
  assert(MIX_SNAPSHOTS[snapshot],snapshot+' mix snapshot missing');
}
assert(!musicSource.includes('jumpSource'),'Ordinary jump state must not attenuate music');
assert(!musicSource.includes('airborne'),'Ordinary airborne state must not attenuate music');
assert(musicSource.includes("['crash','bananaPower','majorTrick','results','important']"),'Music ducking is not limited to intentional events');
assert(musicSource.includes("media.preload='none'"),'Music must remain lazy-loaded');

assert(weatherSource.includes('activeThunder.size>=2'),'Thunder source virtualization cap missing');
assert(weatherSource.includes('Math.min(.72'),'Thunder peak cap missing');
assert(weatherSource.includes("emitSemantic('THUNDER'"),'Thunder semantic caption event missing');
assert(worldSource.includes('8+rand()*14'),'World accent spacing/variation missing');
assert(worldSource.includes("'city-horn'")&&worldSource.includes("'construction-hit'"),'City event palette incomplete');

for(const surface of ['dry_asphalt','wet_asphalt','concrete','sidewalk','curb','metal','rail','ledge','puddle','oil']){
  assert.equal(normalizeSkateSurface(surface),surface,'Surface vocabulary missing '+surface);
}
const gripMix=getSkateContinuousMix(.8,.05,0,false,'dry_asphalt','none','high',{},{
  grip:.95,lateralSlip:.05,powerslide:0,landingGripLoss:0
});
const slipMix=getSkateContinuousMix(.8,.05,0,false,'dry_asphalt','none','high',{},{
  grip:.30,lateralSlip:.78,powerslide:.7,landingGripLoss:.2
});
assert(slipMix.slide>gripMix.slide,'Traction loss is not audible in the slide layer');
assert(slipMix.bearing<gripMix.bearing,'High-frequency bearing noise is not relieved during major traction loss');

const railStart=getSkateEventCue('grindStart',{surface:'rail',speed01:.8,type:'50-50'});
const ledgeStart=getSkateEventCue('grindStart',{surface:'ledge',speed01:.8,type:'BOARDSLIDE'});
assert(railStart&&ledgeStart);
assert.notEqual(railStart.sound,ledgeStart.sound,'Rail and concrete/ledge grind attacks sound identical');
assert.notEqual(
  getSkateEventCue('grindLoop',{surface:'rail',speed01:.8}).sound,
  getSkateEventCue('grindLoop',{surface:'concrete',speed01:.8}).sound,
  'Rail and concrete sustained grind cues sound identical'
);

const semantic=[];
const router=createAudioEventRouter();
const unsubscribe=router.subscribe(event=>semantic.push(event));
const skate=createSkateboardAudio({mixer:null,emitSemantic:(type,payload)=>router.emit(type,payload)});
skate.routeEvent('grindStart',{surface:'rail',type:'50-50',intensity:.8});
assert.equal(skate.diagnostics().grind.active,true,'Grind lifecycle did not enter active state');
skate.routeEvent('grindLoop',{surface:'rail',type:'50-50',balance:.25,intensity:.6});
skate.routeEvent('grindEnd',{surface:'rail',type:'50-50',intensity:.7});
assert.equal(skate.diagnostics().grind.active,false,'Grind lifecycle did not leave active state');
assert(semantic.some(event=>event.type==='GRIND_START'));
assert(semantic.some(event=>event.type==='GRIND_END'));
unsubscribe();

const semanticEvent=router.emit('HARD_LANDING',{intensity:.8});
assert.equal(semanticEvent.caption,'HARD LANDING');
router.reset();
assert.equal(router.diagnostics().historyCount,0);

assert.equal(hapticIntensityScale(HAPTIC_INTENSITY.OFF),0);
assert(hapticIntensityScale(HAPTIC_INTENSITY.LOW)<hapticIntensityScale(HAPTIC_INTENSITY.MEDIUM));
assert(hapticIntensityScale(HAPTIC_INTENSITY.MEDIUM)<hapticIntensityScale(HAPTIC_INTENSITY.HIGH));
const unsupported=createHaptics({intensity:'high'});
for(let i=0;i<5;i++){
  assert.doesNotThrow(()=>unsupported.reset());
  assert.doesNotThrow(()=>unsupported.grind('start',.8));
  assert.doesNotThrow(()=>unsupported.powerslide('loop',.8));
}
unsupported.setIntensityPreference('off');
assert.equal(unsupported.grind('start',1),false,'OFF haptic intensity emitted vibration');

const memory=new Map([
  ['chimpions-ski-sfx','0.41'],
  ['chimpions-ski-music-enabled','0']
]);
const originalStorage=globalThis.localStorage;
globalThis.localStorage={
  getItem:key=>memory.has(key)?memory.get(key):null,
  setItem:(key,value)=>memory.set(key,String(value))
};
const migrated=loadAudioSettings();
assert.equal(migrated.sfx,.41);
assert.equal(migrated.musicEnabled,false);
assert.equal(memory.get('chimpions-urban-sfx'),'0.41','Legacy SFX volume was not migrated');
assert.equal(memory.get('chimpions-urban-music-enabled'),'0','Legacy music setting was not migrated');
writeAudioSetting('sfx',.62);
assert.equal(memory.get('chimpions-urban-sfx'),'0.62');
assert.equal(memory.get('chimpions-ski-sfx'),'0.62','Backwards-compatible dual write missing');
if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;

assert(prefsSource.includes("'chimpions-urban-haptics-enabled'"));
assert(prefsSource.includes("'chimpions-ski-haptics-enabled'"));
assert(prefsSource.includes("'chimpions-urban-haptics-intensity'"));
assert(prefsSource.includes('saveHapticIntensityPreference'));

const facade=createSkiAudio();
for(let i=0;i<8;i++)assert.doesNotThrow(()=>facade.resetRun(),'Repeated audio restart leaked/failed');
assert.doesNotThrow(()=>facade.update({mode:'paused'}));
assert.doesNotThrow(()=>facade.update({mode:'playing',air:true,jumpSource:'ollie'}));
assert.doesNotThrow(()=>facade.dispose());
assert.doesNotThrow(()=>facade.dispose(),'Repeated audio teardown must be idempotent');

assert(facadeSource.includes("addListener(globalThis.document,'visibilitychange',handleVisibility)"));
assert(facadeSource.includes("addListener(globalThis.window,'blur',handleBlur)"));
assert(facadeSource.includes("addListener(globalThis.window,'focus',handleFocus)"));
assert(facadeSource.includes("addListener(globalThis.navigator?.mediaDevices,'devicechange',handleDeviceChange)"));
assert(facadeSource.includes('mixer.suspend()')&&facadeSource.includes('mixer.resume()'),'AudioContext suspension/resume lifecycle missing');
assert(facadeSource.includes('weather.dispose();world.dispose();music.dispose()'),'Subsystem teardown missing');
assert(mainSource.includes('consumeSkateboardFeedbackEvents(wet)'),'Native Skateboard events are not consumed by audio/haptics');
assert(mainSource.includes('new Array(MAX_FORWARDED_SKATEBOARD_EVENTS)'),'Skateboard debug-event mirror is not fixed-capacity');
assert(!mainSource.includes('forwardedSkateboardEvents.push('),'Skateboard debug-event mirror can grow unbounded');
assert(mainSource.includes("lower==='grindloop'")&&mainSource.includes('audio:false'),'Grind loop should update sustained state without transient spam');
assert(mainSource.includes("lower==='powerslideloop'")&&mainSource.includes('audio:false'),'Powerslide loop should update sustained state without transient spam');
assert(mainSource.includes("const audioMode=gameFlow.is(GAME_FLOW.RESULTS)?'results':state.mode;"),'Results mix snapshot is overwritten by the legacy crashed mode');
assert(mainSource.includes('audio.dispose?.()'),'Game teardown does not release audio');
assert(facadeSource.includes('if(!hidden&&focused)mixer.resume();'),'Device changes can resume AudioContext while backgrounded');
assert(mainSource.includes('haptics.setIntensityPreference?.'),'Runtime haptic intensity bridge missing');

console.log(JSON.stringify({
  check:'urban-audio-haptics-v2-invariants',
  snapshots:Object.keys(MIX_SNAPSHOTS),
  surfaces:['dry_asphalt','wet_asphalt','concrete','sidewalk','curb','metal','rail','ledge','puddle','oil'],
  transientLimit:24,
  pannerStrategy:'stereo-pan/virtualized accents',
  repeatedRestarts:'pass',
  unsupportedHaptics:'pass',
  noJumpMusicDucking:'pass'
}));
