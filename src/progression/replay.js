import {CURRENT_REPLAY_VERSIONS,REPLAY_FORMAT_VERSION,SHARE_CODE_VERSION} from './versions.js';

export const REPLAY_PREFIX='USR1.';
export const SHARE_CODE_PREFIX='USC1.';
export const MAX_REPLAY_FRAMES=1_000_000;
export const MAX_REPLAY_DT_TICKS=300; // 50 ms at 1/6000 s resolution; render dt is capped at 50 ms.
export const MAX_REPLAY_DURATION_SECONDS=4*60*60;
export const DEFAULT_CHECKPOINT_INTERVAL=120;

const TRICK_IDS=Object.freeze(['','180','360','BACKFLIP','KICKFLIP','HEELFLIP','POP SHOVE-IT','FRONTSIDE SHOVE-IT','INDY','MELON','NOSEGRAB','VARIAL FLIP','360 FLIP']);
const encoder=new TextEncoder();
const decoder=new TextDecoder();
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const quantizeAxis=value=>Math.max(-127,Math.min(127,Math.round((Number(value)||0)*127)));
const dequantizeAxis=value=>Math.max(-1,Math.min(1,(Number(value)||0)/127));
const quantizeDt=dt=>Math.max(1,Math.min(MAX_REPLAY_DT_TICKS,Math.round((Number(dt)||0)*6000)));
const dequantizeDt=value=>(Number(value)||0)/6000;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=(value,digits=4)=>{const p=10**digits;return Math.round(finite(value)*p)/p;};

