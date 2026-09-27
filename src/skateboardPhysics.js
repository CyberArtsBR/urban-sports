import {getRideProfile} from './rideMode.js';
import {resolveCourseEdgeContact} from './edgeContact.js';
import {getSkateboardSetupProfile} from './skateboardSetup.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const lerp=(a,b,t)=>a+(b-a)*clamp(t,0,1);
const damp=(a,b,r,dt)=>b+(Number(a||0)-b)*Math.exp(-Math.max(0,r)*Math.max(0,Number(dt)||0));

export const SKATEBOARD_LANDING=Object.freeze({CLEAN:'clean',SKETCHY:'sketchy',HARD:'hard',FAILED:'failed'});
export const SKATEBOARD_ANIMATION_STATE=Object.freeze({IDLE:'idle',PUSH:'push',CARVE_LEFT:'carveLeft',CARVE_RIGHT:'carveRight',POWERSLIDE:'powerslide',OLLIE_COMPRESSION:'ollieCompression',OLLIE_POP:'olliePop',AIR:'air',KICKFLIP:'kickflip',HEELFLIP:'heelflip',SHOVEIT:'shoveit',MANUAL:'manual',NOSE_MANUAL:'noseManual',GRIND:'grind',LAND:'land',HARD_LAND:'hardLand',CRASH:'crash'});
export const SKATEBOARD_TUNING=Object.freeze({
  PLAYER_BOUNDARY_HALF_WIDTH:13.10,
  INPUT_DEADZONE:.018,
  PHYSICS_SUBSTEP_SECONDS:1/180,

  DISPLAY_MIN_KMH:24,
  DISPLAY_MAX_KMH:68,
  GAMEPLAY_ACCEL_RESPONSE:3.8,
  GAMEPLAY_RECOVERY_RESPONSE:2.8,
  ROLLING_RESISTANCE:.16,
  CARVE_SPEED_SCRUB:.020,
  POWERSLIDE_SPEED_SCRUB:.16,
  MAX_SPEED_SCRUB:.24,

  LOW_SPEED_STEER:1.34,
  HIGH_SPEED_STEER:.94,
  STEER_CURVE_EXPONENT:.78,
  TRUCK_RESPONSE_LOW:21.0,
  TRUCK_RESPONSE_HIGH:14.5,
  TURN_RATE_LOW:1.72,
  TURN_RATE_HIGH:1.36,
  TURN_RESPONSE_LOW:11.5,
  TURN_RESPONSE_HIGH:9.4,
  TURN_REVERSAL_MULTIPLIER:1.42,
  HEADING_LOW:.50,
  HEADING_HIGH:.38,
  DIRECT_LATERAL_ASSIST_LOW:.58,
  DIRECT_LATERAL_ASSIST_HIGH:.52,
  MAX_LATERAL_LOW:9.40,
  MAX_LATERAL_HIGH:11.20,
  LATERAL_RESPONSE_LOW:14.0,
  LATERAL_RESPONSE_HIGH:10.5,
  AIR_LATERAL_LOW:5.8,
  AIR_LATERAL_HIGH:7.0,
  AIR_TURN_LOW:.82,
  AIR_TURN_HIGH:.56,

  ROLLING_GRIP_LOW:.98,
  ROLLING_GRIP_HIGH:.86,
  OIL_GRIP:.34,
  WET_GRIP:.76,
  POWER_GRIP:1.08,
  OIL_SLIP_SECONDS:1.05,
  OIL_HEADING_DRIFT:.24,
  LANDING_GRIP_RECOVERY:2.5,

  POWERSLIDE_SPEED01:.16,
  POWERSLIDE_ENTRY_STEER:.72,
  POWERSLIDE_HOLD_STEER:.42,
  POWERSLIDE_ENTRY_EDGE:.52,
  POWERSLIDE_HOLD_EDGE:.30,
  POWERSLIDE_GRIP:.36,
  POWERSLIDE_ENTRY_RESPONSE:9.0,
  POWERSLIDE_EXIT_RESPONSE:5.4,
  POWERSLIDE_RECOVERY_RESPONSE:4.2,

  JUMP_BUFFER_SECONDS:.12,
  COYOTE_SECONDS:.09,
  OLLIE_MAX_COMPRESSION:.055,
  OLLIE_POP_MIN:7.45,
  OLLIE_POP_MAX:9.35,
  NOLLIE_POP_SCALE:.94,
  POWER_POP:1.12,
  MINI_JUMP_TAP_SECONDS:.13,
  MINI_JUMP_RELEASE_VELOCITY:5.45,
  GRAVITY:17.8,
  RAMP_JUMP_BASE_VELOCITY:13.4,
  RAMP_JUMP_SPEED_FACTOR:.095,
  RAMP_RETRIGGER_GRACE:.85,

  MANUAL_THRESHOLD:.52,
  MANUAL_ENTRY:.10,
  MANUAL_FAIL:.96,
  MANUAL_BALANCE_RESPONSE:2.8,

  GRIND_CAPTURE:.78,
  GRIND_HIGH_SPEED_CAPTURE_BONUS:.22,
  GRIND_ANGLE:34,
  GRIND_MIN_GAMEPLAY_SPEED:6.2,
  GRIND_FRICTION:.045,
  GRIND_FAIL:.98,
  GRIND_MIN_DURATION:.08
});
const T=SKATEBOARD_TUNING;

