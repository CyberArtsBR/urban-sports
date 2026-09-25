import * as THREE from 'three';

function textureAnisotropy(renderer){
  const getMax=renderer?.capabilities?.getMaxAnisotropy;
  if(typeof getMax!=='function')return 1;
  return Math.max(1,Math.min(4,getMax.call(renderer.capabilities)||1));
}

function configureRoadTexture(texture,renderer){
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(2.5,7);
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=textureAnisotropy(renderer);
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

function makeAsphaltTextures(renderer){
  const size=256;
  const colorData=new Uint8Array(size*size*4);
  const roughnessData=new Uint8Array(size*size*4);
  const bumpData=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const broad=periodicNoise(x,y,48,size,17);
    const medium=periodicNoise(x,y,17,size,29);
    const aggregate=periodicNoise(x,y,5,size,43);
    const micro=periodicNoise(x,y,2,size,71);
    const patch=periodicNoise(x,y,72,size,97);
    const crackNoise=periodicNoise(x,y,23,size,113);
    const crack=Math.abs(crackNoise-.5)<.018&&medium>.56 ? 1 : 0;
    const pebble=(aggregate>.78?1:0)+(micro>.88?1:0);
    const base=65+(broad-.5)*13+(medium-.5)*9+(aggregate-.5)*6-pebble*3-crack*15+(patch>.72?4:0);
    const value=Math.max(38,Math.min(94,Math.round(base)));
    colorData[i]=Math.max(0,value-2);
    colorData[i+1]=value;
    colorData[i+2]=Math.min(255,value+2);
    colorData[i+3]=255;
    const rough=Math.max(205,Math.min(250,Math.round(
      236+(aggregate-.5)*18+(micro-.5)*10-(patch>.76?12:0)+crack*7
    )));
    roughnessData[i]=roughnessData[i+1]=roughnessData[i+2]=rough;
    roughnessData[i+3]=255;
    const height=Math.max(58,Math.min(198,Math.round(
      126+(aggregate-.5)*46+(micro-.5)*24-crack*54
    )));
    bumpData[i]=bumpData[i+1]=bumpData[i+2]=height;
    bumpData[i+3]=255;
  }
  const map=configureRoadTexture(new THREE.DataTexture(colorData,size,size,THREE.RGBAFormat),renderer);
  map.repeat.set(4,8);
  map.colorSpace=THREE.SRGBColorSpace;
  const roughnessMap=configureRoadTexture(new THREE.DataTexture(roughnessData,size,size,THREE.RGBAFormat),renderer);
  roughnessMap.repeat.copy(map.repeat);
  const bumpMap=configureRoadTexture(new THREE.DataTexture(bumpData,size,size,THREE.RGBAFormat),renderer);
  bumpMap.repeat.copy(map.repeat);
  return {map,roughnessMap,bumpMap};
}

function makeFacadeTextures(renderer){
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
  const setup=texture=>{
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(2.2,4.8);
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.anisotropy=textureAnisotropy(renderer);texture.needsUpdate=true;
    return texture;
  };
  const map=setup(new THREE.DataTexture(colorData,size,size,THREE.RGBAFormat));map.colorSpace=THREE.SRGBColorSpace;
  const roughnessMap=setup(new THREE.DataTexture(roughnessData,size,size,THREE.RGBAFormat));
  const bumpMap=setup(new THREE.DataTexture(bumpData,size,size,THREE.RGBAFormat));
  return {map,roughnessMap,bumpMap};
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

function makeSidewalkTexture(renderer){
  const size=64;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const seam=(x%16<2||y%16<2)?-17:0;
    const grain=((x*7+y*11+x*y)%13)-6;
    const value=Math.max(86,Math.min(154,128+seam+grain));
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
  texture.anisotropy=textureAnisotropy(renderer);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

export function createUrbanMaterials({renderer=null}={}){
  const {map:asphaltMap,roughnessMap:asphaltRoughnessMap,bumpMap:asphaltBumpMap}=makeAsphaltTextures(renderer);
  const sidewalkMap=makeSidewalkTexture(renderer);
  const {map:facadeMap,roughnessMap:facadeRoughnessMap,bumpMap:facadeBumpMap}=makeFacadeTextures(renderer);
  const lightPoolMap=makeLightPoolTexture();
  const facadeBase={map:facadeMap,roughnessMap:facadeRoughnessMap,bumpMap:facadeBumpMap,vertexColors:true};

  const materials={
    asphalt:new THREE.MeshPhysicalMaterial({
      color:0xd2d4d5,map:asphaltMap,roughnessMap:asphaltRoughnessMap,bumpMap:asphaltBumpMap,
      roughness:.96,metalness:0,bumpScale:.032,
      clearcoat:0,clearcoatRoughness:1,envMapIntensity:.10
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
      color:0xffffff,transparent:true,opacity:.90,depthWrite:false,toneMapped:true,vertexColors:true
    }),
    buildingLed:new THREE.MeshBasicMaterial({
      color:0xffffff,toneMapped:true,vertexColors:true
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
  function dispose(){
    for(const material of Object.values(materials))material.dispose();
    for(const texture of textures)texture.dispose();
  }

  return {...materials,textures,dispose};
}
