import assert from 'node:assert/strict';
import {createCourseDirector} from '../src/course.js';
import {SKI_TUNING as T} from '../src/gameplayTuning.js';
import {solveCourseSectionRoute} from '../src/urbanCourse/routeSolver.js';
import {URBAN_DISTRICT_IDS,URBAN_SECTION_FAMILIES} from '../src/urbanCourse/urbanCourseDirector.js';

const routeCenter=z=>Math.sin((-z)*.035)*2.9+Math.sin((-z)*.011)*1.1;
const physical=new Set(['tree','rock','log','wideLog','oil']);
const SEEDS=10_000;
const SECTIONS_PER_SEED=14;

const sectionDistribution=new Map();
const familyDistribution=new Map();
const districtDistribution=new Map();
const hazardDistribution=new Map();
const densityBins=new Map();
const riskBananas={tier1:0,tier2:0,tier3:0,total:0};
let impossibleRouteCount=0,solverImpossibleRouteCount=0,totalSections=0,totalPlacements=0;
let rampFrequency=0,railFrequency=0,recoveryFrequency=0;
let minimumRouteWidth=Infinity,maximumRequiredLateralTransition=0;
let maxRepeatedSectionStreak=0,maxRepeatedFormationStreak=0;
let totalThreat=0,landmarkCount=0;

const inc=(map,key,amount=1)=>map.set(key,(map.get(key)||0)+amount);
const densityBucket=distance=>distance<1200?'OPENING':distance<3600?'MID':'LATE';

for(let seedIndex=0;seedIndex<SEEDS;seedIndex++){
  const seed='urban-fuzz-'+seedIndex;
  const director=createCourseDirector({routeCenter,seed});
  let z=-12;
  let previousUrban='',sectionStreak=0;
  let previousFormation='',formationStreak=0;
  for(let i=0;i<SECTIONS_PER_SEED;i++){
    const progress=i/(SECTIONS_PER_SEED-1);
    const difficulty=Math.min(1,.08+progress*.92);
    const speed=T.BASE_SPEED+(T.MAX_SPEED-T.BASE_SPEED)*Math.min(1,.06+progress*.82);
    const section=director.next({
      startZ:z,difficulty,speed,runTime:i*3.2,postMaxTime:i>11?25:0
    });
    totalSections++;
    totalPlacements+=section.placements.length;
    totalThreat+=Number(section.threatBudget?.estimatedCost)||0;
    if(!section.corridorValidation?.valid)impossibleRouteCount++;
    minimumRouteWidth=Math.min(minimumRouteWidth,Number(section.corridorValidation?.narrowestWidth)||Infinity);
    if(section.urbanDirector?.landmark)landmarkCount++;

    inc(sectionDistribution,section.urbanType);
    inc(familyDistribution,section.urbanDirector?.family||'UNKNOWN');
    inc(districtDistribution,section.urbanDirector?.district||'UNKNOWN');
    if(section.urbanType===previousUrban)sectionStreak++;else{previousUrban=section.urbanType;sectionStreak=1;}
    maxRepeatedSectionStreak=Math.max(maxRepeatedSectionStreak,sectionStreak);

    const hazards=section.placements.filter(p=>physical.has(p.kind));
    for(const p of hazards)inc(hazardDistribution,p.kind);
    const bucket=densityBucket(Math.abs(z));
    const density=densityBins.get(bucket)||{sections:0,hazards:0,placements:0,threat:0};
    density.sections++;density.hazards+=hazards.length;density.placements+=section.placements.length;
    density.threat+=Number(section.threatBudget?.estimatedCost)||0;densityBins.set(bucket,density);

    const formationGroups=new Map();
    for(const p of section.placements){
      if(p.kind==='ramp')rampFrequency++;
      if(p.kind==='banana'&&p.riskReward){
        const tier=Math.max(1,Math.min(3,Math.round(Number(p.riskReward)||1)));
        riskBananas.total++;riskBananas['tier'+tier]++;
      }
      if(!p.formation)continue;
      const key=Number.isFinite(p.decisionSerial)?'serial:'+p.decisionSerial:'z:'+String(p.decisionZ)+'|'+p.formation;
      if(!formationGroups.has(key))formationGroups.set(key,{formation:p.formation,z:Number(p.decisionZ)||p.z});
    }
    const orderedFormations=[...formationGroups.values()].sort((a,b)=>b.z-a.z);
    for(const group of orderedFormations){
      if(group.formation===previousFormation)formationStreak++;else{previousFormation=group.formation;formationStreak=1;}
      maxRepeatedFormationStreak=Math.max(maxRepeatedFormationStreak,formationStreak);
    }
    railFrequency+=section.grindTargets?.length||0;
    if(section.type==='RECOVERY')recoveryFrequency++;

    if(i===SECTIONS_PER_SEED-1){
      const solved=solveCourseSectionRoute({
        placements:section.placements,startZ:z,endZ:section.endZ,speed,startX:section.urban?.safeRoute?.startX||0
      });
      if(!solved.valid)solverImpossibleRouteCount++;
      maximumRequiredLateralTransition=Math.max(maximumRequiredLateralTransition,solved.maxRequiredLateralTransition);
      if(solved.minimumRouteWidth>0)minimumRouteWidth=Math.min(minimumRouteWidth,solved.minimumRouteWidth);
    }
    z=section.endZ;
  }
}