function fresh(){return {native:true,steeringSensitivity:1,truckFront:0,truckRear:0,rollingGrip:1,lateralGrip:1,slip:0,gameplaySpeed:0,gameplayTargetSpeed:0,speedScrub:0,pushIntensity:0,powerslide:false,powerslideAmount:0,powerslideRecovery:0,manualMode:'',manualDuration:0,manualBalance:0,grindState:'',grindTargetId:'',grindDuration:0,grindBalance:0,olliePhase:'idle',ollieCharge:0,ollieCompressionTime:0,wheelContacts:4,animationState:'idle',comboContinuation:false,lastLanding:'clean',landingSequence:0,lastCountedLandingId:0,lastWheelRollTime:-1,lastPowerslideLoopTime:-1,lastGrindLoopTime:-1,eventId:0,lastEvent:null,events:[]};}
export function ensureSkateboardState(state){if(!state.skate)state.skate=fresh();return state.skate;}
export function resetSkateboardState(state){const id=state.skate?.eventId||0;state.skate=fresh();state.skate.eventId=id;state.grinding=false;return state.skate;}
export function emitSkateboardEvent(state,type,payload={}){const s=ensureSkateboardState(state),e={id:++s.eventId,type,time:Number(state.time)||0,...payload};s.lastEvent=e;s.events.push(e);if(s.events.length>24)s.events.shift();return e;}
export function consumeSkateboardEvents(state){const s=ensureSkateboardState(state),out=s.events.slice();s.events.length=0;return out;}
export function getSkateboardDisplaySpeedRange(){return {minKmh:SKATEBOARD_TUNING.DISPLAY_MIN_KMH,maxKmh:SKATEBOARD_TUNING.DISPLAY_MAX_KMH};}
export function skateboardDisplaySpeedKmh(speed,rideMode='snowboard'){const p=getRideProfile(rideMode),x=clamp((Number(speed)-p.baseSpeed)/Math.max(.001,p.maxSpeed-p.baseSpeed),0,1);return Math.round(lerp(SKATEBOARD_TUNING.DISPLAY_MIN_KMH,SKATEBOARD_TUNING.DISPLAY_MAX_KMH,Math.pow(x,.82)));}
export function skateboardDisplaySpeed(speed,rideMode='snowboard'){return skateboardDisplaySpeedKmh(speed,rideMode)/3.6;}

export function getSkateboardVelocityModel(state){
  const s=ensureSkateboardState(state),p=getRideProfile(state.rideMode);
  const worldSpeed=Math.max(0,Number(state.speed)||p.baseSpeed);
  const speed01=clamp((worldSpeed-p.baseSpeed)/Math.max(.001,p.maxSpeed-p.baseSpeed),0,1);
  const displayTargetKmh=lerp(SKATEBOARD_TUNING.DISPLAY_MIN_KMH,SKATEBOARD_TUNING.DISPLAY_MAX_KMH,Math.pow(speed01,.82));
  const gameplayTargetSpeed=displayTargetKmh/3.6;
  const gameplaySpeed=s.gameplaySpeed>0?s.gameplaySpeed:gameplayTargetSpeed;
  return {worldSpeed,worldSpeedKmh:worldSpeed*3.6,speed01,gameplaySpeed,gameplaySpeedKmh:gameplaySpeed*3.6,gameplayTargetSpeed,displayTargetKmh,difficulty:Number(state.difficulty)||0};
}

export function skateboardGameplaySpeed(state){
  return getSkateboardVelocityModel(state).gameplaySpeed;
}
export function skateboardGameplaySpeedKmh(state){
  return Math.round(skateboardGameplaySpeed(state)*3.6);
}

function stepGameplayVelocity(state,dt,{powered=false,carveLoad=0,powerslideAmount=0}={}){
  const s=ensureSkateboardState(state),velocity=getSkateboardVelocityModel(state);
  const target=velocity.gameplayTargetSpeed*(powered?1.025:1);
  if(!(s.gameplaySpeed>0))s.gameplaySpeed=target;
  const scrubAdd=(Math.abs(carveLoad)*SKATEBOARD_TUNING.CARVE_SPEED_SCRUB+powerslideAmount*SKATEBOARD_TUNING.POWERSLIDE_SPEED_SCRUB)*Math.max(0,dt);
  s.speedScrub=clamp(s.speedScrub+scrubAdd,0,SKATEBOARD_TUNING.MAX_SPEED_SCRUB);
  s.speedScrub=damp(s.speedScrub,0,SKATEBOARD_TUNING.GAMEPLAY_RECOVERY_RESPONSE,dt);
  s.gameplayTargetSpeed=target*(1-s.speedScrub);
  const response=s.gameplayTargetSpeed>=s.gameplaySpeed?SKATEBOARD_TUNING.GAMEPLAY_ACCEL_RESPONSE:SKATEBOARD_TUNING.GAMEPLAY_ACCEL_RESPONSE*1.35;
  s.gameplaySpeed=damp(s.gameplaySpeed,s.gameplayTargetSpeed,response,dt);
  s.gameplaySpeed=Math.max(SKATEBOARD_TUNING.DISPLAY_MIN_KMH/3.6*.82,s.gameplaySpeed-SKATEBOARD_TUNING.ROLLING_RESISTANCE*Math.max(0,dt));
  s.pushIntensity=clamp((s.gameplayTargetSpeed-s.gameplaySpeed)/2.5,0,1);
  state.maxSkateGameplaySpeed=Math.max(Number(state.maxSkateGameplaySpeed)||0,s.gameplaySpeed);
  return {...velocity,gameplaySpeed:s.gameplaySpeed,gameplaySpeedKmh:s.gameplaySpeed*3.6,gameplayTargetSpeed:s.gameplayTargetSpeed};
}

