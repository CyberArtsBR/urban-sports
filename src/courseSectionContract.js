const DEFAULT_BOUNDS=Object.freeze({min:20,max:120});

export const COURSE_SECTION_LENGTH_BOUNDS=Object.freeze({
  'OPEN CARVE':Object.freeze({min:20,max:120}),
  'BANANA LINE':Object.freeze({min:20,max:120}),
  'GATE':Object.freeze({min:20,max:120}),
  'FOREST':Object.freeze({min:20,max:140}),
  'ROCK SLALOM':Object.freeze({min:20,max:140}),
  'RECOVERY':Object.freeze({min:20,max:120})
});

export function getCourseSectionLengthBounds(type,{maxJumpLength=120}={}){
  if(type==='RAMP'||type==='LOG JUMP'){
    const numeric=Number(maxJumpLength);
    return Object.freeze({min:20,max:Number.isFinite(numeric)?Math.max(120,numeric):120});
  }
  return COURSE_SECTION_LENGTH_BOUNDS[type]||DEFAULT_BOUNDS;
}


const URBAN_DEFAULT_BOUNDS=Object.freeze({min:20,max:140});
const URBAN_JUMP_TYPES=new Set([
  'KICKER_LINE','DOUBLE_KICKER','STREET_RAMP','ROADWORK_TRANSFER',
  'PLAZA_TRANSFER','BARRIER_GRIND','MEDIAN_TRANSFER','EVENT_SECTION','MIXED_TRICK_LINE'
]);

// Urban semantics use the same authoritative legacy safety-family bounds.
// Callers should pass legacyType when the section has already been generated;
// direct Urban lookup remains available to authoring/debug tooling.
export const URBAN_COURSE_SECTION_LENGTH_BOUNDS=Object.freeze({
  BOULEVARD_RUN:Object.freeze({min:20,max:120}),
  CONSTRUCTION_WEAVE:Object.freeze({min:20,max:140}),
  BOLLARD_SLALOM:Object.freeze({min:20,max:140}),
  PARKED_CAR_GAP:Object.freeze({min:20,max:120}),
  DELIVERY_LANE_SQUEEZE:Object.freeze({min:20,max:140}),
  LOADING_ZONE_RUN:Object.freeze({min:20,max:120}),
  CURB_LINE:Object.freeze({min:20,max:120}),
  LEDGE_LINE:Object.freeze({min:20,max:140}),
  RAIL_LINE:Object.freeze({min:20,max:140}),
  HANDRAIL_RUN:Object.freeze({min:20,max:140}),
  STREET_CLOSURE:Object.freeze({min:20,max:140}),
  CONSTRUCTION_CHICANE:Object.freeze({min:20,max:140}),
  ALLEY_SQUEEZE:Object.freeze({min:20,max:140}),
  BUS_STOP_GAP:Object.freeze({min:20,max:120}),
  UTILITY_ZONE:Object.freeze({min:20,max:140}),
  NIGHTLIFE_STRAIGHT:Object.freeze({min:20,max:120}),
  INDUSTRIAL_RUN:Object.freeze({min:20,max:140}),
  TECHNICAL_STREET_LINE:Object.freeze({min:20,max:140}),
  SPEED_BOULEVARD:Object.freeze({min:20,max:120})
});

export function getUrbanCourseSectionLengthBounds(type,{legacyType=null,maxJumpLength=120}={}){
  if(legacyType){
    return getCourseSectionLengthBounds(legacyType,{maxJumpLength});
  }
  if(URBAN_JUMP_TYPES.has(type)){
    const numeric=Number(maxJumpLength);
    return Object.freeze({min:20,max:Number.isFinite(numeric)?Math.max(120,numeric):120});
  }
  return URBAN_COURSE_SECTION_LENGTH_BOUNDS[type]||URBAN_DEFAULT_BOUNDS;
}
