import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const EVENT_Z=1.25;
const CLEAR_HALF_WIDTH=4.18;
const UNIT_BOX=new THREE.BoxGeometry(1,1,1);
const UNIT_PLANE=new THREE.PlaneGeometry(1,1);
const UNIT_CYLINDER=new THREE.CylinderGeometry(1,1,1,10,1,false);
const CROWD_HEAD_GEOMETRY=new THREE.SphereGeometry(.5,10,7);

function canvasTexture(width,height,draw){
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d');
  draw(ctx,width,height);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  return texture;
}

function roundedRect(ctx,x,y,w,h,r){
  const radius=Math.min(r,w*.5,h*.5);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
}

function createHeroBannerTexture(){
  return canvasTexture(2048,512,(ctx,w,h)=>{
    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#05080e');
    bg.addColorStop(.44,'#0b1724');
    bg.addColorStop(1,'#060910');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.globalAlpha=.16;
    ctx.strokeStyle='#45d9ff';
    ctx.lineWidth=3;
    for(let x=-h;x<w+h;x+=88){
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x-h,h);
      ctx.stroke();
    }
    ctx.restore();

    const edge=ctx.createLinearGradient(0,0,w,0);
    edge.addColorStop(0,'#00b7ff');
    edge.addColorStop(.5,'#68edff');
    edge.addColorStop(1,'#ff315f');
    ctx.fillStyle=edge;
    ctx.fillRect(0,0,w,18);
    ctx.fillRect(0,h-18,w,18);

    ctx.fillStyle='rgba(255,255,255,.07)';
    ctx.fillRect(48,54,w-96,h-108);
    ctx.strokeStyle='rgba(126,229,255,.28)';
    ctx.lineWidth=4;
    ctx.strokeRect(48,54,w-96,h-108);

    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.shadowColor='rgba(54,219,255,.45)';
    ctx.shadowBlur=18;
    ctx.fillStyle='#eaf8ff';
    ctx.font='800 60px Arial, sans-serif';
    ctx.fillText('CHIMPIONS URBAN SPORTS',w*.5,h*.205);

    ctx.shadowColor='rgba(255,52,93,.26)';
    ctx.shadowBlur=12;
    ctx.fillStyle='#ffffff';
    ctx.font='900 182px Arial Black, Arial, sans-serif';
    ctx.fillText('START',w*.5,h*.54);

    ctx.shadowBlur=0;
    ctx.fillStyle='#7feaff';
    ctx.font='700 36px Arial, sans-serif';
    ctx.fillText('STREET SERIES 01   //   RIDE THE CITY',w*.5,h*.835);

    for(const side of [-1,1]){
      const x=side<0?92:w-92;
      ctx.fillStyle=side<0?'#32d9ff':'#ff315f';
      ctx.beginPath();
      ctx.moveTo(x-side*68,h*.50);
      ctx.lineTo(x-side*6,h*.35);
      ctx.lineTo(x+side*26,h*.35);
      ctx.lineTo(x-side*36,h*.50);
      ctx.lineTo(x+side*26,h*.65);
      ctx.lineTo(x-side*6,h*.65);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function createSidePanelTexture(side=1){
  return canvasTexture(512,1024,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#090d14');
    g.addColorStop(1,'#16202c');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle=side<0?'#27d4ff':'#ff315f';
    ctx.fillRect(0,0,28,h);
    ctx.fillRect(w-28,0,28,h);
    ctx.strokeStyle='rgba(255,255,255,.16)';
    ctx.lineWidth=4;
    ctx.strokeRect(54,54,w-108,h-108);

    ctx.save();
    ctx.translate(w*.5,h*.5);
    ctx.rotate(-Math.PI/2);
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle='#ffffff';
    ctx.font='900 72px Arial Black, Arial, sans-serif';
    ctx.fillText('CHIMPIONS',0,-34);
    ctx.fillStyle='#8beaff';
    ctx.font='800 40px Arial, sans-serif';
    ctx.fillText('URBAN SPORTS',0,42);
    ctx.restore();

    ctx.fillStyle='#f5bf31';
    for(let y=92;y<h-92;y+=92){
      ctx.fillRect(w*.5-7,y,14,34);
    }
  });
}

function createSpeakerTexture(){
  return canvasTexture(512,1024,(ctx,w,h)=>{
    ctx.fillStyle='#090b0f';
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#323842';
    ctx.lineWidth=14;
    ctx.strokeRect(14,14,w-28,h-28);
    for(let i=0;i<4;i++){
      const cy=140+i*242;
      const rg=ctx.createRadialGradient(w*.5,cy,18,w*.5,cy,104);
      rg.addColorStop(0,'#2b3139');
      rg.addColorStop(.58,'#11151b');
      rg.addColorStop(.76,'#05070a');
      rg.addColorStop(1,'#262d35');
      ctx.fillStyle=rg;
      ctx.beginPath();
      ctx.arc(w*.5,cy,106,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='rgba(119,221,255,.18)';
      ctx.lineWidth=4;
      ctx.stroke();
      ctx.fillStyle='#3fdcff';
      ctx.beginPath();
      ctx.arc(w*.5,cy,11,0,Math.PI*2);
      ctx.fill();
    }
  });
}

function createBarrierBannerTexture(){
  return canvasTexture(1536,256,(ctx,w,h)=>{
    ctx.fillStyle='#070b11';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#12c9ff';
    ctx.fillRect(0,0,w,12);
    ctx.fillStyle='#ff315f';
    ctx.fillRect(0,h-12,w,12);

    const labels=['CHIMPIONS','GRID//LINE','APEX STREET','BANANA LABS','NIGHTSHIFT'];
    const cell=w/labels.length;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    labels.forEach((label,i)=>{
      ctx.fillStyle=i%2===0?'#eaf8ff':'#f5bf31';
      ctx.font=i===0?'900 45px Arial Black, Arial, sans-serif':'800 36px Arial, sans-serif';
      ctx.fillText(label,cell*(i+.5),h*.50);
      if(i<labels.length-1){
        ctx.strokeStyle='rgba(255,255,255,.16)';
        ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(cell*(i+1),40);
        ctx.lineTo(cell*(i+1),h-40);
        ctx.stroke();
      }
    });
  });
}

function createDirectionTexture(text,accent='#32d9ff'){
  return canvasTexture(768,256,(ctx,w,h)=>{
    ctx.fillStyle='#0a0f16';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle=accent;
    ctx.fillRect(0,0,18,h);
    ctx.fillRect(w-18,0,18,h);
    ctx.strokeStyle='rgba(255,255,255,.17)';
    ctx.lineWidth=5;
    ctx.strokeRect(38,28,w-76,h-56);
    ctx.fillStyle='#ffffff';
    ctx.font='900 61px Arial Black, Arial, sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(text,w*.5,h*.46);
    ctx.fillStyle=accent;
    ctx.font='700 28px Arial, sans-serif';
    ctx.fillText('CHIMPIONS EVENT OPERATIONS',w*.5,h*.75);
  });
}

function createStartRoadTexture(){
  return canvasTexture(1536,512,(ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='rgba(255,255,255,.96)';
    ctx.fillRect(0,26,w,58);
    ctx.fillStyle='rgba(50,217,255,.95)';
    ctx.fillRect(0,92,w,15);
    ctx.fillStyle='rgba(255,49,95,.92)';
    ctx.fillRect(0,h-108,w,15);
    ctx.fillStyle='rgba(255,255,255,.96)';
    ctx.fillRect(0,h-84,w,58);
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle='#f7fbff';
    ctx.font='900 186px Arial Black, Arial, sans-serif';
    ctx.fillText('START',w*.5,h*.51);
    ctx.strokeStyle='rgba(50,217,255,.75)';
    ctx.lineWidth=8;
    ctx.strokeText('START',w*.5,h*.51);
  });
}

function createFlagTexture(accent='#32d9ff'){
  return canvasTexture(512,768,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#080d14');
    g.addColorStop(1,'#172536');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle=accent;
    ctx.fillRect(0,0,24,h);
    ctx.fillStyle='#ffffff';
    ctx.font='900 64px Arial Black, Arial, sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.save();
    ctx.translate(w*.5,h*.5);
    ctx.rotate(-Math.PI/2);
    ctx.fillText('CHIMPIONS',0,-18);
    ctx.fillStyle=accent;
    ctx.font='800 35px Arial, sans-serif';
    ctx.fillText('URBAN SPORTS',0,52);
    ctx.restore();
  });
}

function addMesh(parent,geometry,material,{position,rotation,scale,cast=false,receive=false,name=''}={}){
  const result=new THREE.Mesh(geometry,material);
  if(position)result.position.set(position[0],position[1],position[2]);
  if(rotation)result.rotation.set(rotation[0],rotation[1],rotation[2]);
  if(scale)result.scale.set(scale[0],scale[1],scale[2]);
  result.castShadow=cast;
  result.receiveShadow=receive;
  if(name)result.name=name;
  parent.add(result);
  return result;
}

function addBox(parent,material,position,scale,{rotation=null,cast=false,receive=false,name=''}={}){
  return addMesh(parent,UNIT_BOX,material,{position,scale,rotation,cast,receive,name});
}

function addPlane(parent,material,position,scale,{rotation=null,name=''}={}){
  return addMesh(parent,UNIT_PLANE,material,{position,scale,rotation,name});
}

function terrainY(terrainHeight,x,z,offset=0){
  return (Number(terrainHeight?.(x,z))||0)+offset;
}

function addInstancedSegments(parent,segments,material,{radius=.045,name='start-event-truss'}={}){
  const instanced=new THREE.InstancedMesh(UNIT_CYLINDER,material,segments.length);
  instanced.name=name;
  instanced.castShadow=true;
  const up=new THREE.Vector3(0,1,0);
  const start=new THREE.Vector3();
  const end=new THREE.Vector3();
  const midpoint=new THREE.Vector3();
  const direction=new THREE.Vector3();
  const quaternion=new THREE.Quaternion();
  const scale=new THREE.Vector3();
  const matrix=new THREE.Matrix4();

  segments.forEach((segment,index)=>{
    start.set(segment[0][0],segment[0][1],segment[0][2]);
    end.set(segment[1][0],segment[1][1],segment[1][2]);
    direction.subVectors(end,start);
    const length=Math.max(.001,direction.length());
    midpoint.copy(start).add(end).multiplyScalar(.5);
    quaternion.setFromUnitVectors(up,direction.normalize());
    const localRadius=segment[2]||radius;
    scale.set(localRadius,length,localRadius);
    matrix.compose(midpoint,quaternion,scale);
    instanced.setMatrixAt(index,matrix);
  });
  instanced.instanceMatrix.needsUpdate=true;
  parent.add(instanced);
  return instanced;
}

function addTowerTrussSegments(segments,x,ground,z,height=5.62,width=.78,depth=.68){
  const x0=x-width*.5;
  const x1=x+width*.5;
  const z0=z-depth*.5;
  const z1=z+depth*.5;
  const bottom=ground+.52;
  const top=ground+height;

  for(const cx of [x0,x1]){
    for(const cz of [z0,z1]){
      segments.push([[cx,bottom,cz],[cx,top,cz],.052]);
    }
  }

  for(let y=bottom+.12,level=0;y<top-.2;y+=.76,level++){
    const next=Math.min(y+.66,top-.10);
    segments.push([[x0,y,z0],[x1,y,z0],.036],[[x0,y,z1],[x1,y,z1],.036]);
    segments.push([[x0,y,z0],[x0,y,z1],.036],[[x1,y,z0],[x1,y,z1],.036]);

    const flip=level%2===0;
    segments.push([
      [flip?x0:x1,y,z0],
      [flip?x1:x0,next,z0],
      .029
    ]);
    segments.push([
      [flip?x1:x0,y,z1],
      [flip?x0:x1,next,z1],
      .029
    ]);
    segments.push([
      [x0,y,flip?z0:z1],
      [x0,next,flip?z1:z0],
      .028
    ]);
    segments.push([
      [x1,y,flip?z1:z0],
      [x1,next,flip?z0:z1],
      .028
    ]);
  }
}

function addCrossTrussSegments(segments,left,right,y,z,height=.76,depth=.72){
  const y0=y-height*.5;
  const y1=y+height*.5;
  const z0=z-depth*.5;
  const z1=z+depth*.5;
  for(const cy of [y0,y1]){
    for(const cz of [z0,z1]){
      segments.push([[left,cy,cz],[right,cy,cz],.052]);
    }
  }
  for(let x=left+.22,cell=0;x<right-.22;x+=.82,cell++){
    const nx=Math.min(x+.70,right-.12);
    for(const cz of [z0,z1]){
      segments.push([[x,y0,cz],[x,y1,cz],.030]);
      segments.push([[x,y0,cz],[nx,y1,cz],.028]);
      segments.push([[x,y1,cz],[nx,y0,cz],.028]);
    }
    segments.push([[x,y0,z0],[x,y0,z1],.028]);
    segments.push([[x,y1,z0],[x,y1,z1],.028]);
  }
}

function addBoltGrid(parent,material,x,ground,z,side){
  const boltGeometry=new THREE.CylinderGeometry(1,1,1,12,1,false);
  const positions=[];
  for(const y of [.72,1.38,2.04,2.70,3.36,4.02]){
    for(const dz of [-.27,.27])positions.push([x-side*.405,ground+y,z+dz]);
  }
  const instanced=new THREE.InstancedMesh(boltGeometry,material,positions.length);
  instanced.name='start-event-bolts';
  const matrix=new THREE.Matrix4();
  const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,Math.PI/2));
  const scale=new THREE.Vector3(.048,.06,.048);
  positions.forEach((p,i)=>{
    matrix.compose(new THREE.Vector3(p[0],p[1],p[2]),quaternion,scale);
    instanced.setMatrixAt(i,matrix);
  });
  instanced.instanceMatrix.needsUpdate=true;
  instanced.castShadow=true;
  parent.add(instanced);
}

