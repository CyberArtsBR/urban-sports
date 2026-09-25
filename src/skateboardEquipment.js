import * as THREE from 'three';

const DEFAULTS=Object.freeze({
  width:.74,
  length:2.05,
  thickness:.055,
  wheelbase:1.34,
  truckTrack:.88,
  wheelRadius:.078,
  wheelWidth:.050,
  boardY:.185,
  maxLean:.22,
  maxTruckSteer:.115
});

function smooth01(value){
  const t=THREE.MathUtils.clamp(value,0,1);
  return t*t*(3-2*t);
}

function createDeckGeometry({
  width=DEFAULTS.width,
  length=DEFAULTS.length,
  thickness=DEFAULTS.thickness,
  concave=.018,
  kick=.145,
  widthSegments=12,
  lengthSegments=44
}={}){
  const halfW=width*.5;
  const halfL=length*.5;
  const row=widthSegments+1;
  const positions=[];
  const uvs=[];
  const indices=[];

  const profile=(x,z,top=true)=>{
    const longitudinal=Math.abs(z)/halfL;
    const noseT=smooth01((longitudinal-.68)/.32);
    const taper=smooth01((longitudinal-.74)/.26);
    const endScale=Math.max(.10,Math.sqrt(Math.max(0,1-taper*taper)));
    const localHalfW=halfW*endScale;
    const across=localHalfW>1e-5?THREE.MathUtils.clamp(Math.abs(x)/localHalfW,0,1):0;
    const sideConcave=concave*across*across*(1-noseT*.28);
    const kickLift=kick*noseT*noseT*(.78+.22*(1-across));
    const shell=top?thickness*.5:-thickness*.5;
    return shell+sideConcave+kickLift;
  };

  const xAt=(u,z)=>{
    const longitudinal=Math.abs(z)/halfL;
    const taper=smooth01((longitudinal-.74)/.26);
    const endScale=Math.max(.10,Math.sqrt(Math.max(0,1-taper*taper)));
    return (u*2-1)*halfW*endScale;
  };

  for(let layer=0;layer<2;layer++){
    const top=layer===0;
    for(let iz=0;iz<=lengthSegments;iz++){
      const v=iz/lengthSegments;
      const z=THREE.MathUtils.lerp(-halfL,halfL,v);
      for(let ix=0;ix<=widthSegments;ix++){
        const u=ix/widthSegments;
        const x=xAt(u,z);
        positions.push(x,profile(x,z,top),z);
        uvs.push(u,v);
      }
    }
  }

  const layerSize=(lengthSegments+1)*row;
  for(let layer=0;layer<2;layer++){
    const top=layer===0;
    const offset=layer*layerSize;
    for(let iz=0;iz<lengthSegments;iz++)for(let ix=0;ix<widthSegments;ix++){
      const a=offset+iz*row+ix;
      const b=a+1;
      const c=a+row;
      const d=c+1;
      if(top)indices.push(a,c,b,b,c,d);
      else indices.push(a,b,c,b,d,c);
    }
  }

  const topOffset=0;
  const bottomOffset=layerSize;
  const addSideStrip=(ix)=>{
    for(let iz=0;iz<lengthSegments;iz++){
      const ta=topOffset+iz*row+ix;
      const tb=topOffset+(iz+1)*row+ix;
      const ba=bottomOffset+iz*row+ix;
      const bb=bottomOffset+(iz+1)*row+ix;
      if(ix===0)indices.push(ta,ba,tb,tb,ba,bb);
      else indices.push(ta,tb,ba,tb,bb,ba);
    }
  };
  addSideStrip(0);
  addSideStrip(widthSegments);

  for(const iz of [0,lengthSegments]){
    for(let ix=0;ix<widthSegments;ix++){
      const ta=topOffset+iz*row+ix;
      const tb=ta+1;
      const ba=bottomOffset+iz*row+ix;
      const bb=ba+1;
      if(iz===0)indices.push(ta,tb,ba,tb,bb,ba);
      else indices.push(ta,ba,tb,tb,ba,bb);
    }
  }

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function markShadow(object){
  object.traverse(child=>{
    if(!child.isMesh)return;
    child.castShadow=true;
    child.receiveShadow=true;
  });
  return object;
}

function makeBox(x,y,z,material,name=''){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),material);
  if(name)mesh.name=name;
  return mesh;
}

