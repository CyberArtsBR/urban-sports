import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  GPU_CAPABILITY_CLASSES,
  applyFailureSimulation,
  applyGpuClassSimulation,
  chooseCinematicTarget,
  estimateRenderTargetBytes
} from '../src/renderCapabilities.js';

const baseline={
  webgl2:true,
  unsignedByteRenderable:true,
  halfFloatRenderable:true,
  halfFloatLinear:true,
  floatRenderable:true,
  depthTextureRenderable:true,
  maxTextureSize:16384,
  maxRenderbufferSize:16384,
  maxSamples:8,
  fragmentHighp:true,
  gpuTimerSupported:true
};

for(const name of ['intel','amd','nvidia','apple','adreno','mali']){
  const simulated=applyGpuClassSimulation(baseline,name);
  assert.equal(simulated.simulatedGpuClass,name);
  assert.equal(simulated.webgl2,true,name+' must keep a WebGL2 capability envelope');
  assert(simulated.maxTextureSize>=4096,name+' texture limit envelope is implausibly small');
  assert(simulated.maxRenderbufferSize>=4096,name+' renderbuffer limit envelope is implausibly small');
  const choice=chooseCinematicTarget(simulated);
  assert.equal(choice.supported,true,name+' envelope must retain at least one compatible offscreen target');
}
assert.equal(GPU_CAPABILITY_CLASSES.mali.halfFloatLinear,false,'Mali envelope must exercise non-linear HalfFloat fallback');
assert.equal(chooseCinematicTarget(applyGpuClassSimulation(baseline,'mali')).linear,false);

const halfFloatFailure=applyFailureSimulation(baseline,new Set(['half-float']));
assert.equal(halfFloatFailure.halfFloatRenderable,false);
assert.equal(chooseCinematicTarget(halfFloatFailure).label,'unsigned-byte-fallback','HalfFloat failure must fall back to byte target');

const targetFailure=applyFailureSimulation(baseline,new Set(['render-target']));
assert.equal(chooseCinematicTarget(targetFailure).supported,false,'forced target failure must disable composition entirely');

const depthFailure=applyFailureSimulation(baseline,new Set(['depth-texture']));
assert.equal(depthFailure.depthTextureRenderable,false,'depth failure must be independently representable');
assert.equal(chooseCinematicTarget(depthFailure).supported,true,'depth failure must not disable safe color composition');

assert.equal(estimateRenderTargetBytes(100,50,{bytesPerPixel:8,count:2}),80000);

const cinematic=readFileSync(new URL('../src/cinematicRendering.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const quality=readFileSync(new URL('../src/renderQuality.js',import.meta.url),'utf8');

for(const needle of [
  'probeRenderingCapabilities',
  'chooseCinematicTarget',
  'FRAMEBUFFER',
  'webglcontextlost',
  'webglcontextrestored',
  'backbufferHealth',
  'blackFallbackCount',
  'runtimeDegradations',
  'renderTargetMemoryBytes',
  'passCpuMs'
]){
  assert(cinematic.includes(needle),'cinematic reliability path missing '+needle);
}
assert(cinematic.includes("capabilities.depthTextureRenderable&&capabilities.halfFloatRenderable&&capabilities.halfFloatLinear"),'GTAO must require verified depth + linear HalfFloat support');
assert(cinematic.includes("capabilities.halfFloatRenderable&&capabilities.halfFloatLinear&&!forced('bloom')"),'Bloom must require verified linear HalfFloat support');
assert(cinematic.includes("return degradeRuntime('critical WebGL error"),'critical framebuffer errors must degrade instead of blanking gameplay');
assert(main.includes("if(!composed)renderer.render(scene,camera)"),'direct WebGLRenderer must remain the same-frame universal fallback');
assert(main.includes("renderer.outputColorSpace=THREE.SRGBColorSpace"),'output color space must be explicit');
assert(main.includes("renderPath:quality.active==='max-cinematic'&&cinematicDiagnostics?.enabled?'cinematic-composer':'direct'"),'diagnostics must expose the actual render path');
assert(quality.includes("const PROFILE_ORDER=Object.freeze(['high','medium','low'])"),'AUTO must never promote into MAX CINEMATIC');

console.log(JSON.stringify({
  check:'rendering-reliability-invariants',
  gpuClasses:Object.keys(GPU_CAPABILITY_CLASSES),
  fallback:{
    halfFloat:chooseCinematicTarget(halfFloatFailure).label,
    renderTarget:chooseCinematicTarget(targetFailure).reason,
    depthTextureCompositionStillSupported:chooseCinematicTarget(depthFailure).supported
  }
}));