function addTowerBase(parent,materials,x,ground,z,side,panelMaterial){
  addMesh(parent,new RoundedBoxGeometry(1.32,.34,1.18,4,.075),materials.ballast,{
    position:[x,ground+.17,z],cast:true,receive:true,name:'start-event-ballast'
  });
  addMesh(parent,new RoundedBoxGeometry(1.10,.22,.98,3,.05),materials.yellow,{
    position:[x,ground+.42,z],cast:true,receive:true,name:'start-event-base-plate'
  });
  addMesh(parent,new RoundedBoxGeometry(.90,1.44,.82,4,.10),materials.padding,{
    position:[x,ground+1.18,z],cast:true,name:'start-event-safety-padding'
  });
  addPlane(parent,panelMaterial,[x,ground+2.88,z-.365],[.72,3.15,1],{
    name:'start-event-pillar-brand'
  });
  addBox(parent,materials.cyan,[x-side*.43,ground+1.17,z-.36],[.035,1.30,.035],{
    name:'start-event-pillar-led'
  });
}

function addSpeakerArray(parent,materials,speakerMaterial,x,ground,z,side){
  const hangY=ground+4.33;
  addBox(parent,materials.black,[x,hangY,z],[.90,2.45,.64],{
    rotation:[0,side<0?.055:-.055,side<0?-.045:.045],
    cast:true,
    name:'start-event-speaker-array'
  });
  addPlane(parent,speakerMaterial,[x,hangY,z-.329],[.79,2.28,1],{
    rotation:[0,0,side<0?-.045:.045],
    name:'start-event-speaker-face'
  });
  addBox(parent,materials.steel,[x,ground+5.46,z],[.12,.73,.12],{
    rotation:[0,0,side<0?-.16:.16],
    cast:true,
    name:'start-event-speaker-hanger'
  });
  addBox(parent,materials.black,[x,ground+2.76,z+.02],[1.02,.54,.72],{
    cast:true,
    name:'start-event-subwoofer'
  });
  addBox(parent,materials.cyan,[x,ground+2.48,z-.37],[.78,.035,.035],{
    name:'start-event-speaker-led'
  });
}

