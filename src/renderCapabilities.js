import * as THREE from 'three';

export const RENDER_CAPABILITY_SCHEMA=2;

export function estimateRenderTargetBytes(width,height,{bytesPerPixel=4,count=1,scale=1}={}){
  const w=Math.max(1,Math.floor(Number(width)||1));
  const h=Math.max(1,Math.floor(Number(height)||1));
  const s=Math.max(.01,Number(scale)||1);
  return Math.round(w*h*s*s*Math.max(1,Number(bytesPerPixel)||4)*Math.max(0,Number(count)||0));
}

function glErrorName(gl,value){
  const names=new Map([
    [gl.NO_ERROR,'NO_ERROR'],
    [gl.INVALID_ENUM,'INVALID_ENUM'],
    [gl.INVALID_VALUE,'INVALID_VALUE'],
    [gl.INVALID_OPERATION,'INVALID_OPERATION'],
    [gl.INVALID_FRAMEBUFFER_OPERATION,'INVALID_FRAMEBUFFER_OPERATION'],
    [gl.OUT_OF_MEMORY,'OUT_OF_MEMORY'],
    [gl.CONTEXT_LOST_WEBGL,'CONTEXT_LOST_WEBGL']
  ]);
  return names.get(value)||('0x'+Number(value||0).toString(16));
}

function drainErrors(gl,limit=16){
  const errors=[];
  if(!gl?.getError)return errors;
  for(let i=0;i<limit;i++){
    const code=gl.getError();
    if(code===gl.NO_ERROR)break;
    errors.push(glErrorName(gl,code));
  }
  return errors;
}

function precisionInfo(gl,shaderType,precisionType){
  try{
    const value=gl.getShaderPrecisionFormat(shaderType,precisionType);
    return value?{rangeMin:value.rangeMin,rangeMax:value.rangeMax,precision:value.precision}:null;
  }catch{return null;}
}

function testTarget(renderer,{type=THREE.UnsignedByteType,filter=THREE.NearestFilter,depthTexture=false}={}){
  const gl=renderer?.getContext?.();
  if(!gl)return {ok:false,status:'NO_CONTEXT',errors:[]};
  const previous=renderer.getRenderTarget?.()||null;
  const target=new THREE.WebGLRenderTarget(4,4,{
    type,
    format:THREE.RGBAFormat,
    minFilter:filter,
    magFilter:filter,
    depthBuffer:true,
    stencilBuffer:false
  });
  target.samples=0;
  target.texture.colorSpace=THREE.NoColorSpace;
  if(depthTexture){
    const depth=new THREE.DepthTexture(4,4,THREE.UnsignedIntType);
    depth.format=THREE.DepthFormat;
    depth.minFilter=THREE.NearestFilter;
    depth.magFilter=THREE.NearestFilter;
    target.depthTexture=depth;
  }
  try{
    drainErrors(gl);
    renderer.setRenderTarget(target);
    const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    const errors=drainErrors(gl);
    return {
      ok:status===gl.FRAMEBUFFER_COMPLETE&&errors.length===0&&!gl.isContextLost?.(),
      status:status===gl.FRAMEBUFFER_COMPLETE?'FRAMEBUFFER_COMPLETE':('0x'+Number(status||0).toString(16)),
      errors
    };
  }catch(error){
    return {ok:false,status:'EXCEPTION',errors:[String(error?.message||error)]};
  }finally{
    try{renderer.setRenderTarget(previous);}catch{}
    try{target.dispose();}catch{}
    try{renderer.state?.reset?.();}catch{}
  }
}

function extensionSet(gl){
  const names=[
    'EXT_color_buffer_float',
    'EXT_disjoint_timer_query_webgl2',
    'OES_texture_float_linear',
    'WEBGL_lose_context'
  ];
  const result={};
  for(const name of names){
    try{result[name]=!!gl.getExtension(name);}catch{result[name]=false;}
  }
  return result;
}

