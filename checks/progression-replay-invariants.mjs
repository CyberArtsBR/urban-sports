import assert from 'node:assert/strict';
import {
  CURRENT_REPLAY_VERSIONS,GAMEPLAY_VERSION,GHOST_MODE,MAX_RUN_HISTORY,URBAN_PROGRESS_KEY,
  createGhostPlayback,createProgressionReplayService,createReplayRecorder,decodeReplay,decodeShareCode,
  encodeShareCode,evaluateChallenge,getDailyChallenge,iterateReplayInputs,loadProgressionState,
  serializeReplay,utcDateKey,validateReplay,validateReplayCompatibility,verifyReplayDeterminism
} from '../src/progression/index.js';

class MemoryStorage{
  constructor(entries={},quota=Infinity){this.map=new Map(Object.entries(entries));this.quota=quota;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){
    const text=String(value);
    if(Buffer.byteLength(text,'utf8')>this.quota){const error=new Error('quota');error.name='QuotaExceededError';throw error;}
    this.map.set(key,text);
  }
}

const nowFactory=()=>{
  let t=Date.parse('2026-09-27T12:00:00Z');
  return ()=>new Date(t+=1000);
};

// Migration + corrupted storage recovery.
{
  const storage=new MemoryStorage({'chimpions-ski-best':'4321'});
  const loaded=loadProgressionState(storage);
  assert.equal(loaded.state.records.bestDistance.distance,4321);
  assert.equal(loaded.migrated,true);
}
{
  const storage=new MemoryStorage({[URBAN_PROGRESS_KEY]:'{broken json'});
  const loaded=loadProgressionState(storage);
  assert.equal(loaded.corrupted,true);
  assert.deepEqual(loaded.state.history,[]);
}

// Daily seed determinism and UTC date boundary.
{
  const a=getDailyChallenge(new Date('2026-09-27T23:59:59Z'));
  const b=getDailyChallenge(new Date('2026-09-27T05:00:00Z'));
  const c=getDailyChallenge(new Date('2026-09-28T00:00:00Z'));
  assert.equal(a.seed,b.seed);
  assert.notEqual(a.seed,c.seed);
  assert.equal(utcDateKey('2026-09-27T23:59:59-03:00'),'2026-09-28');
}

// Replay serialization/decoding and RLE input compression.
let replay;
{
  const recorder=createReplayRecorder({runSeed:'seed-123',sport:'skateboard',setup:'street',rider:'chimp-a',checkpointInterval:30});
  const state={distance:0,x:0,y:.12,speed:10,air:false,courseSection:'OPEN',score:0,tricksLanded:0,crashType:''};
  for(let frame=1;frame<=180;frame++){
    const input={steer:frame<60?.5:frame<120?-.5:0,verticalIntent:0,jumpPressed:frame===65,jumpHeld:frame>=65&&frame<82,specialPressed:frame===120};
    recorder.recordInput(input,1/60);
    state.speed+=.001;
    state.x+=input.steer*.01;
    state.distance+=state.speed/60;
    state.air=input.jumpHeld;
    state.score+=input.jumpPressed?100:0;
    recorder.captureCheckpoint(state);
  }
  replay=recorder.finalize(state);
  const encoded=serializeReplay(replay);
  const decoded=decodeReplay(encoded,{requireCompatibility:true});
  assert.equal(decoded.frameCount,180);
  assert.ok(decoded.segments.length<20,'RLE should collapse long stable input spans');
  assert.equal([...iterateReplayInputs(decoded)].length,180);
}

// Version mismatch is explicit, never silently accepted.
{
  const incompatible=structuredClone(replay);
  incompatible.physicsVersion='future-physics';
  const result=validateReplayCompatibility(incompatible);
  assert.equal(result.compatible,false);
  assert.throws(()=>decodeReplay(serializeReplay(incompatible),{requireCompatibility:true}),/Incompatible replay/);
}

// Impossible input, duration, seed and checkpoint sequences are rejected before playback.
{
  const impossibleAxis=structuredClone(replay);
  impossibleAxis.segments[0][1]=999;
  assert.throws(()=>validateReplay(impossibleAxis),/steer axis/);
  const impossibleDt=structuredClone(replay);
  impossibleDt.segments[0][6]=301;
  assert.throws(()=>validateReplay(impossibleDt),/delta time/);
  const invalidSeed=structuredClone(replay);
  invalidSeed.runSeed='<unsafe>';
  assert.throws(()=>validateReplay(invalidSeed),/seed/);
  const badSequence=structuredClone(replay);
  badSequence.checkpoints=[badSequence.checkpoints[1],badSequence.checkpoints[0]];
  assert.throws(()=>validateReplay(badSequence),/checkpoint sequence/);
  const excessiveDuration={...structuredClone(replay),frameCount:1_000_000,segments:[[1_000_000,0,0,0,0,0,300]],checkpoints:[],terminal:{...replay.terminal,frame:1_000_000}};
  assert.throws(()=>validateReplay(excessiveDuration),/duration exceeds/);
}