function addFloodFixtures(parent,materials,ground,z){
  const fixtures=[
    [-3.45,ground+5.62,z-.53,.12],
    [-2.08,ground+5.62,z-.53,.07],
    [-.70,ground+5.62,z-.53,.03],
    [.70,ground+5.62,z-.53,-.03],
    [2.08,ground+5.62,z-.53,-.07],
    [3.45,ground+5.62,z-.53,-.12]
  ];
  for(const [x,y,fz,rz] of fixtures){
    const holder=new THREE.Group();
    holder.position.set(x,y,fz);
    holder.rotation.z=rz;
    parent.add(holder);
    addMesh(holder,new RoundedBoxGeometry(.56,.34,.22,3,.055),materials.black,{
      position:[0,0,0],cast:true,name:'start-event-flood-housing'
    });
    addPlane(holder,materials.whiteLed,[0,0,-.116],[.42,.22,1],{
      name:'start-event-flood-emitter'
    });
    addBox(holder,materials.steel,[0,-.28,.04],[.08,.38,.08],{
      rotation:[.16,0,0],cast:true
    });
  }
}

function addTimingHardware(parent,materials,x,ground,z,side){
  addBox(parent,materials.black,[x,ground+1.62,z-.54],[.23,.58,.29],{
    cast:true,name:'start-event-timing-sensor'
  });
  addPlane(parent,materials.cyan,[x,ground+1.68,z-.69],[.12,.21,1],{
    name:'start-event-timing-led'
  });
  addMesh(parent,new THREE.CylinderGeometry(.055,.055,.26,10),materials.steel,{
    position:[x-side*.21,ground+1.61,z-.52],
    rotation:[0,0,Math.PI/2],
    cast:true,
    name:'start-event-timing-lens'
  });
}

