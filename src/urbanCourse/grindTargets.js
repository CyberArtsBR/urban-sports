const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const hypot=(a,b)=>Math.hypot(a,b);
const PHYSICAL=new Set(['tree','rock','log','wideLog','oil','ramp']);

export const GRIND_TARGET_TYPES=Object.freeze([
  'LOW_CURB','HIGH_CURB','FLAT_RAIL','ROUND_RAIL','SQUARE_RAIL',
  'LEDGE','BENCH_EDGE','CONCRETE_BARRIER_EDGE','EVENT_RAIL','PLAZA_LEDGE'
]);

export const GRIND_SURFACES=Object.freeze({
  LOW_CURB:'concrete',HIGH_CURB:'concrete',FLAT_RAIL:'steel-flat',
  ROUND_RAIL:'steel-round',SQUARE_RAIL:'steel-square',LEDGE:'concrete-ledge',
  BENCH_EDGE:'painted-metal',CONCRETE_BARRIER_EDGE:'concrete-barrier',
  EVENT_RAIL:'powder-coated-steel',PLAZA_LEDGE:'stone-ledge'
});

const PROFILE=Object.freeze({
  LOW_CURB:{h:.18,r:.72,min:4.8,max:12.5,visual:'low-curb'},
  HIGH_CURB:{h:.34,r:.75,min:5,max:13.5,visual:'high-curb'},
  FLAT_RAIL:{h:.48,r:.86,min:5.5,max:15.5,visual:'flat-rail'},
  ROUND_RAIL:{h:.56,r:.90,min:5.5,max:14,visual:'round-rail'},
  SQUARE_RAIL:{h:.52,r:.88,min:5.4,max:14.5,visual:'square-rail'},
  LEDGE:{h:.42,r:.82,min:5.2,max:16.5,visual:'street-ledge'},
  BENCH_EDGE:{h:.52,r:.76,min:3.8,max:7.2,visual:'bench-edge'},
  CONCRETE_BARRIER_EDGE:{h:.78,r:.82,min:5.2,max:11.5,visual:'barrier-edge'},
  EVENT_RAIL:{h:.58,r:.92,min:6,max:16.5,visual:'event-rail'},
  PLAZA_LEDGE:{h:.46,r:.88,min:6,max:18,visual:'plaza-ledge'}
});

