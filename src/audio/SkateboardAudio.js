import {getSkateContinuousMix,getSkateEventCue,normalizeSkateQualityProfile,normalizeSkateSurface} from '../skateAudioProfile.js';
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function normalizeKey(name){return String(name||'').replace(/[\s-]+/g,'_').toLowerCase();}

export function createSkateboardAudio({mixer,emitSemantic=()=>{}}={}){
  let surface='dry_asphalt',quality='high',manual='none',district='downtown';
  let grind={active:false,intensity:0,type:'50-50',surface:'grind_rail',balance:0};
  const scratch={};

  function setSurface(next){surface=normalizeSkateSurface(next);return surface;}
  function setQuality(next){quality=normalizeSkateQualityProfile(next);return quality;}

  function update(state={},speed01=0,{running=true,countdown=false}={}){
    const graph=mixer?.getGraph?.();if(!graph)return;
    if(state.surface!=null)setSurface(state.surface);
    if(state.manual!=null)manual=String(state.manual||'none').toLowerCase().replace(/\s+/g,'_');
    if(state.district!=null)district=String(state.district||'downtown').toLowerCase();
    if(state.grind)grind={...grind,...state.grind,active:state.grind.active!==false};
    const slide=clamp(Math.max(Number(state.slideAmount)||0,Number(state.lateralSlip)||0,Number(state.powerslide)||0,grind.active?grind.intensity*.18:0));
    const mix=getSkateContinuousMix(
      speed01,slide,state.wetness||0,!!state.air,surface,manual,quality,scratch,
      {
        grip:state.grip,
        lateralSlip:state.lateralSlip,
        powerslide:state.powerslide,
        landingState:state.landingState,
        landingGripLoss:state.landingGripLoss
      }
    );
    const audible=running?1:0;
    mixer.setTarget(graph.skateWheelLow.gain.gain,mix.lowRoll*audible,.08);
    mixer.setTarget(graph.skateBearing.gain.gain,mix.bearing*audible,.10);
    mixer.setTarget(graph.skateRoad.gain.gain,mix.roadHiss*audible,.12);
    mixer.setTarget(graph.skateWet.gain.gain,mix.wetHiss*audible,.18);
    mixer.setTarget(graph.skateSlide.gain.gain,(mix.slide+(grind.active?grind.intensity*.020:0))*audible,.055);
    mixer.setTarget(graph.skateWheelLow.filter.frequency,mix.lowFrequency,.12);
    mixer.setTarget(graph.skateBearing.filter.frequency,mix.bearingFrequency,.10);
    mixer.setTarget(graph.skateRoad.filter.frequency,mix.roadFrequency,.12);
    mixer.setTarget(graph.skateSlide.filter.frequency,mix.slideFrequency,.08);
    void countdown;
  }

  function semanticFor(key,payload){
    if(key==='grindstart'||key==='grind_start')return ['GRIND_START',{intensity:payload.intensity??.7,source:'skate'}];
    if(key==='grindend'||key==='grind_end')return ['GRIND_END',{intensity:payload.intensity??.55,source:'skate'}];
    if(key==='hardland'||key==='hard_land')return ['HARD_LANDING',{intensity:payload.intensity??.85,source:'skate'}];
    if(key==='land')return ['LANDING',{intensity:payload.intensity??.5,source:'skate'}];
    if(key==='powerslidestart'||key==='powerslide_start')return ['POWERSLIDE_START',{intensity:payload.intensity??.6,source:'skate'}];
    if(key==='powerslideend'||key==='powerslide_end')return ['POWERSLIDE_END',{intensity:payload.intensity??.4,source:'skate'}];
    if(key==='tailpop'||key==='tail_pop')return [payload.nollie?'NOLLIE':'OLLIE',{intensity:payload.intensity??.65,source:'skate'}];
    return null;
  }

  function routeEvent(name,payload={}){
    const key=normalizeKey(name);
    if(key==='surfacechanged'||key==='surface_changed'){setSurface(payload.surface);return null;}
    if(key==='powerslideloop'||key==='powerslide_loop')payload.intensity=clamp(payload.intensity??payload.amount??.5);
    if(key==='manualstart'||key==='manual_start')manual=String(payload.type||payload.mode||'manual').toLowerCase().replace(/\s+/g,'_');
    if(key==='manualend'||key==='manual_end')manual='none';
    if(key==='grindstart'||key==='grind_start'||key==='grindloop'||key==='grind_loop'){
      grind={active:true,intensity:clamp(payload.intensity??.6),type:payload.type||payload.trick||grind.type,
        surface:payload.surface||grind.surface,balance:Number(payload.balance)||0};
    }
    if(key==='grindend'||key==='grind_end')grind={...grind,active:false,intensity:0,balance:0};
    const semantic=semanticFor(key,payload);if(semantic)emitSemantic(semantic[0],semantic[1]);
    return getSkateEventCue(name,{...payload,surface:payload.surface||grind.surface,type:payload.type||payload.trick||grind.type});
  }

  function reset(){surface='dry_asphalt';manual='none';district='downtown';grind={active:false,intensity:0,type:'50-50',surface:'grind_rail',balance:0};}
  function diagnostics(){return {surface,quality,manual,district,grind:{...grind}};}
  return {update,routeEvent,setSurface,setQuality,reset,diagnostics};
}
