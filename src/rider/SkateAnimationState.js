export const SKATE_ANIMATION_STATE=Object.freeze({
  IDLE:'IDLE',
  ROLL:'ROLL',
  PUSH:'PUSH',
  ACCELERATE:'ACCELERATE',
  CARVE_LEFT:'CARVE_LEFT',
  CARVE_RIGHT:'CARVE_RIGHT',
  DEEP_CARVE:'DEEP_CARVE',
  POWERSLIDE_LEFT:'POWERSLIDE_LEFT',
  POWERSLIDE_RIGHT:'POWERSLIDE_RIGHT',
  CROUCH:'CROUCH',
  OLLIE_ANTICIPATION:'OLLIE_ANTICIPATION',
  OLLIE_COMPRESSION:'OLLIE_COMPRESSION',
  OLLIE_POP:'OLLIE_POP',
  OLLIE_LEVEL:'OLLIE_LEVEL',
  AIRBORNE:'AIRBORNE',
  LANDING_PREP:'LANDING_PREP',
  SPIN_180:'SPIN_180',
  SPIN_360:'SPIN_360',
  KICKFLIP:'KICKFLIP',
  HEELFLIP:'HEELFLIP',
  SHOVE_IT:'SHOVE_IT',
  FRONTSIDE_SHOVE:'FRONTSIDE_SHOVE',
  VARIAL_FLIP:'VARIAL_FLIP',
  THREE_SIXTY_FLIP:'THREE_SIXTY_FLIP',
  GRAB:'GRAB',
  MANUAL:'MANUAL',
  NOSE_MANUAL:'NOSE_MANUAL',
  GRIND:'GRIND',
  SLIDE:'SLIDE',
  LAND:'LAND',
  SKETCHY_LAND:'SKETCHY_LAND',
  HARD_LAND:'HARD_LAND',
  FAILED_LAND:'FAILED_LAND',
  RECOVERY:'RECOVERY',
  BANANA_POWER:'BANANA_POWER',
  CRASH:'CRASH'
});

const STATE_VALUES=new Set(Object.values(SKATE_ANIMATION_STATE));
const STATE_ALIASES=Object.freeze({
  AIR:SKATE_ANIMATION_STATE.AIRBORNE,
  OLLIE_AIR:SKATE_ANIMATION_STATE.AIRBORNE,
  POWERSLIDE:null,
  SHOVEIT:SKATE_ANIMATION_STATE.SHOVE_IT,
  POP_SHOVE_IT:SKATE_ANIMATION_STATE.SHOVE_IT,
  FRONTSIDE_SHOVE_IT:SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE,
  VARIAL:SKATE_ANIMATION_STATE.VARIAL_FLIP,
  TRE_FLIP:SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP,
  THREE_SIXTY:SKATE_ANIMATION_STATE.SPIN_360
});
const TRICK_STATE=Object.freeze({
  '180':SKATE_ANIMATION_STATE.SPIN_180,
  SPIN_180:SKATE_ANIMATION_STATE.SPIN_180,
  '360':SKATE_ANIMATION_STATE.SPIN_360,
  SPIN_360:SKATE_ANIMATION_STATE.SPIN_360,
  KICKFLIP:SKATE_ANIMATION_STATE.KICKFLIP,
  HEELFLIP:SKATE_ANIMATION_STATE.HEELFLIP,
  SHOVE_IT:SKATE_ANIMATION_STATE.SHOVE_IT,
  SHOVEIT:SKATE_ANIMATION_STATE.SHOVE_IT,
  POP_SHOVE_IT:SKATE_ANIMATION_STATE.SHOVE_IT,
  FRONTSIDE_SHOVE:SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE,
  FRONTSIDE_SHOVE_IT:SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE,
  FS_SHOVE:SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE,
  FS_SHOVE_IT:SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE,
  VARIAL:SKATE_ANIMATION_STATE.VARIAL_FLIP,
  VARIAL_FLIP:SKATE_ANIMATION_STATE.VARIAL_FLIP,
  '360_FLIP':SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP,
  THREE_SIXTY_FLIP:SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP,
  TRE_FLIP:SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP,
  GRAB:SKATE_ANIMATION_STATE.GRAB,
  INDY:SKATE_ANIMATION_STATE.GRAB,
  MELON:SKATE_ANIMATION_STATE.GRAB,
  NOSEGRAB:SKATE_ANIMATION_STATE.GRAB,
  NOSE_GRAB:SKATE_ANIMATION_STATE.GRAB
});

