import {SKI_TUNING} from './gameplayTuning.js';
import {DEFAULT_RIDE_MODE,getRideAudioProfile,getRideSpeedFeel,normalizeRideMode} from './rideAudioProfile.js';
import {createTrickAudioState,getTrickFailProfile,getTrickStartProfile,getTrickSuccessProfile} from './trickAudio.js';
import {getSkateEventCue} from './skateAudioProfile.js';
import {calculateCarveFeedback} from './gameFeelFeedback.js';
import {createAudioMixer} from './audio/AudioMixer.js';
import {createAudioEventRouter} from './audio/AudioEventRouter.js';
import {loadAudioSettings,writeAudioSetting,getAudioStorageDiagnostics} from './audio/AudioPersistence.js';
import {createSkateboardAudio} from './audio/SkateboardAudio.js';
import {createWeatherAudio} from './audio/WeatherAudio.js';
import {createWorldAudio} from './audio/WorldAudio.js';
import {createMusicSystem,URBAN_MUSIC_URL} from './audio/MusicSystem.js';
import {getUIAudioCue} from './audio/UIAudio.js';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const performanceNow=()=>globalThis.performance?.now?.()??Date.now();

export const AUDIO_ARCHITECTURE=Object.freeze({
  facade:'AudioEventRouter',
  mixer:'AudioMixer',
  skateboard:'SkateboardAudio',
  world:'WorldAudio',
  weather:'WeatherAudio',
  music:'MusicSystem',
  ui:'UIAudio'
});

