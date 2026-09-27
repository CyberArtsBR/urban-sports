import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getRideProfile,RIDE_MODE} from '../src/rideMode.js';
import {GAME_FLOW,createRunController} from '../src/runController.js';
import {SPORT_ID,getSportDefinition,listSportDefinitions} from '../src/sportDefinition.js';
import {createSportController} from '../src/sportController.js';
import {getRunStateOwner,RUN_STATE_OWNERSHIP} from '../src/stateOwnership.js';

const requiredFields=[
  'id','physics','equipment','animator','inputMap','scoring','cameraTuning',
  'audioProfile','courseProfile','uiCopy','displaySpeed','setupProfiles','diagnostics'
];

const definitions=listSportDefinitions();
assert.equal(definitions.length,3,'three Urban sport definitions must exist');
for(const definition of definitions){
  for(const field of requiredFields)assert(field in definition,definition.id+' missing SportDefinition.'+field);
}
const skateboard=getSportDefinition(SPORT_ID.SKATEBOARD);
assert.equal(skateboard.physics,'skateboard-native');
assert.equal(skateboard.setupProfiles.legacyRideMode,RIDE_MODE.SNOWBOARD);
assert.equal(skateboard.diagnostics.status,'active');
assert.equal(getSportDefinition(SPORT_ID.INLINE).diagnostics.status,'planned');
assert.equal(getSportDefinition(SPORT_ID.BMX).diagnostics.status,'planned');

const sports=createSportController({initialSport:SPORT_ID.SKATEBOARD});
assert.equal(sports.sportId,SPORT_ID.SKATEBOARD);
assert.equal(sports.legacyRideMode,RIDE_MODE.SNOWBOARD);
assert.equal(sports.snapshot().courseProfile,'urban-street-v1');

const rideProfile=getRideProfile(RIDE_MODE.SNOWBOARD);
const run=createRunController({rideMode:RIDE_MODE.SNOWBOARD,rideProfile});
assert.equal(run.state.mode,'menu');
assert.equal(run.gameFlow.phase,GAME_FLOW.START);
assert(run.gameFlow.enter(GAME_FLOW.COUNTDOWN,{reason:'architecture-test'}));
assert.equal(run.state.mode,'countdown');
run.reset({rideProfile});
assert.equal(run.state.distance,0);
assert.equal(run.state.speed,rideProfile.baseSpeed);

assert.equal(getRunStateOwner('distance'),'CourseDirector');
assert.equal(getRunStateOwner('bananaPowerProgress'),'BananaPowerSystem');
assert.equal(getRunStateOwner('crashType'),'RunController');
assert(RUN_STATE_OWNERSHIP.movement.fields.includes('speed'));

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
for(const forbidden of [
  "from './audio.js'",
  "from './environment.js'",
  "from './skiCamera.js'",
  "from './sportMode.js'",
  "from './runSession.js'",
  "from './gameFlow.js'"
]){
  assert(!main.includes(forbidden),'main.js still owns legacy dependency '+forbidden);
}
for(const required of [
  "createAudioSystem",
  "createEnvironmentSystem",
  "createCameraSystem",
  "createSportController",
  "createRunController"
]){
  assert(main.includes(required),'main.js is not wired through '+required);
}

console.log(JSON.stringify({
  check:'architecture-compatibility-invariants',
  systems:['RunController','SportController','EnvironmentSystem','CameraSystem','AudioSystem'],
  sportDefinitions:definitions.map(definition=>definition.id),
  legacyBackendsRetained:true
}));
