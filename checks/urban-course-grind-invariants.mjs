import assert from 'node:assert/strict';
import {createCourseDirector,COURSE_TYPES,URBAN_COURSE_TYPES} from '../src/course.js';
import {SKI_TUNING as T} from '../src/gameplayTuning.js';
import {estimateRampFlightEnvelope} from '../src/rampTrajectory.js';
import {getUrbanCourseSectionLengthBounds} from '../src/courseSectionContract.js';
import {
  ACTIVE_URBAN_SECTION_TYPES,GRIND_TARGET_TYPES,URBAN_SECTION_CATALOG,
  createGrindTargets,validateGrindTargets
} from '../src/urbanCourse/index.js';

const routeCenter=z=>Math.sin((-z)*.035)*2.9+Math.sin((-z)*.011)*1.1;
const physicalKinds=new Set(['tree','rock','log','wideLog','oil','ramp']);
const maxJumpFollowUp=34+18+24*1.22+14;
const maxJumpLength=Math.ceil(maxJumpFollowUp+estimateRampFlightEnvelope(T.MAX_SPEED).protectedEndDistance);

assert(URBAN_COURSE_TYPES.length>=28,'Urban catalog is incomplete');
assert(ACTIVE_URBAN_SECTION_TYPES.length>=27,'Too many Urban sections are inactive');
for(const id of ACTIVE_URBAN_SECTION_TYPES){
  const def=URBAN_SECTION_CATALOG[id];
  assert(def&&def.legacyFamilies.length,'Urban section missing legacy safety-family mapping: '+id);
  assert(def.districtAffinity.length,'Urban section missing district affinity: '+id);
  assert(def.recommendedSpeed>=def.minimumSpeed,'Urban speed metadata invalid: '+id);
  assert(def.routeWidth>0&&def.routeWidth<=1,'Urban route width invalid: '+id);
  for(const legacyType of def.legacyFamilies){
    const bounds=getUrbanCourseSectionLengthBounds(id,{legacyType,maxJumpLength});
    assert(Number.isFinite(bounds.min)&&Number.isFinite(bounds.max)&&bounds.max>=bounds.min,'missing shared section contract: '+id);
  }
  const synthetic=createGrindTargets({
    sectionId:'catalog:'+id,definition:def,placements:[],startZ:0,endZ:-140,difficulty:.72,
    courseHalfWidth:T.COURSE_OBJECT_HALF_WIDTH,safeRouteHalfWidth:T.SAFE_ROUTE_HALF_WIDTH,
    landing:{safeX:0,landingEndZ:-70}
  });
  assert(synthetic.length<=3,'catalog section emitted unbounded grind targets: '+id);
  const check=validateGrindTargets(synthetic,{
    placements:[],courseHalfWidth:T.COURSE_OBJECT_HALF_WIDTH,safeRouteHalfWidth:T.SAFE_ROUTE_HALF_WIDTH
  });
  assert(check.valid,'synthetic grind schema invalid for '+id+': '+JSON.stringify(check.failures));
}

const seeds=['urban-1','urban-7','urban-19','urban-43','urban-101','urban-31337','urban-cafe','urban-deadbeef','urban-plaza','urban-industrial','urban-night','urban-event'];
const districts=['DOWNTOWN','COMMERCIAL','CONSTRUCTION','INDUSTRIAL','ENTERTAINMENT','EVENT'];
const seenUrban=new Set(),seenLegacy=new Set();
let totalSections=0,totalGrinds=0,sectionsWithGrinds=0,jumpToGrind=0,maxTargets=0;

