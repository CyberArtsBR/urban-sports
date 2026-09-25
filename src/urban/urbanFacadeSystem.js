import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const URBAN_BUILDING_ARCHETYPES=Object.freeze([
  'mixed-use',
  'office-tower',
  'industrial-service',
  'entertainment',
  'glass-crown',
  'brick-loft',
  'hotel-stack',
  'parking-podium'
]);

function paint(geometry,hex){
  const color=new THREE.Color(hex);
  const count=geometry.getAttribute('position').count;
  const values=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    values[i*3]=color.r;
    values[i*3+1]=color.g;
    values[i*3+2]=color.b;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(values,3));
  return geometry;
}

function box({x=0,y=0,z=0,sx=1,sy=1,sz=1,color=0xffffff,ry=0}){
  const geometry=new THREE.BoxGeometry(sx,sy,sz);
  if(ry)geometry.rotateY(ry);
  geometry.translate(x,y,z);
  return paint(geometry,color);
}

function merge(parts,name){
  const geometry=mergeGeometries(parts,false);
  for(const part of parts)part.dispose();
  geometry.name=name;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function roofKit(parts,{y=.94,width=.60,depth=.54}={}){
  parts.push(box({y,sx:depth,sy:.08,sz:width,color:0x7b858f}));
  parts.push(box({x:-depth*.18,y:y+.075,z:-width*.16,sx:.15,sy:.07,sz:.16,color:0x59636d}));
  parts.push(box({x:depth*.18,y:y+.060,z:width*.12,sx:.12,sy:.05,sz:.18,color:0x636d77}));
  parts.push(box({y:y+.15,sx:.025,sy:.20,sz:.025,color:0x4c565f}));
}

function mixedUse(){
  const p=[
    box({y:.10,sx:1.10,sy:.20,sz:1.06,color:0xb4bbc4}),
    box({y:.48,sx:.96,sy:.76,sz:.96,color:0xe7e8e8}),
    box({y:.86,sx:.79,sy:.16,sz:.80,color:0xcbd0d5}),
    box({x:-.52,y:.52,sx:.05,sy:.64,sz:.92,color:0x8f9aa5}),
    box({x:.52,y:.52,sx:.05,sy:.64,sz:.92,color:0x8f9aa5}),
    box({y:.31,sx:1.02,sy:.018,sz:.98,color:0xaab3bc}),
    box({y:.50,sx:1.02,sy:.018,sz:.98,color:0xaab3bc}),
    box({y:.69,sx:1.02,sy:.018,sz:.98,color:0xaab3bc}),
    box({x:-.54,y:.18,sx:.12,sy:.06,sz:.78,color:0x7e8995}),
    box({x:.54,y:.18,sx:.12,sy:.06,sz:.78,color:0x7e8995})
  ];
  roofKit(p,{y:.98,width:.42,depth:.40});
  return merge(p,'urban-facade-mixed-use');
}

function officeTower(){
  const p=[
    box({y:.09,sx:1.12,sy:.18,sz:1.08,color:0xb6bec7}),
    box({y:.43,sx:.86,sy:.68,sz:.90,color:0xe7eaed}),
    box({y:.77,sx:.74,sy:.18,sz:.78,color:0xcbd2d8}),
    box({y:.91,sx:.62,sy:.10,sz:.64,color:0xb7c0c9})
  ];
  for(const y of [.24,.38,.52,.66])p.push(box({y,sx:.90,sy:.012,sz:.94,color:0x909ca7}));
  for(const z of [-.32,0,.32]){
    p.push(box({x:-.445,y:.47,z,sx:.035,sy:.58,sz:.035,color:0x7e8a95}));
    p.push(box({x:.445,y:.47,z,sx:.035,sy:.58,sz:.035,color:0x7e8a95}));
  }
  roofKit(p,{y:1.01,width:.34,depth:.32});
  return merge(p,'urban-facade-office-tower');
}

function industrial(){
  const p=[
    box({y:.31,sx:1.06,sy:.62,sz:1.08,color:0xd0d0ca}),
    box({x:-.20,y:.66,sx:.48,sy:.14,sz:.90,color:0xabb0b0}),
    box({x:.30,y:.64,sx:.36,sy:.10,sz:.84,color:0x969c9e}),
    box({y:.08,sx:1.12,sy:.16,sz:1.14,color:0x8e9697})
  ];
  for(const z of [-.34,0,.34]){
    p.push(box({x:-.55,y:.33,z,sx:.07,sy:.44,sz:.18,color:0x7a8486}));
    p.push(box({x:.55,y:.33,z,sx:.07,sy:.44,sz:.18,color:0x7a8486}));
  }
  p.push(box({x:-.22,y:.78,sx:.18,sy:.18,sz:.24,color:0x626d70}));
  p.push(box({x:.26,y:.75,sx:.14,sy:.14,sz:.20,color:0x626d70}));
  p.push(box({y:.88,sx:.030,sy:.22,sz:.030,color:0x4e595d}));
  return merge(p,'urban-facade-industrial-service');
}

function entertainment(){
  const p=[
    box({y:.11,sx:1.12,sy:.22,sz:1.08,color:0xa8b0bb}),
    box({y:.46,sx:.92,sy:.70,sz:.92,color:0xe4e5e7}),
    box({y:.78,sx:1.02,sy:.07,sz:.96,color:0x878f9b}),
    box({y:.88,sx:.74,sy:.13,sz:.76,color:0xc6ccd2}),
    box({x:-.52,y:.48,z:-.30,sx:.12,sy:.48,sz:.18,color:0x7d8998}),
    box({x:.52,y:.48,z:.30,sx:.12,sy:.48,sz:.18,color:0x7d8998})
  ];
  for(const y of [.33,.56,.72])p.push(box({y,sx:.98,sy:.015,sz:.98,color:0xa5afb9}));
  roofKit(p,{y:1.00,width:.48,depth:.44});
  return merge(p,'urban-facade-entertainment');
}

function glassCrown(){
  const p=[
    box({y:.08,sx:1.10,sy:.16,sz:1.06,color:0x8997a5}),
    box({y:.40,sx:.88,sy:.64,sz:.92,color:0xdfe5ea}),
    box({y:.72,sx:.78,sy:.14,sz:.82,color:0xb5c2cc}),
    box({y:.86,sx:.64,sy:.14,sz:.68,color:0x96a9b8}),
    box({y:.97,sx:.44,sy:.08,sz:.48,color:0x718696})
  ];
  for(const z of [-.30,-.10,.10,.30]){
    p.push(box({x:-.452,y:.43,z,sx:.022,sy:.56,sz:.025,color:0x647887}));
    p.push(box({x:.452,y:.43,z,sx:.022,sy:.56,sz:.025,color:0x647887}));
  }
  p.push(box({y:1.075,sx:.025,sy:.18,sz:.025,color:0x485b69}));
  return merge(p,'urban-facade-glass-crown');
}

function brickLoft(){
  const p=[
    box({y:.10,sx:1.06,sy:.20,sz:1.04,color:0x8b6d61}),
    box({y:.46,sx:.94,sy:.72,sz:.96,color:0xb78f7c}),
    box({y:.84,sx:1.00,sy:.05,sz:1.02,color:0x6f5a52}),
    box({y:.91,sx:.72,sy:.10,sz:.74,color:0x81736b})
  ];
  for(const y of [.27,.43,.59,.75])p.push(box({y,sx:.99,sy:.022,sz:.99,color:0x785f56}));
  for(const z of [-.34,0,.34]){
    p.push(box({x:-.49,y:.49,z,sx:.026,sy:.56,sz:.055,color:0x6d5952}));
    p.push(box({x:.49,y:.49,z,sx:.026,sy:.56,sz:.055,color:0x6d5952}));
  }
  p.push(box({x:-.24,y:1.00,sx:.12,sy:.16,sz:.14,color:0x5f6668}));
  p.push(box({x:.20,y:.98,sx:.15,sy:.12,sz:.18,color:0x5f6668}));
  return merge(p,'urban-facade-brick-loft');
}

function hotelStack(){
  const p=[
    box({y:.09,sx:1.12,sy:.18,sz:1.06,color:0xa3acb5}),
    box({y:.28,sx:1.00,sy:.20,sz:.96,color:0xd8dadd}),
    box({y:.50,sx:.92,sy:.22,sz:.90,color:0xc9cdd1}),
    box({y:.72,sx:.84,sy:.22,sz:.84,color:0xbcc2c7}),
    box({y:.88,sx:.70,sy:.10,sz:.72,color:0xaeb6bd})
  ];
  for(const y of [.37,.59,.81])p.push(box({y,sx:.96,sy:.025,sz:.94,color:0x858f98}));
  p.push(box({x:-.48,y:.17,sx:.18,sy:.10,sz:.72,color:0x747f89}));
  p.push(box({x:.48,y:.17,sx:.18,sy:.10,sz:.72,color:0x747f89}));
  roofKit(p,{y:.98,width:.38,depth:.36});
  return merge(p,'urban-facade-hotel-stack');
}

function parkingPodium(){
  const p=[
    box({y:.13,sx:1.12,sy:.26,sz:1.08,color:0x969da2}),
    box({y:.42,sx:1.04,sy:.30,sz:1.02,color:0xb1b6b8}),
    box({y:.69,sx:.96,sy:.24,sz:.94,color:0xa4aaad}),
    box({y:.86,sx:.72,sy:.10,sz:.68,color:0x889196})
  ];
  for(const y of [.28,.43,.58,.72])p.push(box({y,sx:1.08,sy:.035,sz:1.04,color:0x697176}));
  for(const z of [-.34,0,.34]){
    p.push(box({x:-.535,y:.48,z,sx:.035,sy:.48,sz:.055,color:0x616a70}));
    p.push(box({x:.535,y:.48,z,sx:.035,sy:.48,sz:.055,color:0x616a70}));
  }
  roofKit(p,{y:.95,width:.30,depth:.34});
  return merge(p,'urban-facade-parking-podium');
}

function windowKit(){
  const parts=[];
  const rows=[.27,.38,.49,.60,.71,.82];
  const frontColumns=[-.34,-.17,0,.17,.34];
  let n=0;
  for(const y of rows){
    for(const z of frontColumns){
      const state=(n*13+7)%17;
      const brightness=state<4?.10:(state<8?.36:(state<14?.76:1));
      const tone=Math.round(255*brightness);
      const color=(tone<<16)|(tone<<8)|tone;
      parts.push(box({x:-.503,y,z,sx:.014,sy:.070,sz:.105,color}));
      parts.push(box({x:.503,y,z,sx:.014,sy:.070,sz:.105,color}));
      n++;
    }
  }
  const sideColumns=[-.31,-.10,.11,.32];
  for(const y of rows){
    for(const x of sideColumns){
      const state=(n*11+3)%19;
      const brightness=state<5?.08:(state<9?.32:(state<16?.72:.95));
      const tone=Math.round(255*brightness);
      const color=(tone<<16)|(tone<<8)|tone;
      parts.push(box({x,y,z:-.503,sx:.105,sy:.070,sz:.014,color}));
      parts.push(box({x,y,z:.503,sx:.105,sy:.070,sz:.014,color}));
      n++;
    }
  }
  // Ground-floor storefront glazing.
  for(const side of [-1,1]){
    parts.push(box({x:side*.515,y:.115,z:-.27,sx:.014,sy:.12,sz:.34,color:0xe8e8e8}));
    parts.push(box({x:side*.515,y:.115,z:.27,sx:.014,sy:.12,sz:.34,color:0xbebebe}));
  }
  return merge(parts,'urban-facade-window-kit');
}

function ledKit(){
  const parts=[
    box({x:-.520,y:.22,sx:.014,sy:.035,sz:.68,color:0xffffff}),
    box({x:.520,y:.22,sx:.014,sy:.035,sz:.68,color:0xdadada}),
    box({x:-.518,y:.58,z:.41,sx:.016,sy:.22,sz:.05,color:0xcfcfcf}),
    box({x:.518,y:.58,z:-.41,sx:.016,sy:.22,sz:.05,color:0xf0f0f0}),
    box({y:.845,z:-.505,sx:.58,sy:.025,sz:.014,color:0xe5e5e5}),
    box({y:.845,z:.505,sx:.58,sy:.025,sz:.014,color:0xc7c7c7})
  ];
  return merge(parts,'urban-facade-led-kit');
}

export function createUrbanFacadeGeometrySet(){
  const archetypes=[
    mixedUse(),officeTower(),industrial(),entertainment(),
    glassCrown(),brickLoft(),hotelStack(),parkingPodium()
  ];
  const lights=windowKit();
  const leds=ledKit();
  return {
    archetypes,
    lights,
    leds,
    dispose(){
      for(const geometry of archetypes)geometry.dispose();
      lights.dispose();
      leds.dispose();
    }
  };
}
