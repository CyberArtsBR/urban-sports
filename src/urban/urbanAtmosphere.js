import * as THREE from 'three';

const QUALITY_FACTORS=Object.freeze({
  max:Object.freeze({realLights:1.10,pools:1.00,emissive:1.06}),
  high:Object.freeze({realLights:1.00,pools:.92,emissive:1.00}),
  medium:Object.freeze({realLights:.58,pools:.72,emissive:.84}),
  low:Object.freeze({realLights:0,pools:.42,emissive:.62})
});

const DAY_ROAD=new THREE.Color(0xc2c5c7);
const NIGHT_ROAD=new THREE.Color(0x777f86);
const WET_ROAD=new THREE.Color(0x8a9094);
const DAY_SIDEWALK=new THREE.Color(0xaaa9a5);
const NIGHT_SIDEWALK=new THREE.Color(0x69747f);
const DAY_BUILDING=new THREE.Color(0x6e7984);
const NIGHT_BUILDING=new THREE.Color(0x34414e);
const WARM_BUILDING=new THREE.Color(0x80665d);
const COOL_FILL=new THREE.Color(0x7ea8d8);
const DAY_GROUND=new THREE.Color(0x66747f);
const NIGHT_GROUND=new THREE.Color(0x253548);
const LAMP_COLOR=new THREE.Color(0xffd59a);
const LAMP_EMISSIVE=new THREE.Color(0xff9d36);
const WINDOW_COLOR=new THREE.Color(0xc9def0);
const WINDOW_EMISSIVE=new THREE.Color(0x67b9ff);
const BUILDING_LED_EMISSIVE=new THREE.Color(0x2faeff);

const _fogColor=new THREE.Color();
const _roadColor=new THREE.Color();
const _sidewalkColor=new THREE.Color();
const _buildingColor=new THREE.Color();
const _fillColor=new THREE.Color();
const _groundColor=new THREE.Color();

function clamp01(value){return THREE.MathUtils.clamp(Number(value)||0,0,1);}
function qualityName(value){
  const name=String(value?.profile??value??'high').toLowerCase();
  return QUALITY_FACTORS[name]?name:'high';
}
function materialFor(root,names){
  const candidates=Array.isArray(names)?names:[names];
  for(const name of candidates){
    const exact=root?.getObjectByName?.(name);
    if(exact?.material)return exact.material;
  }
  let found=null;
  root?.traverse?.(object=>{
    if(found||!object?.material)return;
    if(candidates.some(name=>name.endsWith('*')?object.name?.startsWith(name.slice(0,-1)):false))found=object.material;
  });
  return found;
}
function setStandardColor(material,color){
  if(material?.color)material.color.copy(color);
}
function makeProxyLight(color,x,z){
  const light=new THREE.PointLight(color,0,38,2);
  light.position.set(x,5.2,z);
  light.castShadow=false;
  light.userData.urbanLightProxy=true;
  return light;
}

