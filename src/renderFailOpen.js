export const GRAPHICS_FAULT_INJECTION_CASES=Object.freeze([
  'half-float',
  'framebuffer',
  'ao',
  'bloom',
  'lut',
  'volumetric',
  'gpu-timer',
  'shadow-allocation'
]);

function normalizeFault(value){
  const fault=String(value||'').trim().toLowerCase();
  return GRAPHICS_FAULT_INJECTION_CASES.includes(fault)?fault:'';
}

export function createFailOpenRenderer({
  renderer,
  scene,
  camera,
  getComposer=()=>null,
  isOptionalEnabled=()=>false,
  faultInjector=()=>null,
  canvas=renderer?.domElement,
  onFault=()=>{}
}={}){
  if(typeof renderer?.render!=='function')throw new TypeError('createFailOpenRenderer requires renderer.render()');

  let optionalDisabled=false;
  let contextLost=false;
  let disposed=false;
  let directFrames=0;
  let composedFrames=0;
  let fallbackFrames=0;
  let faultCount=0;
  let contextLossCount=0;
  let contextRestoreCount=0;
  let lastFault='';
  let lastPath='unrendered';

  const renderDirect=path=>{
    renderer.render(scene,camera);
    directFrames++;
    lastPath=path;
    return {rendered:true,path};
  };

  const render=()=>{
    if(disposed)return {rendered:false,path:'disposed'};
    if(contextLost){
      lastPath='context-lost';
      return {rendered:false,path:lastPath};
    }

    if(!optionalDisabled&&isOptionalEnabled()){
      try{
        const injected=faultInjector?.();
        if(injected){
          const error=injected instanceof Error?injected:new Error(String(injected));
          if(!error.code)error.code='GRAPHICS_FAULT_INJECTED';
          throw error;
        }
        const composer=getComposer?.();
        if(typeof composer?.render!=='function')throw new Error('Optional graphics path is unavailable');
        composer.render();
        composedFrames++;
        lastPath='optional';
        return {rendered:true,path:lastPath};
      }catch(error){
        optionalDisabled=true;
        faultCount++;
        fallbackFrames++;
        lastFault=String(error?.code||error?.message||error||'optional-render-failure');
        try{onFault(error);}catch{}
        return renderDirect('direct-fallback');
      }
    }

    return renderDirect(optionalDisabled?'direct-disabled':'direct');
  };

  const onContextLost=event=>{
    event?.preventDefault?.();
    contextLost=true;
    contextLossCount++;
    lastPath='context-lost';
  };
  const onContextRestored=()=>{
    contextLost=false;
    optionalDisabled=false;
    contextRestoreCount++;
    lastPath='context-restored';
  };

  canvas?.addEventListener?.('webglcontextlost',onContextLost,false);
  canvas?.addEventListener?.('webglcontextrestored',onContextRestored,false);

  return {
    render,
    getDiagnostics:()=>({
      optionalDisabled,
      contextLost,
      directFrames,
      composedFrames,
      fallbackFrames,
      faultCount,
      contextLossCount,
      contextRestoreCount,
      lastFault,
      lastPath
    }),
    resetOptionalPath:()=>{
      optionalDisabled=false;
      lastFault='';
    },
    disableOptionalPath:reason=>{
      optionalDisabled=true;
      lastFault=String(reason||'manually-disabled');
    },
    dispose:()=>{
      if(disposed)return;
      disposed=true;
      canvas?.removeEventListener?.('webglcontextlost',onContextLost,false);
      canvas?.removeEventListener?.('webglcontextrestored',onContextRestored,false);
    }
  };
}

export function createOneShotGraphicsFaultInjector(value){
  const fault=normalizeFault(value);
  let consumed=false;
  return {
    fault,
    inject(){
      if(!fault||consumed)return null;
      consumed=true;
      const error=new Error('Injected optional graphics failure: '+fault);
      error.code='GRAPHICS_FAULT_'+fault.toUpperCase().replace(/-/g,'_');
      return error;
    },
    get consumed(){return consumed;}
  };
}
