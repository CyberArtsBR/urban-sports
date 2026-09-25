import * as THREE from 'three';
import {createUrbanMaterials} from './urbanMaterials.js';
import {createUrbanFacadeGeometrySet,URBAN_BUILDING_ARCHETYPES} from './urbanFacadeSystem.js';
import {resolveUrbanDistrict} from './urbanDistricts.js';

const _dummy=new THREE.Object3D();
const _color=new THREE.Color();
const PROFILE_DENSITY=Object.freeze({max:1,high:1,medium:.72,low:.48});
const ARCHETYPE_HEIGHT=Object.freeze([1,1.18,.58,1.02,1.28,.82,1.08]);
const ARCHETYPE_WIDTH=Object.freeze([1,.88,1.16,.92,.82,1.08,.90]);
const ARCHETYPE_DEPTH=Object.freeze([1,.92,1.18,.94,.84,1.02,.94]);
const LED_PALETTE=Object.freeze([0x37d7ff,0xff4f9a,0xffc44a,0x7b8cff,0x54f2b5]);

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function fract(value){return value-Math.floor(value);}
function hashString(value){
  if(Number.isFinite(value))return Number(value)>>>0;
  let hash=2166136261;
  const text=String(value??'urban-city');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}
function random01(seed,index,salt=0){
  const n=Math.sin((seed+index*374761393+salt*668265263)*.000001)*43758.5453123;
  return fract(n);
}
function rangeValue(range,t){return range[0]+(range[1]-range[0])*t;}
function densityFromQuality(value){
  if(typeof value==='number')return clamp(value,0,1);
  if(typeof value==='string')return PROFILE_DENSITY[value.toLowerCase()]??1;
  if(value&&typeof value==='object'){
    const explicit=value.environmentDecorationDensity??value.decorativeDensity??value.density;
    if(Number.isFinite(Number(explicit)))return clamp(Number(explicit),0,1);
    return PROFILE_DENSITY[String(value.profile??'high').toLowerCase()]??1;
  }
  return 1;
}
function activeCount(capacity,density,min=1,even=false){
  if(capacity<=0)return 0;
  let value=Math.max(min,Math.min(capacity,Math.round(capacity*density)));
  if(even&&value%2)value=Math.min(capacity,value+1);
  return value;
}
function makeMesh(geometry,material,capacity,name){
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.name=name;
  mesh.count=0;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
function setTransform(mesh,index,{x=0,y=0,z=0,sx=1,sy=1,sz=1,ry=0}){
  _dummy.position.set(x,y,z);
  _dummy.rotation.set(0,ry,0);
  _dummy.scale.set(sx,sy,sz);
  _dummy.updateMatrix();
  mesh.setMatrixAt(index,_dummy.matrix);
}
function setInstanceColor(mesh,index,hex,brightness=1){
  _color.setHex(hex);
  _color.r=Math.min(1,_color.r*brightness);
  _color.g=Math.min(1,_color.g*brightness);
  _color.b=Math.min(1,_color.b*brightness);
  mesh.setColorAt(index,_color);
}
function finish(mesh,count){
  mesh.count=count;
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
}
function advance(entry,dz,nearZ,farZ,onRecycle){
  entry.z+=dz;
  if(entry.z<=nearZ)return;
  const span=nearZ-farZ;
  const wraps=Math.max(1,Math.ceil((entry.z-nearZ)/span));
  entry.z-=span*wraps;
  entry.generation=(entry.generation||0)+wraps;
  onRecycle?.(entry);
}
function chooseLayer(district,t){
  const near=district.layerWeights[0]??.5;
  const mid=district.layerWeights[1]??.3;
  if(t<near)return 'near';
  if(t<near+mid)return 'mid';
  return 'far';
}
function layerHeightScale(layer){
  if(layer==='near')return .88;
  if(layer==='mid')return 1.08;
  return 1.34;
}
function layerWidthScale(layer){
  if(layer==='near')return .94;
  if(layer==='mid')return 1.02;
  return 1.12;
}

export function createUrbanBuildingSkyline(options={}){
  const roadWidth=Number(options.roadWidth)||13.5;
  const sidewalkWidth=Number(options.sidewalkWidth)||3.1;
  const buildingSpacing=Math.max(7.5,Number(options.buildingSpacing)||10.5);
  const recycleNear=Number.isFinite(Number(options.recycleNear))?Number(options.recycleNear):34;
  const farZ=Number.isFinite(Number(options.farZ))?Number(options.farZ):-470;
  const seed=hashString(options.seed??'urban-city');
  const pairs=Math.ceil((recycleNear-farZ)/buildingSpacing)+3;
  const capacity=pairs*2;
  const geometrySet=createUrbanFacadeGeometrySet();
  const archetypeCount=geometrySet.archetypes.length;
  const archetypeCapacity=Math.ceil(capacity/archetypeCount);
  const ownedMaterials=!options.materials;
  const materials=options.materials||createUrbanMaterials({renderer:options.renderer});
  const group=new THREE.Group();
  group.name='UrbanBuildingSkyline';

  const bodyMeshes=geometrySet.archetypes.map((geometry,index)=>
    makeMesh(geometry,materials.building,archetypeCapacity,'urban-building-'+URBAN_BUILDING_ARCHETYPES[index])
  );
  const lights=makeMesh(geometrySet.lights,materials.windows,capacity,'urban-building-facade-lights');
  const leds=makeMesh(geometrySet.leds,materials.buildingLed,capacity,'urban-building-led-accents');
  lights.castShadow=false;leds.castShadow=false;leds.receiveShadow=false;
  group.add(...bodyMeshes,lights,leds);

  const entries=Array.from({length:capacity},(_,index)=>({
    side:index%2===0?-1:1,
    archetype:index%archetypeCount,
    z:0,
    generation:0
  }));

  let density=densityFromQuality(options.quality??options.density??'high');
  let district=resolveUrbanDistrict(options.district??'mixed');

  function configure(entry,index){
    const generation=entry.generation||0;
    const r=index+generation*capacity;
    const layer=chooseLayer(district,random01(seed,r,101));
    const archetype=entry.archetype;
    const hBase=rangeValue(district.height,Math.pow(random01(seed,r,102),.72));
    const wBase=rangeValue(district.width,random01(seed,r,103));
    const dBase=rangeValue(district.depth,random01(seed,r,104));
    const setbackRange=district.setbacks[layer]||district.setbacks.near;
    entry.layer=layer;
    entry.height=hBase*(district.heightScale||1)*layerHeightScale(layer)*ARCHETYPE_HEIGHT[archetype];
    entry.width=Math.min(buildingSpacing*1.34,wBase*(district.widthScale||1)*layerWidthScale(layer)*ARCHETYPE_WIDTH[archetype]);
    entry.depth=dBase*ARCHETYPE_DEPTH[archetype];
    entry.setback=rangeValue(setbackRange,random01(seed,r,105));
    entry.bodyColor=district.bodyPalette[Math.floor(random01(seed,r,106)*district.bodyPalette.length)%district.bodyPalette.length];
    entry.windowColor=district.windowPalette[Math.floor(random01(seed,r,107)*district.windowPalette.length)%district.windowPalette.length];
    entry.bodyBrightness=.86+random01(seed,r,108)*.22;
    entry.windowBrightness=(district.windowBrightness||.9)*(.82+random01(seed,r,109)*.22);
    entry.ledColor=LED_PALETTE[Math.floor(random01(seed,r,110)*LED_PALETTE.length)%LED_PALETTE.length];
    entry.ledBrightness=.48+random01(seed,r,111)*.52;
    entry.yaw=(random01(seed,r,112)-.5)*(layer==='near'?.025:.012);
  }

  function refresh(){
    const count=activeCount(capacity,density,10,true);
    const edge=roadWidth*.5+sidewalkWidth;
    const bodyCounts=new Array(archetypeCount).fill(0);
    const layerCounts={near:0,mid:0,far:0};

    for(let i=0;i<count;i++){
      const entry=entries[i];
      const x=entry.side*(edge+entry.setback+entry.depth*.5);
      const local=bodyCounts[entry.archetype]++;
      const body=bodyMeshes[entry.archetype];
      setTransform(body,local,{
        x,y:0,z:entry.z,
        sx:entry.depth,sy:entry.height,sz:entry.width,
        ry:entry.yaw
      });
      setInstanceColor(body,local,entry.bodyColor,entry.bodyBrightness);

      setTransform(lights,i,{
        x,y:.012,z:entry.z,
        sx:entry.depth*1.002,sy:entry.height,sz:entry.width*1.002,
        ry:entry.yaw
      });
      setInstanceColor(lights,i,entry.windowColor,entry.windowBrightness);

      setTransform(leds,i,{
        x,y:.018,z:entry.z,
        sx:entry.depth*1.006,sy:entry.height,sz:entry.width*1.006,
        ry:entry.yaw
      });
      setInstanceColor(leds,i,entry.ledColor,entry.ledBrightness);
      layerCounts[entry.layer]++;
    }

    for(let i=0;i<bodyMeshes.length;i++)finish(bodyMeshes[i],bodyCounts[i]);
    finish(lights,count);finish(leds,count);
    group.userData.layerCounts=layerCounts;
  }

  function reset(){
    for(let i=0;i<entries.length;i++){
      const entry=entries[i];
      entry.z=recycleNear-Math.floor(i/2)*buildingSpacing-(i%2)*5;
      entry.generation=0;
      configure(entry,i);
    }
    refresh();
  }

  function update(dt,worldSpeed){
    const dz=(Number(worldSpeed)||0)*(Number(dt)||0);
    if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;
    for(let i=0;i<entries.length;i++){
      advance(entries[i],dz,recycleNear,farZ,entry=>configure(entry,i));
    }
    refresh();
  }

  function setDensity(value){
    density=densityFromQuality(value);
    refresh();
  }

  function setDistrict(value){
    district=resolveUrbanDistrict(value);
    for(let i=0;i<entries.length;i++)configure(entries[i],i);
    refresh();
    return getDiagnostics();
  }

  function getDiagnostics(){
    const count=activeCount(capacity,density,10,true);
    const allocated=archetypeCapacity*archetypeCount+capacity*2;
    return {
      name:'skyline',
      district:district.id,
      logical:count,
      instances:count*3,
      allocatedInstances:allocated,
      drawCalls:archetypeCount+2,
      archetypes:URBAN_BUILDING_ARCHETYPES.length,
      layers:{...(group.userData.layerCounts||{})},
      realtimeLights:0
    };
  }

  function dispose(){
    group.removeFromParent();
    for(const mesh of bodyMeshes)mesh.removeFromParent();
    lights.removeFromParent();
    leds.removeFromParent();
    geometrySet.dispose();
    if(ownedMaterials)materials.dispose?.();
  }

  group.userData.urbanComponent='skyline';
  group.userData.streaming=true;
  group.userData.cityArchitecture='aaa-instanced-v2';
  group.userData.realtimeLights=0;

  reset();

  return {
    group,
    meshes:[...bodyMeshes,lights,leds],
    update,
    reset,
    setDensity,
    setDistrict,
    getDiagnostics,
    dispose
  };
}

export const createBuildingSkyline=createUrbanBuildingSkyline;