function bytesToBase64(bytes){
  let out='';
  for(let i=0;i<bytes.length;i+=3){
    const a=bytes[i],b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0;
    const triple=(a<<16)|(b<<8)|c;
    out+=B64[(triple>>18)&63]+B64[(triple>>12)&63]+(i+1<bytes.length?B64[(triple>>6)&63]:'=')+(i+2<bytes.length?B64[triple&63]:'=');
  }
  return out;
}
function base64ToBytes(value){
  const clean=String(value||'').replace(/\s+/g,'');
  if(clean.length%4!==0)throw new Error('Invalid base64 length');
  const bytes=[];
  for(let i=0;i<clean.length;i+=4){
    const chars=[clean[i],clean[i+1],clean[i+2],clean[i+3]];
    const vals=chars.map(char=>char==='='?0:B64.indexOf(char));
    if(vals.some((v,index)=>v<0&&chars[index]!=='='))throw new Error('Invalid base64 data');
    const triple=(vals[0]<<18)|(vals[1]<<12)|(vals[2]<<6)|vals[3];
    bytes.push((triple>>16)&255);
    if(chars[2]!=='=')bytes.push((triple>>8)&255);
    if(chars[3]!=='=')bytes.push(triple&255);
  }
  return Uint8Array.from(bytes);
}
function encodeJson(value){
  return bytesToBase64(encoder.encode(JSON.stringify(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeJson(value){
  const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  return JSON.parse(decoder.decode(base64ToBytes(padded)));
}

function trickId(value){
  const index=TRICK_IDS.indexOf(String(value||''));
  return index<0?0:index;
}
function trickName(value){
  return TRICK_IDS[Number(value)||0]||'';
}

export function packReplayInput(input={},dt=1/60){
  let flags=0;
  if(input.jumpPressed)flags|=1;
  if(input.jumpHeld)flags|=2;
  if(input.trickModifier)flags|=4;
  if(input.specialPressed)flags|=8;
  if(input.cameraPressed)flags|=16;
  if(input.cameraMotionPressed)flags|=32;
  return [quantizeAxis(input.steer),quantizeAxis(input.verticalIntent),flags,trickId(input.trickIntent),trickId(input.airborneTrickIntent),quantizeDt(dt)];
}

function validatePackedInput(packed){
  if(!Array.isArray(packed)||packed.length!==6)throw new Error('Malformed replay input');
  const [steer,vertical,flags,trick,airTrick,dtTicks]=packed.map(Number);
  if(!Number.isInteger(steer)||steer<-127||steer>127)throw new Error('Invalid replay steer axis');
  if(!Number.isInteger(vertical)||vertical<-127||vertical>127)throw new Error('Invalid replay vertical axis');
  if(!Number.isInteger(flags)||flags<0||flags>63)throw new Error('Invalid replay input flags');
  if(!Number.isInteger(trick)||trick<0||trick>=TRICK_IDS.length)throw new Error('Invalid replay trick intent');
  if(!Number.isInteger(airTrick)||airTrick<0||airTrick>=TRICK_IDS.length)throw new Error('Invalid replay airborne trick intent');
  if(!Number.isInteger(dtTicks)||dtTicks<1||dtTicks>MAX_REPLAY_DT_TICKS)throw new Error('Invalid replay delta time');
  return true;
}

export function unpackReplayInput(packed){
  validatePackedInput(packed);
  const flags=Number(packed[2])||0;
  return {
    steer:dequantizeAxis(packed[0]),
    verticalIntent:dequantizeAxis(packed[1]),
    jumpPressed:!!(flags&1),
    jumpHeld:!!(flags&2),
    trickModifier:!!(flags&4),
    specialPressed:!!(flags&8),
    cameraPressed:!!(flags&16),
    cameraMotionPressed:!!(flags&32),
    trickIntent:trickName(packed[3]),
    airborneTrickIntent:trickName(packed[4]),
    dt:dequantizeDt(packed[5])
  };
}

function samePacked(a,b){
  return !!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
}

export function snapshotReplayState(state={},frame=0){
  return {
    frame:Math.max(0,Math.floor(frame)),
    distance:round(state.distance,3),
    x:round(state.x,4),
    y:round(state.y,4),
    speed:round(state.speed,4),
    airborne:!!state.air,
    course:String(state.courseSection||''),
    score:Math.round(finite(state.score)),
    tricksLanded:Math.round(finite(state.tricksLanded)),
    collisionOutcome:String(state.crashType||''),
    crashFrame:state.crashType?Math.max(0,Math.floor(frame)):null
  };
}

export function createReplayRecorder({
  runSeed='',sport='skateboard',setup='default',rider='unknown',
  gameVersion=CURRENT_REPLAY_VERSIONS.gameVersion,
  physicsVersion=CURRENT_REPLAY_VERSIONS.physicsVersion,
  courseVersion=CURRENT_REPLAY_VERSIONS.courseVersion,
  checkpointInterval=DEFAULT_CHECKPOINT_INTERVAL
}={}){
  const segments=[];
  const checkpoints=[];
  let frame=0;
  let finalised=false;
  let lastPacked=null;

  function recordInput(input,dt){
    if(finalised)return false;
    if(frame>=MAX_REPLAY_FRAMES)throw new Error('Replay frame limit exceeded');
    const packed=packReplayInput(input,dt);
    const tail=segments[segments.length-1];
    if(tail&&samePacked(tail.slice(1),packed))tail[0]++;
    else segments.push([1,...packed]);
    lastPacked=packed;
    frame++;
    return true;
  }

  function captureCheckpoint(state,{force=false}={}){
    if(finalised)return false;
    if(!force&&frame>0&&frame%checkpointInterval!==0)return false;
    const next=snapshotReplayState(state,frame);
    const previous=checkpoints[checkpoints.length-1];
    if(previous?.frame===next.frame)checkpoints[checkpoints.length-1]=next;
    else checkpoints.push(next);
    return true;
  }

  function finalize(state={}){
    if(finalised)return null;
    captureCheckpoint(state,{force:true});
    finalised=true;
    return {
      formatVersion:REPLAY_FORMAT_VERSION,
      gameVersion:String(gameVersion),
      physicsVersion:String(physicsVersion),
      courseVersion:String(courseVersion),
      runSeed:String(runSeed),
      sport:String(sport),
      setup:String(setup),
      rider:String(rider),
      frameCount:frame,
      segments,
      checkpoints,
      terminal:snapshotReplayState(state,frame)
    };
  }

  return {
    recordInput,captureCheckpoint,finalize,
    get frameCount(){return frame;},
    get segmentCount(){return segments.length;},
    get lastPacked(){return lastPacked?[...lastPacked]:null;}
  };
}

export function estimateReplayBytes(replay){
  return encoder.encode(JSON.stringify(replay||{})).byteLength;
}

export function validateReplayCompatibility(replay,expected=CURRENT_REPLAY_VERSIONS){
  const issues=[];
  if(Number(replay?.formatVersion)!==REPLAY_FORMAT_VERSION)issues.push('format-version');
  if(String(replay?.gameVersion||'')!==String(expected.gameVersion))issues.push('game-version');
  if(String(replay?.physicsVersion||'')!==String(expected.physicsVersion))issues.push('physics-version');
  if(String(replay?.courseVersion||'')!==String(expected.courseVersion))issues.push('course-version');
  return {compatible:issues.length===0,issues};
}

export function validateReplay(replay,{requireCompatibility=false,expectedVersions=CURRENT_REPLAY_VERSIONS}={}){
  if(!replay||typeof replay!=='object')throw new Error('Replay must be an object');
  if(Number(replay.formatVersion)!==REPLAY_FORMAT_VERSION)throw new Error('Unsupported replay format');
  if(!/^[A-Za-z0-9 ._:+-]{1,128}$/.test(String(replay.runSeed||'')))throw new Error('Invalid replay seed');
  if(!/^[a-z0-9_-]{1,32}$/i.test(String(replay.sport||'')))throw new Error('Invalid replay sport');
  if(!/^[a-z0-9_.:-]{1,48}$/i.test(String(replay.setup||'')))throw new Error('Invalid replay setup');
  if(!Array.isArray(replay.segments)||!Array.isArray(replay.checkpoints))throw new Error('Malformed replay payload');
  let frames=0;
  let durationTicks=0;
  for(const segment of replay.segments){
    if(!Array.isArray(segment)||segment.length!==7)throw new Error('Malformed replay segment');
    const count=Number(segment[0]);
    if(!Number.isInteger(count)||count<1||count>MAX_REPLAY_FRAMES)throw new Error('Invalid replay run length');
    const packed=segment.slice(1);
    validatePackedInput(packed);
    frames+=count;
    durationTicks+=count*Number(packed[5]);
    if(frames>MAX_REPLAY_FRAMES)throw new Error('Replay too long');
    if(durationTicks/6000>MAX_REPLAY_DURATION_SECONDS)throw new Error('Replay duration exceeds limit');
  }
  if(frames!==Number(replay.frameCount))throw new Error('Replay frame count mismatch');
  if(replay.checkpoints.length>Math.ceil(MAX_REPLAY_FRAMES/10)+2)throw new Error('Too many replay checkpoints');
  let previousCheckpointFrame=-1;
  for(const checkpoint of replay.checkpoints){
    const checkpointFrame=Number(checkpoint?.frame);
    if(!Number.isInteger(checkpointFrame)||checkpointFrame<0||checkpointFrame>frames||checkpointFrame<=previousCheckpointFrame)throw new Error('Invalid replay checkpoint sequence');
    for(const key of ['distance','x','y','speed','score'])if(!Number.isFinite(Number(checkpoint?.[key])))throw new Error('Invalid replay checkpoint state');
    previousCheckpointFrame=checkpointFrame;
  }
  if(replay.terminal&&Number(replay.terminal.frame)!==frames)throw new Error('Replay terminal frame mismatch');
  const compatibility=validateReplayCompatibility(replay,expectedVersions);
  if(requireCompatibility&&!compatibility.compatible)throw new Error(`Incompatible replay: ${compatibility.issues.join(',')}`);
  return {valid:true,frames,compatibility};
}

export function serializeReplay(replay){
  validateReplay(replay);
  return `${REPLAY_PREFIX}${encodeJson(replay)}`;
}

export function decodeReplay(serialized,options={}){
  let replay;
  if(typeof serialized==='string'&&serialized.startsWith(REPLAY_PREFIX))replay=decodeJson(serialized.slice(REPLAY_PREFIX.length));
  else if(typeof serialized==='string')replay=JSON.parse(serialized);
  else replay=structuredClone(serialized);
  validateReplay(replay,options);
  return replay;
}

export function *iterateReplayInputs(replay){
  validateReplay(replay);
  let frame=0;
  for(const segment of replay.segments){
    const count=segment[0];
    const input=unpackReplayInput(segment.slice(1));
    for(let i=0;i<count;i++)yield {frame:++frame,...input};
  }
}

const DEFAULT_TOLERANCE=Object.freeze({distance:.02,position:.025,speed:.02});
export function compareReplayCheckpoint(actual,expected,tolerance=DEFAULT_TOLERANCE){
  const failures=[];
  const diff=(name,a,b,limit)=>{if(Math.abs(finite(a)-finite(b))>limit)failures.push(name);};
  diff('distance',actual?.distance,expected?.distance,tolerance.distance??DEFAULT_TOLERANCE.distance);
  diff('x',actual?.x,expected?.x,tolerance.position??DEFAULT_TOLERANCE.position);
  diff('y',actual?.y,expected?.y,tolerance.position??DEFAULT_TOLERANCE.position);
  diff('speed',actual?.speed,expected?.speed,tolerance.speed??DEFAULT_TOLERANCE.speed);
  if(!!actual?.airborne!==!!expected?.airborne)failures.push('airborne');
  if(String(actual?.course||'')!==String(expected?.course||''))failures.push('course');
  if(Math.round(finite(actual?.score))!==Math.round(finite(expected?.score)))failures.push('score');
  if(String(actual?.collisionOutcome||'')!==String(expected?.collisionOutcome||''))failures.push('collisionOutcome');
  const actualCrash=actual?.crashFrame==null?null:Number(actual.crashFrame);
  const expectedCrash=expected?.crashFrame==null?null:Number(expected.crashFrame);
  if(actualCrash!==expectedCrash)failures.push('crashFrame');
  return {match:failures.length===0,failures};
}

export function verifyReplayDeterminism(replay,{
  createSimulation,
  stepSimulation,
  snapshot=(simulation,frame)=>snapshotReplayState(simulation,frame),
  tolerance=DEFAULT_TOLERANCE
}={}){
  validateReplay(replay,{requireCompatibility:true});
  if(typeof createSimulation!=='function'||typeof stepSimulation!=='function')throw new Error('Determinism verification requires simulation callbacks');
  const simulation=createSimulation(replay);
  const checkpoints=new Map(replay.checkpoints.map(checkpoint=>[checkpoint.frame,checkpoint]));
  const mismatches=[];
  for(const input of iterateReplayInputs(replay)){
    stepSimulation(simulation,input,input.dt);
    const expected=checkpoints.get(input.frame);
    if(!expected)continue;
    const actual=snapshot(simulation,input.frame);
    const comparison=compareReplayCheckpoint(actual,expected,tolerance);
    if(!comparison.match)mismatches.push({frame:input.frame,failures:comparison.failures,actual,expected});
  }
  return {deterministic:mismatches.length===0,checkpointCount:replay.checkpoints.length,mismatches};
}

function safeShareField(value,{max=64,pattern=/^[A-Za-z0-9._:+-]+$/}={}){
  const text=String(value??'');
  if(!text||text.length>max||!pattern.test(text))throw new Error('Invalid share-code field');
  return text;
}

export function encodeShareCode({seed,sport='skateboard',setup='default',challengeVersion='none',gameplayVersion='unknown'}={}){
  const payload={
    v:SHARE_CODE_VERSION,
    s:safeShareField(seed,{max:128}),
    p:safeShareField(sport,{max:32,pattern:/^[A-Za-z0-9_-]+$/}),
    u:safeShareField(setup,{max:48}),
    c:safeShareField(challengeVersion,{max:48}),
    g:safeShareField(gameplayVersion,{max:96})
  };
  return `${SHARE_CODE_PREFIX}${encodeJson(payload)}`;
}

export function decodeShareCode(code){
  if(typeof code!=='string'||!code.startsWith(SHARE_CODE_PREFIX)||code.length>1024)throw new Error('Invalid Urban Sports share code');
  const payload=decodeJson(code.slice(SHARE_CODE_PREFIX.length));
  if(Number(payload?.v)!==SHARE_CODE_VERSION)throw new Error('Unsupported share-code version');
  return {
    seed:safeShareField(payload.s,{max:128}),
    sport:safeShareField(payload.p,{max:32,pattern:/^[A-Za-z0-9_-]+$/}),
    setup:safeShareField(payload.u,{max:48}),
    challengeVersion:safeShareField(payload.c,{max:48}),
    gameplayVersion:safeShareField(payload.g,{max:96})
  };
}
