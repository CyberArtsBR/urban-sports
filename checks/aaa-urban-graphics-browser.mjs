import assert from 'node:assert/strict';
import process from 'node:process';
import {chromium} from '@playwright/test';
import {analyzeGraphicsStability,evaluateGraphicsBudget,normalizeGraphicsBudgetProfile} from '../src/graphicsDiagnostics.js';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const REQUESTED_QUALITY_PROFILE=String(process.env.QUALITY_PROFILE||'high').trim().toLowerCase();
assert(['low','medium','high','max-cinematic','max'].includes(REQUESTED_QUALITY_PROFILE),'QUALITY_PROFILE must be low, medium, high, max-cinematic or max');
const BUDGET_PROFILE=normalizeGraphicsBudgetProfile(REQUESTED_QUALITY_PROFILE);
const SAMPLE_SECONDS=Math.max(6,Math.min(120,Number(process.env.GRAPHICS_SAMPLE_SECONDS)||18));
const SAMPLE_INTERVAL_MS=Math.max(250,Math.min(5000,Number(process.env.GRAPHICS_SAMPLE_INTERVAL_MS)||1000));

function targetUrl(){
  const url=new URL(BASE_URL);
  url.searchParams.set('test','1');
  url.searchParams.set('quality',REQUESTED_QUALITY_PROFILE);
  url.searchParams.set('seed','aaa-graphics-'+REQUESTED_QUALITY_PROFILE);
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

  await page.waitForFunction(()=>!document.querySelector('#chimpion-selector')?.open,null,{timeout:60000});
  // beginRun is scheduled after the async rider-selection close handler. Wait
  // for the tutorial/countdown/run hand-off rather than sampling the tutorial
  // visibility on the same task that closed the modal.
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    const tutorial=document.querySelector('.session-tutorial:not([hidden])');
    return !!tutorial||d?.mode==='countdown'||d?.mode==='playing';
  },null,{timeout:20000});

  const tutorial=page.locator('.session-tutorial:not([hidden])');
  if(await tutorial.isVisible().catch(()=>false)){
    // Pointer dismissal uses the same capture-path as a real player and avoids
    // focus-dependent keyboard races in headless Chromium.
    await page.mouse.click(24,24);
    await tutorial.waitFor({state:'hidden',timeout:5000});
  }
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:30000});

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
  const tierProbe=await diagnostics(page);
  const rendering=tierProbe?.renderingQuality||{};
  assert.equal(rendering.profile,REQUESTED_QUALITY_PROFILE,'runtime rendering profile did not match requested graphics tier');
  if(REQUESTED_QUALITY_PROFILE==='max-cinematic'){
    const cinematic=rendering.cinematic||{};
    assert.equal(tierProbe?.qualitySettings?.dprCap,1.6,'MAX CINEMATIC must request DPR 1.6');
    assert((tierProbe?.rendererPixelRatio??99)<=1.6001,'MAX CINEMATIC effective DPR must not exceed 1.6');
    assert.equal(rendering.msaaSamples,0,'MAX CINEMATIC offscreen target must use zero MSAA samples');
    assert.equal(rendering.canvasAntialias,false,'MAX CINEMATIC WebGL context must disable canvas MSAA');
    assert.equal(rendering.canvasSamples,0,'MAX CINEMATIC default framebuffer must report zero samples');
    assert.equal(rendering.shadowMapsEnabled,false,'MAX CINEMATIC must spend the shadow-map budget on cinematic passes');
    assert.equal(cinematic.failed,false,'MAX CINEMATIC post stack must initialize without failure: '+String(cinematic.failureReason||''));
    assert.equal(cinematic.enabled,true,'MAX CINEMATIC post stack must be active during gameplay');
    assert.equal(cinematic.ambientOcclusion,true,'MAX CINEMATIC must enable GTAO');
    assert.equal(cinematic.aoType,'GTAO','MAX CINEMATIC must use GTAO rather than legacy SSAO');
    assert.equal(cinematic.aoResolutionScale,.5,'MAX CINEMATIC GTAO must run at half resolution');
    assert(Math.abs((cinematic.bloomStrength??0)-.65)<.001,'MAX CINEMATIC bloom strength drifted');
    assert(Math.abs((cinematic.bloomRadius??0)-.48)<.001,'MAX CINEMATIC bloom radius drifted');
    assert(Math.abs((cinematic.bloomThreshold??0)-1.60)<.001,'MAX CINEMATIC bloom threshold drifted');
    assert.equal(cinematic.colorGrading,true,'MAX CINEMATIC LUT grading must be active');
    assert.equal(cinematic.sharpenEnabled,true,'MAX CINEMATIC sharpening must be active');
    assert.equal(cinematic.volumetricFog,true,'MAX CINEMATIC reduced-resolution atmosphere must be active');
    assert.equal(cinematic.volumetricResolutionScale,.5,'MAX CINEMATIC atmosphere must be half resolution');
    assert.equal(cinematic.lightShafts,true,'MAX CINEMATIC selective light shafts must be available');
    assert.equal(cinematic.depthOfField,false,'DOF must stay off during normal high-speed gameplay');
    assert.equal(cinematic.depthOfFieldMode,'cinematic','DOF must remain context-controlled');
    assert.equal(tierProbe?.qualitySettings?.contactShadows,true,'MAX CINEMATIC rider contact shadow must be configured');
    assert((rendering.materialQuality?.anisotropy??0)>=8,'MAX CINEMATIC must retain at least 8x road anisotropy when supported');
  }else if(REQUESTED_QUALITY_PROFILE==='max'){
    assert.equal(rendering.shadowMapsEnabled,true,'Legacy MAX must retain real shadow maps');
    assert(rendering.shadowMapSize>=2048,'Legacy MAX must retain the premium directional shadow resolution');
    assert.equal(rendering.ssaoEnabled,false,'Legacy MAX remains on the production-safe direct-render path');
    assert((rendering.materialQuality?.anisotropy??0)>=16,'Legacy MAX must retain premium road anisotropy when supported');
  }else if(REQUESTED_QUALITY_PROFILE==='high'){
    assert.equal(rendering.shadowMapsEnabled,true,'HIGH must retain budgeted real shadows');
    assert(rendering.shadowMapSize>=1024&&rendering.shadowMapSize<2048,'HIGH shadow resolution must remain below MAX');
    assert.equal(rendering.ssaoEnabled,false,'HIGH must not pay the cinematic AO render cost');
  }else{
    assert.equal(rendering.ssaoEnabled,false,REQUESTED_QUALITY_PROFILE+' must not enable cinematic AO');
    assert.equal(rendering.shadowMapsEnabled,false,REQUESTED_QUALITY_PROFILE+' must use lightweight contact grounding instead of real shadow maps');
  }

  const samples=[];
  const deadline=Date.now()+SAMPLE_SECONDS*1000;
  while(Date.now()<deadline){
    const sample=await diagnostics(page);
    assert(sample,'runtime diagnostics unavailable during graphics audit');
    const budget=evaluateGraphicsBudget(sample,BUDGET_PROFILE);
    assert(budget.ok,`${REQUESTED_QUALITY_PROFILE} graphics budget exceeded: ${JSON.stringify(budget.violations)}`);
    samples.push({...sample,t:Date.now()});
    await page.waitForTimeout(Math.min(SAMPLE_INTERVAL_MS,Math.max(0,deadline-Date.now())));
  }

  const stability=analyzeGraphicsStability(samples);
  assert(stability.ok,`runtime resource counts show suspicious monotonic growth: ${JSON.stringify(stability.violations)}`);

  const restartSamples=[];
  for(let cycle=1;cycle<=4;cycle++){
    const beforeRestart=await diagnostics(page);
    if(beforeRestart?.mode==='playing'){
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>{
        const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
        return d?.mode==='paused'||d?.mode==='crashed';
      },null,{timeout:10000});
    }
    const restarted=await page.evaluate(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      const button=d?.mode==='paused'
        ?document.querySelector('#restart-pause')
        :d?.mode==='crashed'
          ?document.querySelector('#restart-result')
          :null;
      if(!button||button.disabled)return {ok:false,mode:d?.mode??null};
      button.click();
      return {ok:true,mode:d?.mode??null};
    });
    assert(restarted.ok,`restart control unavailable on cycle ${cycle} from mode ${restarted.mode}`);
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return d?.mode==='playing';
    },null,{timeout:45000});

    await page.waitForTimeout(1500);
    const afterRestart=await diagnostics(page);
    const afterRestartBudget=evaluateGraphicsBudget(afterRestart,BUDGET_PROFILE);
    assert(afterRestartBudget.ok,`restart ${cycle} exceeded ${REQUESTED_QUALITY_PROFILE} graphics budget: ${JSON.stringify(afterRestartBudget.violations)}`);
    restartSamples.push({...afterRestart,t:Date.now(),restartCycle:cycle});
  }

  const restartStability=analyzeGraphicsStability(
    restartSamples,
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
    profile:REQUESTED_QUALITY_PROFILE,
    budgetProfile:BUDGET_PROFILE,
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
      urbanInstances:afterRestart?.urbanInstances,
      renderingQuality:afterRestart?.renderingQuality
    }
  }));
}finally{
  await context.close();
  await browser.close();
}
