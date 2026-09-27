import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  LOCAL_GLB_PREFLIGHT_LIMITS,
  inspectLocalGlbJson
} from '../src/localAvatarUpload.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const urbanRuntime=await readFile(new URL('../src/urban/urbanRuntimeEnvironment.js',import.meta.url),'utf8');
const weather=await readFile(new URL('../src/mountainWeather.js',import.meta.url),'utf8');
const upload=await readFile(new URL('../src/localAvatarUpload.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/floatingUI.css',import.meta.url),'utf8');

assert(!main.includes("from './environment.js'"),'Urban main must not statically import the Alpine environment runtime');
assert(main.includes("createUrbanRuntimeEnvironment"),'Urban main must boot the Urban-native runtime');
for(const path of ['./alpineSky.js','./alpineLandscape.js','../snowMaterial.js','../snowParticles.js','../snowSurfaceDetail.js','../boundaryMarkers.js','../ambientFlybys.js']){
  assert(!urbanRuntime.includes("from '"+path+"'")&&!urbanRuntime.includes('from "'+path+'"'),'Urban runtime must not import Alpine system '+path);
}
assert(urbanRuntime.includes("activeSnowLayerParticles:0"),'Urban diagnostics must expose zero Alpine particles');
assert(weather.includes('snowParticles?.setTint?.'),'weather bridge must tolerate absent Alpine particles');
assert(weather.includes('surfaceDetail?.moundMaterial?.color'),'weather bridge must tolerate absent Alpine snow surface detail');
assert(upload.includes('External resource URIs are not allowed'),'local GLB preflight must reject external resource fetches');
assert(upload.includes('GLB JSON chunk must be the first chunk'),'local GLB preflight must inspect the JSON chunk before GLTFLoader decode');
assert(css.includes("chimpions-urban-sports-start.webp"),'tutorial must reuse the compressed Urban start artwork');
assert(!css.includes("chimpions-ski-start.jpg"),'legacy Ski start artwork must not remain referenced');

const safe=inspectLocalGlbJson({
  asset:{version:'2.0'},
  buffers:[{byteLength:1024}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:256}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],
  meshes:[{primitives:[{attributes:{POSITION:0}}]}],
  nodes:[{mesh:0}]
});
assert.equal(safe.vertices,3);
assert.equal(safe.meshes,1);
assert.equal(safe.externalUris.length,0);

const external=inspectLocalGlbJson({asset:{version:'2.0'},buffers:[{byteLength:4,uri:'https://example.com/evil.bin'}]});
assert.equal(external.externalUris.length,1);
assert(LOCAL_GLB_PREFLIGHT_LIMITS.hierarchyDepth<=64,'hierarchy preflight must stay bounded');

console.log(JSON.stringify({check:'runtime-assets-invariants',urbanAlpineAllocations:0,localGlbExternalUris:'blocked'}));
