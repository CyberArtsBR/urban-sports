const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const URBAN_DISTRICTS=Object.freeze([
  'DOWNTOWN','COMMERCIAL','CONSTRUCTION','INDUSTRIAL','ENTERTAINMENT','EVENT'
]);

const R=[
  ['BOULEVARD_RUN',['OPEN CARVE','RECOVERY'],0,1,['DOWNTOWN','COMMERCIAL','ENTERTAINMENT'],28,48,.24,.05,.25,.24,.92,['MANUAL','SPEED'],['CURB_LINE'],1],
  ['CONSTRUCTION_WEAVE',['GATE','FOREST'],.05,1,['CONSTRUCTION','INDUSTRIAL'],30,46,.68,.08,.26,.74,.60,['NEAR_MISS'],['CONCRETE_BARRIER_EDGE']],
  ['BOLLARD_SLALOM',['GATE','ROCK SLALOM'],0,.86,['DOWNTOWN','COMMERCIAL','CONSTRUCTION'],28,43,.62,.03,.10,.65,.65,['NEAR_MISS'],[]],
  ['PARKED_CAR_GAP',['BANANA LINE','OPEN CARVE'],.08,.92,['COMMERCIAL','DOWNTOWN','ENTERTAINMENT'],30,47,.55,.05,.18,.48,.66,['GAP','NEAR_MISS','MANUAL'],['CURB_LINE'],1],
  ['DELIVERY_LANE_SQUEEZE',['GATE','FOREST'],.18,1,['COMMERCIAL','INDUSTRIAL'],32,50,.72,.04,.24,.70,.52,['NEAR_MISS'],['LOW_CURB']],
  ['LOADING_ZONE_RUN',['OPEN CARVE','BANANA LINE','RECOVERY'],0,1,['INDUSTRIAL','COMMERCIAL'],28,50,.34,.04,.52,.32,.82,['GRIND','MANUAL'],['LEDGE_LINE','LOW_CURB'],1],
  ['KICKER_LINE',['RAMP','LOG JUMP'],.10,1,['EVENT','ENTERTAINMENT','DOWNTOWN'],34,54,.38,.86,.34,.34,.75,['LARGE_AIR','JUMP','GRIND'],['POST_LANDING_RAIL']],
  ['DOUBLE_KICKER',['RAMP'],.56,1,['EVENT','ENTERTAINMENT'],42,62,.52,1,.20,.38,.68,['LARGE_AIR','JUMP'],[],0,0],
  ['STREET_RAMP',['RAMP','LOG JUMP'],0,1,['DOWNTOWN','COMMERCIAL','EVENT'],32,52,.34,.78,.20,.30,.78,['JUMP','LARGE_AIR'],[]],
  ['ROADWORK_TRANSFER',['RAMP','LOG JUMP'],.24,1,['CONSTRUCTION','INDUSTRIAL'],36,56,.48,.82,.52,.42,.68,['JUMP','GRIND','TECHNICAL_SEQUENCE'],['POST_LANDING_RAIL','CONCRETE_BARRIER_EDGE']],
  ['PLAZA_TRANSFER',['RAMP','OPEN CARVE'],.30,1,['DOWNTOWN','EVENT','ENTERTAINMENT'],35,55,.42,.70,.72,.32,.84,['JUMP','GRIND','MANUAL'],['PLAZA_LEDGE','POST_LANDING_RAIL'],1],
  ['CURB_LINE',['OPEN CARVE','BANANA LINE','RECOVERY'],0,.78,['DOWNTOWN','COMMERCIAL'],26,44,.28,0,.66,.28,.84,['GRIND','MANUAL'],['LOW_CURB','CURB_LINE'],1],
  ['LEDGE_LINE',['OPEN CARVE','BANANA LINE','ROCK SLALOM'],.16,1,['DOWNTOWN','COMMERCIAL','INDUSTRIAL'],30,48,.38,.03,.78,.36,.76,['GRIND','TECHNICAL_SEQUENCE'],['LEDGE_LINE','HIGH_CURB']],
  ['RAIL_LINE',['OPEN CARVE','GATE','ROCK SLALOM'],.24,1,['INDUSTRIAL','EVENT','ENTERTAINMENT'],32,50,.44,.04,.86,.38,.72,['GRIND','TECHNICAL_SEQUENCE'],['FLAT_RAIL','ROUND_RAIL']],
  ['HANDRAIL_RUN',['ROCK SLALOM','GATE'],.45,1,['DOWNTOWN','EVENT'],34,50,.52,.10,.92,.46,.66,['GRIND','TECHNICAL_SEQUENCE'],['SQUARE_RAIL','ROUND_RAIL']],
  ['BARRIER_GRIND',['FOREST','ROCK SLALOM','LOG JUMP'],.36,1,['CONSTRUCTION','INDUSTRIAL'],34,52,.54,.18,.82,.52,.62,['GRIND','NEAR_MISS'],['CONCRETE_BARRIER_EDGE']],
  ['STREET_CLOSURE',['GATE','FOREST'],.24,1,['CONSTRUCTION','DOWNTOWN'],32,46,.80,.08,.18,.78,.48,['LINE_CHOICE','NEAR_MISS'],[]],
  ['CONSTRUCTION_CHICANE',['GATE','ROCK SLALOM','FOREST'],.28,1,['CONSTRUCTION','INDUSTRIAL'],34,50,.84,.08,.22,.80,.46,['LINE_CHOICE','NEAR_MISS'],['LOW_CURB']],
  ['ALLEY_SQUEEZE',['FOREST','ROCK SLALOM'],.42,1,['DOWNTOWN','INDUSTRIAL'],35,49,.88,.02,.34,.72,.42,['TECHNICAL_SEQUENCE','NEAR_MISS'],['LEDGE_LINE']],
  ['BUS_STOP_GAP',['BANANA LINE','OPEN CARVE'],.20,.90,['COMMERCIAL','DOWNTOWN'],30,47,.46,.10,.44,.42,.70,['GAP','GRIND'],['BENCH_EDGE','CURB_LINE']],
  ['MEDIAN_TRANSFER',['ROCK SLALOM','RAMP'],.35,1,['DOWNTOWN','COMMERCIAL'],35,54,.58,.46,.48,.46,.64,['JUMP','GRIND','LINE_CHOICE'],['HIGH_CURB','LEDGE_LINE']],
  ['UTILITY_ZONE',['FOREST','BANANA LINE'],.12,.92,['INDUSTRIAL','CONSTRUCTION'],28,45,.56,.03,.36,.58,.62,['NEAR_MISS','GRIND'],['LOW_CURB']],
  ['EVENT_SECTION',['OPEN CARVE','GATE','RAMP'],.25,1,['EVENT','ENTERTAINMENT'],32,54,.44,.42,.76,.42,.76,['JUMP','GRIND','LARGE_AIR'],['EVENT_RAIL','PLAZA_LEDGE']],
  ['NIGHTLIFE_STRAIGHT',['RECOVERY','OPEN CARVE'],.10,1,['ENTERTAINMENT','DOWNTOWN'],30,56,.24,.02,.34,.24,.90,['SPEED','MANUAL'],['CURB_LINE'],1],
  ['INDUSTRIAL_RUN',['OPEN CARVE','FOREST','RECOVERY'],.16,1,['INDUSTRIAL'],30,52,.42,.04,.62,.46,.72,['GRIND','MANUAL'],['FLAT_RAIL','LEDGE_LINE'],1],
  ['TECHNICAL_STREET_LINE',['ROCK SLALOM','FOREST','GATE'],.56,1,['DOWNTOWN','INDUSTRIAL','EVENT'],36,54,.82,.12,.88,.74,.48,['GRIND','TECHNICAL_SEQUENCE','LINE_CHOICE'],['SQUARE_RAIL','LEDGE_LINE']],
  ['SPEED_BOULEVARD',['OPEN CARVE','RECOVERY'],.34,1,['DOWNTOWN','ENTERTAINMENT'],38,66,.30,.02,.20,.24,.94,['SPEED','MANUAL'],['CURB_LINE'],1],
  ['MIXED_TRICK_LINE',['RAMP','LOG JUMP','ROCK SLALOM'],.58,1,['EVENT','ENTERTAINMENT','INDUSTRIAL'],38,58,.62,.72,.92,.56,.60,['JUMP','GRIND','TECHNICAL_SEQUENCE','LARGE_AIR'],['POST_LANDING_RAIL','EVENT_RAIL','LEDGE_LINE']]
];

