const freezeRange=value=>Object.freeze([...value]);
const freezePalette=value=>Object.freeze([...value]);

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
    windowPalette:freezePalette(config.windowPalette)
  });
}

export const URBAN_DISTRICT_PRESETS=Object.freeze({
  mixed:preset({
    id:'mixed',
    label:'Mixed City Core',
    height:[12,38],
    width:[8.5,14.5],
    depth:[7.5,14.5],
    setbacks:{near:[1.2,4.2],mid:[6.5,12.5],far:[17,29]},
    layerWeights:[.50,.31,.19],
    bodyPalette:[0x556371,0x7a665f,0x596957,0x6f7182,0x765f72,0x64727a],
    windowPalette:[0xffc875,0xcbe7ff,0xf2ead8,0x9fdcff],
    heightScale:1,
    widthScale:1,
    storefrontScale:1,
    roofScale:1,
    windowBrightness:.92
  }),
  downtown:preset({
    id:'downtown',
    label:'Downtown',
    height:[20,58],
    width:[8.5,15.5],
    depth:[8,16],
    setbacks:{near:[1.8,5],mid:[7,14],far:[18,32]},
    layerWeights:[.34,.36,.30],
    bodyPalette:[0x485563,0x596574,0x6a7077,0x4e5967,0x625e64],
    windowPalette:[0xd8ecff,0xaedbff,0xffd49a,0xe8f4ff],
    heightScale:1.18,
    widthScale:.94,
    storefrontScale:.72,
    roofScale:1.2,
    windowBrightness:.9
  }),
  shopping:preset({
    id:'shopping',
    label:'Shopping District',
    height:[8,25],
    width:[8,13.5],
    depth:[7,12],
    setbacks:{near:[.7,3.1],mid:[5,9],far:[14,22]},
    layerWeights:[.66,.24,.10],
    bodyPalette:[0x9a6656,0x597b84,0x8b7658,0x796183,0x66805f,0xa16e7b],
    windowPalette:[0xffc86d,0xffe6b8,0xb8e8ff,0xffb6de],
    heightScale:.82,
    widthScale:1.04,
    storefrontScale:1.22,
    roofScale:.82,
    windowBrightness:1
  }),
  industrial:preset({
    id:'industrial',
    label:'Industrial / Construction',
    height:[7,22],
    width:[10.5,18],
    depth:[9,18],
    setbacks:{near:[1.8,5.2],mid:[7,13],far:[16,26]},
    layerWeights:[.57,.30,.13],
    bodyPalette:[0x6d675d,0x5f6668,0x72584e,0x59605b,0x7a7468],
    windowPalette:[0xffcf8d,0xd5e0e7,0xa9d8e8,0xf4ead6],
    heightScale:.72,
    widthScale:1.16,
    storefrontScale:.58,
    roofScale:1.28,
    windowBrightness:.78
  }),
  neon:preset({
    id:'neon',
    label:'Neon Entertainment',
    height:[12,38],
    width:[7.5,13.5],
    depth:[7.5,14],
    setbacks:{near:[1,3.5],mid:[5.5,10.5],far:[15,25]},
    layerWeights:[.55,.29,.16],
    bodyPalette:[0x313846,0x42394d,0x273c46,0x493946,0x353a43],
    windowPalette:[0x79dcff,0xff72cf,0x8d87ff,0xffba68],
    heightScale:1,
    widthScale:.94,
    storefrontScale:1.18,
    roofScale:1.08,
    windowBrightness:1.08
  }),
  waterfront:preset({
    id:'waterfront',
    label:'Waterfront / Modern',
    height:[13,35],
    width:[9,16],
    depth:[8,14],
    setbacks:{near:[2.2,6],mid:[8,15],far:[20,34]},
    layerWeights:[.40,.35,.25],
    bodyPalette:[0x6b7885,0x87909a,0x596c78,0x7b827f,0x667b86],
    windowPalette:[0xc4edff,0xe7f6ff,0xa9d9ef,0xffdfad],
    heightScale:.98,
    widthScale:1.04,
    storefrontScale:.72,
    roofScale:.92,
    windowBrightness:.88
  })
});

const ALIASES=Object.freeze({
  default:'mixed',
  city:'mixed',
  urban:'mixed',
  core:'mixed',
  retail:'shopping',
  entertainment:'neon',
  construction:'industrial',
  modern:'waterfront'
});

function clonePreset(source){
  return {
    ...source,
    height:[...source.height],
    width:[...source.width],
    depth:[...source.depth],
    setbacks:{
      near:[...source.setbacks.near],
      mid:[...source.setbacks.mid],
      far:[...source.setbacks.far]
    },
    layerWeights:[...source.layerWeights],
    bodyPalette:[...source.bodyPalette],
    windowPalette:[...source.windowPalette]
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
  const baseName=ALIASES[String(value.base||value.id||'mixed').toLowerCase()]||String(value.base||value.id||'mixed').toLowerCase();
  const base=clonePreset(URBAN_DISTRICT_PRESETS[baseName]||URBAN_DISTRICT_PRESETS.mixed);
  const merged={...base,...value};
  merged.id=String(value.id||base.id);
  merged.height=Array.isArray(value.height)?[...value.height]:base.height;
  merged.width=Array.isArray(value.width)?[...value.width]:base.width;
  merged.depth=Array.isArray(value.depth)?[...value.depth]:base.depth;
  merged.layerWeights=Array.isArray(value.layerWeights)?[...value.layerWeights]:base.layerWeights;
  merged.bodyPalette=Array.isArray(value.bodyPalette)?[...value.bodyPalette]:base.bodyPalette;
  merged.windowPalette=Array.isArray(value.windowPalette)?[...value.windowPalette]:base.windowPalette;
  merged.setbacks={
    near:Array.isArray(value.setbacks?.near)?[...value.setbacks.near]:base.setbacks.near,
    mid:Array.isArray(value.setbacks?.mid)?[...value.setbacks.mid]:base.setbacks.mid,
    far:Array.isArray(value.setbacks?.far)?[...value.setbacks.far]:base.setbacks.far
  };
  return merged;
}
