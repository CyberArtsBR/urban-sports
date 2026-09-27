import assert from 'node:assert/strict';
import {
  GRAPHICS_FAULT_INJECTION_CASES,
  createFailOpenRenderer,
  createOneShotGraphicsFaultInjector
} from '../src/renderFailOpen.js';

function canvasHarness(){
  const listeners=new Map();
  return {
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
    emit(type,event={}){listeners.get(type)?.(event);},
    has(type){return listeners.has(type);}
  };
}

function rendererHarness(canvas=canvasHarness()){
  const calls=[];
  return {
    domElement:canvas,
    calls,
    render(scene,camera){calls.push({scene,camera});}
  };
}

{
  const canvas=canvasHarness();
  const renderer=rendererHarness(canvas);
  const controller=createFailOpenRenderer({renderer,scene:{id:'scene'},camera:{id:'camera'}});
  const result=controller.render();
  assert.equal(result.path,'direct');
  assert.equal(renderer.calls.length,1,'direct rendering must present a frame');
  assert.equal(controller.getDiagnostics().faultCount,0);
  controller.dispose();
  assert.equal(canvas.has('webglcontextlost'),false,'dispose must remove context-loss listener');
  assert.equal(canvas.has('webglcontextrestored'),false,'dispose must remove context-restore listener');
}

{
  const canvas=canvasHarness();
  const renderer=rendererHarness(canvas);
  let optionalCalls=0;
  const controller=createFailOpenRenderer({
    renderer,
    scene:{},
    camera:{},
    getComposer:()=>({render(){optionalCalls++;}}),
    isOptionalEnabled:()=>true
  });
  assert.equal(controller.render().path,'optional');
  assert.equal(optionalCalls,1);
  assert.equal(renderer.calls.length,0,'healthy optional path should not double-render');
  controller.dispose();
}

for(const fault of GRAPHICS_FAULT_INJECTION_CASES){
  const canvas=canvasHarness();
  const renderer=rendererHarness(canvas);
  const injector=createOneShotGraphicsFaultInjector(fault);
  let optionalCalls=0;
  const controller=createFailOpenRenderer({
    renderer,
    scene:{},
    camera:{},
    getComposer:()=>({render(){optionalCalls++;}}),
    isOptionalEnabled:()=>true,
    faultInjector:()=>injector.inject()
  });

  const first=controller.render();
  assert.equal(first.path,'direct-fallback',fault+' must fail open to direct rendering in the same frame');
  assert.equal(renderer.calls.length,1,fault+' fallback did not present gameplay');
  assert.equal(optionalCalls,0,fault+' injection must happen before the unsafe optional render');
  const afterFault=controller.getDiagnostics();
  assert.equal(afterFault.optionalDisabled,true,fault+' must quarantine the optional path after failure');
  assert.equal(afterFault.faultCount,1,fault+' must record exactly one fault');

  const second=controller.render();
  assert.equal(second.path,'direct-disabled',fault+' must stay on direct rendering after quarantine');
  assert.equal(renderer.calls.length,2);
  assert.equal(controller.getDiagnostics().faultCount,1,'quarantined path must not refault every frame');
  controller.dispose();
}

{
  const canvas=canvasHarness();
  const renderer=rendererHarness(canvas);
  let prevented=false;
  const controller=createFailOpenRenderer({renderer,scene:{},camera:{}});
  canvas.emit('webglcontextlost',{preventDefault(){prevented=true;}});
  assert.equal(prevented,true,'WEBGL context loss must be prevented so restoration remains possible');
  assert.equal(controller.render().rendered,false,'rendering must pause while context is lost');
  assert.equal(renderer.calls.length,0);
  assert.equal(controller.getDiagnostics().contextLossCount,1);

  canvas.emit('webglcontextrestored');
  assert.equal(controller.getDiagnostics().contextLost,false);
  assert.equal(controller.getDiagnostics().contextRestoreCount,1);
  assert.equal(controller.render().path,'direct','direct rendering must resume after context restoration');
  assert.equal(renderer.calls.length,1);
  controller.dispose();
}

console.log(JSON.stringify({
  check:'render-fail-open-invariants',
  behavioral:true,
  faults:GRAPHICS_FAULT_INJECTION_CASES,
  contextLossRestore:true
}));