function animate(state,steer=0){const s=ensureSkateboardState(state);if(s.grindState==='active')s.animationState='grind';else if(state.air)s.animationState='air';else if(s.powerslide)s.animationState='powerslide';else if(s.manualMode)s.animationState=s.manualMode;else if(Math.abs(steer)>.12)s.animationState=steer<0?'carveLeft':'carveRight';else s.animationState=s.pushIntensity>.06?'push':'idle';return s.animationState;}

export function stepSkateboardSteering(state,input,dt,{powered=false,wetness=0,powerslideIntent=false}={}){
  const s=ensureSkateboardState(state),setup=getSkateboardSetupProfile(state.skateSetup),p=getRideProfile(state.rideMode);
  const span=Math.max(.001,p.maxSpeed-p.baseSpeed),speed01=clamp((state.speed-p.baseSpeed)/span,0,1);
  const rawSteer=Math.abs(input)<T.INPUT_DEADZONE?0:clamp(input,-1,1);
  const steer=rawSteer===0?0:Math.sign(rawSteer)*Math.pow(Math.abs(rawSteer),T.STEER_CURVE_EXPONENT);
  const frame=Math.max(0,Number(dt)||0);
  const oil=clamp((state.oilSlipTime||0)/Math.max(.001,T.OIL_SLIP_SECONDS),0,1);
  state.landingGripLoss=Math.max(0,(state.landingGripLoss||0)-frame*SKATEBOARD_TUNING.LANDING_GRIP_RECOVERY);
  state.oilSlipTime=Math.max(0,(state.oilSlipTime||0)-frame);

  if(state.grinding){
    state.edge=damp(state.edge,steer*.34,8.2,frame);
    s.truckFront=state.edge;s.truckRear=-state.edge*.82;s.powerslide=false;s.animationState='grind';
    stepGameplayVelocity(state,frame,{powered});
    return {grinding:true};
  }

  s.steeringSensitivity=lerp(SKATEBOARD_TUNING.LOW_SPEED_STEER,SKATEBOARD_TUNING.HIGH_SPEED_STEER,speed01)*setup.steeringPrecision;
  const edgeTarget=clamp(steer*s.steeringSensitivity,-1,1);
  const reversing=steer&&state.edge&&Math.sign(steer)!==Math.sign(state.edge);
  const edgeResponse=lerp(SKATEBOARD_TUNING.TRUCK_RESPONSE_LOW,SKATEBOARD_TUNING.TRUCK_RESPONSE_HIGH,speed01)*setup.truckResponse*(reversing?1.35:1)*(oil>.05?.72:1);
  state.edge=damp(state.edge,edgeTarget,edgeResponse,frame);
  s.truckFront=state.edge;s.truckRear=-state.edge*.82;

  if(state.air){
    const hlim=lerp(SKATEBOARD_TUNING.HEADING_LOW,SKATEBOARD_TUNING.HEADING_HIGH,speed01);
    state.heading=clamp(state.heading+state.edge*frame*lerp(SKATEBOARD_TUNING.AIR_TURN_LOW,SKATEBOARD_TUNING.AIR_TURN_HIGH,speed01)*setup.airControl,-hlim,hlim);
    const normalizedHeading=clamp(state.heading/Math.max(.001,hlim),-1,1);
    const targetVx=normalizedHeading*lerp(SKATEBOARD_TUNING.AIR_LATERAL_LOW,SKATEBOARD_TUNING.AIR_LATERAL_HIGH,speed01)*setup.airControl;
    state.vx=damp(state.vx,targetVx,3.7,frame);
    state.x=clamp(state.x+state.vx*frame,-T.PLAYER_BOUNDARY_HALF_WIDTH,T.PLAYER_BOUNDARY_HALF_WIDTH);
    Object.assign(s,{wheelContacts:0,rollingGrip:0,lateralGrip:0,slip:0,powerslide:false});
    state.grip=0;
    stepGameplayVelocity(state,frame,{powered});
    animate(state,steer);
    return null;
  }

  s.wheelContacts=4;
  const landing=lerp(1,.54,clamp(state.landingGripLoss||0,0,1));
  const surface=lerp(1,SKATEBOARD_TUNING.WET_GRIP,clamp(wetness,0,1))*lerp(1,SKATEBOARD_TUNING.OIL_GRIP,oil)*landing*(powered?SKATEBOARD_TUNING.POWER_GRIP:1);
  const rolling=clamp(lerp(SKATEBOARD_TUNING.ROLLING_GRIP_LOW,SKATEBOARD_TUNING.ROLLING_GRIP_HIGH,speed01)*surface,.22,1.08);
  const before=s.powerslide;
  const slideRequested=!!powerslideIntent;
  const wantsEntry=slideRequested&&speed01>=SKATEBOARD_TUNING.POWERSLIDE_SPEED01&&Math.abs(steer)>=SKATEBOARD_TUNING.POWERSLIDE_ENTRY_STEER&&Math.abs(state.edge)>=SKATEBOARD_TUNING.POWERSLIDE_ENTRY_EDGE&&oil<.82;
  const wantsHold=before&&slideRequested&&speed01>=SKATEBOARD_TUNING.POWERSLIDE_SPEED01*.8&&Math.abs(steer)>=SKATEBOARD_TUNING.POWERSLIDE_HOLD_STEER&&Math.abs(state.edge)>=SKATEBOARD_TUNING.POWERSLIDE_HOLD_EDGE&&oil<.90;
  const wanted=wantsEntry||wantsHold;
  s.powerslideAmount=damp(s.powerslideAmount,wanted?1:0,wanted?SKATEBOARD_TUNING.POWERSLIDE_ENTRY_RESPONSE:SKATEBOARD_TUNING.POWERSLIDE_EXIT_RESPONSE,frame);
  s.powerslide=s.powerslideAmount>.28;
  if(s.powerslide&&!before){s.powerslideRecovery=1;emitSkateboardEvent(state,'powerslideStart');}
  if(!s.powerslide&&before){s.powerslideRecovery=1;emitSkateboardEvent(state,'powerslideEnd');}
  s.powerslideRecovery=damp(s.powerslideRecovery,0,SKATEBOARD_TUNING.POWERSLIDE_RECOVERY_RESPONSE,frame);

  if(s.powerslide&&(Number(state.time)||0)-s.lastPowerslideLoopTime>=.08){
    s.lastPowerslideLoopTime=Number(state.time)||0;
    emitSkateboardEvent(state,'powerslideLoop',{intensity:s.powerslideAmount,slip:s.slip,speedKmh:skateboardGameplaySpeedKmh(state)});
  }
  if((Number(state.time)||0)-s.lastWheelRollTime>=.12){
    s.lastWheelRollTime=Number(state.time)||0;
    emitSkateboardEvent(state,'wheelRoll',{speedKmh:skateboardGameplaySpeedKmh(state),grip:rolling});
  }

  s.rollingGrip=rolling;
  const recoveryGrip=lerp(1,.78,s.powerslideRecovery);
  s.lateralGrip=clamp(lerp(rolling,SKATEBOARD_TUNING.POWERSLIDE_GRIP,s.powerslideAmount)*recoveryGrip,.18,1.08);
  s.slip=clamp((1-s.lateralGrip)*.75+s.powerslideAmount*.55+oil*.48,0,1);
  state.grip=s.lateralGrip;
  state.carveLoad=damp(state.carveLoad,Math.abs(state.edge)*(.72+speed01*.24),7.5,frame);

  const hlim=lerp(SKATEBOARD_TUNING.HEADING_LOW,SKATEBOARD_TUNING.HEADING_HIGH,speed01);
  const turn=state.edge*lerp(SKATEBOARD_TUNING.TURN_RATE_LOW,SKATEBOARD_TUNING.TURN_RATE_HIGH,speed01)*setup.carveAuthority*(.72+s.lateralGrip*.38);
  const reversingTurn=turn&&state.turnRate&&Math.sign(turn)!==Math.sign(state.turnRate);
  const turnResponse=lerp(SKATEBOARD_TUNING.TURN_RESPONSE_LOW,SKATEBOARD_TUNING.TURN_RESPONSE_HIGH,speed01);
  state.turnRate=damp(state.turnRate,turn,reversingTurn?turnResponse*SKATEBOARD_TUNING.TURN_REVERSAL_MULTIPLIER:turnResponse,frame);
  state.heading=clamp(state.heading+state.turnRate*frame,-hlim,hlim);
  if(oil>.01){
    const lateralMomentum=clamp((state.vx||0)/Math.max(1,SKATEBOARD_TUNING.MAX_LATERAL_HIGH),-1,1);
    state.heading=clamp(state.heading+lateralMomentum*oil*SKATEBOARD_TUNING.OIL_HEADING_DRIFT*frame,-hlim,hlim);
  }
  if(!steer){
    state.heading=damp(state.heading,0,oil>.05?1.5:3.8,frame);
    state.turnRate=damp(state.turnRate,0,oil>.05?1.7:4.2,frame);
  }

  const normalizedHeading=clamp(state.heading/Math.max(.001,hlim),-1,1);
  const directAssist=lerp(SKATEBOARD_TUNING.DIRECT_LATERAL_ASSIST_LOW,SKATEBOARD_TUNING.DIRECT_LATERAL_ASSIST_HIGH,speed01);
  const lateralIntent=clamp(normalizedHeading+state.edge*directAssist,-1,1);
  const maxLateral=lerp(SKATEBOARD_TUNING.MAX_LATERAL_LOW,SKATEBOARD_TUNING.MAX_LATERAL_HIGH,speed01)*setup.carveAuthority;
  const targetVx=lateralIntent*maxLateral*(s.powerslide?1.10:1);
  const lateralResponse=lerp(SKATEBOARD_TUNING.LATERAL_RESPONSE_LOW,SKATEBOARD_TUNING.LATERAL_RESPONSE_HIGH,speed01)*lerp(.58,1,s.lateralGrip);
  state.vx=damp(state.vx,targetVx,lateralResponse,frame);
  state.x=clamp(state.x+state.vx*frame,-T.PLAYER_BOUNDARY_HALF_WIDTH,T.PLAYER_BOUNDARY_HALF_WIDTH);

  stepGameplayVelocity(state,frame,{powered,carveLoad:state.carveLoad,powerslideAmount:s.powerslideAmount});
  const worldSpeedBefore=state.speed;
  const edgeScrape=resolveCourseEdgeContact(state,frame,{profile:p});
  state.speed=worldSpeedBefore;
  if(edgeScrape)s.speedScrub=clamp(s.speedScrub+.012*edgeScrape.intensity,0,SKATEBOARD_TUNING.MAX_SPEED_SCRUB);
  animate(state,steer);
  return edgeScrape?{edgeScrape,powerslide:s.powerslide,slip:s.slip}:{powerslide:s.powerslide,slip:s.slip};
}

