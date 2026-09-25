const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));

export const BANANA_VFX_PHASE=Object.freeze({
  IDLE:'idle',
  READY:'ready',
  ACTIVATING:'activating',
  ACTIVE:'active',
  ENDING:'ending'
});

export function createBananaPowerVfxState({reducedMotion=false}={}){
  let phase=BANANA_VFX_PHASE.IDLE;
  let time=0;
  let active=false;
  let ready=false;

  const style={
    phase,
    energy:0,
    emission:0,
    trailPower:0,
    particleScale:0,
    streakScale:0,
    flashScale:0
  };

  function setReducedMotion(value){
    reducedMotion=!!value;
  }

  function markReady(){
    ready=true;
    if(!active)phase=BANANA_VFX_PHASE.READY;
    time=0;
  }

  function start(){
    active=true;
    ready=false;
    phase=BANANA_VFX_PHASE.ACTIVATING;
    time=0;
  }

  function end(){
    if(!active&&phase===BANANA_VFX_PHASE.IDLE)return;
    active=false;
    phase=BANANA_VFX_PHASE.ENDING;
    time=0;
  }

  function reset(){
    phase=BANANA_VFX_PHASE.IDLE;
    time=0;
    active=false;
    ready=false;
  }

  function getStyle(){
    const activation=phase===BANANA_VFX_PHASE.ACTIVATING
      ?clamp(time/.16)
      :phase===BANANA_VFX_PHASE.ACTIVE?1:0;
    const ending=phase===BANANA_VFX_PHASE.ENDING?1-clamp(time/.34):0;
    const energy=Math.max(
      activation,
      ending,
      phase===BANANA_VFX_PHASE.READY?.16:0
    );

    style.phase=phase;
    style.energy=energy;
    style.emission=phase===BANANA_VFX_PHASE.READY?.16:.18+energy*.82;
    style.trailPower=(active||phase===BANANA_VFX_PHASE.ACTIVATING||phase===BANANA_VFX_PHASE.ENDING)?energy:0;
    style.particleScale=reducedMotion
      ?.28
      :phase===BANANA_VFX_PHASE.ACTIVATING
        ?1
        :phase===BANANA_VFX_PHASE.ACTIVE
          ?.55
          :phase===BANANA_VFX_PHASE.ENDING?.32:0;
    style.streakScale=reducedMotion
      ?.18
      :phase===BANANA_VFX_PHASE.ACTIVE
        ?.72
        :energy*.46;
    style.flashScale=reducedMotion
      ?.12
      :phase===BANANA_VFX_PHASE.ACTIVATING?1:0;
    return style;
  }

  function update(dt){
    time+=Math.max(0,Number(dt)||0);
    if(phase===BANANA_VFX_PHASE.ACTIVATING&&time>=.16){
      phase=BANANA_VFX_PHASE.ACTIVE;
      time=0;
    }
    if(phase===BANANA_VFX_PHASE.ENDING&&time>=.34){
      phase=ready?BANANA_VFX_PHASE.READY:BANANA_VFX_PHASE.IDLE;
      time=0;
    }
    return getStyle();
  }

  return {
    markReady,
    start,
    end,
    reset,
    update,
    getStyle,
    setReducedMotion,
    get phase(){return phase;}
  };
}
