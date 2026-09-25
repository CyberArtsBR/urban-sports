import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  URBAN_OBSTACLE_DIMENSIONS,
  URBAN_OBSTACLE_FACTORIES,
  URBAN_OBSTACLE_MAPPING,
  URBAN_OBSTACLE_VARIANTS,
  createUrbanObstacle,
  disposeUrbanObstacleInstance,
  getUrbanObstacleVariantCount
} from '../src/urban/urbanObstacles.js';

const EXPECTED=Object.freeze({
  tree:{radius:.72,radiusX:.62,radiusZ:.68,clearance:3.70},
  rock:{radius:.62,radiusX:.55,radiusZ:.58,clearance:.78},
  log:{radius:1.34,radiusX:1.34,radiusZ:.48,clearance:.60},
  wideLog:{radius:3.00,radiusX:3.00,radiusZ:.58,clearance:.82},
  ramp:{radius:1.15,radiusX:1.16,radiusZ:1.58},
  oil:{radius:1.92,radiusX:1.92,radiusZ:.74,clearance:.10}
});
const MESH_BUDGET=Object.freeze({tree:5,rock:4,log:5,wideLog:5,ramp:6,oil:2});
const KINDS=Object.keys(EXPECTED);

function meshesOf(root){
  const meshes=[];
  root.traverse(child=>{if(child.isMesh)meshes.push(child);});
  return meshes;
}

function maxAbs(min,max){return Math.max(Math.abs(min),Math.abs(max));}

for(const kind of KINDS){
  assert.equal(typeof URBAN_OBSTACLE_FACTORIES[kind],'function',kind+' factory missing');
  assert.equal(typeof URBAN_OBSTACLE_MAPPING[kind],'string',kind+' mapping missing');
  assert.ok(Array.isArray(URBAN_OBSTACLE_VARIANTS[kind]),kind+' variants missing');
  assert.ok(URBAN_OBSTACLE_VARIANTS[kind].length>=3,kind+' needs meaningful visual variation');
  assert.equal(getUrbanObstacleVariantCount(kind),URBAN_OBSTACLE_VARIANTS[kind].length,kind+' variant count mismatch');

  const meta=URBAN_OBSTACLE_DIMENSIONS[kind];
  for(const [key,value] of Object.entries(EXPECTED[kind]))assert.equal(meta[key],value,kind+' exported '+key+' changed');

  for(let variant=0;variant<URBAN_OBSTACLE_VARIANTS[kind].length;variant++){
    const first=createUrbanObstacle(kind,{variant});
    const second=createUrbanObstacle(kind,{variant});

    assert.equal(first.position.y,0,kind+' root must remain ground-aligned');
    assert.equal(first.userData.kind,kind,kind+' kind metadata mismatch');
    assert.equal(first.userData.replacementFor,kind,kind+' replacement metadata mismatch');
    assert.equal(first.userData.gameplayCollisionVisualOnly,true,kind+' must remain visual-only');
    assert.equal(first.userData.variant,variant,kind+' variant metadata mismatch');
    assert.equal(first.userData.variantName,URBAN_OBSTACLE_VARIANTS[kind][variant],kind+' variant name mismatch');
    assert.equal(first.userData.semanticType,URBAN_OBSTACLE_VARIANTS[kind][variant],kind+' semantic type mismatch');
    assert.deepEqual(first.userData.recommendedScale,{x:1,y:1,z:1},kind+' recommended scale changed');
    assert.equal(first.userData.collisionHint.radiusX,meta.radiusX,kind+' collision hint width changed');
    assert.equal(first.userData.collisionHint.radiusZ,meta.radiusZ,kind+' collision hint depth changed');

    for(const [key,value] of Object.entries(EXPECTED[kind]))assert.equal(first.userData[key],value,kind+' '+key+' changed');

    const bounds=new THREE.Box3().setFromObject(first);
    assert.ok(bounds.min.y>=-1e-4,`${kind}:${variant} extends below y=0`);
    assert.ok(maxAbs(bounds.min.x,bounds.max.x)<=meta.visualHalfWidth+.16,`${kind}:${variant} exceeds visual half-width envelope`);
    assert.ok(maxAbs(bounds.min.z,bounds.max.z)<=meta.radiusZ+.18,`${kind}:${variant} exceeds longitudinal footprint envelope`);
    assert.deepEqual(first.userData.visualBounds.min,[bounds.min.x,bounds.min.y,bounds.min.z],`${kind}:${variant} visualBounds min stale`);
    assert.deepEqual(first.userData.visualBounds.max,[bounds.max.x,bounds.max.y,bounds.max.z],`${kind}:${variant} visualBounds max stale`);

    const firstMeshes=meshesOf(first);
    const secondMeshes=meshesOf(second);
    assert.ok(firstMeshes.length>0,`${kind}:${variant} has no render meshes`);
    assert.ok(firstMeshes.length<=MESH_BUDGET[kind],`${kind}:${variant} exceeds mesh/draw-call budget`);
    assert.equal(firstMeshes.length,secondMeshes.length,`${kind}:${variant} clone component count changed`);

    for(let i=0;i<firstMeshes.length;i++){
      assert.equal(firstMeshes[i].geometry,secondMeshes[i].geometry,`${kind}:${variant} geometry must be shared`);
      assert.equal(firstMeshes[i].material,secondMeshes[i].material,`${kind}:${variant} material must be shared`);
      const materials=Array.isArray(firstMeshes[i].material)?firstMeshes[i].material:[firstMeshes[i].material];
      for(const material of materials){
        const emissiveActive=material.emissive?.getHex?.()!==0;
        const emissive=emissiveActive?(Number(material.emissiveIntensity)||0):0;
        assert.ok(emissive<=.5,`${kind}:${variant} emissive intensity is too high for selective safety accents`);
      }
    }

    const sharedGeometry=secondMeshes[0].geometry;
    assert.equal(disposeUrbanObstacleInstance(first),true,`${kind}:${variant} disposal should succeed`);
    assert.equal(first.children.length,0,`${kind}:${variant} disposed root should release child references`);
    assert.equal(secondMeshes[0].geometry,sharedGeometry,`${kind}:${variant} instance disposal must not destroy pooled geometry`);
  }

  const seededA=createUrbanObstacle(kind,{seed:'course-section-42'});
  const seededB=createUrbanObstacle(kind,{seed:'course-section-42'});
  assert.equal(seededA.userData.variant,seededB.userData.variant,kind+' seeded variation must be deterministic');
  assert.equal(createUrbanObstacle(kind,{variant:-1}).userData.variant,URBAN_OBSTACLE_VARIANTS[kind].length-1,kind+' negative variant wrap failed');
  assert.equal(createUrbanObstacle(kind,{variant:URBAN_OBSTACLE_VARIANTS[kind].length}).userData.variant,0,kind+' variant wrap failed');
  assert.equal(createUrbanObstacle(kind,{variant:URBAN_OBSTACLE_VARIANTS[kind][1]}).userData.variant,1,kind+' named variant failed');
}

assert.throws(()=>createUrbanObstacle('banana'),/Unsupported urban obstacle kind/);
assert.throws(()=>createUrbanObstacle('tree',{variant:'banana'}),/Unsupported tree obstacle variant/);
assert.equal(disposeUrbanObstacleInstance(null),false,'invalid disposal target should be safe');
console.log('urban obstacle invariants: ok');
