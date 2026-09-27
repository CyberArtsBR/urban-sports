import assert from 'node:assert/strict';
import {RIDE_MODE,getRideProfile} from '../src/rideMode.js';
import {
  SKATEBOARD_SETUP,
  getSkateboardSetupProfile
} from '../src/skateboardSetup.js';
import {progressWorldSpeed} from '../src/worldProgression.js';
import {
  SKATEBOARD_LANDING,
  SKATEBOARD_TUNING,
  consumeSkateboardEvents,
  createGrindSystem,
  getSkateboardVelocityModel,
  launchSkateboardRamp,
  recordSkateboardLandingStatistic,
  resetSkateboardState,
  skateboardGameplaySpeed,
  stepSkateboardAir,
  stepSkateboardSteering,
  trySkateboardOllie,
  updateSkateboardJumpAssist,
  updateSkateboardManual
} from '../src/skateboardPhysics.js';
import {createRunSession,createRunState} from '../src/runSession.js';

const profile=getRideProfile(RIDE_MODE.SNOWBOARD);
const EPS=1e-6;

function makeState(overrides={}){
  const s={
    rideMode:RIDE_MODE.SNOWBOARD,
    skateSetup:SKATEBOARD_SETUP.STREET,
    baseSpeed:profile.baseSpeed,
    maxSpeed:profile.maxSpeed,
    speed:profile.baseSpeed,
    targetSpeed:profile.baseSpeed,
    speedTier:0,
    speedTierTime:0,
    difficulty:0,
    x:0,y:.12,vx:0,vy:0,heading:0,turnRate:0,edge:0,grip:1,carveLoad:0,
    air:false,grounded:true,jumping:false,grinding:false,time:0,frame:0,
    jumpBufferTime:0,coyoteTime:.09,jumpInputHeld:false,jumpHoldTime:0,jumpCutApplied:false,
    jumpSource:'',jumpProfile:'',jumpVelocity:0,landingQuality:'clean',landingPulse:0,
    landingGripLoss:0,landingReengageTime:0,oilSlipTime:0,
    cleanLandings:0,lastMistakeTime:-Infinity,maxSkateGameplaySpeed:0,
    edgeContactCooldown:0,edgeContact:false,edgeContactSide:0,
    score:0,combo:0,
    ...overrides
  };
  resetSkateboardState(s);
  return s;
}

function stepFor(state,seconds,input=0,options={},hz=180){
  const frames=Math.max(1,Math.round(seconds*hz));
  const frameDt=seconds/frames;
  for(let frame=0;frame<frames;frame++){
    const steps=Math.max(1,Math.ceil(frameDt/SKATEBOARD_TUNING.PHYSICS_SUBSTEP_SECONDS));
    const dt=frameDt/steps;
    for(let step=0;step<steps;step++){
      state.time+=dt;
      stepSkateboardSteering(state,input,dt,options);
    }
  }
  return state;
}

// Low-speed steering remains more eager while high-speed steering stays readable.
{
  const low=makeState({speed:profile.baseSpeed});
  const high=makeState({speed:profile.maxSpeed});
  stepSkateboardSteering(low,.8,1/60);
  stepSkateboardSteering(high,.8,1/60);
  assert(low.skate.steeringSensitivity>high.skate.steeringSensitivity,'low-speed steering should have more authority');
  stepFor(low,.45,.7);
  stepFor(high,.45,.7);
  assert(Math.abs(high.vx)<=SKATEBOARD_TUNING.MAX_LATERAL_HIGH*1.35,'high-speed lateral response became twitchy');
  assert(Math.abs(high.heading)<=SKATEBOARD_TUNING.HEADING_LOW+EPS,'high-speed heading escaped readable limits');
}

// Reversing direction crosses neutral progressively rather than snapping.
{
  const s=makeState({speed:profile.baseSpeed+6});
  stepFor(s,.35,1);
  assert(s.edge>.45,'test did not establish a positive truck angle');
  const before=s.edge;
  stepSkateboardSteering(s,-1,SKATEBOARD_TUNING.PHYSICS_SUBSTEP_SECONDS);
  assert(s.edge<before&&s.edge>-.2,'left/right reversal snapped across neutral in one substep');
  stepFor(s,.40,-1);
  assert(s.edge<-.35,'opposite input failed to complete a deliberate reversal');
}

