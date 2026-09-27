import {getDailyChallenge,evaluateChallenge} from './challenges.js';
import {createGhostPlayback,GHOST_MODE,normalizeGhostMode,pickGhostReplay} from './ghost.js';
import {
  createReplayRecorder,decodeReplay,decodeShareCode,encodeShareCode,estimateReplayBytes,serializeReplay,validateReplayCompatibility
} from './replay.js';
import {
  LEGACY_BEST_KEY,MAX_REPLAY_BYTES,MAX_RUN_HISTORY,loadProgressionState,persistProgressionState,replayAvailability,sanitizeRunRecord,updatePersonalRecords
} from './storage.js';
import {CHALLENGE_VERSION,CURRENT_REPLAY_VERSIONS,GAMEPLAY_VERSION} from './versions.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clone=value=>value==null?value:structuredClone(value);

function makeRunId(seed,time){
  let hash=2166136261;
  const value=`${seed}|${time}`;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
  return `run-${hash.toString(36)}-${Math.floor(time).toString(36)}`;
}

export function createProgressionReplayService({
  storage=globalThis.localStorage,
  now=()=>new Date(),
  legacyBestKey=LEGACY_BEST_KEY,
  reducedVfx=false
}={}){
  const loaded=loadProgressionState(storage,{legacyBestKey});
  const data=loaded.state;
  let activeChallenge=null;
  let activeRun=null;
  let lastPersistResult={ok:true,bytes:0};

  if(loaded.migrated||loaded.corrupted)lastPersistResult=persistProgressionState(storage,data,{legacyBestKey});

  function persist(){
    lastPersistResult=persistProgressionState(storage,data,{legacyBestKey});
    return lastPersistResult;
  }

  function getBestDistance(){return finite(data.records?.bestDistance?.distance);}
  function getRecords(){return clone(data.records);}
  function getRunHistory(){return clone(data.history);}
  function getCurrentChallenge(date=now()){return getDailyChallenge(date);}

  function activateChallenge(challenge=getCurrentChallenge()){
    if(!challenge?.seed)throw new Error('Challenge requires a deterministic seed');
    activeChallenge=clone(challenge);
    return clone(activeChallenge);
  }
  function clearChallenge(){activeChallenge=null;}
  function getActiveChallenge(){return clone(activeChallenge);}

  function startRun({runSeed,sport='skateboard',setup='default',rider='unknown'}={}){
    if(!runSeed)throw new Error('Progression run requires a seed');
    const startedAt=now();
    const recorder=createReplayRecorder({runSeed,sport,setup,rider,...CURRENT_REPLAY_VERSIONS});
    activeRun={
      runSeed:String(runSeed),sport:String(sport),setup:String(setup),rider:String(rider),
      startedAt,recorder,lastMistake:-Infinity,cleanSegmentStart:0,maxCleanRun:0
    };
    return {runSeed:activeRun.runSeed,sport:activeRun.sport,setup:activeRun.setup,rider:activeRun.rider};
  }

  function captureInput(input,dt){return activeRun?.recorder.recordInput(input,dt)??false;}
  function captureCheckpoint(state){
    if(!activeRun)return false;
    const mistake=finite(state?.lastMistakeTime,-Infinity);
    if(Number.isFinite(mistake)&&mistake>activeRun.lastMistake){
      activeRun.maxCleanRun=Math.max(activeRun.maxCleanRun,mistake-activeRun.cleanSegmentStart);
      activeRun.cleanSegmentStart=Math.max(activeRun.cleanSegmentStart,mistake);
      activeRun.lastMistake=mistake;
    }
    return activeRun.recorder.captureCheckpoint(state);
  }

  function finishRun(state={},meta={}){
    if(!activeRun)return {saved:false,reason:'no-active-run'};
    captureCheckpoint(state);
    const endedAt=now();
    activeRun.maxCleanRun=Math.max(activeRun.maxCleanRun,finite(state.time)-activeRun.cleanSegmentStart);
    const replay=activeRun.recorder.finalize(state);
    const record=sanitizeRunRecord({
      id:makeRunId(activeRun.runSeed,endedAt.getTime()),
      timestamp:endedAt.toISOString(),
      ...CURRENT_REPLAY_VERSIONS,
      runSeed:activeRun.runSeed,
      sport:activeRun.sport,
      setup:activeRun.setup,
      rider:activeRun.rider,
      distance:Math.floor(finite(state.distance)),
      score:finite(state.score),
      bananas:finite(state.bananas),
      duration:finite(state.time),
      maxSpeed:finite(meta.maxSpeed??state.maxRunSpeed??state.speed),
      bestCombo:finite(state.bestCombo),
      bestTrick:state.bestTrick||{type:state.largestTrickType||'',points:finite(state.largestTrickScore)},
      tricksLanded:finite(state.tricksLanded??state.successfulTricks),
      tricksFailed:finite(state.tricksFailed??state.failedTricksCount),
      cleanLandings:finite(state.cleanLandings),
      nearMisses:finite(state.nearMisses),
      bananaPowerUses:finite(state.bananaPowerUses),
      cleanRunDuration:activeRun.maxCleanRun,
      crashCause:meta.crashCause||state.crashType||'unknown'
    });

    const previousBestDistance=finite(data.records?.bestDistance?.distance);
    const previousBestScore=finite(data.records?.bestScore?.score);
    data.history.unshift(record);
    data.history=data.history.slice(0,MAX_RUN_HISTORY);
    const recordUpdate=updatePersonalRecords(data.records,record);
    data.records=recordUpdate.records;

    let replaySaved=false;
    const replayBytes=estimateReplayBytes(replay);
    if(replayBytes<=MAX_REPLAY_BYTES){
      data.replays.lastRun=replay;
      if(record.distance>=previousBestDistance)data.replays.bestDistance=replay;
      if(record.score>=previousBestScore)data.replays.bestScore=replay;
      replaySaved=true;
    }

    let challengeResult=null;
    if(activeChallenge&&String(activeChallenge.seed)===record.runSeed){
      challengeResult=evaluateChallenge(activeChallenge,record);
      const previous=data.challengeProgress[activeChallenge.id];
      if(!previous||challengeResult.value>finite(previous.value)){
        data.challengeProgress[activeChallenge.id]={...challengeResult,timestamp:record.timestamp};
      }
    }

    activeRun=null;
    const persistence=persist();
    return {saved:persistence.ok,record,recordChanges:recordUpdate.changes,replaySaved,replayBytes,challengeResult,persistence};
  }

  function getReplay(mode=GHOST_MODE.LAST_RUN){
    const normalized=normalizeGhostMode(mode);
    if(normalized===GHOST_MODE.OFF)return null;
    return clone(pickGhostReplay(data.replays,normalized));
  }
  function getReplayAvailability(){return replayAvailability(data);}
  function selectGhost(mode){
    const normalized=normalizeGhostMode(mode);
    if(normalized!==GHOST_MODE.OFF){
      const replay=pickGhostReplay(data.replays,normalized);
      if(!replay||!validateReplayCompatibility(replay).compatible)return {selected:false,mode:GHOST_MODE.OFF,reason:'replay-unavailable'};
    }
    data.ghost.mode=normalized;
    persist();
    return {selected:true,mode:normalized};
  }
  function getGhostSelection(){
    const mode=normalizeGhostMode(data.ghost.mode);
    const replay=pickGhostReplay(data.replays,mode);
    return {mode,available:!!replay,playback:replay?createGhostPlayback(replay,{reducedVfx}):null};
  }

  function diagnostics(){
    const history=data.history;
    const failureCauses={};
    const setups={};
    let totalDistance=0;
    for(const run of history){
      totalDistance+=finite(run.distance);
      failureCauses[run.crashCause]=(failureCauses[run.crashCause]||0)+1;
      setups[run.setup]=(setups[run.setup]||0)+1;
    }
    let mostUsedSetup='';
    for(const [setup,count] of Object.entries(setups))if(!mostUsedSetup||count>setups[mostUsedSetup])mostUsedSetup=setup;
    return {
      schemaVersion:data.schemaVersion,
      historyCount:history.length,
      averageRunDistance:history.length?totalDistance/history.length:0,
      failureCauses,
      mostUsedSetup,
      storage:lastPersistResult,
      migration:clone(data.migration),
      corruptedStorageRecovered:loaded.corrupted,
      replayAvailability:getReplayAvailability()
    };
  }

  return {
    getBestDistance,getRecords,getRunHistory,getCurrentChallenge,activateChallenge,clearChallenge,getActiveChallenge,
    startRun,captureInput,captureCheckpoint,finishRun,getReplay,getReplayAvailability,selectGhost,getGhostSelection,diagnostics,
    serializeReplay,decodeReplay:replay=>decodeReplay(replay,{requireCompatibility:true}),
    encodeShareCode:meta=>encodeShareCode({challengeVersion:CHALLENGE_VERSION,gameplayVersion:GAMEPLAY_VERSION,...meta}),
    decodeShareCode,
    get storageKey(){return 'chimpions-urban-sports:progression:v1';}
  };
}

export * from './versions.js';
export * from './challenges.js';
export * from './replay.js';
export * from './ghost.js';
export * from './storage.js';