function applySkateboardJumpCut(state){
  if(!state.air||!['ollie','nollie'].includes(state.jumpSource)||state.jumpCutApplied)return false;
  state.jumpCutApplied=true;
  if((state.jumpHoldTime||0)>SKATEBOARD_TUNING.MINI_JUMP_TAP_SECONDS)return false;
  if(state.vy>0){
    state.vy=Math.min(state.vy,SKATEBOARD_TUNING.MINI_JUMP_RELEASE_VELOCITY);
    state.jumpVelocity=state.vy;
  }
  state.jumpProfile='mini';
  return true;
}

export function updateSkateboardJumpAssist(state,pressed,dt,held=pressed){
  const s=ensureSkateboardState(state),frame=Math.max(0,Number(dt)||0);
  state.jumpBufferTime=Math.max(0,(state.jumpBufferTime||0)-frame);
  state.coyoteTime=Math.max(0,(state.coyoteTime||0)-frame);
  const isHeld=!!held,wasHeld=!!state.jumpInputHeld;
  if(state.grounded&&!state.air&&!state.grinding)state.coyoteTime=SKATEBOARD_TUNING.COYOTE_SECONDS;
  if(pressed){
    state.jumpBufferTime=SKATEBOARD_TUNING.JUMP_BUFFER_SECONDS;
    s.ollieCompressionTime=0;
    s.ollieCharge=0;
  }

  if(!state.air&&!state.grinding&&(state.jumpBufferTime||0)>0){
    s.ollieCompressionTime=Math.min(SKATEBOARD_TUNING.OLLIE_MAX_COMPRESSION,s.ollieCompressionTime+frame);
    s.ollieCharge=clamp(s.ollieCompressionTime/SKATEBOARD_TUNING.OLLIE_MAX_COMPRESSION,0,1);
    s.olliePhase='compression';
    s.animationState='ollieCompression';
  }else if(state.air&&['ollie','nollie'].includes(state.jumpSource)){
    if(isHeld){
      state.jumpHoldTime=(state.jumpHoldTime||0)+frame;
      if(state.jumpHoldTime>SKATEBOARD_TUNING.MINI_JUMP_TAP_SECONDS)state.jumpProfile='full';
    }
    if(wasHeld&&!isHeld)applySkateboardJumpCut(state);
  }else if(!state.air){
    s.ollieCharge=damp(s.ollieCharge,0,10,frame);
    if(s.olliePhase!=='landing')s.olliePhase='idle';
    state.jumpHoldTime=0;
    state.jumpCutApplied=false;
  }

  state.jumpInputHeld=isHeld;
  state.jumpBuffered=(state.jumpBufferTime||0)>0;
  state.grounded=!state.air&&!state.grinding;
  state.jumpVelocity=state.air?state.vy:0;
  return s.olliePhase;
}