// Powerslide has separate entry, maintenance and recovery phases.
{
  const s=makeState({speed:profile.maxSpeed*.92});
  stepFor(s,.42,1);
  assert.equal(s.skate.powerslide,true,'high-load carve did not enter powerslide');
  const slideSlip=s.skate.slip;
  stepFor(s,.70,0);
  assert.equal(s.skate.powerslide,false,'powerslide did not exit after steering release');
  assert(s.skate.slip<slideSlip,'powerslide recovery did not restore lateral grip');
  const types=consumeSkateboardEvents(s).map(event=>event.type);
  assert(types.includes('powerslideStart'),'powerslideStart event missing');
  assert(types.includes('powerslideEnd'),'powerslideEnd event missing');
}

// Wet asphalt and oil lower grip but never remove steering agency.
{
  const dry=makeState({speed:profile.baseSpeed+18});
  const wet=makeState({speed:dry.speed});
  const oil=makeState({speed:dry.speed,oilSlipTime:SKATEBOARD_TUNING.OIL_SLIP_SECONDS});
  stepFor(dry,.22,.45,{wetness:0});
  stepFor(wet,.22,.45,{wetness:1});
  stepFor(oil,.22,.45,{wetness:0});
  assert(wet.skate.lateralGrip<dry.skate.lateralGrip,'wet asphalt did not reduce grip');
  assert(oil.skate.lateralGrip<wet.skate.lateralGrip,'oil should be more slippery than wet asphalt');
  assert(Math.abs(oil.edge)>.08,'oil removed meaningful steering authority');
  assert(Number.isFinite(oil.heading)&&Number.isFinite(oil.vx),'oil recovery produced invalid momentum');
}

// Skateboard speed scrub is local to gameplay velocity; the world/procedural scale is untouched.
{
  const s=makeState({speed:profile.maxSpeed*.90});
  const worldBefore=s.speed;
  stepFor(s,.45,1);
  assert.equal(s.speed,worldBefore,'powerslide/carve mutated world progression velocity');
  assert(skateboardGameplaySpeed(s)<getSkateboardVelocityModel(s).gameplayTargetSpeed+.5,'gameplay velocity did not expose local scrub');
  const world=makeState({time:90,speed:profile.baseSpeed});
  progressWorldSpeed(world,1/60);
  assert(world.speed>profile.baseSpeed,'world progression did not advance independently');
}

// Ollie emits native takeoff events and short taps produce a lower arc than held input.
function simulateOllie(holdSeconds,{setup=SKATEBOARD_SETUP.STREET,nollie=false}={}){
  const s=makeState({skateSetup:setup});
  const dt=1/180;
  updateSkateboardJumpAssist(s,true,dt,true);
  assert.equal(trySkateboardOllie(s,.12,{nollie}),true,'ollie/nollie did not launch');
  let elapsed=0,apex=s.y,landing=null;
  for(let i=0;i<1200&&s.air;i++){
    const held=elapsed<holdSeconds;
    updateSkateboardJumpAssist(s,false,dt,held);
    landing=stepSkateboardAir(s,dt,.12,{trickComplete:true});
    elapsed+=dt;
    apex=Math.max(apex,s.y);
  }
  assert(!s.air,'jump never landed');
  return {state:s,apex,landing,events:consumeSkateboardEvents(s)};
}
{
  const short=simulateOllie(.035);
  const held=simulateOllie(.24);
  assert(short.apex<held.apex-.18,'short-tap ollie is not meaningfully lower than held ollie');
  assert.equal(short.state.lastJumpProfile,'mini','short tap did not use mini jump profile');
  assert.equal(held.state.lastJumpProfile,'full','held ollie did not preserve full jump profile');
  assert(held.events.some(event=>event.type==='takeoff'),'takeoff event missing');
  assert(held.events.some(event=>event.type==='landing'),'landing event missing');
}

