import * as THREE from 'three';

function textureAnisotropy(renderer){
  const getMax=renderer?.capabilities?.getMaxAnisotropy;
  if(typeof getMax!=='function')return 1;
  return Math.max(1,Math.min(4,getMax.call(renderer.capabilities)||1));
}

function makeAsphaltTexture(renderer){
  const size=64;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const grain=(Math.sin(x*12.73+y*19.31)+Math.sin(x*3.17-y*5.91))*.5;
    const pebble=((x*17+y*29+x*y*3)%23)/23;
    const value=Math.max(32,Math.min(72,50+grain*8+(pebble-.5)*10));
    data[i]=value;
    data[i+1]=value+1;
    data[i+2]=value+2;
    data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(2.5,7);
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=textureAnisotropy(renderer);
  texture.colorSpace=THREE.SRGBColorSpace;
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
  const asphaltMap=makeAsphaltTexture(renderer);
  const sidewalkMap=makeSidewalkTexture(renderer);

  const materials={
    asphalt:new THREE.MeshPhysicalMaterial({
      color:0x41454b,map:asphaltMap,roughness:.94,metalness:.02,
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
      color:0xd9f3ff,roughness:.18,metalness:.08,emissive:0x88d8ff,emissiveIntensity:2.2,
      toneMapped:false
    }),
    building:new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.80,metalness:.05,vertexColors:true
    }),
    rooftop:new THREE.MeshStandardMaterial({color:0x333b45,roughness:.78,metalness:.12}),
    windows:new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.28,metalness:.07,
      emissive:0x2b3b4c,emissiveIntensity:.38,vertexColors:true
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

  const textures=[asphaltMap,sidewalkMap];
  function dispose(){
    for(const material of Object.values(materials))material.dispose();
    for(const texture of textures)texture.dispose();
  }

  return {...materials,textures,dispose};
}