export function trySkateboardOllie(state,groundY,{powered=false,nollie=false}={}){
  const s=ensureSkateboardState(state),setup=getSkateboardSetupProfile(state.skateSetup),nose=s.manualMode==='noseManual';
  if((state.jumpBufferTime||0)<=0)return false;
  if(state.air&&(state.coyoteTime||0)<=0)return false;
  if(!state.grounded&&(state.coyoteTime||0)<=0)return false;

  const isNollie=nollie||nose;
  const charge=clamp(s.ollieCharge,0,1);
  const basePop=lerp(SKATEBOARD_TUNING.OLLIE_POP_MIN,SKATEBOARD_TUNING.OLLIE_POP_MAX,.28+charge*.72);
  const pop=basePop*(isNollie?SKATEBOARD_TUNING.NOLLIE_POP_SCALE:1)*setup.olliePop*(powered?SKATEBOARD_TUNING.POWER_POP:1);

  state.air=true;state.grounded=false;state.jumping=true;
  state.jumpSource=isNollie?'nollie':'ollie';
  state.jumpProfile='full';
  state.jumpHoldTime=0;state.jumpCutApplied=false;
  state.vy=pop;state.jumpVelocity=pop;
  state.y=Math.max(state.y,groundY+.045);
  state.jumpBufferTime=0;state.jumpBuffered=false;state.coyoteTime=0;
  state.landingQuality='air';state.landingReengageTime=0;

  Object.assign(s,{olliePhase:'pop',ollieCharge:0,ollieCompressionTime:0,manualMode:'',manualDuration:0,animationState:'olliePop'});
  const takeoff={source:state.jumpSource,powered:!!powered,velocity:state.vy,charge};
  emitSkateboardEvent(state,'takeoff',takeoff);
  emitSkateboardEvent(state,'tailPop',{...takeoff,nollie:isNollie});
  if(!state.jumpInputHeld)applySkateboardJumpCut(state);
  return true;
}

function classifySkateboardLanding({impact,alignment,lateralVelocity,trickComplete=true,wetness=0,oil=0,speed01=0}){
  const surfacePenalty=clamp(wetness,0,1)*.65+clamp(oil,0,1)*.55;
  const speedTolerance=lerp(1,1.10,clamp(speed01,0,1));
  const sketchyImpact=8.8-surfacePenalty*.25,hardImpact=12.4-surfacePenalty*.35,failedImpact=16.2-surfacePenalty*.45;
  if(!trickComplete||impact>=failedImpact||alignment>=.72*speedTolerance||lateralVelocity>=9.6*speedTolerance)return SKATEBOARD_LANDING.FAILED;
  if(impact>=hardImpact||alignment>=.50*speedTolerance||lateralVelocity>=7.1*speedTolerance)return SKATEBOARD_LANDING.HARD;
  if(impact>=sketchyImpact||alignment>=.28*speedTolerance||lateralVelocity>=4.5*speedTolerance)return SKATEBOARD_LANDING.SKETCHY;
  return SKATEBOARD_LANDING.CLEAN;
}