function make(row){
  const [id,families,dmin,dmax,districts,minSpeed,recSpeed,lane,jump,grind,density,width,opps,patterns,manual=0,active=1]=row;
  return Object.freeze({
    id,name:id.replaceAll('_',' '),legacyFamilies:Object.freeze(families),
    difficulty:Object.freeze({min:dmin,max:dmax}),districtAffinity:Object.freeze(districts),
    minimumSpeed:minSpeed,recommendedSpeed:recSpeed,lanePressure:lane,jumpIntensity:jump,
    grindIntensity:grind,obstacleDensity:density,routeWidth:width,
    specialOpportunities:Object.freeze(opps),grindPatterns:Object.freeze(patterns),
    manualFriendly:!!manual,active:active!==0
  });
}

export const URBAN_SECTION_CATALOG=Object.freeze(Object.fromEntries(R.map(row=>[row[0],make(row)])));
export const URBAN_SECTION_TYPES=Object.freeze(R.map(row=>row[0]));
export const ACTIVE_URBAN_SECTION_TYPES=Object.freeze(URBAN_SECTION_TYPES.filter(id=>URBAN_SECTION_CATALOG[id].active));

function hash(value){
  const text=String(value??'');
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}

export function getUrbanSectionDefinition(id){return URBAN_SECTION_CATALOG[id]||null;}

