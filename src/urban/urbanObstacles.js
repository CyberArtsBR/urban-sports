import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {OBSTACLE_TUNING} from '../obstacleTuning.js';

const TREE_META=Object.freeze({
  kind:'tree',
  semantic:'trafficCone',
  radius:.72,
  radiusX:.62,
  radiusZ:.68,
  clearance:3.70,
  visualHalfWidth:1.25,
  yOffset:0
});
const ROCK_META=Object.freeze({
  kind:'rock',
  semantic:'jerseyBarrier',
  radius:.62,
  radiusX:.55,
  radiusZ:.58,
  clearance:.78,
  visualHalfWidth:.90,
  yOffset:0
});
const RAMP_META=Object.freeze({
  kind:'ramp',
  semantic:'streetRamp',
  radius:1.15,
  radiusX:1.16,
  radiusZ:1.58,
  visualHalfWidth:1.17,
  yOffset:0
});

function tunedMeta(kind,semantic){
  const tuning=OBSTACLE_TUNING[kind];
  return Object.freeze({
    kind,
    semantic,
    radius:tuning.collisionHalfWidth,
    radiusX:tuning.collisionHalfWidth,
    radiusZ:tuning.radiusZ,
    clearance:tuning.clearance,
    visualHalfWidth:tuning.visualHalfWidth,
    yOffset:0
  });
}

export const URBAN_OBSTACLE_DIMENSIONS=Object.freeze({
  tree:TREE_META,
  rock:ROCK_META,
  log:tunedMeta('log','constructionBarricade'),
  wideLog:tunedMeta('wideLog','wideConstructionBarricade'),
  ramp:RAMP_META,
  oil:tunedMeta('oil','oilWetPatch')
});

export const URBAN_OBSTACLE_MAPPING=Object.freeze({
  tree:'large street traffic cone / construction hazard',
  rock:'concrete road / jersey barrier',
  log:'horizontal construction barricade',
  wideLog:'wide roadwork barricade',
  ramp:'urban skateboard / street ramp',
  oil:'oil / wet road hazard'
});

let shared=null;
const prototypes=new Map();

function makeMaterials(){
  return Object.freeze({
    cone:new THREE.MeshStandardMaterial({
      color:0xff6417,roughness:.48,metalness:0
    }),
    reflective:new THREE.MeshStandardMaterial({
      color:0xf4f2de,roughness:.30,metalness:.02,
      emissive:0x3b392d,emissiveIntensity:.18
    }),
    amber:new THREE.MeshStandardMaterial({
      color:0xffad24,roughness:.30,metalness:.05,
      emissive:0x7a3500,emissiveIntensity:.42
    }),
    rubber:new THREE.MeshStandardMaterial({
      color:0x17191c,roughness:.80,metalness:.03
    }),
    concrete:new THREE.MeshStandardMaterial({
      color:0xaaa9a2,roughness:.90,metalness:.01
    }),
    concreteStripe:new THREE.MeshStandardMaterial({
      color:0xe9e8dc,roughness:.48,metalness:.02,
      emissive:0x292820,emissiveIntensity:.10
    }),
    barricade:new THREE.MeshStandardMaterial({
      color:0xf47720,roughness:.54,metalness:.02,
      emissive:0x251004,emissiveIntensity:.08
    }),
    darkMetal:new THREE.MeshStandardMaterial({
      color:0x252a2f,roughness:.62,metalness:.58
    }),
    ramp:new THREE.MeshStandardMaterial({
      color:0x30383f,roughness:.43,metalness:.56
    }),
    rampAccent:new THREE.MeshStandardMaterial({
      color:0xf1d34f,roughness:.36,metalness:.08,
      emissive:0x3b3108,emissiveIntensity:.22
    }),
    oil:new THREE.MeshPhysicalMaterial({
      color:0x11161b,roughness:.20,metalness:.10,
      clearcoat:.72,clearcoatRoughness:.16,
      transparent:true,opacity:.94,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
    }),
    oilSheen:new THREE.MeshPhysicalMaterial({
      color:0x7f9eb2,roughness:.08,metalness:.08,
      clearcoat:1,clearcoatRoughness:.08,
      transparent:true,opacity:.20,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
    })
  });
}

function mergedBoxes(specs){
  const pieces=specs.map(spec=>{
    const geometry=new THREE.BoxGeometry(spec.w,spec.h,spec.d);
    if(spec.rx)geometry.rotateX(spec.rx);
    if(spec.ry)geometry.rotateY(spec.ry);
    if(spec.rz)geometry.rotateZ(spec.rz);
    geometry.translate(spec.x||0,spec.y||0,spec.z||0);
    return geometry;
  });
  const merged=mergeGeometries(pieces,false);
  for(const piece of pieces)piece.dispose();
  return merged;
}

function jerseyGeometry(){
  const shape=new THREE.Shape();
  shape.moveTo(-.82,0);
  shape.lineTo(.82,0);
  shape.lineTo(.82,.16);
  shape.lineTo(.48,.82);
  shape.lineTo(-.48,.82);
  shape.lineTo(-.82,.16);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{
    depth:.82,steps:1,bevelEnabled:false,curveSegments:1
  });
  geometry.translate(0,0,-.41);
  geometry.computeVertexNormals();
  return geometry;
}

