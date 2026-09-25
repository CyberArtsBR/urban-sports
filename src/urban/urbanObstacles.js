import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {OBSTACLE_TUNING} from '../obstacleTuning.js';

const TREE_META=Object.freeze({kind:'tree',semantic:'constructionHazard',radius:.72,radiusX:.62,radiusZ:.68,clearance:3.70,visualHalfWidth:1.25,yOffset:0});
const ROCK_META=Object.freeze({kind:'rock',semantic:'concreteBlocker',radius:.62,radiusX:.55,radiusZ:.58,clearance:.78,visualHalfWidth:.90,yOffset:0});
const RAMP_META=Object.freeze({kind:'ramp',semantic:'streetRamp',radius:1.15,radiusX:1.16,radiusZ:1.58,visualHalfWidth:1.17,yOffset:0});

function tunedMeta(kind,semantic){
  const tuning=OBSTACLE_TUNING[kind];
  return Object.freeze({kind,semantic,radius:tuning.collisionHalfWidth,radiusX:tuning.collisionHalfWidth,radiusZ:tuning.radiusZ,clearance:tuning.clearance,visualHalfWidth:tuning.visualHalfWidth,yOffset:0});
}

export const URBAN_OBSTACLE_DIMENSIONS=Object.freeze({
  tree:TREE_META,
  rock:ROCK_META,
  log:tunedMeta('log','horizontalBarricade'),
  wideLog:tunedMeta('wideLog','wideRoadworkBarricade'),
  ramp:RAMP_META,
  oil:tunedMeta('oil','roadSurfaceHazard')
});

export const URBAN_OBSTACLE_MAPPING=Object.freeze({
  tree:'construction hazard family',
  rock:'concrete blocker / jersey barrier family',
  log:'horizontal barricade family',
  wideLog:'large roadwork barricade family',
  ramp:'premium street / skate ramp family',
  oil:'wet / oil / grime road hazard family'
});

export const URBAN_OBSTACLE_VARIANTS=Object.freeze({
  tree:Object.freeze(['weightedTrafficCone','stripedConstructionDrum','bollardCluster','portableWarningBeacon','temporaryTrafficSign','waterBarrierEnd']),
  rock:Object.freeze(['jerseyBarrier','concreteCubeBarrier','precastDivider','constructionBlock','heavyPlanterBarrier']),
  log:Object.freeze(['woodConstructionBarricade','metalPoliceBarricade','roadClosureStand','stripedSawhorse']),
  wideLog:Object.freeze(['multiPanelBarricade','temporaryConstructionFence','linkedWaterBarriers','wideStreetClosureGate']),
  ramp:Object.freeze(['portableSteelKicker','plywoodSteelKicker','concreteStreetKicker','constructionPlateLaunch','eventBrandedRamp','graffitiRamp']),
  oil:Object.freeze(['oilSlick','wetRoadPatch','roadGrimePatch'])
});

let shared=null;
const prototypes=new Map();

