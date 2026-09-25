const freezeRange=value=>Object.freeze([...value]);
const freezePalette=value=>Object.freeze([...value]);
const freezeList=value=>Object.freeze([...(value||[])]);

function preset(config){
  return Object.freeze({
    ...config,
    height:freezeRange(config.height),
    width:freezeRange(config.width),
    depth:freezeRange(config.depth),
    setbacks:Object.freeze({
      near:freezeRange(config.setbacks.near),
      mid:freezeRange(config.setbacks.mid),
      far:freezeRange(config.setbacks.far)
    }),
    layerWeights:freezeRange(config.layerWeights),
    bodyPalette:freezePalette(config.bodyPalette),
    windowPalette:freezePalette(config.windowPalette),
    lightingPalette:freezePalette(config.lightingPalette||config.windowPalette),
    architectureCycle:freezeList(config.architectureCycle),
    roadsideMix:freezeList(config.roadsideMix)
  });
}

export const URBAN_DISTRICT_PRESETS=Object.freeze({
  mixed:preset({
    id:'mixed',label:'Mixed City Core',
    height:[12,38],width:[8.5,14.5],depth:[7.5,14.5],
    setbacks:{near:[1.2,4.2],mid:[6.5,12.5],far:[17,29]},layerWeights:[.50,.31,.19],
    bodyPalette:[0x556371,0x7a665f,0x596957,0x6f7182,0x765f72,0x64727a],
    windowPalette:[0xffc875,0xcbe7ff,0xf2ead8,0x9fdcff],lightingPalette:[0xffc875,0x9fdcff,0xffe8c1],
    architectureCycle:['mixed-use','brick-loft','hotel-stack','office-tower'],
    roadsideMix:['parking','storefront','downtown','utility'],
    heightScale:1,widthScale:1,storefrontScale:1,roofScale:1,windowBrightness:.92,
    heroVehicleBias:.72,signageScale:1,constructionIntensity:.25
  }),
  downtown:preset({
    id:'downtown',label:'Downtown',
    height:[20,58],width:[8.5,15.5],depth:[8,16],
    setbacks:{near:[1.8,5],mid:[7,14],far:[18,32]},layerWeights:[.34,.36,.30],
    bodyPalette:[0x485563,0x596574,0x6a7077,0x4e5967,0x625e64],
    windowPalette:[0xd8ecff,0xaedbff,0xffd49a,0xe8f4ff],lightingPalette:[0xc8e7ff,0xffd49a,0xe8f4ff],
    architectureCycle:['office-tower','glass-crown','hotel-stack','mixed-use'],
    roadsideMix:['downtown','parking','transit','clean'],
    heightScale:1.18,widthScale:.94,storefrontScale:.72,roofScale:1.2,windowBrightness:.9,
    heroVehicleBias:.86,signageScale:.82,constructionIntensity:.12
  }),
  commercial:preset({
    id:'commercial',label:'Commercial Avenue',
    height:[8,28],width:[8,14],depth:[7,12.5],
    setbacks:{near:[.7,3.0],mid:[5,9.5],far:[14,23]},layerWeights:[.66,.24,.10],
    bodyPalette:[0x9a6656,0x597b84,0x8b7658,0x796183,0x66805f,0xa16e7b],
    windowPalette:[0xffc86d,0xffe6b8,0xb8e8ff,0xffb6de],lightingPalette:[0xffc86d,0xffb6de,0xb8e8ff],
    architectureCycle:['mixed-use','brick-loft','hotel-stack','entertainment'],
    roadsideMix:['storefront','parking','downtown','transit'],
    heightScale:.84,widthScale:1.05,storefrontScale:1.35,roofScale:.86,windowBrightness:1,
    heroVehicleBias:.90,signageScale:1.35,constructionIntensity:.10
  }),
  construction:preset({
    id:'construction',label:'Construction Corridor',
    height:[7,24],width:[10,18],depth:[9,18],
    setbacks:{near:[1.5,5],mid:[7,13],far:[16,27]},layerWeights:[.58,.29,.13],
    bodyPalette:[0x777064,0x666d70,0x7c5f52,0x646a65,0x858074],
    windowPalette:[0xffcf8d,0xd5e0e7,0xa9d8e8,0xf4ead6],lightingPalette:[0xffb85f,0xe4eef3],
    architectureCycle:['industrial-service','brick-loft','mixed-use'],
    roadsideMix:['construction','utility','parking','clean'],
    heightScale:.76,widthScale:1.14,storefrontScale:.48,roofScale:1.35,windowBrightness:.76,
    heroVehicleBias:.56,signageScale:1.18,constructionIntensity:1
  }),
  industrial:preset({
    id:'industrial',label:'Industrial Service District',
    height:[7,23],width:[11,19],depth:[10,19],
    setbacks:{near:[2,5.7],mid:[7.5,14],far:[17,28]},layerWeights:[.55,.31,.14],
    bodyPalette:[0x5f6668,0x625d55,0x72584e,0x59605b,0x747066],
    windowPalette:[0xffd59b,0xc9d7dd,0xa9cad7,0xe7dfcf],lightingPalette:[0xffc27a,0xc8d9df],
    architectureCycle:['industrial-service','brick-loft','mixed-use'],
    roadsideMix:['utility','construction','parking','clean'],
    heightScale:.70,widthScale:1.20,storefrontScale:.44,roofScale:1.42,windowBrightness:.70,
    heroVehicleBias:.68,signageScale:.72,constructionIntensity:.72
  }),
  entertainment:preset({
    id:'entertainment',label:'Entertainment / Nightlife',
    height:[12,40],width:[7.5,13.5],depth:[7.5,14],
    setbacks:{near:[1,3.5],mid:[5.5,10.5],far:[15,25]},layerWeights:[.55,.29,.16],
    bodyPalette:[0x313846,0x42394d,0x273c46,0x493946,0x353a43],
    windowPalette:[0x79dcff,0xff72cf,0x8d87ff,0xffba68],lightingPalette:[0x79dcff,0xff72cf,0xffba68,0x8d87ff],
    architectureCycle:['entertainment','glass-crown','hotel-stack','mixed-use'],
    roadsideMix:['storefront','downtown','transit','parking'],
    heightScale:1,widthScale:.94,storefrontScale:1.24,roofScale:1.10,windowBrightness:1.08,
    heroVehicleBias:.94,signageScale:1.48,constructionIntensity:.08
  }),
  event:preset({
    id:'event',label:'Event District',
    height:[10,34],width:[9,15],depth:[8,14.5],
    setbacks:{near:[1.4,4.2],mid:[6,11],far:[16,26]},layerWeights:[.54,.30,.16],
    bodyPalette:[0x49545e,0x5e626d,0x4f5862,0x69595f,0x56656b],
    windowPalette:[0xe9f5ff,0xffcc78,0x7de8ff,0xff82b7],lightingPalette:[0x7de8ff,0xffcc78,0xff82b7],
    architectureCycle:['entertainment','mixed-use','office-tower','glass-crown'],
    roadsideMix:['transit','storefront','downtown','clean'],
    heightScale:.94,widthScale:1.02,storefrontScale:1.12,roofScale:1.18,windowBrightness:1.02,
    heroVehicleBias:.88,signageScale:1.55,constructionIntensity:.20
  })
});