// Record -> replay -> checkpoint comparison using a deterministic authoritative-style harness.
{
  const recorder=createReplayRecorder({runSeed:'determinism-seed',sport:'skateboard',setup:'street',rider:'chimp-b',checkpointInterval:25});
  const state={distance:0,x:0,y:.12,speed:12,air:false,courseSection:'OPEN STREET',score:0,tricksLanded:0,crashType:''};
  const step=(s,input,dt,frame)=>{
    s.speed+=.03*dt;
    s.x+=input.steer*4*dt;
    s.distance+=s.speed*dt;
    s.air=input.jumpHeld;
    s.y=s.air?1.4:.12;
    s.courseSection=s.distance>25?'TRAFFIC SLALOM':'OPEN STREET';
    if(input.jumpPressed){s.score+=250;s.tricksLanded++;}
    if(frame===220)s.crashType='barrier';
  };
  for(let frame=1;frame<=240;frame++){
    const input={steer:frame<80?.35:frame<160?-.2:.1,jumpPressed:frame===90,jumpHeld:frame>=90&&frame<110,verticalIntent:frame>180?.4:0};
    recorder.recordInput(input,1/60);
    step(state,input,1/60,frame);
    recorder.captureCheckpoint(state);
  }
  const recorded=recorder.finalize(state);
  const result=verifyReplayDeterminism(recorded,{
    createSimulation:()=>({distance:0,x:0,y:.12,speed:12,air:false,courseSection:'OPEN STREET',score:0,tricksLanded:0,crashType:''}),
    stepSimulation:(simulation,input,dt)=>step(simulation,input,dt,input.frame)
  });
  assert.equal(result.deterministic,true,JSON.stringify(result.mismatches[0]||{}));
  assert.ok(result.checkpointCount>=9);
}

// Ghost playback is read-only presentation data with no collision/course effects.
{
  const ghost=createGhostPlayback(replay,{reducedVfx:true});
  assert.equal(ghost.available,true);
  assert.equal(ghost.policy.collision,false);
  assert.equal(ghost.policy.affectsCourse,false);
  assert.equal(ghost.policy.maxGhosts,1);
  const before=JSON.stringify(replay);
  const sample=ghost.sample(90);
  assert.equal(sample.collision,false);
  assert.equal(JSON.stringify(replay),before);
}

// Share codes carry only validated metadata and reject unsafe/tampered fields.
{
  const code=encodeShareCode({seed:'uc-abc-123',sport:'skateboard',setup:'street',challengeVersion:'daily-v1',gameplayVersion:GAMEPLAY_VERSION});
  const decoded=decodeShareCode(code);
  assert.equal(decoded.seed,'uc-abc-123');
  assert.throws(()=>encodeShareCode({seed:'<script>alert(1)</script>',sport:'skateboard',setup:'street',challengeVersion:'daily-v1',gameplayVersion:GAMEPLAY_VERSION}));
  assert.throws(()=>decodeShareCode('USC1.not-valid-base64'));
}

// Bounded history, independent records, challenge evaluation and quota failure.
{
  const storage=new MemoryStorage();
  const service=createProgressionReplayService({storage,now:nowFactory()});
  for(let i=0;i<MAX_RUN_HISTORY+7;i++){
    service.startRun({runSeed:`seed-${i}`,sport:'skateboard',setup:i%2?'street':'park',rider:`rider-${i%3}`});
    const state={distance:100+i*10,score:i*100,bananas:i%12,time:20+i,maxRunSpeed:40+i,bestCombo:i%9,bestTrick:{type:'360',points:200+i},tricksLanded:i%7,tricksFailed:1,cleanLandings:i%5,nearMisses:i%6,bananaPowerUses:i%3,lastMistakeTime:-Infinity,crashType:'tree',air:false,x:0,y:.12,speed:20,courseSection:'OPEN'};
    service.captureInput({steer:0},1/60);
    service.captureCheckpoint(state);
    service.finishRun(state,{maxSpeed:50+i,crashCause:'tree'});
  }
  assert.equal(service.getRunHistory().length,MAX_RUN_HISTORY);
  const records=service.getRecords();
  assert.ok(records.bestDistance.distance>records.mostBananas.distance||records.mostBananas.bananas>=0);
  assert.ok(records.byRider['rider-0']);
  assert.ok(records.bySport.skateboard);
  assert.ok(records.bySetup.street);
  const challenge=getDailyChallenge(new Date('2026-09-27T12:00:00Z'));
  const result=evaluateChallenge(challenge,{sport:'skateboard',setup:'street',distance:99999,score:99999,bananas:999,tricksLanded:999,cleanLandings:999,nearMisses:999,bananaPowerUses:0});
  assert.equal(result.allowed,true);
  assert.equal(result.medal,'GOLD');
}
{
  const storage=new MemoryStorage({},200);
  const service=createProgressionReplayService({storage,now:nowFactory()});
  service.startRun({runSeed:'quota-seed',sport:'skateboard',setup:'street',rider:'chimp'});
  const state={distance:1234,score:999,bananas:3,time:60,maxRunSpeed:50,bestCombo:4,bestTrick:{type:'360',points:200},tricksLanded:2,tricksFailed:0,cleanLandings:2,nearMisses:1,bananaPowerUses:0,lastMistakeTime:-Infinity,crashType:'tree',air:false,x:0,y:.12,speed:20,courseSection:'OPEN'};
  service.captureInput({steer:0},1/60);
  const result=service.finishRun(state,{crashCause:'tree'});
  assert.equal(result.saved,false);
  assert.equal(result.persistence.reason,'quota');
}

console.log('progression/replay invariants: OK');
console.log(JSON.stringify({replayVersions:CURRENT_REPLAY_VERSIONS,historyLimit:MAX_RUN_HISTORY,ghostModes:Object.values(GHOST_MODE)},null,2));