export function stepSkateboardAir(state,dt,groundY,{trickComplete=true,wetness=0}={}){
  const s=ensureSkateboardState(state),frame=Math.max(0,Number(dt)||0);
  if(!state.air){
    state.grounded=!state.grinding;
    state.jumping=false;
    state.jumpVelocity=0;
    state.landingPulse=Math.max(0,(state.landingPulse||0)-frame*4.5);
    state.y=damp(state.y,groundY,13,frame);
    return {landed:false,impact:0,quality:state.landingQuality||'none'};
  }

  state.grounded=false;
  state.y+=state.vy*frame-.5*SKATEBOARD_TUNING.GRAVITY*frame*frame;
  state.vy-=SKATEBOARD_TUNING.GRAVITY*frame;
  state.jumpVelocity=state.vy;
  s.olliePhase='air';s.wheelContacts=0;s.animationState='air';
  if(state.y>groundY||state.vy>0)return {landed:false,impact:0,quality:'air'};

  const impact=Math.abs(state.vy),alignment=Math.abs(state.heading||0),lateralVelocity=Math.abs(state.vx||0);
  const source=state.jumpSource||'',profile=state.jumpProfile||'',velocity=getSkateboardVelocityModel(state);
  const oil=clamp((state.oilSlipTime||0)/Math.max(.001,SKATEBOARD_TUNING.OIL_SLIP_SECONDS),0,1);
  const quality=classifySkateboardLanding({impact,alignment,lateralVelocity,trickComplete,wetness,oil,speed01:velocity.speed01});
  const landingId=++s.landingSequence;

  state.y=groundY;state.vy=0;state.jumpVelocity=0;
  state.air=false;state.grounded=true;state.jumping=false;
  state.jumpSource='';state.lastJumpProfile=profile;state.jumpProfile='';
  state.jumpHoldTime=0;state.jumpCutApplied=false;
  state.landingQuality=quality;state.landingPulse=Math.min(1,impact/14);
  state.landingReengageTime=profile==='mini'?.10:.18;

  const velocityKeep=quality===SKATEBOARD_LANDING.CLEAN?.985:quality===SKATEBOARD_LANDING.SKETCHY?.93:quality===SKATEBOARD_LANDING.HARD?.82:.64;
  state.vx*=velocityKeep;
  state.turnRate*=quality===SKATEBOARD_LANDING.CLEAN?.94:quality===SKATEBOARD_LANDING.SKETCHY?.82:quality===SKATEBOARD_LANDING.HARD?.68:.45;
  state.heading*=quality===SKATEBOARD_LANDING.CLEAN?.985:quality===SKATEBOARD_LANDING.SKETCHY?.94:quality===SKATEBOARD_LANDING.HARD?.86:.72;
  const gripLoss=quality===SKATEBOARD_LANDING.CLEAN?.04:quality===SKATEBOARD_LANDING.SKETCHY?.34:quality===SKATEBOARD_LANDING.HARD?.66:1;
  state.landingGripLoss=Math.max(state.landingGripLoss||0,gripLoss);
  s.speedScrub=clamp(s.speedScrub+(quality===SKATEBOARD_LANDING.CLEAN?0:quality===SKATEBOARD_LANDING.SKETCHY?.035:quality===SKATEBOARD_LANDING.HARD?.08:.14),0,SKATEBOARD_TUNING.MAX_SPEED_SCRUB);

  s.lastLanding=quality;s.wheelContacts=quality===SKATEBOARD_LANDING.FAILED?2:4;s.olliePhase='landing';s.animationState=quality===SKATEBOARD_LANDING.HARD||quality===SKATEBOARD_LANDING.FAILED?'hardLand':'land';
  const landing={landed:true,landingId,impact,alignment,lateralVelocity,quality,failed:quality===SKATEBOARD_LANDING.FAILED,source,profile,trickComplete:!!trickComplete,wetness:clamp(wetness,0,1),oil,speedKmh:Math.round(velocity.gameplaySpeedKmh)};
  emitSkateboardEvent(state,'landing',landing);
  emitSkateboardEvent(state,landing.failed?'failedLanding':quality===SKATEBOARD_LANDING.HARD?'hardLand':'land',landing);
  return landing;
}

export function recordSkateboardLandingStatistic(state,landing={}){
  if(!landing.landed)return false;
  const s=ensureSkateboardState(state),id=Number(landing.landingId)||0;
  if(id&&s.lastCountedLandingId===id)return false;
  if(id)s.lastCountedLandingId=id;
  if(landing.quality===SKATEBOARD_LANDING.CLEAN)state.cleanLandings=(state.cleanLandings||0)+1;
  else state.lastMistakeTime=Number(state.time)||0;
  return true;
}

export function launchSkateboardRamp(state,groundY,{powered=false}={}){
  if(state.air||state.grinding)return false;
  const s=ensureSkateboardState(state),setup=getSkateboardSetupProfile(state.skateSetup);
  state.air=true;state.grounded=false;state.jumping=true;
  state.jumpSource='ramp';state.jumpProfile='ramp';
  state.jumpHoldTime=0;state.jumpCutApplied=true;
  const pop=(SKATEBOARD_TUNING.RAMP_JUMP_BASE_VELOCITY+(Number(state.speed)||0)*SKATEBOARD_TUNING.RAMP_JUMP_SPEED_FACTOR)*setup.rampPop*(powered?1.06:1);
  state.vy=pop;state.jumpVelocity=pop;
  state.y=Math.max(state.y,groundY+.34);
  state.rampGrace=SKATEBOARD_TUNING.RAMP_RETRIGGER_GRACE;
  state.jumpBufferTime=0;state.jumpBuffered=false;state.coyoteTime=0;
  state.landingQuality='air';state.landingReengageTime=0;
  Object.assign(s,{olliePhase:'air',wheelContacts:0,animationState:'air'});
  const takeoff={source:'ramp',ramp:true,powered:!!powered,velocity:state.vy};
  emitSkateboardEvent(state,'takeoff',takeoff);
  emitSkateboardEvent(state,'tailPop',takeoff);
  return true;
}