function makeCylinder(radius,length,material,radialSegments=18){
  const geometry=new THREE.CylinderGeometry(radius,radius,length,radialSegments,1,false);
  geometry.rotateZ(Math.PI*.5);
  return new THREE.Mesh(geometry,material);
}

function createTruck({z,front,materials,track=DEFAULTS.truckTrack,wheelRadius=DEFAULTS.wheelRadius,wheelWidth=DEFAULTS.wheelWidth}={}){
  const pivot=new THREE.Group();
  pivot.name=front?'skateboard-front-truck':'skateboard-rear-truck';
  pivot.position.z=z;

  const baseplate=makeBox(.46,.038,.22,materials.truck,'truck-baseplate');
  baseplate.position.y=-.054;
  pivot.add(baseplate);

  const riser=makeBox(.36,.020,.18,materials.riser,'truck-riser');
  riser.position.y=-.033;
  pivot.add(riser);

  const kingpin=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.18,14),materials.hardware);
  kingpin.name='truck-kingpin';
  kingpin.rotation.x=(front?-1:1)*.18;
  kingpin.position.set(0,-.105,.014*(front?-1:1));
  pivot.add(kingpin);

  const hanger=makeCylinder(.042,track*.80,materials.truck,20);
  hanger.position.y=-.112;
  pivot.add(hanger);

  const axle=makeCylinder(.017,track+.13,materials.hardware,14);
  axle.position.y=-.112;
  pivot.add(axle);

  const bushingTop=new THREE.Mesh(new THREE.CylinderGeometry(.050,.058,.040,18),materials.bushing);
  bushingTop.position.set(0,-.075,.015*(front?-1:1));
  pivot.add(bushingTop);
  const bushingBottom=new THREE.Mesh(new THREE.CylinderGeometry(.058,.050,.040,18),materials.bushing);
  bushingBottom.position.set(0,-.143,.015*(front?-1:1));
  pivot.add(bushingBottom);

  const wheels=[];
  const wheelContacts=[];
  for(const side of [-1,1]){
    const wheelGroup=new THREE.Group();
    wheelGroup.name=`skateboard-${front?'front':'rear'}-${side<0?'left':'right'}-wheel`;
    wheelGroup.position.set(side*track*.5,-.112,0);

    const wheel=makeCylinder(wheelRadius,wheelWidth,materials.wheel,26);
    wheel.name='wheel-tire';
    wheelGroup.add(wheel);

    const hub=makeCylinder(wheelRadius*.46,wheelWidth+.006,materials.hub,22);
    hub.name='wheel-hub';
    wheelGroup.add(hub);

    const bearing=makeCylinder(wheelRadius*.18,wheelWidth+.010,materials.bearing,18);
    bearing.name='wheel-bearing';
    wheelGroup.add(bearing);

    const ledRing=new THREE.Mesh(new THREE.TorusGeometry(wheelRadius*.31,.008,8,24),materials.powerLed);
    ledRing.rotation.y=Math.PI*.5;
    ledRing.name='banana-power-wheel-led';
    ledRing.visible=false;
    wheelGroup.add(ledRing);

    pivot.add(wheelGroup);
    wheels.push(wheelGroup);

    const contact=new THREE.Object3D();
    contact.name=`skateboard-${front?'front':'rear'}-${side<0?'left':'right'}-contact`;
    contact.position.set(side*track*.5,-.112-wheelRadius,0);
    pivot.add(contact);
    wheelContacts.push(contact);
  }

  return {pivot,wheels,wheelContacts};
}

