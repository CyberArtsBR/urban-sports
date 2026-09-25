import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createUrbanAtmosphere} from '../src/urban/urbanAtmosphere.js';
import {createUrbanMaterials} from '../src/urban/urbanMaterials.js';

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x8f9aa3,50,272);
scene.environmentIntensity=.5;
const renderer={toneMappingExposure:1};

const root=new THREE.Group();
root.name='UrbanEnvironment';
scene.add(root);

function add(name,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  mesh.name=name;
  root.add(mesh);
  return material;
}

const asphalt=add('urban-asphalt',new THREE.MeshPhysicalMaterial({color:0x41454b,roughness:.94,metalness:.02}));
const roadDamp=add('urban-road-damp-patches',new THREE.MeshPhysicalMaterial({color:0x252a2d,roughness:.72,clearcoat:.06,transparent:true,opacity:0}));
const roadPuddle=add('urban-road-puddles',new THREE.MeshPhysicalMaterial({color:0x1d2529,roughness:.24,clearcoat:.44,transparent:true,opacity:0}));
const sidewalk=add('urban-sidewalks',new THREE.MeshStandardMaterial({color:0xa8aaab,roughness:.92}));
add('urban-curbs',new THREE.MeshStandardMaterial({color:0xc8c8c3,roughness:.88}));
const building=add('urban-buildings',new THREE.MeshStandardMaterial({color:0x59616b,roughness:.84}));
const windows=add('urban-building-windows',new THREE.MeshStandardMaterial({color:0xc9def0,emissive:0x67b9ff,emissiveIntensity:.12,transparent:true,opacity:.64}));
const lamp=add('urban-streetlight-bulbs',new THREE.MeshStandardMaterial({color:0xffd59a,emissive:0xff9d36,emissiveIntensity:.42}));
const pool=add('urban-streetlight-pools',new THREE.MeshBasicMaterial({color:0xffd59a,transparent:true,opacity:0}));

const ambient=new THREE.HemisphereLight(0xffffff,0x666666,1);
const rim=new THREE.DirectionalLight(0xffffff,.2);
const fill=new THREE.DirectionalLight(0xffffff,.2);
scene.add(ambient,rim,fill);

const atmosphere=createUrbanAtmosphere({scene,renderer,ambient,rim,fill,quality:'high'});
const storm={
  night:.94,wet:1,rain:1,cloud:1,flash:0,
  fog:new THREE.Color(0x3b4a60),
  top:new THREE.Color(0x0c1428),
  ambient:new THREE.Color(0x839cc0),
  sun:new THREE.Color(0xb8c9e9)
};

atmosphere.update(1/60,{travel:0},storm);
const high=atmosphere.getDiagnostics();
const proxyLights=atmosphere.lighting.children.filter(child=>child.isPointLight);

assert.equal(high.profile,'high');
assert.equal(high.realLightCount,2,'urban atmosphere should use two grouped realtime light proxies only');
assert.equal(proxyLights.length,2,'unexpected urban realtime light count');
assert(proxyLights.every(light=>light.castShadow===false),'urban proxy lights must never cast shadows');
assert(proxyLights.every(light=>light.intensity>0),'high quality night should enable useful streetlight contribution');
assert(scene.fog.near>=68&&scene.fog.near<100,'storm fog should preserve a high-contrast near field');
assert(scene.fog.far>=370,'storm fog collapsed into a white-wall distance');
assert(scene.fog.far>scene.fog.near*3,'urban fog lacks near/mid/far separation');
assert(renderer.toneMappingExposure>=.98&&renderer.toneMappingExposure<=1.08,'urban exposure should stay restrained');
assert(asphalt.envMapIntensity>.20&&asphalt.envMapIntensity<.50,'wet asphalt environment response is outside matte-road range');
assert.equal(asphalt.metalness,0,'wet asphalt must never become metallic');
assert.equal(asphalt.clearcoat,0,'global asphalt must never gain clearcoat during rain');
assert(asphalt.roughness>=.90,'wet asphalt substrate became too glossy');
assert(roadDamp.opacity>0,'rain should expose localized damp patches');
assert(roadPuddle.opacity>0,'rain should expose localized puddles');
assert(roadPuddle.clearcoat>roadDamp.clearcoat,'puddles should carry the localized reflection response');
assert(windows.emissiveIntensity>1.5&&windows.emissiveIntensity<2.5,'night windows are outside selective bloom range');
assert(lamp.emissiveIntensity>1.7&&lamp.emissiveIntensity<2.8,'street lamps are outside selective bloom range');
assert(lamp.emissive.r>lamp.emissive.g&&lamp.emissive.g>lamp.emissive.b,'street lamp emissive lost warm color identity');
assert(pool.opacity>0&&pool.opacity<.06,'streetlight pool should be a subtle warm cue, not a bloom decal');
assert(building.color.getHex()!==0x59616b,'building depth tint did not respond to night');
assert(sidewalk.color.getHex()!==0xa8aaab,'sidewalk value did not respond to atmosphere');

const highPoolOpacity=pool.opacity;
atmosphere.setQuality('low');
atmosphere.update(1/60,{travel:0},storm);
const low=atmosphere.getDiagnostics();
assert.equal(low.activeRealLightScale,0,'LOW must disable realtime urban light proxies');
assert(proxyLights.every(light=>light.intensity===0),'LOW still pays for realtime urban street lights');
assert(pool.opacity<highPoolOpacity,'LOW should reduce fake streetlight pool intensity');

const shared=createUrbanMaterials();
assert(shared.asphalt.isMeshPhysicalMaterial,'urban asphalt must retain physical wet-surface controls');
assert(shared.asphalt.roughnessMap?.isTexture,'asphalt roughness breakup map is missing');
assert(shared.asphalt.bumpMap?.isTexture,'asphalt aggregate bump map is missing');
assert(shared.asphalt.bumpScale>0&&shared.asphalt.bumpScale<.05,'asphalt bump scale is outside restrained microdetail range');
assert(shared.streetlightPool?.transparent===true,'streetlight pool material is missing');
assert.equal(shared.streetlightPool.blending,THREE.NormalBlending,'streetlight pools must not use additive whiteout blending');
assert.equal(shared.lamp.toneMapped,true,'lamp must be tone mapped so bloom retains color');
assert.equal(shared.windows.toneMapped,true,'window emission must be tone mapped so bloom retains color');
assert.equal(shared.windows.isMeshBasicMaterial,true,'instanced windows should emit their per-instance warm/cool hue directly');
assert.equal(shared.buildingLed.isMeshBasicMaterial,true,'building LEDs should emit their per-instance saturated hue directly');
assert.equal(shared.asphalt.clearcoat,0,'shared dry asphalt baseline must stay free of universal clearcoat');
assert(shared.asphalt.roughness>=.94,'shared dry asphalt baseline is not matte enough');
assert(shared.getDiagnostics().asphaltTextureSize>=1024,'AAA asphalt source detail regressed below 1K procedural source density');
shared.dispose();

console.log(JSON.stringify({
  check:'urban-atmosphere-invariants',
  high,
  low,
  fog:{near:scene.fog.near,far:scene.fog.far},
  emissive:{lamp:lamp.emissiveIntensity,windows:windows.emissiveIntensity},
  wetAsphalt:{envMapIntensity:asphalt.envMapIntensity,metalness:asphalt.metalness}
}));