const OLLIE_PHASE_STATE=Object.freeze({
  ANTICIPATION:SKATE_ANIMATION_STATE.OLLIE_ANTICIPATION,
  PRELOAD:SKATE_ANIMATION_STATE.OLLIE_ANTICIPATION,
  COMPRESSION:SKATE_ANIMATION_STATE.OLLIE_COMPRESSION,
  POP:SKATE_ANIMATION_STATE.OLLIE_POP,
  LEVEL:SKATE_ANIMATION_STATE.OLLIE_LEVEL,
  LANDING_PREP:SKATE_ANIMATION_STATE.LANDING_PREP,
  AIR:SKATE_ANIMATION_STATE.AIRBORNE,
  AIRBORNE:SKATE_ANIMATION_STATE.AIRBORNE
});

function clamp(value,min=0,max=1){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function token(value=''){
  return String(value||'')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g,'$1_$2')
    .toUpperCase()
    .replace(/[\s-]+/g,'_')
    .replace(/__+/g,'_');
}

export function normalizeSkateAnimationState(value){
  const normalized=token(value);
  if(STATE_VALUES.has(normalized))return normalized;
  return Object.prototype.hasOwnProperty.call(STATE_ALIASES,normalized)?STATE_ALIASES[normalized]:null;
}

export function normalizeSkateTrick(value){
  const normalized=token(value);
  return TRICK_STATE[normalized]||null;
}

function normalizeManual(value){
  const normalized=token(value);
  if(!normalized)return '';
  return normalized.includes('NOSE')?'NOSE_MANUAL':'MANUAL';
}

function normalizeGrind(value){
  const normalized=token(value);
  if(!normalized)return '';
  return normalized;
}

function normalizeLanding(value){
  const normalized=token(value);
  if(!normalized)return '';
  if(normalized.includes('FAILED'))return 'FAILED';
  if(normalized.includes('HARD'))return 'HARD';
  if(normalized.includes('SKETCH')||normalized.includes('ROUGH'))return 'SKETCHY';
  if(normalized.includes('CLEAN'))return 'CLEAN';
  return normalized;
}

function normalizeStance(value){
  const normalized=token(value);
  if(normalized==='GOOFY')return 'goofy';
  if(normalized==='SWITCH')return 'switch';
  if(normalized==='FAKIE')return 'fakie';
  return 'regular';
}

function isSlide(grindType=''){
  return grindType.includes('SLIDE')||grindType.includes('LIP');
}

function isGrab(trickType=''){
  return ['INDY','MELON','NOSEGRAB','NOSE_GRAB','GRAB'].includes(token(trickType));
}

function genericExplicitState(state){
  return state===SKATE_ANIMATION_STATE.IDLE||
    state===SKATE_ANIMATION_STATE.ROLL||
    state===SKATE_ANIMATION_STATE.PUSH||
    state===SKATE_ANIMATION_STATE.ACCELERATE||
    state===SKATE_ANIMATION_STATE.CARVE_LEFT||
    state===SKATE_ANIMATION_STATE.CARVE_RIGHT||
    state===SKATE_ANIMATION_STATE.AIRBORNE;
}

