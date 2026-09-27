import {PROGRESSION_SCHEMA_VERSION} from './versions.js';
import {estimateReplayBytes,validateReplayCompatibility} from './replay.js';
import {GHOST_MODE,normalizeGhostMode} from './ghost.js';

export const URBAN_PROGRESS_KEY='chimpions-urban-sports:progression:v1';
export const LEGACY_BEST_KEY='chimpions-ski-best';
export const MAX_RUN_HISTORY=40;
export const MAX_REPLAY_BYTES=96*1024;
export const MAX_STORAGE_BYTES=480*1024;

const encoder=new TextEncoder();
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const cleanText=(value,max=128)=>String(value??'').slice(0,max);

export function createEmptyProgressionState(){
  return {
    schemaVersion:PROGRESSION_SCHEMA_VERSION,
    updatedAt:'',
    migration:{legacyBestDistance:false},
    history:[],
    records:{
      bestDistance:null,
      bestScore:null,
      bestCombo:null,
      bestTrick:null,
      mostBananas:null,
      longestCleanRun:null,
      byRider:{},
      bySport:{},
      bySetup:{}
    },
    replays:{lastRun:null,bestDistance:null,bestScore:null},
    ghost:{mode:GHOST_MODE.OFF},
    challengeProgress:{}
  };
}

export function storageByteSize(value){
  return encoder.encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
}

export function sanitizeRunRecord(input={}){
  return {
    id:cleanText(input.id||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,64),
    timestamp:cleanText(input.timestamp||new Date().toISOString(),40),
    gameVersion:cleanText(input.gameVersion,48),
    physicsVersion:cleanText(input.physicsVersion,64),
    courseVersion:cleanText(input.courseVersion,64),
    runSeed:cleanText(input.runSeed,128),
    sport:cleanText(input.sport||'skateboard',32),
    setup:cleanText(input.setup||'default',48),
    rider:cleanText(input.rider||'unknown',96),
    distance:Math.max(0,finite(input.distance)),
    score:Math.max(0,Math.round(finite(input.score))),
    bananas:Math.max(0,Math.round(finite(input.bananas))),
    duration:Math.max(0,finite(input.duration)),
    maxSpeed:Math.max(0,finite(input.maxSpeed)),
    bestCombo:Math.max(0,Math.round(finite(input.bestCombo))),
    bestTrick:{type:cleanText(input.bestTrick?.type||input.bestTrickType||'',48),points:Math.max(0,Math.round(finite(input.bestTrick?.points??input.bestTrickPoints)))},
    tricksLanded:Math.max(0,Math.round(finite(input.tricksLanded))),
    tricksFailed:Math.max(0,Math.round(finite(input.tricksFailed))),
    cleanLandings:Math.max(0,Math.round(finite(input.cleanLandings))),
    nearMisses:Math.max(0,Math.round(finite(input.nearMisses))),
    bananaPowerUses:Math.max(0,Math.round(finite(input.bananaPowerUses))),
    cleanRunDuration:Math.max(0,finite(input.cleanRunDuration)),
    crashCause:cleanText(input.crashCause||'unknown',48)
  };
}

function betterRun(candidate,current,primary){
  if(!current)return true;
  const a=finite(candidate?.[primary]),b=finite(current?.[primary]);
  if(a!==b)return a>b;
  if(finite(candidate?.score)!==finite(current?.score))return finite(candidate?.score)>finite(current?.score);
  return finite(candidate?.distance)>finite(current?.distance);
}

function recordRef(run){
  return sanitizeRunRecord(run);
}

export function updatePersonalRecords(records,run){
  const next={
    bestDistance:records?.bestDistance||null,
    bestScore:records?.bestScore||null,
    bestCombo:records?.bestCombo||null,
    bestTrick:records?.bestTrick||null,
    mostBananas:records?.mostBananas||null,
    longestCleanRun:records?.longestCleanRun||null,
    byRider:{...(records?.byRider||{})},
    bySport:{...(records?.bySport||{})},
    bySetup:{...(records?.bySetup||{})}
  };
  const changes=[];
  const assign=(key,primary)=>{if(betterRun(run,next[key],primary)){next[key]=recordRef(run);changes.push(key);}};
  assign('bestDistance','distance');
  assign('bestScore','score');
  assign('bestCombo','bestCombo');
  if(!next.bestTrick||finite(run.bestTrick?.points)>finite(next.bestTrick.bestTrick?.points)){next.bestTrick=recordRef(run);changes.push('bestTrick');}
  assign('mostBananas','bananas');
  assign('longestCleanRun','cleanRunDuration');
  const scoped=[['byRider',run.rider],['bySport',run.sport],['bySetup',run.setup]];
  for(const [bucket,keyRaw] of scoped){
    const key=cleanText(keyRaw||'unknown',96);
    if(betterRun(run,next[bucket][key],'distance')){next[bucket][key]=recordRef(run);changes.push(`${bucket}:${key}`);}
  }
  return {records:next,changes};
}

function sanitizeRecordSlot(value){
  return value&&typeof value==='object'?sanitizeRunRecord(value):null;
}

function sanitizeRecordMap(value,maxEntries=64){
  if(!value||typeof value!=='object')return {};
  const entries=Object.entries(value).slice(0,maxEntries);
  return Object.fromEntries(entries.map(([key,record])=>[cleanText(key,96),sanitizeRecordSlot(record)]).filter(([,record])=>record));
}

