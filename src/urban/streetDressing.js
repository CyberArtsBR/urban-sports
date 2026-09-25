import * as THREE from 'three';
import {createUrbanMaterials} from './urbanMaterials.js';

const _dummy=new THREE.Object3D();
const _color=new THREE.Color();
const PROFILE_DENSITY=Object.freeze({max:1,high:1,medium:.72,low:.46});
const ZONES=Object.freeze(['parking','storefront','downtown','transit','construction','utility','clean']);

export const URBAN_STREET_DRESSING_DEFAULTS=Object.freeze({
  roadWidth:13.5,
  sidewalkWidth:3.1,
  recycleNear:34,
  farZ:-470,
  slotSpacing:18,
  mediumDetailZ:-230,
  farDetailZ:-350,
  vehicleInset:.34,
  furnitureInset:1.85
});

export const URBAN_STREET_ZONES=ZONES;

export const PARKED_VEHICLE_TYPES=Object.freeze({
  compact:Object.freeze({width:1.62,length:3.45,height:1.28,wheelRadius:.30,bodyHeight:.55,cabinScale:.66}),
  sedan:Object.freeze({width:1.78,length:4.35,height:1.34,wheelRadius:.32,bodyHeight:.58,cabinScale:.62}),
  taxi:Object.freeze({width:1.80,length:4.42,height:1.36,wheelRadius:.32,bodyHeight:.58,cabinScale:.62}),
  van:Object.freeze({width:1.92,length:4.65,height:2.02,wheelRadius:.34,bodyHeight:.72,cabinScale:.82}),
  delivery:Object.freeze({width:1.98,length:5.15,height:2.18,wheelRadius:.35,bodyHeight:.76,cabinScale:.88}),
  truck:Object.freeze({width:2.05,length:5.55,height:2.22,wheelRadius:.38,bodyHeight:.78,cabinScale:.62}),
  scooter:Object.freeze({width:.68,length:1.78,height:1.18,wheelRadius:.25,bodyHeight:.34,cabinScale:.34})
});

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function fract(value){return value-Math.floor(value);}
function hashString(value){
  let hash=2166136261;
  const text=String(value??'street-dressing');
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
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
    return PROFILE_DENSITY[String(value.profile??'high').toLowerCase()]??1;
  }
  return 1;
}
function vehicleType(value){return PARKED_VEHICLE_TYPES[value]?value:'sedan';}
function sideValue(value){return Number(value)<0?-1:1;}
function commonOptions(options={}){
  const config={...URBAN_STREET_DRESSING_DEFAULTS,...options};
  config.seed=hashString(options.seed??'chimpions-street-dressing');
  config.density=densityFromQuality(options.quality??options.density??'high');
  return config;
}
function makeOwnedMaterials(materials,renderer){
  if(materials)return {materials,owned:false};
  return {materials:createUrbanMaterials({renderer}),owned:true};
}
function createMesh(geometry,material,capacity,name,{castShadow=false,receiveShadow=false}={}){
  const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,capacity));
  mesh.name=name;mesh.count=0;mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;
  mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
