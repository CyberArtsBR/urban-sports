import * as THREE from 'three';
import {
  TRICK_LANDING_SAFETY_MARGIN,
  TRICK_TIMING,
  estimateRemainingAirTime,
  evaluateTrickTiming
} from './trickTiming.js';

const TAU=Math.PI*2;
const COMPLETE_EPSILON=THREE.MathUtils.degToRad(8);

export const TRICK_STATE=Object.freeze({
  NONE:'NONE',
  SPIN_360:'SPIN_360',
  BACKFLIP:'BACKFLIP',
  TRICK:'TRICK',
  COMPLETED:'COMPLETED',
  FAILED:'FAILED'
});

export const TRICK_TYPE=Object.freeze({
  SPIN_180:'180',
  SPIN_360:'360',
  BACKFLIP:'BACKFLIP',
  KICKFLIP:'KICKFLIP',
  HEELFLIP:'HEELFLIP',
  POP_SHOVE_IT:'POP SHOVE-IT',
  FRONTSIDE_SHOVE_IT:'FRONTSIDE SHOVE-IT',
  INDY:'INDY',
  MELON:'MELON',
  NOSEGRAB:'NOSEGRAB',
  VARIAL_FLIP:'VARIAL FLIP',
  TRE_FLIP:'360 FLIP'
});

export const TRICK_TUNING=Object.freeze({
  SPIN_360_DEGREES_PER_SECOND:TRICK_TIMING[TRICK_TYPE.SPIN_360].degreesPerSecond,
  BACKFLIP_DEGREES_PER_SECOND:TRICK_TIMING[TRICK_TYPE.BACKFLIP].degreesPerSecond,
  LANDING_SAFETY_MARGIN:TRICK_LANDING_SAFETY_MARGIN,
  COMPLETE_EPSILON_DEGREES:8
});

const TARGET_ROTATION=Object.freeze(Object.fromEntries(
  Object.values(TRICK_TYPE).map(type=>[type,THREE.MathUtils.degToRad(TRICK_TIMING[type]?.targetDegrees||0)])
));
const FLIP_TRICKS=new Set([TRICK_TYPE.KICKFLIP,TRICK_TYPE.HEELFLIP,TRICK_TYPE.VARIAL_FLIP,TRICK_TYPE.TRE_FLIP]);
const SHOVE_TRICKS=new Set([TRICK_TYPE.POP_SHOVE_IT,TRICK_TYPE.FRONTSIDE_SHOVE_IT]);

function activeState(type){
  if(type===TRICK_TYPE.BACKFLIP)return TRICK_STATE.BACKFLIP;
  if(type===TRICK_TYPE.SPIN_360)return TRICK_STATE.SPIN_360;
  return TRICK_STATE.TRICK;
}