export function updateSkateboardManual(state,{verticalIntent=0,dt=1/60,powered=false}={}){
  const s=ensureSkateboardState(state),setup=getSkateboardSetupProfile(state.skateSetup),v=clamp(verticalIntent,-1,1);
  const wanted=Math.abs(v)>=SKATEBOARD_TUNING.MANUAL_THRESHOLD?(v<0?'noseManual':'manual'):'';
  if(state.air||state.grinding||s.powerslide){
    if(s.manualMode)emitSkateboardEvent(state,'manualEnd',{mode:s.manualMode});
    Object.assign(s,{manualMode:'',manualDuration:0,manualBalance:0,comboContinuation:false});
    return s;
  }
  if(!wanted){
    if(s.manualMode)emitSkateboardEvent(state,'manualEnd',{mode:s.manualMode,duration:s.manualDuration});
    Object.assign(s,{manualMode:'',manualDuration:0,comboContinuation:false});
    return s;
  }
  if(!s.manualMode){
    s.manualDuration+=dt;
    if(s.manualDuration<SKATEBOARD_TUNING.MANUAL_ENTRY)return s;
    s.manualMode=wanted;s.manualDuration=0;s.manualBalance=0;
    emitSkateboardEvent(state,'manualStart',{mode:wanted});
  }else if(s.manualMode!==wanted){
    emitSkateboardEvent(state,'manualEnd',{mode:s.manualMode});
    s.manualMode=wanted;s.manualDuration=0;s.manualBalance=0;
    emitSkateboardEvent(state,'manualStart',{mode:wanted});
  }
  s.manualDuration+=dt;
  const balanceResponse=SKATEBOARD_TUNING.MANUAL_BALANCE_RESPONSE*setup.manualStability*(powered?1.25:1);
  const edgeDisturbance=(state.edge||0)*.36/Math.max(.70,setup.manualStability);
  s.manualBalance=clamp(damp(s.manualBalance,0,balanceResponse,dt)+edgeDisturbance*dt,-1,1);
  s.comboContinuation=true;s.animationState=s.manualMode;
  if(Math.abs(s.manualBalance)>=SKATEBOARD_TUNING.MANUAL_FAIL){
    emitSkateboardEvent(state,'manualEnd',{mode:s.manualMode,reason:'balance'});
    Object.assign(s,{manualMode:'',manualDuration:0,manualBalance:0,comboContinuation:false});
    state.landingGripLoss=Math.max(state.landingGripLoss||0,.28);
  }
  return s;
}