assert.equal(impossibleRouteCount,0,'generated an impossible reachable corridor during 10k-seed fuzz');
assert.equal(solverImpossibleRouteCount,0,'lightweight route solver found an impossible sampled section');
assert(sectionDistribution.size>=20,'Urban section variety collapsed');
assert(familyDistribution.size>=12,'Urban family grammar coverage collapsed');
assert([...URBAN_DISTRICT_IDS].every(id=>districtDistribution.has(id)),'not all modular districts were exercised');
assert([...URBAN_SECTION_FAMILIES].filter(id=>id!=='RECOVERY_STREET').every(id=>familyDistribution.has(id)),'a core Urban family never appeared');
assert(maxRepeatedSectionStreak<=3,'same Urban section repeated too many times in a row');
assert(maxRepeatedFormationStreak<=4,'formation anti-repetition exceeded existing fairness bound');
assert(rampFrequency>SEEDS*.45,'ramps became too rare');
assert(railFrequency>SEEDS*.25,'optional grind routes became too rare');
assert(recoveryFrequency>SEEDS*.45,'recovery cadence became too sparse');
assert(riskBananas.total>SEEDS*.35,'risk/reward banana lines became too rare');
assert(Number.isFinite(minimumRouteWidth)&&minimumRouteWidth>.35,'minimum route width collapsed');
assert(maximumRequiredLateralTransition<=T.SAFE_ROUTE_MAX_REACH+.01,'sampled route demanded excessive lateral transition');
assert(landmarkCount>SEEDS*.20,'landmark cadence did not activate');

const densityByDistance=Object.fromEntries([...densityBins].map(([key,value])=>[key,{
  sections:value.sections,
  hazardsPerSection:Number((value.hazards/value.sections).toFixed(3)),
  placementsPerSection:Number((value.placements/value.sections).toFixed(3)),
  threatPerSection:Number((value.threat/value.sections).toFixed(3))
}]));

console.log(JSON.stringify({
  check:'urban-course-director-fuzz',
  seeds:SEEDS,sections:totalSections,placements:totalPlacements,
  impossibleRouteCount,solverImpossibleRouteCount,
  sectionDistribution:Object.fromEntries(sectionDistribution),
  familyDistribution:Object.fromEntries(familyDistribution),
  districtDistribution:Object.fromEntries(districtDistribution),
  hazardDistribution:Object.fromEntries(hazardDistribution),
  rampFrequency,railFrequency,recoveryFrequency,
  minimumRouteWidth:Number(minimumRouteWidth.toFixed(3)),
  maximumRequiredLateralTransition:Number(maximumRequiredLateralTransition.toFixed(3)),
  averageThreatScore:Number((totalThreat/totalSections).toFixed(3)),
  maxRepeatedSectionStreak,maxRepeatedFormationStreak,
  bananaRiskDistribution:riskBananas,
  landmarkCount,densityByDistance
}));
