import {SKI_TUNING as T} from '../gameplayTuning.js';
import {obstacleCollisionHalfWidth} from '../obstacleTuning.js';
import {maxHumanReachableLateralDelta,validateReachableCorridor} from '../courseSafety.js';

const PHYSICAL_HAZARDS=new Set(['tree','rock','log','wideLog','oil']);
const FALLBACK_HALF_WIDTH=Object.freeze({tree:.62,rock:.55,log:1.1,wideLog:2.65,oil:1.25});

function halfWidth(kind){return obstacleCollisionHalfWidth(kind,FALLBACK_HALF_WIDTH[kind]??.7);}

export function solveCourseSectionRoute({
  placements=[],startZ=0,endZ=-100,speed=T.BASE_SPEED,startX=0
}={}){
  const corridor=validateReachableCorridor({
    placements,startZ,endZ,speed,startX,
    corridorMin:-(T.PLAYER_HALF_WIDTH-.62),
    corridorMax:T.PLAYER_HALF_WIDTH-.62,
    hazardKinds:PHYSICAL_HAZARDS,
    hazardHalfWidth:kind=>halfWidth(kind),
    minPassageWidth:.42
  });
  const checkpoints=[];
  for(const p of placements){
    if(!p?.routeDecision||!Number.isFinite(p.decisionZ)||!Number.isFinite(p.safeX))continue;
    if(checkpoints.some(item=>item.z===p.decisionZ&&item.x===p.safeX))continue;
    checkpoints.push({z:p.decisionZ,x:p.safeX});
  }
  checkpoints.sort((a,b)=>b.z-a.z);
  let previous=null;
  let maxRequiredLateralTransition=0;
  let tightestReachRatio=0;
  let impossibleCheckpoint=null;
  for(const point of checkpoints){
    if(previous){
      const required=Math.abs(point.x-previous.x);
      const reachable=maxHumanReachableLateralDelta(point.z-previous.z,speed);
      const ratio=reachable>1e-6?required/reachable:(required>1e-6?Infinity:0);
      maxRequiredLateralTransition=Math.max(maxRequiredLateralTransition,required);
      tightestReachRatio=Math.max(tightestReachRatio,ratio);
      if(!impossibleCheckpoint&&required>reachable+.001)impossibleCheckpoint={...point,required,reachable};
    }
    previous=point;
  }
  return Object.freeze({
    valid:corridor.valid,
    corridorValid:corridor.valid,
    checkpointSequenceValid:!impossibleCheckpoint,
    impossibleCheckpoint,
    minimumRouteWidth:Number(corridor.narrowestWidth)||0,
    firstDecisionReadTime:corridor.firstDecisionReadTime,
    reactionSeconds:corridor.reactionSeconds,
    maxRequiredLateralTransition,
    tightestReachRatio:Number.isFinite(tightestReachRatio)?tightestReachRatio:Infinity,
    checkpointCount:checkpoints.length,
    intervals:corridor.intervals
  });
}