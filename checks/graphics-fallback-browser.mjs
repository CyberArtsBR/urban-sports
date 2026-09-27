import assert from 'node:assert/strict';
import {GRAPHICS_FAULT_INJECTION_CASES} from '../src/renderFailOpen.js';
import {
  assertMeaningfulCanvas,
  completeUrbanStartFlow,
  exerciseContextLoss,
  launchReleaseBrowser,
  releaseTargetUrl,
  runtime,
  sampleMeaningfulCanvas
} from './release-browser-utils.mjs';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await launchReleaseBrowser();
const results=[];

try{
  for(const fault of GRAPHICS_FAULT_INJECTION_CASES){
    const context=await browser.newContext({viewport:{width:1280,height:720}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error?.stack||error)));
    await page.goto(releaseTargetUrl(BASE_URL,{
      quality:'low',
      seed:'fault-'+fault,
      weather:'day',
      graphicsFault:fault
    }),{waitUntil:'domcontentloaded',timeout:60000});
    await completeUrbanStartFlow(page);
    await page.waitForTimeout(700);

    const state=await runtime(page);
    const failOpen=state?.renderFailOpen;
    assert(failOpen,fault+': missing fail-open diagnostics');
    assert.equal(failOpen.faultCount,1,fault+': injected graphics fault was not observed exactly once');
    assert.equal(failOpen.optionalDisabled,true,fault+': failed optional path was not quarantined');
    assert(failOpen.fallbackFrames>=1,fault+': no same-frame direct fallback was recorded');
    assert(failOpen.directFrames>0,fault+': gameplay never rendered through direct safe path');
    assert.equal(errors.length,0,fault+': uncaught browser errors: '+errors.join('\n'));

    const canvas=await sampleMeaningfulCanvas(page);
    assertMeaningfulCanvas(canvas,'fault '+fault);
    results.push({fault,failOpen,canvas});
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:1280,height:720}});
  const page=await context.newPage();
  await page.goto(releaseTargetUrl(BASE_URL,{quality:'low',seed:'context-loss',weather:'day'}),{
    waitUntil:'domcontentloaded',timeout:60000
  });
  await completeUrbanStartFlow(page);
  const before=await sampleMeaningfulCanvas(page);
  assertMeaningfulCanvas(before,'context-loss before');

  const loss=await exerciseContextLoss(page);
  let restored=null;
  if(loss.supported){
    assert.equal(loss.restoredEvent,true,'WEBGL_lose_context did not restore within the release timeout');
    await page.waitForFunction(()=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return (d?.renderFailOpen?.contextRestoreCount||0)>=1;
    },null,{timeout:10000});
    await page.waitForTimeout(800);
    const state=await runtime(page);
    assert.equal(state?.mode,'playing','gameplay state did not survive WebGL context restoration');
    restored=await sampleMeaningfulCanvas(page);
    assertMeaningfulCanvas(restored,'context-loss restored');
  }

  results.push({contextLoss:loss,before,restored});
  await context.close();

  console.log(JSON.stringify({
    check:'graphics-fallback-browser',
    faults:GRAPHICS_FAULT_INJECTION_CASES,
    faultCases:GRAPHICS_FAULT_INJECTION_CASES.length,
    contextLoss:results.at(-1)?.contextLoss,
    results
  }));
}finally{
  await browser.close();
}
