import assert from 'node:assert/strict';
import process from 'node:process';
import {chromium} from '@playwright/test';
import {analyzeGraphicsStability,evaluateGraphicsBudget,normalizeGraphicsBudgetProfile} from '../src/graphicsDiagnostics.js';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const QUALITY_PROFILE=normalizeGraphicsBudgetProfile(process.env.QUALITY_PROFILE||'high');
const SAMPLE_SECONDS=Math.max(6,Math.min(120,Number(process.env.GRAPHICS_SAMPLE_SECONDS)||18));
const SAMPLE_INTERVAL_MS=Math.max(250,Math.min(5000,Number(process.env.GRAPHICS_SAMPLE_INTERVAL_MS)||1000));

function targetUrl(){
  const url=new URL(BASE_URL);
  url.searchParams.set('test','1');
  url.searchParams.set('quality',QUALITY_PROFILE);
  return url.toString();
}

async function diagnostics(page){
  return page.evaluate(()=>{
    try{return window.chimpionsUrbanSports?.()??window.chimpionsSki?.()??null;}catch{return null;}
  });
}

async function completeStartFlow(page){
  const play=page.locator('.start-screen-play');
  await play.waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('.start-screen-play')?.disabled,null,{timeout:30000});
  await play.click();

  const selector=page.locator('#chimpion-selector');
  await selector.waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    return !!dialog?.querySelector('.chimpion-card:not([aria-disabled="true"])');
  },null,{timeout:30000});

  const avatarResult=await page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    const card=
      dialog?.querySelector('.chimpion-card.is-selected:not([aria-disabled="true"])')||
      dialog?.querySelector('.chimpion-card:not([aria-disabled="true"])');
    if(!card)return {ok:false,reason:'No enabled Chimpion card'};
    const id=card.dataset.avatarId||card.textContent?.trim()||'unknown';
    card.click();
    return {ok:true,id};
  });
  assert(avatarResult.ok,avatarResult.reason||'Failed to choose Chimpion');

  await page.waitForFunction(()=>{
    const step=document.querySelector('#ride-mode-step');
    return !!step&&!step.hidden;
  },null,{timeout:15000});

  const rideResult=await page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    const button=
      dialog?.querySelector('[data-sport-mode="skateboard"]')||
      dialog?.querySelector('.ride-mode-card[data-ride-mode="skateboard"]')||
      dialog?.querySelector('.ride-mode-card[data-ride-mode="snowboard"]')||
      Array.from(dialog?.querySelectorAll('.ride-mode-card')||[]).find(node=>/skateboard/i.test(node.textContent||''));
    if(!button)return {ok:false,reason:'No Skateboard-compatible ride control'};
    const mode=button.dataset.sportMode||button.dataset.rideMode||button.textContent?.trim()||'unknown';
    button.click();
    return {ok:true,mode};
  });
  assert(rideResult.ok,rideResult.reason||'Failed to choose Skateboard');

  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing'||document.querySelector('.session-tutorial:not([hidden])');
  },null,{timeout:60000});

  const tutorial=page.locator('.session-tutorial:not([hidden])');
  if(await tutorial.isVisible().catch(()=>false)){
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:20000});

  const state=await diagnostics(page);
  assert.equal(state?.sportMode,'skateboard','Urban runtime must remain in Skateboard sport mode');
  return {avatar:avatarResult.id,rideControl:rideResult.mode};
}