function setMatrix(mesh,index,{x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0}){
  _dummy.position.set(x,y,z);_dummy.rotation.set(rx,ry,rz);_dummy.scale.set(sx,sy,sz);_dummy.updateMatrix();
  mesh.setMatrixAt(index,_dummy.matrix);
}
function setColor(mesh,index,color){_color.set(color);mesh.setColorAt(index,_color);}
function finish(mesh,count){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
function advance(entry,dz,nearZ,farZ,onRecycle){
  entry.z+=dz;if(entry.z<=nearZ)return;
  const span=nearZ-farZ,wraps=Math.max(1,Math.ceil((entry.z-nearZ)/span));
  entry.z-=span*wraps;entry.generation=(entry.generation||0)+wraps;onRecycle?.(entry);
}
function descriptor(kind,options,bounds){
  const position=options.position??{};
  return {
    kind,
    position:{x:Number(position.x??options.x??0)||0,y:Number(position.y??options.y??0)||0,z:Number(position.z??options.z??0)||0},
    rotationY:Number(options.rotationY??options.yaw??0)||0,
    scale:Number(options.scale??1)||1,
    side:sideValue(options.side??1),
    variant:options.variant??null,
    color:options.color??null,
    bounds,
    gameplayCollision:false,
    decorative:true,
    originY:0
  };
}

export function createParkedVehicle(options={}){
  const type=vehicleType(options.type??options.variant??'sedan');
  const spec=PARKED_VEHICLE_TYPES[type];
  return {...descriptor('parked-vehicle',{...options,variant:type},{width:spec.width,height:spec.height,length:spec.length}),type};
}
export function createStreetFurnitureCluster(options={}){
  return descriptor('street-furniture-cluster',options,{width:2.6,height:2.1,length:5.2});
}
export function createBusStop(options={}){
  return descriptor('bus-stop',options,{width:2.3,height:2.65,length:5.6});
}
export function createUtilityCluster(options={}){
  return descriptor('utility-cluster',options,{width:2.2,height:1.75,length:3.8});
}
export function createSidewalkDetailSet(options={}){
  return descriptor('sidewalk-detail-set',options,{width:2.8,height:.08,length:8});
}
export function createCommercialStreetCluster(options={}){
  return descriptor('commercial-cluster',options,{width:3,height:2.8,length:7.5});
}

const VEHICLE_COLORS=Object.freeze([0xd94a46,0x3a78b8,0xe4e6e8,0x252a31,0x2f8968,0xb868c4,0xf2c342,0x7f8a97]);
const STREET_COLORS=Object.freeze({
  steel:0x4d5964,dark:0x252c33,hydrant:0xc94639,bin:0x38444c,recycle:0x34765b,
  bench:0x65564b,utility:0x77828a,mail:0x2f5e9c,yellow:0xf0bf35,orange:0xe7792e,
  concrete:0x9c9b95,awningA:0xc64242,awningB:0x315f93,planter:0x655b52,kiosk:0x33475c
});

function zoneFrom(value){
  if(value<.21)return 'parking';
  if(value<.39)return 'storefront';
  if(value<.57)return 'downtown';
  if(value<.69)return 'transit';
  if(value<.80)return 'construction';
  if(value<.91)return 'utility';
  return 'clean';
}

export function createUrbanStreetDressing(options={}){
  const config=commonOptions(options);
  const {materials,owned}=makeOwnedMaterials(options.materials,options.renderer);
  const group=new THREE.Group();group.name='UrbanStreetDressing';
  group.userData.urbanComponent='street-dressing';group.userData.streaming=true;group.userData.gameplayCollision=false;group.userData.decorative=true;
  group.userData.playableRoadHalfWidth=config.roadWidth*.5;

  const rows=Math.ceil((config.recycleNear-config.farZ)/config.slotSpacing)+2;
  const slotCapacity=rows*2;
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const cylinderGeometry=new THREE.CylinderGeometry(.5,.5,1,8);
  const wheelGeometry=new THREE.CylinderGeometry(.5,.5,1,10);
  const foliageGeometry=new THREE.IcosahedronGeometry(.5,0);
  const archGeometry=new THREE.TorusGeometry(.5,.08,6,12,Math.PI);
  const planeGeometry=new THREE.PlaneGeometry(1,1);

  const meshes={
    vehiclePaint:createMesh(boxGeometry,materials.vehiclePaint,slotCapacity*3,'urban-dressing-vehicle-paint',{castShadow:true}),
    vehicleWindows:createMesh(boxGeometry,materials.vehicleGlass,slotCapacity*2,'urban-dressing-vehicle-windows'),
    vehicleTires:createMesh(wheelGeometry,materials.tire,slotCapacity*4,'urban-dressing-vehicle-tires'),
    vehicleTrim:createMesh(boxGeometry,materials.darkMetal,slotCapacity*2,'urban-dressing-vehicle-trim'),
    vehicleLights:createMesh(boxGeometry,materials.vehicleLight,slotCapacity*4,'urban-dressing-vehicle-lights'),
    vehicleArches:createMesh(archGeometry,materials.darkMetal,slotCapacity*4,'urban-dressing-vehicle-wheel-arches'),
    streetBoxes:createMesh(boxGeometry,materials.streetPaint,slotCapacity*10,'urban-dressing-street-boxes',{castShadow:true}),
    streetCylinders:createMesh(cylinderGeometry,materials.streetPaint,slotCapacity*7,'urban-dressing-street-cylinders'),
    foliage:createMesh(foliageGeometry,materials.foliage,slotCapacity*2,'urban-dressing-foliage'),
    glass:createMesh(boxGeometry,materials.streetGlass,slotCapacity*2,'urban-dressing-glass'),
    flats:createMesh(planeGeometry,materials.streetDetail,slotCapacity*5,'urban-dressing-flat-details',{receiveShadow:true})
  };
  group.add(...Object.values(meshes));

  const counts={vehiclePaint:0,vehicleWindows:0,vehicleTires:0,vehicleTrim:0,vehicleLights:0,vehicleArches:0,streetBoxes:0,streetCylinders:0,foliage:0,glass:0,flats:0};
  let density=config.density;
  const entries=Array.from({length:slotCapacity},(_,i)=>({side:i%2===0?-1:1,z:0,generation:0}));
  const customEntries=(options.placements??[]).map((item,index)=>({descriptor:item,z:Number(item?.position?.z??item?.z??0)||0,index,generation:0}));

  function push(name,transform,color=null){
    const mesh=meshes[name],index=counts[name];
    if(!mesh||index>=mesh.instanceMatrix.count)return false;
    setMatrix(mesh,index,transform);if(color!=null)setColor(mesh,index,color);counts[name]=index+1;return true;
  }
  function configure(entry,index){
    const r=index+(entry.generation||0)*slotCapacity;
    entry.zone=zoneFrom(random01(config.seed,r,1));
    entry.densityGate=random01(config.seed,r,2);
    entry.variant=random01(config.seed,r,3);
    entry.jitter=(random01(config.seed,r,4)-.5)*4.4;
    entry.colorIndex=Math.floor(random01(config.seed,r,5)*VEHICLE_COLORS.length)%VEHICLE_COLORS.length;
    entry.vehicleKind=['compact','sedan','taxi','van','delivery','truck'][Math.floor(random01(config.seed,r,6)*6)%6];
    entry.phase=random01(config.seed,r,7);
  }
  function resetEntries(){
    for(let i=0;i<entries.length;i++){
      const e=entries[i];e.z=config.recycleNear-Math.floor(i/2)*config.slotSpacing-(i%2)*6.2;e.generation=0;configure(e,i);
    }
    for(const e of customEntries){e.z=Number(e.descriptor?.position?.z??e.descriptor?.z??0)||0;e.generation=0;}
  }
  function clearCounts(){for(const key of Object.keys(counts))counts[key]=0;}
  function emitFlat(x,y,z,sx,sz,color){push('flats',{x,y,z,sx,sy:sz,rx:-Math.PI/2},color);}
  function emitBox(x,y,z,sx,sy,sz,color,ry=0,rz=0){push('streetBoxes',{x,y,z,sx,sy,sz,ry,rz},color);}
  function emitCylinder(x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0){push('streetCylinders',{x,y,z,sx,sy,sz,rx,ry,rz},color);}

  function emitVehicle({side,z,type='sedan',color=null,scale=1,yaw=0,x=null}){
    const spec=PARKED_VEHICLE_TYPES[vehicleType(type)],s=Math.max(.5,Number(scale)||1);
    const roadEdge=config.roadWidth*.5;
    const px=x??side*(roadEdge+config.vehicleInset+spec.width*s*.5);
    if(type==='scooter'){
      const r=spec.wheelRadius*s;
      for(const wz of [-spec.length*.34*s,spec.length*.34*s])push('vehicleTires',{x:px,y:r,z:z+wz,sx:r,sy:.13*s,sz:r,rz:Math.PI/2,ry:yaw});
      push('vehiclePaint',{x:px,y:r+.16*s,z,sx:.26*s,sy:.20*s,sz:1.02*s,ry:yaw},color??0xc8413d);
      push('vehicleTrim',{x:px,y:.72*s,z:z+.50*s,sx:.06*s,sy:.92*s,sz:.06*s,rz:-.18*side,ry:yaw});
      push('vehicleTrim',{x:px,y:1.13*s,z:z+.44*s,sx:.58*s,sy:.06*s,sz:.06*s,ry:yaw});
      push('vehiclePaint',{x:px,y:.78*s,z:z-.22*s,sx:.44*s,sy:.20*s,sz:.38*s,ry:yaw},0x252b31);
      return;
    }
    const baseY=spec.wheelRadius*s;
    const bodyH=spec.bodyHeight*s;
    const length=spec.length*s,width=spec.width*s;
    const paint=color??VEHICLE_COLORS[(Math.abs(Math.floor(z*7))+spec.length*10|0)%VEHICLE_COLORS.length];
    const upperH=Math.max(.42,(spec.height-spec.bodyHeight-.18))*s;
    const upperLen=length*spec.cabinScale;
    const upperZ=type==='van'||type==='delivery'?0:length*.03;
    push('vehiclePaint',{x:px,y:baseY+bodyH*.48,z,sx:width,sy:bodyH,sz:length,ry:yaw},paint);
    push('vehiclePaint',{x:px,y:baseY+bodyH+upperH*.88,z:z+upperZ,sx:width*.88,sy:.16*s,sz:upperLen*.94,ry:yaw},paint);
    if(type==='truck')push('vehiclePaint',{x:px,y:baseY+bodyH+upperH*.5,z:z-length*.18,sx:width*.94,sy:upperH,sz:length*.48,ry:yaw},paint);
    else push('vehicleWindows',{x:px,y:baseY+bodyH+upperH*.48,z:z+upperZ,sx:width*.84,sy:upperH*.68,sz:upperLen*.88,ry:yaw},0x18232d);
    if(type==='van'||type==='delivery')push('vehicleWindows',{x:px,y:baseY+bodyH+upperH*.52,z:z+length*.22,sx:width*.87,sy:upperH*.55,sz:length*.10,ry:yaw},0x17232c);
    const axleZ=length*.31,wheelX=width*.51;
    for(const wx of [-wheelX,wheelX])for(const wz of [-axleZ,axleZ]){
      const wheelXWorld=px+Math.cos(yaw)*wx;
      push('vehicleTires',{x:wheelXWorld,y:spec.wheelRadius*s,z:z+wz,sx:spec.wheelRadius*s,sy:.19*s,sz:spec.wheelRadius*s,rz:Math.PI/2,ry:yaw});
      push('vehicleArches',{x:wheelXWorld,y:spec.wheelRadius*s*1.22,z:z+wz,sx:spec.wheelRadius*s*2.35,sy:spec.wheelRadius*s*2.35,sz:spec.wheelRadius*s*2.35,ry:Math.PI/2});
    }
    push('vehicleTrim',{x:px,y:baseY+bodyH*.30,z:z+length*.51,sx:width*.92,sy:.18*s,sz:.12*s,ry:yaw});
    push('vehicleTrim',{x:px,y:baseY+bodyH*.30,z:z-length*.51,sx:width*.92,sy:.18*s,sz:.12*s,ry:yaw});
    for(const lx of [-width*.28,width*.28]){
      push('vehicleLights',{x:px+lx,y:baseY+bodyH*.55,z:z+length*.515,sx:.28*s,sy:.16*s,sz:.035*s,ry:yaw},0xe8e1b6);
      push('vehicleLights',{x:px+lx,y:baseY+bodyH*.52,z:z-length*.515,sx:.24*s,sy:.15*s,sz:.035*s,ry:yaw},0xb9413b);
    }
    if(type==='taxi')push('vehiclePaint',{x:px,y:spec.height*s+.12,z,sx:.62*s,sy:.20*s,sz:.28*s,ry:yaw},0xf3c531);
  }

  function emitHydrant(side,z,offset=0){
    const x=side*(config.roadWidth*.5+config.furnitureInset+offset);
    emitCylinder(x,.34,z,.34,.68,.34,STREET_COLORS.hydrant);
    emitCylinder(x,.73,z,.25,.12,.25,STREET_COLORS.hydrant);
    emitCylinder(x-.24*side,.43,z,.12,.24,.12,STREET_COLORS.dark,0,0,Math.PI/2);
  }
  function emitBin(side,z,recycle=false,offset=0){
    const x=side*(config.roadWidth*.5+config.furnitureInset+offset),c=recycle?STREET_COLORS.recycle:STREET_COLORS.bin;
    emitBox(x,.48,z,.66,.96,.70,c);emitBox(x,.99,z,.70,.08,.74,STREET_COLORS.dark);
  }
  function emitBench(side,z,offset=.15){
    const x=side*(config.roadWidth*.5+config.furnitureInset+offset),towardRoad=-side;
    emitBox(x,.48,z,1.75,.12,.52,STREET_COLORS.bench);
    emitBox(x+towardRoad*.20,.86,z,1.65,.72,.10,STREET_COLORS.bench);
    emitBox(x,.22,z-.58,.12,.44,.12,STREET_COLORS.dark);emitBox(x,.22,z+.58,.12,.44,.12,STREET_COLORS.dark);
  }
  function emitMeter(side,z){
    const x=side*(config.roadWidth*.5+1.22);
    emitCylinder(x,.56,z,.07,1.12,.07,STREET_COLORS.steel);
    emitBox(x,.98,z,.28,.34,.18,STREET_COLORS.dark);
  }
  function emitBollards(side,z,count=3){
    for(let i=0;i<count;i++){
      const x=side*(config.roadWidth*.5+config.sidewalkWidth*.78),zz=z+(i-(count-1)/2)*1.05;
      emitCylinder(x,.42,zz,.10,.84,.10,STREET_COLORS.dark);
    }
  }
  function emitPlanter(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.72);
    emitBox(x,.30,z,1.05,.60,.82,STREET_COLORS.planter);
    push('foliage',{x,y:.90,z,sx:.78,sy:.82,sz:.78},0x315f42);
  }
  function emitBikeRack(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.70);
    for(const dz of [-.55,.55]){
      emitCylinder(x-.32*side,.38,z+dz,.055,.76,.055,STREET_COLORS.steel);
      emitCylinder(x+.32*side,.38,z+dz,.055,.76,.055,STREET_COLORS.steel);
      emitBox(x,.73,z+dz,.68,.07,.07,STREET_COLORS.steel);
    }
  }
  function emitUtility(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.74);
    emitBox(x,.60,z,.78,1.20,.56,STREET_COLORS.utility);
    emitBox(x-side*.405,.73,z,.035,.48,.30,STREET_COLORS.dark);
    emitBox(x,.21,z+.52,.48,.42,.38,STREET_COLORS.concrete);
  }
  function emitMailbox(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.70);
    emitCylinder(x,.47,z,.08,.94,.08,STREET_COLORS.steel);
    emitBox(x,.92,z,.58,.62,.42,STREET_COLORS.mail);
  }
  function emitNewspaperBox(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.69);
    emitBox(x,.48,z,.58,.96,.45,0xd4a432);emitBox(x-side*.30,.70,z,.035,.40,.28,0x242b31);
  }
  function emitKiosk(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.78);
    emitBox(x,1.0,z,.82,2.0,.66,STREET_COLORS.kiosk);
    emitBox(x-side*.425,1.18,z,.035,.72,.42,0x142633);
  }
  function emitCafeHint(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.67);
    emitCylinder(x,.46,z,.42,.08,.42,0x6e5845);
    emitCylinder(x,.23,z,.07,.46,.07,STREET_COLORS.dark);
    for(const dz of [-.72,.72]){
      emitBox(x,.34,z+dz,.52,.09,.46,0x4b5963);
      emitBox(x+side*.23,.68,z+dz,.08,.66,.46,0x4b5963);
    }
  }
  function emitPedestrianSign(side,z){
    const x=side*(config.roadWidth*.5+1.34);
    emitCylinder(x,1.10,z,.05,2.20,.05,STREET_COLORS.steel);
    emitBox(x,1.92,z,.72,.72,.07,0x356e9b);
    emitBox(x-side*.365,1.92,z,.025,.44,.42,0xd7e2e5);
  }
  function emitSignalAssembly(side,z){
    const roadEdge=config.roadWidth*.5;
    const x=side*(roadEdge+1.24),towardRoad=-side;
    emitCylinder(x,1.62,z,.07,3.24,.07,STREET_COLORS.dark);
    emitBox(x+towardRoad*.52,3.13,z,1.10,.08,.08,STREET_COLORS.dark);
    const signalX=x+towardRoad*1.02;
    emitBox(signalX,2.62,z,.34,1.02,.30,0x1e252b);
    emitBox(signalX+towardRoad*.18,2.91,z,.025,.18,.18,0x8a3939);
    emitBox(signalX+towardRoad*.18,2.62,z,.025,.18,.18,0x8a7635);
    emitBox(signalX+towardRoad*.18,2.33,z,.025,.18,.18,0x356b4b);
    emitBox(x+towardRoad*.10,1.55,z,.48,.58,.18,0x27333b);
    emitBox(x+towardRoad*.20,1.55,z,.025,.31,.26,0xd4ddd9);
    emitBox(x,3.52,z+.34,.10,.34,1.18,0x2f6c72);
    emitBox(x,3.52,z-.34,.10,.34,.82,0x315f93);
  }
  function emitTreeGrate(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.64);
    emitFlat(x,.187,z,1.18,1.18,0x4b5357);
    emitFlat(x,.189,z,.24,.24,0x252b2f);
  }
  function emitDrainGrate(side,z){
    const x=side*(config.roadWidth*.5+.24);
    emitFlat(x,.019,z,.34,.92,0x252a2e);
  }
  function emitBusStop(side,z){
    const x=side*(config.roadWidth*.5+config.sidewalkWidth*.76),towardRoad=-side;
    emitBox(x,1.22,z-1.75,.10,2.44,.10,STREET_COLORS.steel);
    emitBox(x,1.22,z+1.75,.10,2.44,.10,STREET_COLORS.steel);
    emitBox(x,2.42,z,1.95,.10,3.65,STREET_COLORS.steel);
    push('glass',{x:x+towardRoad*.05,y:1.27,z,sx:.05,sy:2.15,sz:3.30},0x9fc4d7);
    emitBox(x+towardRoad*.36,.51,z,.66,.10,2.40,STREET_COLORS.bench);
    const signX=side*(config.roadWidth*.5+1.25);
    emitCylinder(signX,1.18,z-2.3,.055,2.36,.055,STREET_COLORS.steel);
    emitBox(signX,2.18,z-2.3,.70,.64,.08,0x2c6aa2);
  }
  function emitCommercial(side,z,accent){
    const outer=side*(config.roadWidth*.5+config.sidewalkWidth-.10),towardRoad=-side;
    emitBox(outer+towardRoad*.45,2.35,z,1.1,.18,3.3,accent,0,side*.13);
    const boardX=side*(config.roadWidth*.5+1.62);
    emitBox(boardX,.58,z-1.30,.08,1.12,.68,0x4c4037,0,side*.15);
    emitBox(boardX,.58,z+1.30,.08,1.12,.68,0x4c4037,0,-side*.15);
    emitBox(side*(config.roadWidth*.5+2.1),.22,z+.15,.52,.44,.52,0x8c6746);
    emitBox(side*(config.roadWidth*.5+2.1),.58,z+.15,.72,.10,.72,0x7a6754);
  }
  function emitConstruction(side,z){
    const x=side*(config.roadWidth*.5+1.65);
    emitBox(x,.58,z,.10,1.14,1.15,STREET_COLORS.orange,0,side*.20);
    emitBox(x,.58,z+.82,.10,1.14,1.15,STREET_COLORS.orange,0,-side*.20);
    emitBox(side*(config.roadWidth*.5+2.25),.30,z-1.4,.76,.60,.62,STREET_COLORS.concrete);
    emitBox(side*(config.roadWidth*.5+2.25),.30,z+1.4,.76,.60,.62,STREET_COLORS.concrete);
  }
  function emitSidewalkBase(entry,detailLevel){
    const side=entry.side,roadEdge=config.roadWidth*.5;
    emitFlat(side*(roadEdge+.05),.018,entry.z,.16,config.slotSpacing*.92,0x24272b);
    if(entry.phase>.35)emitFlat(side*(roadEdge+.12),.304,entry.z+entry.jitter*.22,.18,3.2,entry.phase>.68?0xe2c03f:0xb94c45);
    if(detailLevel>=1&&entry.phase>.42){
      const coverX=side*(roadEdge+1.08+entry.variant*.72);
      emitCylinder(coverX,.192,entry.z+entry.jitter,.42,.035,.42,entry.phase>.72?0x454c50:0x62686b);
    }
    if(detailLevel>=2&&entry.phase<.44){
      const tactileX=side*(roadEdge+.72);
      emitFlat(tactileX,.186,entry.z+entry.jitter*.30,.72,1.22,0xcaaa45);
    }
    if(detailLevel>=1&&entry.phase>.62)emitDrainGrate(side,entry.z-3.1);
    if(detailLevel>=2&&entry.variant>.76)emitTreeGrate(side,entry.z+3.0);
  }
  function detailLevel(z){if(z<config.farDetailZ)return 0;if(z<config.mediumDetailZ)return 1;return 2;}
  function emitGenerated(entry,index){
    if(entry.densityGate>density)return;
    const level=detailLevel(entry.z);emitSidewalkBase(entry,level);
    if(level===0&&entry.zone!=='parking'&&entry.zone!=='transit'&&entry.zone!=='downtown')return;
    const side=entry.side,z=entry.z+entry.jitter*.16,yaw=side<0?0:Math.PI;
    if(entry.zone==='parking'){
      emitVehicle({side,z,type:entry.vehicleKind,color:entry.vehicleKind==='taxi'?0xe6bd2f:VEHICLE_COLORS[entry.colorIndex],scale:.96+entry.variant*.08,yaw});
      if(level>=1)emitMeter(side,z+2.3);
      if(level>=2)(entry.phase>.5?emitHydrant(side,z-2.5):emitBin(side,z-2.4,entry.phase>.72));
    }else if(entry.zone==='storefront'){
      if(level>=1)emitCommercial(side,z,entry.phase>.5?STREET_COLORS.awningA:STREET_COLORS.awningB);
      if(level>=2){
        entry.phase>.55?emitBench(side,z+2.2):emitNewspaperBox(side,z+2.2);
        if(entry.variant>.58)emitBin(side,z-2.3,true);
        if(entry.variant<.34)emitCafeHint(side,z-3.0);
      }
    }else if(entry.zone==='downtown'){
      if(entry.phase>.34)emitVehicle({side,z:z-1.2,type:entry.vehicleKind,color:VEHICLE_COLORS[entry.colorIndex],scale:.94,yaw});
      else if(level>=2&&entry.phase<.16)emitVehicle({side,z:z-1.0,type:'scooter',color:VEHICLE_COLORS[entry.colorIndex],scale:.96,yaw});
      if(level>=1)(entry.variant>.52?emitBench(side,z+2.4):emitPlanter(side,z+2.4));
      if(level>=2){
        entry.phase>.58?emitBikeRack(side,z-2.8):emitHydrant(side,z-2.8);
        if(entry.variant>.73)emitMailbox(side,z+4.2);
        if(entry.phase>.82)emitSignalAssembly(side,z+5.0);
        else if(entry.variant<.18)emitPedestrianSign(side,z+4.5);
      }
    }else if(entry.zone==='transit'){
      emitBusStop(side,z);
      if(level>=2){
        emitBin(side,z+3.1,true);emitBollards(side,z-3.4,2);
        if(entry.variant>.55)emitSignalAssembly(side,z+5.2);
        else emitPedestrianSign(side,z+4.7);
      }
    }else if(entry.zone==='construction'){
      if(level>=1)emitConstruction(side,z);
      if(level>=2)emitBollards(side,z+3.0,3);
    }else if(entry.zone==='utility'){
      if(level>=1)emitUtility(side,z);
      if(level>=2){entry.phase>.5?emitKiosk(side,z+2.5):emitMailbox(side,z+2.5);emitBin(side,z-2.3,false);}
    }else if(level>=2){
      if(entry.phase>.60)emitPlanter(side,z);else if(entry.phase>.30)emitBikeRack(side,z);
    }
  }
  function emitDescriptor(entry){
    const d=entry.descriptor;if(!d||d.decorative===false)return;
    const z=entry.z,x=Number(d.position?.x??0)||0,side=sideValue(d.side??(x<0?-1:1));
    if(d.kind==='parked-vehicle')emitVehicle({side,z,type:d.type??d.variant,color:d.color,scale:d.scale,yaw:d.rotationY,x:x||null});
    else if(d.kind==='bus-stop')emitBusStop(side,z);
    else if(d.kind==='utility-cluster')emitUtility(side,z);
    else if(d.kind==='commercial-cluster')emitCommercial(side,z,d.color??STREET_COLORS.awningB);
    else if(d.kind==='street-furniture-cluster'){emitBench(side,z);emitBin(side,z+1.9,true);emitHydrant(side,z-1.9);}
    else if(d.kind==='sidewalk-detail-set'){
      const fake={side,z,phase:.72,variant:.5,jitter:0};emitSidewalkBase(fake,2);
    }
  }
  function refresh(){
    clearCounts();
    for(let i=0;i<entries.length;i++)emitGenerated(entries[i],i);
    for(const entry of customEntries)emitDescriptor(entry);
    for(const [key,mesh] of Object.entries(meshes))finish(mesh,counts[key]);
  }
  function reset(){resetEntries();refresh();}
  function update(dt,worldSpeed){
    const dz=(Number(worldSpeed)||0)*(Number(dt)||0);if(!Number.isFinite(dz)||Math.abs(dz)<1e-8)return;
    for(let i=0;i<entries.length;i++)advance(entries[i],dz,config.recycleNear,config.farZ,e=>configure(e,i));
    for(const e of customEntries)advance(e,dz,config.recycleNear,config.farZ);
    refresh();
  }
  function setDensity(value){density=densityFromQuality(value);refresh();return getDiagnostics();}
  function getDiagnostics(){
    const active=Object.values(counts).reduce((sum,value)=>sum+value,0);
    const allocated=Object.values(meshes).reduce((sum,mesh)=>sum+(mesh.instanceMatrix?.count||0),0);
    const activeSlots=entries.reduce((sum,e)=>sum+(e.densityGate<=density?1:0),0);
    const zoneCounts=Object.fromEntries(ZONES.map(zone=>[zone,0]));
    for(const e of entries)if(e.densityGate<=density)zoneCounts[e.zone]=(zoneCounts[e.zone]||0)+1;
    return {name:'street-dressing',logical:activeSlots+customEntries.length,instances:active,allocatedInstances:allocated,drawCalls:Object.keys(meshes).length,realtimeLights:0,customPlacements:customEntries.length,zones:zoneCounts};
  }
  function dispose(){
    group.removeFromParent();for(const mesh of Object.values(meshes))mesh.removeFromParent();
    for(const geometry of [boxGeometry,cylinderGeometry,wheelGeometry,foliageGeometry,archGeometry,planeGeometry])geometry.dispose();
    if(owned)materials.dispose?.();
  }
  reset();options.parent?.add?.(group);
  return {group,meshes,materials,update,reset,setDensity,getDiagnostics,dispose};
}
