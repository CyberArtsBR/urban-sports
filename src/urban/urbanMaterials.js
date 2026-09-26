import * as THREE from 'three';

const ASPHALT_TEXTURE_SIZE=1024;
const ANISOTROPY_TARGET=Object.freeze({'max-cinematic':8,max:16,high:8,medium:4,low:2});
let asphaltSourceCache=null;

function qualityName(value='high'){
  const name=String(value?.profile??value??'high').toLowerCase();
  return Object.hasOwn(ANISOTROPY_TARGET,name)?name:'high';
}
function maxAnisotropy(renderer){
  const getMax=renderer?.capabilities?.getMaxAnisotropy;
  if(typeof getMax!=='function')return 1;
  return Math.max(1,getMax.call(renderer.capabilities)||1);
}
function textureAnisotropy(renderer,quality='high'){
  const explicit=Number(quality?.roadTextureAnisotropy);
  const target=Number.isFinite(explicit)&&explicit>0?explicit:ANISOTROPY_TARGET[qualityName(quality)];
  return Math.max(1,Math.min(target,maxAnisotropy(renderer)));
}

function configureRoadTexture(texture,renderer,quality='high'){
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(4,8);
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=textureAnisotropy(renderer,quality);
  texture.needsUpdate=true;
  return texture;
}

function hash2(x,y,seed=0){
  let n=Math.imul((x|0)^seed,374761393)^Math.imul((y|0)+seed,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}
function smooth(value){return value*value*(3-2*value);}
function periodicNoise(x,y,cell,size,seed){
  const period=Math.max(2,Math.floor(size/cell));
  const fx=x/cell,fy=y/cell;
  const ix=Math.floor(fx),iy=Math.floor(fy);
  const tx=smooth(fx-ix),ty=smooth(fy-iy);
  const wrap=value=>((value%period)+period)%period;
  const a=hash2(wrap(ix),wrap(iy),seed);
  const b=hash2(wrap(ix+1),wrap(iy),seed);
  const c=hash2(wrap(ix),wrap(iy+1),seed);
  const d=hash2(wrap(ix+1),wrap(iy+1),seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,tx),THREE.MathUtils.lerp(c,d,tx),ty);
}
function lanePolish(x,size){
  const u=x/size;
  const centers=[.22,.38,.62,.78];
  let strength=0;
  for(const center of centers){
    const distance=Math.abs(u-center);
    strength=Math.max(strength,Math.max(0,1-distance/.035));
  }
  return strength;
}

function createAsphaltSource(size=ASPHALT_TEXTURE_SIZE){
  const colorData=new Uint8Array(size*size*4);
  const roughnessData=new Uint8Array(size*size*4);
  const bumpData=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const broad=periodicNoise(x,y,192,size,17);
    const medium=periodicNoise(x,y,67,size,29);
    const aggregate=periodicNoise(x,y,13,size,43);
    const micro=periodicNoise(x,y,4,size,71);
    const patchNoise=periodicNoise(x,y,257,size,97);
    const crackNoise=periodicNoise(x,y,49,size,113);
    const lane=lanePolish(x,size);
    const crack=(Math.abs(crackNoise-.5)<.010&&medium>.54)?1:0;
    const hairline=(Math.abs(periodicNoise(x,y,23,size,191)-.5)<.006&&aggregate>.57)?1:0;
    const repaired=patchNoise>.72&&medium>.49;
    const repairSeam=repaired&&(x%173<3||y%211<3);
    const aggregatePebble=(aggregate>.80?1:0)+(micro>.90?1:0);
    const contamination=(hash2(x>>3,y>>3,239)>.986)?1:0;

    let base=62+(broad-.5)*15+(medium-.5)*10+(aggregate-.5)*7+(micro-.5)*4;
    base-=aggregatePebble*3+crack*17+hairline*8;
    if(repaired)base-=5;
    if(repairSeam)base-=10;
    base+=lane*2-contamination*5;
    const value=Math.max(31,Math.min(98,Math.round(base)));
    colorData[i]=Math.max(0,value-2);
    colorData[i+1]=value;
    colorData[i+2]=Math.min(255,value+2);
    colorData[i+3]=255;

    let rough=238+(aggregate-.5)*16+(micro-.5)*10-crack*4-hairline*2;
    rough-=lane*18;
    if(repaired)rough-=7;
    if(contamination)rough-=12;
    rough=Math.max(196,Math.min(252,Math.round(rough)));
    roughnessData[i]=roughnessData[i+1]=roughnessData[i+2]=rough;
    roughnessData[i+3]=255;

    let height=127+(aggregate-.5)*46+(micro-.5)*29-crack*62-hairline*35;
    if(repairSeam)height-=36;
    height=Math.max(46,Math.min(210,Math.round(height)));
    bumpData[i]=bumpData[i+1]=bumpData[i+2]=height;
    bumpData[i+3]=255;
  }
  return {colorData,roughnessData,bumpData,size};
}
function asphaltSource(){
  asphaltSourceCache??=createAsphaltSource();
  return asphaltSourceCache;
}
function makeDataTexture(data,size,renderer,quality,{srgb=false}={}){
  const texture=configureRoadTexture(new THREE.DataTexture(data,size,size,THREE.RGBAFormat),renderer,quality);
  if(srgb)texture.colorSpace=THREE.SRGBColorSpace;
  texture.userData.proceduralRoadDetail='2k-class-tiled-density';
  return texture;
}
function makeAsphaltTextures(renderer,quality){
  const source=asphaltSource();
  const map=makeDataTexture(source.colorData,source.size,renderer,quality,{srgb:true});
  const roughnessMap=makeDataTexture(source.roughnessData,source.size,renderer,quality);
  const bumpMap=makeDataTexture(source.bumpData,source.size,renderer,quality);
  return {map,roughnessMap,bumpMap};
}

