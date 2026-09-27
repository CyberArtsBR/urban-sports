const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export const HAPTIC_INTENSITY=Object.freeze({
  OFF:'off',
  LOW:'low',
  MEDIUM:'medium',
  HIGH:'high'
});

const INTENSITY_SCALE=Object.freeze({
  [HAPTIC_INTENSITY.OFF]:0,
  [HAPTIC_INTENSITY.LOW]:.36,
  [HAPTIC_INTENSITY.MEDIUM]:.66,
  [HAPTIC_INTENSITY.HIGH]:1
});

export const HAPTIC_PATTERNS=Object.freeze({
  menuMove:Object.freeze({duration:26,weakMagnitude:.07,strongMagnitude:.03}),
  menuConfirm:Object.freeze({duration:44,weakMagnitude:.13,strongMagnitude:.10}),
  ollie:Object.freeze({duration:52,weakMagnitude:.18,strongMagnitude:.25}),
  nollie:Object.freeze({duration:48,weakMagnitude:.20,strongMagnitude:.22}),
  banana:Object.freeze({duration:40,weakMagnitude:.21,strongMagnitude:.09}),
  bananaReady:Object.freeze({duration:80,weakMagnitude:.29,strongMagnitude:.33}),
  bananaPower:Object.freeze({duration:116,weakMagnitude:.37,strongMagnitude:.47}),
  bananaPowerEnd:Object.freeze({duration:50,weakMagnitude:.12,strongMagnitude:.15}),
  nearMiss:Object.freeze({duration:52,weakMagnitude:.23,strongMagnitude:.14}),
  speedTier:Object.freeze({duration:56,weakMagnitude:.13,strongMagnitude:.19}),
  newBest:Object.freeze({duration:118,weakMagnitude:.27,strongMagnitude:.40}),
  rampTakeoff:Object.freeze({duration:56,weakMagnitude:.18,strongMagnitude:.27}),
  landSoft:Object.freeze({duration:42,weakMagnitude:.11,strongMagnitude:.18}),
  landClean:Object.freeze({duration:64,weakMagnitude:.19,strongMagnitude:.30}),
  landHard:Object.freeze({duration:108,weakMagnitude:.40,strongMagnitude:.64}),
  powerslideStart:Object.freeze({duration:58,weakMagnitude:.27,strongMagnitude:.13}),
  powerslideLoop:Object.freeze({duration:74,weakMagnitude:.19,strongMagnitude:.08}),
  powerslideEnd:Object.freeze({duration:42,weakMagnitude:.11,strongMagnitude:.07}),
  grindStart:Object.freeze({duration:68,weakMagnitude:.24,strongMagnitude:.25}),
  grindLoop:Object.freeze({duration:78,weakMagnitude:.18,strongMagnitude:.13}),
  grindEnd:Object.freeze({duration:58,weakMagnitude:.17,strongMagnitude:.22}),
  wetSurface:Object.freeze({duration:42,weakMagnitude:.11,strongMagnitude:.04}),
  trick360Start:Object.freeze({duration:42,weakMagnitude:.12,strongMagnitude:.18}),
  trickBackflipStart:Object.freeze({duration:60,weakMagnitude:.16,strongMagnitude:.29}),
  trick360Success:Object.freeze({duration:70,weakMagnitude:.23,strongMagnitude:.36}),
  trickBackflipSuccess:Object.freeze({duration:90,weakMagnitude:.29,strongMagnitude:.51}),
  trickFail:Object.freeze({duration:104,weakMagnitude:.34,strongMagnitude:.57}),
  oil:Object.freeze({duration:100,weakMagnitude:.45,strongMagnitude:.20}),
  edgeScrape:Object.freeze({duration:52,weakMagnitude:.18,strongMagnitude:.10}),
  crash:Object.freeze({duration:150,weakMagnitude:.64,strongMagnitude:.90})
});

const CONTINUOUS_INTERVAL=.12;

export function normalizeHapticIntensity(value,fallback=HAPTIC_INTENSITY.HIGH){
  const raw=String(value??'').trim().toLowerCase();
  return Object.values(HAPTIC_INTENSITY).includes(raw)?raw:fallback;
}

export function hapticIntensityScale(value){
  return INTENSITY_SCALE[normalizeHapticIntensity(value)]??1;
}

function getActuator(pad){
  if(!pad)return null;
  if(pad.vibrationActuator)return pad.vibrationActuator;
  const actuators=pad.hapticActuators;
  if(actuators?.length)return actuators[0]||null;
  return null;
}

