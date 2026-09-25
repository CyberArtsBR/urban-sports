import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RIDE_MODE,getRideProfile} from '../src/rideMode.js';
import {SPORT_MODE,getLegacyRideModeForSport,getSportProfile} from '../src/sportMode.js';
import {TRICK_TYPE,createTrickSystem} from '../src/trickSystem.js';
import {TRICK_POINTS} from '../src/trickScoring.js';
import {
  createGrindSystem,
  getSkateboardDisplaySpeedRange,
  resetSkateboardState,
  skateboardDisplaySpeedKmh,
  stepSkateboardAir,
  stepSkateboardSteering,
  trySkateboardOllie,
  updateSkateboardJumpAssist,
  updateSkateboardManual
} from '../src/skateboardPhysics.js';

const profile=getRideProfile(RIDE_MODE.SNOWBOARD);
function state(overrides={}){
  return {
    rideMode:RIDE_MODE.SNOWBOARD,
    baseSpeed:profile.baseSpeed,
    maxSpeed:profile.maxSpeed,
    speed:profile.baseSpeed,
    targetSpeed:profile.baseSpeed,
    x:0,y:.12,vx:0,vy:0,heading:0,turnRate:0,edge:0,grip:1,carveLoad:0,
    air:false,grounded:true,jumping:false,time:0,frame:0,
    jumpBufferTime:0,coyoteTime:.075,jumpInputHeld:false,jumpHoldTime:0,jumpCutApplied:false,
    jumpSource:'',jumpProfile:'',jumpVelocity:0,landingQuality:'clean',landingPulse:0,
    landingGripLoss:0,landingReengageTime:0,oilSlipTime:0,
    score:0,combo:0,...overrides
  };
}

const sport=getSportProfile(SPORT_MODE.SKATEBOARD);
assert.equal(sport.physicsProfile,'skateboard-native');
assert.equal(sport.wheelCount,4);
assert.equal(sport.supportsGrinding,true);
assert.equal(sport.supportsManuals,true);
assert.equal(getLegacyRideModeForSport(SPORT_MODE.SKATEBOARD),RIDE_MODE.SNOWBOARD);

const low=state(),high=state({speed:profile.maxSpeed});
stepSkateboardSteering(low,.8,.05);
stepSkateboardSteering(high,.8,.05);
assert.ok(low.skate.steeringSensitivity>high.skate.steeringSensitivity,'high speed steering must be less twitchy');
assert.equal(low.skate.wheelContacts,4);

const dry=state({speed:profile.baseSpeed+(profile.maxSpeed-profile.baseSpeed)*.65});
const oily=state({speed:dry.speed,oilSlipTime:1});
stepSkateboardSteering(dry,.25,.05);
stepSkateboardSteering(oily,.25,.05);
assert.ok(oily.skate.lateralGrip<dry.skate.lateralGrip,'oil must reduce pavement grip');

const slide=state({speed:profile.maxSpeed*.88});
for(let i=0;i<18;i++)stepSkateboardSteering(slide,1,1/60);
assert.equal(slide.skate.powerslide,true,'hard high-speed carve should enter powerslide');
assert.ok(slide.skate.slip>0);

const ollie=state();
updateSkateboardJumpAssist(ollie,true,1/60,true);
assert.equal(trySkateboardOllie(ollie,.12),true);
assert.equal(ollie.jumpSource,'ollie');
assert.equal(ollie.air,true);
assert.ok(ollie.vy>0);

const nollie=state();
for(let i=0;i<7;i++)updateSkateboardManual(nollie,{verticalIntent:-1,dt:.02});
assert.equal(nollie.skate.manualMode,'noseManual');
updateSkateboardJumpAssist(nollie,true,1/60,true);
assert.equal(trySkateboardOllie(nollie,.12),true);
assert.equal(nollie.jumpSource,'nollie');

const manual=state();
for(let i=0;i<7;i++)updateSkateboardManual(manual,{verticalIntent:1,dt:.02});
assert.equal(manual.skate.manualMode,'manual');
assert.equal(manual.skate.comboContinuation,true);
updateSkateboardManual(manual,{verticalIntent:0,dt:.02});
assert.equal(manual.skate.manualMode,'');

const grind=createGrindSystem();
grind.register({id:'test-rail',start:{x:0,y:.20,z:2},end:{x:0,y:.20,z:-20}});
const grinding=state({air:true,grounded:false,y:.24,speed:profile.baseSpeed+8});
assert.equal(grind.tryEnter(grinding,{playerZ:2}),true);
assert.equal(grinding.grinding,true);
const grindStep=grind.step(grinding,.04,{steer:.2});
assert.equal(grindStep.active,true);
assert.ok(grinding.skate.grindDuration>0);
const jumpOff=grind.jumpOff(grinding);
assert.ok(jumpOff);
assert.equal(grinding.air,true);
assert.equal(grinding.jumpSource,'grind');

const failedLanding=state({air:true,grounded:false,y:.13,vy:-20,vx:12,heading:.8,speed:profile.baseSpeed+10,jumpSource:'ollie',jumpProfile:'ollie'});
const landing=stepSkateboardAir(failedLanding,.03,.12);
assert.equal(landing.landed,true);
assert.equal(landing.quality,'failed');

const powered=state({speed:profile.baseSpeed+12});
const normal=state({speed:powered.speed});
stepSkateboardSteering(powered,.2,.05,{powered:true});
stepSkateboardSteering(normal,.2,.05,{powered:false});
assert.ok(powered.skate.lateralGrip>=normal.skate.lateralGrip,'Banana Power should not reduce grip');

const speedRange=getSkateboardDisplaySpeedRange();
assert.deepEqual(speedRange,{minKmh:24,maxKmh:68});
assert.equal(skateboardDisplaySpeedKmh(profile.baseSpeed,RIDE_MODE.SNOWBOARD),24);
assert.equal(skateboardDisplaySpeedKmh(profile.maxSpeed,RIDE_MODE.SNOWBOARD),68);

for(const type of ['180','360','BACKFLIP','KICKFLIP','HEELFLIP','POP SHOVE-IT','FRONTSIDE SHOVE-IT','INDY','MELON','NOSEGRAB','VARIAL FLIP','360 FLIP']){
  assert.ok(Object.values(TRICK_TYPE).includes(type),type+' must be registered');
  assert.ok(TRICK_POINTS[type]>0,type+' must have score value');
}
const tricks=createTrickSystem();
const trickPhysics=state({air:true,grounded:false,y:10,vy:7});
assert.equal(tricks.start(TRICK_TYPE.KICKFLIP,{physicsState:trickPhysics,landingHeight:0,startTime:0}),true);
for(let i=0;i<40;i++)tricks.step(1/60);
assert.equal(tricks.consumeCompletion()?.type,TRICK_TYPE.KICKFLIP);

resetSkateboardState(manual);
assert.equal(manual.skate.manualMode,'');
assert.equal(manual.skate.grindState,'');
assert.equal(manual.skate.wheelContacts,4);

const gameplayInput=fs.readFileSync(new URL('../src/gameplayInput.js',import.meta.url),'utf8');
const touchControls=fs.readFileSync(new URL('../src/touchControls.js',import.meta.url),'utf8');
assert.match(gameplayInput,/verticalIntent/);
assert.match(gameplayInput,/trickModifier/);
assert.match(gameplayInput,/pad\.axisY/);
assert.match(gameplayInput,/readSkateboardTrickIntent/);
assert.match(touchControls,/onTrick/);

console.log('skateboard gameplay invariants: ok');