const point=p=>({x:Number(p?.x)||0,y:Number(p?.y)||0,z:Number(p?.z)||0});
const closest=(p,a,b)=>{const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z,t=l?clamp(((p.x-a.x)*x+(p.z-a.z)*z)/l,0,1):0;return {x:a.x+x*t,y:a.y+(b.y-a.y)*t,z:a.z+z*t,t};};
export function createGrindTarget({id,start,end,captureRadius=SKATEBOARD_TUNING.GRIND_CAPTURE,allowedTricks=['50-50','5-0','NOSEGRIND','BOARDSLIDE','LIPSLIDE'],getEndpoints=null}={}){if(!id)throw new Error('grind target requires id');if(!getEndpoints&&(!start||!end))throw new Error('grind target requires endpoints');return {id:String(id),start:start?point(start):null,end:end?point(end):null,captureRadius:Math.max(.1,Number(captureRadius)||SKATEBOARD_TUNING.GRIND_CAPTURE),allowedTricks:[...new Set(allowedTricks)],getEndpoints:typeof getEndpoints==='function'?getEndpoints:null};}
export function createGrindSystem(){const targets=new Map();let active=null;const ends=t=>{const d=t.getEndpoints?.();return d?.start&&d?.end?{start:point(d.start),end:point(d.end)}:{start:t.start,end:t.end};};function register(t){const n=createGrindTarget(t);targets.set(n.id,n);return n;}function unregister(id){if(active?.target.id===String(id))active=null;return targets.delete(String(id));}function reset(){active=null;}function clear(){active=null;targets.clear();}
  function tryEnter(state,{playerZ=0,preferredTrick='50-50',powered=false}={}){
    if(active||!state.air||skateboardGameplaySpeed(state)<SKATEBOARD_TUNING.GRIND_MIN_GAMEPLAY_SPEED)return false;
    const setup=getSkateboardSetupProfile(state.skateSetup),velocity=getSkateboardVelocityModel(state);
    const p=point({x:state.x,y:state.y,z:playerZ}),vx=Number(state.vx)||0,vz=-Math.max(.001,state.speed||0),vl=Math.hypot(vx,vz)||1;
    let best=null;
    for(const target of targets.values()){
      const e=ends(target);if(!e.start||!e.end)continue;
      const c=closest(p,e.start,e.end);
      const highSpeedCapture=1+velocity.speed01*SKATEBOARD_TUNING.GRIND_HIGH_SPEED_CAPTURE_BONUS;
      const r=target.captureRadius*setup.grindCapture*highSpeedCapture*(powered?1.18:1);
      const dx=p.x-c.x,dz=p.z-c.z;
      if(dx*dx+dz*dz>r*r||Math.abs(p.y-c.y)>r*1.35)continue;
      const tx=e.end.x-e.start.x,tz=e.end.z-e.start.z,tl=Math.hypot(tx,tz)||1,dot=(vx*tx+vz*tz)/(vl*tl),angle=Math.acos(clamp(Math.abs(dot),-1,1))*180/Math.PI;
      const angleLimit=SKATEBOARD_TUNING.GRIND_ANGLE*setup.grindAngleTolerance+(powered?8:0);
      if(angle>angleLimit)continue;
      const score=dx*dx+dz*dz+angle*.004;
      if(!best||score<best.score)best={target,e,c,score,direction:dot>=0?1:-1};
    }
    if(!best)return false;
    const trick=best.target.allowedTricks.includes(preferredTrick)?preferredTrick:best.target.allowedTricks[0];
    active={target:best.target,trick,direction:best.direction,balance:0,duration:0,progress:best.c.t};
    const s=ensureSkateboardState(state);
    Object.assign(s,{grindState:'active',grindTargetId:best.target.id,grindDuration:0,grindBalance:0,comboContinuation:true,animationState:'grind'});
    state.grinding=true;state.air=false;state.grounded=false;state.vy=0;state.x=best.c.x;state.y=best.c.y+.12;
    emitSkateboardEvent(state,'grindStart',{targetId:best.target.id,trick,setup:setup.id});
    return true;
  }
  function exit(state,reason='natural-exit'){if(!active)return {active:false,reason};const a=active,s=ensureSkateboardState(state),completed=a.duration>=SKATEBOARD_TUNING.GRIND_MIN_DURATION&&reason!=='balance-fail',points=completed?Math.max(25,Math.round(a.duration*140)):0;state.grinding=false;Object.assign(s,{grindState:'',grindTargetId:'',grindBalance:0,comboContinuation:completed});if(points){state.score=(state.score||0)+points;state.combo=Math.max(1,Number(state.combo)||1);}if(reason!=='jump-off'){state.air=true;state.grounded=false;state.jumping=true;state.jumpSource='grind';state.vy=reason==='balance-fail'?-1.4:0;state.jumpVelocity=state.vy;}emitSkateboardEvent(state,'grindEnd',{targetId:a.target.id,trick:a.trick,duration:a.duration,reason,points,completed});active=null;return {active:false,reason,trick:a.trick,duration:a.duration,points,completed};}
  function step(state,dt,{steer=0,powered=false}={}){
    if(!active)return {active:false};
    const setup=getSkateboardSetupProfile(state.skateSetup),e=ends(active.target),tx=e.end.x-e.start.x,tz=e.end.z-e.start.z,len=Math.max(.001,Math.hypot(tx,tz));
    active.duration+=dt;
    active.progress+=Math.max(0,state.speed||0)*dt/len*active.direction;
    active.balance=clamp(damp(active.balance,0,3.2*setup.grindStability*(powered?1.25:1),dt)+(Number(steer)||0)*.40/Math.max(.7,setup.grindStability)*dt,-1,1);
    const t=clamp(active.progress,0,1);
    state.x=e.start.x+tx*t;state.y=e.start.y+(e.end.y-e.start.y)*t+.12;
    state.vx=tx/len*active.direction*skateboardGameplaySpeed(state);
    const s=ensureSkateboardState(state);
    s.speedScrub=clamp(s.speedScrub+SKATEBOARD_TUNING.GRIND_FRICTION*setup.grindFriction*dt,0,SKATEBOARD_TUNING.MAX_SPEED_SCRUB);
    stepGameplayVelocity(state,dt,{powered});
    s.grindDuration=active.duration;s.grindBalance=active.balance;
    if((Number(state.time)||0)-s.lastGrindLoopTime>=.10){
      s.lastGrindLoopTime=Number(state.time)||0;
      emitSkateboardEvent(state,'grindLoop',{targetId:active.target.id,trick:active.trick,balance:active.balance,duration:active.duration,speedKmh:skateboardGameplaySpeedKmh(state)});
    }
    if(Math.abs(active.balance)>=SKATEBOARD_TUNING.GRIND_FAIL)return {...exit(state,'balance-fail'),failed:true};
    if(active.progress<=0||active.progress>=1)return {...exit(state,'natural-exit'),natural:true};
    return {active:true,trick:active.trick,duration:active.duration,balance:active.balance};
  }
  function jumpOff(state,{popVelocity=6.8}={}){if(!active)return false;const out=exit(state,'jump-off');state.air=true;state.grounded=false;state.jumping=true;state.jumpSource='grind';state.vy=Math.max(state.vy||0,popVelocity);state.jumpVelocity=state.vy;state.jumpBufferTime=0;state.jumpBuffered=false;state.coyoteTime=0;emitSkateboardEvent(state,'tailPop',{source:'grind',velocity:state.vy});return out;}
  function snapshot(){return {targetCount:targets.size,active:!!active,targetId:active?.target.id||'',trick:active?.trick||'',duration:active?.duration||0,balance:active?.balance||0};}
  return {register,unregister,reset,clear,tryEnter,step,jumpOff,exit,snapshot,get active(){return active;}};
}
export function getSkateboardGameplaySnapshot(state,grindSystem=null){
  const s=ensureSkateboardState(state),velocity=getSkateboardVelocityModel(state),setup=getSkateboardSetupProfile(state.skateSetup);
  return {...s,events:undefined,setup:setup.id,setupLabel:setup.label,grind:grindSystem?.snapshot?.()||null,displayedSpeedKmh:Math.round(velocity.gameplaySpeedKmh),gameplayTargetSpeedKmh:Math.round(velocity.gameplayTargetSpeed*3.6),worldSpeedKmh:Math.round(velocity.worldSpeedKmh),worldSpeed01:velocity.speed01,difficulty:velocity.difficulty};
}