// Jump buffer and coyote timing remain deterministic.
{
  const buffered=makeState();
  updateSkateboardJumpAssist(buffered,true,1/180,true);
  assert(buffered.jumpBufferTime>0,'jump press did not create a buffer window');
  const coyote=makeState({air:true,grounded:false,coyoteTime:.05,jumpBufferTime:.08,y:.5,vy:-1});
  assert.equal(trySkateboardOllie(coyote,.12),true,'coyote-time ollie was rejected');
}

// Manual and nose manual are separate, and Street favors technical balance.
function enterManual(setup,verticalIntent){
  const s=makeState({skateSetup:setup});
  for(let i=0;i<14;i++)updateSkateboardManual(s,{verticalIntent,dt:.01});
  return s;
}
{
  const manual=enterManual(SKATEBOARD_SETUP.STREET,1);
  const nose=enterManual(SKATEBOARD_SETUP.STREET,-1);
  assert.equal(manual.skate.manualMode,'manual','manual entry failed');
  assert.equal(nose.skate.manualMode,'noseManual','nose manual entry failed');

  const street=enterManual(SKATEBOARD_SETUP.STREET,1);
  const park=enterManual(SKATEBOARD_SETUP.PARK,1);
  street.edge=.82;park.edge=.82;
  for(let i=0;i<60;i++){
    updateSkateboardManual(street,{verticalIntent:1,dt:1/120});
    updateSkateboardManual(park,{verticalIntent:1,dt:1/120});
  }
  assert(Math.abs(street.skate.manualBalance)<Math.abs(park.skate.manualBalance),'Street manual stability advantage is not expressed in physics');
}

// Nollie derives naturally from a nose manual.
{
  const s=enterManual(SKATEBOARD_SETUP.STREET,-1);
  updateSkateboardJumpAssist(s,true,1/180,true);
  assert.equal(trySkateboardOllie(s,.12),true,'nose-manual nollie failed');
  assert.equal(s.jumpSource,'nollie','nose manual did not resolve to nollie');
}

// Park trades technical forgiveness for pop, carve and air authority.
{
  const street=getSkateboardSetupProfile(SKATEBOARD_SETUP.STREET);
  const park=getSkateboardSetupProfile(SKATEBOARD_SETUP.PARK);
  assert(street.truckResponse>park.truckResponse&&street.manualStability>park.manualStability&&street.grindCapture>park.grindCapture,'Street technical advantages are missing');
  assert(park.olliePop>street.olliePop&&park.carveAuthority>street.carveAuthority&&park.airControl>street.airControl,'Park pop/carve/air advantages are missing');

  const streetJump=makeState({skateSetup:SKATEBOARD_SETUP.STREET});
  const parkJump=makeState({skateSetup:SKATEBOARD_SETUP.PARK});
  updateSkateboardJumpAssist(streetJump,true,1/180,true);
  updateSkateboardJumpAssist(parkJump,true,1/180,true);
  trySkateboardOllie(streetJump,.12);
  trySkateboardOllie(parkJump,.12);
  assert(parkJump.vy>streetJump.vy,'Park setup did not produce stronger ollie pop');

  const streetTurn=makeState({skateSetup:SKATEBOARD_SETUP.STREET,speed:profile.baseSpeed+5});
  const parkTurn=makeState({skateSetup:SKATEBOARD_SETUP.PARK,speed:profile.baseSpeed+5});
  stepFor(streetTurn,.25,.55);
  stepFor(parkTurn,.25,.55);
  assert(Math.abs(streetTurn.edge)>Math.abs(parkTurn.edge),'Street trucks are not measurably faster');
}

// Park ramp behavior carries stronger transition pop without changing world speed.
{
  const street=makeState({skateSetup:SKATEBOARD_SETUP.STREET,speed:profile.baseSpeed+14});
  const park=makeState({skateSetup:SKATEBOARD_SETUP.PARK,speed:street.speed});
  assert(launchSkateboardRamp(street,.12));
  assert(launchSkateboardRamp(park,.12));
  assert(park.vy>street.vy,'Park transition/ramp pop advantage is missing');
  assert.equal(park.speed,street.speed,'ramp setup changed world progression velocity');
}