// Historical API name is intentionally retained as a stable facade for the
// rest of the runtime while the internals are Urban-native and modular.
export function createSkiAudio(){
  const JUMP_MUSIC_URL=URBAN_MUSIC_URL;
  const settings=loadAudioSettings();
  const router=createAudioEventRouter();
  const trickState=createTrickAudioState();
  const mixer=createAudioMixer({getSettings:()=>settings});
  const skateboard=createSkateboardAudio({mixer,emitSemantic:(type,payload)=>router.emit(type,payload)});
  const weather=createWeatherAudio({mixer,emitSemantic:(type,payload)=>router.emit(type,payload)});
  const world=createWorldAudio({mixer,playEvent:(type,payload={})=>play(type,payload.gain??.2,payload.rate??1,payload.pan??0)});
  const music=createMusicSystem({mixer,getSettings:()=>settings});

  let rideMode=DEFAULT_RIDE_MODE;
  let sportMode='skateboard';
  let pendingState={
    mode:'menu',speed:SKI_TUNING.BASE_SPEED,baseSpeed:SKI_TUNING.BASE_SPEED,maxSpeed:SKI_TUNING.MAX_SPEED,
    carve:0,edge:0,carveLoad:0,lateralVelocity:0,air:false,grounded:true,groundRoll:0,groundPitch:0,
    landingGripLoss:0,intensity:0,jumpSource:'',specialActive:false,time:0,surface:'dry_asphalt',
    wetness:0,grip:1,lateralSlip:0,powerslide:0,manual:'none',district:'downtown'
  };
  let lastSemanticFeedback={carve:calculateCarveFeedback(pendingState)};
  let lastClearEventId=0,lastGoVoiceAt=-Infinity,lastBananaAt=-Infinity,bananaChain=0;
  let disposed=false,hidden=false,focused=true,deviceChangeCount=0;
  let updateCpuTotal=0,updateCpuMax=0,updateCpuSamples=0;
  const removers=[];

  function isSkateboard(){
    return sportMode==='skateboard'||rideMode==='skateboard';
  }

  function currentSpeed01(){
    return clamp(getRideSpeedFeel(pendingState.speed,rideMode));
  }

  function ensureUnlocked(){
    if(disposed)return false;
    const ok=mixer.unlock();
    if(ok){
      mixer.setLifecycleAudible(!hidden&&focused);
      mixer.setBusLevels();
    }
    return ok;
  }

  function unlock(){
    const ok=ensureUnlocked();
    music.update(pendingState);
    return ok;
  }

  function zeroSkateLayers(){
    const graph=mixer.getGraph();if(!graph)return;
    for(const layer of [graph.skateWheelLow,graph.skateBearing,graph.skateRoad,graph.skateWet,graph.skateSlide]){
      mixer.setTarget(layer.gain.gain,0,.08);
    }
  }

  function zeroLegacyRideLayers(){
    const graph=mixer.getGraph();if(!graph)return;
    mixer.setTarget(graph.contact.gain.gain,0,.08);
    mixer.setTarget(graph.carve.gain.gain,0,.08);
    mixer.setTarget(graph.boardScrape.gain.gain,0,.08);
  }

  function applyLegacyRide(speed01,carveFeedback,running,countdown){
    const graph=mixer.getGraph();if(!graph)return;
    const profile=getRideAudioProfile(rideMode);
    const air=!!pendingState.air,carve=carveFeedback.intensity;
    const rampAir=air&&pendingState.jumpSource==='ramp';
    const response=.09;
    const contact=air?0:(running?(0.024+speed01*.058+carve*.032)*profile.contactGain:0);
    const edge=air?0:(running?carve*(.014+speed01*.072)*profile.carveGain:0);
    const scrape=air?0:(running?carve*(.010+speed01*.038)*profile.snowboardScrapeGain:0);
    const airWind=air?(rampAir?.058:.038):0;
    const wind=(running?(0.014+speed01*.076+airWind):countdown?.006:0)*profile.windGain;
    mixer.setTarget(graph.contact.gain.gain,contact,response);
    mixer.setTarget(graph.carve.gain.gain,edge,response);
    mixer.setTarget(graph.boardScrape.gain.gain,scrape,response);
    mixer.setTarget(graph.wind.gain.gain,wind,response);
    mixer.setTarget(graph.contact.filter.frequency,(560+speed01*720+carve*300)*profile.contactFrequencyScale,.12);
    mixer.setTarget(graph.carve.filter.frequency,(980+carve*1280+speed01*520)*profile.carveFrequencyScale,.10);
    mixer.setTarget(graph.carve.filter.Q,profile.carveQ,.12);
    mixer.setTarget(graph.boardScrape.filter.frequency,360+speed01*420+carve*260,.12);
    mixer.setTarget(graph.wind.filter.frequency,620+speed01*1640+(air?(rampAir?460:300):0),.20);
  }

  function applyState(next={},instant=false){
    const started=performanceNow();
    pendingState={...pendingState,...next};
    if(disposed)return;
    if(!mixer.getGraph()){
      updateCpuSamples++;
      updateCpuTotal+=Math.max(0,performanceNow()-started);
      return;
    }
    const speed01=currentSpeed01();
    const air=!!pendingState.air;
    const carveFeedback=calculateCarveFeedback({
      ...pendingState,
      edge:pendingState.edge??pendingState.carve,
      grounded:pendingState.grounded??!air,
      air
    });
    lastSemanticFeedback={...lastSemanticFeedback,carve:carveFeedback};
    const mode=String(pendingState.mode||'menu').toLowerCase();
    const running=mode==='playing',countdown=mode==='countdown';

    if(isSkateboard()){
      zeroLegacyRideLayers();
      skateboard.update({
        surface:pendingState.surface,
        wetness:pendingState.wetness,
        grip:pendingState.grip,
        lateralSlip:pendingState.lateralSlip,
        powerslide:pendingState.powerslide??pendingState.slideAmount,
        slideAmount:pendingState.slideAmount,
        landingGripLoss:pendingState.landingGripLoss,
        landingState:pendingState.landingState,
        manual:pendingState.manual,
        district:pendingState.district,
        air,
        grind:pendingState.grind
      },speed01,{running,countdown});
      const graph=mixer.getGraph();
      const profile=getRideAudioProfile(rideMode);
      const airWind=air?.050:0;
      mixer.setTarget(graph.wind.gain.gain,(running?(.012+speed01*.082+airWind):countdown?.004:0)*profile.windGain,instant?.01:.09);
      mixer.setTarget(graph.wind.filter.frequency,650+speed01*1500+(air?320:0),.18);
    }else{
      zeroSkateLayers();
      applyLegacyRide(speed01,carveFeedback,running,countdown);
    }

    const graph=mixer.getGraph();
    if(graph){
      mixer.setTarget(graph.worldFilter.frequency,pendingState.specialActive?1600:14000,pendingState.specialActive?.10:.22);
    }
    world.update({mode,district:pendingState.district||'downtown',speed01,audible:!hidden,time:pendingState.time});
    music.update({mode,intensity:pendingState.intensity??speed01,specialActive:!!pendingState.specialActive});
    mixer.updateDucking();

    const elapsed=Math.max(0,performanceNow()-started);
    updateCpuSamples++;updateCpuTotal+=elapsed;updateCpuMax=Math.max(updateCpuMax,elapsed);
  }

  function update(state){applyState(state,false);}

  function classifyImportantDuck(type){
    if(type==='crash'||type==='deathCry')return {depth:.30,duration:.20,musicKind:'crash'};
    if(type==='specialActivate'||type==='skate-power-start')return {depth:.24,duration:.18,musicKind:'bananaPower'};
    if(type==='newBest')return {depth:.14,duration:.12,musicKind:'results'};
    return null;
  }

  function play(type,gain=1,rateScale=1,pan=0){
    if(disposed)return false;
    let sound=String(type||'');
    const uiCue=getUIAudioCue(sound);
    if(uiCue){
      gain=Math.min(Number(gain)||0,uiCue.gain);
      rateScale*=uiCue.rate;
    }
    if(isSkateboard()){
      const skateCue=getSkateEventCue(sound,{intensity:gain});
      if(skateCue){
        sound=skateCue.sound;
        gain*=skateCue.gain;
        rateScale*=skateCue.rate;
      }
    }
    const important=classifyImportantDuck(sound)||classifyImportantDuck(type);
    if(important){
      mixer.duckImportant(important);
      music.duck(important.musicKind,important.depth,important.duration);
    }
    const played=mixer.playTransient(sound,gain*settings.impactIntensity,rateScale,pan);
    if(played){
      if(type==='crash')router.emit('CRASH',{intensity:clamp(gain),source:'game'});
      if(type==='hardLand'||sound==='skate-hard-land')router.emit('HARD_LANDING',{intensity:clamp(gain),source:'game'});
    }
    return played;
  }

  function playSpatialEvent(type,{x=0,listenerX=0,range=18,gain=.35,rate=1,source='world'}={}){
    const pan=clamp((Number(x)-Number(listenerX))/Math.max(1,Number(range)||18),-1,1);
    const distance=Math.abs(Number(x)-Number(listenerX));
    const attenuation=clamp(1-distance/Math.max(1,Number(range)||18),.18,1);
    return play(type,gain*attenuation,rate,pan)||false;
  }

  function playGoVoice(){
    if(!settings.sfxEnabled)return false;
    const synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance;
    if(!synth||!Utterance)return false;
    const now=performanceNow();if(now-lastGoVoiceAt<700)return false;lastGoVoiceAt=now;
    try{
      const utterance=new Utterance('GO!');
      utterance.lang='en-US';utterance.rate=1.42;utterance.pitch=.86;utterance.volume=clamp(settings.master*settings.sfx*.90);
      const voices=synth.getVoices?.()||[];
      utterance.voice=voices.find(voice=>/^en(?:-|_)?US/i.test(voice.lang)&&/(google|microsoft|samantha|daniel|alex|david)/i.test(voice.name))
        ||voices.find(voice=>/^en/i.test(voice.lang))||null;
      synth.speak(utterance);return true;
    }catch{return false;}
  }

  function playGoCue({allowVoiceFallback=false}={}){
    const chip=play('go',.76,1.0);
    if(chip||!allowVoiceFallback)return chip;
    return playGoVoice();
  }

  function playEdgeContact(edgeContactIntensity=0){
    const amount=clamp(edgeContactIntensity);
    if(amount<.08)return false;
    return play('edgeScrape',.12+amount*.42,.90+amount*.18);
  }

  function playClear(clearEvent){
    const id=Number(clearEvent?.id)||0;
    if(!id||id===lastClearEventId)return false;
    lastClearEventId=id;
    const kind=String(clearEvent?.kind||'');
    if(kind==='near-miss'||kind==='thread'||kind==='risk-banana')return true;
    const chain=Math.max(1,Number(clearEvent?.combo)||1);
    return play('clear',.22+Math.min(5,chain-1)*.018,1+Math.min(5,chain-1)*.08);
  }

  function playBananaPickup({ready=false}={}){
    const now=performanceNow();
    bananaChain=now-lastBananaAt<=900?Math.min(4,bananaChain+1):0;lastBananaAt=now;
    return play('banana',ready?.40:.54,1+bananaChain*.035);
  }

  function playNearMiss(event={}){
    const intensity=clamp(event.intensity),threaded=String(event.kind||'')==='thread';
    const played=play('nearMiss',.24+intensity*.20+(threaded?.06:0),.94+intensity*.16+(threaded?.05:0));
    if(played)router.emit('NEAR_MISS',{intensity,source:'game'});
    return played;
  }

  function playBananaReady(){
    const played=play('specialReady',.78,1);
    if(played)router.emit('BANANA_POWER_READY',{intensity:.8,source:'game'});
    return played;
  }

  function playBananaPowerActivate(){
    const played=play('specialActivate',.82,1);
    if(played)router.emit('BANANA_POWER_ACTIVATE',{intensity:1,source:'game'});
    return played;
  }
  function playBananaPowerEnd(){return play('specialEnd',.42,1);}
  function playNewBest(){return play('newBest',.78,1);}

  function playTrickStart(type,eventId){
    const event=trickState.start(type,eventId);if(!event.play)return false;
    const cue=getTrickStartProfile(event.type,event.generation);
    return cue?play(cue.sound,cue.gain,cue.rate,cue.pan):false;
  }

  function playTrickSuccess(type,combo=1,eventId){
    const event=trickState.result(type,'success',eventId);if(!event.play)return false;
    const cue=getTrickSuccessProfile(event.type,combo);
    if(!cue)return false;
    if(Number(combo)>=3){
      mixer.duckImportant({depth:.12,duration:.11});
      music.duck('majorTrick',.16,.13);
    }
    return play(cue.sound,cue.gain,cue.rate,cue.pan);
  }

  function playTrickFail(type,eventId){
    const event=trickState.result(type,'fail',eventId);if(!event.play)return false;
    const cue=getTrickFailProfile(event.type);
    return cue?play(cue.sound,cue.gain,cue.rate,cue.pan):false;
  }

  function playSkateEvent(name,payload={}){
    const cue=skateboard.routeEvent(name,payload);
    applyState({
      surface:payload.surface??pendingState.surface,
      manual:skateboard.diagnostics().manual,
      slideAmount:/powerslide/i.test(String(name))?clamp(payload.intensity??payload.amount??pendingState.slideAmount):pendingState.slideAmount,
      grind:skateboard.diagnostics().grind
    },false);
    if(payload.audio===false)return !!cue;
    return cue?mixer.playTransient(cue.sound,cue.gain*(payload.gain??1)*settings.impactIntensity,cue.rate*(payload.rate??1),payload.pan??0):false;
  }

  function setSkateSurface(surface){
    const next=skateboard.setSurface(surface);pendingState.surface=next;return next;
  }

  function setAudioQualityProfile(profile){return skateboard.setQuality(profile);}

  function updateSkateState(next={}){
    pendingState={...pendingState,...next};
    if(next.surface!=null)skateboard.setSurface(next.surface);
    applyState(pendingState,false);
    return skateboard.diagnostics();
  }

  function updateWeather(weatherState,mode='playing'){
    weather.update(weatherState,mode,{audible:!hidden,intensityScale:settings.impactIntensity});
  }

  function playWeatherThunder(){
    return weather.playThunder({intensity:.76,intensityScale:settings.impactIntensity});
  }

  function resetRun(){
    lastClearEventId=0;lastGoVoiceAt=-Infinity;lastBananaAt=-Infinity;bananaChain=0;
    mixer.resetTransientState();trickState.reset();skateboard.reset();weather.reset();world.reset();router.reset();
    pendingState={...pendingState,carve:0,edge:0,carveLoad:0,lateralVelocity:0,air:false,grounded:true,
      groundRoll:0,groundPitch:0,landingGripLoss:0,intensity:0,jumpSource:'',specialActive:false,
      surface:'dry_asphalt',wetness:0,grip:1,lateralSlip:0,powerslide:0,slideAmount:0,manual:'none',grind:null};
    lastSemanticFeedback={carve:calculateCarveFeedback(pendingState)};
    if(mixer.getGraph())applyState(pendingState,true);
  }

  function setRideMode(mode){
    rideMode=normalizeRideMode(mode);applyState(pendingState,false);return rideMode;
  }
  function getRideMode(){return rideMode;}

  function setSportMode(mode='skateboard'){
    sportMode=String(mode||'skateboard').toLowerCase();
    applyState(pendingState,false);return sportMode;
  }
  function getSportMode(){return sportMode;}

  function getSettings(){return {...settings};}
  function setMasterVolume(value){settings.master=clamp(value);writeAudioSetting('master',settings.master);mixer.setBusLevels();}
  function setSfxVolume(value){settings.sfx=clamp(value);writeAudioSetting('sfx',settings.sfx);mixer.setBusLevels();}
  function setMusicVolume(value){settings.music=clamp(value);writeAudioSetting('music',settings.music);mixer.setBusLevels();music.update(pendingState);}
  function setSfxEnabled(value){settings.sfxEnabled=!!value;writeAudioSetting('sfxEnabled',settings.sfxEnabled?1:0);mixer.setBusLevels();}
  function setMusicEnabled(value){
    settings.musicEnabled=!!value;writeAudioSetting('musicEnabled',settings.musicEnabled?1:0);mixer.setBusLevels();
    if(settings.musicEnabled)unlock();music.update(pendingState);
  }
  function setImpactIntensity(value){
    settings.impactIntensity=clamp(value);writeAudioSetting('impactIntensity',settings.impactIntensity);return settings.impactIntensity;
  }

  function setMixSnapshot(name){
    const normalized=String(name||'').toLowerCase();
    const mode=normalized==='banana power'?'playing':normalized;
    const specialActive=normalized==='banana power'||normalized==='banana_power';
    music.update({mode,intensity:pendingState.intensity,specialActive});
    if(normalized==='results')music.duck('results',.12,.12);
    return normalized;
  }

  function getSemanticFeedback(){return {carve:{...lastSemanticFeedback.carve}};}
  function subscribeSemanticEvents(listener){return router.subscribe(listener);}

  function addListener(target,type,handler,options){
    if(!target?.addEventListener)return;
    target.addEventListener(type,handler,options);
    removers.push(()=>{try{target.removeEventListener(type,handler,options);}catch{}});
  }

  function handleVisibility(){
    hidden=!!globalThis.document?.hidden;
    mixer.setLifecycleAudible(!hidden&&focused);
    if(hidden){
      weather.silence();
      mixer.suspend();
    }else{
      mixer.resume();
      applyState(pendingState,true);
    }
  }

  function handleBlur(){focused=false;mixer.setLifecycleAudible(false);}
  function handleFocus(){focused=true;mixer.setLifecycleAudible(!hidden);if(!hidden)mixer.resume();}
  function handleDeviceChange(){deviceChangeCount++;mixer.resume();}
  function handlePageHide(event){if(event?.persisted)mixer.suspend();else dispose();}

  const unlockHandler=()=>unlock();
  addListener(globalThis.document,'pointerdown',unlockHandler,{once:true,capture:true});
  addListener(globalThis.document,'keydown',unlockHandler,{once:true,capture:true});
  addListener(globalThis.document,'visibilitychange',handleVisibility);
  addListener(globalThis.window,'blur',handleBlur);
  addListener(globalThis.window,'focus',handleFocus);
  addListener(globalThis.window,'pagehide',handlePageHide);
  addListener(globalThis.navigator?.mediaDevices,'devicechange',handleDeviceChange);

  function getDiagnostics(){
    const m=mixer.diagnostics(),w=weather.diagnostics(),wa=world.diagnostics(),mu=music.diagnostics(),events=router.diagnostics(),skate=skateboard.diagnostics();
    return {
      ...m,
      persistentLoopCount:m.persistentLoopCount+w.persistentLoopCount+wa.persistentLoopCount,
      bufferCountEstimate:(m.bufferCountEstimate??m.bufferCount)+w.bufferCount+wa.bufferCount,
      activeNodeEstimate:m.activeNodeEstimate+w.activeNodeEstimate+wa.activeNodeEstimate,
      activeEnvironmentalTransientCount:w.activeThunderCount,
      rideAudioMode:rideMode,
      sportMode,
      skateSurface:skate.surface,
      skateQuality:skate.quality,
      skateManual:skate.manual,
      skateDistrict:skate.district,
      grindActive:skate.grind.active,
      weather:w,
      world:wa,
      music:mu,
      semanticEvents:events,
      storage:getAudioStorageDiagnostics(),
      updateCpuMs:{average:updateCpuSamples?updateCpuTotal/updateCpuSamples:0,max:updateCpuMax,samples:updateCpuSamples},
      deviceChangeCount,
      lifecycle:{hidden,focused,disposed},
      jumpMusicInitialized:mu.mediaInitialized,
      jumpMusicReady:mu.mediaReady,
      jumpMusicFailed:mu.mediaFailed,
      jumpMusicPreload:mu.mediaPreload,
      goCue:'procedural-web-audio'
    };
  }

  function dispose(){
    if(disposed)return;disposed=true;
    while(removers.length){try{removers.pop()?.();}catch{}}
    try{globalThis.speechSynthesis?.cancel?.();}catch{}
    weather.dispose();world.dispose();music.dispose();skateboard.reset();router.reset();mixer.dispose();
  }

  return {
    JUMP_MUSIC_URL,
    updateWeather,playWeatherThunder,play,playSpatialEvent,playGoCue,playEdgeContact,playClear,playBananaPickup,playNearMiss,
    playBananaReady,playBananaPowerActivate,playBananaPowerEnd,playNewBest,
    playTrickStart,playTrickSuccess,playTrickFail,playSkateEvent,setSkateSurface,updateSkateState,setAudioQualityProfile,
    resetRun,unlock,update,dispose,setMixSnapshot,
    getSemanticFeedback,subscribeSemanticEvents,getDiagnostics,
    setRideMode,getRideMode,setSportMode,getSportMode,getSettings,
    setMasterVolume,setSfxVolume,setMusicVolume,setSfxEnabled,setMusicEnabled,setImpactIntensity
  };
}
