import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {
  SKATE_ANIMATION_STATE,
  createSkateAnimationStateMachine,
  normalizeSkateAnimationState,
  normalizeSkateTrick
} from '../src/rider/SkateAnimationState.js';
import {createSkateboardAnimator} from '../src/rider/SkateboardAnimator.js';
import {createSkateboardEquipment} from '../src/skateboardEquipment.js';
import {createRiderController} from '../src/riderController.js';
import {createImpactVfx} from '../src/impactVfx.js';
import {getAvatarCompatibility,resolveAvatarRig} from '../src/avatarCompatibility.js';
import {BUILTIN_AVATAR_NAMES} from '../src/avatarRoster.js';

function close(a,b,epsilon=1e-7,message='values must match'){
  assert.ok(Math.abs(a-b)<=epsilon,`${message}: ${a} vs ${b}`);
}

function makeSyntheticRig({arms=true,missingRightFoot=false}={}){
  const model=new THREE.Group();
  model.name='synthetic-avatar';

  const hips=new THREE.Bone();hips.name='Hips';hips.position.set(0,1.18,0);model.add(hips);
  const spine=new THREE.Bone();spine.name='Spine';spine.position.set(0,.36,0);hips.add(spine);
  const chest=new THREE.Bone();chest.name='Chest';chest.position.set(0,.34,0);spine.add(chest);
  const neck=new THREE.Bone();neck.name='Neck';neck.position.set(0,.28,0);chest.add(neck);
  const head=new THREE.Bone();head.name='Head';head.position.set(0,.20,0);neck.add(head);

  function leg(side,sign){
    const thigh=new THREE.Bone();thigh.name=side+'Thigh';thigh.position.set(sign*.19,-.08,0);hips.add(thigh);
    const shin=new THREE.Bone();shin.name=side+'Shin';shin.position.set(0,-.52,.015);thigh.add(shin);
    const foot=new THREE.Bone();foot.name=side+'Foot';foot.position.set(0,-.48,.10);
    if(!(missingRightFoot&&side==='Right'))shin.add(foot);
    return {thigh,shin,foot:missingRightFoot&&side==='Right'?null:foot};
  }
  const left=leg('Left',-1),right=leg('Right',1);

  const rig={
    hips,spine,chest,neck,head,
    leftThigh:left.thigh,leftShin:left.shin,leftFoot:left.foot,
    rightThigh:right.thigh,rightShin:right.shin,rightFoot:right.foot
  };

  if(arms){
    function arm(side,sign){
      const shoulder=new THREE.Bone();shoulder.name=side+'Shoulder';shoulder.position.set(sign*.20,.22,0);chest.add(shoulder);
      const upper=new THREE.Bone();upper.name=side+'UpperArm';upper.position.set(sign*.12,0,0);shoulder.add(upper);
      const fore=new THREE.Bone();fore.name=side+'Forearm';fore.position.set(sign*.34,-.08,.02);upper.add(fore);
      const hand=new THREE.Bone();hand.name=side+'Hand';hand.position.set(sign*.30,-.08,.02);fore.add(hand);
      return {shoulder,upper,fore,hand};
    }
    const la=arm('Left',-1),ra=arm('Right',1);
    Object.assign(rig,{
      leftShoulder:la.shoulder,leftUpperArm:la.upper,leftForearm:la.fore,leftHand:la.hand,
      rightShoulder:ra.shoulder,rightUpperArm:ra.upper,rightForearm:ra.fore,rightHand:ra.hand
    });
  }

  model.updateMatrixWorld(true);
  return {model,rig};
}

