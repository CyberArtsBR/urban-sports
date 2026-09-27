import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {
  assertMeaningfulCanvas,
  completeUrbanStartFlow,
  launchReleaseBrowser,
  releaseTargetUrl,
  runtime,
  sampleMeaningfulCanvas
} from './release-browser-utils.mjs';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const OUTPUT_DIR=path.resolve(process.env.VISUAL_OUTPUT_DIR||'artifacts/visual-regression');
const cases=[
  {name:'low-day',quality:'low',weather:'day'},
  {name:'medium-night',quality:'medium',weather:'night'},
  {name:'high-rain',quality:'high',weather:'rain'},
  {name:'max-night',quality:'max',weather:'night'},
  {name:'max-storm',quality:'max',weather:'storm'}
];

await mkdir(OUTPUT_DIR,{recursive:true});
const browser=await launchReleaseBrowser();
const report=[];

try{
  for(const item of cases){
    const context=await browser.newContext({
      viewport:{width:1440,height:900},
      deviceScaleFactor:1,
      reducedMotion:'reduce'
    });
    const page=await context.newPage();
    console.log('[visual] starting '+item.name);
    // Start all cases from the same cheap deterministic boot configuration.
    // MAX + storm is intentionally applied only after gameplay is live so the
    // visual-regression gate does not accidentally become a cold-start stress test.
    await page.goto(releaseTargetUrl(BASE_URL,{
      quality:'low',
      weather:'day',
      seed:'visual-regression-'+item.name
    }),{waitUntil:'domcontentloaded',timeout:60000});
    await completeUrbanStartFlow(page);

    await page.evaluate(expected=>{
      const quality=document.getElementById('atmosphere-quality');
      const weather=document.getElementById('atmosphere-mode');
      if(!quality||!weather)throw new Error('Visual controls unavailable');
      quality.value=expected.quality;
      quality.dispatchEvent(new Event('change',{bubbles:true}));
      weather.value=expected.weather;
      weather.dispatchEvent(new Event('change',{bubbles:true}));
    },item);
    await page.waitForFunction(expected=>{
      const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
      return d?.qualityProfile===expected.quality&&d?.weatherState?.mode===expected.weather;
    },item,{timeout:30000});
    await page.waitForTimeout(1800);

    const state=await runtime(page);
    assert.equal(state?.qualityProfile,item.quality,item.name+': wrong quality profile');
    assert.equal(state?.weatherState?.mode,item.weather,item.name+': wrong weather mode');
    const canvas=await sampleMeaningfulCanvas(page);
    assertMeaningfulCanvas(canvas,item.name);

    const file=path.join(OUTPUT_DIR,item.name+'.png');
    await page.screenshot({path:file,fullPage:false,animations:'disabled'});
    report.push({
      ...item,
      file,
      preset:state?.weatherState?.preset,
      canvas,
      rendererCalls:state?.rendererCalls,
      rendererTriangles:state?.rendererTriangles
    });
    console.log('[visual] captured '+item.name);
    await context.close();
  }

  console.log(JSON.stringify({
    check:'visual-regression-browser',
    comparisonPolicy:'controlled screenshots are artifacts; stochastic weather is not pixel-perfect gated',
    viewport:'1440x900@1x',
    reducedMotion:true,
    deterministicSeed:true,
    cases:report
  }));
}finally{
  await browser.close();
}
