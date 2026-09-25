import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  PARKED_VEHICLE_TYPES,
  createParkedVehicle,
  createStreetFurnitureCluster,
  createBusStop,
  createUtilityCluster,
  createSidewalkDetailSet,
  createCommercialStreetCluster,
  createUrbanStreetDressing
} from '../src/urban/streetDressing.js';

const DRAW_CALL_BUDGET=12;
const ACTIVE_INSTANCE_BUDGET=1500;
const ALLOCATED_INSTANCE_BUDGET=3000;
const factories=[
  createParkedVehicle({type:'sedan'}),
  createStreetFurnitureCluster(),
  createBusStop(),
  createUtilityCluster(),
  createSidewalkDetailSet(),
  createCommercialStreetCluster()
];
for(const item of factories){
  assert.equal(item.gameplayCollision,false,item.kind+' must remain decorative by default');
  assert.equal(item.decorative,true,item.kind+' must advertise decorative intent');
  assert.equal(item.originY,0,item.kind+' origin contract must remain y=0');
  assert(item.bounds?.width>0&&item.bounds?.length>0,item.kind+' must expose predictable bounds');
}
for(const type of ['compact','sedan','taxi','van','delivery','truck','scooter'])assert(PARKED_VEHICLE_TYPES[type],type+' vehicle profile is missing');

function inventory(root){
  let objects=0;const meshes=[];
  root.traverse(object=>{objects++;if(object.isInstancedMesh)meshes.push(object);});
  return {
    objects,meshes,drawCalls:meshes.length,
    activeInstances:meshes.reduce((sum,mesh)=>sum+(mesh.count||0),0),
    allocatedInstances:meshes.reduce((sum,mesh)=>sum+(mesh.instanceMatrix?.count||0),0)
  };
}

const parent=new THREE.Group();
const customVehicle=createParkedVehicle({type:'scooter',side:-1,z:-36});
const dressing=createUrbanStreetDressing({parent,quality:'high',seed:'aaa-street-dressing-regression',placements:[customVehicle]});
assert.equal(dressing.group.parent,parent,'street dressing attaches to requested parent');
assert.equal(dressing.group.userData.gameplayCollision,false,'street dressing must not opt into gameplay collision');
assert.equal(dressing.group.userData.streaming,true,'street dressing advertises streaming behavior');
const diagnostics=dressing.getDiagnostics();
assert(diagnostics.drawCalls<=DRAW_CALL_BUDGET,'street dressing draw-call budget exceeded ('+diagnostics.drawCalls+' > '+DRAW_CALL_BUDGET+')');
assert.equal(diagnostics.realtimeLights,0,'street dressing must not create realtime lights');
assert.equal(diagnostics.customPlacements,1,'custom placement descriptors are not retained');
assert(Object.values(diagnostics.zones).reduce((sum,count)=>sum+count,0)>0,'procedural composition zones are missing');

const initial=inventory(dressing.group);
assert.equal(initial.drawCalls,diagnostics.drawCalls,'diagnostic draw calls must match instanced mesh topology');
assert(initial.activeInstances<=ACTIVE_INSTANCE_BUDGET,'active street-dressing instance budget exceeded ('+initial.activeInstances+' > '+ACTIVE_INSTANCE_BUDGET+')');
assert(initial.allocatedInstances<=ALLOCATED_INSTANCE_BUDGET,'allocated street-dressing instance budget exceeded ('+initial.allocatedInstances+' > '+ALLOCATED_INSTANCE_BUDGET+')');
let peakActive=initial.activeInstances;
for(let step=0;step<20*60*4;step++){
  dressing.update(.25,300/3.6);
  if(step%120===0){
    const sample=inventory(dressing.group);peakActive=Math.max(peakActive,sample.activeInstances);
    assert.equal(sample.objects,initial.objects,'endless dressing streaming created new scene objects');
    assert.equal(sample.drawCalls,initial.drawCalls,'endless dressing streaming changed draw-call topology');
    assert.equal(sample.allocatedInstances,initial.allocatedInstances,'endless dressing streaming grew fixed instance pools');
    assert(sample.activeInstances<=ACTIVE_INSTANCE_BUDGET,'endless dressing streaming exceeded active instance budget');
  }
}
const high=inventory(dressing.group);
dressing.setDensity('low');
const low=inventory(dressing.group);
assert(low.activeInstances<=high.activeInstances,'low quality must not increase street dressing instances');
dressing.setDensity('high');
assert.equal(inventory(dressing.group).allocatedInstances,initial.allocatedInstances,'quality changes must reuse existing instance capacity');

const geometries=new Set();
dressing.group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});
const disposed=new Set();
for(const geometry of geometries){const original=geometry.dispose.bind(geometry);geometry.dispose=()=>{disposed.add(geometry);original();};}
dressing.dispose();
assert.equal(dressing.group.parent,null,'dispose detaches street dressing root');
assert.equal(dressing.group.children.length,0,'dispose detaches street dressing mesh pools');
assert.equal(disposed.size,geometries.size,'dispose releases every owned street-dressing geometry');

console.log(JSON.stringify({check:'street-dressing-invariants',budgets:{drawCalls:{actual:initial.drawCalls,max:DRAW_CALL_BUDGET},activeInstances:{actual:initial.activeInstances,peak:peakActive,max:ACTIVE_INSTANCE_BUDGET},allocatedInstances:{actual:initial.allocatedInstances,max:ALLOCATED_INSTANCE_BUDGET}},streamedMinutes:20,zones:diagnostics.zones}));
