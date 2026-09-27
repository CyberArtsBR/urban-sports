import * as THREE from 'three';

function createContactShadow(scene){
  const size=64;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);
    const offset=(y*size+x)*4;
    data[offset]=data[offset+1]=data[offset+2]=255;
    data[offset+3]=Math.pow(Math.max(0,1-radius*radius),2)*255;
  }
  const map=new THREE.DataTexture(data,size,size);
  map.magFilter=THREE.LinearFilter;
  map.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({
    color:0x1b2630,
    map,
    transparent:true,
    opacity:.18,
    depthWrite:false
  });
  const geometry=new THREE.CircleGeometry(.62,24);
  const shadow=new THREE.Mesh(geometry,material);
  shadow.name='urban-rider-contact-shadow';
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.set(1.45,.52,1);
  shadow.renderOrder=8;
  shadow.visible=false;
  scene.add(shadow);
  return {shadow,geometry,material,map};
}

function makeCourseMaterials(){
  const banana=new THREE.MeshStandardMaterial({
    color:0xffd32f,
    roughness:.30,
    emissive:0x8d5700,
    emissiveIntensity:.31
  });
  return {
    materials:{banana},
    dispose(){banana.dispose();}
  };
}

export function createUrbanRuntimeEnvironment({scene,renderer,quality={}}={}){
  if(!scene||!renderer)throw new Error('Urban runtime environment requires scene and renderer');

  scene.background=new THREE.Color(0x98a5af);
  scene.fog=new THREE.Fog(0x8f9aa3,50,272);
  renderer.toneMappingExposure=1.09;

  const atmosphere=new THREE.Group();
  atmosphere.name='UrbanRuntimeAtmosphereBindings';
  scene.add(atmosphere);

  const ambient=new THREE.HemisphereLight(0xffffff,0x818486,1.34);
  const sun=new THREE.DirectionalLight(0xffedc6,3.15);
  sun.position.set(-9,15,7);
  sun.castShadow=false;
  const rim=new THREE.DirectionalLight(0xedf7fa,.38);
  rim.position.set(11,8,-10);
  const fill=new THREE.DirectionalLight(0xffffff,.48);
  fill.position.set(0,7,-9);
  scene.add(ambient,sun,rim,fill);

  const contact=createContactShadow(scene);
  const course=makeCourseMaterials();

  let profile=String(quality?.profile||'high');
  let settings={...quality,profile};
  let time=0;

  function applyQuality(next={}){
    settings={...settings,...(next||{})};
    if(next?.profile)profile=String(next.profile);
    settings.profile=profile;
    return getQualityProfile();
  }
  function getQualityProfile(){
    return {...settings,profile};
  }
  function reset(){
    time=0;
    contact.shadow.visible=false;
    contact.shadow.position.y=-100;
    contact.material.opacity=.18;
    contact.shadow.scale.set(1.45,.52,1);
  }
  function update(dt,worldSpeed,playerX,playerY,playerZ,speed,edge,air,landingPulse,running=true,groundY=playerY){
    time+=Math.max(0,Number(dt)||0);
    const jumpHeight=Math.max(0,(Number(playerY)||0)-(Number(groundY)||0));
    const heightFade=THREE.MathUtils.clamp(1-jumpHeight/4.6,0,1);
    const landingAccent=1+THREE.MathUtils.clamp(Number(landingPulse)||0,0,1)*.13;
    contact.shadow.visible=!!running&&heightFade>.018;
    contact.shadow.position.set(Number(playerX)||0,Math.max(.006,(Number(groundY)||0)+.012),(Number(playerZ)||0)+.02);
    const targetOpacity=.205*heightFade*(air?.84:1)*landingAccent;
    contact.material.opacity=THREE.MathUtils.lerp(contact.material.opacity,targetOpacity,1-Math.pow(.0009,Math.max(0,Number(dt)||0)));
    const airborneSpread=1+THREE.MathUtils.clamp(jumpHeight/4.6,0,1)*.58;
    contact.shadow.scale.set(1.42*airborneSpread*landingAccent,.50*airborneSpread,1);
  }
  function getQualityDiagnostics(){
    return {
      environmentMode:'urban-native',
      environmentQualityProfile:profile,
      globalShadowMapsEnabled:!!renderer.shadowMap.enabled,
      decorativeShadowCasting:false,
      activeBanks:0,
      activeWindBanks:0,
      activeDecorativeTrees:0,
      activeSnowLayerParticles:0,
      realtimeDirectionalLights:3,
      dynamicSceneryFrustumCulled:true,
      alpineRuntimeAllocated:false,
      alpineGeometryCount:0,
      alpineMaterialCount:0,
      alpineParticleCount:0
    };
  }
  function dispose(){
    contact.shadow.removeFromParent();
    contact.geometry.dispose();
    contact.material.dispose();
    contact.map.dispose();
    course.dispose();
    atmosphere.removeFromParent();
    ambient.removeFromParent();
    sun.removeFromParent();
    sun.target?.removeFromParent?.();
    rim.removeFromParent();
    fill.removeFromParent();
  }

  applyQuality(quality);
  return {
    weatherBindings:{
      sun,ambient,rim,fill,atmosphere,
      sky:null,
      snowLayers:[],
      snowMaterials:null,
      snowParticles:null,
      surfaceDetail:null
    },
    update,
    reset,
    dispose,
    setQualityProfile:applyQuality,
    getQualityProfile,
    applyQuality,
    getQualityDiagnostics,
    terrainMaterial:null,
    courseMaterials:course.materials
  };
}