export function createSkateboardEquipment({
  centerX=0,
  z=0,
  boardY=DEFAULTS.boardY,
  deckColor=0x151a22,
  undersideColor=0x2b1464,
  accentColor=0xffd23f,
  width=DEFAULTS.width,
  length=DEFAULTS.length,
  wheelbase=DEFAULTS.wheelbase,
  truckTrack=DEFAULTS.truckTrack,
  wheelRadius=DEFAULTS.wheelRadius,
  wheelWidth=DEFAULTS.wheelWidth,
  maxLean=DEFAULTS.maxLean,
  maxTruckSteer=DEFAULTS.maxTruckSteer
}={}){
  const root=new THREE.Group();
  root.name='skateboard-equipment';
  root.position.set(centerX,boardY,z);

  const motionRoot=new THREE.Group();
  motionRoot.name='skateboard-motion-root';
  root.add(motionRoot);

  const materials={
    edge:new THREE.MeshStandardMaterial({color:0x111418,roughness:.32,metalness:.28}),
    deck:new THREE.MeshPhysicalMaterial({
      color:deckColor,roughness:.42,metalness:.02,clearcoat:.46,clearcoatRoughness:.34,
      emissive:0x000000,emissiveIntensity:0
    }),
    underside:new THREE.MeshPhysicalMaterial({
      color:undersideColor,roughness:.25,metalness:.05,clearcoat:.72,clearcoatRoughness:.20,
      emissive:0x080019,emissiveIntensity:.08
    }),
    accent:new THREE.MeshStandardMaterial({
      color:accentColor,roughness:.28,metalness:.12,emissive:0x2a1700,emissiveIntensity:.08
    }),
    truck:new THREE.MeshStandardMaterial({color:0xb5c2cc,roughness:.22,metalness:.82}),
    hardware:new THREE.MeshStandardMaterial({color:0x2d3339,roughness:.24,metalness:.92}),
    riser:new THREE.MeshStandardMaterial({color:0x13171b,roughness:.62,metalness:.06}),
    bushing:new THREE.MeshPhysicalMaterial({color:0x1872cc,roughness:.34,metalness:.02,clearcoat:.52,clearcoatRoughness:.28}),
    wheel:new THREE.MeshPhysicalMaterial({
      color:0xe7edf1,roughness:.34,metalness:.02,clearcoat:.44,clearcoatRoughness:.30,
      emissive:0x000000,emissiveIntensity:0
    }),
    hub:new THREE.MeshStandardMaterial({color:0x1c2730,roughness:.25,metalness:.50}),
    bearing:new THREE.MeshStandardMaterial({color:0xc8d5de,roughness:.16,metalness:.94}),
    powerLed:new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(.018,1.04,12.0),toneMapped:false,fog:false})
  };

  const edge=new THREE.Mesh(createDeckGeometry({width,length,thickness:.064,concave:.021,kick:.150}),materials.edge);
  edge.name='skateboard-deck-edge';
  motionRoot.add(edge);

  const deck=new THREE.Mesh(createDeckGeometry({width:width*.967,length:length*.985,thickness:.044,concave:.020,kick:.158}),materials.deck);
  deck.name='skateboard-deck';
  deck.position.y=.013;
  motionRoot.add(deck);

  const underside=new THREE.Mesh(new THREE.PlaneGeometry(width*.54,length*.62),materials.underside);
  underside.name='skateboard-underside-graphic';
  underside.rotation.x=Math.PI*.5;
  underside.position.set(0,-.038,0);
  motionRoot.add(underside);

  const centerStripe=makeBox(.075,.008,length*.66,materials.accent,'skateboard-center-stripe');
  centerStripe.position.set(0,-.043,0);
  motionRoot.add(centerStripe);

  for(const sign of [-1,1]){
    const badge=new THREE.Mesh(new THREE.RingGeometry(.075,.128,28),materials.accent);
    badge.name=sign<0?'skateboard-tail-badge':'skateboard-nose-badge';
    badge.rotation.x=Math.PI*.5;
    badge.position.set(0,-.045,sign*length*.34);
    motionRoot.add(badge);
  }

  const deckLedMaterial=new THREE.MeshBasicMaterial({
    color:new THREE.Color().setRGB(.018,1.05,12.2),
    toneMapped:false,
    fog:false,
    transparent:true,
    opacity:.98
  });
  const ledMeshes=[];
  for(const side of [-1,1]){
    const led=makeBox(.020,.014,length*.72,deckLedMaterial,'banana-power-deck-led');
    led.position.set(side*width*.43,-.050,0);
    led.visible=false;
    motionRoot.add(led);
    ledMeshes.push(led);
  }

  const frontTruck=createTruck({
    z:-wheelbase*.5,front:true,materials,track:truckTrack,wheelRadius,wheelWidth
  });
  const rearTruck=createTruck({
    z:wheelbase*.5,front:false,materials,track:truckTrack,wheelRadius,wheelWidth
  });
  motionRoot.add(frontTruck.pivot,rearTruck.pivot);

  const wheels=[...frontTruck.wheels,...rearTruck.wheels];
  const wheelContacts=[...frontTruck.wheelContacts,...rearTruck.wheelContacts];
  const trailContacts=[rearTruck.wheelContacts[0],rearTruck.wheelContacts[1]];
  const ledWheelRings=[];
  for(const wheel of wheels){
    const ring=wheel.getObjectByName('banana-power-wheel-led');
    if(ring)ledWheelRings.push(ring);
  }

  const powerMaterials=[materials.deck,materials.underside,materials.accent,materials.wheel,materials.bushing];
  const powerBase=powerMaterials.map(mat=>({emissive:mat.emissive?.clone?.()||new THREE.Color(0),intensity:mat.emissiveIntensity||0}));
  const powerColor=new THREE.Color(0x168cff);
  let powerLevel=0;
  let wheelPhase=0;
  let targetLean=0;
  let targetSteer=0;

  function setPowerGlow(level=0,time=0){
    powerLevel=THREE.MathUtils.clamp(Number(level)||0,0,1);
    const visible=powerLevel>.001;
    for(const led of ledMeshes)led.visible=visible;
    for(const ring of ledWheelRings)ring.visible=visible;
    powerMaterials.forEach((mat,index)=>{
      if(!mat.emissive)return;
      const base=powerBase[index];
      mat.emissive.copy(base.emissive).lerp(powerColor,powerLevel*(index===0?.76:1));
      mat.emissiveIntensity=base.intensity+powerLevel*(index===0?.92:index===3?.72:1.30);
    });
    root.userData.powerGlow=powerLevel;
    return powerLevel;
  }

  function setLean(lean=0,{normalized=true,immediate=false}={}){
    const numeric=Number(lean)||0;
    targetLean=normalized
      ?THREE.MathUtils.clamp(numeric,-1,1)*maxLean
      :THREE.MathUtils.clamp(numeric,-maxLean,maxLean);
    if(immediate)motionRoot.rotation.z=targetLean;
    return targetLean;
  }

  function setTruckSteer(steer=0,{normalized=true,immediate=false}={}){
    const numeric=Number(steer)||0;
    targetSteer=normalized
      ?THREE.MathUtils.clamp(numeric,-1,1)*maxTruckSteer
      :THREE.MathUtils.clamp(numeric,-maxTruckSteer,maxTruckSteer);
    if(immediate){
      frontTruck.pivot.rotation.y=targetSteer;
      rearTruck.pivot.rotation.y=-targetSteer;
    }
    return targetSteer;
  }

  function setWheelRotation(angle=0){
    wheelPhase=Number(angle)||0;
    for(const wheel of wheels)wheel.rotation.x=wheelPhase;
    return wheelPhase;
  }

  function spinWheels(deltaRadians=0){
    return setWheelRotation(wheelPhase+(Number(deltaRadians)||0));
  }

  function updateMotion({dt=1/60,speed=0,lean=0,steer=null,air=false,time=0,trickType='',trickProgress=0}={}){
    const frameDt=THREE.MathUtils.clamp(Number(dt)||0,0,.10);
    setLean(lean);
    setTruckSteer(steer==null?lean:steer);

    const response=1-Math.pow(1-.22,frameDt*60);
    const progress=THREE.MathUtils.clamp(Number(trickProgress)||0,0,1);
    const turn=progress*Math.PI*2;
    const halfTurn=progress*Math.PI;
    const grabArc=Math.sin(progress*Math.PI);
    let boardFlip=0;
    let boardShove=0;
    let boardPitch=0;

    if(trickType==='KICKFLIP')boardFlip=turn;
    else if(trickType==='HEELFLIP')boardFlip=-turn;
    else if(trickType==='POP SHOVE-IT')boardShove=halfTurn;
    else if(trickType==='FRONTSIDE SHOVE-IT')boardShove=-halfTurn;
    else if(trickType==='VARIAL FLIP'){boardFlip=turn;boardShove=halfTurn;}
    else if(trickType==='360 FLIP'){boardFlip=turn;boardShove=turn;}
    else if(trickType==='INDY')boardPitch=.08*grabArc;
    else if(trickType==='MELON')boardPitch=-.07*grabArc;
    else if(trickType==='NOSEGRAB')boardPitch=-.12*grabArc;

    const trickResponse=1-Math.pow(1-(air?.58:.24),frameDt*60);
    motionRoot.rotation.z=THREE.MathUtils.lerp(motionRoot.rotation.z,targetLean+boardFlip,trickResponse);
    motionRoot.rotation.y=THREE.MathUtils.lerp(motionRoot.rotation.y,boardShove,trickResponse);
    motionRoot.rotation.x=THREE.MathUtils.lerp(motionRoot.rotation.x,boardPitch,trickResponse);
    frontTruck.pivot.rotation.y=THREE.MathUtils.lerp(frontTruck.pivot.rotation.y,targetSteer,response);
    rearTruck.pivot.rotation.y=THREE.MathUtils.lerp(rearTruck.pivot.rotation.y,-targetSteer,response);

    const linearSpeed=Math.max(0,Number(speed)||0);
    const spinRate=linearSpeed/Math.max(.001,wheelRadius);
    const coastScale=air?.72:1;
    spinWheels(-spinRate*frameDt*coastScale);

    if(powerLevel>0)setPowerGlow(powerLevel,time);
    return {
      wheelRotation:wheelPhase,
      lean:motionRoot.rotation.z,
      frontTruckSteer:frontTruck.pivot.rotation.y,
      rearTruckSteer:rearTruck.pivot.rotation.y,
      powerGlow:powerLevel,
      trickType,
      trickProgress:progress
    };
  }

  function dispose(){
    const geometries=new Set();
    const ownedMaterials=new Set(Object.values(materials));
    ownedMaterials.add(deckLedMaterial);
    root.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
    });
    geometries.forEach(geometry=>geometry.dispose?.());
    ownedMaterials.forEach(material=>material.dispose?.());
  }

  markShadow(root);
  for(const led of [...ledMeshes,...ledWheelRings]){
    led.castShadow=false;
    led.receiveShadow=false;
  }

  root.userData.restPosition=root.position.clone();
  root.userData.equipmentType='skateboard';
  root.userData.boardWidth=width;
  root.userData.boardLength=length;
  root.userData.deckTopOffset=.045;
  root.userData.wheelbase=wheelbase;
  root.userData.wheelRadius=wheelRadius;
  root.userData.wheels=wheels;
  root.userData.wheelContacts=wheelContacts;
  root.userData.trailContacts=trailContacts;
  root.userData.motionRoot=motionRoot;
  root.userData.setPowerGlow=setPowerGlow;
  root.userData.setLean=setLean;
  root.userData.setTruckSteer=setTruckSteer;
  root.userData.setWheelRotation=setWheelRotation;
  root.userData.spinWheels=spinWheels;
  root.userData.updateMotion=updateMotion;
  root.userData.dispose=dispose;
  setPowerGlow(0,0);

  return {
    root,
    motionRoot,
    wheels,
    wheelContacts,
    trailContacts,
    setPowerGlow,
    setLean,
    setTruckSteer,
    setWheelRotation,
    spinWheels,
    updateMotion,
    dispose
  };
}