for(const seed of seeds){
  const director=createCourseDirector({routeCenter,seed});
  let z=-12;
  for(let i=0;i<150;i++){
    const difficulty=Math.min(1,i/115);
    const speed=T.BASE_SPEED+(T.MAX_SPEED-T.BASE_SPEED)*difficulty;
    const section=director.next({
      startZ:z,difficulty,speed,runTime:i*3.4,postMaxTime:i>120?(i-120)*2.5:0,district:districts[i%districts.length]
    });
    totalSections++;seenLegacy.add(section.type);seenUrban.add(section.urbanType);
    assert(COURSE_TYPES.includes(section.type),'unknown legacy safety family');
    assert(URBAN_COURSE_TYPES.includes(section.urbanType),'unknown Urban section type');
    assert(section.urban&&section.urban.type===section.urbanType,'Urban metadata missing or drifted');
    assert.equal(section.urban.legacyType,section.type,'legacy family mapping drifted');
    assert.equal(section.urban.length,section.length,'Urban metadata length drifted');
    assert(section.urban.safeRoute?.hasGuaranteedBypass,'Urban section lost guaranteed bypass');
    assert(Array.isArray(section.grindTargets),'missing grind-target interface');
    assert(section.grindTargets.length<=3,'unbounded grind targets per section');
    assert(section.grindValidation?.valid,'invalid grind target escaped generator: '+JSON.stringify(section.grindValidation?.failures));
    const bounds=getUrbanCourseSectionLengthBounds(section.urbanType,{legacyType:section.type,maxJumpLength});
    assert(section.length>=bounds.min&&section.length<=bounds.max,'Urban/shared section-length contract diverged');

    for(const p of section.placements){
      assert.equal(p.urbanType,section.urbanType,'placement lost Urban type');
      assert.equal(p.urbanSectionId,section.urbanSectionId,'placement lost Urban section id');
      assert.equal(p.legacyCollisionKind,p.kind,'Urban adapter changed collision kind');
      if(physicalKinds.has(p.kind))assert(typeof p.urbanHazard==='string'&&p.urbanHazard.length,'physical placement missing Urban semantic hazard');
    }
    for(const target of section.grindTargets){
      assert(GRIND_TARGET_TYPES.includes(target.type),'unknown grind target type');
      assert(target.length>=3.8,'grind target too short');
      assert(target.captureRadius>0&&target.captureRadius<=1.5,'invalid capture radius');
      assert(Math.abs(Math.hypot(target.tangent.x,target.tangent.z)-1)<.02,'invalid grind tangent');
      assert(Math.abs(target.start.x)<=T.COURSE_OBJECT_HALF_WIDTH+.001,'grind start outside course');
      assert(Math.abs(target.end.x)<=T.COURSE_OBJECT_HALF_WIDTH+.001,'grind end outside course');
      assert(Math.abs(target.safeBypass.centerX)<=T.SAFE_ROUTE_HALF_WIDTH+.001,'safe bypass outside route');
      assert(target.approachCorridor&&target.exitCorridor&&target.recoveryCorridor,'grind target missing safety corridors');
      assert.equal(target.visualReference?.gameplayCollision,'grind-capture-separate','grind capture coupled to generic collision');
      if(target.trickTags.includes('JUMP_TO_GRIND'))jumpToGrind++;
    }
    if(section.grindTargets.length){sectionsWithGrinds++;totalGrinds+=section.grindTargets.length;}
    maxTargets=Math.max(maxTargets,section.grindTargets.length);
    z=section.endZ;
  }
}
assert(totalSections>=1800,'Urban course soak too short');
assert(seenLegacy.size>=8,'not all mature legacy safety families were exercised');
assert(seenUrban.size>=18,'Urban section variety too low: '+seenUrban.size);
assert(totalGrinds>=60,'grind opportunities too sparse across soak');
assert(sectionsWithGrinds>=50,'too few sections expose optional grind lines');
assert(maxTargets<=3,'grind target bound regressed');

// Determinism includes Urban type selection and exact grind geometry.
function compact(section){
  return {
    type:section.type,urbanType:section.urbanType,endZ:section.endZ,
    targets:section.grindTargets.map(t=>({
      type:t.type,sx:t.start.x,sz:t.start.z,ex:t.end.x,ez:t.end.z,length:t.length
    }))
  };
}
const a=createCourseDirector({routeCenter,seed:'deterministic-urban-course'});
const b=createCourseDirector({routeCenter,seed:'deterministic-urban-course'});
let za=-12,zb=-12;
for(let i=0;i<220;i++){
  const difficulty=Math.min(1,i/150),speed=T.BASE_SPEED+(T.MAX_SPEED-T.BASE_SPEED)*difficulty;
  const district=districts[i%districts.length];
  const sa=a.next({startZ:za,difficulty,speed,runTime:i*3,district});
  const sb=b.next({startZ:zb,difficulty,speed,runTime:i*3,district});
  assert.deepEqual(compact(sa),compact(sb),'Urban determinism diverged at section '+i);
  za=sa.endZ;zb=sb.endZ;
}

console.log(JSON.stringify({
  check:'urban-course-grind-invariants',catalogTypes:URBAN_COURSE_TYPES.length,
  activeTypes:ACTIVE_URBAN_SECTION_TYPES.length,seenUrbanTypes:seenUrban.size,totalSections,
  sectionsWithGrinds,totalGrinds,jumpToGrind,maxTargetsPerSection:maxTargets
}));