function addStartMarking(parent,terrainHeight,material,z){
  const y=terrainY(terrainHeight,0,z-.90,.024);
  addPlane(parent,material,[0,y,z-.90],[7.45,2.08,1],{
    rotation:[-Math.PI/2,0,0],
    name:'start-event-road-marking'
  });
}

function addBarrierLines(parent,materials,bannerMaterial,terrainHeight){
  const segmentCenters=[-3.15,1.05,5.25];
  const posts=[];
  const rails=[];
  for(const side of [-1,1]){
    const x=side*6.48;
    for(const centerZ of segmentCenters){
      const y=terrainY(terrainHeight,x,centerZ);
      const segmentLength=3.74;
      rails.push({p:[x,y+.28,centerZ],s:[.055,.055,segmentLength]});
      rails.push({p:[x,y+1.08,centerZ],s:[.055,.055,segmentLength]});
      rails.push({p:[x-side*.025,y+.66,centerZ],s:[.04,.04,segmentLength]});
      for(const dz of [-1.82,0,1.82]){
        posts.push({p:[x,y+.60,centerZ+dz],s:[.065,1.20,.065]});
      }
      addPlane(parent,bannerMaterial,[x-side*.045,y+.72,centerZ],[2.96,.48,1],{
        rotation:[0,side>0?-Math.PI/2:Math.PI/2,0],
        name:'start-event-barrier-banner'
      });
    }
  }

  const postMesh=new THREE.InstancedMesh(UNIT_BOX,materials.barrier,posts.length);
  postMesh.name='start-event-barrier-posts';
  const railMesh=new THREE.InstancedMesh(UNIT_BOX,materials.barrier,rails.length);
  railMesh.name='start-event-barrier-rails';
  const matrix=new THREE.Matrix4();
  posts.forEach((entry,i)=>{
    matrix.compose(new THREE.Vector3(...entry.p),new THREE.Quaternion(),new THREE.Vector3(...entry.s));
    postMesh.setMatrixAt(i,matrix);
  });
  rails.forEach((entry,i)=>{
    matrix.compose(new THREE.Vector3(...entry.p),new THREE.Quaternion(),new THREE.Vector3(...entry.s));
    railMesh.setMatrixAt(i,matrix);
  });
  postMesh.instanceMatrix.needsUpdate=true;
  railMesh.instanceMatrix.needsUpdate=true;
  postMesh.castShadow=true;
  railMesh.castShadow=true;
  parent.add(postMesh,railMesh);
}

