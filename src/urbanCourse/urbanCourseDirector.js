import {ACTIVE_URBAN_SECTION_TYPES,URBAN_SECTION_CATALOG} from './urbanSectionCatalog.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const lerp=(a,b,t)=>a+(b-a)*t;

export const URBAN_SECTION_FAMILIES=Object.freeze([
  'OPEN_STREET','TRAFFIC_SLALOM','CONSTRUCTION','RAIL_LINE','LEDGE_LINE','PLAZA',
  'SIDEWALK_TRANSFER','RAMP_LINE','TECH_LINE','SPEED_LINE','INTERSECTION','ALLEY',
  'STREET_GAP','RECOVERY_STREET'
]);

export const URBAN_DISTRICT_IDS=Object.freeze([
  'DOWNTOWN','COMMERCIAL_AVENUE','CONSTRUCTION_DISTRICT','PLAZA',
  'INDUSTRIAL_ZONE','WATERFRONT','ALLEY_DISTRICT','ENTERTAINMENT_NIGHT'
]);

export const URBAN_DISTRICT_PROFILES=Object.freeze({
  DOWNTOWN:Object.freeze({
    catalogAffinities:Object.freeze(['DOWNTOWN','COMMERCIAL']),
    preferredFamilies:Object.freeze(['OPEN_STREET','TRAFFIC_SLALOM','LEDGE_LINE','INTERSECTION','STREET_GAP']),
    propDensity:.72,buildingStyle:'dense-core',roadMarkings:'city-grid',railFrequency:.58,
    lightingHook:'neutral-day',atmosphereHook:'urban-haze'
  }),
  COMMERCIAL_AVENUE:Object.freeze({
    catalogAffinities:Object.freeze(['COMMERCIAL','DOWNTOWN']),
    preferredFamilies:Object.freeze(['OPEN_STREET','STREET_GAP','LEDGE_LINE','SPEED_LINE','SIDEWALK_TRANSFER']),
    propDensity:.66,buildingStyle:'shopfront-avenue',roadMarkings:'multi-lane',railFrequency:.38,
    lightingHook:'bright-day',atmosphereHook:'clean-air'
  }),
  CONSTRUCTION_DISTRICT:Object.freeze({
    catalogAffinities:Object.freeze(['CONSTRUCTION','INDUSTRIAL']),
    preferredFamilies:Object.freeze(['CONSTRUCTION','TRAFFIC_SLALOM','SIDEWALK_TRANSFER','TECH_LINE']),
    propDensity:.84,buildingStyle:'scaffold-blocks',roadMarkings:'temporary-workzone',railFrequency:.34,
    lightingHook:'dusty-day',atmosphereHook:'construction-dust'
  }),
  PLAZA:Object.freeze({
    catalogAffinities:Object.freeze(['EVENT','DOWNTOWN','ENTERTAINMENT']),
    preferredFamilies:Object.freeze(['PLAZA','LEDGE_LINE','RAIL_LINE','SIDEWALK_TRANSFER','RAMP_LINE']),
    propDensity:.52,buildingStyle:'civic-open-space',roadMarkings:'plaza-paving',railFrequency:.82,
    lightingHook:'soft-open-sky',atmosphereHook:'open-plaza'
  }),
  INDUSTRIAL_ZONE:Object.freeze({
    catalogAffinities:Object.freeze(['INDUSTRIAL','CONSTRUCTION']),
    preferredFamilies:Object.freeze(['SPEED_LINE','RAIL_LINE','CONSTRUCTION','TECH_LINE','ALLEY']),
    propDensity:.62,buildingStyle:'warehouse-corridor',roadMarkings:'loading-zone',railFrequency:.72,
    lightingHook:'hard-industrial',atmosphereHook:'light-smog'
  }),
  WATERFRONT:Object.freeze({
    catalogAffinities:Object.freeze(['COMMERCIAL','ENTERTAINMENT','DOWNTOWN']),
    preferredFamilies:Object.freeze(['OPEN_STREET','SPEED_LINE','PLAZA','RAIL_LINE','STREET_GAP']),
    propDensity:.44,buildingStyle:'waterfront-mixed',roadMarkings:'promenade-lanes',railFrequency:.62,
    lightingHook:'water-reflection',atmosphereHook:'coastal-haze'
  }),
  ALLEY_DISTRICT:Object.freeze({
    catalogAffinities:Object.freeze(['DOWNTOWN','INDUSTRIAL']),
    preferredFamilies:Object.freeze(['ALLEY','TECH_LINE','LEDGE_LINE','STREET_GAP','CONSTRUCTION']),
    propDensity:.88,buildingStyle:'tight-service-lanes',roadMarkings:'service-alley',railFrequency:.46,
    lightingHook:'occluded-day',atmosphereHook:'tight-canyon'
  }),
  ENTERTAINMENT_NIGHT:Object.freeze({
    catalogAffinities:Object.freeze(['ENTERTAINMENT','EVENT','DOWNTOWN']),
    preferredFamilies:Object.freeze(['SPEED_LINE','RAMP_LINE','PLAZA','RAIL_LINE','TECH_LINE']),
    propDensity:.76,buildingStyle:'nightlife-strip',roadMarkings:'neon-avenue',railFrequency:.74,
    lightingHook:'night-neon',atmosphereHook:'night-glow'
  })
});