function makeAnimator({stanceMode='regular',arms=true,missingRightFoot=false}={}){
  const visualRoot=new THREE.Group();
  const {model,rig}=makeSyntheticRig({arms,missingRightFoot});
  visualRoot.add(model);
  const board=createSkateboardEquipment({boardY:.10});
  visualRoot.add(board.root);
  visualRoot.updateMatrixWorld(true);
  const animator=createSkateboardAnimator({
    model,rig,snowboard:board,
    stance:{
      leftBindingX:0,leftBindingZ:-.30,
      rightBindingX:0,rightBindingZ:.30,
      leftFront:stanceMode!=='goofy'
    },
    stanceMode,
    sideSign:stanceMode==='goofy'?-1:1
  });
  assert.ok(animator,'animator should construct');
  return {visualRoot,model,rig,board,animator};
}

function assertQuaternionRestored(actual,expected,label){
  assert.ok(actual.angleTo(expected)<1e-6,label+' must restore its rest quaternion');
}

assert.equal(normalizeSkateAnimationState('ollieCompression'),SKATE_ANIMATION_STATE.OLLIE_COMPRESSION);
assert.equal(normalizeSkateAnimationState('noseManual'),SKATE_ANIMATION_STATE.NOSE_MANUAL);
assert.equal(normalizeSkateTrick('POP SHOVE-IT'),SKATE_ANIMATION_STATE.SHOVE_IT);
assert.equal(normalizeSkateTrick('VARIAL FLIP'),SKATE_ANIMATION_STATE.VARIAL_FLIP);
assert.equal(normalizeSkateTrick('360 FLIP'),SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP);

{
  const machine=createSkateAnimationStateMachine();
  assert.equal(machine.sample({skateboardState:'ollieCompression',speed:8}).state,SKATE_ANIMATION_STATE.OLLIE_COMPRESSION);
  assert.equal(machine.sample({air:true,olliePhase:'air',verticalVelocity:5,speed:8}).state,SKATE_ANIMATION_STATE.OLLIE_POP);
  assert.equal(machine.sample({air:true,olliePhase:'air',verticalVelocity:.4,speed:8}).state,SKATE_ANIMATION_STATE.OLLIE_LEVEL);
  assert.equal(machine.sample({air:true,olliePhase:'air',verticalVelocity:-5,speed:8}).state,SKATE_ANIMATION_STATE.LANDING_PREP);
  assert.equal(machine.sample({air:true,trickType:'VARIAL FLIP',trickProgress:.5,speed:8}).state,SKATE_ANIMATION_STATE.VARIAL_FLIP);
  assert.equal(machine.sample({air:true,trickType:'360 FLIP',trickProgress:.5,speed:8}).state,SKATE_ANIMATION_STATE.THREE_SIXTY_FLIP);
  assert.equal(machine.sample({manualMode:'noseManual',manualBalance:.45,speed:8}).state,SKATE_ANIMATION_STATE.NOSE_MANUAL);
  assert.equal(machine.snapshot.manualBalance,.45);
  assert.equal(machine.sample({grinding:true,grindTrick:'boardslide',grindBalance:-.35,speed:8}).state,SKATE_ANIMATION_STATE.SLIDE);
  assert.equal(machine.snapshot.grindBalance,-.35);
  assert.equal(machine.sample({landing:.8,landingQuality:'clean',speed:8}).state,SKATE_ANIMATION_STATE.LAND);
  assert.equal(machine.sample({landing:.8,landingQuality:'sketchy',speed:8}).state,SKATE_ANIMATION_STATE.SKETCHY_LAND);
  assert.equal(machine.sample({landing:.8,landingQuality:'hard',speed:8}).state,SKATE_ANIMATION_STATE.HARD_LAND);
  assert.equal(machine.sample({landing:.8,landingQuality:'failed',speed:8}).state,SKATE_ANIMATION_STATE.FAILED_LAND);
  assert.equal(machine.sample({crashed:true,crashType:'lateral_impact',speed:18}).state,SKATE_ANIMATION_STATE.CRASH);
  assert.equal(machine.sample({dt:.1,speed:8}).state,SKATE_ANIMATION_STATE.RECOVERY);
  assert.equal(machine.sample({reducedMotion:true,speed:8}).reducedMotion,true);
  machine.reset();
  assert.equal(machine.snapshot.state,SKATE_ANIMATION_STATE.IDLE);
}

