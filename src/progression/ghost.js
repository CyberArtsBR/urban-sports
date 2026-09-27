import {validateReplayCompatibility} from './replay.js';

export const GHOST_MODE=Object.freeze({
  OFF:'off',
  LAST_RUN:'lastRun',
  BEST_DISTANCE:'bestDistance',
  BEST_SCORE:'bestScore'
});

export const GHOST_RENDER_POLICY=Object.freeze({
  collision:false,
  affectsCourse:false,
  sound:false,
  maxGhosts:1
});

const MODES=new Set(Object.values(GHOST_MODE));
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export function normalizeGhostMode(mode){
  return MODES.has(mode)?mode:GHOST_MODE.OFF;
}

export function pickGhostReplay(replays={},mode=GHOST_MODE.OFF){
  const normalized=normalizeGhostMode(mode);
  if(normalized===GHOST_MODE.OFF)return null;
  return replays?.[normalized]||null;
}

export function createGhostPlayback(replay,{reducedVfx=false}={}){
  if(!replay)return null;
  const compatibility=validateReplayCompatibility(replay);
  if(!compatibility.compatible)return {available:false,reason:'version-mismatch',compatibility};
  const checkpoints=Array.isArray(replay.checkpoints)?replay.checkpoints:[];
  if(checkpoints.length<2)return {available:false,reason:'insufficient-checkpoints',compatibility};
  let cursor=0;

  function sample(frame){
    const target=Math.max(0,Number(frame)||0);
    while(cursor<checkpoints.length-2&&checkpoints[cursor+1].frame<target)cursor++;
    while(cursor>0&&checkpoints[cursor].frame>target)cursor--;
    const a=checkpoints[cursor],b=checkpoints[Math.min(checkpoints.length-1,cursor+1)];
    const span=Math.max(1,b.frame-a.frame);
    const t=clamp((target-a.frame)/span);
    const mix=(x,y)=>Number(x||0)+(Number(y||0)-Number(x||0))*t;
    return {
      frame:target,
      x:mix(a.x,b.x),
      y:mix(a.y,b.y),
      distance:mix(a.distance,b.distance),
      speed:mix(a.speed,b.speed),
      airborne:t<.5?!!a.airborne:!!b.airborne,
      course:t<.5?a.course:b.course,
      opacity:reducedVfx?.65:.42,
      collision:false,
      sound:false
    };
  }

  return {
    available:true,
    compatibility,
    policy:GHOST_RENDER_POLICY,
    reducedVfx:!!reducedVfx,
    sample,
    reset(){cursor=0;}
  };
}