const browser=await chromium.launch({
  headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();

const jsErrors=[];
page.on('pageerror',error=>jsErrors.push('pageerror: '+String(error?.stack||error?.message||error)));
page.on('console',message=>{
  if(message.type()==='error')jsErrors.push('console.error: '+message.text());
});

try{
  await page.goto(targetUrl(),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>typeof window.chimpionsUrbanSports==='function'||typeof window.chimpionsSki==='function',null,{timeout:45000});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.ready===true;
  },null,{timeout:45000});

  const initial=await diagnostics(page);
  assert.equal(initial?.mode,'menu','runtime must start in menu mode');
  assert.equal(initial?.sportMode,'skateboard','default Urban Sports mode must be Skateboard');

  const selection=await completeStartFlow(page);

  await page.waitForTimeout(3000);
  const samples=[];
  const deadline=Date.now()+SAMPLE_SECONDS*1000;
  while(Date.now()<deadline){
    const sample=await diagnostics(page);
    assert(sample,'runtime diagnostics unavailable during graphics audit');
    const budget=evaluateGraphicsBudget(sample,QUALITY_PROFILE);
    assert(budget.ok,`${QUALITY_PROFILE} graphics budget exceeded: ${JSON.stringify(budget.violations)}`);
    samples.push({...sample,t:Date.now()});
    await page.waitForTimeout(Math.min(SAMPLE_INTERVAL_MS,Math.max(0,deadline-Date.now())));
  }

  const stability=analyzeGraphicsStability(samples);
  assert(stability.ok,`runtime resource counts show suspicious monotonic growth: ${JSON.stringify(stability.violations)}`);

  const restartSamples=[];
  for(let cycle=1;cycle<=3;cycle++){
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return d?.mode==='paused';
    },null,{timeout:5000});
    const restarted=await page.evaluate(()=>{
      const button=document.querySelector('#restart-pause');
      if(!button||button.disabled)return false;
      button.click();
      return true;
    });
    assert(restarted,`pause restart control unavailable on cycle ${cycle}`);
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return d?.mode==='playing';
    },null,{timeout:45000});

    await page.waitForTimeout(1500);
    const afterRestart=await diagnostics(page);
    const afterRestartBudget=evaluateGraphicsBudget(afterRestart,QUALITY_PROFILE);
    assert(afterRestartBudget.ok,`restart ${cycle} exceeded ${QUALITY_PROFILE} graphics budget: ${JSON.stringify(afterRestartBudget.violations)}`);
    restartSamples.push({...afterRestart,t:Date.now(),restartCycle:cycle});
  }

  const restartStability=analyzeGraphicsStability(
    [samples.at(-1),...restartSamples].filter(Boolean),
    // renderer.info.memory.geometries can legitimately rise while pre-existing
    // count=0 InstancedMesh batches are first rendered on later procedural
    // runs. Every restart still enforces the hard profile geometry ceiling;
    // retained scene geometry/material/object growth remains a leak signal.
    {ignoredMetrics:['rendererGeometries']}
  );
  assert(restartStability.ok,`repeated restarts show suspicious retained-resource growth: ${JSON.stringify(restartStability.violations)}`);
  const afterRestart=restartSamples.at(-1);

  assert.deepEqual(jsErrors,[],'Browser emitted JavaScript errors during Start → Chimpion → Skateboard → gameplay → restart');

  console.log(JSON.stringify({
    check:'aaa-urban-graphics-browser',
    profile:QUALITY_PROFILE,
    sampleSeconds:SAMPLE_SECONDS,
    selection,
    sampleCount:samples.length,
    restartCycles:restartSamples.length,
    stability,
    restartStability,
    restartGeometries:restartSamples.map(sample=>sample.rendererGeometries),
    restartSceneGeometries:restartSamples.map(sample=>sample.sceneGeometryCount),
    restartTextures:restartSamples.map(sample=>sample.rendererTextures),
    restartSceneTextures:restartSamples.map(sample=>sample.sceneTextureCount),
    final:{
      rendererCalls:afterRestart?.rendererCalls,
      rendererTriangles:afterRestart?.rendererTriangles,
      rendererGeometries:afterRestart?.rendererGeometries,
      rendererTextures:afterRestart?.rendererTextures,
      sceneGeometryCount:afterRestart?.sceneGeometryCount,
      sceneTextureCount:afterRestart?.sceneTextureCount,
      sceneObjectCount:afterRestart?.sceneObjectCount,
      instancedMeshCount:afterRestart?.instancedMeshCount,
      materialCount:afterRestart?.materialCount,
      lightCount:afterRestart?.lightCount,
      streamingSegmentCount:afterRestart?.streamingSegmentCount,
      urbanPropPopulation:afterRestart?.urbanPropPopulation,
      skylinePopulation:afterRestart?.skylinePopulation,
      urbanDrawCalls:afterRestart?.urbanDrawCalls,
      urbanInstances:afterRestart?.urbanInstances
    }
  }));
}finally{
  await context.close();
  await browser.close();
}
