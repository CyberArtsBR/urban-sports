import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  URBAN_OBSTACLE_DIMENSIONS,
  URBAN_OBSTACLE_FACTORIES,
  URBAN_OBSTACLE_MAPPING,
  createUrbanObstacle
} from '../src/urban/urbanObstacles.js';

const EXPECTED=Object.freeze({
  tree:{radius:.72,radiusX:.62,radiusZ:.68,clearance:3.70},
  rock:{radius:.62,radiusX:.55,radiusZ:.58,clearance:.78},
  log:{radius:1.34,radiusX:1.34,radiusZ:.48,clearance:.60},
  wideLog:{radius:3.00,radiusX:3.00,radiusZ:.58,clearance:.82},
  ramp:{radius:1.15,radiusX:1.16,radiusZ:1.58},
  oil:{radius:1.92,radiusX:1.92,radiusZ:.74,clearance:.10}
});
const MESH_BUDGET=Object.freeze({
  tree:4,
  rock:2,
  log:3,
  wideLog:3,
  ramp:3,
  oil:2
});

function meshesOf(root){
  const meshes=[];
  root.traverse(child=>{if(child.isMesh)meshes.push(child);});
  return meshes;
}

for(const kind of Object.keys(EXPECTED)){
  assert.equal(typeof URBAN_OBSTACLE_FACTORIES[kind],'function',kind+' factory missing');
  assert.equal(typeof URBAN_OBSTACLE_MAPPING[kind],'string',kind+' mapping missing');

  const meta=URBAN_OBSTACLE_DIMENSIONS[kind];
  const first=createUrbanObstacle(kind);
  const second=createUrbanObstacle(kind);

  assert.equal(first.position.y,0,kind+' root must remain ground-aligned');
  assert.equal(first.userData.kind,kind,kind+' kind metadata mismatch');
  assert.equal(first.userData.replacementFor,kind,kind+' replacement metadata mismatch');
  assert.equal(first.userData.gameplayCollisionVisualOnly,true,kind+' must remain visual-only');

  for(const [key,value] of Object.entries(EXPECTED[kind])){
    assert.equal(first.userData[key],value,kind+' '+key+' changed');
    assert.equal(meta[key],value,kind+' exported '+key+' changed');
  }

  const bounds=new THREE.Box3().setFromObject(first);
  assert.ok(bounds.min.y>=-1e-5,kind+' extends below y=0');
  assert.ok(
    Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))<=meta.visualHalfWidth+.16,
    kind+' exceeds visual half-width envelope'
  );
  assert.ok(
    Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))<=meta.radiusZ+.18,
    kind+' exceeds longitudinal footprint envelope'
  );

  const firstMeshes=meshesOf(first);
  const secondMeshes=meshesOf(second);
  assert.ok(firstMeshes.length>0,kind+' has no render meshes');
  assert.ok(firstMeshes.length<=MESH_BUDGET[kind],kind+' exceeds mesh/draw-call budget');
  assert.equal(firstMeshes.length,secondMeshes.length,kind+' clone component count changed');

  for(let i=0;i<firstMeshes.length;i++){
    assert.equal(firstMeshes[i].geometry,secondMeshes[i].geometry,kind+' geometry must be shared');
    assert.equal(firstMeshes[i].material,secondMeshes[i].material,kind+' material must be shared');
    const materials=Array.isArray(firstMeshes[i].material)?firstMeshes[i].material:[firstMeshes[i].material];
    for(const material of materials){
      const emissiveActive=material.emissive?.getHex?.()!==0;
      const emissive=emissiveActive?(Number(material.emissiveIntensity)||0):0;
      assert.ok(emissive<=.5,kind+' emissive intensity is too high for obstacle safety accents');
    }
  }
}

assert.throws(()=>createUrbanObstacle('banana'),/Unsupported urban obstacle kind/);
console.log('urban obstacle invariants: ok');
