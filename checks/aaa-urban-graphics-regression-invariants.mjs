import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
  GRAPHICS_QUALITY_BUDGETS,
  GRAPHICS_BUDGET_METRICS,
  analyzeGraphicsStability,
  captureGraphicsDiagnostics,
  evaluateGraphicsBudget
} from '../src/graphicsDiagnostics.js';
import {createUrbanEnvironment} from '../src/urban/urbanEnvironment.js';
import {createUrbanObstacle} from '../src/urban/urbanObstacles.js';
import {createSkateboardEquipment} from '../src/skateboardEquipment.js';

const PROFILES=['low','medium','high'];
const profileOrder=['low','medium','high'];

for(const metric of GRAPHICS_BUDGET_METRICS){
  let previous=-Infinity;
  for(const profile of profileOrder){
    const value=GRAPHICS_QUALITY_BUDGETS[profile][metric];
    assert(Number.isFinite(value)&&value>0,`${profile} graphics budget missing ${metric}`);
    assert(value>=previous,`${metric} budget must not shrink as quality increases`);
    previous=value;
  }
}
assert.deepEqual(GRAPHICS_QUALITY_BUDGETS.auto,GRAPHICS_QUALITY_BUDGETS.medium,'AUTO/MEDIUM resource envelope must remain aligned');

const syntheticScene=new THREE.Scene();
const box=new THREE.BoxGeometry(1,1,1);
const material=new THREE.MeshStandardMaterial({map:new THREE.Texture()});
const instances=new THREE.InstancedMesh(box,material,4);
syntheticScene.add(instances,new THREE.DirectionalLight(0xffffff,1));
const syntheticRenderer={info:{render:{calls:12,triangles:3456},memory:{geometries:8,textures:5}}};
const synthetic=captureGraphicsDiagnostics({renderer:syntheticRenderer,scene:syntheticScene});
assert.equal(synthetic.rendererCalls,12);
assert.equal(synthetic.rendererTriangles,3456);
assert.equal(synthetic.rendererGeometries,8);
assert.equal(synthetic.rendererTextures,5);
assert.equal(synthetic.instancedMeshCount,1);
assert.equal(synthetic.materialCount,1);
assert.equal(synthetic.lightCount,1);
material.map.dispose();
material.dispose();
box.dispose();

const baselines={};
for(const profile of PROFILES){
  const scene=new THREE.Scene();
  const environment=createUrbanEnvironment({
    parent:scene,
    quality:profile,
    seed:`aaa-graphics-${profile}`,
    roadWidth:27.5,
    sidewalkWidth:3.2,
    segmentLength:28,
    segmentCount:20,
    recycleNear:36,
    farZ:-520
  });
  const snapshot=captureGraphicsDiagnostics({scene,urbanEnvironment:environment});
  const budget=evaluateGraphicsBudget(snapshot,profile);
  assert(budget.ok,`${profile} urban environment exceeds graphics budget: ${JSON.stringify(budget.violations)}`);
  assert(snapshot.instancedMeshCount>0,`${profile} urban environment must keep instanced rendering`);
  assert.equal(snapshot.lightCount,0,`${profile} decorative urban environment must not create realtime per-prop lights`);
  baselines[profile]=snapshot;
  environment.dispose();
  assert.equal(environment.group.parent,null,`${profile} environment dispose must detach its root`);
}

assert(baselines.low.urbanPropPopulation<baselines.high.urbanPropPopulation,'LOW must reduce urban prop population');
assert(baselines.low.skylinePopulation<baselines.high.skylinePopulation,'LOW must reduce skyline population');
assert(baselines.low.urbanInstances<baselines.high.urbanInstances,'LOW must reduce active urban instances');