{
  const board=createSkateboardEquipment();
  const result=board.updateMotion({
    dt:1/60,speed:18,lean:.8,steer:.6,air:false,time:.75,
    trickType:'KICKFLIP',trickProgress:.5,landing:.8,powerslide:.7,
    roadRoughness:.8,reducedMotion:false
  });
  assert.notEqual(result.wheelRotation,0);
  assert.notEqual(board.motionRoot.rotation.z,0);
  const reduced=board.updateMotion({dt:1/60,speed:18,time:.75,roadRoughness:.8,reducedMotion:true});
  assert.equal(reduced.roadVibration,0,'reduced motion must disable road vibration');
  board.resetMotion();
  board.updateMotion({
    dt:1/60,speed:10,lean:0,steer:0,air:true,time:1,
    trickType:'KICKFLIP',trickProgress:.5,externalPose:true
  });
  close(board.motionRoot.rotation.z,0,1e-9,'external rider pose prevents duplicate trick roll');
  board.resetMotion();
  close(board.motionRoot.position.length(),0,1e-9,'board position reset');
  close(board.motionRoot.rotation.x,0,1e-9,'board pitch reset');
  close(board.motionRoot.rotation.y,0,1e-9,'board yaw reset');
  close(board.motionRoot.rotation.z,0,1e-9,'board roll reset');
  board.dispose();
}

{
  const scene=new THREE.Scene();
  const vfx=createImpactVfx({scene,capacity:64});
  const dry=vfx.skateEvent({type:'powerslideStart',intensity:1},{speed:18,reducedMotion:false});
  const reduced=vfx.skateEvent({type:'powerslideStart',intensity:1},{speed:18,reducedMotion:true});
  assert.ok(dry>reduced,'reduced motion must lower emitted skateboard particle count');
  assert.ok(vfx.skateEvent({type:'boardScrape',intensity:.8},{speed:12})>0,'board scrape must use bounded spark VFX');
  assert.equal(vfx.points.geometry.getAttribute('position').count,64,'VFX pool capacity must stay bounded');
  for(let i=0;i<100;i++)vfx.skateEvent({type:'wheelRoll',intensity:.5},{speed:14,wetness:i%2?.5:0});
  assert.equal(vfx.points.geometry.getAttribute('position').count,64,'repeated VFX emissions must not grow geometry');
  vfx.reset();
  vfx.dispose();
}

for(const stanceMode of ['regular','goofy']){
  const {model,rig,board,animator}=makeAnimator({stanceMode});
  assert.equal(animator.stanceMode,stanceMode);
  assert.equal(animator.footPlacementMode,'board-space-two-bone-partial-ik');
  const rest=new Map(Object.values(rig).filter(Boolean).map(bone=>[bone,bone.quaternion.clone()]));

  const frames=[
    {dt:1/60,speed:10,skateboardState:'push',pushProgress:.35,time:.1},
    {dt:1/60,speed:12,skateboardState:'ollieCompression',olliePhase:'compression',time:.2},
    {dt:1/60,speed:12,air:true,olliePhase:'pop',verticalVelocity:8,time:.3},
    {dt:1/60,speed:12,air:true,trickType:'KICKFLIP',trickProgress:.5,time:.4},
    {dt:1/60,speed:12,air:true,trickType:'HEELFLIP',trickProgress:.5,time:.5},
    {dt:1/60,speed:12,air:true,trickType:'POP SHOVE-IT',trickProgress:.5,time:.6},
    {dt:1/60,speed:12,air:true,trickType:'FRONTSIDE SHOVE-IT',trickProgress:.5,time:.7},
    {dt:1/60,speed:12,air:true,trickType:'VARIAL FLIP',trickProgress:.5,time:.8},
    {dt:1/60,speed:12,air:true,trickType:'360 FLIP',trickProgress:.5,time:.9},
    {dt:1/60,speed:10,manualMode:'manual',manualBalance:.65,time:1.0},
    {dt:1/60,speed:10,manualMode:'noseManual',manualBalance:-.60,time:1.1},
    {dt:1/60,speed:10,grinding:true,grindTrick:'boardslide',grindBalance:.55,time:1.2},
    {dt:1/60,speed:10,landing:.7,landingQuality:'sketchy',time:1.3},
    {dt:1/60,speed:10,landing:.9,landingQuality:'hard',time:1.4},
    {dt:1/60,speed:18,crashed:true,crashType:'high_speed_collision',time:1.5},
    {dt:1/60,speed:8,reducedMotion:true,time:1.6}
  ];
  for(const frame of frames)assert.doesNotThrow(()=>animator.update(frame),stanceMode+' frame should animate safely');
  assert.ok(animator.pose.footLock>=0&&animator.pose.footLock<=1,'foot lock diagnostic is normalized');
  assert.ok(animator.getDiagnostics().ikSolves>0,'IK should solve for complete synthetic legs');

  animator.reset();
  for(const [bone,q] of rest)assertQuaternionRestored(bone.quaternion,q,stanceMode+' '+bone.name);
  close(model.position.y,0,1e-9,'model vertical offset reset');
  close(animator.boardPoseRoot.rotation.x,0,1e-9,'board animator pitch reset');
  close(animator.boardPoseRoot.rotation.y,0,1e-9,'board animator yaw reset');
  close(animator.boardPoseRoot.rotation.z,0,1e-9,'board animator roll reset');
  board.dispose();
}