export function createSkateAnimationStateMachine(){
  let current=SKATE_ANIMATION_STATE.IDLE;
  let previous=SKATE_ANIMATION_STATE.IDLE;
  let stateTime=0;
  let pushClock=0;
  let previousSpeed=0;
  let recoveringFromCrash=false;
  let recoveryRemaining=0;

  const snapshot={
    state:current,
    previousState:previous,
    changed:false,
    stateTime:0,
    speed:0,
    speed01:0,
    steer:0,
    acceleration:0,
    air:false,
    landing:0,
    verticalVelocity:0,
    trickType:'',
    trickProgress:null,
    grabType:'',
    manualType:'',
    manualBalance:0,
    grindType:'',
    grindBalance:0,
    landingQuality:'',
    olliePhase:'',
    pushPhase:0,
    bananaPower:false,
    reducedMotion:false,
    authoritativeEvent:false,
    stance:'regular',
    crashKind:''
  };

  function reset(){
    current=SKATE_ANIMATION_STATE.IDLE;
    previous=current;
    stateTime=0;
    pushClock=0;
    previousSpeed=0;
    recoveringFromCrash=false;
    recoveryRemaining=0;
    Object.assign(snapshot,{
      state:current,previousState:current,changed:false,stateTime:0,
      speed:0,speed01:0,steer:0,acceleration:0,air:false,landing:0,
      verticalVelocity:0,trickType:'',trickProgress:null,grabType:'',
      manualType:'',manualBalance:0,grindType:'',grindBalance:0,
      landingQuality:'',olliePhase:'',pushPhase:0,bananaPower:false,
      reducedMotion:false,authoritativeEvent:false,stance:'regular',crashKind:''
    });
    return snapshot;
  }

  function sample(frame={}){
    const dt=clamp(frame.dt??1/60,1/240,.10);
    const speed=Math.max(0,Number(frame.speed)||0);
    const steer=clamp(frame.steer??frame.edge??0,-1,1);
    const air=!!frame.air;
    const landing=clamp(frame.landing??frame.landingPulse??0);
    const verticalVelocity=Number(frame.verticalVelocity??frame.vy)||0;
    const explicitState=normalizeSkateAnimationState(
      frame.skateState??frame.skateboardState??frame.animationState
    );
    const trickRaw=frame.trickType??frame.trick?.type??frame.activeTrick??'';
    const trickState=normalizeSkateTrick(trickRaw);
    const trickProgress=Number.isFinite(frame.trickProgress)
      ?clamp(frame.trickProgress)
      :Number.isFinite(frame.trick?.progress)?clamp(frame.trick.progress):null;
    const manualType=normalizeManual(
      frame.manualType??frame.manualMode??frame.manual?.type??(frame.manualActive?'manual':'')
    );
    const grindType=normalizeGrind(
      frame.grindType??frame.grindTrick??frame.grind?.type??((frame.grinding||frame.grindActive)?'grind':'')
    );
    const landingQuality=normalizeLanding(
      frame.landingQuality??frame.landingResult??frame.landing?.quality??frame.lastLanding
    );
    const bananaPower=!!(frame.bananaPowerActive??frame.bananaPower??frame.specialActive);
    const reducedMotion=!!frame.reducedMotion;
    const crashed=!!(frame.crashed??frame.crashActive??frame.failed)||
      explicitState===SKATE_ANIMATION_STATE.CRASH;
    const powerslide=!!(frame.powerslide??frame.powerslideActive??frame.skate?.powerslide)||
      String(frame.skateboardState||'').toLowerCase()==='powerslide';
    const crouch=!!(frame.crouch??frame.crouching);
    const explicitPush=frame.pushing??frame.pushActive;
    const reportedAcceleration=Number(frame.acceleration);
    const acceleration=Number.isFinite(reportedAcceleration)
      ?reportedAcceleration
      :(speed-previousSpeed)/dt;
    const accelerating=frame.accelerating!=null?!!frame.accelerating:acceleration>.75;
    const olliePhaseToken=token(frame.olliePhase??frame.jumpPhase);
    const explicitOlliePhase=OLLIE_PHASE_STATE[olliePhaseToken]||null;
    const jumpSource=token(frame.jumpSource);
    const stance=normalizeStance(frame.stance??frame.stanceMode??frame.skateStance);
    const manualBalance=clamp(frame.manualBalance??frame.manual?.balance??0,-1,1);
    const grindBalance=clamp(frame.grindBalance??frame.grind?.balance??0,-1,1);
    const crashKind=token(frame.crashKind??frame.crashType??frame.failureType);
    const authoritativeEvent=!!(
      explicitState||trickRaw||manualType||grindType||landingQuality||
      frame.powerslide!=null||frame.powerslideActive!=null||frame.pushing!=null||
      frame.pushActive!=null||frame.olliePhase||frame.jumpPhase||crashed
    );

    let next=null;

    if(crashed){
      next=SKATE_ANIMATION_STATE.CRASH;
      recoveringFromCrash=true;
      recoveryRemaining=.52;
    }else if(recoveringFromCrash){
      recoveryRemaining=Math.max(0,recoveryRemaining-dt);
      next=SKATE_ANIMATION_STATE.RECOVERY;
      if(recoveryRemaining<=0)recoveringFromCrash=false;
    }

    if(!next&&explicitState&&!genericExplicitState(explicitState))next=explicitState;

    if(!next&&landing>.035&&!air){
      if(landingQuality==='FAILED')next=SKATE_ANIMATION_STATE.FAILED_LAND;
      else if(landingQuality==='HARD')next=SKATE_ANIMATION_STATE.HARD_LAND;
      else if(landingQuality==='SKETCHY')next=SKATE_ANIMATION_STATE.SKETCHY_LAND;
      else next=SKATE_ANIMATION_STATE.LAND;
    }

    if(!next&&grindType)next=isSlide(grindType)?SKATE_ANIMATION_STATE.SLIDE:SKATE_ANIMATION_STATE.GRIND;
    if(!next&&manualType)next=manualType==='NOSE_MANUAL'?SKATE_ANIMATION_STATE.NOSE_MANUAL:SKATE_ANIMATION_STATE.MANUAL;

    if(!next&&air&&trickState)next=trickState;
    if(!next&&air&&isGrab(trickRaw))next=SKATE_ANIMATION_STATE.GRAB;
    if(!next&&air&&explicitOlliePhase){
      if(explicitOlliePhase===SKATE_ANIMATION_STATE.AIRBORNE){
        next=verticalVelocity>2.2
          ?SKATE_ANIMATION_STATE.OLLIE_POP
          :verticalVelocity<-2.0
            ?SKATE_ANIMATION_STATE.LANDING_PREP
            :SKATE_ANIMATION_STATE.OLLIE_LEVEL;
      }else next=explicitOlliePhase;
    }
    if(!next&&air){
      const isBoardPop=jumpSource&&jumpSource!=='RAMP';
      next=isBoardPop&&verticalVelocity>1.15
        ?SKATE_ANIMATION_STATE.OLLIE_POP
        :verticalVelocity<-2.0
          ?SKATE_ANIMATION_STATE.LANDING_PREP
          :Math.abs(verticalVelocity)<=2.0
            ?SKATE_ANIMATION_STATE.OLLIE_LEVEL
            :SKATE_ANIMATION_STATE.AIRBORNE;
    }

    if(!next&&powerslide){
      next=steer<0?SKATE_ANIMATION_STATE.POWERSLIDE_LEFT:SKATE_ANIMATION_STATE.POWERSLIDE_RIGHT;
    }

    if(!next&&crouch)next=SKATE_ANIMATION_STATE.CROUCH;

    const derivedPush=explicitPush==null&&accelerating&&speed>.45&&speed<13.5&&!air;
    if(!next&&(explicitPush===true||derivedPush))next=SKATE_ANIMATION_STATE.PUSH;

    if(!next&&bananaPower)next=SKATE_ANIMATION_STATE.BANANA_POWER;
    if(!next&&accelerating&&speed>.35)next=SKATE_ANIMATION_STATE.ACCELERATE;

    if(!next&&Math.abs(steer)>.70){
      next=SKATE_ANIMATION_STATE.DEEP_CARVE;
    }else if(!next&&Math.abs(steer)>.13){
      next=steer<0?SKATE_ANIMATION_STATE.CARVE_LEFT:SKATE_ANIMATION_STATE.CARVE_RIGHT;
    }

    if(!next&&explicitState)next=explicitState;
    if(!next)next=speed>.25?SKATE_ANIMATION_STATE.ROLL:SKATE_ANIMATION_STATE.IDLE;

    const changed=next!==current;
    if(changed){
      previous=current;
      current=next;
      stateTime=0;
      if(current!==SKATE_ANIMATION_STATE.PUSH)pushClock=0;
    }else{
      stateTime+=dt;
    }

    if(current===SKATE_ANIMATION_STATE.PUSH){
      const cadence=clamp(1.35+speed*.075,1.35,2.75);
      pushClock+=dt*cadence;
    }else{
      pushClock=0;
    }

    const explicitPushProgress=Number(frame.pushProgress);
    const pushPhase=Number.isFinite(explicitPushProgress)
      ?clamp(explicitPushProgress)
      :pushClock%1;

    snapshot.state=current;
    snapshot.previousState=previous;
    snapshot.changed=changed;
    snapshot.stateTime=stateTime;
    snapshot.speed=speed;
    snapshot.speed01=clamp(speed/24);
    snapshot.steer=steer;
    snapshot.acceleration=acceleration;
    snapshot.air=air;
    snapshot.landing=landing;
    snapshot.verticalVelocity=verticalVelocity;
    snapshot.trickType=token(trickRaw);
    snapshot.trickProgress=trickProgress;
    snapshot.grabType=isGrab(trickRaw)?token(trickRaw):token(frame.grabType);
    snapshot.manualType=manualType;
    snapshot.manualBalance=manualBalance;
    snapshot.grindType=grindType;
    snapshot.grindBalance=grindBalance;
    snapshot.landingQuality=landingQuality;
    snapshot.olliePhase=olliePhaseToken;
    snapshot.pushPhase=pushPhase;
    snapshot.bananaPower=bananaPower;
    snapshot.reducedMotion=reducedMotion;
    snapshot.authoritativeEvent=authoritativeEvent;
    snapshot.stance=stance;
    snapshot.crashKind=crashKind;
    previousSpeed=speed;
    return snapshot;
  }

  return {sample,reset,get snapshot(){return snapshot;}};
}
