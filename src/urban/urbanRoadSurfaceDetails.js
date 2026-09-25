import * as THREE from 'three';

const _dummy=new THREE.Object3D();
const _color=new THREE.Color();
const PROFILE_DENSITY=Object.freeze({max:1,high:.72,medium:.40,low:.20});

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function fract(value){return value-Math.floor(value);}
function hashString(value){
  let hash=2166136261;
  const text=String(value??'urban-road-details');
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
function qualityName(value){
  const name=String(value?.profile??value??'high').toLowerCase();
  return Object.hasOwn(PROFILE_DENSITY,name)?name:'high';
}
function densityFromQuality(value){
  const explicit=Number(value?.roadDetailDensity);
  if(Number.isFinite(explicit))return clamp(explicit,0,1);
  return PROFILE_DENSITY[qualityName(value)];
}
function makeMesh(geometry,material,capacity,name,{castShadow=false,receiveShadow=false}={}){
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.name=name;
  mesh.count=0;
  mesh.castShadow=castShadow;
  mesh.receiveShadow=receiveShadow;
  mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
function setTransform(mesh,index,{x=0,y=.021,z=0,sx=1,sy=1,sz=1,rx=-Math.PI/2,ry=0,rz=0}={}){
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

export function createUrbanRoadSurfaceDetails(options={}){
  if(!options.materials)throw new TypeError('createUrbanRoadSurfaceDetails requires shared urban materials');
  const materials=options.materials;
  const roadWidth=Math.max(8,Number(options.roadWidth)||13.5);
  const recycleNear=Number.isFinite(Number(options.recycleNear))?Number(options.recycleNear):34;
  const farZ=Number.isFinite(Number(options.farZ))?Number(options.farZ):-470;
  const span=recycleNear-farZ;
  const seed=hashString(options.seed??'urban-road-details');
  const capacity=Math.max(18,Math.ceil(span/18));
  const plane=new THREE.PlaneGeometry(1,1);
  const drainGeometry=new THREE.BoxGeometry(1,.045,1);

  const repairs=makeMesh(plane,materials.roadRepair,capacity,'urban-road-repairs');
  const cracks=makeMesh(plane,materials.roadCrack,capacity*2,'urban-road-cracks');
  const skids=makeMesh(plane,materials.roadSkid,capacity*2,'urban-road-skid-marks');
  const damp=makeMesh(plane,materials.roadDamp,capacity,'urban-road-damp-patches');
  const puddles=makeMesh(plane,materials.roadPuddle,capacity,'urban-road-puddles');
  const drains=makeMesh(drainGeometry,materials.roadDrain,Math.ceil(capacity*.58),'urban-road-drain-covers',{receiveShadow:true});
  const grime=makeMesh(plane,materials.roadGrime,capacity*2,'urban-road-edge-grime');

  const group=new THREE.Group();
  group.name='UrbanRoadSurfaceDetails';
  group.userData.urbanComponent='road-details';
  group.userData.streaming=true;
  group.userData.boundedDecals=true;
  group.add(repairs,cracks,skids,damp,puddles,drains,grime);

  const entries=Array.from({length:capacity},(_,index)=>({
    z:recycleNear-index*(span/capacity),
    generation:0
  }));
  let activeQuality=qualityName(options.quality);
  let density=densityFromQuality(options.quality);

  function configure(entry,index){
    const r=index+entry.generation*capacity;
    entry.x=(random01(seed,r,1)-.5)*(roadWidth-3.2);
    entry.width=1.5+random01(seed,r,2)*4.4;
    entry.length=2.4+random01(seed,r,3)*7.8;
    entry.yaw=(random01(seed,r,4)-.5)*.24;
    entry.patchTone=.74+random01(seed,r,5)*.20;
    entry.crackX=(random01(seed,r,6)-.5)*(roadWidth-2.2);
    entry.crackYaw=(random01(seed,r,7)-.5)*.72;
    entry.crackLength=1.6+random01(seed,r,8)*4.6;
    entry.skidX=(random01(seed,r,9)-.5)*(roadWidth-4.0);
    entry.skidYaw=(random01(seed,r,10)-.5)*.16;
    entry.skidLength=2.8+random01(seed,r,11)*7.5;
    entry.wetX=(random01(seed,r,12)-.5)*(roadWidth-2.8);
    entry.wetWidth=1.0+random01(seed,r,13)*3.2;
    entry.wetLength=1.8+random01(seed,r,14)*5.8;
    entry.drainSide=random01(seed,r,15)<.5?-1:1;
    entry.drainOffset=.48+random01(seed,r,16)*.68;
    entry.edgeSide=random01(seed,r,17)<.5?-1:1;
    entry.edgeWidth=.34+random01(seed,r,18)*.54;
  }
  function reset(){
    for(let i=0;i<entries.length;i++){
      const entry=entries[i];
      entry.z=recycleNear-i*(span/capacity);
      entry.generation=0;
      configure(entry,i);
    }
    refresh();
  }
  function refresh(){
    const count=Math.max(5,Math.min(capacity,Math.round(capacity*density)));
    let repairCount=0,crackCount=0,skidCount=0,dampCount=0,puddleCount=0,drainCount=0,grimeCount=0;
    const maxDrains=Math.ceil(drains.instanceMatrix.count||capacity*.58);

    for(let i=0;i<count;i++){
      const entry=entries[i];
      setTransform(repairs,repairCount,{x:entry.x,z:entry.z,sx:entry.width,sy:entry.length,ry:entry.yaw});
      _color.setRGB(entry.patchTone,entry.patchTone*.99,entry.patchTone*.96);
      repairs.setColorAt(repairCount,_color);
      repairCount++;

      if(activeQuality!=='low'){
        for(let branch=0;branch<2;branch++){
          setTransform(cracks,crackCount,{
            x:entry.crackX+(branch?entry.crackLength*.16:-entry.crackLength*.14),
            y:.024,
            z:entry.z+(branch?1.3:-.8),
            sx:.035+(branch*.015),
            sy:entry.crackLength*(branch?.56:1),
            ry:entry.crackYaw+(branch?.48:0)
          });
          crackCount++;
        }
      }

      if(activeQuality!=='low'&&(i%2===0||activeQuality==='max')){
        for(let track=0;track<2;track++){
          setTransform(skids,skidCount,{
            x:entry.skidX+(track?-.18:.18),
            y:.026,
            z:entry.z-2.4,
            sx:.075,
            sy:entry.skidLength,
            ry:entry.skidYaw
          });
          skidCount++;
        }
      }

      if(i%2===0||activeQuality==='max'){
        setTransform(damp,dampCount,{
          x:entry.wetX,
          y:.028,
          z:entry.z+3.2,
          sx:entry.wetWidth*1.35,
          sy:entry.wetLength*1.25,
          ry:-entry.yaw*.7
        });
        dampCount++;
      }

      const drainAccumulation=i%3===1;
      if(i%3===0||drainAccumulation||activeQuality==='max'){
        const drainX=entry.drainSide*(roadWidth*.5-entry.drainOffset);
        setTransform(puddles,puddleCount,{
          x:drainAccumulation?drainX:entry.wetX+entry.wetWidth*.28,
          y:.030,
          z:drainAccumulation?entry.z+.18:entry.z+3.0,
          sx:drainAccumulation?.72:entry.wetWidth,
          sy:drainAccumulation?1.35:entry.wetLength,
          ry:drainAccumulation?0:entry.yaw*.5
        });
        puddleCount++;
      }

      if(i%3===1&&drainCount<maxDrains){
        const x=entry.drainSide*(roadWidth*.5-entry.drainOffset);
        setTransform(drains,drainCount,{
          x,
          y:.028,
          z:entry.z,
          sx:.58,
          sy:.76,
          sz:1,
          rx:0,
          ry:0
        });
        drainCount++;
      }

      for(let edge=0;edge<2;edge++){
        const side=edge===0?-1:1;
        setTransform(grime,grimeCount,{
          x:side*(roadWidth*.5-entry.edgeWidth*.5-.08),
          y:.023,
          z:entry.z+5.4,
          sx:entry.edgeWidth,
          sy:4.8+entry.length*.35,
          ry:0
        });
        grimeCount++;
      }
    }
    finish(repairs,repairCount);
    finish(cracks,crackCount);
    finish(skids,skidCount);
    finish(damp,dampCount);
    finish(puddles,puddleCount);
    finish(drains,drainCount);
    finish(grime,grimeCount);
    group.userData.activeCounts={repairCount,crackCount,skidCount,dampCount,puddleCount,drainCount,grimeCount};
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
    activeQuality=qualityName(value);
    density=densityFromQuality(value);
    refresh();
  }
  function getDiagnostics(){
    const counts=group.userData.activeCounts||{};
    const instances=Object.values(counts).reduce((sum,value)=>sum+(Number(value)||0),0);
    const drawCalls=[
      counts.repairCount,counts.crackCount,counts.skidCount,counts.dampCount,
      counts.puddleCount,counts.drainCount,counts.grimeCount
    ].filter(value=>Number(value)>0).length;
    return {
      name:'road-details',
      profile:activeQuality,
      logical:Math.max(5,Math.min(capacity,Math.round(capacity*density))),
      instances,
      allocatedInstances:capacity*9+Math.ceil(capacity*.58),
      drawCalls,
      bounded:true,
      localizedWetZones:(counts.dampCount||0)+(counts.puddleCount||0),
      drains:counts.drainCount||0
    };
  }
  function dispose(){
    group.removeFromParent();
    for(const mesh of [repairs,cracks,skids,damp,puddles,drains,grime])mesh.removeFromParent();
    plane.dispose();
    drainGeometry.dispose();
  }

  reset();
  return {group,meshes:[repairs,cracks,skids,damp,puddles,drains,grime],update,reset,setDensity,getDiagnostics,dispose};
}
