import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const URBAN_FACADE_FAMILIES=Object.freeze([
  'concrete','brick','modern-glass','painted-commercial','industrial',
  'mixed-use','residential','warehouse','entertainment','event-district'
]);

export const URBAN_BUILDING_ARCHETYPES=Object.freeze([
  'mixed-use','office-tower','industrial-service','entertainment',
  'glass-crown','brick-loft','hotel-stack'
]);

export const URBAN_ARCHETYPE_MATERIAL_KEYS=Object.freeze([
  'facadeCommercial','facadeGlass','facadeIndustrial','facadeEntertainment',
  'facadeGlass','facadeBrick','facadeResidential'
]);

function paint(geometry,hex){
  const color=new THREE.Color(hex);
  const count=geometry.getAttribute('position').count;
  const values=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    values[i*3]=color.r;values[i*3+1]=color.g;values[i*3+2]=color.b;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(values,3));
  return geometry;
}

function box({x=0,y=0,z=0,sx=1,sy=1,sz=1,color=0xffffff,rx=0,ry=0,rz=0}){
  const geometry=new THREE.BoxGeometry(sx,sy,sz);
  if(rx)geometry.rotateX(rx);if(ry)geometry.rotateY(ry);if(rz)geometry.rotateZ(rz);
  geometry.translate(x,y,z);
  return paint(geometry,color);
}

function cylinder({x=0,y=0,z=0,rt=.1,rb=.1,h=.2,segments=8,color=0xffffff,rx=0,ry=0,rz=0}){
  const geometry=new THREE.CylinderGeometry(rt,rb,h,segments,1,false);
  if(rx)geometry.rotateX(rx);if(ry)geometry.rotateY(ry);if(rz)geometry.rotateZ(rz);
  geometry.translate(x,y,z);
  return paint(geometry,color);
}