function makeFacadeTextures(renderer,quality){
  const size=128;
  const colorData=new Uint8Array(size*size*4);
  const roughnessData=new Uint8Array(size*size*4);
  const bumpData=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const broad=periodicNoise(x,y,31,size,211);
    const fine=periodicNoise(x,y,7,size,223);
    const vertical=(x%32<2)?-.10:0;
    const floor=(y%24<2)?-.08:0;
    const brick=((y%16<2)||((x+((y>>4)&1)*8)%24<2))?-.065:0;
    const water=Math.max(0,.55-periodicNoise(x,y,19,size,251))*(y/size)*.10;
    const grime=Math.pow(1-y/(size-1),3)*.14;
    const neutral=Math.max(.56,Math.min(.98,.84+(broad-.5)*.12+(fine-.5)*.045+vertical+floor+brick-water-grime));
    const value=Math.round(neutral*255);
    colorData[i]=colorData[i+1]=colorData[i+2]=value;colorData[i+3]=255;
    const rough=Math.round(Math.max(.66,Math.min(.98,.86+(fine-.5)*.12+grime))*255);
    roughnessData[i]=roughnessData[i+1]=roughnessData[i+2]=rough;roughnessData[i+3]=255;
    const height=Math.round(Math.max(.28,Math.min(.76,.52+(fine-.5)*.18-vertical*.65-floor*.55-brick*.45))*255);
    bumpData[i]=bumpData[i+1]=bumpData[i+2]=height;bumpData[i+3]=255;
  }
  const setup=(texture,{srgb=false}={})=>{
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(2.2,4.8);
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.anisotropy=textureAnisotropy(renderer,quality);texture.needsUpdate=true;
    if(srgb)texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  };
  return {
    map:setup(new THREE.DataTexture(colorData,size,size,THREE.RGBAFormat),{srgb:true}),
    roughnessMap:setup(new THREE.DataTexture(roughnessData,size,size,THREE.RGBAFormat)),
    bumpMap:setup(new THREE.DataTexture(bumpData,size,size,THREE.RGBAFormat))
  };
}

function makeLightPoolTexture(){
  const size=64;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=(x+.5)/size*2-1;
    const ny=(y+.5)/size*2-1;
    const radial=Math.max(0,1-(nx*nx+ny*ny));
    const alpha=Math.round(Math.pow(radial,2.4)*255);
    const i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=255;
    data[i+3]=alpha;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.needsUpdate=true;
  return texture;
}

