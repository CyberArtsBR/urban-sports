import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createUrbanEnvironment} from '../src/urban/urbanEnvironment.js';

const DRAW_CALL_BUDGET=50;
const ACTIVE_INSTANCE_BUDGET=3200;
const ALLOCATED_INSTANCE_BUDGET=4800;
const EXPECTED_COMPONENTS=['road','road-details','markings','streetlights','skyline','traffic-cones','barriers','signs','roadside-scenery','street-dressing'];

function inventory(root){
  let objects=0;
  const meshes=[];
  root.traverse(object=>{objects++;if(object.isInstancedMesh)meshes.push(object);});
  return {
    objects,meshes,drawCalls:meshes.length,
    activeInstances:meshes.reduce((sum,mesh)=>sum+(mesh.count||0),0),
    allocatedInstances:meshes.reduce((sum,mesh)=>sum+(mesh.instanceMatrix?.count||0),0)
  };
}

const parent=new THREE.Group();
const environment=createUrbanEnvironment({parent,quality:'high',seed:'urban-regression'});
assert.equal(environment.group.parent,parent,'urban environment attaches to the requested parent');
assert.equal(environment.group.userData.environmentType,'urban','environment advertises its type');
assert.equal(environment.group.userData.streaming,true,'environment advertises streaming behavior');
assert.equal(environment.group.userData.gameplayIntegration,false,'standalone environment does not silently alter gameplay');

const diagnostics=environment.getDiagnostics();
assert.equal(diagnostics.componentCount,10,'urban environment retains all ten reusable component groups');
assert.deepEqual(diagnostics.components.map(component=>component.name),EXPECTED_COMPONENTS,'urban environment component diagnostics changed unexpectedly');
assert(diagnostics.drawCalls<=DRAW_CALL_BUDGET,`urban draw-call budget exceeded (${diagnostics.drawCalls} > ${DRAW_CALL_BUDGET})`);
assert.equal(diagnostics.realtimeStreetLights,0,'decorative streetlights must not create per-instance realtime lights');
const roadDetails=diagnostics.components.find(component=>component.name==='road-details');
assert(roadDetails?.bounded===true,'road detail stream must remain explicitly bounded');
assert(roadDetails.localizedWetZones>0,'road detail stream must expose localized damp/puddle zones');
assert(roadDetails.drains>0,'road detail stream must retain drainage covers');

const initial=inventory(environment.group);
assert.equal(initial.drawCalls,diagnostics.drawCalls,'diagnostic draw calls match actual instanced drawables');
assert(initial.activeInstances<=ACTIVE_INSTANCE_BUDGET,`active urban instance budget exceeded (${initial.activeInstances} > ${ACTIVE_INSTANCE_BUDGET})`);
assert(initial.allocatedInstances<=ALLOCATED_INSTANCE_BUDGET,`allocated urban instance budget exceeded (${initial.allocatedInstances} > ${ALLOCATED_INSTANCE_BUDGET})`);

let peakActive=initial.activeInstances;
for(let step=0;step<20*60*4;step++){
  environment.update(.25,300/3.6);
  if(step%120===0){
    const sample=inventory(environment.group);
    peakActive=Math.max(peakActive,sample.activeInstances);
    assert.equal(sample.objects,initial.objects,'endless streaming created new scene objects');
    assert.equal(sample.drawCalls,initial.drawCalls,'endless streaming changed draw-call topology');
    assert.equal(sample.allocatedInstances,initial.allocatedInstances,'endless streaming grew instance capacity');
    assert(sample.activeInstances<=ACTIVE_INSTANCE_BUDGET,'endless streaming exceeded active instance budget');
  }
}

const highAfterStream=inventory(environment.group);
const lowDiagnostics=environment.setQualityProfile('low');
const low=inventory(environment.group);
assert(low.activeInstances<=highAfterStream.activeInstances,'low quality must not increase active urban instances');
assert(lowDiagnostics.drawCalls<=DRAW_CALL_BUDGET,'low quality exceeded draw-call budget');
environment.setQualityProfile('high');
const restored=inventory(environment.group);
assert.equal(restored.allocatedInstances,initial.allocatedInstances,'quality changes must reuse allocated instance capacity');

const geometries=new Set(),materials=new Set();
environment.group.traverse(object=>{
  if(object.geometry)geometries.add(object.geometry);
  for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material?.isMaterial)materials.add(material);
});
const textures=new Set(environment.materials.textures||[]);
const disposedGeometries=new Set(),disposedMaterials=new Set(),disposedTextures=new Set();
for(const geometry of geometries){const original=geometry.dispose.bind(geometry);geometry.dispose=()=>{disposedGeometries.add(geometry);original();};}
for(const material of materials){const original=material.dispose.bind(material);material.dispose=()=>{disposedMaterials.add(material);original();};}
for(const texture of textures){const original=texture.dispose.bind(texture);texture.dispose=()=>{disposedTextures.add(texture);original();};}

environment.dispose();
assert.equal(environment.group.parent,null,'dispose detaches the urban environment root');
assert.equal(environment.group.children.length,0,'dispose detaches reusable component groups');
assert.equal(disposedGeometries.size,geometries.size,'dispose releases all owned urban geometries');
assert.equal(disposedMaterials.size,materials.size,'dispose releases all owned urban materials');
assert.equal(disposedTextures.size,textures.size,'dispose releases all owned procedural textures');

console.log(JSON.stringify({check:'urban-environment-invariants',budgets:{drawCalls:{actual:initial.drawCalls,max:DRAW_CALL_BUDGET},activeInstances:{actual:initial.activeInstances,peak:peakActive,max:ACTIVE_INSTANCE_BUDGET},allocatedInstances:{actual:initial.allocatedInstances,max:ALLOCATED_INSTANCE_BUDGET}},streamedMinutes:20,disposed:{geometries:disposedGeometries.size,materials:disposedMaterials.size,textures:disposedTextures.size}}));