// Grind capture, balance, exit and jump-off stay deterministic.
function makeGrindState(setup=SKATEBOARD_SETUP.STREET,overrides={}){
  return makeState({skateSetup:setup,air:true,grounded:false,y:.24,speed:profile.baseSpeed+12,...overrides});
}
{
  const grind=createGrindSystem();
  grind.register({id:'long-rail',start:{x:0,y:.20,z:2},end:{x:0,y:.20,z:-260}});
  const s=makeGrindState();
  assert.equal(grind.tryEnter(s,{playerZ:2,preferredTrick:'50-50'}),true,'grind entry failed');
  assert.equal(s.grinding,true);
  for(let i=0;i<30;i++){
    const result=grind.step(s,1/180,{steer:.25});
    assert.equal(result.active,true,'stable grind exited unexpectedly');
  }
  assert(Math.abs(s.skate.grindBalance)<SKATEBOARD_TUNING.GRIND_FAIL,'grind balance exceeded deterministic fail threshold');
  const exit=grind.exit(s,'test-exit');
  assert.equal(exit.reason,'test-exit');
  assert.equal(s.grinding,false);
  assert.equal(s.air,true,'grind exit did not restore airborne state');
  const types=consumeSkateboardEvents(s).map(event=>event.type);
  assert(types.includes('grindStart')&&types.includes('grindEnd'),'grind entry/exit events missing');
}
{
  const grind=createGrindSystem();
  grind.register({id:'jump-rail',start:{x:0,y:.20,z:2},end:{x:0,y:.20,z:-120}});
  const s=makeGrindState();
  assert(grind.tryEnter(s,{playerZ:2}));
  s.jumpBufferTime=.1;s.jumpBuffered=true;s.coyoteTime=.08;
  const result=grind.jumpOff(s,{popVelocity:7});
  assert(result,'jump from grind failed');
  assert.equal(s.jumpSource,'grind');
  assert.equal(s.jumpBufferTime,0);
  assert.equal(s.jumpBuffered,false);
  assert.equal(s.coyoteTime,0);
}

// High-speed grind capture receives bounded extra radius to avoid tunneling.
{
  const grind=createGrindSystem();
  grind.register({id:'fast-rail',captureRadius:.72,start:{x:.78,y:.20,z:2},end:{x:.78,y:.20,z:-80}});
  const s=makeGrindState(SKATEBOARD_SETUP.STREET,{speed:profile.maxSpeed,x:0,y:.22});
  assert.equal(grind.tryEnter(s,{playerZ:2}),true,'maximum-speed grind capture tunneled past a valid rail');
}

// Landing quality uses impact, alignment, lateral velocity and trick completion with no randomness.
function landingCase({vy,heading=0,vx=0,trickComplete=true,wetness=0}){
  const s=makeState({air:true,grounded:false,y:.121,vy,heading,vx,jumpSource:'ollie',jumpProfile:'full'});
  const landing=stepSkateboardAir(s,.012,.12,{trickComplete,wetness});
  assert.equal(landing.landed,true,'landing fixture did not touch ground');
  return {s,landing,events:consumeSkateboardEvents(s)};
}
{
  const clean=landingCase({vy:-5.2,heading:.05,vx:1.2});
  const sketchy=landingCase({vy:-9.2,heading:.31,vx:2.5});
  const hard=landingCase({vy:-13.0,heading:.52,vx:3.0});
  const failed=landingCase({vy:-17.2,heading:.08,vx:1.0});
  const trickFailed=landingCase({vy:-5.2,trickComplete:false});
  assert.equal(clean.landing.quality,SKATEBOARD_LANDING.CLEAN);
  assert.equal(sketchy.landing.quality,SKATEBOARD_LANDING.SKETCHY);
  assert.equal(hard.landing.quality,SKATEBOARD_LANDING.HARD);
  assert.equal(failed.landing.quality,SKATEBOARD_LANDING.FAILED);
  assert.equal(trickFailed.landing.quality,SKATEBOARD_LANDING.FAILED);
  assert(failed.events.some(event=>event.type==='failedLanding'),'failed landing event missing');
}

