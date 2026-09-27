import assert from 'node:assert/strict';
import {analyzeGraphicsStability} from '../src/graphicsDiagnostics.js';
import {
  assertMeaningfulCanvas,
  completeUrbanStartFlow,
  launchReleaseBrowser,
  releaseTargetUrl,
  runtime,
  sampleMeaningfulCanvas
} from './release-browser-utils.mjs';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const SOAK_SECONDS=Math.max(12,Number(process.env.SOAK_SECONDS)||30);
const RESTART_CYCLES=Math.max(3,Number(process.env.SOAK_RESTART_CYCLES)||6);
const browser=await launchReleaseBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}});

await context.addInitScript(()=>{
  const state={connected:true,buttons:Array.from({length:16},()=>({pressed:false,value:0})),axes:[0,0]};
  const pad={
    index:0,id:'Release QA Virtual Gamepad',mapping:'standard',
    get connected(){return state.connected;},
    get buttons(){return state.buttons;},
    get axes(){return state.axes;}
  };
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>state.connected?[pad]:[]});
  Object.defineProperty(window,'__releasePad',{value:{
    connect(value){state.connected=!!value;},
    neutral(){state.axes=[0,0];for(const button of state.buttons){button.pressed=false;button.value=0;}},
    button(index,value){const pressed=!!value;state.buttons[index]={pressed,value:pressed?1:0};},
    axis(index,value){state.axes[index]=Number(value)||0;}
  }});
});

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));

function snapshotScript(){
  const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
  return {
    t:performance.now(),
    mode:d?.mode,
    sceneObjectCount:d?.sceneObjectCount,
    rendererGeometries:d?.rendererGeometries,
    rendererTextures:d?.rendererTextures,
    materialCount:d?.materialCount,
    instancedMeshCount:d?.instancedMeshCount,
    streamingSegmentCount:d?.streamingSegmentCount,
    urbanPropPopulation:d?.urbanPropPopulation,
    skylinePopulation:d?.skylinePopulation,
    urbanInstances:d?.urbanInstances,
    courseObjects:d?.courseObjects,
    pooledCourseObjects:d?.pooledCourseObjects,
    runtimeListenerCount:d?.runtimeListenerCount,
    persistentLoopCount:d?.audioDiagnostics?.persistentLoopCount??0,
    audioUnlocked:d?.audioDiagnostics?.unlocked??null,
    domNodes:document.getElementsByTagName('*').length,
    heap:performance.memory?.usedJSHeapSize??null,
    quality:d?.qualityProfile,
    weather:d?.weatherState?.mode,
    input:d?.inputState
  };
}

async function setSelect(id,value){
  await page.evaluate(({id,value})=>{
    const element=document.getElementById(id);
    if(!element)throw new Error('Missing select #'+id);
    element.value=value;
    element.dispatchEvent(new Event('change',{bubbles:true}));
  },{id,value});
}

const samples=[];
try{
  await page.goto(releaseTargetUrl(BASE_URL,{quality:'high',weather:'rain',seed:'release-soak'}),{
    waitUntil:'domcontentloaded',timeout:60000
  });
  await completeUrbanStartFlow(page);
  await page.waitForTimeout(1200);

  for(const weather of ['day','rain','storm','night']){
    await setSelect('atmosphere-mode',weather);
    await page.waitForTimeout(300);
  }
  for(const quality of ['low','medium','high','max','high']){
    await setSelect('atmosphere-quality',quality);
    await page.waitForTimeout(300);
  }

  const warm=await page.evaluate(snapshotScript);
  samples.push(warm);

  const soakStarted=Date.now();
  let direction=1;
  while(Date.now()-soakStarted<SOAK_SECONDS*1000){
    await page.keyboard.down(direction>0?'ArrowRight':'ArrowLeft');
    await page.waitForTimeout(260);
    await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');
    direction*=-1;
    await page.keyboard.press('Space');
    await page.waitForTimeout(740);
    const snap=await page.evaluate(snapshotScript);
    assert.equal(snap.mode,'playing','soak streaming left gameplay state');
    samples.push(snap);
  }

  for(let i=0;i<RESTART_CYCLES;i++){
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return d?.mode==='paused';
    },null,{timeout:5000});
    const restartInvoked=await page.evaluate(()=>{
      const button=document.querySelector('#restart-pause');
      if(!button||button.disabled)return false;
      button.click();
      return true;
    });
    assert.equal(restartInvoked,true,'soak restart control was unavailable');
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return d?.mode==='playing';
    },null,{timeout:30000});

    const nextQuality=['low','medium','high','max'][i%4];
    const nextWeather=['day','rain','storm','night'][i%4];
    await setSelect('atmosphere-quality',nextQuality);
    await setSelect('atmosphere-mode',nextWeather);

    await page.evaluate(()=>{
      window.__releasePad?.neutral();
      window.__releasePad?.connect(false);
    });
    await page.waitForTimeout(80);
    await page.evaluate(()=>window.__releasePad?.connect(true));
    await page.waitForTimeout(80);
    const reconnect=await runtime(page);
    assert.equal(reconnect?.mode,'playing','controller reconnect disturbed gameplay');
    assert.equal(Math.abs(reconnect?.inputState?.touchSteer||0),0,'controller reconnect contaminated touch input');

    samples.push(await page.evaluate(snapshotScript));
  }

  await setSelect('atmosphere-quality','high');
  await setSelect('atmosphere-mode','rain');
  await page.waitForTimeout(1000);
  const final=await page.evaluate(snapshotScript);
  samples.push(final);

  const graphics=samples.map(sample=>({
    rendererGeometries:sample.rendererGeometries,
    rendererTextures:sample.rendererTextures,
    sceneObjectCount:sample.sceneObjectCount,
    instancedMeshCount:sample.instancedMeshCount,
    materialCount:sample.materialCount,
    streamingSegmentCount:sample.streamingSegmentCount,
    urbanPropPopulation:sample.urbanPropPopulation,
    skylinePopulation:sample.skylinePopulation,
    urbanInstances:sample.urbanInstances
  }));
  const stability=analyzeGraphicsStability(graphics);
  assert(stability.ok,'soak detected monotonic graphics growth: '+JSON.stringify(stability.violations));

  assert.equal(final.runtimeListenerCount,warm.runtimeListenerCount,'scoped event listener count grew during soak');
  assert(final.persistentLoopCount<=warm.persistentLoopCount+2,'persistent WebAudio loop count grew during soak');
  assert(final.domNodes<=warm.domNodes+120,'DOM node count grew beyond soak budget');

  let heapGrowth=null;
  if(Number.isFinite(warm.heap)&&Number.isFinite(final.heap)){
    heapGrowth=final.heap-warm.heap;
    assert(heapGrowth<=80*1024*1024,'JS heap grew beyond 80 MiB soak budget');
  }

  const canvas=await sampleMeaningfulCanvas(page);
  assertMeaningfulCanvas(canvas,'soak final frame');
  assert.equal(pageErrors.length,0,'uncaught browser errors during soak: '+pageErrors.join('\n'));

  console.log(JSON.stringify({
    check:'release-soak-browser',
    soakSeconds:SOAK_SECONDS,
    restartCycles:RESTART_CYCLES,
    samples:samples.length,
    graphicsStability:stability,
    listenerGrowth:final.runtimeListenerCount-warm.runtimeListenerCount,
    audioLoopGrowth:final.persistentLoopCount-warm.persistentLoopCount,
    domGrowth:final.domNodes-warm.domNodes,
    heapGrowthBytes:heapGrowth,
    finalCanvas:canvas
  }));
}finally{
  await context.close();
  await browser.close();
}