export function createUrbanAtmosphere({scene,renderer,ambient=null,rim=null,fill=null,quality='high'}={}){
  if(!scene||!renderer)throw new TypeError('createUrbanAtmosphere requires scene and renderer');

  const root=scene.getObjectByName('UrbanEnvironment');
  const materials={
    asphalt:materialFor(root,'urban-asphalt'),
    roadDamp:materialFor(root,'urban-road-damp-patches'),
    roadPuddle:materialFor(root,'urban-road-puddles'),
    sidewalk:materialFor(root,'urban-sidewalks'),
    curb:materialFor(root,'urban-curbs'),
    building:materialFor(root,['urban-buildings','urban-building-slab','urban-building-tower','urban-building-stepped','urban-building-warehouse']),
    windows:materialFor(root,['urban-building-windows','urban-building-facade-lights']),
    buildingLed:materialFor(root,'urban-building-led-accents'),
    lamp:materialFor(root,'urban-streetlight-bulbs'),
    pool:materialFor(root,'urban-streetlight-pools')
  };

  const lighting=new THREE.Group();
  lighting.name='UrbanAtmosphereLighting';
  lighting.userData.urbanLightingAtmosphere=true;
  const leftLight=makeProxyLight(0xffc36c,-10.8,-6);
  const rightLight=makeProxyLight(0xffc36c,10.8,-22);
  lighting.add(leftLight,rightLight);
  (root||scene).add(lighting);

  let activeQuality=qualityName(quality);
  let qualityFactors=QUALITY_FACTORS[activeQuality];

  function setQuality(next){
    activeQuality=qualityName(next);
    qualityFactors=QUALITY_FACTORS[activeQuality];
    if(activeQuality==='low'){
      leftLight.intensity=0;
      rightLight.intensity=0;
    }
    return getDiagnostics();
  }

  function update(_dt,_state,w={}){
    const night=clamp01(w.night);
    const wet=clamp01(w.wet??w.rain);
    const rain=clamp01(w.rain);
    const cloud=clamp01(w.cloud);
    const flash=clamp01(w.flash);
    const warm=Math.max(0,(Number(w.sun?.r)||0)-(Number(w.sun?.b)||0));

    if(scene.fog){
      _fogColor.copy(w.fog||scene.fog.color);
      if(w.top)_fogColor.lerp(w.top,.10+night*.08);
      if(w.ambient)_fogColor.lerp(w.ambient,.035);
      scene.fog.color.copy(_fogColor);
      if(scene.fog.isFog){
        scene.fog.near=THREE.MathUtils.clamp(108-night*24-rain*12-cloud*8,68,110);
        scene.fog.far=THREE.MathUtils.clamp(525-night*70-rain*58-cloud*46,370,520);
      }else if(scene.fog.isFogExp2){
        scene.fog.density=THREE.MathUtils.lerp(.0026,.0048,Math.max(night*.55,wet*.9));
      }
    }

    renderer.toneMappingExposure=1.01+night*.025-wet*.012+flash*.012;
    scene.environmentIntensity=.46+wet*.24-night*.10;

    if(materials.asphalt){
      _roadColor.copy(DAY_ROAD).lerp(NIGHT_ROAD,night).lerp(WET_ROAD,wet*.26);
      setStandardColor(materials.asphalt,_roadColor);
      // Dry asphalt stays mineral and matte. Rain only nudges the substrate;
      // reflective response is owned by the localized damp/puddle overlays.
      materials.asphalt.roughness=.95-wet*.035;
      materials.asphalt.metalness=0;
      if('clearcoat' in materials.asphalt)materials.asphalt.clearcoat=0;
      if('clearcoatRoughness' in materials.asphalt)materials.asphalt.clearcoatRoughness=1;
      materials.asphalt.envMapIntensity=.12+wet*.12+night*.03;
    }
    if(materials.roadDamp){
      materials.roadDamp.opacity=wet*(.12+night*.07)*qualityFactors.pools;
      materials.roadDamp.roughness=.76-wet*.08;
      materials.roadDamp.envMapIntensity=.26+wet*.18+night*.05;
      if('clearcoat' in materials.roadDamp)materials.roadDamp.clearcoat=.04+wet*.05;
    }
    if(materials.roadPuddle){
      materials.roadPuddle.opacity=wet*wet*(.24+night*.12)*qualityFactors.pools;
      materials.roadPuddle.roughness=.28-wet*.06;
      materials.roadPuddle.envMapIntensity=.58+wet*.20+night*.08;
      if('clearcoat' in materials.roadPuddle)materials.roadPuddle.clearcoat=.34+wet*.12;
      if('clearcoatRoughness' in materials.roadPuddle)materials.roadPuddle.clearcoatRoughness=.18-wet*.04;
    }
    if(materials.sidewalk){
      _sidewalkColor.copy(DAY_SIDEWALK).lerp(NIGHT_SIDEWALK,night*.88);
      setStandardColor(materials.sidewalk,_sidewalkColor);
      materials.sidewalk.envMapIntensity=.14+wet*.24;
    }
    if(materials.curb){
      materials.curb.envMapIntensity=.12+wet*.18;
    }
    if(materials.building){
      _buildingColor.copy(DAY_BUILDING).lerp(NIGHT_BUILDING,night);
      _buildingColor.lerp(WARM_BUILDING,Math.min(.16,warm*.18)*(1-night*.75));
      setStandardColor(materials.building,_buildingColor);
      materials.building.envMapIntensity=.18+wet*.18;
    }
    if(materials.windows){
      const energy=(.34+night*1.42+wet*.18)*qualityFactors.emissive;
      if(materials.windows.isMeshBasicMaterial){
        // Instance colors carry warm/cool interior hue. Keep the shared energy
        // neutral so HDR bloom never bleaches every facade to the same blue.
        materials.windows.color.setRGB(energy,energy,energy);
      }else{
        setStandardColor(materials.windows,WINDOW_COLOR);
        if(materials.windows.emissive)materials.windows.emissive.copy(WINDOW_EMISSIVE);
        if('emissiveIntensity' in materials.windows)materials.windows.emissiveIntensity=energy;
      }
      if('opacity' in materials.windows)materials.windows.opacity=.58+night*.28;
    }
    if(materials.buildingLed){
      const ledEnergy=(.46+night*1.44+wet*.10)*qualityFactors.emissive;
      if(materials.buildingLed.isMeshBasicMaterial){
        // Per-instance cyan/magenta/amber colors remain the emitted color.
        materials.buildingLed.color.setRGB(ledEnergy,ledEnergy,ledEnergy);
      }else{
        if(materials.buildingLed.emissive)materials.buildingLed.emissive.copy(BUILDING_LED_EMISSIVE);
        if('emissiveIntensity' in materials.buildingLed)materials.buildingLed.emissiveIntensity=ledEnergy;
      }
    }
    if(materials.lamp){
      setStandardColor(materials.lamp,LAMP_COLOR);
      if(materials.lamp.emissive)materials.lamp.emissive.copy(LAMP_EMISSIVE);
      materials.lamp.emissiveIntensity=(.42+night*1.72+wet*.34)*qualityFactors.emissive;
    }
    if(materials.pool){
      materials.pool.color.copy(LAMP_COLOR);
      materials.pool.opacity=(night*.032+wet*.012)*qualityFactors.pools;
      materials.pool.visible=materials.pool.opacity>.004;
    }

    const proxyIntensity=(night*(48+wet*30))*qualityFactors.realLights;
    leftLight.intensity=proxyIntensity;
    rightLight.intensity=proxyIntensity*.92;
    leftLight.color.copy(LAMP_COLOR);
    rightLight.color.copy(LAMP_COLOR);

    if(ambient?.groundColor){
      _groundColor.copy(DAY_GROUND).lerp(NIGHT_GROUND,night);
      ambient.groundColor.copy(_groundColor);
    }
    if(fill){
      _fillColor.copy(w.ambient||COOL_FILL).lerp(COOL_FILL,.18+night*.30);
      fill.color.copy(_fillColor);
      fill.intensity=.22+night*.18+wet*.035;
    }
    if(rim){
      rim.intensity=.22+night*.31+wet*.055;
    }
  }

  function getDiagnostics(){
    return {
      profile:activeQuality,
      realLightCount:2,
      activeRealLightScale:qualityFactors.realLights,
      fakeStreetlightPools:!!materials.pool,
      linearFog:!!scene.fog?.isFog,
      fogNear:scene.fog?.near??null,
      fogFar:scene.fog?.far??null,
      wetRoadMode:'localized-overlays',
      asphaltGlobalClearcoat:Number(materials.asphalt?.clearcoat??0),
      asphaltRoughness:Number(materials.asphalt?.roughness??0),
      dampOverlayOpacity:Number(materials.roadDamp?.opacity??0),
      puddleOverlayOpacity:Number(materials.roadPuddle?.opacity??0),
      huePreservingFacadeEmission:!!(materials.windows?.isMeshBasicMaterial&&materials.buildingLed?.isMeshBasicMaterial)
    };
  }

  function dispose(){
    lighting.removeFromParent();
    lighting.clear();
  }

  setQuality(quality);
  return {update,setQuality,getDiagnostics,dispose,materials,lighting};
}