export const URBAN_DISTRICT_PROGRESSION=Object.freeze([
  'downtown','commercial','construction','industrial','entertainment','event'
]);

const ALIASES=Object.freeze({
  default:'mixed',city:'mixed',urban:'mixed',core:'mixed',
  shopping:'commercial',retail:'commercial',
  neon:'entertainment',nightlife:'entertainment',
  modern:'downtown',waterfront:'downtown',
  roadworks:'construction',factory:'industrial',
  competition:'event',festival:'event'
});

function clonePreset(source){
  return {
    ...source,
    height:[...source.height],width:[...source.width],depth:[...source.depth],
    setbacks:{near:[...source.setbacks.near],mid:[...source.setbacks.mid],far:[...source.setbacks.far]},
    layerWeights:[...source.layerWeights],
    bodyPalette:[...source.bodyPalette],windowPalette:[...source.windowPalette],
    lightingPalette:[...source.lightingPalette],
    architectureCycle:[...source.architectureCycle],
    roadsideMix:[...source.roadsideMix]
  };
}

export function listUrbanDistricts(){
  return Object.keys(URBAN_DISTRICT_PRESETS);
}

export function resolveUrbanDistrict(value='mixed'){
  if(typeof value==='string'){
    const key=ALIASES[value.toLowerCase()]||value.toLowerCase();
    return clonePreset(URBAN_DISTRICT_PRESETS[key]||URBAN_DISTRICT_PRESETS.mixed);
  }
  if(!value||typeof value!=='object')return clonePreset(URBAN_DISTRICT_PRESETS.mixed);
  const requested=String(value.base||value.id||'mixed').toLowerCase();
  const baseName=ALIASES[requested]||requested;
  const base=clonePreset(URBAN_DISTRICT_PRESETS[baseName]||URBAN_DISTRICT_PRESETS.mixed);
  const merged={...base,...value};
  merged.id=String(value.id||base.id);
  for(const key of ['height','width','depth','layerWeights','bodyPalette','windowPalette','lightingPalette','architectureCycle','roadsideMix']){
    merged[key]=Array.isArray(value[key])?[...value[key]]:[...base[key]];
  }
  merged.setbacks={
    near:Array.isArray(value.setbacks?.near)?[...value.setbacks.near]:base.setbacks.near,
    mid:Array.isArray(value.setbacks?.mid)?[...value.setbacks.mid]:base.setbacks.mid,
    far:Array.isArray(value.setbacks?.far)?[...value.setbacks.far]:base.setbacks.far
  };
  return merged;
}

export function advanceUrbanDistrict(current='downtown',steps=1){
  const resolved=resolveUrbanDistrict(current);
  const currentIndex=URBAN_DISTRICT_PROGRESSION.indexOf(resolved.id);
  const start=currentIndex>=0?currentIndex:0;
  const amount=Number.isFinite(Number(steps))?Math.trunc(Number(steps)):1;
  const size=URBAN_DISTRICT_PROGRESSION.length;
  const index=((start+amount)%size+size)%size;
  return resolveUrbanDistrict(URBAN_DISTRICT_PROGRESSION[index]);
}

export function selectUrbanDistrictForDistance(distance=0,segmentLength=720,offset=0){
  const safeLength=Math.max(120,Number(segmentLength)||720);
  const safeDistance=Math.max(0,Number(distance)||0);
  const safeOffset=Number.isFinite(Number(offset))?Math.trunc(Number(offset)):0;
  const segment=Math.floor(safeDistance/safeLength)+safeOffset;
  const size=URBAN_DISTRICT_PROGRESSION.length;
  const index=((segment%size)+size)%size;
  return resolveUrbanDistrict(URBAN_DISTRICT_PROGRESSION[index]);
}
