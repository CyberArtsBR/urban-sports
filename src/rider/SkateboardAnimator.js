import * as THREE from 'three';
import {SKATE_ANIMATION_STATE,createSkateAnimationStateMachine} from './SkateAnimationState.js';

const TAU=Math.PI*2;
const RIG_KEYS=Object.freeze([
  'hips','spine','chest','neck','head',
  'leftShoulder','leftUpperArm','leftForearm','leftHand',
  'rightShoulder','rightUpperArm','rightForearm','rightHand',
  'leftThigh','leftShin','leftFoot','rightThigh','rightShin','rightFoot'
]);

function blendFactor(response,dt){
  return 1-Math.pow(1-response,Math.max(0,Math.min(.1,dt))*60);
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function isPowerSlide(state){
  return state===SKATE_ANIMATION_STATE.POWERSLIDE_LEFT||state===SKATE_ANIMATION_STATE.POWERSLIDE_RIGHT;
}

function isAirState(state){
  return state===SKATE_ANIMATION_STATE.OLLIE_POP||
    state===SKATE_ANIMATION_STATE.OLLIE_LEVEL||
    state===SKATE_ANIMATION_STATE.AIRBORNE||
    state===SKATE_ANIMATION_STATE.LANDING_PREP||
    state===SKATE_ANIMATION_STATE.SPIN_180||
    state===SKATE_ANIMATION_STATE.SPIN_360||
    state===SKATE_ANIMATION_STATE.KICKFLIP||
    state===SKATE_ANIMATION_STATE.HEELFLIP||
    state===SKATE_ANIMATION_STATE.SHOVE_IT||
    state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE||
    state===SKATE_ANIMATION_STATE.VARIAL_FLIP||
    state===SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP||
    state===SKATE_ANIMATION_STATE.GRAB;
}
function isFlipState(state){
  return state===SKATE_ANIMATION_STATE.KICKFLIP||
    state===SKATE_ANIMATION_STATE.HEELFLIP||
    state===SKATE_ANIMATION_STATE.VARIAL_FLIP||
    state===SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP;
}
function isShoveState(state){
  return state===SKATE_ANIMATION_STATE.SHOVE_IT||
    state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE||
    state===SKATE_ANIMATION_STATE.VARIAL_FLIP||
    state===SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP;
}
function isLandingState(state){
  return state===SKATE_ANIMATION_STATE.LAND||
    state===SKATE_ANIMATION_STATE.SKETCHY_LAND||
    state===SKATE_ANIMATION_STATE.HARD_LAND||
    state===SKATE_ANIMATION_STATE.FAILED_LAND;
}

export function createSkateboardAnimator({
  model,
  rig,
  snowboard,
  stance=null,
  stanceMode=null,
  sideSign=1,
  reducedMotion=false
}={}){
  if(!model||!rig)return null;

  const machine=createSkateAnimationStateMachine();
  const rest=new Map();
  for(const key of RIG_KEYS){
    const bone=rig[key];
    if(bone)rest.set(bone,bone.quaternion.clone());
  }

  const axisX=new THREE.Vector3(1,0,0);
  const axisY=new THREE.Vector3(0,1,0);
  const axisZ=new THREE.Vector3(0,0,1);
  const delta=new THREE.Quaternion();
  const goalQ=new THREE.Quaternion();
  const parentWorldQ=new THREE.Quaternion();
  const inverseParentQ=new THREE.Quaternion();
  const baseWorldQ=new THREE.Quaternion();
  const targetWorldQ=new THREE.Quaternion();
  const alignWorldQ=new THREE.Quaternion();
  const boneWorldQ=new THREE.Quaternion();
  const inverseBoneWorldQ=new THREE.Quaternion();
  const baselineDirection=new THREE.Vector3();
  const desiredDirection=new THREE.Vector3();
  const limbStart=new THREE.Vector3();
  const limbEnd=new THREE.Vector3();
  const localProbe=new THREE.Vector3();
  const modelWorldQ=new THREE.Quaternion();
  const riderRight=new THREE.Vector3();
  const riderUp=new THREE.Vector3();
  const riderForward=new THREE.Vector3();
  const upperTarget=new THREE.Vector3();
  const foreTarget=new THREE.Vector3();
  const ikHip=new THREE.Vector3(),ikKnee=new THREE.Vector3(),ikFoot=new THREE.Vector3();
  const ikTarget=new THREE.Vector3(),ikKneeGoal=new THREE.Vector3(),ikDirection=new THREE.Vector3();
  const ikPole=new THREE.Vector3(),ikPerp=new THREE.Vector3(),ikCurrentDirection=new THREE.Vector3(),ikDesiredDirection=new THREE.Vector3();
  const boardWorldQ=new THREE.Quaternion(),inverseBoardWorldQ=new THREE.Quaternion(),inverseModelWorldQ=new THREE.Quaternion();

  const armRestDirections=new Map();
  const armOutwardSigns=new Map();
  const armDisplay=new Map();
  for(const side of ['left','right']){
    const upper=rig[side+'UpperArm']||rig[side+'Shoulder'];
    if(upper){
      upper.getWorldPosition(localProbe);
      model.worldToLocal(localProbe);
      const sign=Math.sign(localProbe.x);
      if(sign)armOutwardSigns.set(side,sign);
    }
  }
  for(const pair of [
    ['leftUpperArm','leftForearm'],['rightUpperArm','rightForearm'],
    ['leftForearm','leftHand'],['rightForearm','rightHand']
  ]){
    const bone=rig[pair[0]],child=rig[pair[1]];
    if(!bone||!child)continue;
    bone.getWorldPosition(limbStart);
    child.getWorldPosition(limbEnd);
    desiredDirection.copy(limbEnd).sub(limbStart).normalize();
    bone.getWorldQuaternion(boneWorldQ);
    inverseBoneWorldQ.copy(boneWorldQ).invert();
    desiredDirection.applyQuaternion(inverseBoneWorldQ).normalize();
    armRestDirections.set(pair[0],desiredDirection.clone());
  }
  for(const key of [
    'leftShoulder','leftUpperArm','leftForearm','leftHand',
    'rightShoulder','rightUpperArm','rightForearm','rightHand'
  ]){
    const bone=rig[key],base=bone&&rest.get(bone);
    if(base)armDisplay.set(key,base.clone());
  }

  const boardRoot=snowboard?.root||null;
  const motionRoot=snowboard?.motionRoot||boardRoot?.userData?.motionRoot||null;
  let boardPoseRoot=null;
  if(boardRoot&&motionRoot){
    boardPoseRoot=new THREE.Group();
    boardPoseRoot.name='skateboard-animation-root';
    const parent=motionRoot.parent||boardRoot;
    parent.add(boardPoseRoot);
    boardPoseRoot.add(motionRoot);
  }
  const frontTruck=motionRoot?.getObjectByName?.('skateboard-front-truck')||null;
  const rearTruck=motionRoot?.getObjectByName?.('skateboard-rear-truck')||null;
  const frontTruckRestY=frontTruck?.position.y||0;
  const rearTruckRestY=rearTruck?.position.y||0;

  const modelBaseY=model.position.y;
  const requestedStance=String(stanceMode||stance?.mode||'').toLowerCase();
  const frontSide=requestedStance==='goofy'?'right':requestedStance==='regular'?'left':stance?.leftFront===false?'right':'left';
  const rearSide=frontSide==='left'?'right':'left';
  const resolvedStance=frontSide==='left'?'regular':'goofy';
  const systemReducedMotion=!!reducedMotion||!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const pose={
    carve:0,
    speed:0,
    air:0,
    landing:0,
    crouch:0,
    state:SKATE_ANIMATION_STATE.IDLE,
    pushPhase:0,
    stance:resolvedStance,
    footLock:0
  };
  const diagnostics={samples:0,totalMs:0,maxMs:0,ikSolves:0,ikFallbacks:0};
  const perfNow=typeof globalThis.performance?.now==='function'?()=>globalThis.performance.now():null;
  let active=true;
  let lastState=SKATE_ANIMATION_STATE.IDLE;
  let slideRecoil=0;

  const boardTargetRoot=motionRoot||boardRoot;
  const skeletonRoot=rig.hips||model;
  const legMetrics=new Map();
  const deckTop=Number(boardRoot?.userData?.deckTopOffset)||.045;
  if(boardTargetRoot){
    model.updateWorldMatrix(true,true);
    boardTargetRoot.updateWorldMatrix(true,true);
    model.getWorldQuaternion(modelWorldQ);
    inverseModelWorldQ.copy(modelWorldQ).invert();
    boardTargetRoot.getWorldQuaternion(boardWorldQ);
    inverseBoardWorldQ.copy(boardWorldQ).invert();
    for(const side of ['left','right']){
      const thigh=rig[side+'Thigh'],shin=rig[side+'Shin'],foot=rig[side+'Foot'];
      if(!thigh||!shin||!foot){diagnostics.ikFallbacks++;continue;}
      thigh.getWorldPosition(ikHip);shin.getWorldPosition(ikKnee);foot.getWorldPosition(ikFoot);
      const upperLength=ikHip.distanceTo(ikKnee),lowerLength=ikKnee.distanceTo(ikFoot);
      if(upperLength<.03||lowerLength<.03){diagnostics.ikFallbacks++;continue;}
      const targetLocal=boardTargetRoot.worldToLocal(ikTarget.copy(ikFoot)).clone();
      const bindingX=Number(stance?.[side+'BindingX']),bindingZ=Number(stance?.[side+'BindingZ']);
      if(Number.isFinite(bindingX))targetLocal.x=bindingX;
      if(Number.isFinite(bindingZ))targetLocal.z=bindingZ;
      targetLocal.y=Math.max(deckTop+.055,targetLocal.y);
      ikDirection.copy(ikFoot).sub(ikHip).normalize();
      ikPole.copy(ikKnee).sub(ikHip);
      ikPole.addScaledVector(ikDirection,-ikPole.dot(ikDirection));
      if(ikPole.lengthSq()<1e-6)ikPole.set(0,0,1).applyQuaternion(modelWorldQ);
      ikPole.normalize().applyQuaternion(inverseModelWorldQ);
      foot.getWorldQuaternion(targetWorldQ);
      const footRelativeQ=new THREE.Quaternion().copy(inverseBoardWorldQ).multiply(targetWorldQ);
      legMetrics.set(side,{thigh,shin,foot,upperLength,lowerLength,targetLocal,poleLocal:ikPole.clone(),footRelativeQ});
    }
  }

  function rotate(key,x=0,y=0,z=0,response=.24,dt=1/60){
    const bone=rig[key],base=bone&&rest.get(bone);
    if(!bone||!base)return false;
    goalQ.copy(base);
    goalQ.multiply(delta.setFromAxisAngle(axisX,x));
    goalQ.multiply(delta.setFromAxisAngle(axisY,y));
    goalQ.multiply(delta.setFromAxisAngle(axisZ,z));
    bone.quaternion.slerp(goalQ,blendFactor(response,dt));
    return true;
  }

  function applyArmRest(key,x=0,y=0,z=0,response=.26,dt=1/60){
    const bone=rig[key],base=bone&&rest.get(bone);
    if(!bone||!base)return false;
    goalQ.copy(base);
    goalQ.multiply(delta.setFromAxisAngle(axisX,x));
    goalQ.multiply(delta.setFromAxisAngle(axisY,y));
    goalQ.multiply(delta.setFromAxisAngle(axisZ,z));
    let display=armDisplay.get(key);
    if(!display){
      display=base.clone();
      armDisplay.set(key,display);
    }
    display.slerp(goalQ,blendFactor(response,dt));
    bone.quaternion.copy(display);
    return true;
  }

  function aimArm(key,target,response=.28,dt=1/60){
    const bone=rig[key],base=bone&&rest.get(bone),restDirection=armRestDirections.get(key);
    if(!bone||!base||!bone.parent||!restDirection)return false;
    bone.parent.getWorldQuaternion(parentWorldQ);
    baseWorldQ.copy(parentWorldQ).multiply(base);
    baselineDirection.copy(restDirection).applyQuaternion(baseWorldQ).normalize();
    desiredDirection.copy(target).normalize();
    alignWorldQ.setFromUnitVectors(baselineDirection,desiredDirection);
    targetWorldQ.copy(alignWorldQ).multiply(baseWorldQ);
    inverseParentQ.copy(parentWorldQ).invert();
    goalQ.copy(inverseParentQ).multiply(targetWorldQ);
    let display=armDisplay.get(key);
    if(!display){
      display=base.clone();
      armDisplay.set(key,display);
    }
    display.slerp(goalQ,blendFactor(response,dt));
    bone.quaternion.copy(display);
    return true;
  }

  function restoreRig(){
    for(const key of RIG_KEYS){
      const bone=rig[key],base=bone&&rest.get(bone);
      if(!bone||!base)continue;
      bone.quaternion.copy(base);
      const display=armDisplay.get(key);
      if(display)display.copy(base);
    }
    model.position.y=modelBaseY;
  }

  function resetBoard(){
    if(boardPoseRoot){
      boardPoseRoot.position.set(0,0,0);
      boardPoseRoot.rotation.set(0,0,0);
      boardPoseRoot.scale.set(1,1,1);
    }
    if(frontTruck)frontTruck.position.y=frontTruckRestY;
    if(rearTruck)rearTruck.position.y=rearTruckRestY;
    snowboard?.resetMotion?.();
  }

  function reset(){
    machine.reset();
    restoreRig();
    resetBoard();
    pose.carve=0;
    pose.speed=0;
    pose.air=0;
    pose.landing=0;
    pose.crouch=0;
    pose.state=SKATE_ANIMATION_STATE.IDLE;
    pose.pushPhase=0;
    slideRecoil=0;
    lastState=SKATE_ANIMATION_STATE.IDLE;
    pose.footLock=0;
  }

  function setActive(next=true){
    const value=!!next;
    if(active===value)return active;
    active=value;
    reset();
    return active;
  }

  function alignBoneToDirection(bone,currentDirection,desiredDirection,strength){
    if(!bone?.parent||strength<=.001)return false;
    ikCurrentDirection.copy(currentDirection).normalize();
    ikDesiredDirection.copy(desiredDirection).normalize();
    if(ikCurrentDirection.lengthSq()<.5||ikDesiredDirection.lengthSq()<.5)return false;
    bone.getWorldQuaternion(boneWorldQ);
    alignWorldQ.setFromUnitVectors(ikCurrentDirection,ikDesiredDirection);
    targetWorldQ.copy(alignWorldQ).multiply(boneWorldQ);
    bone.parent.getWorldQuaternion(parentWorldQ);
    inverseParentQ.copy(parentWorldQ).invert();
    goalQ.copy(inverseParentQ).multiply(targetWorldQ);
    bone.quaternion.slerp(goalQ,clamp(strength,0,1));
    return true;
  }

  function footLockStrength(s,side,reduced){
    if(s.state===SKATE_ANIMATION_STATE.CRASH||s.state===SKATE_ANIMATION_STATE.FAILED_LAND)return 0;
    if(s.state===SKATE_ANIMATION_STATE.PUSH){
      if(side===frontSide)return .98;
      return .08+(1-Math.sin(s.pushPhase*Math.PI))*.72;
    }
    const p=s.trickProgress==null?.5:s.trickProgress;
    const mid=Math.sin(clamp(p,0,1)*Math.PI);
    if(isFlipState(s.state))return .88-mid*.72;
    if(isShoveState(s.state))return .90-mid*.52;
    if(s.state===SKATE_ANIMATION_STATE.GRAB)return .58;
    if(s.state===SKATE_ANIMATION_STATE.OLLIE_POP)return .78;
    if(s.state===SKATE_ANIMATION_STATE.OLLIE_LEVEL||s.state===SKATE_ANIMATION_STATE.LANDING_PREP)return .84;
    if(s.air)return .74;
    return reduced?.98:.96;
  }

  function applyFootLock(side,s,dt,reduced){
    const metric=legMetrics.get(side);
    if(!metric||!boardTargetRoot)return false;
    const lock=footLockStrength(s,side,reduced);
    if(lock<=.001)return false;
    boardTargetRoot.localToWorld(ikTarget.copy(metric.targetLocal));
    metric.thigh.getWorldPosition(ikHip);metric.shin.getWorldPosition(ikKnee);metric.foot.getWorldPosition(ikFoot);
    ikDirection.copy(ikTarget).sub(ikHip);
    let distance=ikDirection.length();
    if(distance<1e-5)return false;
    ikDirection.multiplyScalar(1/distance);
    distance=clamp(distance,Math.abs(metric.upperLength-metric.lowerLength)+.006,metric.upperLength+metric.lowerLength-.008);
    ikPole.copy(metric.poleLocal).applyQuaternion(modelWorldQ);
    ikPerp.copy(ikPole).addScaledVector(ikDirection,-ikPole.dot(ikDirection));
    if(ikPerp.lengthSq()<1e-6)ikPerp.set(0,0,1).applyQuaternion(modelWorldQ).addScaledVector(ikDirection,-ikDirection.z);
    ikPerp.normalize();
    const upper=metric.upperLength,lower=metric.lowerLength;
    const along=clamp((upper*upper-lower*lower+distance*distance)/(2*distance),0,upper);
    const height=Math.sqrt(Math.max(0,upper*upper-along*along));
    ikKneeGoal.copy(ikHip).addScaledVector(ikDirection,along).addScaledVector(ikPerp,height);
    const response=blendFactor(.30+lock*.18,dt)*lock;
    ikCurrentDirection.copy(ikKnee).sub(ikHip);ikDesiredDirection.copy(ikKneeGoal).sub(ikHip);
    if(alignBoneToDirection(metric.thigh,ikCurrentDirection,ikDesiredDirection,response)){
      metric.thigh.updateWorldMatrix(true,true);
      metric.shin.getWorldPosition(ikKnee);metric.foot.getWorldPosition(ikFoot);
      ikCurrentDirection.copy(ikFoot).sub(ikKnee);ikDesiredDirection.copy(ikTarget).sub(ikKnee);
      alignBoneToDirection(metric.shin,ikCurrentDirection,ikDesiredDirection,response*.92);
      metric.shin.updateWorldMatrix(true,true);
    }
    if(metric.foot.parent){
      boardTargetRoot.getWorldQuaternion(boardWorldQ);
      targetWorldQ.copy(boardWorldQ).multiply(metric.footRelativeQ);
      metric.foot.parent.getWorldQuaternion(parentWorldQ);
      inverseParentQ.copy(parentWorldQ).invert();
      goalQ.copy(inverseParentQ).multiply(targetWorldQ);
      metric.foot.quaternion.slerp(goalQ,response*.78);
    }
    metric.foot.updateWorldMatrix(true,false);
    diagnostics.ikSolves++;
    return true;
  }

  function updateBoard(frame,s,dt,reduced){
    if(!boardPoseRoot)return;
    let targetX=Number(frame.boardVisualOffsetX)||0;
    let targetY=0;
    let targetZ=Number(frame.boardVisualOffsetZ)||0;
    const groundPitch=clamp(frame.groundPitch??0,-.18,.18);
    const groundRoll=clamp(frame.groundRoll??0,-.18,.18);
    const ascent=s.air?clamp(s.verticalVelocity/11,0,1):0;
    const descent=s.air?clamp(-s.verticalVelocity/11,0,1):0;
    const apex=s.air?clamp(1-Math.abs(s.verticalVelocity)/4.6,0,1):0;
    const jumpScale=String(frame.jumpSource||'').toLowerCase()==='ramp'?1:.72;
    let pitch=ascent*.095*jumpScale+apex*.020-descent*.072*jumpScale-s.landing*.026+groundPitch*.28;
    let yaw=-s.steer*.040;
    let roll=-s.steer*.085+groundRoll*.16;
    let compression=0;

    targetY+=s.air*.026-s.landing*.012-s.speed01*.004;
    targetZ+=s.air*.012;

    const progress=s.trickProgress;
    if(progress!=null){
      if(s.state===SKATE_ANIMATION_STATE.KICKFLIP)roll=-TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.HEELFLIP)roll=TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.SHOVE_IT)yaw=-TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE)yaw=TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.VARIAL_FLIP){roll=-TAU*progress;yaw=-Math.PI*progress;}
      else if(s.state===SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP){roll=-TAU*progress;yaw=-TAU*progress;}
      else if(s.state===SKATE_ANIMATION_STATE.SPIN_180)yaw=Math.PI*progress;
      else if(s.state===SKATE_ANIMATION_STATE.SPIN_360)yaw=TAU*progress;
    }

    if(s.state===SKATE_ANIMATION_STATE.MANUAL)pitch=-.115-s.manualBalance*.025;
    else if(s.state===SKATE_ANIMATION_STATE.NOSE_MANUAL)pitch=.115+s.manualBalance*.025;

    if(s.state===SKATE_ANIMATION_STATE.GRIND||s.state===SKATE_ANIMATION_STATE.SLIDE){
      const orientation=frame.grindBoardOrientation||frame.boardVisualOrientation||null;
      if(orientation){
        pitch+=clamp(orientation.x,-.45,.45);
        yaw+=clamp(orientation.y,-Math.PI,Math.PI);
        roll+=clamp(orientation.z,-.45,.45);
      }else{
        if(Number.isFinite(frame.grindBoardPitch))pitch+=clamp(frame.grindBoardPitch,-.45,.45);
        if(Number.isFinite(frame.grindBoardYaw))yaw+=clamp(frame.grindBoardYaw,-Math.PI,Math.PI);
        if(Number.isFinite(frame.grindBoardRoll))roll+=clamp(frame.grindBoardRoll,-.45,.45);
      }
    }

    if(s.state===SKATE_ANIMATION_STATE.OLLIE_ANTICIPATION)compression=.28;
    else if(s.state===SKATE_ANIMATION_STATE.OLLIE_COMPRESSION)compression=.55;
    else if(s.state===SKATE_ANIMATION_STATE.OLLIE_POP)compression=.18;
    else if(s.state===SKATE_ANIMATION_STATE.LAND)compression=.44*s.landing;
    else if(s.state===SKATE_ANIMATION_STATE.SKETCHY_LAND)compression=.58*Math.max(.2,s.landing);
    else if(s.state===SKATE_ANIMATION_STATE.HARD_LAND)compression=.88*Math.max(.35,s.landing);
    else if(s.state===SKATE_ANIMATION_STATE.FAILED_LAND)compression=.96*Math.max(.4,s.landing);

    if(isPowerSlide(s.state))yaw+=s.steer*(.075+.035*clamp(frame.powerslideAmount??frame.slip??0,0,1));
    if(s.state===SKATE_ANIMATION_STATE.GRIND||s.state===SKATE_ANIMATION_STATE.SLIDE)roll+=s.grindBalance*.055;
    if(s.state===SKATE_ANIMATION_STATE.CRASH){
      const lateral=s.crashKind.includes('LATERAL');
      const failedLanding=s.crashKind.includes('LANDING');
      const grindFailure=s.crashKind.includes('GRIND');
      const highSpeed=s.crashKind.includes('HIGH_SPEED');
      roll+=(lateral?.34:.22)*(s.steer>=0?1:-1);
      yaw+=(grindFailure?.31:highSpeed?.23:.16)*sideSign;
      pitch+=failedLanding?.20:highSpeed?.08:0;
      targetY=.018;
    }

    const vibration=reduced?0:Math.sin((Number(frame.time)||0)*43.0)*.0035*s.speed01*(s.air?0:.6);
    targetY+=vibration-compression*.010;

    const response=blendFactor(.34,dt);
    boardPoseRoot.position.x=THREE.MathUtils.lerp(boardPoseRoot.position.x,targetX,response);
    boardPoseRoot.position.y=THREE.MathUtils.lerp(boardPoseRoot.position.y,targetY,response);
    boardPoseRoot.position.z=THREE.MathUtils.lerp(boardPoseRoot.position.z,targetZ,response);
    boardPoseRoot.rotation.x=THREE.MathUtils.lerp(boardPoseRoot.rotation.x,pitch,response);
    boardPoseRoot.rotation.y=THREE.MathUtils.lerp(boardPoseRoot.rotation.y,yaw,response);
    boardPoseRoot.rotation.z=THREE.MathUtils.lerp(boardPoseRoot.rotation.z,roll,response);
    boardPoseRoot.scale.y=THREE.MathUtils.lerp(boardPoseRoot.scale.y,1-compression*.012,response);
    boardPoseRoot.scale.z=THREE.MathUtils.lerp(boardPoseRoot.scale.z,1+compression*.003,response);

    const truckCompression=compression*.008;
    if(frontTruck)frontTruck.position.y=THREE.MathUtils.lerp(frontTruck.position.y,frontTruckRestY+truckCompression,response);
    if(rearTruck)rearTruck.position.y=THREE.MathUtils.lerp(rearTruck.position.y,rearTruckRestY+truckCompression,response);
  }

  function update(frame={}){
    if(!active)return pose;
    const perfStart=perfNow?perfNow():0;
    const s=machine.sample(frame);
    const dt=clamp(frame.dt??1/60,1/240,.10);
    const reduced=frame.reducedMotion==null?systemReducedMotion:!!frame.reducedMotion;
    const response=blendFactor(.22,dt);

    pose.carve=THREE.MathUtils.lerp(pose.carve,s.steer,response);
    pose.speed=THREE.MathUtils.lerp(pose.speed,s.speed01,blendFactor(.12,dt));
    pose.air=THREE.MathUtils.lerp(pose.air,s.air?1:0,blendFactor(s.air?.28:.18,dt));
    pose.landing=THREE.MathUtils.lerp(pose.landing,s.landing,blendFactor(s.landing>pose.landing?.52:.22,dt));
    pose.state=s.state;
    pose.pushPhase=s.pushPhase;

    if(isPowerSlide(lastState)&&!isPowerSlide(s.state))slideRecoil=reduced?0:.18;
    slideRecoil=Math.max(0,slideRecoil-dt);

    const carve=pose.carve;
    const speed=pose.speed;
    const air=pose.air;
    let crouch=.13+speed*.08+Math.abs(carve)*.035;
    let hipYaw=carve*.028;
    let hipRoll=-carve*.095*(1-air);
    let spinePitch=-.05-speed*.025;
    let spineYaw=-sideSign*.075-carve*.018;
    let chestPitch=-.025;
    let chestYaw=-sideSign*.105-carve*.020;
    let neckYaw=-sideSign*.17;
    let headYaw=-sideSign*.30;
    let frontThigh=-.40-speed*.065;
    let rearThigh=-.38-speed*.060;
    let frontShin=.74+speed*.07;
    let rearShin=.70+speed*.07;
    let frontFoot=-.13-carve*.025;
    let rearFoot=-.12-carve*.020;
    let armSpread=.72;
    let armDown=.63;
    let armForward=.10;
    let armLiftBias=0;
    let torsoRoll=carve*.035;
    let boardCompression=0;

    if(s.state===SKATE_ANIMATION_STATE.IDLE){
      crouch=.10;
      armSpread=.60;
      armDown=.72;
    }else if(s.state===SKATE_ANIMATION_STATE.PUSH){
      const swing=Math.sin(s.pushPhase*Math.PI);
      const returnPhase=Math.sin(s.pushPhase*TAU);
      crouch=.14+speed*.06;
      frontThigh=-.43-speed*.05;
      frontShin=.77+speed*.06;
      frontFoot=-.10;
      rearThigh=-.16+swing*.38;
      rearShin=.34-swing*.20;
      rearFoot=-.03+swing*.08;
      spinePitch=-.09-speed*.025;
      armForward=.14;
      armLiftBias=returnPhase*.12;
    }else if(s.state===SKATE_ANIMATION_STATE.ACCELERATE||s.state===SKATE_ANIMATION_STATE.BANANA_POWER){
      crouch=.18+speed*.10;
      spinePitch=-.11-speed*.035;
      chestPitch=-.05;
      armSpread=.76;
      armDown=.58;
      if(s.state===SKATE_ANIMATION_STATE.BANANA_POWER){
        crouch+=.035;
        armSpread=.82;
        hipRoll*=1.18;
      }
    }else if(s.state===SKATE_ANIMATION_STATE.DEEP_CARVE){
      crouch=.24+Math.abs(carve)*.11;
      hipRoll=-carve*.145;
      torsoRoll=carve*.075;
      armSpread=.86;
      armDown=.54;
    }else if(isPowerSlide(s.state)){
      crouch=.31;
      hipYaw=-carve*.12;
      hipRoll=-carve*.12;
      spineYaw+=carve*.18;
      chestYaw+=carve*.26;
      torsoRoll=carve*.08;
      frontThigh-=.08;
      rearThigh-=.12;
      frontShin+=.15;
      rearShin+=.18;
      armSpread=.96;
      armDown=.42;
    }else if(s.state===SKATE_ANIMATION_STATE.OLLIE_ANTICIPATION){
      crouch=.25;
      frontThigh=-.52;
      rearThigh=-.54;
      frontShin=.91;
      rearShin=.94;
      spinePitch=-.11;
      armSpread=.66;
      armDown=.55;
    }else if(s.state===SKATE_ANIMATION_STATE.CROUCH||s.state===SKATE_ANIMATION_STATE.OLLIE_COMPRESSION){
      crouch=s.state===SKATE_ANIMATION_STATE.OLLIE_COMPRESSION?.36:.30;
      frontThigh=-.58;
      rearThigh=-.61;
      frontShin=1.00;
      rearShin=1.04;
      spinePitch=-.13;
      armSpread=.68;
      armDown=.52;
      boardCompression=.6;
    }else if(s.state===SKATE_ANIMATION_STATE.OLLIE_POP){
      crouch=.13;
      frontThigh=-.68;
      frontShin=.80;
      rearThigh=-.22;
      rearShin=.38;
      frontFoot=-.03;
      rearFoot=.08;
      spinePitch=-.03;
      armSpread=.82;
      armDown=.42;
    }else if(isAirState(s.state)){
      crouch=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?.23:.16;
      frontThigh=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?-.58:-.64;
      rearThigh=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?-.57:-.61;
      frontShin=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?.90:.92;
      rearShin=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?.89:.88;
      frontFoot=-.04;
      rearFoot=-.03;
      spinePitch=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?-.07:-.02;
      armSpread=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?.88:.82;
      armDown=s.state===SKATE_ANIMATION_STATE.LANDING_PREP?.45:.48;
      if(s.state===SKATE_ANIMATION_STATE.OLLIE_LEVEL){
        frontThigh=-.60;
        rearThigh=-.60;
        frontShin=.88;
        rearShin=.88;
        spinePitch=-.015;
      }else if(s.state===SKATE_ANIMATION_STATE.GRAB){
        frontThigh=-.72;
        rearThigh=-.69;
        frontShin=1.02;
        rearShin=.98;
        spinePitch=-.16;
      }
    }else if(s.state===SKATE_ANIMATION_STATE.MANUAL){
      crouch=.19;
      frontThigh=-.31;
      rearThigh=-.50;
      frontShin=.58;
      rearShin=.82;
      spinePitch=.01;
      hipYaw+=.025*sideSign;
      hipRoll+=s.manualBalance*.075;
      torsoRoll+=s.manualBalance*.055;
      armSpread=.92+Math.abs(s.manualBalance)*.08;
      armDown=.48-Math.abs(s.manualBalance)*.04;
      armLiftBias-=s.manualBalance*.08;
    }else if(s.state===SKATE_ANIMATION_STATE.NOSE_MANUAL){
      crouch=.19;
      frontThigh=-.52;
      rearThigh=-.31;
      frontShin=.84;
      rearShin=.57;
      spinePitch=-.09;
      hipYaw-=.025*sideSign;
      hipRoll+=s.manualBalance*.075;
      torsoRoll+=s.manualBalance*.055;
      armSpread=.92+Math.abs(s.manualBalance)*.08;
      armDown=.48-Math.abs(s.manualBalance)*.04;
      armLiftBias-=s.manualBalance*.08;
    }else if(s.state===SKATE_ANIMATION_STATE.GRIND||s.state===SKATE_ANIMATION_STATE.SLIDE){
      crouch=.25+Math.abs(s.grindBalance)*.035;
      frontThigh=-.51;
      rearThigh=-.49;
      frontShin=.88;
      rearShin=.86;
      spineYaw+=s.state===SKATE_ANIMATION_STATE.SLIDE?-.16*sideSign:.04*sideSign;
      chestYaw+=s.state===SKATE_ANIMATION_STATE.SLIDE?-.22*sideSign:.06*sideSign;
      hipRoll+=s.grindBalance*.075;
      torsoRoll+=s.grindBalance*.085;
      armLiftBias-=s.grindBalance*.10;
      armSpread=.94+Math.abs(s.grindBalance)*.06;
      armDown=.45;
    }else if(isLandingState(s.state)){
      const sketchy=s.state===SKATE_ANIMATION_STATE.SKETCHY_LAND?1:0;
      const hard=s.state===SKATE_ANIMATION_STATE.HARD_LAND?1:0;
      const failed=s.state===SKATE_ANIMATION_STATE.FAILED_LAND?1:0;
      crouch=.25+s.landing*(.14+sketchy*.05+hard*.10+failed*.14);
      frontThigh=-.52-crouch*(.28+failed*.08);
      rearThigh=-.52-crouch*(.27+failed*.10);
      frontShin=.90+crouch*(.40+hard*.05+failed*.08);
      rearShin=.90+crouch*(.39+hard*.05+failed*.10);
      spinePitch=-.08-sketchy*.035-hard*.07-failed*.12;
      hipRoll+=sketchy*sideSign*.055+failed*sideSign*.11;
      torsoRoll+=sketchy*sideSign*.075+failed*sideSign*.16;
      armSpread=.84+sketchy*.08+hard*.10+failed*.14;
      armDown=.49-sketchy*.04-hard*.05-failed*.08;
      boardCompression=.45+sketchy*.16+hard*.42+failed*.50;
    }else if(s.state===SKATE_ANIMATION_STATE.RECOVERY){
      crouch=.20;
      armSpread=.92;
      armDown=.50;
      torsoRoll=slideRecoil*.42*sideSign;
    }else if(s.state===SKATE_ANIMATION_STATE.CRASH){
      const lateral=s.crashKind.includes('LATERAL')||s.crashKind.includes('ROCK');
      const landingFail=s.crashKind.includes('LAND');
      const grindFail=s.crashKind.includes('GRIND');
      crouch=.18;
      hipRoll=(lateral?.42:.30)*sideSign;
      hipYaw=(grindFail?.46:.28)*sideSign;
      spinePitch=landingFail?-.34:-.24;
      spineYaw=-(lateral?.34:.24)*sideSign;
      chestYaw=(grindFail?.34:.22)*sideSign;
      torsoRoll=(lateral?.38:.25)*sideSign;
      frontThigh=landingFail?-.46:-.20;
      rearThigh=-.72;
      frontShin=landingFail?.82:.40;
      rearShin=.95;
      armSpread=1.02;
      armDown=.25;
    }

    if(s.bananaPower&&s.state!==SKATE_ANIMATION_STATE.CRASH){
      crouch+=.025;
      armSpread=Math.min(1.0,armSpread+.04);
    }

    if(s.trickProgress!=null){
      const p=s.trickProgress;
      const arc=Math.sin(p*Math.PI);
      if(s.state===SKATE_ANIMATION_STATE.SPIN_180){
        hipYaw+=Math.PI*p*.34;
        chestYaw+=Math.PI*p*.24;
        headYaw-=Math.PI*p*.12;
      }else if(s.state===SKATE_ANIMATION_STATE.SPIN_360){
        hipYaw+=TAU*p*.30;
        chestYaw+=TAU*p*.20;
        headYaw-=TAU*p*.10;
      }else if(s.state===SKATE_ANIMATION_STATE.KICKFLIP||s.state===SKATE_ANIMATION_STATE.HEELFLIP){
        hipYaw+=sideSign*arc*.10;
        chestYaw-=sideSign*arc*.14;
        armLiftBias+=arc*.06;
      }else if(s.state===SKATE_ANIMATION_STATE.SHOVE_IT||s.state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE){
        const shoveSign=s.state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE?1:-1;
        hipYaw+=shoveSign*sideSign*arc*.18;
        chestYaw-=shoveSign*sideSign*arc*.14;
      }else if(s.state===SKATE_ANIMATION_STATE.VARIAL_FLIP||s.state===SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP){
        const amount=s.state===SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP?.24:.17;
        hipYaw-=sideSign*arc*amount;
        chestYaw+=sideSign*arc*(amount*.78);
        armSpread+=arc*.08;
      }
    }
    headYaw+=clamp(-(hipYaw+chestYaw)*.18,-.30,.30);

    if(reduced){
      armLiftBias*=.35;
      torsoRoll*=.82;
    }

    pose.crouch=THREE.MathUtils.lerp(pose.crouch,crouch,blendFactor(.24,dt));
    rotate('hips',pose.crouch*.20,hipYaw,hipRoll,.25,dt);
    rotate('spine',spinePitch,spineYaw,torsoRoll,.22,dt);
    rotate('chest',chestPitch,chestYaw,torsoRoll*.65,.21,dt);
    rotate('neck',.02,neckYaw,-carve*.012,.20,dt);
    rotate('head',.01,headYaw,-carve*.012,.18,dt);

    const frontPrefix=frontSide;
    const rearPrefix=rearSide;
    rotate(frontPrefix+'Thigh',frontThigh,frontSide==='left'?-sideSign*.10:sideSign*.10,.075*(frontSide==='left'?-1:1),.25,dt);
    rotate(frontPrefix+'Shin',frontShin,0,0,.25,dt);
    rotate(frontPrefix+'Foot',frontFoot,frontSide==='left'?-sideSign*.045:sideSign*.045,-carve*.028,.24,dt);
    rotate(rearPrefix+'Thigh',rearThigh,rearSide==='left'?-sideSign*.10:sideSign*.10,.075*(rearSide==='left'?-1:1),.25,dt);
    rotate(rearPrefix+'Shin',rearShin,0,0,.25,dt);
    rotate(rearPrefix+'Foot',rearFoot,rearSide==='left'?-sideSign*.045:sideSign*.045,-carve*.024,.24,dt);

    updateBoard(frame,s,dt,reduced);
    if(boardCompression>0&&boardPoseRoot)boardPoseRoot.scale.y=Math.min(boardPoseRoot.scale.y,1-boardCompression*.008);

    model.updateWorldMatrix(true,false);
    skeletonRoot.updateWorldMatrix(true,true);
    boardTargetRoot?.updateWorldMatrix(true,true);
    model.getWorldQuaternion(modelWorldQ);
    let footLocks=0;
    if(applyFootLock('left',s,dt,reduced))footLocks++;
    if(applyFootLock('right',s,dt,reduced))footLocks++;
    pose.footLock=footLocks*.5;
    riderRight.set(1,0,0).applyQuaternion(modelWorldQ).normalize();
    riderUp.set(0,1,0).applyQuaternion(modelWorldQ).normalize();
    riderForward.set(0,0,1).applyQuaternion(modelWorldQ).normalize();

    for(const side of ['left','right']){
      const sideLocal=side==='left'?-1:1;
      const authoredOut=armOutwardSigns.get(side)??sideLocal;
      let localSpread=armSpread;
      let localDown=armDown;
      let localForward=armForward;
      let lift=armLiftBias*sideLocal;

      if(isPowerSlide(s.state)){
        lift+=sideLocal===Math.sign(carve)?.10:-.06;
      }
      if(s.state===SKATE_ANIMATION_STATE.PUSH){
        const isRear=side===rearSide;
        lift+=(isRear?1:-1)*Math.sin(s.pushPhase*TAU)*.13;
      }
      const grabbing=s.state===SKATE_ANIMATION_STATE.GRAB&&
        (s.grabType==='NOSEGRAB'?side===frontSide:side===rearSide);
      if(grabbing){
        localSpread=.30;
        localDown=.94;
        localForward=.18;
      }

      applyArmRest(side+'Shoulder',0,0,carve*.004,.26,dt);
      rig[side+'Shoulder']?.updateWorldMatrix(true,true);
      upperTarget.copy(riderRight).multiplyScalar(authoredOut*localSpread)
        .addScaledVector(riderUp,-localDown+lift)
        .addScaledVector(riderForward,localForward)
        .normalize();
      if(!aimArm(side+'UpperArm',upperTarget,.29,dt)){
        applyArmRest(side+'UpperArm',-.10,0,sideLocal*.55,.27,dt);
      }
      rig[side+'UpperArm']?.updateWorldMatrix(true,true);
      foreTarget.copy(riderRight).multiplyScalar(authoredOut*(grabbing?.22:localSpread*.62))
        .addScaledVector(riderUp,-(grabbing?.98:Math.min(.92,localDown+.20))+lift*.55)
        .addScaledVector(riderForward,localForward+.06)
        .normalize();
      if(!aimArm(side+'Forearm',foreTarget,.30,dt)){
        applyArmRest(side+'Forearm',-.10,0,sideLocal*.08,.28,dt);
      }
      applyArmRest(side+'Hand',0,0,0,.30,dt);
    }

    const secondaryBob=reduced?0:Math.sin((Number(frame.time)||0)*5.2)*.0035*(1-air);
    model.position.y=THREE.MathUtils.lerp(
      model.position.y,
      modelBaseY-pose.crouch*.035+air*.012-pose.landing*.030+secondaryBob,
      blendFactor(.26,dt)
    );

    lastState=s.state;
    if(perfNow){
      const elapsed=Math.max(0,perfNow()-perfStart);
      diagnostics.samples++;
      diagnostics.totalMs+=elapsed;
      diagnostics.maxMs=Math.max(diagnostics.maxMs,elapsed);
    }
    return pose;
  }

  return {
    update,
    reset,
    setActive,
    pose,
    stateMachine:machine,
    boardPoseRoot,
    footPlacementMode:legMetrics.size===2?'board-space-two-bone-partial-ik':'board-space-ankle-fallback',
    stanceMode:resolvedStance,
    getDiagnostics(){
      return {
        samples:diagnostics.samples,
        averageMs:diagnostics.samples?diagnostics.totalMs/diagnostics.samples:0,
        maxMs:diagnostics.maxMs,
        ikSolves:diagnostics.ikSolves,
        ikFallbacks:diagnostics.ikFallbacks,
        ikLegs:legMetrics.size,
        stance:resolvedStance
      };
    },
    get state(){return machine.snapshot.state;},
    get active(){return active;}
  };
}