export const GPU_CAPABILITY_CLASSES=Object.freeze({
  intel:Object.freeze({label:'Intel integrated',webgl2:true,halfFloatRenderable:true,halfFloatLinear:true,floatRenderable:true,depthTextureRenderable:true,maxTextureSize:8192,maxRenderbufferSize:8192,maxSamples:4,fragmentHighp:true,gpuTimerSupported:true}),
  amd:Object.freeze({label:'AMD desktop',webgl2:true,halfFloatRenderable:true,halfFloatLinear:true,floatRenderable:true,depthTextureRenderable:true,maxTextureSize:16384,maxRenderbufferSize:16384,maxSamples:8,fragmentHighp:true,gpuTimerSupported:true}),
  nvidia:Object.freeze({label:'NVIDIA desktop',webgl2:true,halfFloatRenderable:true,halfFloatLinear:true,floatRenderable:true,depthTextureRenderable:true,maxTextureSize:16384,maxRenderbufferSize:16384,maxSamples:8,fragmentHighp:true,gpuTimerSupported:true}),
  apple:Object.freeze({label:'Apple Silicon',webgl2:true,halfFloatRenderable:true,halfFloatLinear:true,floatRenderable:true,depthTextureRenderable:true,maxTextureSize:16384,maxRenderbufferSize:16384,maxSamples:4,fragmentHighp:true,gpuTimerSupported:false}),
  adreno:Object.freeze({label:'Adreno mobile envelope',webgl2:true,halfFloatRenderable:true,halfFloatLinear:true,floatRenderable:false,depthTextureRenderable:true,maxTextureSize:8192,maxRenderbufferSize:8192,maxSamples:4,fragmentHighp:true,gpuTimerSupported:false}),
  mali:Object.freeze({label:'Mali mobile envelope',webgl2:true,halfFloatRenderable:true,halfFloatLinear:false,floatRenderable:false,depthTextureRenderable:true,maxTextureSize:8192,maxRenderbufferSize:8192,maxSamples:4,fragmentHighp:true,gpuTimerSupported:false})
});

export function getRenderFailureSimulation(locationLike=globalThis.location){
  try{
    const params=new URLSearchParams(locationLike?.search||'');
    if(params.get('test')!=='1')return {failures:new Set(),gpuClass:null};
    const failures=new Set(String(params.get('renderFail')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));
    const requestedClass=String(params.get('gpuClass')||'').trim().toLowerCase();
    const gpuClass=Object.hasOwn(GPU_CAPABILITY_CLASSES,requestedClass)?requestedClass:null;
    return {failures,gpuClass};
  }catch{
    return {failures:new Set(),gpuClass:null};
  }
}

export function applyGpuClassSimulation(capabilities,gpuClass){
  const profile=GPU_CAPABILITY_CLASSES[gpuClass];
  if(!profile)return capabilities;
  return {
    ...capabilities,
    simulatedGpuClass:gpuClass,
    simulationLabel:profile.label,
    simulationDisclaimer:'Capability envelope only; it cannot emulate driver shader compilers, tile memory behavior, thermals, browser GPU-process bugs, or vendor-specific framebuffer defects.',
    ...profile
  };
}

export function applyFailureSimulation(capabilities,failures=new Set()){
  const next={...capabilities};
  if(failures.has('half-float')){
    next.halfFloatRenderable=false;
    next.halfFloatLinear=false;
  }
  if(failures.has('depth-texture'))next.depthTextureRenderable=false;
  if(failures.has('gpu-timer'))next.gpuTimerSupported=false;
  if(failures.has('render-target')){
    next.halfFloatRenderable=false;
    next.halfFloatLinear=false;
    next.unsignedByteRenderable=false;
  }
  return next;
}