// A physical clean landing increments the statistic exactly once.
{
  const {s,landing}=landingCase({vy:-5.0,heading:.02,vx:.5});
  assert.equal(recordSkateboardLandingStatistic(s,landing),true);
  assert.equal(recordSkateboardLandingStatistic(s,landing),false,'same landing was counted twice');
  assert.equal(s.cleanLandings,1,'one physical landing must equal one clean landing statistic');
}

// Equivalent input sequences remain close across supported render frame rates because
// every frame is resolved through the same <=1/180 physics substep contract.
function frameRateRun(hz){
  const s=makeState({speed:profile.maxSpeed*.78});
  const seconds=1.4,frames=Math.round(seconds*hz),frameDt=seconds/frames;
  for(let frame=0;frame<frames;frame++){
    const input=frame<frames*.45?.72:frame<frames*.72?-.58:.18;
    const steps=Math.max(1,Math.ceil(frameDt/SKATEBOARD_TUNING.PHYSICS_SUBSTEP_SECONDS));
    const dt=frameDt/steps;
    for(let step=0;step<steps;step++){
      s.time+=dt;
      stepSkateboardSteering(s,input,dt,{wetness:.2});
    }
  }
  return {x:s.x,vx:s.vx,heading:s.heading,edge:s.edge,gameplay:skateboardGameplaySpeed(s)};
}
{
  const rates=[30,60,90,120,144];
  const baseline=frameRateRun(60);
  for(const hz of rates){
    const result=frameRateRun(hz);
    assert(Math.abs(result.x-baseline.x)<.16,`${hz} Hz lateral result drifted from 60 Hz`);
    assert(Math.abs(result.vx-baseline.vx)<.18,`${hz} Hz lateral velocity drifted from 60 Hz`);
    assert(Math.abs(result.heading-baseline.heading)<.018,`${hz} Hz heading drifted from 60 Hz`);
    assert(Math.abs(result.gameplay-baseline.gameplay)<.06,`${hz} Hz gameplay speed drifted from 60 Hz`);
  }
}

// Run reset clears gameplay statistics and native balance state.
{
  const state=createRunState({mode:'playing',rideMode:RIDE_MODE.SNOWBOARD,rideProfile:profile,best:10});
  state.skateSetup=SKATEBOARD_SETUP.STREET;
  resetSkateboardState(state);
  state.cleanLandings=7;
  state.maxSkateGameplaySpeed=18;
  state.skate.manualMode='manual';
  state.skate.speedScrub=.2;
  const session=createRunSession({state});
  session.reset({rideProfile:profile});
  resetSkateboardState(state);
  assert.equal(state.cleanLandings,0);
  assert.equal(state.maxSkateGameplaySpeed,0);
  assert.equal(state.skate.manualMode,'');
  assert.equal(state.skate.speedScrub,0);
  assert.equal(state.speed,profile.baseSpeed);
}

// Final high-speed sanity: steering remains finite and inside collision bounds.
{
  const s=makeState({speed:profile.maxSpeed});
  stepFor(s,1.2,.64,{wetness:.15},144);
  assert(Number.isFinite(s.x)&&Number.isFinite(s.vx)&&Number.isFinite(s.heading),'maximum-speed handling produced non-finite state');
  assert(Math.abs(s.x)<=SKATEBOARD_TUNING.PLAYER_BOUNDARY_HALF_WIDTH+EPS,'maximum-speed steering escaped course boundary');
  assert(Math.abs(s.vx)<SKATEBOARD_TUNING.MAX_LATERAL_HIGH*1.4,'maximum-speed lateral velocity became unreasonably twitchy');
}

console.log(JSON.stringify({
  check:'skateboard-physics-v2-invariants',
  setups:[SKATEBOARD_SETUP.STREET,SKATEBOARD_SETUP.PARK],
  frameRates:[30,60,90,120,144],
  worldProgression:'separate',
  landingAccounting:'idempotent'
}));
