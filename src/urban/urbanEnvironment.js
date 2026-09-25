import * as THREE from 'three';
import {createUrbanMaterials} from './urbanMaterials.js';
import {createUrbanBuildingSkyline} from './urbanBuildings.js';

const _dummy=new THREE.Object3D();
const _color=new THREE.Color();
const PROFILE_DENSITY=Object.freeze({max:1,high:1,medium:.72,low:.48});

export const URBAN_ENVIRONMENT_DEFAULTS=Object.freeze({
  roadWidth:13.5,
  sidewalkWidth:3.1,
  segmentLength:28,
  segmentCount:18,
  recycleNear:34,
  farZ:-470,
  streetlightSpacing:28,
  buildingSpacing:13.5,
  coneSpacing:34,
  barrierSpacing:52,
  signSpacing:72
});

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function fract(value){return value-Math.floor(value);}
function hashString(value){
  let hash=2166136261;
  const text=String(value??'urban');
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
function densityFromQuality(value){
  if(typeof value==='number')return clamp(value,0,1);
  if(typeof value==='string')return PROFILE_DENSITY[value.toLowerCase()]??1;
  if(value&&typeof value==='object'){
    const explicit=value.environmentDecorationDensity??value.decorativeDensity??value.density;
    if(Number.isFinite(Number(explicit)))return clamp(Number(explicit),0,1);
    const profile=String(value.profile??'high').toLowerCase();
    return PROFILE_DENSITY[profile]??1;
  }
  return 1;
}
function activeCount(capacity,density,min=1,even=false){
  if(capacity<=0)return 0;
  let value=Math.max(min,Math.min(capacity,Math.round(capacity*density)));
  if(even&&value%2)value=Math.min(capacity,value+1);
  return value;
}
function createMesh(geometry,material,capacity,name,{castShadow=false,receiveShadow=false}={}){
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.name=name;
  mesh.count=capacity;
  mesh.castShadow=castShadow;
  mesh.receiveShadow=receiveShadow;
  mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
function setMatrix(mesh,index,{x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0}){
  _dummy.position.set(x,y,z);
  _dummy.rotation.set(rx,ry,rz);
  _dummy.scale.set(sx,sy,sz);
  _dummy.updateMatrix();
  mesh.setMatrixAt(index,_dummy.matrix);
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
function makeOwnedMaterials(materials,renderer){
  if(materials)return {materials,owned:false};
  return {materials:createUrbanMaterials({renderer}),owned:true};
}
function commonOptions(options={}){
  const config={...URBAN_ENVIRONMENT_DEFAULTS,...options};
  config.seed=hashString(options.seed??'urban-sports');
  config.density=densityFromQuality(options.quality??options.density??'high');
  return config;
}
function makeController({group,meshes,geometries,materialsRef,ownedMaterials,update,reset,setDensity,getDiagnostics}){
  return {
    group,meshes,reset,update,setDensity,getDiagnostics,
    dispose(){
      group.removeFromParent();
      for(const mesh of meshes)mesh.removeFromParent();
      for(const geometry of geometries)geometry.dispose();
      if(ownedMaterials)materialsRef.dispose?.();
    }
  };
}

export function createAsphaltRoadSurface(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();
  group.name='UrbanRoadSurface';
  const plane=new THREE.PlaneGeometry(1,1);
  const box=new THREE.BoxGeometry(1,1,1);
  const road=createMesh(plane,materials.asphalt,config.segmentCount,'urban-asphalt',{receiveShadow:true});
  const sidewalks=createMesh(box,materials.sidewalk,config.segmentCount*2,'urban-sidewalks',{receiveShadow:true});
  const curbs=createMesh(box,materials.curb,config.segmentCount*2,'urban-curbs',{receiveShadow:true});
  group.add(road,sidewalks,curbs);
  const entries=Array.from({length:config.segmentCount},(_,i)=>({z:-i*config.segmentLength,generation:0}));
  const span=config.segmentCount*config.segmentLength;
  function refresh(){
    for(let i=0;i<entries.length;i++){
      const z=entries[i].z;
      setMatrix(road,i,{y:.005,z,sx:config.roadWidth,sy:config.segmentLength,rx:-Math.PI/2});
      for(let s=0;s<2;s++){
        const side=s===0?-1:1,index=i*2+s;
        const sidewalkX=side*(config.roadWidth*.5+config.sidewalkWidth*.5);
        setMatrix(sidewalks,index,{x:sidewalkX,y:.09,z,sx:config.sidewalkWidth,sy:.18,sz:config.segmentLength});
        const curbX=side*(config.roadWidth*.5+.11);
        setMatrix(curbs,index,{x:curbX,y:.15,z,sx:.22,sy:.30,sz:config.segmentLength});
      }
    }
    finish(road,entries.length);finish(sidewalks,entries.length*2);finish(curbs,entries.length*2);
  }
  function reset(){entries.forEach((entry,i)=>{entry.z=-i*config.segmentLength;entry.generation=0;});refresh();}
  function update(dt,worldSpeed){
    const dz=(Number(worldSpeed)||0)*(Number(dt)||0);
    if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;
    for(const entry of entries){
      entry.z+=dz;
      while(entry.z>config.segmentLength*.75)entry.z-=span;
    }
    refresh();
  }
  reset();
  group.userData.urbanComponent='road';group.userData.streaming=true;
  return makeController({group,meshes:[road,sidewalks,curbs],geometries:[plane,box],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity(){},getDiagnostics(){return {name:'road',instances:entries.length*5,drawCalls:3};}});
}

export function createStreetMarkings(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanStreetMarkings';
  const geometry=new THREE.PlaneGeometry(1,1);
  const spacing=8;
  const laneXs=[-config.roadWidth*.25,0,config.roadWidth*.25];
  const rows=Math.ceil((config.recycleNear-config.farZ)/spacing)+3;
  const capacity=rows*laneXs.length;
  const mesh=createMesh(geometry,materials.marking,capacity,'urban-street-markings');
  group.add(mesh);
  const entries=[];
  for(let row=0;row<rows;row++)for(let lane=0;lane<laneXs.length;lane++){
    const center=lane===1;
    entries.push({x:laneXs[lane],z:config.recycleNear-row*spacing-(lane*.35),center,generation:0});
  }
  function refresh(){
    for(let i=0;i<entries.length;i++){
      const entry=entries[i];
      setMatrix(mesh,i,{x:entry.x,y:.014,z:entry.z,sx:entry.center?.14:.10,sy:entry.center?3.4:2.4,rx:-Math.PI/2});
      _color.setHex(entry.center?0xffce42:0xf4f5ef);mesh.setColorAt(i,_color);
    }
    finish(mesh,entries.length);
  }
  function reset(){
    let i=0;
    for(let row=0;row<rows;row++)for(let lane=0;lane<laneXs.length;lane++){
      const entry=entries[i++];entry.z=config.recycleNear-row*spacing-(lane*.35);entry.generation=0;
    }
    refresh();
  }
  function update(dt,worldSpeed){
    const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;
    for(const entry of entries)advance(entry,dz,config.recycleNear,config.farZ);
    refresh();
  }
  reset();group.userData.urbanComponent='markings';group.userData.streaming=true;
  return makeController({group,meshes:[mesh],geometries:[geometry],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity(){},getDiagnostics(){return {name:'markings',instances:entries.length,drawCalls:1};}});
}

export function createStreetlights(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanStreetlights';
  const pairs=Math.ceil((config.recycleNear-config.farZ)/config.streetlightSpacing)+1;
  const capacity=pairs*2;
  const poleGeometry=new THREE.CylinderGeometry(.065,.08,1,7);
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const bulbGeometry=new THREE.SphereGeometry(.12,6,4);
  const poles=createMesh(poleGeometry,materials.metal,capacity,'urban-streetlight-poles');
  const arms=createMesh(boxGeometry,materials.metal,capacity,'urban-streetlight-arms');
  const heads=createMesh(boxGeometry,materials.darkMetal,capacity,'urban-streetlight-heads');
  const bulbs=createMesh(bulbGeometry,materials.lamp,capacity,'urban-streetlight-bulbs');
  group.add(poles,arms,heads,bulbs);
  const entries=Array.from({length:capacity},(_,i)=>({side:i%2===0?-1:1,z:config.recycleNear-Math.floor(i/2)*config.streetlightSpacing-(i%2)*4.2,generation:0}));
  let density=config.density;
  function refresh(){
    const count=activeCount(capacity,density,4,true);
    for(let i=0;i<count;i++){
      const entry=entries[i],side=entry.side;
      const x=side*(config.roadWidth*.5+config.sidewalkWidth*.66);
      setMatrix(poles,i,{x,y:2.25,z:entry.z,sx:1,sy:4.5,sz:1});
      setMatrix(arms,i,{x:x-side*.48,y:4.38,z:entry.z,sx:1.05,sy:.09,sz:.09});
      setMatrix(heads,i,{x:x-side*.98,y:4.29,z:entry.z,sx:.52,sy:.18,sz:.34});
      setMatrix(bulbs,i,{x:x-side*.98,y:4.18,z:entry.z,sx:1.15,sy:.55,sz:1.15});
    }
    for(const mesh of [poles,arms,heads,bulbs])finish(mesh,count);
  }
  function reset(){entries.forEach((entry,i)=>{entry.z=config.recycleNear-Math.floor(i/2)*config.streetlightSpacing-(i%2)*4.2;entry.generation=0;});refresh();}
  function update(dt,worldSpeed){const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;for(const entry of entries)advance(entry,dz,config.recycleNear,config.farZ);refresh();}
  function setDensity(value){density=densityFromQuality(value);refresh();}
  reset();group.userData.urbanComponent='streetlights';group.userData.usesRealtimeLights=false;
  return makeController({group,meshes:[poles,arms,heads,bulbs],geometries:[poleGeometry,boxGeometry,bulbGeometry],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity,getDiagnostics(){const count=activeCount(capacity,density,4,true);return {name:'streetlights',logical:count,instances:count*4,drawCalls:4,realtimeLights:0};}});
}

export function createBuildingSkyline(options={}){
  return createUrbanBuildingSkyline(options);
}

export function createTrafficCones(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanTrafficCones';
  const capacity=Math.max(12,Math.ceil((config.recycleNear-config.farZ)/config.coneSpacing)*2);
  const coneGeometry=new THREE.CylinderGeometry(.30,.56,1.18,10,1,false);
  const stripeGeometry=new THREE.CylinderGeometry(.365,.425,.20,10,1,false);
  const baseGeometry=new THREE.BoxGeometry(1,1,1);
  const cones=createMesh(coneGeometry,materials.cone,capacity,'urban-traffic-cones');
  const stripes=createMesh(stripeGeometry,materials.coneStripe,capacity,'urban-traffic-cone-stripes');
  const bases=createMesh(baseGeometry,materials.darkMetal,capacity,'urban-traffic-cone-bases');
  group.add(cones,stripes,bases);
  const entries=Array.from({length:capacity},(_,i)=>({side:i%2===0?-1:1,z:0,generation:0}));
  let density=config.density;
  function configure(e,index){
    const r=index+(e.generation||0)*capacity;
    const shoulder=config.roadWidth*.5-.55-random01(config.seed,r,11)*.55;
    e.x=e.side*shoulder;
    e.lean=(random01(config.seed,r,12)-.5)*.035;
  }
  function refresh(){
    const count=activeCount(capacity,density,6,true);
    for(let i=0;i<count;i++){
      const e=entries[i];
      setMatrix(cones,i,{x:e.x,y:.66,z:e.z,rz:e.lean});
      setMatrix(stripes,i,{x:e.x,y:.72,z:e.z,rz:e.lean});
      setMatrix(bases,i,{x:e.x,y:.07,z:e.z,sx:1.05,sy:.14,sz:1.05,rz:e.lean});
    }
    finish(cones,count);finish(stripes,count);finish(bases,count);
  }
  function reset(){for(let i=0;i<entries.length;i++){const e=entries[i];e.z=config.recycleNear-Math.floor(i/2)*config.coneSpacing-(i%2)*7;e.generation=0;configure(e,i);}refresh();}
  function update(dt,worldSpeed){const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;for(let i=0;i<entries.length;i++)advance(entries[i],dz,config.recycleNear,config.farZ,e=>configure(e,i));refresh();}
  function setDensity(value){density=densityFromQuality(value);refresh();}
  reset();group.userData.urbanComponent='traffic-cones';group.userData.gameplayCollision=false;
  return makeController({group,meshes:[cones,stripes,bases],geometries:[coneGeometry,stripeGeometry,baseGeometry],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity,getDiagnostics(){const count=activeCount(capacity,density,6,true);return {name:'traffic-cones',logical:count,instances:count*3,drawCalls:3};}});
}

export function createBarriers(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanBarriers';
  const capacity=Math.max(10,Math.ceil((config.recycleNear-config.farZ)/config.barrierSpacing)*2);
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const rails=createMesh(boxGeometry,materials.barrier,capacity,'urban-barrier-rails');
  const posts=createMesh(boxGeometry,materials.darkMetal,capacity*2,'urban-barrier-posts');
  group.add(rails,posts);
  const entries=Array.from({length:capacity},(_,i)=>({side:i%2===0?-1:1,z:0,generation:0}));
  let density=config.density;
  function configure(e,index){
    const r=index+(e.generation||0)*capacity;
    e.x=e.side*(config.roadWidth*.5+config.sidewalkWidth*.18+random01(config.seed,r,21)*.45);
    e.yaw=(random01(config.seed,r,22)-.5)*.08;
  }
  function refresh(){
    const count=activeCount(capacity,density,4,true);
    for(let i=0;i<count;i++){
      const e=entries[i];
      setMatrix(rails,i,{x:e.x,y:.88,z:e.z,sx:.18,sy:.34,sz:2.8,ry:e.yaw});
      for(let p=0;p<2;p++)setMatrix(posts,i*2+p,{x:e.x,y:.55,z:e.z+(p===0?-1:1)*1.02,sx:.24,sy:1.1,sz:.24,ry:e.yaw});
    }
    finish(rails,count);finish(posts,count*2);
  }
  function reset(){for(let i=0;i<entries.length;i++){const e=entries[i];e.z=config.recycleNear-Math.floor(i/2)*config.barrierSpacing-(i%2)*10;e.generation=0;configure(e,i);}refresh();}
  function update(dt,worldSpeed){const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;for(let i=0;i<entries.length;i++)advance(entries[i],dz,config.recycleNear,config.farZ,e=>configure(e,i));refresh();}
  function setDensity(value){density=densityFromQuality(value);refresh();}
  reset();group.userData.urbanComponent='barriers';group.userData.gameplayCollision=false;
  return makeController({group,meshes:[rails,posts],geometries:[boxGeometry],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity,getDiagnostics(){const count=activeCount(capacity,density,4,true);return {name:'barriers',logical:count,instances:count*3,drawCalls:2};}});
}

export function createRoadSigns(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanRoadSigns';
  const capacity=Math.max(8,Math.ceil((config.recycleNear-config.farZ)/config.signSpacing)*2);
  const postGeometry=new THREE.CylinderGeometry(.045,.055,1,7);
  const panelGeometry=new THREE.BoxGeometry(1,1,1);
  const posts=createMesh(postGeometry,materials.metal,capacity,'urban-sign-posts');
  const panels=createMesh(panelGeometry,materials.sign,capacity,'urban-sign-panels');
  group.add(posts,panels);
  const entries=Array.from({length:capacity},(_,i)=>({side:i%2===0?-1:1,z:0,generation:0}));
  let density=config.density;
  function configure(e,index){
    const r=index+(e.generation||0)*capacity;
    e.x=e.side*(config.roadWidth*.5+config.sidewalkWidth*.72+random01(config.seed,r,31)*.35);
    e.tint=random01(config.seed,r,32);
  }
  function refresh(){
    const count=activeCount(capacity,density,4,true);
    for(let i=0;i<count;i++){
      const e=entries[i];
      setMatrix(posts,i,{x:e.x,y:1.15,z:e.z,sy:2.3});
      setMatrix(panels,i,{x:e.x,y:2.12,z:e.z,sx:1.25,sy:.72,sz:.08});
      _color.setHSL(e.tint>.72?.08:.57,.62,.46);panels.setColorAt(i,_color);
    }
    finish(posts,count);finish(panels,count);
  }
  function reset(){for(let i=0;i<entries.length;i++){const e=entries[i];e.z=config.recycleNear-Math.floor(i/2)*config.signSpacing-(i%2)*14;e.generation=0;configure(e,i);}refresh();}
  function update(dt,worldSpeed){const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;for(let i=0;i<entries.length;i++)advance(entries[i],dz,config.recycleNear,config.farZ,e=>configure(e,i));refresh();}
  function setDensity(value){density=densityFromQuality(value);refresh();}
  reset();group.userData.urbanComponent='signs';group.userData.gameplayCollision=false;
  return makeController({group,meshes:[posts,panels],geometries:[postGeometry,panelGeometry],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity,getDiagnostics(){const count=activeCount(capacity,density,4,true);return {name:'signs',logical:count,instances:count*2,drawCalls:2};}});
}

export function createUrbanRoadsideScenery(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanRoadsideScenery';
  const capacity=Math.max(18,Math.ceil((config.recycleNear-config.farZ)/24)*2);
  const cylinderGeometry=new THREE.CylinderGeometry(.12,.14,1,7);
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const shrubGeometry=new THREE.IcosahedronGeometry(.72,0);
  const bollards=createMesh(cylinderGeometry,materials.bollard,capacity,'urban-bollards');
  const planters=createMesh(boxGeometry,materials.planter,capacity,'urban-planters');
  const shrubs=createMesh(shrubGeometry,materials.foliage,capacity,'urban-planter-shrubs');
  const utilities=createMesh(boxGeometry,materials.utility,capacity,'urban-utility-boxes');
  group.add(bollards,planters,shrubs,utilities);
  const entries=Array.from({length:capacity},(_,i)=>({side:i%2===0?-1:1,z:0,generation:0}));
  let density=config.density;
  function configure(e,index){
    const r=index+(e.generation||0)*capacity;
    e.type=Math.floor(random01(config.seed,r,41)*3);
    e.x=e.side*(config.roadWidth*.5+config.sidewalkWidth*(.45+random01(config.seed,r,42)*.38));
    e.scale=.82+random01(config.seed,r,43)*.45;
  }
  function refresh(){
    const count=activeCount(capacity,density,8,true);
    let bollardCount=0,planterCount=0,utilityCount=0;
    for(let i=0;i<count;i++){
      const e=entries[i];
      if(e.type===0){
        setMatrix(bollards,bollardCount++,{x:e.x,y:.48*e.scale,z:e.z,sy:.96*e.scale,sx:e.scale,sz:e.scale});
      }else if(e.type===1){
        setMatrix(planters,planterCount,{x:e.x,y:.24,z:e.z,sx:1.05*e.scale,sy:.48,sz:.78*e.scale});
        setMatrix(shrubs,planterCount,{x:e.x,y:.78,z:e.z,sx:.72*e.scale,sy:.82*e.scale,sz:.72*e.scale});
        planterCount++;
      }else{
        setMatrix(utilities,utilityCount++,{x:e.x,y:.54*e.scale,z:e.z,sx:.62*e.scale,sy:1.08*e.scale,sz:.48*e.scale});
      }
    }
    finish(bollards,bollardCount);finish(planters,planterCount);finish(shrubs,planterCount);finish(utilities,utilityCount);
  }
  function reset(){for(let i=0;i<entries.length;i++){const e=entries[i];e.z=config.recycleNear-Math.floor(i/2)*24-(i%2)*5;e.generation=0;configure(e,i);}refresh();}
  function update(dt,worldSpeed){const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;for(let i=0;i<entries.length;i++)advance(entries[i],dz,config.recycleNear,config.farZ,e=>configure(e,i));refresh();}
  function setDensity(value){density=densityFromQuality(value);refresh();}
  reset();group.userData.urbanComponent='roadside-scenery';group.userData.gameplayCollision=false;
  return makeController({group,meshes:[bollards,planters,shrubs,utilities],geometries:[cylinderGeometry,boxGeometry,shrubGeometry],materialsRef:materials,ownedMaterials:owned,update,reset,setDensity,getDiagnostics(){const count=activeCount(capacity,density,8,true);return {name:'roadside-scenery',logical:count,drawCalls:4};}});
}

export function createUrbanEnvironment(options={}){
  const config=commonOptions(options);
  const materials=options.materials||createUrbanMaterials({renderer:options.renderer});
  const ownsMaterials=!options.materials;
  const group=new THREE.Group();
  group.name='UrbanEnvironment';
  group.userData.environmentType='urban';
  group.userData.streaming=true;
  group.userData.gameplayIntegration=false;

  const shared={...config,materials,renderer:options.renderer};
  const components={
    road:createAsphaltRoadSurface(shared),
    markings:createStreetMarkings(shared),
    streetlights:createStreetlights(shared),
    skyline:createBuildingSkyline(shared),
    cones:createTrafficCones(shared),
    barriers:createBarriers(shared),
    signs:createRoadSigns(shared),
    roadside:createUrbanRoadsideScenery(shared)
  };
  for(const component of Object.values(components))group.add(component.group);
  options.parent?.add?.(group);

  let quality=options.quality??'high';
  function setQualityProfile(value){
    quality=value;
    for(const component of Object.values(components))component.setDensity?.(value);
    return getDiagnostics();
  }
  function update(dt,worldSpeed){
    for(const component of Object.values(components))component.update(dt,worldSpeed);
  }
  function reset(){for(const component of Object.values(components))component.reset();}
  function setDistrict(value){
    return components.skyline.setDistrict?.(value)??components.skyline.getDiagnostics();
  }
  function getDiagnostics(){
    const parts=Object.values(components).map(component=>component.getDiagnostics());
    return {
      environment:'urban',
      qualityDensity:densityFromQuality(quality),
      componentCount:parts.length,
      drawCalls:parts.reduce((sum,item)=>sum+(item.drawCalls||0),0),
      instances:parts.reduce((sum,item)=>sum+(item.instances||item.logical||0),0),
      realtimeStreetLights:0,
      streaming:true,
      components:parts
    };
  }
  function dispose(){
    group.removeFromParent();
    for(const component of Object.values(components))component.dispose();
    if(ownsMaterials)materials.dispose?.();
  }
  setQualityProfile(quality);
  return {group,components,materials,update,reset,setQualityProfile,setDistrict,getDiagnostics,dispose};
}