function addCrowdSilhouettes(parent,materials,terrainHeight){
  const people=[];
  for(const side of [-1,1]){
    for(let i=0;i<18;i++){
      const lane=i%2;
      const z=-3.9+i*.68+(lane*.10);
      const x=side*(7.15+lane*.42+((i%3)-1)*.06);
      const height=1.48+(i%5)*.075;
      people.push({x,z,height,side,index:i});
    }
  }

  const bodies=new THREE.InstancedMesh(UNIT_BOX,materials.crowd,people.length);
  const heads=new THREE.InstancedMesh(CROWD_HEAD_GEOMETRY,materials.crowdHead,people.length);
  bodies.name='start-event-crowd-bodies';
  heads.name='start-event-crowd-heads';
  bodies.castShadow=true;
  heads.castShadow=true;
  const matrix=new THREE.Matrix4();
  const palette=[
    new THREE.Color(0x263749),
    new THREE.Color(0x14324b),
    new THREE.Color(0x3b263e),
    new THREE.Color(0x37434c),
    new THREE.Color(0x2f2522),
    new THREE.Color(0x1c3b32)
  ];
  const skinPalette=[
    new THREE.Color(0x9a6b4d),
    new THREE.Color(0xc58a65),
    new THREE.Color(0x714a36),
    new THREE.Color(0xd0a17e),
    new THREE.Color(0x8d5c42)
  ];

  people.forEach((person,i)=>{
    const ground=terrainY(terrainHeight,person.x,person.z);
    const bodyScale=new THREE.Vector3(.42,person.height*.58,.30);
    const bodyPos=new THREE.Vector3(person.x,ground+person.height*.39,person.z);
    matrix.compose(bodyPos,new THREE.Quaternion(),bodyScale);
    bodies.setMatrixAt(i,matrix);
    bodies.setColorAt(i,palette[(person.index+person.side+8)%palette.length]);

    const headScale=.30+(person.index%3)*.018;
    const headPos=new THREE.Vector3(person.x,ground+person.height*.83,person.z);
    matrix.compose(headPos,new THREE.Quaternion(),new THREE.Vector3(headScale,headScale,headScale));
    heads.setMatrixAt(i,matrix);
    heads.setColorAt(i,skinPalette[(person.index*2+3)%skinPalette.length]);
  });
  bodies.instanceMatrix.needsUpdate=true;
  heads.instanceMatrix.needsUpdate=true;
  if(bodies.instanceColor)bodies.instanceColor.needsUpdate=true;
  if(heads.instanceColor)heads.instanceColor.needsUpdate=true;
  parent.add(bodies,heads);
  return people.length;
}

