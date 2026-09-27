import assert from 'node:assert/strict';
import process from 'node:process';
import {chromium} from '@playwright/test';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const RUN_TIMEOUT=Math.max(30000,Number(process.env.RENDER_RELIABILITY_TIMEOUT_MS)||120000);

function urlFor(params={}){
  const url=new URL(BASE_URL);
  url.searchParams.set('test','1');
  url.searchParams.set('quality','max-cinematic');
  url.searchParams.set('seed','render-reliability-v2');
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
  return url.toString();
}

async function diagnostics(page){
  return page.evaluate(()=>window.chimpionsUrbanSports?.()??window.chimpionsSki?.()??null);
}

async function startGameplay(page,target){
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>typeof window.chimpionsUrbanSports==='function'||typeof window.chimpionsSki==='function',null,{timeout:45000});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.ready===true;
  },null,{timeout:45000});

  const play=page.locator('.start-screen-play');
  await play.waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('.start-screen-play')?.disabled,null,{timeout:30000});
  const startClicked=await page.evaluate(()=>{
    const button=document.querySelector('.start-screen-play');
    if(!button||button.disabled)return false;
    button.click();
    return true;
  });
  assert.equal(startClicked,true,'Start Game control unavailable after readiness');

  const selector=page.locator('#chimpion-selector');
  await selector.waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    return !!dialog?.querySelector('.chimpion-card:not([aria-disabled="true"])');
  },null,{timeout:30000});
  const avatarResult=await page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    const card=dialog?.querySelector('.chimpion-card.is-selected:not([aria-disabled="true"])')||dialog?.querySelector('.chimpion-card:not([aria-disabled="true"])');
    if(!card)return {ok:false,reason:'No enabled Chimpion card'};
    card.click();
    return {ok:true};
  });
  assert.equal(avatarResult.ok,true,avatarResult.reason||'Failed to choose Chimpion');

  await page.waitForFunction(()=>{
    const step=document.querySelector('#ride-mode-step');
    return !!step&&!step.hidden;
  },null,{timeout:15000});
  const rideResult=await page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    const button=dialog?.querySelector('[data-sport-mode="skateboard"]')||
      dialog?.querySelector('.ride-mode-card[data-ride-mode="skateboard"]')||
      dialog?.querySelector('.ride-mode-card[data-ride-mode="snowboard"]')||
      Array.from(dialog?.querySelectorAll('.ride-mode-card')||[]).find(node=>/skateboard/i.test(node.textContent||''));
    if(!button)return {ok:false,reason:'No Skateboard-compatible ride control'};
    button.click();
    return {ok:true};
  });
  assert.equal(rideResult.ok,true,rideResult.reason||'Failed to choose Skateboard');

  await page.waitForFunction(()=>!document.querySelector('#chimpion-selector')?.open,null,{timeout:RUN_TIMEOUT});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return !!document.querySelector('.session-tutorial:not([hidden])')||d?.mode==='countdown'||d?.mode==='playing';
  },null,{timeout:20000});
  const tutorial=page.locator('.session-tutorial:not([hidden])');
  if(await tutorial.isVisible().catch(()=>false)){
    await page.mouse.click(24,24);
    await tutorial.waitFor({state:'hidden',timeout:5000});
  }
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:RUN_TIMEOUT});
  await page.waitForTimeout(1000);
  return diagnostics(page);
}

const browser=await chromium.launch({
  headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});

try{
  {
    const context=await browser.newContext({viewport:{width:1280,height:720}});
    const page=await context.newPage();
    const d=await startGameplay(page,urlFor({renderFail:'render-target'}));
    assert.equal(d?.mode,'playing','forced render-target failure must not stop gameplay');
    assert.equal(d?.renderingQuality?.renderPath,'direct','render-target failure must use direct renderer');
    assert.equal(d?.renderingQuality?.fallbackActive,true,'MAX CINEMATIC must report fallback active');
    assert.equal(d?.renderingQuality?.cinematic?.failed,true,'forced target failure must be recorded');
    assert.match(String(d?.renderingQuality?.cinematic?.failureReason||''),/renderable-offscreen-target|forced/i);
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width:1280,height:720}});
    const page=await context.newPage();
    await startGameplay(page,urlFor({renderFail:'black-output'}));
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return (d?.renderingQuality?.cinematic?.blackFallbackCount||0)>=1;
    },null,{timeout:RUN_TIMEOUT});
    const d=await diagnostics(page);
    assert.equal(d?.mode,'playing','black-output recovery must preserve gameplay');
    assert((d?.renderingQuality?.cinematic?.blackFallbackCount||0)>=1,'black output must trigger same-frame fallback');
    assert((d?.renderingQuality?.cinematic?.runtimeDegradations||[]).some(entry=>entry?.type==='target-fallback'||entry?.type==='feature-disabled'||entry?.type==='pipeline-disabled'),'black output must record a conservative degradation');
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width:1280,height:720}});
    const page=await context.newPage();
    const d=await startGameplay(page,urlFor({renderFail:'gtao,bloom,lut,volumetric,sharpen,dof'}));
    assert.equal(d?.mode,'playing','decorative shader failures must preserve gameplay');
    const cinematic=d?.renderingQuality?.cinematic||{};
    assert.equal(cinematic.failed,false,'optional shader failures must not disable the entire composition pipeline');
    for(const feature of ['ao','bloom','volumetric','colorGrading','dof','sharpen']){
      assert(cinematic.featureFailures?.[feature],feature+' forced failure must be recorded');
    }
    assert(['cinematic-composer','direct'].includes(d?.renderingQuality?.renderPath),'shader failures must retain a visible presentation path');
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width:1280,height:720}});
    const page=await context.newPage();
    const before=await startGameplay(page,urlFor());
    const supported=!!before?.renderingQuality?.cinematic?.capabilities?.extensions?.WEBGL_lose_context;
    if(supported){
      const triggered=await page.evaluate(()=>{
        const canvas=document.querySelector('canvas');
        const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
        const ext=gl?.getExtension('WEBGL_lose_context');
        if(!ext)return false;
        ext.loseContext();
        setTimeout(()=>ext.restoreContext(),200);
        return true;
      });
      assert.equal(triggered,true);
      await page.waitForFunction(()=>{
        const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
        return (d?.renderingQuality?.cinematic?.contextRestoreCount||0)>=1&&d?.renderingQuality?.cinematic?.contextLost===false;
      },null,{timeout:RUN_TIMEOUT});
      await page.waitForTimeout(1200);
      const after=await diagnostics(page);
      assert.equal(after?.mode,'playing','context restoration must preserve gameplay state');
      assert.equal(after?.renderingQuality?.cinematic?.contextLost,false,'context must not remain permanently lost');
      assert((after?.renderingQuality?.cinematic?.runtimeDegradations||[]).some(entry=>entry?.type==='context-restored-direct-first'),'restoration must force direct rendering before rebuilding optional composition');
    }
    await context.close();
  }

  console.log(JSON.stringify({check:'rendering-reliability-browser',status:'PASS'}));
}finally{
  await browser.close();
}