export function createTrickSystem({visualTarget=null}={}){
  const axisX=new THREE.Vector3(1,0,0);
  const axisY=new THREE.Vector3(0,1,0);
  const baseQuaternion=new THREE.Quaternion();
  const trickQuaternion=new THREE.Quaternion();
  const snapshot={
    state:TRICK_STATE.NONE,
    type:'',
    progress:0,
    rotation:0,
    elapsed:0,
    startTime:0,
    source:'',
    completed:false,
    landingValid:true,
    tricksThisAir:0,
    remainingAirTime:0,
    trickAllowed:false,
    pendingTrick:'',
    lastCompletedType:'',
    lastRejectedType:'',
    rejectionReason:''
  };
  let visualPivot=null;
  let pendingRampType=null;
  let completion=null;
  let completionId=0;
  let previousAir=false;

  function isActive(){
    return snapshot.state===TRICK_STATE.SPIN_360||snapshot.state===TRICK_STATE.BACKFLIP||snapshot.state===TRICK_STATE.TRICK;
  }

  function normalizeVisual(){
    if(visualPivot?.quaternion)visualPivot.quaternion.copy(baseQuaternion);
  }

  function setVisualTarget(next){
    normalizeVisual();
    visualPivot=next||null;
    if(visualPivot?.quaternion)baseQuaternion.copy(visualPivot.quaternion);
    else baseQuaternion.identity();
    if(isActive())applyVisual();
  }

  function applyVisual(){
    if(!visualPivot?.quaternion||!isActive())return;
    let axis=null;
    if(snapshot.type===TRICK_TYPE.BACKFLIP)axis=axisX;
    else if(FLIP_TRICKS.has(snapshot.type))axis=new THREE.Vector3(0,0,1);
    else if(snapshot.type===TRICK_TYPE.SPIN_360||snapshot.type===TRICK_TYPE.SPIN_180||SHOVE_TRICKS.has(snapshot.type))axis=axisY;
    if(!axis)return;
    // Positive X remains the backward somersault direction for BACKFLIP.
    const reverse=snapshot.type===TRICK_TYPE.HEELFLIP||snapshot.type===TRICK_TYPE.FRONTSIDE_SHOVE_IT;
    const angle=snapshot.rotation*(reverse?-1:1);
    trickQuaternion.setFromAxisAngle(axis,angle);
    visualPivot.quaternion.copy(baseQuaternion).multiply(trickQuaternion);
  }

  function beginAirIfNeeded(physicsState){
    const air=!!physicsState?.air;
    if(air&&!previousAir){
      snapshot.tricksThisAir=0;
      snapshot.lastCompletedType='';
      snapshot.lastRejectedType='';
      snapshot.rejectionReason='';
    }
    previousAir=air;
  }

  function updateTiming(physicsState,{landingHeight=0,gravity}={}){
    beginAirIfNeeded(physicsState);
    snapshot.remainingAirTime=estimateRemainingAirTime(physicsState,{landingHeight,gravity});
    if(!physicsState?.air){
      snapshot.trickAllowed=false;
      snapshot.remainingAirTime=0;
    }
    return snapshot.remainingAirTime;
  }

  function evaluateStart(type,physicsState,{landingHeight=0,gravity,landingSafetyMargin=TRICK_LANDING_SAFETY_MARGIN}={}){
    beginAirIfNeeded(physicsState);
    const timing=evaluateTrickTiming(type,physicsState,{landingHeight,gravity,landingSafetyMargin});
    snapshot.remainingAirTime=timing.remainingAirTime;
    snapshot.trickAllowed=!isActive()&&timing.allowed;
    snapshot.lastRejectedType='';
    snapshot.rejectionReason='';
    if(isActive()){
      snapshot.trickAllowed=false;
      snapshot.lastRejectedType=type||'';
      snapshot.rejectionReason='busy';
    }else if(!timing.allowed){
      snapshot.lastRejectedType=type||'';
      snapshot.rejectionReason=physicsState?.air?'insufficient-airtime':'not-airborne';
    }
    return {...timing,allowed:snapshot.trickAllowed};
  }

  function start(type,{
    source='manual',
    startTime=0,
    physicsState=null,
    landingHeight=0,
    gravity,
    landingSafetyMargin=TRICK_LANDING_SAFETY_MARGIN
  }={}){
    if(!TRICK_TIMING[type]){
      snapshot.trickAllowed=false;
      snapshot.lastRejectedType=type||'';
      snapshot.rejectionReason='unknown-trick';
      return false;
    }
    const timing=evaluateStart(type,physicsState,{landingHeight,gravity,landingSafetyMargin});
    if(!timing.allowed)return false;

    snapshot.state=activeState(type);
    snapshot.type=type;
    snapshot.progress=0;
    snapshot.rotation=0;
    snapshot.elapsed=0;
    snapshot.startTime=Number(startTime)||0;
    snapshot.source=source||'manual';
    snapshot.completed=false;
    snapshot.landingValid=true;
    snapshot.trickAllowed=true;
    normalizeVisual();
    return true;
  }

  function requestAirborne(type,physicsState,options={}){
    if(!physicsState?.air)return false;
    // Consume the airborne Jump request regardless of acceptance. This prevents
    // rejected/late trick input from surviving as a landing bounce/double jump.
    physicsState.jumpBufferTime=0;
    physicsState.jumpBuffered=false;
    return start(type,{
      ...options,
      source:options.source||physicsState.jumpSource||'manual',
      startTime:options.startTime??physicsState.time??0,
      physicsState
    });
  }

  function startSecondPress360(physicsState,options={}){
    return requestAirborne(TRICK_TYPE.SPIN_360,physicsState,options);
  }

  function armRamp(type){
    if(isActive()||!TRICK_TIMING[type])return false;
    pendingRampType=type;
    snapshot.pendingTrick=type;
    return true;
  }

  function consumeRampArm(){
    const type=pendingRampType;
    pendingRampType=null;
    snapshot.pendingTrick='';
    return type;
  }

  function clearRampArm(){
    pendingRampType=null;
    snapshot.pendingTrick='';
  }

  function completeActive(){
    const completedType=snapshot.type;
    const completedSource=snapshot.source;
    const completedStartTime=snapshot.startTime;
    snapshot.rotation=TARGET_ROTATION[completedType]||TAU;
    snapshot.progress=1;
    snapshot.completed=true;
    snapshot.state=TRICK_STATE.COMPLETED;
    applyVisual();
    normalizeVisual();

    snapshot.tricksThisAir++;
    snapshot.lastCompletedType=completedType;
    completion={
      id:++completionId,
      type:completedType,
      source:completedSource,
      startTime:completedStartTime
    };

    // A full rotation is equivalent to neutral. Reset the pivot and active
    // rotation immediately so another trick may begin in the same airtime.
    snapshot.state=TRICK_STATE.NONE;
    snapshot.type='';
    snapshot.progress=0;
    snapshot.rotation=0;
    snapshot.elapsed=0;
    snapshot.startTime=0;
    snapshot.source='';
    snapshot.completed=false;
    snapshot.landingValid=true;
    snapshot.trickAllowed=false;
  }

  function step(dt){
    if(!isActive())return snapshot;
    const frameDt=Math.max(0,Number(dt)||0);
    const timing=TRICK_TIMING[snapshot.type];
    const duration=Math.max(.001,Number(timing?.duration)||Infinity);
    snapshot.elapsed+=frameDt;
    snapshot.progress=Math.min(1,snapshot.elapsed/duration);
    snapshot.rotation=(TARGET_ROTATION[snapshot.type]||0)*snapshot.progress;
    if(snapshot.progress>=1-COMPLETE_EPSILON/TAU)completeActive();
    else applyVisual();
    return snapshot;
  }

  function consumeCompletion(){
    const event=completion;
    completion=null;
    return event;
  }

  function land({jumpSource=''}={}){
    const interrupted=isActive();
    const result={
      hadTrick:snapshot.tricksThisAir>0||interrupted,
      success:!interrupted,
      interrupted,
      type:interrupted?snapshot.type:snapshot.lastCompletedType,
      source:interrupted?snapshot.source:jumpSource,
      completed:!interrupted,
      landingValid:!interrupted,
      reason:interrupted?'landing-interruption':''
    };

    clearRampArm();
    snapshot.remainingAirTime=0;
    snapshot.trickAllowed=false;
    previousAir=false;

    if(interrupted){
      snapshot.state=TRICK_STATE.FAILED;
      snapshot.completed=false;
      snapshot.landingValid=false;
      snapshot.lastRejectedType=snapshot.type;
      snapshot.rejectionReason='landing-interruption';
      normalizeVisual();
    }else{
      snapshot.state=TRICK_STATE.NONE;
      snapshot.type='';
      snapshot.progress=0;
      snapshot.rotation=0;
      snapshot.startTime=0;
      snapshot.source='';
      snapshot.completed=false;
      snapshot.landingValid=true;
      snapshot.tricksThisAir=0;
      normalizeVisual();
    }
    return result;
  }

  function finishLanding(){
    const wasTerminal=snapshot.state===TRICK_STATE.COMPLETED||snapshot.state===TRICK_STATE.FAILED;
    snapshot.state=TRICK_STATE.NONE;
    snapshot.type='';
    snapshot.progress=0;
    snapshot.rotation=0;
    snapshot.elapsed=0;
    snapshot.startTime=0;
    snapshot.source='';
    snapshot.completed=false;
    snapshot.landingValid=true;
    snapshot.tricksThisAir=0;
    snapshot.remainingAirTime=0;
    snapshot.trickAllowed=false;
    snapshot.lastRejectedType='';
    snapshot.rejectionReason='';
    normalizeVisual();
    return wasTerminal;
  }

  function abort({reason='interrupted'}={}){
    if(!isActive()){
      clearRampArm();
      return null;
    }
    const result={
      hadTrick:true,
      success:false,
      interrupted:true,
      type:snapshot.type,
      source:snapshot.source,
      completed:false,
      landingValid:false,
      reason
    };
    snapshot.state=TRICK_STATE.FAILED;
    snapshot.completed=false;
    snapshot.landingValid=false;
    snapshot.trickAllowed=false;
    snapshot.lastRejectedType=snapshot.type;
    snapshot.rejectionReason=reason;
    clearRampArm();
    normalizeVisual();
    return result;
  }

  function getSnapshot(){
    return {...snapshot};
  }

  function reset(){
    normalizeVisual();
    snapshot.state=TRICK_STATE.NONE;
    snapshot.type='';
    snapshot.progress=0;
    snapshot.rotation=0;
    snapshot.elapsed=0;
    snapshot.startTime=0;
    snapshot.source='';
    snapshot.completed=false;
    snapshot.landingValid=true;
    snapshot.tricksThisAir=0;
    snapshot.remainingAirTime=0;
    snapshot.trickAllowed=false;
    snapshot.pendingTrick='';
    snapshot.lastCompletedType='';
    snapshot.lastRejectedType='';
    snapshot.rejectionReason='';
    pendingRampType=null;
    completion=null;
    previousAir=false;
  }

  if(visualTarget)setVisualTarget(visualTarget);
  return {
    state:snapshot,
    setVisualTarget,
    start,
    requestAirborne,
    startSecondPress360,
    armRamp,
    consumeRampArm,
    clearRampArm,
    updateTiming,
    evaluateStart,
    step,
    consumeCompletion,
    land,
    finishLanding,
    abort,
    reset,
    getSnapshot
  };
}
