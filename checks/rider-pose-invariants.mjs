import fs from 'node:fs';
import {SKATE_ANIMATION_STATE,createSkateAnimationStateMachine} from '../src/rider/SkateAnimationState.js';

const source=fs.readFileSync(new URL('../src/skier.js',import.meta.url),'utf8');
const animatorSource=fs.readFileSync(new URL('../src/rider/SkateboardAnimator.js',import.meta.url),'utf8');
const controllerSource=fs.readFileSync(new URL('../src/riderController.js',import.meta.url),'utf8');
const assert=(ok,message)=>{if(!ok){console.error('FAIL',message);process.exitCode=1;}else console.log('PASS',message);};

assert(source.includes('const armOutwardSigns=new Map()'),'arm outward sign map is derived from rest pose');
assert(source.includes('model.worldToLocal(modelLocalProbe)'),'rest-pose arm side is measured in model-local space');
assert(source.includes('authoredOutSign=armOutwardSigns.get(side)??sideSign'),'pose targets use authored outward sign');
assert(source.includes("aimLimbFromRest(side+'UpperArm'"),'upper arms are aimed from GLB rest pose');
assert(source.includes("aimLimbFromRest(side+'Forearm'"),'forearms are aimed from GLB rest pose');
assert(source.includes("applyArmRestDelta(side+'Hand',0,0,0"),'hands keep the authored neutral wrist orientation');
assert(source.includes('resetArmChainToRest()'),'ride-mode changes can restore the complete arm chain');


assert(source.includes("import {createSkateboardAnimator} from './rider/SkateboardAnimator.js'"),'skier imports dedicated skateboard animator');
assert(source.includes('root.userData.updateRidePose=root.userData.updateSkiPose'),'legacy pose hook remains a backwards-compatible alias');
assert(source.includes("root.userData.animationState=snowboardMode?(skateAnimator?.state||'IDLE'):'SKI'"),'runtime exposes the current skateboard visual state');
assert(controllerSource.includes('updateRidePose||rider?.userData?.updateSkiPose'),'rider controller prefers the sport-neutral pose hook');
assert(animatorSource.includes("boardPoseRoot.name='skateboard-animation-root'"),'board trick animation is isolated under a visual-only equipment transform');
assert(animatorSource.includes("footPlacementMode:'proportional-rest-pose-lock'"),'arbitrary GLBs use proportional rest-pose foot locking instead of unsafe iterative IK');
assert(!animatorSource.includes('player.position'),'skateboard animator never writes the authoritative player transform');
assert(!animatorSource.includes('collision'),'skateboard animator does not own collision state');

const machine=createSkateAnimationStateMachine();
let frame=machine.sample({dt:1/60,speed:0,steer:0,air:false});
assert(frame.state===SKATE_ANIMATION_STATE.IDLE,'state machine begins in idle');
frame=machine.sample({dt:1/60,speed:4,steer:0,air:false});
assert(frame.state===SKATE_ANIMATION_STATE.PUSH,'grounded acceleration derives a visual push cadence');
machine.reset();
frame=machine.sample({dt:1/60,speed:8,air:true,trickType:'kickflip',trickProgress:.5});
assert(frame.state===SKATE_ANIMATION_STATE.KICKFLIP&&frame.trickProgress===.5,'authoritative trick metadata drives kickflip animation');
machine.reset();
frame=machine.sample({dt:1/60,speed:6,air:false,manualType:'nose manual'});
assert(frame.state===SKATE_ANIMATION_STATE.NOSE_MANUAL,'authoritative nose-manual metadata drives the manual pose');
machine.reset();
frame=machine.sample({dt:1/60,speed:7,air:false,grindType:'boardslide'});
assert(frame.state===SKATE_ANIMATION_STATE.SLIDE,'slide-type grind metadata selects the slide pose');
machine.reset();
frame=machine.sample({dt:1/60,speed:9,air:false,powerslideActive:true,steer:-.8});
assert(frame.state===SKATE_ANIMATION_STATE.POWERSLIDE_LEFT,'authoritative powerslide metadata selects directional powerslide pose');
machine.reset();
frame=machine.sample({dt:1/60,speed:9,air:false,landing:.9,landingQuality:'hard'});
assert(frame.state===SKATE_ANIMATION_STATE.HARD_LAND,'hard landing metadata selects deep impact absorption');
machine.reset();
frame=machine.sample({dt:1/60,speed:5,air:false,crashed:true});
assert(frame.state===SKATE_ANIMATION_STATE.CRASH,'authoritative crash state hands animation to controlled crash pose');
frame=machine.sample({dt:1/60,speed:2,air:false,crashed:false});
assert(frame.state===SKATE_ANIMATION_STATE.RECOVERY,'clearing an authoritative crash enters controlled visual recovery');