export function listUrbanSectionsForLegacyType(legacyType,{difficulty=0,district=null}={}){
  const d=clamp(Number(difficulty)||0,0,1);
  const normalized=String(district||'').toUpperCase();
  let choices=ACTIVE_URBAN_SECTION_TYPES.map(id=>URBAN_SECTION_CATALOG[id]).filter(def=>
    def.legacyFamilies.includes(legacyType)&&d>=def.difficulty.min&&d<=def.difficulty.max
  );
  if(!choices.length){
    choices=ACTIVE_URBAN_SECTION_TYPES.map(id=>URBAN_SECTION_CATALOG[id]).filter(def=>def.legacyFamilies.includes(legacyType));
  }
  if(!choices.length)choices=[URBAN_SECTION_CATALOG.BOULEVARD_RUN];
  if(normalized){
    const affinity=choices.filter(def=>def.districtAffinity.includes(normalized));
    if(affinity.length)choices=affinity;
  }
  return choices;
}

export function selectUrbanSection({
  legacyType,sectionIndex=0,difficulty=0,speed=0,runPhase='',runSeed='',district=null,previousUrbanType=''
}={}){
  const choices=listUrbanSectionsForLegacyType(legacyType,{difficulty,district});
  if(choices.length===1)return choices[0];
  const key=[runSeed||'unseeded',legacyType,Math.trunc(sectionIndex),Math.round(clamp(Number(difficulty)||0,0,1)*20),
    Math.round((Number(speed)||0)*.25),runPhase||'',district||''].join('|');
  let index=hash(key)%choices.length;
  if(choices[index]?.id===previousUrbanType&&choices.length>1){
    index=(index+1+(hash(key+'|reroll')%(choices.length-1)))%choices.length;
  }
  return choices[index];
}

export function makeUrbanSectionMetadata(definition,{
  sectionId,legacyType,length,speed,difficulty,district=null,safeRoute=null
}={}){
  const def=definition||URBAN_SECTION_CATALOG.BOULEVARD_RUN;
  return Object.freeze({
    id:sectionId,type:def.id,name:def.name,legacyType,length:Number(length)||0,
    difficulty:clamp(Number(difficulty)||0,0,1),districtAffinity:def.districtAffinity,
    requestedDistrict:district?String(district).toUpperCase():null,
    minimumSpeed:def.minimumSpeed,recommendedSpeed:def.recommendedSpeed,
    generatedSpeed:Number(speed)||0,lanePressure:def.lanePressure,jumpIntensity:def.jumpIntensity,
    grindIntensity:def.grindIntensity,obstacleDensity:def.obstacleDensity,routeWidth:def.routeWidth,
    specialOpportunities:def.specialOpportunities,grindPatterns:def.grindPatterns,
    manualFriendly:def.manualFriendly,safeRoute:safeRoute?Object.freeze({...safeRoute}):null
  });
}