export const URBAN_SECTION_FAMILY_BY_TYPE=Object.freeze({
  BOULEVARD_RUN:'OPEN_STREET',
  CONSTRUCTION_WEAVE:'CONSTRUCTION',
  BOLLARD_SLALOM:'TRAFFIC_SLALOM',
  PARKED_CAR_GAP:'STREET_GAP',
  DELIVERY_LANE_SQUEEZE:'INTERSECTION',
  LOADING_ZONE_RUN:'OPEN_STREET',
  KICKER_LINE:'RAMP_LINE',
  DOUBLE_KICKER:'RAMP_LINE',
  STREET_RAMP:'RAMP_LINE',
  ROADWORK_TRANSFER:'SIDEWALK_TRANSFER',
  PLAZA_TRANSFER:'PLAZA',
  CURB_LINE:'LEDGE_LINE',
  LEDGE_LINE:'LEDGE_LINE',
  RAIL_LINE:'RAIL_LINE',
  HANDRAIL_RUN:'RAIL_LINE',
  BARRIER_GRIND:'TECH_LINE',
  STREET_CLOSURE:'INTERSECTION',
  CONSTRUCTION_CHICANE:'CONSTRUCTION',
  ALLEY_SQUEEZE:'ALLEY',
  BUS_STOP_GAP:'STREET_GAP',
  MEDIAN_TRANSFER:'SIDEWALK_TRANSFER',
  UTILITY_ZONE:'CONSTRUCTION',
  EVENT_SECTION:'PLAZA',
  NIGHTLIFE_STRAIGHT:'SPEED_LINE',
  INDUSTRIAL_RUN:'SPEED_LINE',
  TECHNICAL_STREET_LINE:'TECH_LINE',
  SPEED_BOULEVARD:'SPEED_LINE',
  MIXED_TRICK_LINE:'TECH_LINE'
});

const FAMILY_LEGACY_PREFERENCE=Object.freeze({
  OPEN_STREET:Object.freeze(['OPEN CARVE','BANANA LINE','GATE']),
  TRAFFIC_SLALOM:Object.freeze(['GATE','ROCK SLALOM','OPEN CARVE']),
  CONSTRUCTION:Object.freeze(['FOREST','GATE','ROCK SLALOM']),
  RAIL_LINE:Object.freeze(['OPEN CARVE','ROCK SLALOM','GATE']),
  LEDGE_LINE:Object.freeze(['OPEN CARVE','BANANA LINE','ROCK SLALOM']),
  PLAZA:Object.freeze(['OPEN CARVE','BANANA LINE','RAMP']),
  SIDEWALK_TRANSFER:Object.freeze(['RAMP','LOG JUMP','OPEN CARVE']),
  RAMP_LINE:Object.freeze(['RAMP','LOG JUMP']),
  TECH_LINE:Object.freeze(['ROCK SLALOM','FOREST','GATE','LOG JUMP']),
  SPEED_LINE:Object.freeze(['OPEN CARVE','BANANA LINE','RECOVERY']),
  INTERSECTION:Object.freeze(['GATE','FOREST','OPEN CARVE']),
  ALLEY:Object.freeze(['FOREST','ROCK SLALOM','GATE']),
  STREET_GAP:Object.freeze(['BANANA LINE','OPEN CARVE','GATE']),
  RECOVERY_STREET:Object.freeze(['RECOVERY'])
});

