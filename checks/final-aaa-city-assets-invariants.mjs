import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createUrbanEnvironment,
  listUrbanDistricts,
  resolveUrbanDistrict,
  advanceUrbanDistrict,
  selectUrbanDistrictForDistance,
  URBAN_DISTRICT_PROGRESSION,
  URBAN_FACADE_FAMILIES
} from '../src/urban/index.js';

const REQUIRED_DISTRICTS=['downtown','commercial','construction','industrial','entertainment','event'];
const DRAW_CALL_BUDGET=42;
const ALLOCATED_INSTANCE_BUDGET=4500;

for(const id of REQUIRED_DISTRICTS)assert(listUrbanDistricts().includes(id),'missing production district '+id);
assert.equal(resolveUrbanDistrict('shopping').id,'commercial','legacy shopping alias must remain compatible');
assert.equal(resolveUrbanDistrict('neon').id,'entertainment','legacy neon alias must remain compatible');
assert.equal(URBAN_DISTRICT_PROGRESSION.length,REQUIRED_DISTRICTS.length,'district progression contract changed');
assert(URBAN_FACADE_FAMILIES.length>=10,'final facade family catalog must cover the requested production vocabulary');
for(const family of ['concrete','brick','modern-glass','painted-commercial','industrial','mixed-use','residential','warehouse','entertainment','event-district']){
  assert(URBAN_FACADE_FAMILIES.includes(family),'missing facade family '+family);
}

assert.equal(advanceUrbanDistrict('downtown').id,'commercial','district progression must be deterministic');
assert.equal(selectUrbanDistrictForDistance(0,500).id,'downtown');
assert.equal(selectUrbanDistrictForDistance(500,500).id,'commercial');
assert.equal(selectUrbanDistrictForDistance(2500,500).id,'event');
assert.equal(selectUrbanDistrictForDistance(3000,500).id,'downtown','district selection must wrap');

function inventory(root){
  let objects=0,drawCalls=0,activeInstances=0,allocatedInstances=0;
  root.traverse(object=>{
    objects++;
    if(object.isInstancedMesh){
      drawCalls++;
      activeInstances+=object.count||0;
      allocatedInstances+=object.instanceMatrix?.count||0;
    }
  });
  return {objects,drawCalls,activeInstances,allocatedInstances};
}

const scene=new THREE.Scene();
const environment=createUrbanEnvironment({
  parent:scene,
  quality:'max',
  district:'downtown',
  seed:'final-aaa-city-assets',
  roadWidth:27.5,
  sidewalkWidth:3.2,
  segmentLength:28,
  segmentCount:20,
  recycleNear:36,
  farZ:-520
});

const initial=inventory(environment.group);
assert(initial.drawCalls<=DRAW_CALL_BUDGET,'final city pass exceeded fixed environment draw-call budget');
assert(initial.allocatedInstances<=ALLOCATED_INSTANCE_BUDGET,'final city pass exceeded bounded instance allocation budget');
assert.equal(environment.getDiagnostics().district,'downtown');
assert.equal(environment.getDiagnostics().components.length,9,'final city pass must preserve the nine-component topology');

environment.setDistrict('industrial');
let diagnostics=environment.getDiagnostics();
assert.equal(diagnostics.district,'industrial');
assert.equal(diagnostics.components.find(item=>item.name==='skyline')?.district,'industrial','skyline did not accept district identity');
assert.equal(diagnostics.components.find(item=>item.name==='street-dressing')?.district,'industrial','street dressing did not accept district identity');

const next=environment.advanceDistrict();
assert.equal(next.id,'entertainment','environment advanceDistrict did not follow the shared progression');
const selected=environment.selectDistrictForDistance(1000,500);
assert.equal(selected.id,'construction','distance district selection returned the wrong district');
assert.equal(environment.getDiagnostics().district,'construction','distance district selection was not applied');

const topologyBefore=inventory(environment.group);
for(let step=0;step<1200;step++)environment.update(.25,300/3.6);
const topologyAfter=inventory(environment.group);
assert.equal(topologyAfter.objects,topologyBefore.objects,'endless streaming created new city objects');
assert.equal(topologyAfter.drawCalls,topologyBefore.drawCalls,'endless streaming changed draw-call topology');
assert.equal(topologyAfter.allocatedInstances,topologyBefore.allocatedInstances,'endless streaming grew instance pools');

environment.setQualityProfile('max');
const max=inventory(environment.group);
const maxDiagnostics=environment.getDiagnostics();
environment.setQualityProfile('low');
const low=inventory(environment.group);
const lowDiagnostics=environment.getDiagnostics();
assert(low.activeInstances<max.activeInstances,'LOW must reduce city population from MAX');
assert(low.drawCalls<max.drawCalls,'LOW must detach close-range hero batches');
assert.equal(lowDiagnostics.components.find(item=>item.name==='street-dressing')?.heroTier,0,'LOW must disable street hero detail');
environment.setQualityProfile('high');
const highDiagnostics=environment.getDiagnostics();
assert.equal(highDiagnostics.components.find(item=>item.name==='street-dressing')?.heroTier,2,'HIGH must retain hero vocabulary');
assert.equal(highDiagnostics.components.find(item=>item.name==='skyline')?.heroFacadeDetail,'enhanced','HIGH facade tier changed');
environment.setQualityProfile('max');
assert.equal(inventory(environment.group).allocatedInstances,initial.allocatedInstances,'quality changes must reuse fixed instance pools');
assert(maxDiagnostics.components.find(item=>item.name==='skyline')?.facadeFamilies>=10,'skyline diagnostics must expose the facade family catalog');

environment.dispose();
assert.equal(environment.group.parent,null,'dispose must detach final city environment root');

console.log(JSON.stringify({
  check:'final-aaa-city-assets-invariants',
  facadeFamilies:URBAN_FACADE_FAMILIES.length,
  districts:REQUIRED_DISTRICTS,
  max,
  low,
  drawCallBudget:DRAW_CALL_BUDGET,
  allocatedInstanceBudget:ALLOCATED_INSTANCE_BUDGET
}));
