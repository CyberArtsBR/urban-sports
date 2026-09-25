import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const URBAN_BUILDING_ARCHETYPES=Object.freeze([
  'mixed-use',
  'office-tower',
  'industrial-service',
  'entertainment'
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

function box({x=0,y=0,z=0,sx=1,sy=1,sz=1,color=0xffffff}){
  const geometry=new THREE.BoxGeometry(sx,sy,sz);
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

function mixedUse(){
  const parts=[
    box({y:.40,sx:.96,sy:.80,sz:.96,color:0xffffff}),
    box({y:.085,sx:1.05,sy:.17,sz:1.02,color:0xc7ccd3}),
    box({y:.855,sx:.76,sy:.17,sz:.78,color:0xe0e3e6}),
    box({x:-.505,y:.47,z:-.445,sx:.035,sy:.70,sz:.055,color:0xb4bbc3}),
    box({x:-.505,y:.47,z:.445,sx:.035,sy:.70,sz:.055,color:0xb4bbc3}),
    box({x:.505,y:.47,z:-.445,sx:.035,sy:.70,sz:.055,color:0xb4bbc3}),
    box({x:.505,y:.47,z:.445,sx:.035,sy:.70,sz:.055,color:0xb4bbc3}),
    box({y:.31,sx:1.02,sy:.018,sz:.97,color:0xcfd4da}),
    box({y:.49,sx:1.02,sy:.018,sz:.97,color:0xcfd4da}),
    box({y:.67,sx:1.02,sy:.018,sz:.97,color:0xcfd4da}),
    box({x:-.55,y:.19,sx:.12,sy:.035,sz:.72,color:0x9aa5af}),
    box({x:.55,y:.19,sx:.12,sy:.035,sz:.72,color:0x9aa5af}),
    box({y:.965,sx:.42,sy:.07,sz:.34,color:0x8f98a2}),
    box({y:.995,z:.34,sx:.06,sy:.09,sz:.06,color:0x747d88})
  ];
  return merge(parts,'urban-facade-mixed-use');
}

function officeTower(){
  const parts=[
    box({y:.11,sx:1.08,sy:.22,sz:1.04,color:0xc1c8d0}),
    box({y:.49,sx:.82,sy:.76,sz:.84,color:0xffffff}),
    box({y:.86,sx:.68,sy:.16,sz:.66,color:0xd9dde3}),
    box({x:-.425,y:.53,z:-.37,sx:.045,sy:.67,sz:.045,color:0x9fa9b4}),
    box({x:-.425,y:.53,z:.37,sx:.045,sy:.67,sz:.045,color:0x9fa9b4}),
    box({x:.425,y:.53,z:-.37,sx:.045,sy:.67,sz:.045,color:0x9fa9b4}),
    box({x:.425,y:.53,z:.37,sx:.045,sy:.67,sz:.045,color:0x9fa9b4}),
    box({y:.34,sx:.88,sy:.016,sz:.90,color:0xcbd1d7}),
    box({y:.53,sx:.88,sy:.016,sz:.90,color:0xcbd1d7}),
    box({y:.72,sx:.88,sy:.016,sz:.90,color:0xcbd1d7}),
    box({y:.95,sx:.34,sy:.10,sz:.28,color:0x7c8792}),
    box({y:1.025,sx:.045,sy:.12,sz:.045,color:0x65707a})
  ];
  return merge(parts,'urban-facade-office-tower');
}

function industrial(){
  const parts=[
    box({y:.34,sx:1.00,sy:.68,sz:1.00,color:0xf0eee8}),
    box({x:-.20,y:.73,sx:.46,sy:.12,sz:.86,color:0xc0c3c2}),
    box({x:.28,y:.69,sx:.34,sy:.08,sz:.82,color:0xb0b4b5}),
    box({x:-.52,y:.20,sx:.10,sy:.20,sz:.72,color:0x8e979b}),
    box({x:.52,y:.20,sx:.10,sy:.20,sz:.72,color:0x8e979b}),
    box({x:-.545,y:.34,z:-.28,sx:.08,sy:.38,sz:.18,color:0x9fa6a5}),
    box({x:-.545,y:.34,z:.28,sx:.08,sy:.38,sz:.18,color:0x9fa6a5}),
    box({x:.545,y:.34,z:-.28,sx:.08,sy:.38,sz:.18,color:0x9fa6a5}),
    box({x:.545,y:.34,z:.28,sx:.08,sy:.38,sz:.18,color:0x9fa6a5}),
    box({y:.79,z:-.26,sx:.16,sy:.12,sz:.22,color:0x7d8787}),
    box({y:.79,z:.26,sx:.16,sy:.12,sz:.22,color:0x7d8787}),
    box({y:.86,sx:.035,sy:.16,sz:.035,color:0x626c70})
  ];
  return merge(parts,'urban-facade-industrial-service');
}

function entertainment(){
  const parts=[
    box({y:.43,sx:.88,sy:.86,sz:.88,color:0xffffff}),
    box({y:.10,sx:1.08,sy:.20,sz:1.04,color:0xb5bbc6}),
    box({y:.90,sx:.68,sy:.10,sz:.70,color:0xd6dae1}),
    box({y:.975,sx:.46,sy:.07,sz:.50,color:0xb9c0c9}),
    box({x:-.49,y:.47,z:-.29,sx:.12,sy:.48,sz:.17,color:0x8f9baa}),
    box({x:.49,y:.47,z:.29,sx:.12,sy:.48,sz:.17,color:0x8f9baa}),
    box({x:-.54,y:.18,sx:.16,sy:.04,sz:.78,color:0x9ba6b2}),
    box({x:.54,y:.18,sx:.16,sy:.04,sz:.78,color:0x9ba6b2}),
    box({y:.38,sx:.92,sy:.018,sz:.92,color:0xc9ced5}),
    box({y:.61,sx:.92,sy:.018,sz:.92,color:0xc9ced5}),
    box({y:.815,sx:.92,sy:.018,sz:.92,color:0xc9ced5}),
    box({x:-.18,y:1.08,sx:.035,sy:.19,sz:.035,color:0x69737d}),
    box({x:.18,y:1.08,sx:.035,sy:.19,sz:.035,color:0x69737d}),
    box({y:1.13,sx:.05,sy:.16,sz:.44,color:0x929ba5})
  ];
  return merge(parts,'urban-facade-entertainment');
}

function lightKit(){
  const parts=[];
  const rows=[.29,.42,.55,.68,.81];
  const frontColumns=[-.34,-.11,.12,.35];
  let n=0;
  for(const y of rows){
    for(const z of frontColumns){
      const brightness=((n*7+3)%11<3)?.15:(((n*5+1)%9<3)?.48:1);
      const tone=Math.round(255*brightness);
      const color=(tone<<16)|(tone<<8)|tone;
      parts.push(box({x:-.492,y,z,sx:.016,sy:.075,sz:.14,color}));
      parts.push(box({x:.492,y,z,sx:.016,sy:.075,sz:.14,color}));
      n++;
    }
  }
  const sideColumns=[-.29,0,.29];
  for(const y of rows){
    for(const x of sideColumns){
      const brightness=((n*3+2)%10<3)?.12:(((n*7+1)%8<2)?.5:.9);
      const tone=Math.round(255*brightness);
      const color=(tone<<16)|(tone<<8)|tone;
      parts.push(box({x,y,z:-.492,sx:.15,sy:.075,sz:.016,color}));
      parts.push(box({x,y,z:.492,sx:.15,sy:.075,sz:.016,color}));
      n++;
    }
  }
  parts.push(box({x:-.512,y:.10,z:-.27,sx:.018,sy:.11,sz:.36,color:0xe6e6e6}));
  parts.push(box({x:-.512,y:.10,z:.27,sx:.018,sy:.11,sz:.36,color:0x9f9f9f}));
  parts.push(box({x:.512,y:.10,z:-.27,sx:.018,sy:.11,sz:.36,color:0xd2d2d2}));
  parts.push(box({x:.512,y:.10,z:.27,sx:.018,sy:.11,sz:.36,color:0xb8b8b8}));
  parts.push(box({x:-.522,y:.205,sx:.018,sy:.055,sz:.58,color:0xf2f2f2}));
  parts.push(box({x:.522,y:.205,sx:.018,sy:.055,sz:.58,color:0xd8d8d8}));
  return merge(parts,'urban-facade-light-kit');
}

export function createUrbanFacadeGeometrySet(){
  const archetypes=[mixedUse(),officeTower(),industrial(),entertainment()];
  const lights=lightKit();
  return {
    archetypes,
    lights,
    dispose(){
      for(const geometry of archetypes)geometry.dispose();
      lights.dispose();
    }
  };
}
