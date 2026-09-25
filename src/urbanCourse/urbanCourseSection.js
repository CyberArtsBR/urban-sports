import {makeUrbanSectionMetadata,selectUrbanSection} from './urbanSectionCatalog.js';
import {createGrindTargets,getGrindTargetRenderDescriptors,validateGrindTargets} from './grindTargets.js';

const PHYSICAL=new Set(['tree','rock','log','wideLog','oil','ramp']);
const HAZARD=Object.freeze({
  tree:'TRAFFIC_BOLLARD',rock:'CONCRETE_BARRIER',log:'CONSTRUCTION_BARRICADE',
  wideLog:'ROAD_CLOSURE_GATE',oil:'ROAD_SURFACE_HAZARD',ramp:'STREET_KICKER',banana:'BANANA_PICKUP'
});
function semantic(kind,urbanType){
  if(kind==='tree')return urbanType.includes('CONSTRUCTION')?'ROADWORK_CONE':urbanType.includes('EVENT')?'EVENT_MARKER':'TRAFFIC_BOLLARD';
  if(kind==='rock')return urbanType.includes('CONSTRUCTION')||urbanType==='BARRIER_GRIND'?'JERSEY_BARRIER':'CONCRETE_BARRIER';
  if(kind==='log')return urbanType==='STREET_CLOSURE'?'CLOSURE_BARRICADE':'CONSTRUCTION_BARRICADE';
  if(kind==='wideLog')return 'ROAD_CLOSURE_GATE';
  if(kind==='oil')return 'ROAD_SURFACE_HAZARD';
  if(kind==='ramp')return urbanType.includes('EVENT')?'EVENT_RAMP':urbanType.includes('ROADWORK')?'CONSTRUCTION_PLATE_RAMP':'STREET_KICKER';
  return HAZARD[kind]||String(kind||'UNKNOWN').toUpperCase();
}
function safeSummary(placements,startSafeX,endSafeX,safeRouteHalfWidth){
  const values=(placements||[]).map(p=>p.safeX).filter(Number.isFinite);
  values.push(Number.isFinite(startSafeX)?startSafeX:0,Number.isFinite(endSafeX)?endSafeX:0);
  return Object.freeze({
    startX:Number.isFinite(startSafeX)?startSafeX:0,endX:Number.isFinite(endSafeX)?endSafeX:0,
    minX:Math.max(-safeRouteHalfWidth,Math.min(...values)),
    maxX:Math.min(safeRouteHalfWidth,Math.max(...values)),
    halfWidth:safeRouteHalfWidth,hasGuaranteedBypass:true
  });
}
export function isUrbanPhysicalPlacement(placement){return PHYSICAL.has(placement?.kind);}

export function composeUrbanCourseSection({
  legacyType,placements=[],startZ,endZ,length,speed,difficulty,sectionIndex=0,runSeed='',
  runPhase='',district=null,previousUrbanType='',startSafeX=0,endSafeX=0,
  courseHalfWidth=13.45,safeRouteHalfWidth=10.35,landing=null
}={}){
  const definition=selectUrbanSection({
    legacyType,sectionIndex,difficulty,speed,runPhase,runSeed,district,previousUrbanType
  });
  const id=(runSeed||'run')+':urban:'+sectionIndex+':'+definition.id;
  for(const placement of placements){
    placement.legacyCollisionKind=placement.kind;
    placement.urbanHazard=semantic(placement.kind,definition.id);
    placement.urbanType=definition.id;
    placement.urbanSectionId=id;
  }
  const safeRoute=safeSummary(placements,startSafeX,endSafeX,safeRouteHalfWidth);
  const metadata=makeUrbanSectionMetadata(definition,{
    sectionId:id,legacyType,length,speed,difficulty,district,safeRoute
  });
  const grindTargets=createGrindTargets({
    sectionId:id,definition,placements,startZ,endZ,difficulty,
    courseHalfWidth,safeRouteHalfWidth,landing
  });
  const grindValidation=validateGrindTargets(grindTargets,{placements,courseHalfWidth,safeRouteHalfWidth});
  const jumpOpportunities=Object.freeze(placements.filter(p=>p.kind==='ramp').map((p,index)=>Object.freeze({
    id:id+':jump:'+index,type:'JUMP',x:p.x,z:p.z,safeX:p.safeX,
    landingDistance:Number(p.landingDistance)||0,flightTime:Number(p.flightTime)||0,
    protectedLanding:true,sectionId:id
  })));
  const grindRenderDescriptors=getGrindTargetRenderDescriptors(grindTargets);
  const gameplayFeatures=Object.freeze({
    jumpOpportunities:jumpOpportunities.length,
    grindOpportunities:grindTargets.length,
    manualFriendly:definition.manualFriendly,
    technicalSequence:definition.specialOpportunities.includes('TECHNICAL_SEQUENCE'),
    largeAir:definition.specialOpportunities.includes('LARGE_AIR'),
    lineChoice:definition.specialOpportunities.includes('LINE_CHOICE'),
    safeBypass:true
  });
  return Object.freeze({
    id,type:definition.id,definition,metadata,grindTargets,grindValidation,
    grindRenderDescriptors,jumpOpportunities,gameplayFeatures
  });
}