function makeMaterials(){
  return Object.freeze({
    orange:new THREE.MeshStandardMaterial({color:0xf55c17,roughness:.48,metalness:.02}),
    yellow:new THREE.MeshStandardMaterial({color:0xf2c230,roughness:.43,metalness:.03}),
    white:new THREE.MeshStandardMaterial({color:0xf2f1e8,roughness:.36,metalness:.02}),
    reflective:new THREE.MeshStandardMaterial({color:0xf7f5df,roughness:.27,metalness:.05,emissive:0x302d20,emissiveIntensity:.14}),
    amber:new THREE.MeshStandardMaterial({color:0xffa626,roughness:.28,metalness:.05,emissive:0x6b2d00,emissiveIntensity:.38}),
    rubber:new THREE.MeshStandardMaterial({color:0x15181b,roughness:.84,metalness:.02}),
    warningBlack:new THREE.MeshStandardMaterial({color:0x242629,roughness:.65,metalness:.18}),
    darkMetal:new THREE.MeshStandardMaterial({color:0x293038,roughness:.48,metalness:.70}),
    silver:new THREE.MeshStandardMaterial({color:0xaeb7bc,roughness:.34,metalness:.82}),
    concrete:new THREE.MeshStandardMaterial({color:0xaaa9a0,roughness:.91,metalness:.01}),
    concreteDark:new THREE.MeshStandardMaterial({color:0x777973,roughness:.93,metalness:.01}),
    wood:new THREE.MeshStandardMaterial({color:0xa95e2c,roughness:.78,metalness:.01}),
    plywood:new THREE.MeshStandardMaterial({color:0xb9834d,roughness:.67,metalness:.02}),
    rampSteel:new THREE.MeshStandardMaterial({color:0x39434b,roughness:.40,metalness:.66}),
    rampBlack:new THREE.MeshStandardMaterial({color:0x20262c,roughness:.58,metalness:.46}),
    rampConcrete:new THREE.MeshStandardMaterial({color:0x898c89,roughness:.87,metalness:.02}),
    blueAccent:new THREE.MeshStandardMaterial({color:0x1fa2ff,roughness:.34,metalness:.15,emissive:0x052a42,emissiveIntensity:.18}),
    pinkAccent:new THREE.MeshStandardMaterial({color:0xe94d9b,roughness:.38,metalness:.08}),
    greenAccent:new THREE.MeshStandardMaterial({color:0x63cc77,roughness:.52,metalness:.02}),
    dirt:new THREE.MeshStandardMaterial({color:0x473a31,roughness:.95,metalness:0}),
    oil:new THREE.MeshPhysicalMaterial({color:0x11161b,roughness:.20,metalness:.10,clearcoat:.72,clearcoatRoughness:.16,transparent:true,opacity:.94,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
    wet:new THREE.MeshPhysicalMaterial({color:0x26363f,roughness:.16,metalness:.04,clearcoat:.86,clearcoatRoughness:.12,transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
    oilSheen:new THREE.MeshPhysicalMaterial({color:0x769aae,roughness:.08,metalness:.08,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.20,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})
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

function mergedCylinders(specs){
  const pieces=specs.map(spec=>{
    const geometry=new THREE.CylinderGeometry(spec.rt??spec.r,spec.rb??spec.r,spec.h,spec.segments??10,1,false);
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

function diamondGeometry(size=.94,depth=.08){
  const geometry=new THREE.BoxGeometry(size,size,depth);
  geometry.rotateZ(Math.PI/4);
  return geometry;
}

function jerseyGeometry(width=1.64,height=.78,depth=.82){
  const shape=new THREE.Shape();
  const hw=width*.5;
  shape.moveTo(-hw,0);
  shape.lineTo(hw,0);
  shape.lineTo(hw,.14);
  shape.lineTo(hw*.58,height);
  shape.lineTo(-hw*.58,height);
  shape.lineTo(-hw,.14);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:1});
  geometry.translate(0,0,-depth*.5);
  geometry.computeVertexNormals();
  return geometry;
}

function rampGeometry(){
  const w=2.30,front=1.54,back=-1.54,frontH=.08,backH=.74;
  const positions=new Float32Array([
    -w/2,0,front, w/2,0,front, -w/2,frontH,front, w/2,frontH,front,
    -w/2,0,back,  w/2,0,back,  -w/2,backH,back,  w/2,backH,back
  ]);
  const indices=[2,3,7,2,7,6, 0,4,5,0,5,1, 0,1,3,0,3,2, 4,6,7,4,7,5, 0,2,6,0,6,4, 1,5,7,1,7,3];
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
    const contour=.91+Math.sin(angle*3+phase)*.055+Math.sin(angle*5-phase*.7)*.035+Math.cos(angle*7+phase*1.4)*.018;
    positions.push(Math.cos(angle)*scaleX*contour,0,Math.sin(angle)*scaleZ*contour);
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
    drum:new THREE.CylinderGeometry(.48,.52,2.42,12,1,false),
    drumBand:new THREE.CylinderGeometry(.525,.525,.18,12,1,false),
    beacon:new THREE.CylinderGeometry(.13,.16,.24,10,1,false),
    jersey:jerseyGeometry(),
    ramp:rampGeometry(),
    oil:patchGeometry(OBSTACLE_TUNING.oil.visualScaleX,OBSTACLE_TUNING.oil.visualScaleZ,40,.37),
    wet:patchGeometry(2.00,.74,38,1.15),
    grime:patchGeometry(1.94,.70,34,2.35),
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

function hashString(value){
  let hash=2166136261;
  const text=String(value??'urban-obstacle');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function resolveVariant(kind,options={}){
  const names=URBAN_OBSTACLE_VARIANTS[kind];
  if(!names)throw new Error('Unsupported urban obstacle kind: '+kind);
  const raw=typeof options==='number'?options:options.variant;
  if(typeof raw==='string'){
    const index=names.indexOf(raw);
    if(index<0)throw new Error(`Unsupported ${kind} obstacle variant: ${raw}`);
    return index;
  }
  if(Number.isFinite(Number(raw))){
    const n=Math.trunc(Number(raw));
    return ((n%names.length)+names.length)%names.length;
  }
  if(options&&options.seed!==undefined)return hashString(`${kind}:${options.seed}`)%names.length;
  return 0;
}

function finalize(root,meta,name,variant,semanticType){
  root.name=name;
  root.position.y=0;
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);
  const size=new THREE.Vector3();
  bounds.getSize(size);
  root.userData={
    ...meta,
    urbanObstacle:true,
    gameplayCollisionVisualOnly:true,
    replacementFor:meta.kind,
    visualSemantic:semanticType,
    semanticType,
    variant,
    variantName:URBAN_OBSTACLE_VARIANTS[meta.kind][variant],
    recommendedScale:Object.freeze({x:1,y:1,z:1}),
    collisionHint:Object.freeze({radius:meta.radius,radiusX:meta.radiusX,radiusZ:meta.radiusZ,clearance:meta.clearance??null,yOffset:0}),
    visualBounds:Object.freeze({min:Object.freeze([bounds.min.x,bounds.min.y,bounds.min.z]),max:Object.freeze([bounds.max.x,bounds.max.y,bounds.max.z]),size:Object.freeze([size.x,size.y,size.z])})
  };
  return root;
}

function addStripeBlocks(root,{width,y,z=.091,count=5,height=.12,depth=.022,material}){
  const specs=[];
  const cell=width/count;
  for(let i=0;i<count;i+=2)specs.push({w:cell*.78,h:height,d:depth,x:-width*.5+cell*(i+.5),y,z});
  if(specs.length)root.add(mesh(mergedBoxes(specs),material,{name:'warning-reflectors',castShadow:false}));
}

function treePrototype(variant){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();
  if(variant===0){
    const base=mesh(geometries.coneBase,materials.rubber,{name:'weighted-base'});base.position.y=.08;
    const body=mesh(geometries.cone,materials.orange,{name:'cone-body'});body.position.y=1.58;
    const stripesGeometry=mergeGeometries([geometries.coneStripeA.clone().translate(0,1.55,0),geometries.coneStripeB.clone().translate(0,2.05,0)],false);
    const stripes=mesh(stripesGeometry,materials.reflective,{name:'reflective-bands',castShadow:false});
    const beacon=mesh(geometries.beacon,materials.amber,{name:'safety-beacon',castShadow:false});beacon.position.y=3.08;
    root.add(base,body,stripes,beacon);
    return finalize(root,TREE_META,'UrbanObstacle_WeightedTrafficCone',variant,'weightedTrafficCone');
  }
  if(variant===1){
    const base=mesh(mergedCylinders([{r:.58,h:.14,y:.07,segments:12}]),materials.rubber,{name:'drum-weighted-base'});
    const drum=mesh(geometries.drum,materials.orange,{name:'construction-drum'});drum.position.y=1.35;
    const bands=mesh(mergeGeometries([geometries.drumBand.clone().translate(0,.92,0),geometries.drumBand.clone().translate(0,1.62,0)],false),materials.reflective,{name:'drum-reflective-bands',castShadow:false});
    const top=mesh(mergedCylinders([{r:.31,h:.14,y:2.63,segments:12},{rt:.10,rb:.14,h:.24,y:2.82,segments:10}]),materials.warningBlack,{name:'drum-cap'});
    const beacon=mesh(geometries.beacon,materials.amber,{name:'drum-beacon',castShadow:false});beacon.position.y=3.02;
    root.add(base,drum,bands,top,beacon);
    return finalize(root,TREE_META,'UrbanObstacle_ConstructionDrum',variant,'stripedConstructionDrum');
  }
  if(variant===2){
    const bases=mesh(mergedCylinders([{r:.25,h:.10,x:-.34,y:.05,z:.10,segments:10},{r:.25,h:.10,x:.34,y:.05,z:.10,segments:10},{r:.25,h:.10,x:0,y:.05,z:-.28,segments:10}]),materials.rubber,{name:'bollard-bases'});
    const posts=mesh(mergedCylinders([{r:.105,h:2.30,x:-.34,y:1.20,z:.10,segments:10},{r:.105,h:2.30,x:.34,y:1.20,z:.10,segments:10},{r:.105,h:2.30,x:0,y:1.20,z:-.28,segments:10}]),materials.orange,{name:'bollard-posts'});
    const bands=mesh(mergedCylinders([{r:.108,h:.16,x:-.34,y:1.70,z:.10,segments:10},{r:.108,h:.16,x:.34,y:1.70,z:.10,segments:10},{r:.108,h:.16,x:0,y:1.70,z:-.28,segments:10}]),materials.reflective,{name:'bollard-bands',castShadow:false});
    root.add(bases,posts,bands);
    return finalize(root,TREE_META,'UrbanObstacle_BollardCluster',variant,'bollardCluster');
  }
  if(variant===3){
    const base=mesh(mergedBoxes([{w:.86,h:.14,d:.68,y:.07},{w:.46,h:.12,d:.44,y:.18}]),materials.rubber,{name:'beacon-base'});
    const stand=mesh(mergedBoxes([{w:.10,h:1.72,d:.10,x:-.30,y:1.04},{w:.10,h:1.72,d:.10,x:.30,y:1.04},{w:.68,h:.10,d:.12,y:.46},{w:.68,h:.10,d:.12,y:1.64}]),materials.darkMetal,{name:'beacon-stand'});
    const panel=mesh(mergedBoxes([{w:.94,h:.68,d:.10,y:2.12}]),materials.yellow,{name:'warning-panel'});
    addStripeBlocks(root,{width:.84,y:2.12,z:.061,count:5,height:.18,material:materials.warningBlack});
    const lamp=mesh(geometries.beacon,materials.amber,{name:'warning-beacon',castShadow:false});lamp.position.y=2.70;
    root.add(base,stand,panel,lamp);
    return finalize(root,TREE_META,'UrbanObstacle_PortableWarningBeacon',variant,'portableWarningBeacon');
  }
  if(variant===4){
    const feet=mesh(mergedBoxes([{w:.64,h:.08,d:.24,x:-.30,y:.04,z:0},{w:.64,h:.08,d:.24,x:.30,y:.04,z:0}]),materials.rubber,{name:'sign-feet'});
    const frame=mesh(mergedBoxes([{w:.09,h:2.25,d:.09,x:-.33,y:1.16},{w:.09,h:2.25,d:.09,x:.33,y:1.16},{w:.78,h:.08,d:.09,y:.42}]),materials.darkMetal,{name:'sign-frame'});
    const sign=mesh(diamondGeometry(.92,.08),materials.yellow,{name:'temporary-warning-sign'});sign.position.y=2.12;
    const inset=mesh(diamondGeometry(.58,.018),materials.warningBlack,{name:'warning-sign-inset',castShadow:false});inset.position.set(0,2.12,.051);
    root.add(feet,frame,sign,inset);
    return finalize(root,TREE_META,'UrbanObstacle_TemporaryTrafficSign',variant,'temporaryTrafficSign');
  }
  const body=mesh(mergedBoxes([{w:1.18,h:.72,d:1.18,y:.36},{w:.96,h:.18,d:1.08,y:.79}]),materials.orange,{name:'water-barrier-end'});
  const ribs=mesh(mergedBoxes([{w:.07,h:.56,d:1.20,x:-.38,y:.39},{w:.07,h:.56,d:1.20,x:.38,y:.39}]),materials.warningBlack,{name:'barrier-ribs'});
  const mast=mesh(mergedBoxes([{w:.11,h:1.72,d:.11,y:1.67}]),materials.darkMetal,{name:'barrier-marker-mast'});
  const panel=mesh(mergedBoxes([{w:.86,h:.46,d:.08,y:2.46}]),materials.white,{name:'barrier-marker-panel'});
  addStripeBlocks(root,{width:.78,y:2.46,z:.051,count:5,height:.24,material:materials.orange});
  root.add(body,ribs,mast,panel);
  return finalize(root,TREE_META,'UrbanObstacle_WaterBarrierEnd',variant,'waterBarrierEnd');
}

function rockPrototype(variant){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();
  if(variant===0){
    root.add(mesh(geometries.jersey,materials.concrete,{name:'jersey-barrier'}));
    const reflectors=mesh(mergedBoxes([{w:.54,h:.10,d:.018,x:-.38,y:.55,z:.421},{w:.54,h:.10,d:.018,x:.38,y:.55,z:.421},{w:.54,h:.10,d:.018,x:-.38,y:.55,z:-.421},{w:.54,h:.10,d:.018,x:.38,y:.55,z:-.421}]),materials.reflective,{name:'jersey-reflectors',castShadow:false});
    root.add(reflectors);
    return finalize(root,ROCK_META,'UrbanObstacle_JerseyBarrier',variant,'jerseyBarrier');
  }
  if(variant===1){
    const body=mesh(mergedBoxes([{w:1.62,h:.68,d:1.10,y:.34},{w:1.48,h:.10,d:.96,y:.73}]),materials.concrete,{name:'concrete-cube'});
    const belt=mesh(mergedBoxes([{w:1.65,h:.12,d:.05,y:.49,z:.56},{w:1.65,h:.12,d:.05,y:.49,z:-.56}]),materials.yellow,{name:'cube-warning-belt'});
    const feet=mesh(mergedBoxes([{w:.28,h:.08,d:.20,x:-.54,y:.04,z:.43},{w:.28,h:.08,d:.20,x:.54,y:.04,z:.43},{w:.28,h:.08,d:.20,x:-.54,y:.04,z:-.43},{w:.28,h:.08,d:.20,x:.54,y:.04,z:-.43}]),materials.concreteDark,{name:'cube-feet'});
    root.add(body,belt,feet);
    return finalize(root,ROCK_META,'UrbanObstacle_ConcreteCubeBarrier',variant,'concreteCubeBarrier');
  }
  if(variant===2){
    const core=mesh(jerseyGeometry(1.70,.70,.70),materials.concreteDark,{name:'precast-divider'});
    const caps=mesh(mergedBoxes([{w:.18,h:.08,d:.76,x:-.70,y:.74},{w:.18,h:.08,d:.76,x:.70,y:.74}]),materials.concrete,{name:'precast-cap-plates'});
    const marks=mesh(mergedBoxes([{w:.34,h:.16,d:.02,x:-.42,y:.45,z:.36},{w:.34,h:.16,d:.02,x:.42,y:.45,z:.36}]),materials.reflective,{name:'precast-reflectors',castShadow:false});
    root.add(core,caps,marks);
    return finalize(root,ROCK_META,'UrbanObstacle_PrecastDivider',variant,'precastDivider');
  }
  if(variant===3){
    const blocks=mesh(mergedBoxes([{w:1.56,h:.36,d:1.08,y:.18},{w:1.30,h:.32,d:.90,y:.52},{w:.82,h:.10,d:.72,y:.73}]),materials.concrete,{name:'stacked-construction-blocks'});
    const band=mesh(mergedBoxes([{w:1.58,h:.11,d:.025,y:.42,z:.553}]),materials.orange,{name:'construction-block-warning-band'});
    root.add(blocks,band);
    return finalize(root,ROCK_META,'UrbanObstacle_ConstructionBlock',variant,'constructionBlock');
  }
  const planter=mesh(mergedBoxes([{w:1.68,h:.56,d:1.18,y:.28},{w:1.52,h:.12,d:1.02,y:.62}]),materials.concrete,{name:'heavy-planter'});
  const soil=mesh(mergedBoxes([{w:1.32,h:.07,d:.82,y:.70}]),materials.dirt,{name:'planter-soil'});
  const foliage=mesh(mergedBoxes([{w:.42,h:.30,d:.42,x:-.42,y:.88},{w:.50,h:.34,d:.46,x:.18,y:.90,z:.08},{w:.34,h:.26,d:.36,x:.52,y:.85,z:-.12}]),materials.greenAccent,{name:'planter-foliage'});
  const marker=mesh(mergedBoxes([{w:.40,h:.10,d:.02,y:.39,z:.601}]),materials.reflective,{name:'planter-reflector',castShadow:false});
  root.add(planter,soil,foliage,marker);
  return finalize(root,ROCK_META,'UrbanObstacle_HeavyPlanterBarrier',variant,'heavyPlanterBarrier');
}

function makeBarricadeBase(kind,width,height,depth,{railMaterial,frameMaterial,railCount=1,reflectorCount=4,woodFeet=false}={}){
  const {materials}=getShared();
  const root=new THREE.Group();
  const postX=Math.max(.58,width*.5-.24);
  const railH=kind==='wideLog'?.22:.20;
  const rails=[];
  for(let i=0;i<railCount;i++){
    const y=height-railH*.5-i*(railH+.16);
    rails.push({w:width,h:railH,d:.14,y});
  }
  root.add(mesh(mergedBoxes(rails),railMaterial,{name:'barricade-rails'}));
  const frameSpecs=[
    {w:.10,h:height-.08,d:.10,x:-postX,y:(height-.08)*.5},{w:.10,h:height-.08,d:.10,x:postX,y:(height-.08)*.5},
    {w:.54,h:.07,d:depth,x:-postX,y:.035},{w:.54,h:.07,d:depth,x:postX,y:.035}
  ];
  if(woodFeet){frameSpecs.push({w:.10,h:.18,d:.10,x:-postX,y:.18},{w:.10,h:.18,d:.10,x:postX,y:.18});}
  root.add(mesh(mergedBoxes(frameSpecs),frameMaterial,{name:'barricade-frame'}));
  addStripeBlocks(root,{width:width*.92,y:height-railH*.5,z:.081,count:reflectorCount,height:railH*.55,material:materials.reflective});
  return root;
}

function logPrototype(variant){
  const {materials}=getShared();
  const width=OBSTACLE_TUNING.log.length,height=.60,depth=.72;
  let root;
  if(variant===0){
    root=makeBarricadeBase('log',width,height,depth,{railMaterial:materials.wood,frameMaterial:materials.darkMetal,reflectorCount:5,woodFeet:true});
    root.add(mesh(mergedBoxes([{w:width*.92,h:.06,d:.15,y:.44,z:-.02}]),materials.orange,{name:'wood-warning-face'}));
    return finalize(root,URBAN_OBSTACLE_DIMENSIONS.log,'UrbanObstacle_WoodConstructionBarricade',variant,'woodConstructionBarricade');
  }
  if(variant===1){
    root=new THREE.Group();
    const frame=mesh(mergedBoxes([{w:2.72,h:.08,d:.10,y:.54},{w:.09,h:.54,d:.10,x:-1.32,y:.27},{w:.09,h:.54,d:.10,x:1.32,y:.27},{w:.42,h:.07,d:.62,x:-1.32,y:.035},{w:.42,h:.07,d:.62,x:1.32,y:.035}]),materials.silver,{name:'police-barrier-frame'});
    const pickets=[];for(let x=-1.08;x<=1.081;x+=.27)pickets.push({w:.035,h:.42,d:.055,x,y:.28});
    root.add(frame,mesh(mergedBoxes(pickets),materials.darkMetal,{name:'police-barrier-pickets'}));
    addStripeBlocks(root,{width:2.50,y:.54,z:.061,count:7,height:.045,material:materials.reflective});
    return finalize(root,URBAN_OBSTACLE_DIMENSIONS.log,'UrbanObstacle_MetalPoliceBarricade',variant,'metalPoliceBarricade');
  }
  if(variant===2){
    root=makeBarricadeBase('log',2.82,.58,.70,{railMaterial:materials.white,frameMaterial:materials.darkMetal,reflectorCount:5});
    const center=mesh(mergedBoxes([{w:1.02,h:.22,d:.05,y:.47,z:.091}]),materials.warningBlack,{name:'road-closed-panel'});
    const accent=mesh(mergedBoxes([{w:.72,h:.07,d:.012,y:.47,z:.122}]),materials.orange,{name:'road-closed-accent',castShadow:false});
    root.add(center,accent);
    return finalize(root,URBAN_OBSTACLE_DIMENSIONS.log,'UrbanObstacle_RoadClosureStand',variant,'roadClosureStand');
  }
  root=new THREE.Group();
  const beam=mesh(mergedBoxes([{w:2.86,h:.20,d:.16,y:.52}]),materials.orange,{name:'sawhorse-beam'});
  const legs=mesh(mergedBoxes([{w:.10,h:.58,d:.10,x:-1.10,y:.29,rz:.18},{w:.10,h:.58,d:.10,x:-.86,y:.29,rz:-.18},{w:.10,h:.58,d:.10,x:.86,y:.29,rz:.18},{w:.10,h:.58,d:.10,x:1.10,y:.29,rz:-.18}]),materials.darkMetal,{name:'sawhorse-legs'});
  root.add(beam,legs);addStripeBlocks(root,{width:2.62,y:.52,z:.091,count:7,height:.11,material:materials.reflective});
  return finalize(root,URBAN_OBSTACLE_DIMENSIONS.log,'UrbanObstacle_StripedSawhorse',variant,'stripedSawhorse');
}

function wideLogPrototype(variant){
  const {materials}=getShared();
  const width=OBSTACLE_TUNING.wideLog.length,height=.82,depth=.94;
  let root;
  if(variant===0){
    root=makeBarricadeBase('wideLog',width,height,depth,{railMaterial:materials.orange,frameMaterial:materials.darkMetal,railCount:2,reflectorCount:9});
    const braces=mesh(mergedBoxes([{w:.08,h:.66,d:.08,x:-2.05,y:.37,rz:-.28},{w:.08,h:.66,d:.08,x:2.05,y:.37,rz:.28}]),materials.silver,{name:'multi-panel-braces'});
    root.add(braces);
    return finalize(root,URBAN_OBSTACLE_DIMENSIONS.wideLog,'UrbanObstacle_MultiPanelBarricade',variant,'multiPanelBarricade');
  }
  if(variant===1){
    root=new THREE.Group();
    const perimeter=mesh(mergedBoxes([{w:6.08,h:.08,d:.09,y:.77},{w:6.08,h:.08,d:.09,y:.08},{w:.09,h:.77,d:.09,x:-3.00,y:.42},{w:.09,h:.77,d:.09,x:3.00,y:.42},{w:.48,h:.07,d:.84,x:-3.00,y:.035},{w:.48,h:.07,d:.84,x:3.00,y:.035}]),materials.darkMetal,{name:'construction-fence-frame'});
    const bars=[];for(let x=-2.72;x<=2.721;x+=.34)bars.push({w:.035,h:.62,d:.04,x,y:.42});
    const fence=mesh(mergedBoxes(bars),materials.silver,{name:'construction-fence-bars'});
    const header=mesh(mergedBoxes([{w:5.60,h:.16,d:.05,y:.66,z:.071}]),materials.yellow,{name:'construction-fence-header'});
    root.add(perimeter,fence,header);addStripeBlocks(root,{width:5.30,y:.66,z:.102,count:11,height:.08,material:materials.warningBlack});
    return finalize(root,URBAN_OBSTACLE_DIMENSIONS.wideLog,'UrbanObstacle_TemporaryConstructionFence',variant,'temporaryConstructionFence');
  }
  if(variant===2){
    root=new THREE.Group();
    const cells=[];for(const x of [-2.06,0,2.06])cells.push({w:1.94,h:.62,d:.86,x,y:.31});
    const bodies=mesh(mergedBoxes(cells),materials.orange,{name:'linked-water-barriers'});
    const seams=mesh(mergedBoxes([{w:.08,h:.54,d:.90,x:-1.03,y:.32},{w:.08,h:.54,d:.90,x:1.03,y:.32}]),materials.warningBlack,{name:'water-barrier-links'});
    const caps=mesh(mergedBoxes([{w:1.70,h:.08,d:.72,x:-2.06,y:.66},{w:1.70,h:.08,d:.72,x:0,y:.66},{w:1.70,h:.08,d:.72,x:2.06,y:.66}]),materials.white,{name:'water-barrier-caps'});
    root.add(bodies,seams,caps);addStripeBlocks(root,{width:5.86,y:.48,z:.441,count:11,height:.12,material:materials.reflective});
    return finalize(root,URBAN_OBSTACLE_DIMENSIONS.wideLog,'UrbanObstacle_LinkedWaterBarriers',variant,'linkedWaterBarriers');
  }
  root=new THREE.Group();
  const frame=mesh(mergedBoxes([{w:6.12,h:.10,d:.10,y:.74},{w:.11,h:.74,d:.11,x:-3.00,y:.37},{w:.11,h:.73,d:.11,x:3.00,y:.37},{w:.62,h:.07,d:.90,x:-3.00,y:.035},{w:.62,h:.07,d:.90,x:3.00,y:.035}]),materials.darkMetal,{name:'street-closure-gate-frame'});
  const bars=[];for(let x=-2.65;x<=2.651;x+=.53)bars.push({w:.055,h:.52,d:.055,x,y:.40});
  const grille=mesh(mergedBoxes(bars),materials.silver,{name:'street-closure-gate-bars'});
  const stripe=mesh(mergedBoxes([{w:5.66,h:.19,d:.055,y:.57,z:.081}]),materials.white,{name:'street-closure-warning-rail'});
  root.add(frame,grille,stripe);addStripeBlocks(root,{width:5.36,y:.57,z:.116,count:11,height:.11,material:materials.orange});
  return finalize(root,URBAN_OBSTACLE_DIMENSIONS.wideLog,'UrbanObstacle_WideStreetClosureGate',variant,'wideStreetClosureGate');
}

function rampPrototype(variant){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();
  const angle=Math.atan((.74-.08)/(1.54-(-1.54)));
  const bodyMaterials=[materials.rampSteel,materials.plywood,materials.rampConcrete,materials.rampSteel,materials.rampBlack,materials.rampConcrete];
  root.add(mesh(geometries.ramp,bodyMaterials[variant],{name:'ramp-body'}));
  const rails=mesh(mergedBoxes([{w:.09,h:.07,d:3.00,x:-1.10,y:.43,rx:angle},{w:.09,h:.07,d:3.00,x:1.10,y:.43,rx:angle},{w:2.18,h:.07,d:.10,y:.705,z:-1.45}]),variant===2?materials.silver:materials.darkMetal,{name:'ramp-edge-trim'});
  const supports=mesh(mergedBoxes([{w:.09,h:.54,d:.09,x:-.94,y:.27,z:-1.16},{w:.09,h:.54,d:.09,x:.94,y:.27,z:-1.16},{w:.08,h:.62,d:.08,x:-.94,y:.31,z:-.55,rx:-.48},{w:.08,h:.62,d:.08,x:.94,y:.31,z:-.55,rx:-.48},{w:1.90,h:.07,d:.09,y:.08,z:-1.18}]),materials.darkMetal,{name:'ramp-support-bracing'});
  const bolts=mesh(mergedBoxes([{w:.055,h:.018,d:.055,x:-1.075,y:.18,z:1.02},{w:.055,h:.018,d:.055,x:1.075,y:.18,z:1.02},{w:.055,h:.018,d:.055,x:-1.075,y:.61,z:-.92},{w:.055,h:.018,d:.055,x:1.075,y:.61,z:-.92}]),materials.silver,{name:'ramp-bolts',castShadow:false});
  root.add(rails,supports,bolts);

  if(variant===0){
    root.add(mesh(mergedBoxes([{w:1.80,h:.024,d:.22,y:.135,z:1.31,rx:angle},{w:1.80,h:.024,d:.13,y:.690,z:-1.28,rx:angle}]),materials.yellow,{name:'steel-kicker-safety-strips',castShadow:false}));
  }else if(variant===1){
    root.add(mesh(mergedBoxes([{w:1.82,h:.026,d:.10,y:.25,z:.78,rx:angle},{w:1.82,h:.026,d:.10,y:.47,z:-.26,rx:angle}]),materials.warningBlack,{name:'plywood-grip-strips',castShadow:false}));
  }else if(variant===2){
    root.add(mesh(mergedBoxes([{w:1.90,h:.028,d:.16,y:.16,z:1.20,rx:angle},{w:1.90,h:.028,d:.12,y:.65,z:-1.08,rx:angle}]),materials.warningBlack,{name:'concrete-ramp-grip',castShadow:false}));
  }else if(variant===3){
    root.add(mesh(mergedBoxes([{w:.24,h:.026,d:.34,x:-.70,y:.20,z:.98,rx:angle},{w:.24,h:.026,d:.34,x:0,y:.20,z:.98,rx:angle},{w:.24,h:.026,d:.34,x:.70,y:.20,z:.98,rx:angle},{w:1.70,h:.026,d:.12,y:.63,z:-1.02,rx:angle}]),materials.yellow,{name:'construction-plate-warning-marks',castShadow:false}));
  }else if(variant===4){
    root.add(mesh(mergedBoxes([{w:1.72,h:.026,d:.18,y:.21,z:.93,rx:angle},{w:.36,h:.026,d:.54,x:-.68,y:.43,z:-.10,rx:angle},{w:.36,h:.026,d:.54,x:.68,y:.43,z:-.10,rx:angle}]),materials.blueAccent,{name:'event-ramp-branding',castShadow:false}));
    root.add(mesh(mergedBoxes([{w:.42,h:.028,d:.14,y:.58,z:-.75,rx:angle}]),materials.pinkAccent,{name:'event-ramp-secondary-accent',castShadow:false}));
  }else{
    root.add(mesh(mergedBoxes([{w:.54,h:.026,d:.18,x:-.55,y:.27,z:.62,rx:angle},{w:.72,h:.026,d:.14,x:.36,y:.44,z:-.20,rx:angle},{w:.38,h:.026,d:.18,x:-.22,y:.58,z:-.82,rx:angle}]),materials.pinkAccent,{name:'graffiti-pink-decals',castShadow:false}));
    root.add(mesh(mergedBoxes([{w:.32,h:.027,d:.42,x:.62,y:.30,z:.45,rx:angle},{w:.52,h:.027,d:.15,x:-.52,y:.50,z:-.46,rx:angle}]),materials.blueAccent,{name:'graffiti-blue-decals',castShadow:false}));
  }
  return finalize(root,RAMP_META,'UrbanObstacle_'+URBAN_OBSTACLE_VARIANTS.ramp[variant],variant,URBAN_OBSTACLE_VARIANTS.ramp[variant]);
}

function oilPrototype(variant){
  const {materials,geometries}=getShared();
  const root=new THREE.Group();
  const geometry=variant===0?geometries.oil:(variant===1?geometries.wet:geometries.grime);
  const material=variant===0?materials.oil:(variant===1?materials.wet:materials.dirt);
  const patch=mesh(geometry,material,{name:URBAN_OBSTACLE_VARIANTS.oil[variant],castShadow:false,receiveShadow:false});
  patch.position.y=.012;
  root.add(patch);
  if(variant!==2){
    const sheen=mesh(geometries.oilSheen,materials.oilSheen,{name:'road-hazard-sheen',castShadow:false,receiveShadow:false});
    sheen.position.set(variant===0?.18:-.22,.014,variant===0?-.03:.10);
    sheen.rotation.y=variant===0?.22:-.38;
    root.add(sheen);
  }else{
    const streaks=mesh(mergedBoxes([{w:.62,h:.006,d:.035,x:-.58,y:.015,z:.10,ry:.10},{w:.46,h:.006,d:.030,x:.38,y:.015,z:-.12,ry:-.14},{w:.28,h:.006,d:.026,x:.86,y:.015,z:.16,ry:.18}]),materials.oil,{name:'grime-wet-streaks',castShadow:false,receiveShadow:false});
    root.add(streaks);
  }
  return finalize(root,URBAN_OBSTACLE_DIMENSIONS.oil,'UrbanObstacle_'+URBAN_OBSTACLE_VARIANTS.oil[variant],variant,URBAN_OBSTACLE_VARIANTS.oil[variant]);
}

function buildPrototype(kind,variant){
  if(kind==='tree')return treePrototype(variant);
  if(kind==='rock')return rockPrototype(variant);
  if(kind==='log')return logPrototype(variant);
  if(kind==='wideLog')return wideLogPrototype(variant);
  if(kind==='ramp')return rampPrototype(variant);
  if(kind==='oil')return oilPrototype(variant);
  throw new Error('Unsupported urban obstacle kind: '+kind);
}

function getPrototype(kind,variant){
  const key=`${kind}:${variant}`;
  if(!prototypes.has(key))prototypes.set(key,buildPrototype(kind,variant));
  return prototypes.get(key);
}

function cloneObstacle(kind,options={}){
  const variant=resolveVariant(kind,options);
  const prototype=getPrototype(kind,variant);
  const clone=prototype.clone(true);
  clone.position.set(0,0,0);
  clone.rotation.set(0,0,0);
  clone.scale.set(1,1,1);
  clone.userData={...prototype.userData};
  return clone;
}

export function getUrbanObstacleVariantCount(kind){
  const variants=URBAN_OBSTACLE_VARIANTS[kind];
  if(!variants)throw new Error('Unsupported urban obstacle kind: '+kind);
  return variants.length;
}

export function createTrafficConeObstacle(options={}){return cloneObstacle('tree',options);}
export function createConcreteBarrierObstacle(options={}){return cloneObstacle('rock',options);}
export function createConstructionBarricadeObstacle(options={}){return cloneObstacle('log',options);}
export function createWideConstructionBarricadeObstacle(options={}){return cloneObstacle('wideLog',options);}
export function createUrbanRampObstacle(options={}){return cloneObstacle('ramp',options);}
export function createUrbanOilHazard(options={}){return cloneObstacle('oil',options);}

export const URBAN_OBSTACLE_FACTORIES=Object.freeze({
  tree:createTrafficConeObstacle,
  rock:createConcreteBarrierObstacle,
  log:createConstructionBarricadeObstacle,
  wideLog:createWideConstructionBarricadeObstacle,
  ramp:createUrbanRampObstacle,
  oil:createUrbanOilHazard
});

export function createUrbanObstacle(kind,options={}){
  const factory=URBAN_OBSTACLE_FACTORIES[kind];
  if(!factory)throw new Error('Unsupported urban obstacle kind: '+kind);
  return factory(options);
}

export function createUrbanObstaclePrototypes(options={}){
  return {
    tree:createTrafficConeObstacle(options.tree??{}),
    rock:createConcreteBarrierObstacle(options.rock??{}),
    log:createConstructionBarricadeObstacle(options.log??{}),
    wideLog:createWideConstructionBarricadeObstacle(options.wideLog??{}),
    oil:createUrbanOilHazard(options.oil??{}),
    ramp:createUrbanRampObstacle(options.ramp??{})
  };
}

export function disposeUrbanObstacleInstance(root){
  if(!root?.isObject3D)return false;
  root.removeFromParent();
  root.clear();
  root.userData={...root.userData,disposed:true};
  return true;
}