function addEventCases(parent,materials,terrainHeight){
  const cases=[
    [-7.36,4.45,.95,.54,.62],
    [-7.12,5.25,.74,.42,.52],
    [7.34,4.92,.94,.50,.64],
    [7.12,5.70,.68,.38,.48]
  ];
  for(const [x,z,w,h,d] of cases){
    const y=terrainY(terrainHeight,x,z,h*.5);
    addMesh(parent,new RoundedBoxGeometry(w,h,d,3,.055),materials.case,{
      position:[x,y,z],cast:true,receive:true,name:'start-event-equipment-case'
    });
    addBox(parent,materials.steel,[x,y,z-d*.51],[w*.72,.045,.025],{name:'start-event-case-trim'});
    for(const sx of [-1,1]){
      addBox(parent,materials.yellow,[x+sx*w*.42,y-h*.40,z],[.055,.10,d*.86],{
        name:'start-event-case-corner'
      });
    }
  }
}

function addTripodCamera(parent,materials,terrainHeight,x,z,side){
  const ground=terrainY(terrainHeight,x,z);
  const hubY=ground+1.26;
  const segments=[
    [[x,hubY,z],[x-.43,ground+.04,z+.38],.027],
    [[x,hubY,z],[x+.43,ground+.04,z+.38],.027],
    [[x,hubY,z],[x,ground+.04,z-.48],.027]
  ];
  addInstancedSegments(parent,segments,materials.steel,{radius:.026,name:'start-event-camera-tripod'});
  addBox(parent,materials.black,[x,hubY+.18,z],[.52,.34,.48],{
    rotation:[0,side<0?-.46:.46,0],cast:true,name:'start-event-camera-body'
  });
  addMesh(parent,new THREE.CylinderGeometry(.10,.13,.26,12),materials.black,{
    position:[x-side*.24,hubY+.18,z-.12],
    rotation:[0,0,Math.PI/2],
    cast:true,
    name:'start-event-camera-lens'
  });
  addMesh(parent,new THREE.CylinderGeometry(.07,.07,.28,10),materials.cyan,{
    position:[x+side*.06,hubY+.45,z],
    name:'start-event-camera-tally'
  });
}

function addDirectionalSign(parent,materials,material,terrainHeight,x,z,side){
  const ground=terrainY(terrainHeight,x,z);
  addMesh(parent,new THREE.CylinderGeometry(.035,.045,1.48,9),materials.steel,{
    position:[x,ground+.74,z],cast:true
  });
  addMesh(parent,new RoundedBoxGeometry(1.58,.56,.12,3,.045),materials.black,{
    position:[x,ground+1.54,z],rotation:[0,side>0?-Math.PI/2:Math.PI/2,0],cast:true
  });
  addPlane(parent,material,[x-side*.066,ground+1.54,z],[1.42,.42,1],{
    rotation:[0,side>0?-Math.PI/2:Math.PI/2,0],
    name:'start-event-direction-sign'
  });
}

function addFlags(parent,materials,terrainHeight,flagBlue,flagRed){
  const flags=[
    [-7.72,-2.2,-1,flagBlue],
    [-7.72,7.25,-1,flagRed],
    [7.72,-2.2,1,flagRed],
    [7.72,7.25,1,flagBlue]
  ];
  for(const [x,z,side,material] of flags){
    const ground=terrainY(terrainHeight,x,z);
    addMesh(parent,new THREE.CylinderGeometry(.027,.037,3.15,9),materials.steel,{
      position:[x,ground+1.575,z],cast:true,name:'start-event-flag-pole'
    });
    addMesh(parent,new THREE.SphereGeometry(.055,8,6),materials.yellow,{
      position:[x,ground+3.18,z],cast:true
    });
    addPlane(parent,material,[x+side*.46,ground+2.35,z],[.86,1.42,1],{
      rotation:[0,side<0?Math.PI:0,0],
      name:'start-event-flag'
    });
  }
}

function addCable(parent,material,terrainHeight,x,points,name){
  const curvePoints=points.map(([dx,dz,dy])=>new THREE.Vector3(
    x+dx,
    terrainY(terrainHeight,x+dx,EVENT_Z+dz,dy),
    EVENT_Z+dz
  ));
  const curve=new THREE.CatmullRomCurve3(curvePoints);
  const geometry=new THREE.TubeGeometry(curve,18,.022,6,false);
  addMesh(parent,geometry,material,{position:[0,0,0],name});
}