function makeSidewalkTexture(renderer,quality){
  const size=128;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const seam=(x%32<2||y%32<2)?-17:0;
    const grain=((x*7+y*11+x*y)%17)-8;
    const value=Math.max(82,Math.min(158,128+seam+grain));
    data[i]=value;
    data[i+1]=value;
    data[i+2]=value+2;
    data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(2,4);
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=textureAnisotropy(renderer,quality);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

export function createUrbanMaterials({renderer=null,quality='high'}={}){
  const {map:asphaltMap,roughnessMap:asphaltRoughnessMap,bumpMap:asphaltBumpMap}=makeAsphaltTextures(renderer,quality);
  const sidewalkMap=makeSidewalkTexture(renderer,quality);
  const {map:facadeMap,roughnessMap:facadeRoughnessMap,bumpMap:facadeBumpMap}=makeFacadeTextures(renderer,quality);
  const lightPoolMap=makeLightPoolTexture();
  const facadeBase={map:facadeMap,roughnessMap:facadeRoughnessMap,bumpMap:facadeBumpMap,vertexColors:true};

  const materials={
    asphalt:new THREE.MeshPhysicalMaterial({
      color:0xb9bdc0,map:asphaltMap,roughnessMap:asphaltRoughnessMap,bumpMap:asphaltBumpMap,
      roughness:.95,metalness:0,bumpScale:.034,
      clearcoat:0,clearcoatRoughness:1,envMapIntensity:.12
    }),
    roadRepair:new THREE.MeshStandardMaterial({
      color:0x35393b,roughness:.90,metalness:0,transparent:true,opacity:.78,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
    }),
    roadCrack:new THREE.MeshBasicMaterial({
      color:0x151719,transparent:true,opacity:.68,depthWrite:false,toneMapped:true,
      polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
    }),
    roadSkid:new THREE.MeshStandardMaterial({
      color:0x17191a,roughness:.72,metalness:0,transparent:true,opacity:.42,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
    }),
    roadDamp:new THREE.MeshPhysicalMaterial({
      color:0x252a2d,roughness:.72,metalness:0,clearcoat:.06,clearcoatRoughness:.46,
      envMapIntensity:.30,transparent:true,opacity:0,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4
    }),
    roadPuddle:new THREE.MeshPhysicalMaterial({
      color:0x1d2529,roughness:.24,metalness:0,clearcoat:.44,clearcoatRoughness:.16,
      envMapIntensity:.70,transparent:true,opacity:0,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5
    }),
    roadDrain:new THREE.MeshStandardMaterial({color:0x23272b,roughness:.62,metalness:.72}),
    roadGrime:new THREE.MeshStandardMaterial({
      color:0x403a33,roughness:.96,metalness:0,transparent:true,opacity:.34,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
    }),
    sidewalk:new THREE.MeshStandardMaterial({
      color:0xa8aaab,map:sidewalkMap,roughness:.92,metalness:0
    }),
    curb:new THREE.MeshStandardMaterial({color:0xc8c8c3,roughness:.88,metalness:0}),
    marking:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),
    metal:new THREE.MeshStandardMaterial({color:0x283039,roughness:.58,metalness:.62}),
    darkMetal:new THREE.MeshStandardMaterial({color:0x171c22,roughness:.55,metalness:.7}),
    lamp:new THREE.MeshStandardMaterial({
      color:0xffd59a,roughness:.22,metalness:.05,emissive:0xff9d36,emissiveIntensity:.42,
      toneMapped:true
    }),
    streetlightPool:new THREE.MeshBasicMaterial({
      color:0xffd59a,map:lightPoolMap,transparent:true,opacity:0,depthWrite:false,
      blending:THREE.NormalBlending,toneMapped:true,polygonOffset:true,
      polygonOffsetFactor:-2,polygonOffsetUnits:-2
    }),
    building:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xffffff,roughness:.82,metalness:.04,bumpScale:.018
    }),
    facadeConcrete:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xf0f1ef,roughness:.88,metalness:.02,bumpScale:.022
    }),
    facadeBrick:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xe1c5b5,roughness:.92,metalness:0,bumpScale:.030
    }),
    facadeGlass:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xd7e6ed,roughness:.38,metalness:.18,bumpScale:.008,envMapIntensity:.42
    }),
    facadeCommercial:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xf0e3d7,roughness:.72,metalness:.05,bumpScale:.018
    }),
    facadeIndustrial:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xcfd0ca,roughness:.86,metalness:.10,bumpScale:.025
    }),
    facadeResidential:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xe5e0da,roughness:.80,metalness:.03,bumpScale:.018
    }),
    facadeEntertainment:new THREE.MeshStandardMaterial({
      ...facadeBase,color:0xd8dce3,roughness:.60,metalness:.10,bumpScale:.012,envMapIntensity:.30
    }),
    rooftop:new THREE.MeshStandardMaterial({color:0x333b45,roughness:.78,metalness:.12}),
    windows:new THREE.MeshBasicMaterial({
      color:new THREE.Color(1.10,1.10,1.10),
      transparent:true,opacity:.72,depthWrite:false,toneMapped:true,vertexColors:true
    }),
    buildingLed:new THREE.MeshBasicMaterial({
      color:new THREE.Color(1.55,1.55,1.55),
      toneMapped:true,vertexColors:true
    }),
    cone:new THREE.MeshStandardMaterial({color:0xff6a16,roughness:.48,metalness:0}),
    coneStripe:new THREE.MeshStandardMaterial({
      color:0xf4f4e8,roughness:.35,metalness:.02,emissive:0x242420,emissiveIntensity:.08
    }),
    barrier:new THREE.MeshStandardMaterial({color:0xf08a24,roughness:.55,metalness:.03}),
    sign:new THREE.MeshStandardMaterial({color:0x2b76b8,roughness:.42,metalness:.08}),
    planter:new THREE.MeshStandardMaterial({color:0x5b5550,roughness:.88,metalness:0}),
    foliage:new THREE.MeshStandardMaterial({color:0x315f42,roughness:.9,metalness:0,flatShading:true}),
    utility:new THREE.MeshStandardMaterial({color:0x515962,roughness:.72,metalness:.18}),
    bollard:new THREE.MeshStandardMaterial({color:0x303943,roughness:.48,metalness:.45}),
    vehiclePaint:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.42}),
    vehicleGlass:new THREE.MeshStandardMaterial({color:0x1a2732,roughness:.22,metalness:.25,transparent:true,opacity:.88}),
    tire:new THREE.MeshStandardMaterial({color:0x111317,roughness:.88,metalness:.02}),
    vehicleLight:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.30,metalness:.08}),
    streetPaint:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.64,metalness:.28}),
    streetGlass:new THREE.MeshStandardMaterial({
      color:0x9fc4d7,roughness:.18,metalness:.08,transparent:true,opacity:.36,depthWrite:false
    }),
    streetDetail:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.82,metalness:.16})
  };

  const textures=[asphaltMap,asphaltRoughnessMap,asphaltBumpMap,sidewalkMap,facadeMap,facadeRoughnessMap,facadeBumpMap,lightPoolMap];
  let activeQuality=qualityName(quality);
  function setQuality(next=activeQuality){
    activeQuality=qualityName(next);
    const anisotropy=textureAnisotropy(renderer,next);
    for(const texture of [asphaltMap,asphaltRoughnessMap,asphaltBumpMap,sidewalkMap,facadeMap,facadeRoughnessMap,facadeBumpMap]){
      texture.anisotropy=anisotropy;
      texture.needsUpdate=true;
    }
    materials.asphalt.bumpScale=(activeQuality==='max'||activeQuality==='max-cinematic')?.040:activeQuality==='high'?.034:activeQuality==='medium'?.028:.022;
    return {profile:activeQuality,anisotropy,asphaltTextureSize:ASPHALT_TEXTURE_SIZE};
  }
  function getDiagnostics(){
    return {
      profile:activeQuality,
      asphaltTextureSize:ASPHALT_TEXTURE_SIZE,
      facadeTextureSize:128,
      effectiveDetailClass:'2k-4k-equivalent tiled procedural microdetail',
      anisotropy:asphaltMap.anisotropy,
      localizedWetMaterials:true,
      dryAsphalt:{roughness:materials.asphalt.roughness,clearcoat:materials.asphalt.clearcoat,metalness:materials.asphalt.metalness}
    };
  }
  function dispose(){
    for(const material of Object.values(materials))material.dispose();
    for(const texture of textures)texture.dispose();
  }

  setQuality(quality);
  return {...materials,textures,setQuality,getDiagnostics,dispose};
}