function rampGeometry(){
  const w=2.30,front=1.54,back=-1.54,frontH=.08,backH=.74;
  const positions=new Float32Array([
    -w/2,0,front, w/2,0,front, -w/2,frontH,front, w/2,frontH,front,
    -w/2,0,back,  w/2,0,back,  -w/2,backH,back,  w/2,backH,back
  ]);
  const indices=[
    2,3,7, 2,7,6,
    0,4,5, 0,5,1,
    0,1,3, 0,3,2,
    4,6,7, 4,7,5,
    0,2,6, 0,6,4,
    1,5,7, 1,7,3
  ];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function patchGeometry(scaleX,scaleZ,segments=40,phase=.37){
  const positions=[0,0,0];
  const indices=[];
  for(let i=0;i<segments;i++){
    const angle=i/segments*Math.PI*2;
    const contour=.91+
      Math.sin(angle*3+phase)*.055+
      Math.sin(angle*5-phase*.7)*.035+
      Math.cos(angle*7+phase*1.4)*.018;
    positions.push(
      Math.cos(angle)*scaleX*contour,
      0,
      Math.sin(angle)*scaleZ*contour
    );
  }
  for(let i=0;i<segments;i++)indices.push(0,1+((i+1)%segments),1+i);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function getShared(){
  if(shared)return shared;
  const materials=makeMaterials();
  const geometries=Object.freeze({
    cone:new THREE.CylinderGeometry(.12,.72,2.84,12,1,false),
    coneStripeA:new THREE.CylinderGeometry(.27,.36,.26,12,1,false),
    coneStripeB:new THREE.CylinderGeometry(.19,.25,.22,12,1,false),
    coneBase:new THREE.BoxGeometry(1.58,.16,1.58),
    beacon:new THREE.CylinderGeometry(.13,.16,.24,10,1,false),
    jersey:jerseyGeometry(),
    ramp:rampGeometry(),
    oil:patchGeometry(OBSTACLE_TUNING.oil.visualScaleX,OBSTACLE_TUNING.oil.visualScaleZ,40,.37),
    oilSheen:patchGeometry(1.18,.18,24,1.9)
  });
  shared={materials,geometries};
  return shared;
}

function mesh(geometry,material,{castShadow=true,receiveShadow=true,name=''}={}){
  const item=new THREE.Mesh(geometry,material);
  item.castShadow=castShadow;
  item.receiveShadow=receiveShadow;
  item.name=name;
  return item;
}

function finalize(root,meta,name){
  root.name=name;
  root.position.y=0;
  root.userData={
    ...meta,
    urbanObstacle:true,
    gameplayCollisionVisualOnly:true,
    replacementFor:meta.kind,
    visualSemantic:meta.semantic
  };
  return root;
}

function conePrototype(){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();

  const base=mesh(geometries.coneBase,materials.rubber,{name:'cone-base'});
  base.position.y=.08;

  const body=mesh(geometries.cone,materials.cone,{name:'cone-body'});
  body.position.y=1.58;

  const stripesGeometry=mergeGeometries([
    geometries.coneStripeA.clone().translate(0,1.55,0),
    geometries.coneStripeB.clone().translate(0,2.05,0)
  ],false);
  const stripes=mesh(stripesGeometry,materials.reflective,{name:'cone-reflective-bands'});

  const beacon=mesh(geometries.beacon,materials.amber,{name:'cone-safety-beacon'});
  beacon.position.y=3.08;

  root.add(base,body,stripes,beacon);
  return finalize(root,TREE_META,'UrbanObstacle_TrafficCone');
}

function jerseyPrototype(){
  const {materials}=getShared();
  const root=new THREE.Group();
  const barrier=mesh(getShared().geometries.jersey,materials.concrete,{name:'jersey-barrier'});
  const stripeGeometry=mergedBoxes([
    {w:.64,h:.11,d:.018,x:0,y:.57,z:.421},
    {w:.64,h:.11,d:.018,x:0,y:.57,z:-.421}
  ]);
  const stripe=mesh(stripeGeometry,materials.concreteStripe,{name:'barrier-reflectors',castShadow:false});
  root.add(barrier,stripe);
  return finalize(root,ROCK_META,'UrbanObstacle_JerseyBarrier');
}

function barricadePrototype(kind,width,height,depth){
  const {materials}=getShared();
  const root=new THREE.Group();
  const postX=Math.max(.62,width*.5-.24);
  const railH=kind==='wideLog'?.28:.24;
  const railY=height-railH*.5;
  const rail=mesh(
    mergedBoxes([{w:width,h:railH,d:.16,x:0,y:railY,z:0}]),
    materials.barricade,
    {name:'barricade-rail'}
  );
  const frame=mesh(
    mergedBoxes([
      {w:.12,h:height-.10,d:.12,x:-postX,y:(height-.10)*.5,z:0},
      {w:.12,h:height-.10,d:.12,x: postX,y:(height-.10)*.5,z:0},
      {w:.58,h:.08,d:depth,x:-postX,y:.04,z:0},
      {w:.58,h:.08,d:depth,x: postX,y:.04,z:0}
    ]),
    materials.darkMetal,
    {name:'barricade-frame'}
  );
  const segmentCount=kind==='wideLog'?7:3;
  const reflectorWidth=width/(segmentCount*1.8);
  const reflectors=[];
  for(let i=0;i<segmentCount;i++){
    const x=-width*.5+width*(i+.5)/segmentCount;
    reflectors.push({w:reflectorWidth,h:railH*.55,d:.018,x,y:railY,z:.089});
  }
  const reflective=mesh(
    mergedBoxes(reflectors),
    materials.reflective,
    {name:'barricade-reflectors',castShadow:false}
  );
  root.add(frame,rail,reflective);
  return finalize(
    root,
    URBAN_OBSTACLE_DIMENSIONS[kind],
    kind==='wideLog'?'UrbanObstacle_WideBarricade':'UrbanObstacle_Barricade'
  );
}

function rampPrototype(){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();
  const body=mesh(geometries.ramp,materials.ramp,{name:'street-ramp'});

  const angle=Math.atan((.74-.08)/(1.54-(-1.54)));
  const rails=mesh(
    mergedBoxes([
      {w:.10,h:.08,d:3.00,x:-1.10,y:.43,z:0,rx:angle},
      {w:.10,h:.08,d:3.00,x: 1.10,y:.43,z:0,rx:angle}
    ]),
    materials.darkMetal,
    {name:'ramp-edge-rails'}
  );
  const accents=mesh(
    mergedBoxes([
      {w:1.86,h:.026,d:.22,x:0,y:.135,z:1.33,rx:angle},
      {w:1.86,h:.026,d:.14,x:0,y:.690,z:-1.29,rx:angle}
    ]),
    materials.rampAccent,
    {name:'ramp-safety-accents',castShadow:false}
  );
  root.add(body,rails,accents);
  return finalize(root,RAMP_META,'UrbanObstacle_StreetRamp');
}

function oilPrototype(){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();
  const patch=mesh(geometries.oil,materials.oil,{
    name:'road-oil-patch',castShadow:false,receiveShadow:false
  });
  patch.position.y=.012;

  const sheen=mesh(geometries.oilSheen,materials.oilSheen,{
    name:'road-oil-sheen',castShadow:false,receiveShadow:false
  });
  sheen.position.set(.18,.014,-.03);
  sheen.rotation.y=.22;
  root.add(patch,sheen);
  return finalize(root,URBAN_OBSTACLE_DIMENSIONS.oil,'UrbanObstacle_OilWetPatch');
}

function getPrototype(kind){
  if(prototypes.has(kind))return prototypes.get(kind);
  let prototype;
  if(kind==='tree')prototype=conePrototype();
  else if(kind==='rock')prototype=jerseyPrototype();
  else if(kind==='log')prototype=barricadePrototype('log',OBSTACLE_TUNING.log.length,.64,.72);
  else if(kind==='wideLog')prototype=barricadePrototype('wideLog',OBSTACLE_TUNING.wideLog.length,.86,.94);
  else if(kind==='ramp')prototype=rampPrototype();
  else if(kind==='oil')prototype=oilPrototype();
  else throw new Error('Unsupported urban obstacle kind: '+kind);
  prototypes.set(kind,prototype);
  return prototype;
}

function cloneObstacle(kind){
  const clone=getPrototype(kind).clone(true);
  clone.position.set(0,0,0);
  clone.rotation.set(0,0,0);
  clone.scale.set(1,1,1);
  clone.userData={...getPrototype(kind).userData};
  return clone;
}

export function createTrafficConeObstacle(){return cloneObstacle('tree');}
export function createConcreteBarrierObstacle(){return cloneObstacle('rock');}
export function createConstructionBarricadeObstacle(){return cloneObstacle('log');}
export function createWideConstructionBarricadeObstacle(){return cloneObstacle('wideLog');}
export function createUrbanRampObstacle(){return cloneObstacle('ramp');}
export function createUrbanOilHazard(){return cloneObstacle('oil');}

export const URBAN_OBSTACLE_FACTORIES=Object.freeze({
  tree:createTrafficConeObstacle,
  rock:createConcreteBarrierObstacle,
  log:createConstructionBarricadeObstacle,
  wideLog:createWideConstructionBarricadeObstacle,
  ramp:createUrbanRampObstacle,
  oil:createUrbanOilHazard
});

export function createUrbanObstacle(kind){
  const factory=URBAN_OBSTACLE_FACTORIES[kind];
  if(!factory)throw new Error('Unsupported urban obstacle kind: '+kind);
  return factory();
}

export function createUrbanObstaclePrototypes(){
  return {
    tree:createTrafficConeObstacle(),
    rock:createConcreteBarrierObstacle(),
    log:createConstructionBarricadeObstacle(),
    wideLog:createWideConstructionBarricadeObstacle(),
    oil:createUrbanOilHazard(),
    ramp:createUrbanRampObstacle()
  };
}
