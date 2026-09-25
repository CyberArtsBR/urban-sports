import * as THREE from 'three';
import {createSkateParticlePool,SKATE_PARTICLE_KIND} from './skateParticles.js';

export function createSkateVfx({
  scene,
  capacity=256,
  quality='high',
  reducedMotion=false
}={}){
  const pool=createSkateParticlePool({capacity,quality});
  const {positions,alpha,size,kinds,power}=pool.arrays;
  const geometry=new THREE.BufferGeometry();

  const positionAttribute=new THREE.BufferAttribute(positions,3);
  const alphaAttribute=new THREE.BufferAttribute(alpha,1);
  const sizeAttribute=new THREE.BufferAttribute(size,1);
  const kindAttribute=new THREE.BufferAttribute(kinds,1);
  const powerAttribute=new THREE.BufferAttribute(power,1);

  for(const attribute of [
    positionAttribute,
    alphaAttribute,
    sizeAttribute,
    kindAttribute,
    powerAttribute
  ])attribute.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position',positionAttribute);
  geometry.setAttribute('aAlpha',alphaAttribute);
  geometry.setAttribute('aSize',sizeAttribute);
  geometry.setAttribute('aKind',kindAttribute);
  geometry.setAttribute('aPower',powerAttribute);

  const material=new THREE.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    vertexShader:`
attribute float aAlpha;
attribute float aSize;
attribute float aKind;
attribute float aPower;
varying float vAlpha;
varying float vKind;
varying float vPower;
void main(){
  vAlpha=aAlpha;
  vKind=aKind;
  vPower=aPower;
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=aSize*clamp(22.0/max(1.0,-mv.z),.55,2.4);
}
`,
    fragmentShader:`
varying float vAlpha;
varying float vKind;
varying float vPower;
void main(){
  vec2 p=gl_PointCoord-.5;
  float d=length(p);
  if(d>.5||vAlpha<=.002)discard;
  float soft=1.0-smoothstep(.18,.5,d);
  vec3 dust=vec3(.20,.18,.15);
  vec3 wet=vec3(.45,.62,.72);
  vec3 slide=vec3(.34,.31,.27);
  vec3 spark=vec3(2.8,1.15,.22);
  vec3 energy=vec3(.24,1.05,3.3);
  vec3 c=dust;
  if(vKind>1.5)c=wet;
  if(vKind>2.5)c=slide;
  if(vKind>3.5)c=spark;
  if(vKind>4.5)c=energy;
  c=mix(c,energy,vPower*.55);
  gl_FragColor=vec4(c,vAlpha*soft);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
  });

  const points=new THREE.Points(geometry,material);
  points.frustumCulled=false;
  points.renderOrder=13;
  points.name='skate-contact-vfx';
  scene?.add(points);

  let emissionClock=0;

  function dirty(){
    positionAttribute.needsUpdate=true;
    alphaAttribute.needsUpdate=true;
    sizeAttribute.needsUpdate=true;
    kindAttribute.needsUpdate=true;
    powerAttribute.needsUpdate=true;
  }

  function emitWheelContact({
    x=0,y=0,z=0,
    wetness=0,
    edge=0,
    speed=0,
    powered=false
  }={}){
    const slide=Math.abs(Number(edge)||0);
    const kind=wetness>.25
      ?SKATE_PARTICLE_KIND.WET
      :slide>.58?SKATE_PARTICLE_KIND.SLIDE:SKATE_PARTICLE_KIND.DUST;
    const amount=kind===SKATE_PARTICLE_KIND.DUST?3:kind===SKATE_PARTICLE_KIND.WET?5:8;
    const count=pool.spawnBurst({
      kind,x,y,z,
      intensity:Math.max(slide,wetness,.2),
      speed,
      powered,
      amount
    });
    dirty();
    return count;
  }

  function emitLanding({
    x=0,y=0,z=0,
    force=.5,
    speed=0,
    powered=false
  }={}){
    const count=pool.spawnBurst({
      kind:SKATE_PARTICLE_KIND.DUST,
      x,y,z,
      intensity:force,
      speed,
      powered,
      amount:10
    });
    dirty();
    return count;
  }

  function emitGrind({
    x=0,y=0,z=0,
    intensity=.5,
    speed=0,
    surface='metal',
    powered=false
  }={}){
    const metal=/metal|rail/i.test(surface);
    const count=pool.spawnBurst({
      kind:metal?SKATE_PARTICLE_KIND.SPARK:SKATE_PARTICLE_KIND.DUST,
      x,y,z,
      intensity,
      speed,
      powered,
      amount:metal?20:8
    });
    dirty();
    return count;
  }

  function emitBananaPower({
    x=0,y=0,z=0,
    intensity=1,
    speed=0
  }={}){
    const count=pool.spawnBurst({
      kind:SKATE_PARTICLE_KIND.POWER,
      x,y,z,
      intensity:reducedMotion?intensity*.28:intensity,
      speed,
      powered:true,
      amount:reducedMotion?8:22
    });
    dirty();
    return count;
  }

  function update(dt,worldSpeed=0,contact=null){
    emissionClock+=Math.max(0,Number(dt)||0);
    if(contact&&emissionClock>=.055){
      emissionClock=0;
      emitWheelContact(contact);
    }
    pool.step(dt,worldSpeed);
    dirty();
  }

  function reset(){
    pool.reset();
    dirty();
  }

  function setQuality(next){
    return pool.setQuality(next);
  }

  function setReducedMotion(value){
    reducedMotion=!!value;
  }

  function dispose(){
    scene?.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return {
    emitWheelContact,
    emitLanding,
    emitGrind,
    emitBananaPower,
    update,
    reset,
    setQuality,
    setReducedMotion,
    dispose,
    diagnostics:pool.diagnostics,
    points
  };
}