const streamScene=new THREE.Scene();
const streamEnvironment=createUrbanEnvironment({
  parent:streamScene,
  quality:'high',
  seed:'aaa-graphics-extended-stream',
  roadWidth:27.5,
  sidewalkWidth:3.2,
  segmentLength:28,
  segmentCount:20,
  recycleNear:36,
  farZ:-520
});
const streamSamples=[];
const dt=.25;
const speed=300/3.6;
const simulatedMinutes=30;
const steps=Math.round(simulatedMinutes*60/dt);
for(let step=0;step<=steps;step++){
  if(step>0)streamEnvironment.update(dt,speed);
  if(step%120===0){
    const snapshot=captureGraphicsDiagnostics({scene:streamScene,urbanEnvironment:streamEnvironment});
    streamSamples.push(snapshot);
    const budget=evaluateGraphicsBudget(snapshot,'high');
    assert(budget.ok,`extended stream exceeded HIGH budget at step ${step}: ${JSON.stringify(budget.violations)}`);
  }
}
const stability=analyzeGraphicsStability(streamSamples);
assert(stability.ok,`extended urban stream shows monotonic resource growth: ${JSON.stringify(stability.violations)}`);
for(const metric of ['sceneObjectCount','instancedMeshCount','materialCount','lightCount','streamingSegmentCount','skylinePopulation','urbanInstances']){
  const values=streamSamples.map(sample=>sample[metric]);
  assert.equal(Math.max(...values),Math.min(...values),`${metric} must remain topology-bounded during endless streaming`);
}
streamEnvironment.dispose();

const leakSamples=Array.from({length:12},(_,index)=>({
  rendererGeometries:20+index*2,
  rendererTextures:10+index,
  sceneObjectCount:100+index*8,
  instancedMeshCount:20,
  materialCount:30+index,
  lightCount:4,
  streamingSegmentCount:20,
  urbanPropPopulation:200+index*10,
  skylinePopulation:40+index,
  urbanInstances:300+index*14
}));
assert.equal(analyzeGraphicsStability(leakSamples).ok,false,'growth detector must reject synthetic monotonic leaks');

for(const kind of ['tree','rock','log','wideLog','ramp','oil']){
  const first=createUrbanObstacle(kind);
  const second=createUrbanObstacle(kind);
  const firstMeshes=[],secondMeshes=[];
  first.traverse(object=>{if(object.isMesh)firstMeshes.push(object);});
  second.traverse(object=>{if(object.isMesh)secondMeshes.push(object);});
  assert.equal(firstMeshes.length,secondMeshes.length,`${kind} clone mesh topology changed`);
  firstMeshes.forEach((mesh,index)=>{
    assert.equal(mesh.geometry,secondMeshes[index].geometry,`${kind} clones must share geometry to avoid streaming allocations`);
    assert.equal(mesh.material,secondMeshes[index].material,`${kind} clones must share materials to avoid streaming allocations`);
  });
}

const board=createSkateboardEquipment();
assert.equal(typeof board.dispose,'function','skateboard must expose dispose()');
assert.equal(typeof board.updateMotion,'function','skateboard must expose updateMotion()');
assert.equal(board.wheels.length,4,'skateboard wheel contract changed');
board.dispose();

const optionalContracts=[
  {
    system:'street dressing',
    candidates:['src/urban/urbanStreetDressing.js','src/urban/streetDressing.js','src/urban/streetDressingSystem.js'],
    tokens:['dispose','getDiagnostics']
  },
  {
    system:'lighting/atmosphere',
    candidates:['src/urban/urbanLightingAtmosphere.js','src/urban/lightingAtmosphere.js','src/urban/urbanLighting.js'],
    tokens:['dispose','getDiagnostics']
  },
  {
    system:'start event',
    candidates:['src/urban/urbanStartEvent.js','src/urban/startEvent.js','src/urban/startEventScene.js'],
    tokens:['dispose','getDiagnostics']
  },
  {
    system:'building system',
    candidates:['src/urban/urbanBuildings.js','src/urban/buildingSystem.js'],
    tokens:['dispose','getDiagnostics']
  }
];

const optionalResults=[];
for(const contract of optionalContracts){
  const path=contract.candidates.find(candidate=>existsSync(new URL('../'+candidate,import.meta.url)));
  if(!path){
    optionalResults.push({system:contract.system,status:'PENDING'});
    continue;
  }
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  for(const token of contract.tokens){
    assert(source.includes(token),`${contract.system} is present at ${path} but does not advertise required ${token} cleanup/diagnostic contract`);
  }
  optionalResults.push({system:contract.system,status:'GUARDED',path});
}

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert(main.includes("captureGraphicsDiagnostics({renderer,scene,urbanEnvironment})"),'runtime diagnostics must expose graphics resource counts without touching the render loop');

console.log(JSON.stringify({
  check:'aaa-urban-graphics-regression-invariants',
  budgets:GRAPHICS_QUALITY_BUDGETS,
  baselines,
  simulatedMinutes,
  stability,
  optionalContracts:optionalResults
}));