function hash(value){
  const text=String(value??'');let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function safeAt(placements,z,fallback=0){
  let best=fallback,d=Infinity;
  for(const p of placements||[]){
    if(!Number.isFinite(p?.safeX)||!Number.isFinite(p?.z))continue;
    const n=Math.abs(p.z-z);if(n<d){d=n;best=p.safeX;}
  }
  return best;
}
function hazardRadius(kind){return {tree:.95,rock:.95,log:1.65,wideLog:3.15,oil:1.75,ramp:1.6}[kind]||1;}
function clearAt(placements,x,z,radius=1.0,zPad=1.5){
  for(const p of placements||[]){
    if(!PHYSICAL.has(p?.kind)||p.jumpTarget)continue;
    const dx=Math.abs((Number(p.x)||0)-x),dz=Math.abs((Number(p.z)||0)-z);
    const hr=hazardRadius(p.kind);
    if(dx<radius+hr&&dz<zPad+hr)return false;
  }
  return true;
}
function segmentClear(placements,a,b,r=.75){
  for(let i=0;i<=8;i++){
    const t=i/8;
    if(!clearAt(placements,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,r,1.1))return false;
  }
  return true;
}
function normalize(pattern){
  return {
    CURB_LINE:'LOW_CURB',LOW_CURB:'LOW_CURB',HIGH_CURB:'HIGH_CURB',
    LEDGE_LINE:'LEDGE',FLAT_RAIL:'FLAT_RAIL',ROUND_RAIL:'ROUND_RAIL',
    SQUARE_RAIL:'SQUARE_RAIL',BENCH_EDGE:'BENCH_EDGE',
    CONCRETE_BARRIER_EDGE:'CONCRETE_BARRIER_EDGE',EVENT_RAIL:'EVENT_RAIL',
    PLAZA_LEDGE:'PLAZA_LEDGE',POST_LANDING_RAIL:'FLAT_RAIL'
  }[pattern]||'LOW_CURB';
}
function role(def,index){
  return ((def.id==='MIXED_TRICK_LINE'||def.id==='TECHNICAL_STREET_LINE')&&index===0)
    ?'PRIMARY_ROUTE_FEATURE':'OPTIONAL';
}
function buildTarget({id,type,pattern,sectionId,start,end,difficulty,routeRole,bypassX,bypassHalfWidth,tags}){
  const p=PROFILE[type],dx=end.x-start.x,dz=end.z-start.z,length=hypot(dx,dz);
  const tangent=length>1e-6?{x:dx/length,y:0,z:dz/length}:{x:0,y:0,z:-1};
  const entry=clamp(6+length*.35,6,11),exit=clamp(7+length*.40,7,12);
  return Object.freeze({
    id,type,start:Object.freeze(start),end:Object.freeze(end),tangent:Object.freeze(tangent),length,
    height:p.h,captureRadius:p.r,surface:GRIND_SURFACES[type],
    allowedApproachDirection:Object.freeze({mode:'DOWNHILL',minimumDot:.72,maximumEntryAngleDeg:44}),
    difficulty:clamp(Number(difficulty)||0,0,1),routeRole,optional:routeRole==='OPTIONAL',sectionId,
    visualReference:Object.freeze({kind:'procedural-grind-feature',style:p.visual,sectionId,targetId:id,
      pattern,gameplayCollision:'grind-capture-separate'}),
    approachCorridor:Object.freeze({centerX:start.x,fromZ:start.z+entry,toZ:start.z,halfWidth:p.r+1.05}),
    exitCorridor:Object.freeze({centerX:end.x,fromZ:end.z,toZ:end.z-exit,halfWidth:p.r+1.15}),
    recoveryCorridor:Object.freeze({centerX:bypassX,fromZ:end.z-2,toZ:end.z-exit-7,halfWidth:Math.max(1.2,bypassHalfWidth)}),
    safeBypass:Object.freeze({centerX:bypassX,halfWidth:Math.max(1.2,bypassHalfWidth),mandatory:false}),
    trickTags:Object.freeze(tags||['GRIND'])
  });
}

function makeCandidate({sectionId,index,pattern,definition,placements,startZ,endZ,difficulty,courseHalfWidth,safeRouteHalfWidth,landing}){
  const type=normalize(pattern),p=PROFILE[type],seed=hash(sectionId+'|'+index+'|'+pattern);
  const sectionLength=Math.abs(startZ-endZ);
  const afterLanding=pattern==='POST_LANDING_RAIL'&&Number.isFinite(landing?.landingEndZ);
  const hi=afterLanding?landing.landingEndZ-10:startZ-Math.min(20,sectionLength*.18);
  const lo=endZ+Math.min(18,sectionLength*.16);
  if(hi-lo<12)return null;
  const desired=clamp(p.min+(p.max-p.min)*(.30+difficulty*.55),p.min,Math.min(p.max,(hi-lo)*.40));
  for(let attempt=0;attempt<12;attempt++){
    const side=((seed+attempt)&1)?1:-1;
    const span=Math.max(2,hi-lo-desired);
    const centerZ=lo+desired*.5+((hash(seed+'|'+attempt)%1000)/1000)*span;
    const safe=safeAt(placements,centerZ,0);
    const offset=4.4+definition.grindIntensity*2.0+(attempt%4)*.48;
    let centerX=clamp(safe+side*offset,-courseHalfWidth+1,courseHalfWidth-1);
    if(Math.abs(centerX-safe)<3.0)continue;
    const shallow=(type.includes('RAIL')||type==='LEDGE')?(((seed>>>3)&1)?1:-1)*Math.min(1.1,desired*.055):0;
    const start={x:centerX-shallow*.5,y:p.h,z:centerZ+desired*.5};
    const end={x:centerX+shallow*.5,y:p.h,z:centerZ-desired*.5};
    const entryZ=start.z+7,exitZ=end.z-8;
    if(!segmentClear(placements,start,end,p.r*.68))continue;
    if(!clearAt(placements,start.x,entryZ,p.r+1.05,1.5))continue;
    if(!clearAt(placements,end.x,exitZ,p.r+1.05,1.5))continue;
    const bypassX=clamp(safe,-safeRouteHalfWidth,safeRouteHalfWidth);
    const tags=['GRIND'];
    if(afterLanding)tags.push('JUMP_TO_GRIND');
    if(definition.manualFriendly)tags.push('MANUAL_EXIT');
    return buildTarget({
      id:sectionId+':grind:'+index,type,pattern,sectionId,start,end,difficulty,
      routeRole:role(definition,index),bypassX,bypassHalfWidth:Math.max(1.25,definition.routeWidth*2.2),tags
    });
  }
  return null;
}

export function validateGrindTarget(target,{placements=[],courseHalfWidth=13.45,safeRouteHalfWidth=10.35}={}){
  const failures=[];
  if(!target||!GRIND_TARGET_TYPES.includes(target.type))failures.push('TYPE');
  if(!Number.isFinite(target?.length)||target.length<3.8)failures.push('LENGTH');
  if(!Number.isFinite(target?.captureRadius)||target.captureRadius<=0||target.captureRadius>1.5)failures.push('CAPTURE');
  const tangentLength=hypot(Number(target?.tangent?.x)||0,Number(target?.tangent?.z)||0);
  if(Math.abs(tangentLength-1)>.02)failures.push('TANGENT');
  if(Math.abs(Number(target?.start?.x)||0)>courseHalfWidth+.001||Math.abs(Number(target?.end?.x)||0)>courseHalfWidth+.001)failures.push('BOUNDS');
  if(Math.abs(Number(target?.safeBypass?.centerX)||0)>safeRouteHalfWidth+.001)failures.push('BYPASS');
  if(!target?.approachCorridor||!target?.exitCorridor||!target?.recoveryCorridor)failures.push('CORRIDORS');
  if(target?.visualReference?.gameplayCollision!=='grind-capture-separate')failures.push('COLLISION_SEPARATION');
  if(target?.start&&target?.end&&!segmentClear(placements,target.start,target.end,(target.captureRadius||.7)*.68))failures.push('SEGMENT_BLOCKED');
  return Object.freeze({valid:failures.length===0,failures:Object.freeze(failures)});
}
export function validateGrindTargets(targets,options={}){
  const results=(targets||[]).map(target=>({id:target.id,...validateGrindTarget(target,options)}));
  return Object.freeze({valid:results.every(r=>r.valid),failures:Object.freeze(results.filter(r=>!r.valid)),results:Object.freeze(results)});
}
export function createGrindTargets({
  sectionId,definition,placements=[],startZ,endZ,difficulty=0,courseHalfWidth=13.45,safeRouteHalfWidth=10.35,landing=null
}={}){
  if(!definition?.grindPatterns?.length||definition.grindIntensity<.15)return Object.freeze([]);
  const maxTargets=Math.min(3,1+Math.floor(definition.grindIntensity*2.2));
  const targets=[];
  for(let i=0;i<maxTargets;i++){
    const pattern=definition.grindPatterns[i%definition.grindPatterns.length];
    const target=makeCandidate({sectionId,index:i,pattern,definition,placements,startZ,endZ,difficulty,courseHalfWidth,safeRouteHalfWidth,landing});
    if(!target)continue;
    if(validateGrindTarget(target,{placements,courseHalfWidth,safeRouteHalfWidth}).valid)targets.push(target);
  }
  return Object.freeze(targets);
}
export function getGrindTargetRenderDescriptors(targets=[]){
  return Object.freeze(targets.map(t=>Object.freeze({
    id:t.id,type:t.type,start:t.start,end:t.end,height:t.height,surface:t.surface,
    visualReference:t.visualReference,gameplayCollision:false
  })));
}