export function probeRenderingCapabilities(renderer,{simulation=getRenderFailureSimulation()}={}){
  const gl=renderer?.getContext?.()||null;
  if(!gl){
    return applyFailureSimulation(applyGpuClassSimulation({
      webgl2:false,
      contextLost:true,
      unsignedByteRenderable:false,
      halfFloatRenderable:false,
      halfFloatLinear:false,
      floatRenderable:false,
      depthTextureRenderable:false,
      maxTextureSize:0,
      maxRenderbufferSize:0,
      maxSamples:0,
      maxAnisotropy:1,
      fragmentHighp:false,
      gpuTimerSupported:false,
      precision:{},
      extensions:{},
      probes:{},
      simulatedGpuClass:null,
      simulationLabel:null,
      simulationDisclaimer:null
    },simulation.gpuClass),simulation.failures);
  }

  const extensions=extensionSet(gl);
  const probes={
    unsignedByte:testTarget(renderer,{type:THREE.UnsignedByteType,filter:THREE.LinearFilter}),
    halfFloatNearest:testTarget(renderer,{type:THREE.HalfFloatType,filter:THREE.NearestFilter}),
    halfFloatLinear:testTarget(renderer,{type:THREE.HalfFloatType,filter:THREE.LinearFilter}),
    floatNearest:testTarget(renderer,{type:THREE.FloatType,filter:THREE.NearestFilter}),
    depthTexture:testTarget(renderer,{type:THREE.UnsignedByteType,filter:THREE.NearestFilter,depthTexture:true})
  };
  const precision={
    vertexHigh:precisionInfo(gl,gl.VERTEX_SHADER,gl.HIGH_FLOAT),
    fragmentHigh:precisionInfo(gl,gl.FRAGMENT_SHADER,gl.HIGH_FLOAT),
    fragmentMedium:precisionInfo(gl,gl.FRAGMENT_SHADER,gl.MEDIUM_FLOAT)
  };
  const base={
    webgl2:!!renderer.capabilities?.isWebGL2,
    contextLost:!!gl.isContextLost?.(),
    unsignedByteRenderable:!!probes.unsignedByte.ok,
    halfFloatRenderable:!!probes.halfFloatNearest.ok,
    halfFloatLinear:!!probes.halfFloatLinear.ok,
    floatRenderable:!!probes.floatNearest.ok,
    depthTextureRenderable:!!probes.depthTexture.ok,
    maxTextureSize:Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||0,
    maxRenderbufferSize:Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||0,
    maxSamples:Number(gl.getParameter(gl.MAX_SAMPLES))||0,
    maxAnisotropy:(()=>{try{return renderer.capabilities?.getMaxAnisotropy?.()||1;}catch{return 1;}})(),
    fragmentHighp:(precision.fragmentHigh?.precision||0)>0,
    gpuTimerSupported:!!extensions.EXT_disjoint_timer_query_webgl2,
    precision,
    extensions,
    probes,
    simulatedGpuClass:null,
    simulationLabel:null,
    simulationDisclaimer:null
  };
  return applyFailureSimulation(applyGpuClassSimulation(base,simulation.gpuClass),simulation.failures);
}

export function chooseCinematicTarget(capabilities,{preferHalfFloat=true,forceByte=false}={}){
  if(!capabilities?.unsignedByteRenderable&&!capabilities?.halfFloatRenderable){
    return {supported:false,type:null,label:'none',linear:false,reason:'no-renderable-offscreen-target'};
  }
  if(preferHalfFloat&&!forceByte&&capabilities?.halfFloatRenderable){
    return {
      supported:true,
      type:THREE.HalfFloatType,
      label:'half-float',
      linear:!!capabilities.halfFloatLinear,
      reason:capabilities.halfFloatLinear?'half-float-linear':'half-float-nearest'
    };
  }
  if(capabilities?.unsignedByteRenderable){
    return {supported:true,type:THREE.UnsignedByteType,label:'unsigned-byte-fallback',linear:true,reason:'compatible-byte-target'};
  }
  return {supported:false,type:null,label:'none',linear:false,reason:'no-compatible-target'};
}
