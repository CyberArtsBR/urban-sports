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
    state===SKATE_ANIMATION_STATE.AIRBORNE||
    state===SKATE_ANIMATION_STATE.SPIN_180||
    state===SKATE_ANIMATION_STATE.SPIN_360||
    state===SKATE_ANIMATION_STATE.KICKFLIP||
    state===SKATE_ANIMATION_STATE.HEELFLIP||
    state===SKATE_ANIMATION_STATE.SHOVE_IT||
    state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE||
    state===SKATE_ANIMATION_STATE.GRAB;
}

export function createSkateboardAnimator({
  model,
  rig,
  snowboard,
  stance=null,
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
  const frontSide=stance?.leftFront===false?'right':'left';
  const rearSide=frontSide==='left'?'right':'left';
  const systemReducedMotion=!!reducedMotion||!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const pose={
    carve:0,
    speed:0,
    air:0,
    landing:0,
    crouch:0,
    state:SKATE_ANIMATION_STATE.IDLE,
    pushPhase:0
  };
  let active=true;
  let lastState=SKATE_ANIMATION_STATE.IDLE;
  let slideRecoil=0;

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
  }

  function setActive(next=true){
    const value=!!next;
    if(active===value)return active;
    active=value;
    reset();
    return active;
  }

  function updateBoard(frame,s,dt,reduced){
    if(!boardPoseRoot)return;
    let targetX=0,targetY=0,targetZ=0;
    let pitch=0,yaw=0,roll=0;
    let compression=0;

    const progress=s.trickProgress;
    if(progress!=null){
      if(s.state===SKATE_ANIMATION_STATE.KICKFLIP)roll=-TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.HEELFLIP)roll=TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.SHOVE_IT)yaw=-TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.FRONTSIDE_SHOVE)yaw=TAU*progress;
      else if(s.state===SKATE_ANIMATION_STATE.SPIN_180)yaw=Math.PI*progress;
      else if(s.state===SKATE_ANIMATION_STATE.SPIN_360)yaw=TAU*progress;
    }

    if(s.state===SKATE_ANIMATION_STATE.MANUAL)pitch=-.115;
    else if(s.state===SKATE_ANIMATION_STATE.NOSE_MANUAL)pitch=.115;

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

    if(s.state===SKATE_ANIMATION_STATE.OLLIE_COMPRESSION)compression=.55;
    else if(s.state===SKATE_ANIMATION_STATE.OLLIE_POP)compression=.18;
    else if(s.state===SKATE_ANIMATION_STATE.LAND)compression=.48*s.landing;
    else if(s.state===SKATE_ANIMATION_STATE.HARD_LAND)compression=.88*Math.max(.35,s.landing);

    if(isPowerSlide(s.state))yaw+=s.steer*.075;
    if(s.state===SKATE_ANIMATION_STATE.CRASH){
      roll+=s.steer>=0?.22:-.22;
      yaw+=.16*sideSign;
      targetY=.018;
    }

    const vibration=reduced?0:Math.sin((Number(frame.time)||0)*43.0)*.0035*s.speed01*(s.air?0:.6:1);
    targetY+=vibration-compression*.010;
    targetX=(Number(frame.boardVisualOffsetX)||0);
    targetZ=(Number(frame.boardVisualOffsetZ)||0);

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
      crouch=.16;
      frontThigh=-.64;
      rearThigh=-.61;
      frontShin=.92;
      rearShin=.88;
      frontFoot=-.04;
      rearFoot=-.03;
      spinePitch=-.02;
      armSpread=.82;
      armDown=.48;
      if(s.state===SKATE_ANIMATION_STATE.GRAB){
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
      armSpread=.92;
      armDown=.48;
    }else if(s.state===SKATE_ANIMATION_STATE.NOSE_MANUAL){
      crouch=.19;
      frontThigh=-.52;
      rearThigh=-.31;
      frontShin=.84;
      rearShin=.57;
      spinePitch=-.09;
      hipYaw-=.025*sideSign;
      armSpread=.92;
      armDown=.48;
    }else if(s.state===SKATE_ANIMATION_STATE.GRIND||s.state===SKATE_ANIMATION_STATE.SLIDE){
      crouch=.25;
      frontThigh=-.51;
      rearThigh=-.49;
      frontShin=.88;
      rearShin=.86;
      spineYaw+=s.state===SKATE_ANIMATION_STATE.SLIDE?-.16*sideSign:.04*sideSign;
      chestYaw+=s.state===SKATE_ANIMATION_STATE.SLIDE?-.22*sideSign:.06*sideSign;
      armSpread=.94;
      armDown=.45;
    }else if(s.state===SKATE_ANIMATION_STATE.LAND||s.state===SKATE_ANIMATION_STATE.HARD_LAND){
      const hard=s.state===SKATE_ANIMATION_STATE.HARD_LAND?1:0;
      crouch=.27+s.landing*(.16+hard*.10);
      frontThigh=-.52-crouch*.30;
      rearThigh=-.52-crouch*.28;
      frontShin=.90+crouch*.42;
      rearShin=.90+crouch*.40;
      spinePitch=-.09-hard*.07;
      armSpread=.86+hard*.09;
      armDown=.48-hard*.05;
      boardCompression=.5+hard*.4;
    }else if(s.state===SKATE_ANIMATION_STATE.RECOVERY){
      crouch=.20;
      armSpread=.92;
      armDown=.50;
      torsoRoll=slideRecoil*.42*sideSign;
    }else if(s.state===SKATE_ANIMATION_STATE.CRASH){
      crouch=.18;
      hipRoll=.30*sideSign;
      hipYaw=.28*sideSign;
      spinePitch=-.24;
      spineYaw=-.24*sideSign;
      chestYaw=.22*sideSign;
      torsoRoll=.25*sideSign;
      frontThigh=-.20;
      rearThigh=-.72;
      frontShin=.40;
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
      if(s.state===SKATE_ANIMATION_STATE.SPIN_180){
        hipYaw+=Math.PI*p*.34;
        chestYaw+=Math.PI*p*.24;
        headYaw-=Math.PI*p*.12;
      }else if(s.state===SKATE_ANIMATION_STATE.SPIN_360){
        hipYaw+=TAU*p*.30;
        chestYaw+=TAU*p*.20;
        headYaw-=TAU*p*.10;
      }
    }

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

    model.updateWorldMatrix(true,true);
    model.getWorldQuaternion(modelWorldQ);
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

    updateBoard(frame,s,dt,reduced);
    if(boardCompression>0&&boardPoseRoot){
      boardPoseRoot.scale.y=Math.min(boardPoseRoot.scale.y,1-boardCompression*.008);
    }

    lastState=s.state;
    return pose;
  }

  return {
    update,
    reset,
    setActive,
    pose,
    stateMachine:machine,
    boardPoseRoot,
    footPlacementMode:'proportional-rest-pose-lock',
    get state(){return machine.snapshot.state;},
    get active(){return active;}
  };
}