function addScaffoldDeck(parent,materials,terrainHeight){
  for(const side of [-1,1]){
    const x=side*7.22;
    const z=3.10;
    const ground=terrainY(terrainHeight,x,z);
    addBox(parent,materials.steel,[x,ground+1.92,z],[1.62,.11,2.28],{
      cast:true,receive:true,name:'start-event-scaffold-deck'
    });
    const legs=[];
    for(const sx of [-.68,.68]){
      for(const sz of [-.92,.92]){
        legs.push([[x+sx,ground+.03,z+sz],[x+sx,ground+1.88,z+sz],.035]);
      }
    }
    legs.push(
      [[x-.68,ground+.12,z-.92],[x+.68,ground+1.72,z-.92],.025],
      [[x+.68,ground+.12,z+.92],[x-.68,ground+1.72,z+.92],.025]
    );
    addInstancedSegments(parent,legs,materials.steel,{radius:.032,name:'start-event-side-scaffold'});
    addBox(parent,materials.black,[x,ground+2.26,z],[1.16,.46,.62],{
      cast:true,name:'start-event-control-console'
    });
    addBox(parent,materials.cyan,[x-side*.595,ground+2.28,z],[.028,.23,.44],{
      name:'start-event-console-led'
    });
  }
}

function createMaterials(){
  return {
    steel:new THREE.MeshStandardMaterial({color:0x566574,roughness:.34,metalness:.78,envMapIntensity:.70}),
    steelDark:new THREE.MeshStandardMaterial({color:0x202a35,roughness:.29,metalness:.82,envMapIntensity:.64}),
    black:new THREE.MeshStandardMaterial({color:0x070a0f,roughness:.34,metalness:.50,envMapIntensity:.44}),
    padding:new THREE.MeshStandardMaterial({color:0x10161e,roughness:.76,metalness:.03}),
    ballast:new THREE.MeshStandardMaterial({color:0x363c43,roughness:.86,metalness:.04}),
    yellow:new THREE.MeshStandardMaterial({color:0xe5aa27,roughness:.48,metalness:.24}),
    barrier:new THREE.MeshStandardMaterial({color:0x8997a3,roughness:.42,metalness:.70}),
    case:new THREE.MeshStandardMaterial({color:0x151b23,roughness:.54,metalness:.36}),
    cable:new THREE.MeshStandardMaterial({color:0x08090b,roughness:.82,metalness:.05}),
    crowd:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.80,metalness:0}),
    crowdHead:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,metalness:0}),
    cyan:new THREE.MeshBasicMaterial({
      color:new THREE.Color().setRGB(.02,.62,1.28),
      toneMapped:false,
      fog:false
    }),
    magenta:new THREE.MeshBasicMaterial({
      color:new THREE.Color().setRGB(1.22,.045,.19),
      toneMapped:false,
      fog:false
    }),
    whiteLed:new THREE.MeshBasicMaterial({
      color:new THREE.Color().setRGB(.92,.97,1.08),
      toneMapped:false,
      fog:false
    })
  };
}