{
  const model=new THREE.Group();
  const board=createSkateboardEquipment();
  assert.equal(
    createSkateboardAnimator({model,rig:null,snowboard:board}),
    null,
    'unsupported local GLB rig must disable skeletal animator instead of throwing'
  );
  assert.doesNotThrow(()=>board.updateMotion({
    dt:1/60,speed:9,air:true,trickType:'KICKFLIP',trickProgress:.5,externalPose:false
  }),'unsupported local GLB keeps safe board-only animation fallback');
  board.dispose();
}

{
  const partial=makeAnimator({arms:false,missingRightFoot:true});
  assert.equal(partial.animator.footPlacementMode,'board-space-ankle-fallback');
  assert.doesNotThrow(()=>partial.animator.update({
    dt:1/60,speed:9,air:true,trickType:'KICKFLIP',trickProgress:.5,reducedMotion:true
  }),'missing optional/leg bones must gracefully degrade');
  partial.animator.reset();
  partial.board.dispose();
}

{
  let disposed=0;
  const visualRoot=new THREE.Group();
  const controller=createRiderController({visualRoot,disposeRider:()=>disposed++});
  const a=new THREE.Group(),b=new THREE.Group();
  a.userData.skateAnimator={reset(){a.userData.wasReset=true;},getDiagnostics(){return {averageMs:0};},stanceMode:'regular'};
  a.userData.updateRidePose=()=>{};
  b.userData.updateRidePose=()=>{};
  controller.replace(a);
  controller.resetPose();
  assert.equal(a.userData.wasReset,true,'restart must reset current rider pose');
  controller.replace(b);
  assert.equal(visualRoot.children.includes(a),false,'avatar replacement removes previous rider');
  assert.equal(visualRoot.children.includes(b),true,'avatar replacement attaches new rider');
  assert.equal(disposed,1,'avatar replacement disposes previous rider exactly once');
  controller.dispose();
  assert.equal(disposed,2,'controller disposal releases replacement rider');
}

function readGlbJson(path){
  const buffer=readFileSync(path);
  assert.equal(buffer.readUInt32LE(0),0x46546c67,path+' must be a GLB');
  const totalLength=buffer.readUInt32LE(8);
  let offset=12;
  while(offset+8<=totalLength){
    const chunkLength=buffer.readUInt32LE(offset);
    const chunkType=buffer.readUInt32LE(offset+4);
    const start=offset+8,end=start+chunkLength;
    if(chunkType===0x4e4f534a){
      return JSON.parse(buffer.subarray(start,end).toString('utf8').replace(/\u0000+$/,'').trim());
    }
    offset=end;
  }
  throw new Error('GLB JSON chunk not found: '+path);
}

