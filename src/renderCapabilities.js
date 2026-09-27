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