export function createUrbanStartEventScene({world,terrainHeight=()=>0}={}){
  const root=new THREE.Group();
  root.name='aaa-urban-start-event';
  world?.add?.(root);

  const materials=createMaterials();
  const heroMaterial=new THREE.MeshBasicMaterial({
    map:createHeroBannerTexture(),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const leftPanelMaterial=new THREE.MeshBasicMaterial({
    map:createSidePanelTexture(-1),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const rightPanelMaterial=new THREE.MeshBasicMaterial({
    map:createSidePanelTexture(1),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const speakerMaterial=new THREE.MeshBasicMaterial({
    map:createSpeakerTexture(),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const barrierBannerMaterial=new THREE.MeshBasicMaterial({
    map:createBarrierBannerTexture(),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const ridersSignMaterial=new THREE.MeshBasicMaterial({
    map:createDirectionTexture('RIDERS  >','#32d9ff'),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const crewSignMaterial=new THREE.MeshBasicMaterial({
    map:createDirectionTexture('<  EVENT CREW','#ff315f'),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const startRoadMaterial=new THREE.MeshStandardMaterial({
    map:createStartRoadTexture(),
    transparent:true,
    alphaTest:.08,
    roughness:.82,
    metalness:0,
    polygonOffset:true,
    polygonOffsetFactor:-2,
    polygonOffsetUnits:-2
  });
  const blueFlagMaterial=new THREE.MeshBasicMaterial({
    map:createFlagTexture('#32d9ff'),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });
  const redFlagMaterial=new THREE.MeshBasicMaterial({
    map:createFlagTexture('#ff315f'),
    side:THREE.DoubleSide,
    toneMapped:false,
    fog:false
  });

  const centerGround=terrainY(terrainHeight,0,EVENT_Z);
  const trussSegments=[];
  const towerX=5.12;

  for(const side of [-1,1]){
    const x=side*towerX;
    const ground=terrainY(terrainHeight,x,EVENT_Z);
    addTowerTrussSegments(trussSegments,x,ground,EVENT_Z);
    addTowerBase(
      root,
      materials,
      x,
      ground,
      EVENT_Z,
      side,
      side<0?leftPanelMaterial:rightPanelMaterial
    );
    addBoltGrid(root,materials.steel,x,ground,EVENT_Z,side);
    addTimingHardware(root,materials,x,ground,EVENT_Z,side);
    addSpeakerArray(root,materials,speakerMaterial,side*6.13,ground,EVENT_Z+.04,side);
  }

  addCrossTrussSegments(trussSegments,-5.51,5.51,centerGround+5.56,EVENT_Z);
  addInstancedSegments(root,trussSegments,materials.steelDark,{
    radius:.045,
    name:'start-event-main-truss'
  });

  addMesh(root,new RoundedBoxGeometry(8.78,1.46,.19,4,.065),materials.black,{
    position:[0,centerGround+4.48,EVENT_Z-.34],
    cast:true,
    name:'start-event-hero-backplate'
  });
  addPlane(root,heroMaterial,[0,centerGround+4.48,EVENT_Z-.45],[8.46,1.22,1],{
    name:'start-event-hero-banner'
  });
  addPlane(root,heroMaterial,[0,centerGround+4.48,EVENT_Z+.45],[8.46,1.22,1],{
    rotation:[0,Math.PI,0],
    name:'start-event-hero-banner-rear'
  });
  addBox(root,materials.cyan,[0,centerGround+5.15,EVENT_Z-.46],[8.55,.035,.035],{
    name:'start-event-banner-led-cyan'
  });
  addBox(root,materials.magenta,[0,centerGround+3.81,EVENT_Z-.46],[8.55,.035,.035],{
    name:'start-event-banner-led-magenta'
  });

  addFloodFixtures(root,materials,centerGround,EVENT_Z);
  addStartMarking(root,terrainHeight,startRoadMaterial,EVENT_Z);
  addBarrierLines(root,materials,barrierBannerMaterial,terrainHeight);
  const crowdCount=addCrowdSilhouettes(root,materials,terrainHeight);
  addEventCases(root,materials,terrainHeight);
  addTripodCamera(root,materials,terrainHeight,-6.88,-1.32,-1);
  addTripodCamera(root,materials,terrainHeight,6.88,-1.32,1);
  addDirectionalSign(root,materials,ridersSignMaterial,terrainHeight,-6.92,-4.36,-1);
  addDirectionalSign(root,materials,crewSignMaterial,terrainHeight,6.92,-4.36,1);
  addFlags(root,materials,terrainHeight,blueFlagMaterial,redFlagMaterial);
  addScaffoldDeck(root,materials,terrainHeight);

  addCable(
    root,
    materials.cable,
    terrainHeight,
    -5.52,
    [[0,0,.12],[-.54,1.45,.08],[-.82,3.0,.06],[-.48,4.6,.05]],
    'start-event-left-cable'
  );
  addCable(
    root,
    materials.cable,
    terrainHeight,
    5.52,
    [[0,0,.12],[.54,1.45,.08],[.82,3.0,.06],[.48,4.6,.05]],
    'start-event-right-cable'
  );

  const stats=Object.freeze({
    design:'aaa-urban-start-event-v1',
    dynamicLights:0,
    crowdInstances:crowdCount,
    trussSegments:trussSegments.length,
    safeHalfWidth:CLEAR_HALF_WIDTH,
    anchorZ:EVENT_Z
  });

  root.userData.startEvent=stats;
  root.userData.gameplayClearance={
    halfWidth:CLEAR_HALF_WIDTH,
    minOverheadY:centerGround+3.72,
    collisionMeshesAdded:0
  };

  function reset(){
    root.position.z=0;
    root.visible=true;
  }

  function update(worldDistance=0){
    root.position.z+=Math.max(0,Number(worldDistance)||0);
    root.visible=root.position.z<28;
  }

  return {
    root,
    reset,
    update,
    get visible(){return root.visible;},
    get stats(){return stats;}
  };
}