function modelFromGlbJson(json){
  const nodes=json.nodes||[];
  const joints=new Set((json.skins||[]).flatMap(skin=>skin.joints||[]));
  const objects=nodes.map((node,index)=>{
    const object=joints.has(index)?new THREE.Bone():new THREE.Group();
    object.name=node.name||('node-'+index);
    if(Array.isArray(node.translation))object.position.fromArray(node.translation);
    if(Array.isArray(node.rotation))object.quaternion.fromArray(node.rotation);
    if(Array.isArray(node.scale))object.scale.fromArray(node.scale);
    return object;
  });
  const childSet=new Set();
  nodes.forEach((node,index)=>{
    for(const childIndex of node.children||[]){
      if(objects[childIndex]){
        objects[index].add(objects[childIndex]);
        childSet.add(childIndex);
      }
    }
  });
  const model=new THREE.Group();
  for(let index=0;index<objects.length;index++)if(!childSet.has(index))model.add(objects[index]);
  model.updateMatrixWorld(true);
  return model;
}

const avatarAudit=[];
for(const name of BUILTIN_AVATAR_NAMES){
  const path=join(process.cwd(),'public','model','characters',name+'.glb');
  assert.ok(existsSync(path),'missing built-in avatar file: '+name);
  const model=modelFromGlbJson(readGlbJson(path));
  const resolution=resolveAvatarRig(model,getAvatarCompatibility(name));
  avatarAudit.push({
    name,
    bones:resolution.bones.length,
    missing:resolution.missing,
    missingRequired:resolution.missingRequired,
    ambiguous:resolution.ambiguous
  });
  assert.deepEqual(resolution.missingRequired,[],name+' must retain all required gameplay leg bones');
}

const benchmark=makeAnimator({stanceMode:'regular'});
const benchmarkFrames=1800;
const started=performance.now();
for(let i=0;i<benchmarkFrames;i++){
  const p=(i%120)/119;
  benchmark.animator.update({
    dt:1/60,
    speed:12+Math.sin(i*.021)*4,
    steer:Math.sin(i*.033)*.8,
    air:(i%180)>95&&(i%180)<155,
    olliePhase:(i%180)>95?'air':'idle',
    verticalVelocity:Math.sin(p*Math.PI*2)*7,
    trickType:(i%360)>220&&(i%360)<300?'KICKFLIP':'',
    trickProgress:p,
    manualMode:(i%420)>330?'manual':'',
    manualBalance:Math.sin(i*.017)*.65,
    grinding:(i%500)>430,
    grindTrick:'50-50',
    grindBalance:Math.sin(i*.029)*.55,
    time:i/60
  });
}
const benchmarkElapsed=performance.now()-started;
const benchmarkAverageMs=benchmarkElapsed/benchmarkFrames;
const animatorDiagnostics=benchmark.animator.getDiagnostics();
assert.ok(Number.isFinite(benchmarkAverageMs)&&benchmarkAverageMs>=0);
assert.ok(benchmarkAverageMs<5,'synthetic rider animation average exceeded catastrophic 5ms/frame guard');
assert.ok(animatorDiagnostics.ikSolves>0);
benchmark.animator.reset();
benchmark.board.dispose();

console.log(JSON.stringify({
  check:'rider-animation-invariants',
  builtInAvatars:avatarAudit.length,
  avatarAudit,
  benchmark:{
    frames:benchmarkFrames,
    elapsedMs:Number(benchmarkElapsed.toFixed(3)),
    averageMs:Number(benchmarkAverageMs.toFixed(5)),
    instrumentedAverageMs:Number(animatorDiagnostics.averageMs.toFixed(5)),
    instrumentedMaxMs:Number(animatorDiagnostics.maxMs.toFixed(5)),
    ikSolves:animatorDiagnostics.ikSolves
  }
},null,2));
