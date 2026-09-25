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

function makeAsphaltTextures(renderer){
  const size=64;
  const colorData=new Uint8Array(size*size*4);
  const roughnessData=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const grain=(Math.sin(x*12.73+y*19.31)+Math.sin(x*3.17-y*5.91))*.5;
    const pebble=((x*17+y*29+x*y*3)%23)/23;
    const value=Math.max(32,Math.min(72,50+grain*8+(pebble-.5)*10));
    colorData[i]=value;
    colorData[i+1]=value+1;
    colorData[i+2]=value+2;
    colorData[i+3]=255;

    // Long, low-frequency channels keep rain highlights stretched along the
    // travel direction without turning the road into a uniform mirror.
    const channel=Math.pow(Math.max(0,Math.sin(x*.42+Math.sin(y*.075)*1.35)),6);
    const micro=(grain*.5+.5)*.14+(pebble-.5)*.08;
    const rough=Math.max(128,Math.min(255,229+micro*70-channel*72));
    roughnessData[i]=roughnessData[i+1]=roughnessData[i+2]=rough;
    roughnessData[i+3]=255;
  }
  const map=configureRoadTexture(new THREE.DataTexture(colorData,size,size,THREE.RGBAFormat),renderer);
  map.colorSpace=THREE.SRGBColorSpace;
  const roughnessMap=configureRoadTexture(new THREE.DataTexture(roughnessData,size,size,THREE.RGBAFormat),renderer);
  return {map,roughnessMap};
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
  const {map:asphaltMap,roughnessMap:asphaltRoughnessMap}=makeAsphaltTextures(renderer);
  const sidewalkMap=makeSidewalkTexture(renderer);
  const lightPoolMap=makeLightPoolTexture();

  const materials={
    asphalt:new THREE.MeshPhysicalMaterial({
      color:0x41454b,map:asphaltMap,roughnessMap:asphaltRoughnessMap,roughness:.94,metalness:.02,
      clearcoat:0,clearcoatRoughness:.28,envMapIntensity:.20
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
      blending:THREE.AdditiveBlending,toneMapped:true,polygonOffset:true,
      polygonOffsetFactor:-2,polygonOffsetUnits:-2
    }),
    building:new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.80,metalness:.05,vertexColors:true
    }),
    rooftop:new THREE.MeshStandardMaterial({color:0x333b45,roughness:.78,metalness:.12}),
    windows:new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.20,metalness:.10,
      emissive:0x67b9ff,emissiveIntensity:.62,
      transparent:true,opacity:.88,depthWrite:false,toneMapped:true,vertexColors:true
    }),
    buildingLed:new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.28,metalness:.05,
      emissive:0xffffff,emissiveIntensity:1.20,
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

  const textures=[asphaltMap,asphaltRoughnessMap,sidewalkMap,lightPoolMap];
  function dispose(){
    for(const material of Object.values(materials))material.dispose();
    for(const texture of textures)texture.dispose();
  }

  return {...materials,textures,dispose};
}