function sanitizeReplaySlot(value){
  if(!value||typeof value!=='object')return null;
  try{
    if(estimateReplayBytes(value)>MAX_REPLAY_BYTES)return null;
    return value;
  }catch{return null;}
}

export function sanitizeProgressionState(input){
  const base=createEmptyProgressionState();
  if(!input||typeof input!=='object'||Number(input.schemaVersion)!==PROGRESSION_SCHEMA_VERSION)return base;
  base.updatedAt=cleanText(input.updatedAt,40);
  base.migration={legacyBestDistance:!!input.migration?.legacyBestDistance};
  base.history=Array.isArray(input.history)?input.history.slice(0,MAX_RUN_HISTORY).map(sanitizeRunRecord):[];
  base.records={
    bestDistance:sanitizeRecordSlot(input.records?.bestDistance),
    bestScore:sanitizeRecordSlot(input.records?.bestScore),
    bestCombo:sanitizeRecordSlot(input.records?.bestCombo),
    bestTrick:sanitizeRecordSlot(input.records?.bestTrick),
    mostBananas:sanitizeRecordSlot(input.records?.mostBananas),
    longestCleanRun:sanitizeRecordSlot(input.records?.longestCleanRun),
    byRider:sanitizeRecordMap(input.records?.byRider),
    bySport:sanitizeRecordMap(input.records?.bySport,16),
    bySetup:sanitizeRecordMap(input.records?.bySetup,32)
  };
  base.replays={
    lastRun:sanitizeReplaySlot(input.replays?.lastRun),
    bestDistance:sanitizeReplaySlot(input.replays?.bestDistance),
    bestScore:sanitizeReplaySlot(input.replays?.bestScore)
  };
  base.ghost={mode:normalizeGhostMode(input.ghost?.mode)};
  base.challengeProgress=input.challengeProgress&&typeof input.challengeProgress==='object'?{...input.challengeProgress}:{};
  return base;
}

function safeGet(storage,key){
  try{return storage?.getItem?.(key)??null;}catch{return null;}
}
function safeSet(storage,key,value){
  try{storage?.setItem?.(key,value);return {ok:true};}
  catch(error){return {ok:false,error,reason:error?.name==='QuotaExceededError'?'quota':'storage'};}
}

export function loadProgressionState(storage=globalThis.localStorage,{legacyBestKey=LEGACY_BEST_KEY}={}){
  let corrupted=false;
  let parsed=null;
  const raw=safeGet(storage,URBAN_PROGRESS_KEY);
  if(raw){
    try{parsed=JSON.parse(raw);}catch{corrupted=true;}
  }
  const state=sanitizeProgressionState(parsed);
  const legacyBest=Math.max(0,finite(safeGet(storage,legacyBestKey)));
  let migrated=false;
  if(legacyBest>finite(state.records.bestDistance?.distance)){
    state.records.bestDistance=sanitizeRunRecord({
      id:'legacy-best-distance',timestamp:'',distance:legacyBest,score:0,sport:'skateboard',setup:'legacy',rider:'legacy',crashCause:'legacy-migration'
    });
    state.migration.legacyBestDistance=true;
    migrated=true;
  }
  return {state,corrupted,migrated,legacyBest};
}

export function enforceProgressionBounds(state){
  state.history=Array.isArray(state.history)?state.history.slice(0,MAX_RUN_HISTORY):[];
  for(const key of ['lastRun','bestDistance','bestScore']){
    if(state.replays?.[key]&&estimateReplayBytes(state.replays[key])>MAX_REPLAY_BYTES)state.replays[key]=null;
  }
  let serialized=JSON.stringify(state);
  while(storageByteSize(serialized)>MAX_STORAGE_BYTES&&state.history.length>8){
    state.history.pop();
    serialized=JSON.stringify(state);
  }
  if(storageByteSize(serialized)>MAX_STORAGE_BYTES&&state.replays?.lastRun){state.replays.lastRun=null;serialized=JSON.stringify(state);}
  if(storageByteSize(serialized)>MAX_STORAGE_BYTES&&state.replays?.bestScore){state.replays.bestScore=null;serialized=JSON.stringify(state);}
  if(storageByteSize(serialized)>MAX_STORAGE_BYTES&&state.replays?.bestDistance){state.replays.bestDistance=null;serialized=JSON.stringify(state);}
  return state;
}

export function persistProgressionState(storage,state,{legacyBestKey=LEGACY_BEST_KEY}={}){
  const bounded=enforceProgressionBounds(state);
  bounded.updatedAt=new Date().toISOString();
  const serialized=JSON.stringify(bounded);
  const result=safeSet(storage,URBAN_PROGRESS_KEY,serialized);
  if(result.ok){
    const best=finite(bounded.records?.bestDistance?.distance);
    if(best>0)safeSet(storage,legacyBestKey,String(Math.floor(best)));
  }
  return {...result,bytes:storageByteSize(serialized)};
}

export function replayAvailability(state){
  const out={};
  for(const key of ['lastRun','bestDistance','bestScore']){
    const replay=state?.replays?.[key];
    const compatibility=replay?validateReplayCompatibility(replay):{compatible:false,issues:['missing']};
    out[key]={available:!!replay&&compatibility.compatible,compatibility};
  }
  return out;
}