const OPENING_SCRIPT=Object.freeze([
  'BOULEVARD_RUN','PARKED_CAR_GAP','BOLLARD_SLALOM','CURB_LINE','STREET_RAMP',
  'BOULEVARD_RUN','LOADING_ZONE_RUN','LEDGE_LINE','RAIL_LINE','STREET_RAMP','BOULEVARD_RUN'
]);

const MODE_SEQUENCE=Object.freeze([
  'FLOW','TECH','CALM','RISK_REWARD','PRESSURE','FLOW','CALM','LANDMARK'
]);

function hash(value){
  const text=String(value??'');
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function createSeededRandom(seed){
  let state=(hash(seed)||0x9e3779b9)>>>0;
  return ()=>{
    state=(state+0x6d2b79f5)>>>0;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function weightedIndex(weights,random){
  const safe=weights.map(value=>Math.max(0,Number(value)||0));
  const total=safe.reduce((sum,value)=>sum+value,0);
  if(total<=0)return 0;
  let roll=random()*total;
  for(let i=0;i<safe.length;i++){
    roll-=safe[i];
    if(roll<=0)return i;
  }
  return safe.length-1;
}
function normalizedSpeed(speed=0){
  return clamp((Math.max(0,Number(speed)||0)-28)/58,0,1);
}
function familyFor(type){return URBAN_SECTION_FAMILY_BY_TYPE[type]||'OPEN_STREET';}
function isJumpLegacy(type){return type==='RAMP'||type==='LOG JUMP';}

export function getUrbanDifficultyModel({
  sectionIndex=0,distance=0,difficulty=0,speed=0,postMaxTime=0,mode=null,seed=''
}={}){
  const progress=clamp(Math.max(Number(distance)||0,sectionIndex*90)/7200,0,1);
  const base=clamp((Number(difficulty)||0)*.48+normalizedSpeed(speed)*.20+progress*.32,0,1);
  const phase=(hash(seed+'|difficulty')%6283)/1000;
  const waveA=.5+.5*Math.sin(sectionIndex*.61+phase);
  const waveB=.5+.5*Math.sin(sectionIndex*.37+phase*1.71+1.4);
  const waveC=.5+.5*Math.sin(sectionIndex*.83+phase*.63+2.1);
  const resolvedMode=mode||MODE_SEQUENCE[(sectionIndex+(hash(seed+'|mode')%MODE_SEQUENCE.length))%MODE_SEQUENCE.length];
  const modeBias={
    FLOW:[-.08,-.02,-.10,-.08,-.08,-.06,-.04,.10,.08,-.06,-.08],
    TECH:[.02,.10,.04,.16,.22,.18,.18,.04,-.02,.08,.08],
    CALM:[-.24,-.22,-.24,-.20,-.20,-.18,-.18,-.08,.24,-.20,-.16],
    RISK_REWARD:[-.04,.12,-.02,.18,.10,.08,.10,.24,.02,.16,.02],
    PRESSURE:[.18,.18,.14,.10,.14,.18,.02,-.10,-.10,.20,.16],
    LANDMARK:[-.10,.04,-.10,.10,.08,.04,.14,.22,.10,.02,.28]
  }[resolvedMode]||new Array(11).fill(0);
  const values=[
    base*.58+waveA*.22+waveC*.07,
    base*.48+waveB*.28,
    base*.34+waveC*.23,
    base*.44+waveA*.24,
    base*.38+waveB*.28,
    base*.40+waveC*.26,
    base*.34+waveB*.34,
    .22+base*.26+waveA*.34,
    .34-base*.12+(1-waveA)*.22,
    base*.40+waveC*.30,
    .24+base*.24+waveB*.30
  ].map((value,index)=>clamp(value+modeBias[index],0,1));
  const post=clamp((Number(postMaxTime)||0)/180,0,1);
  values[0]=clamp(values[0]+post*.10,0,1);
  values[5]=clamp(values[5]+post*.08,0,1);
  values[8]=clamp(values[8]+post*.04,0,1);
  return Object.freeze({
    mode:resolvedMode,
    longitudinalHazardDensity:values[0],
    lateralRoutePressure:values[1],
    reactionWindow:values[2],
    routeCommitment:values[3],
    formationComplexity:values[4],
    obstacleCombinations:values[5],
    grindComplexity:values[6],
    trickOpportunityDensity:values[7],
    recoveryFrequency:values[8],
    edgePressure:values[9],
    visualComplexity:values[10],
    intensityWave:Number(((waveA+waveB+waveC)/3).toFixed(6))
  });
}

function scoreFamily(family,{difficultyModel,districtProfile,sectionIndex,random}){
  let score=1;
  if(districtProfile.preferredFamilies.includes(family))score*=1.85;
  const d=difficultyModel;
  if(family==='OPEN_STREET'||family==='SPEED_LINE')score*=1.08+(1-d.formationComplexity)*.70;
  if(family==='TRAFFIC_SLALOM'||family==='INTERSECTION')score*=.72+d.lateralRoutePressure*1.25;
  if(family==='CONSTRUCTION'||family==='ALLEY')score*=.62+d.obstacleCombinations*1.20;
  if(family==='RAIL_LINE'||family==='LEDGE_LINE')score*=.62+d.grindComplexity*1.34;
  if(family==='RAMP_LINE'||family==='SIDEWALK_TRANSFER')score*=.50+d.trickOpportunityDensity*1.40;
  if(family==='TECH_LINE')score*=.42+d.formationComplexity*.92+d.grindComplexity*.58;
  if(family==='PLAZA')score*=.66+d.trickOpportunityDensity*.64+d.grindComplexity*.44;
  if(family==='STREET_GAP')score*=.70+d.routeCommitment*.90;
  if(family==='RECOVERY_STREET')score*=.18+d.recoveryFrequency*.72;
  score*=.92+random()*.16;
  if(sectionIndex<12&&(family==='TECH_LINE'||family==='ALLEY'))score*=.45;
  return score;
}

function compatibleDifficulty(def,difficulty){
  const d=clamp(Number(difficulty)||0,0,1);
  return d+1e-6>=def.difficulty.min&&d-1e-6<=def.difficulty.max;
}

export function createUrbanCourseDirector({seed=null,random:externalRandom=Math.random}={}){
  let runSeed=seed==null?null:String(seed);
  let random=runSeed==null?externalRandom:createSeededRandom(runSeed+'|urban-course-v2');
  let recentSections=[];
  let recentFamilies=[];
  let recentDistricts=[];
  let currentDistrict='DOWNTOWN';
  let districtRemaining=0;
  let previousFamily='RECOVERY_STREET';
  let landmarkCountdown=10+(hash((runSeed||'run')+'|landmark')%5);

  function pushRecent(list,value,max){list.push(value);if(list.length>max)list.shift();}

  function chooseDistrict(sectionIndex){
    if(sectionIndex<4){currentDistrict='DOWNTOWN';districtRemaining=Math.max(districtRemaining,4-sectionIndex);return currentDistrict;}
    if(districtRemaining>0){districtRemaining--;return currentDistrict;}
    const weights=URBAN_DISTRICT_IDS.map(id=>{
      let weight=1;
      if(id===currentDistrict)weight*=.05;
      if(recentDistricts.at(-1)===id)weight*=.12;
      if(recentDistricts.includes(id))weight*=.62;
      if(sectionIndex<18&&(id==='ALLEY_DISTRICT'||id==='ENTERTAINMENT_NIGHT'))weight*=.62;
      return weight;
    });
    currentDistrict=URBAN_DISTRICT_IDS[weightedIndex(weights,random)];
    pushRecent(recentDistricts,currentDistrict,4);
    districtRemaining=4+Math.floor(random()*4);
    return currentDistrict;
  }

  function chooseFamily({sectionIndex,difficultyModel,districtProfile,pendingLanding}){
    if(pendingLanding)return 'RECOVERY_STREET';
    if(sectionIndex<OPENING_SCRIPT.length)return familyFor(OPENING_SCRIPT[sectionIndex]);
    const weights=URBAN_SECTION_FAMILIES.map(family=>scoreFamily(family,{difficultyModel,districtProfile,sectionIndex,random}));
    const last=recentFamilies.at(-1),previous=recentFamilies.at(-2);
    if(last){const i=URBAN_SECTION_FAMILIES.indexOf(last);if(i>=0)weights[i]*=.12;}
    if(previous){const i=URBAN_SECTION_FAMILIES.indexOf(previous);if(i>=0)weights[i]*=.54;}
    if(difficultyModel.mode==='CALM'){
      for(const family of ['OPEN_STREET','SPEED_LINE','PLAZA'])weights[URBAN_SECTION_FAMILIES.indexOf(family)]*=1.65;
      weights[URBAN_SECTION_FAMILIES.indexOf('RECOVERY_STREET')]*=1.35;
    }
    if(difficultyModel.mode==='LANDMARK')weights[URBAN_SECTION_FAMILIES.indexOf('PLAZA')]*=1.7;
    if(previousFamily==='RAMP_LINE'||previousFamily==='SIDEWALK_TRANSFER')weights[URBAN_SECTION_FAMILIES.indexOf('RECOVERY_STREET')]*=2.1;
    return URBAN_SECTION_FAMILIES[weightedIndex(weights,random)];
  }

  function chooseSectionType({sectionIndex,family,difficulty,districtProfile,pendingLanding}){
    if(pendingLanding)return 'BOULEVARD_RUN';
    if(sectionIndex<OPENING_SCRIPT.length)return OPENING_SCRIPT[sectionIndex];
    let candidates=ACTIVE_URBAN_SECTION_TYPES
      .map(id=>URBAN_SECTION_CATALOG[id])
      .filter(def=>familyFor(def.id)===family&&compatibleDifficulty(def,difficulty));
    if(!candidates.length)candidates=ACTIVE_URBAN_SECTION_TYPES.map(id=>URBAN_SECTION_CATALOG[id]).filter(def=>familyFor(def.id)===family);
    if(!candidates.length)candidates=[URBAN_SECTION_CATALOG.BOULEVARD_RUN];
    const weights=candidates.map(def=>{
      let weight=1;
      if(def.districtAffinity.some(id=>districtProfile.catalogAffinities.includes(id)))weight*=2.05;
      const recentIndex=recentSections.lastIndexOf(def.id);
      if(recentIndex>=0){const age=recentSections.length-recentIndex;weight*=age<=1?.08:age<=3?.36:.68;}
      if(def.id===recentSections.at(-1))weight*=.05;
      return weight;
    });
    return candidates[weightedIndex(weights,random)].id;
  }

  function chooseLegacyType(sectionType,family,{pendingLanding=false,lastLegacyType='RECOVERY'}={}){
    if(pendingLanding)return 'RECOVERY';
    const def=URBAN_SECTION_CATALOG[sectionType]||URBAN_SECTION_CATALOG.BOULEVARD_RUN;
    const preferred=FAMILY_LEGACY_PREFERENCE[family]||['OPEN CARVE'];
    let options=preferred.filter(type=>def.legacyFamilies.includes(type));
    if(!options.length)options=[...def.legacyFamilies];
    if(!options.length)options=['OPEN CARVE'];
    if(isJumpLegacy(lastLegacyType))return 'RECOVERY';
    if(options.length>1&&options[0]===lastLegacyType)options=[...options.slice(1),options[0]];
    return options[weightedIndex(options.map((_,i)=>i===0?1.35:1),random)]||options[0];
  }

  function riskPlan({family,difficultyModel,sectionIndex}){
    const eligible=!['RECOVERY_STREET','OPEN_STREET'].includes(family)||difficultyModel.mode==='RISK_REWARD';
    const enabled=eligible&&(difficultyModel.routeCommitment>.38||difficultyModel.trickOpportunityDensity>.54);
    const tier=enabled?1+Math.floor(clamp((difficultyModel.routeCommitment+difficultyModel.grindComplexity+difficultyModel.trickOpportunityDensity)/3,0,.999)*3):0;
    const side=((hash((runSeed||'run')+'|risk|'+sectionIndex)&1)?1:-1);
    const kind=family==='RAIL_LINE'||family==='LEDGE_LINE'?'GRIND':family==='RAMP_LINE'||family==='SIDEWALK_TRANSFER'?'RAMP':'BANANA';
    return Object.freeze({enabled,tier,side,kind,routeOffset:enabled?3.1+tier*.72:0,rewardScale:enabled?1+tier*.34:1});
  }

  function plan({
    sectionIndex=0,startZ=0,difficulty=0,speed=0,runTime=0,postMaxTime=0,pendingLanding=false,lastLegacyType='RECOVERY'
  }={}){
    const district=chooseDistrict(sectionIndex);
    const districtProfile=URBAN_DISTRICT_PROFILES[district];
    const mode=sectionIndex<OPENING_SCRIPT.length?'FLOW':MODE_SEQUENCE[(sectionIndex+(hash((runSeed||'run')+'|wave')%MODE_SEQUENCE.length))%MODE_SEQUENCE.length];
    const difficultyModel=getUrbanDifficultyModel({
      sectionIndex,distance:Math.abs(Number(startZ)||0),difficulty,speed,postMaxTime,mode,seed:runSeed||'unseeded'
    });
    const family=chooseFamily({sectionIndex,difficultyModel,districtProfile,pendingLanding});
    const sectionType=chooseSectionType({sectionIndex,family,difficulty,districtProfile,pendingLanding});
    const legacyType=chooseLegacyType(sectionType,family,{pendingLanding,lastLegacyType});
    const riskReward=riskPlan({family,difficultyModel,sectionIndex});
    landmarkCountdown--;
    const landmark=landmarkCountdown<=0||difficultyModel.mode==='LANDMARK';
    if(landmark)landmarkCountdown=11+Math.floor(random()*6);
    const routeBias=riskReward.enabled
      ?riskReward.side*clamp(.65+difficultyModel.routeCommitment*2.15,.65,2.8)
      :(random()<.5?-1:1)*difficultyModel.lateralRoutePressure*.9;
    const transition=Object.freeze({
      fromFamily:previousFamily,toFamily:family,
      fromDistrict:recentDistricts.at(-2)||district,toDistrict:district,
      districtChanged:(recentDistricts.at(-2)||district)!==district,
      landmark
    });
    const result=Object.freeze({
      sectionType,family,legacyType,district,districtProfile,difficulty:difficultyModel,
      riskReward,routeBias,transition,landmark:landmark?district+':'+family+':'+sectionIndex:null,
      opening:sectionIndex<OPENING_SCRIPT.length,
      environmentHooks:Object.freeze({
        propDensity:districtProfile.propDensity,buildingStyle:districtProfile.buildingStyle,
        roadMarkings:districtProfile.roadMarkings,railFrequency:districtProfile.railFrequency,
        lighting:districtProfile.lightingHook,atmosphere:districtProfile.atmosphereHook
      })
    });
    pushRecent(recentSections,sectionType,7);
    pushRecent(recentFamilies,family,5);
    previousFamily=family;
    return result;
  }

  function reset({seed:nextSeed=runSeed}={}){
    runSeed=nextSeed==null?null:String(nextSeed);
    random=runSeed==null?externalRandom:createSeededRandom(runSeed+'|urban-course-v2');
    recentSections=[];recentFamilies=[];recentDistricts=[];
    currentDistrict='DOWNTOWN';districtRemaining=0;previousFamily='RECOVERY_STREET';
    landmarkCountdown=10+(hash((runSeed||'run')+'|landmark')%5);
  }

  return {
    plan,reset,
    get recentSections(){return [...recentSections];},
    get recentFamilies(){return [...recentFamilies];},
    get recentDistricts(){return [...recentDistricts];},
    get district(){return currentDistrict;},
    get runSeed(){return runSeed;}
  };
}