function safePattern(pattern,intensity=1,preferenceScale=1){
  const amount=clamp(Number(intensity)||0)*clamp(preferenceScale);
  return {
    duration:Math.max(0,Math.min(180,Math.round(Number(pattern?.duration)||0))),
    weakMagnitude:clamp((Number(pattern?.weakMagnitude)||0)*amount),
    strongMagnitude:clamp((Number(pattern?.strongMagnitude)||0)*amount)
  };
}

function supportsDualRumble(actuator){
  if(typeof actuator?.playEffect!=='function')return false;
  try{
    const effects=Array.from(actuator.effects||[]);
    return !effects.length||effects.includes('dual-rumble');
  }catch{
    return true;
  }
}

export function createHaptics({getActiveGamepad=null,enabled=true,intensity=HAPTIC_INTENSITY.HIGH}={}){
  let hapticsEnabled=enabled!==false;
  let intensityPreference=normalizeHapticIntensity(intensity);
  let activeGamepad=null,eventLock=0,continuousClock=0,lastWetPulse=-Infinity;
  const failedMethods=new WeakMap();

  function failureSet(actuator){
    if(!actuator||(typeof actuator!=='object'&&typeof actuator!=='function'))return null;
    let set=failedMethods.get(actuator);
    if(!set){set=new Set();failedMethods.set(actuator,set);}
    return set;
  }
  function methodFailed(actuator,method){return !!failedMethods.get(actuator)?.has(method);}
  function markFailed(actuator,method){failureSet(actuator)?.add(method);}
  function invoke(actuator,method,args){
    if(methodFailed(actuator,method)||typeof actuator?.[method]!=='function')return false;
    try{
      const result=actuator[method](...args);
      result?.catch?.(()=>markFailed(actuator,method));
      return true;
    }catch{
      markFailed(actuator,method);return false;
    }
  }
  function resolveActiveGamepad(){
    let candidate=activeGamepad;
    if(!candidate&&typeof getActiveGamepad==='function'){try{candidate=getActiveGamepad()||null;}catch{}}
    if(candidate?.connected===false)return null;
    return candidate||null;
  }
  function setActiveGamepad(gamepad){activeGamepad=gamepad&&gamepad.connected!==false?gamepad:null;return activeGamepad;}
  function clearActiveGamepad(){activeGamepad=null;}
  function getActiveGamepadValue(){return resolveActiveGamepad();}

  function preferenceScale(){
    if(!hapticsEnabled)return 0;
    return INTENSITY_SCALE[intensityPreference]??1;
  }

  function play(pattern,{lock=true,intensity:amount=1}={}){
    const scale=preferenceScale();
    if(scale<=0)return false;
    const safe=safePattern(pattern,amount,scale);
    if(!safe.duration||(!safe.weakMagnitude&&!safe.strongMagnitude))return false;
    const actuator=getActuator(resolveActiveGamepad());
    if(!actuator)return false;

    let played=false;
    if(supportsDualRumble(actuator)&&!methodFailed(actuator,'playEffect')){
      played=invoke(actuator,'playEffect',['dual-rumble',{
        duration:safe.duration,startDelay:0,weakMagnitude:safe.weakMagnitude,strongMagnitude:safe.strongMagnitude
      }]);
    }
    if(!played&&!methodFailed(actuator,'pulse')){
      played=invoke(actuator,'pulse',[Math.max(safe.weakMagnitude,safe.strongMagnitude),safe.duration]);
    }
    if(played&&lock)eventLock=Math.max(eventLock,safe.duration/1000+.025);
    return played;
  }

  function update(dt,feel={}){
    const scale=preferenceScale();
    if(scale<=0)return false;
    const step=Math.max(0,Math.min(.1,Number(dt)||0));
    eventLock=Math.max(0,eventLock-step);continuousClock+=step;
    if(continuousClock<CONTINUOUS_INTERVAL)return false;continuousClock=0;
    if(feel.mode!=='playing'||feel.air||eventLock>0)return false;

    const speed=Math.max(0,Number(feel.speed)||0);
    const maxSpeed=Math.max(speed,Number(feel.maxSpeed)||83.3333);
    const baseSpeed=Math.max(1,Number(feel.baseSpeed)||41.6667);
    const speedProgress=clamp((speed-baseSpeed)/Math.max(.001,maxSpeed-baseSpeed));
    const carve=clamp(Math.abs(Number(feel.edge)||0));
    const terrain=clamp(Math.abs(Number(feel.groundRoll)||0)*2.3+Math.abs(Number(feel.groundPitch)||0)*1.0);
    const slip=clamp(Math.max(Number(feel.slip)||0,Number(feel.powerslide)||0));
    const wetness=clamp(feel.wetness);
    const oilActive=Number(feel.oilSlipTime)>0;
    const grinding=!!feel.grinding;
    const time=Number(feel.time)||0;

    // No always-on baseline rumble: only meaningful traction/surface states speak.
    const meaningful=carve>.16||terrain>.08||slip>.10||oilActive||grinding||speedProgress>.88;
    if(!meaningful)return false;

    let weak=carve*.075+terrain*.035+(speedProgress>.88?(speedProgress-.88)*.22:0);
    let strong=carve*.052+terrain*.052;
    weak+=slip*.15;strong+=slip*.06;
    if(grinding){weak+=.10;strong+=.08;}
    if(oilActive){
      const wobble=.5+.5*Math.sin(time*27);
      weak+=.11+.09*wobble;strong+=.04+.03*(1-wobble);
    }else if(wetness>.45&&slip>.12&&time-lastWetPulse>.7){
      lastWetPulse=time;weak+=.045;
    }
    weak=clamp(weak,0,.27);strong=clamp(strong,0,.25);
    return play({duration:92,weakMagnitude:weak,strongMagnitude:strong},{lock:false});
  }

  function menuMove(amount=1){return play(HAPTIC_PATTERNS.menuMove,{lock:false,intensity:amount});}
  function menuConfirm(amount=1){return play(HAPTIC_PATTERNS.menuConfirm,{intensity:amount});}
  function ollie(amount=1,{nollie=false}={}){return play(nollie?HAPTIC_PATTERNS.nollie:HAPTIC_PATTERNS.ollie,{intensity:amount});}
  function banana(amount=1){return play(HAPTIC_PATTERNS.banana,{intensity:amount});}
  function bananaReady(amount=1){return play(HAPTIC_PATTERNS.bananaReady,{intensity:amount});}
  function bananaPowerActivate(amount=1){return play(HAPTIC_PATTERNS.bananaPower,{intensity:amount});}
  function bananaPowerEnd(amount=1){return play(HAPTIC_PATTERNS.bananaPowerEnd,{intensity:amount});}
  function nearMiss(amount=.65){return play(HAPTIC_PATTERNS.nearMiss,{lock:false,intensity:amount});}
  function speedTier(amount=1){return play(HAPTIC_PATTERNS.speedTier,{intensity:amount});}
  function newBest(amount=1){return play(HAPTIC_PATTERNS.newBest,{intensity:amount});}
  function rampTakeoff(amount=1){return play(HAPTIC_PATTERNS.rampTakeoff,{intensity:amount});}
  function land(impact=0,quality='normal'){
    const amount=clamp(impact),level=clamp(.42+amount*.58);
    if(quality==='hard'||quality==='failed'||amount>=.72)return play(HAPTIC_PATTERNS.landHard,{intensity:level});
    if(quality==='clean'||amount>=.35)return play(HAPTIC_PATTERNS.landClean,{intensity:level});
    return play(HAPTIC_PATTERNS.landSoft,{intensity:level});
  }
  function powerslide(phase='loop',amount=.7){
    if(phase==='start')return play(HAPTIC_PATTERNS.powerslideStart,{intensity:amount});
    if(phase==='end')return play(HAPTIC_PATTERNS.powerslideEnd,{lock:false,intensity:amount});
    return play(HAPTIC_PATTERNS.powerslideLoop,{lock:false,intensity:amount});
  }
  function grind(phase='loop',amount=.7){
    if(phase==='start')return play(HAPTIC_PATTERNS.grindStart,{intensity:amount});
    if(phase==='end')return play(HAPTIC_PATTERNS.grindEnd,{intensity:amount});
    return play(HAPTIC_PATTERNS.grindLoop,{lock:false,intensity:amount});
  }
  function wetSurface(amount=.45){return play(HAPTIC_PATTERNS.wetSurface,{lock:false,intensity:amount});}
  function trickStart(type,amount=1){return play(type==='backflip'?HAPTIC_PATTERNS.trickBackflipStart:HAPTIC_PATTERNS.trick360Start,{intensity:amount});}
  function trickSuccess(type,amount=1){return play(type==='backflip'?HAPTIC_PATTERNS.trickBackflipSuccess:HAPTIC_PATTERNS.trick360Success,{intensity:amount});}
  function trickFail(type='360',amount=1){void type;return play(HAPTIC_PATTERNS.trickFail,{intensity:amount});}
  function oil(amount=1){return play(HAPTIC_PATTERNS.oil,{intensity:amount});}
  function edgeScrape(amount=.5){return play(HAPTIC_PATTERNS.edgeScrape,{lock:false,intensity:amount});}
  function crash(kind='tree',amount=1){
    const base=HAPTIC_PATTERNS.crash;
    let multiplier=.88;
    if(kind==='rock'||kind==='collision')multiplier=1;
    else if(kind==='wideLog'||kind==='log')multiplier=.94;
    return play({duration:base.duration,weakMagnitude:base.weakMagnitude*multiplier,strongMagnitude:base.strongMagnitude*multiplier},{intensity:amount});
  }

  function emit(event,data={}){
    const amount=data.intensity??1;
    switch(event){
      case 'menuMove':return menuMove(amount);
      case 'menuConfirm':return menuConfirm(amount);
      case 'ollie':return ollie(amount,{nollie:false});
      case 'nollie':return ollie(amount,{nollie:true});
      case 'pickup':
      case 'banana':return banana(amount);
      case 'bananaReady':return bananaReady(amount);
      case 'bananaPower':return bananaPowerActivate(amount);
      case 'bananaPowerEnd':return bananaPowerEnd(amount);
      case 'nearMiss':return nearMiss(amount);
      case 'speedTier':return speedTier(amount);
      case 'newBest':return newBest(amount);
      case 'rampLaunch':
      case 'rampTakeoff':return rampTakeoff(amount);
      case 'landing':return land(data.impact??amount,data.quality||'normal');
      case 'powerslideStart':return powerslide('start',amount);
      case 'powerslideLoop':return powerslide('loop',amount);
      case 'powerslideEnd':return powerslide('end',amount);
      case 'grindStart':return grind('start',amount);
      case 'grindLoop':return grind('loop',amount);
      case 'grindEnd':return grind('end',amount);
      case 'wetSurface':return wetSurface(amount);
      case 'trickStart':return trickStart(data.type,amount);
      case 'trickSuccess':return trickSuccess(data.type,amount);
      case 'trickFail':return trickFail(data.type,amount);
      case 'softHazard':
      case 'oil':return oil(amount);
      case 'edgeScrape':
      case 'edgeContact':return edgeScrape(amount);
      case 'collision':
      case 'crash':return crash(data.kind||'collision',amount);
      default:return false;
    }
  }

  function reset(){
    eventLock=0;continuousClock=0;lastWetPulse=-Infinity;
    const actuator=getActuator(resolveActiveGamepad());
    if(actuator)invoke(actuator,'reset',[]);
  }
  function setEnabled(value){hapticsEnabled=!!value;if(!hapticsEnabled)reset();return hapticsEnabled;}
  function isEnabled(){return hapticsEnabled&&intensityPreference!==HAPTIC_INTENSITY.OFF;}
  function setIntensityPreference(value){
    intensityPreference=normalizeHapticIntensity(value);
    if(intensityPreference===HAPTIC_INTENSITY.OFF)reset();
    return intensityPreference;
  }
  function getIntensityPreference(){return intensityPreference;}
  function diagnostics(){
    const pad=resolveActiveGamepad();
    return {
      enabled:hapticsEnabled,
      intensity:intensityPreference,
      intensityScale:preferenceScale(),
      activeIndex:Number.isInteger(pad?.index)?pad.index:null,
      activeId:String(pad?.id||''),
      hasActuator:!!getActuator(pad),
      failedMethodCount:getActuator(pad)?(failedMethods.get(getActuator(pad))?.size||0):0
    };
  }

  return {
    setActiveGamepad,clearActiveGamepad,setEnabled,isEnabled,setIntensityPreference,getIntensityPreference,
    getActiveGamepad:getActiveGamepadValue,emit,diagnostics,reset,update,menuMove,menuConfirm,
    ollie,pickup:banana,banana,bananaReady,bananaPowerActivate,bananaPowerEnd,nearMiss,speedTier,newBest,
    rampLaunch:rampTakeoff,rampTakeoff,land,powerslide,grind,wetSurface,trickStart,trickSuccess,trickFail,
    softHazard:oil,oil,edgeScrape,collision:crash,crash
  };
}