function merge(parts,name){
  const geometry=mergeGeometries(parts,false);
  for(const part of parts)part.dispose();
  geometry.name=name;geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

function horizontalBands(parts,{ys=[.28,.46,.64,.82],depth=1.02,width=1.02,color=0x8b969f,thickness=.016}={}){
  for(const y of ys)parts.push(box({y,sx:depth,sy:thickness,sz:width,color}));
}
function verticalPiers(parts,{zs=[-.34,0,.34],x=.505,height=.60,color=0x727f89,width=.028}={}){
  for(const z of zs){
    parts.push(box({x:-x,y:.50,z,sx:width,sy:height,sz:.045,color}));
    parts.push(box({x:x,y:.50,z,sx:width,sy:height,sz:.045,color}));
  }
}
function rooftopKit(parts,{y=.96,width=.56,depth=.50,industrial=false}={}){
  parts.push(box({y,sx:depth,sy:.065,sz:width,color:0x68737b}));
  parts.push(box({x:-depth*.20,y:y+.07,z:-width*.18,sx:.17,sy:.10,sz:.18,color:0x4f5b63}));
  parts.push(box({x:depth*.20,y:y+.06,z:width*.13,sx:.15,sy:.08,sz:.21,color:0x59656d}));
  parts.push(cylinder({x:-depth*.06,y:y+.15,z:width*.24,rt:.035,rb:.04,h:.24,segments:7,color:0x46535d}));
  parts.push(cylinder({x:depth*.17,y:y+.16,z:-width*.22,rt:.025,rb:.03,h:.28,segments:6,color:0x46535d}));
  if(industrial){
    parts.push(box({x:depth*.05,y:y+.11,z:.0,sx:.22,sy:.10,sz:.12,color:0x525e65}));
    parts.push(box({x:depth*.18,y:y+.16,z:.0,sx:.08,sy:.18,sz:.08,color:0x414b52}));
  }
}
function storefrontKit(parts,{accent=0x55616d,frame=0x343e48}={}){
  for(const side of [-1,1]){
    const x=side*.515;
    parts.push(box({x,y:.115,z:-.28,sx:.018,sy:.20,sz:.38,color:0x5b6873}));
    parts.push(box({x,y:.115,z:.28,sx:.018,sy:.20,sz:.38,color:0x64727d}));
    parts.push(box({x:side*.522,y:.228,z:0,sx:.025,sy:.028,sz:.92,color:accent}));
    for(const z of [-.46,0,.46])parts.push(box({x:side*.523,y:.115,z,sx:.028,sy:.22,sz:.025,color:frame}));
    parts.push(box({x:side*.528,y:.285,z:.0,sx:.03,sy:.065,sz:.70,color:accent}));
  }
}
function balconyKit(parts,{rows=[.42,.62,.80],width=.74,sideDepth=.08}={}){
  for(const side of [-1,1])for(const y of rows){
    const x=side*(.50+sideDepth*.5);
    parts.push(box({x,y,z:0,sx:sideDepth,sy:.035,sz:width,color:0x68737a}));
    parts.push(box({x:side*(.50+sideDepth),y:y+.095,z:0,sx:.025,sy:.18,sz:width,color:0x59656d}));
    for(const z of [-width*.44,0,width*.44])parts.push(box({x:side*(.50+sideDepth+.012),y:y+.11,z,sx:.025,sy:.22,sz:.025,color:0x4d5961}));
  }
}
function fireEscapeKit(parts){
  for(const side of [-1,1]){
    const x=side*.555;
    for(const y of [.38,.58,.78]){
      parts.push(box({x,y,z:.20,sx:.07,sy:.025,sz:.34,color:0x4b5358}));
      parts.push(box({x:side*.59,y:y+.09,z:.20,sx:.018,sy:.18,sz:.34,color:0x414a50}));
    }
    parts.push(box({x:side*.595,y:.56,z:.05,sx:.018,sy:.62,sz:.035,color:0x3c454b,rz:side*.18}));
  }
}
function serviceBayKit(parts){
  for(const side of [-1,1]){
    const x=side*.535;
    for(const z of [-.27,.27]){
      parts.push(box({x,y:.18,z,sx:.045,sy:.28,sz:.36,color:0x4e565b}));
      for(const y of [.10,.18,.26])parts.push(box({x:side*.56,y,z,sx:.025,sy:.02,sz:.30,color:0x737b7f}));
    }
    parts.push(box({x:side*.54,y:.42,z:.0,sx:.035,sy:.13,sz:.78,color:0x596166}));
  }
}
function eventMarqueeKit(parts){
  for(const side of [-1,1]){
    const x=side*.545;
    parts.push(box({x,y:.34,z:0,sx:.07,sy:.10,sz:.82,color:0x343b48}));
    parts.push(box({x:side*.59,y:.49,z:0,sx:.025,sy:.18,sz:.68,color:0x48586c}));
    for(const z of [-.30,-.10,.10,.30])parts.push(box({x:side*.605,y:.49,z,sx:.020,sy:.12,sz:.035,color:0x8698a6}));
  }
}

function mixedUse(){
  const p=[
    box({y:.10,sx:1.10,sy:.20,sz:1.06,color:0xaeb7c0}),
    box({y:.49,sx:.96,sy:.78,sz:.96,color:0xdfdfdc}),
    box({y:.88,sx:.80,sy:.12,sz:.82,color:0xc5cbd0})
  ];
  horizontalBands(p,{ys:[.29,.48,.67],color:0x98a2aa});
  verticalPiers(p,{zs:[-.36,-.12,.12,.36],height:.61,color:0x7c8790});
  storefrontKit(p,{accent:0x7f5f50,frame:0x3f4b54});
  rooftopKit(p,{y:.98,width:.44,depth:.42});
  return merge(p,'urban-facade-mixed-use');
}

function officeTower(){
  const p=[
    box({y:.09,sx:1.12,sy:.18,sz:1.08,color:0xaab5bf}),
    box({y:.45,sx:.86,sy:.72,sz:.90,color:0xd9e0e5}),
    box({y:.79,sx:.74,sy:.16,sz:.78,color:0xbcc7cf}),
    box({y:.92,sx:.60,sy:.10,sz:.64,color:0xa4b2bc})
  ];
  horizontalBands(p,{ys:[.25,.37,.49,.61,.73],depth:.90,width:.94,color:0x7c8994,thickness:.012});
  verticalPiers(p,{zs:[-.32,-.16,0,.16,.32],x:.445,height:.60,color:0x687783,width:.022});
  for(const side of [-1,1])p.push(box({x:side*.458,y:.50,z:0,sx:.022,sy:.58,sz:.82,color:0x70818d}));
  rooftopKit(p,{y:1.01,width:.34,depth:.32});
  return merge(p,'urban-facade-office-tower');
}

function industrial(){
  const p=[
    box({y:.30,sx:1.08,sy:.60,sz:1.10,color:0xc2c2bc}),
    box({x:-.20,y:.66,sx:.48,sy:.14,sz:.92,color:0xa0a7a7}),
    box({x:.30,y:.64,sx:.36,sy:.10,sz:.86,color:0x8f9799}),
    box({y:.08,sx:1.14,sy:.16,sz:1.16,color:0x858e90})
  ];
  serviceBayKit(p);
  for(const z of [-.36,0,.36]){
    p.push(box({x:-.55,y:.47,z,sx:.065,sy:.30,sz:.13,color:0x6e797c}));
    p.push(box({x:.55,y:.47,z,sx:.065,sy:.30,sz:.13,color:0x6e797c}));
  }
  rooftopKit(p,{y:.78,width:.70,depth:.54,industrial:true});
  p.push(box({y:.90,z:-.27,sx:.028,sy:.26,sz:.028,color:0x455157}));
  p.push(box({y:.94,z:.27,sx:.028,sy:.34,sz:.028,color:0x455157}));
  return merge(p,'urban-facade-industrial-service');
}

function entertainment(){
  const p=[
    box({y:.11,sx:1.12,sy:.22,sz:1.08,color:0x9faab5}),
    box({y:.47,sx:.92,sy:.72,sz:.92,color:0xd8dadf}),
    box({y:.80,sx:1.02,sy:.07,sz:.96,color:0x7c8794}),
    box({y:.90,sx:.74,sy:.13,sz:.76,color:0xbcc5cc})
  ];
  horizontalBands(p,{ys:[.32,.54,.72],depth:.99,width:.98,color:0x929da7});
  eventMarqueeKit(p);
  storefrontKit(p,{accent:0x614a70,frame:0x333a45});
  rooftopKit(p,{y:1.01,width:.48,depth:.44});
  return merge(p,'urban-facade-entertainment');
}

function glassCrown(){
  const p=[
    box({y:.08,sx:1.10,sy:.16,sz:1.06,color:0x81909d}),
    box({y:.40,sx:.88,sy:.64,sz:.92,color:0xd2dce3}),
    box({y:.72,sx:.78,sy:.14,sz:.82,color:0xa9b9c5}),
    box({y:.86,sx:.64,sy:.14,sz:.68,color:0x899eae}),
    box({y:.97,sx:.44,sy:.08,sz:.48,color:0x657d8e})
  ];
  verticalPiers(p,{zs:[-.32,-.16,0,.16,.32],x:.452,height:.58,color:0x566c7b,width:.018});
  for(const z of [-.30,-.10,.10,.30])p.push(box({y:.44,z,sx:.86,sy:.014,sz:.020,color:0x6a7e8b}));
  p.push(box({y:1.075,sx:.025,sy:.18,sz:.025,color:0x3f5360}));
  p.push(cylinder({y:1.18,rt:.018,rb:.022,h:.22,segments:6,color:0x3f5360}));
  return merge(p,'urban-facade-glass-crown');
}

function brickLoft(){
  const p=[
    box({y:.10,sx:1.06,sy:.20,sz:1.04,color:0x81665c}),
    box({y:.46,sx:.94,sy:.72,sz:.96,color:0xad8573}),
    box({y:.84,sx:1.00,sy:.05,sz:1.02,color:0x65534c}),
    box({y:.91,sx:.72,sy:.10,sz:.74,color:0x746963})
  ];
  horizontalBands(p,{ys:[.27,.43,.59,.75],depth:.99,width:.99,color:0x715a52,thickness:.018});
  verticalPiers(p,{zs:[-.34,0,.34],x:.49,height:.56,color:0x65514b,width:.026});
  fireEscapeKit(p);
  rooftopKit(p,{y:.98,width:.40,depth:.38,industrial:true});
  return merge(p,'urban-facade-brick-loft');
}

function hotelStack(){
  const p=[
    box({y:.09,sx:1.12,sy:.18,sz:1.06,color:0x9ba6b0}),
    box({y:.28,sx:1.00,sy:.20,sz:.96,color:0xd0d2d5}),
    box({y:.50,sx:.92,sy:.22,sz:.90,color:0xc1c6ca}),
    box({y:.72,sx:.84,sy:.22,sz:.84,color:0xb4bcc2}),
    box({y:.88,sx:.70,sy:.10,sz:.72,color:0xa5afb7})
  ];
  horizontalBands(p,{ys:[.37,.59,.81],depth:.96,width:.94,color:0x7b8791,thickness:.022});
  balconyKit(p,{rows:[.39,.61,.79],width:.70,sideDepth:.09});
  storefrontKit(p,{accent:0x6e7378,frame:0x3f484f});
  rooftopKit(p,{y:.98,width:.38,depth:.36});
  return merge(p,'urban-facade-hotel-stack');
}

function windowTone(index){
  const state=(index*37+index*index*11+17)%29;
  if(state<5)return .035;if(state<9)return .16;if(state<15)return .38;if(state<23)return .72;
  return 1;
}

function windowKit(){
  const parts=[];
  const rows=[.27,.36,.45,.54,.63,.72,.81];
  const columns=[-.36,-.18,0,.18,.36];
  let n=0;
  for(const y of rows){
    for(const z of columns){
      const tone=Math.round(255*windowTone(n++));
      const color=(tone<<16)|(tone<<8)|tone;
      parts.push(box({x:-.507,y,z,sx:.012,sy:.062,sz:.105,color}));
      parts.push(box({x:.507,y,z,sx:.012,sy:.062,sz:.105,color}));
      if((n%7)===0){
        const blind=Math.max(24,Math.round(tone*.42));
        const blindColor=(blind<<16)|(blind<<8)|blind;
        parts.push(box({x:-.514,y:y+.012,z,sx:.008,sy:.018,sz:.094,color:blindColor}));
        parts.push(box({x:.514,y:y+.012,z,sx:.008,sy:.018,sz:.094,color:blindColor}));
      }
    }
  }
  const sideColumns=[-.32,-.11,.11,.32];
  for(const y of rows){
    for(const x of sideColumns){
      const tone=Math.round(255*windowTone(n++));
      const color=(tone<<16)|(tone<<8)|tone;
      parts.push(box({x,y,z:-.507,sx:.105,sy:.062,sz:.012,color}));
      parts.push(box({x,y,z:.507,sx:.105,sy:.062,sz:.012,color}));
    }
  }
  for(const side of [-1,1]){
    parts.push(box({x:side*.518,y:.115,z:-.28,sx:.010,sy:.13,sz:.34,color:0xf0f0f0}));
    parts.push(box({x:side*.518,y:.115,z:.28,sx:.010,sy:.13,sz:.34,color:0xa8a8a8}));
  }
  return merge(parts,'urban-facade-window-kit');
}

function ledKit(){
  const parts=[
    box({x:-.522,y:.22,sx:.012,sy:.028,sz:.68,color:0xffffff}),
    box({x:.522,y:.22,sx:.012,sy:.028,sz:.68,color:0xdadada}),
    box({x:-.520,y:.58,z:.41,sx:.014,sy:.22,sz:.045,color:0xcfcfcf}),
    box({x:.520,y:.58,z:-.41,sx:.014,sy:.22,sz:.045,color:0xf0f0f0}),
    box({y:.846,z:-.507,sx:.58,sy:.020,sz:.012,color:0xe5e5e5}),
    box({y:.846,z:.507,sx:.58,sy:.020,sz:.012,color:0xc7c7c7})
  ];
  return merge(parts,'urban-facade-led-kit');
}

export function createUrbanFacadeGeometrySet(){
  const archetypes=[
    mixedUse(),officeTower(),industrial(),entertainment(),
    glassCrown(),brickLoft(),hotelStack()
  ];
  const lights=windowKit();
  const leds=ledKit();
  return {
    archetypes,lights,leds,
    families:URBAN_FACADE_FAMILIES,
    materialKeys:URBAN_ARCHETYPE_MATERIAL_KEYS,
    dispose(){
      for(const geometry of archetypes)geometry.dispose();
      lights.dispose();leds.dispose();
    }
  };
}
