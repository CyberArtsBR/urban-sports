import assert from 'node:assert/strict';
import process from 'node:process';
import {chromium,firefox,webkit} from '@playwright/test';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const TIMEOUT=Math.max(30000,Number(process.env.BROWSER_COMPAT_TIMEOUT_MS)||90000);

function target(quality){
  const url=new URL(BASE_URL);
  url.searchParams.set('test','1');
  url.searchParams.set('quality',quality);
  url.searchParams.set('seed','browser-compat-'+quality);
  return url.toString();
}

const engines=[
  {name:'chromium',launcher:chromium,options:{headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  {name:'firefox',launcher:firefox,options:{headless:true}},
  {name:'webkit',launcher:webkit,options:{headless:true}}
];

const results=[];
for(const engine of engines){
  let browser=null;
  try{
    browser=await engine.launcher.launch(engine.options);
    const context=await browser.newContext({viewport:{width:1024,height:720}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error?.message||error)));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

    const profiles={};
    for(const quality of ['low','max-cinematic']){
      await page.goto(target(quality),{waitUntil:'domcontentloaded',timeout:TIMEOUT});
      await page.waitForFunction(()=>{
        const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
        return d?.ready===true&&!!d?.renderingQuality;
      },null,{timeout:TIMEOUT});
      await page.waitForTimeout(800);
      const d=await page.evaluate(()=>window.chimpionsUrbanSports?.()??window.chimpionsSki?.()??null);
      assert(d,engine.name+' diagnostics unavailable');
      assert.equal(d.qualityProfile,quality,engine.name+' failed requested quality '+quality);
      if(quality==='low'){
        assert.equal(d.renderingQuality?.renderPath,'direct',engine.name+' LOW must use universal direct rendering');
      }else{
        const cinematic=d.renderingQuality?.cinematic||{};
        assert(cinematic.capabilities,engine.name+' must report capability probes');
        assert(['cinematic-composer','direct'].includes(d.renderingQuality?.renderPath),engine.name+' MAX CINEMATIC lacks a valid presentation path');
        if(d.renderingQuality?.renderPath==='direct')assert.equal(d.renderingQuality?.fallbackActive,true,engine.name+' direct fallback must be explicit');
      }
      profiles[quality]={
        renderPath:d.renderingQuality?.renderPath,
        renderTargetType:d.renderingQuality?.renderTargetType,
        fallbackActive:d.renderingQuality?.fallbackActive,
        capabilities:d.renderingQuality?.cinematic?.capabilities||null
      };
    }

    assert.deepEqual(errors,[],engine.name+' emitted JavaScript/console errors');
    results.push({engine:engine.name,status:'PASS',profiles});
    await context.close();
  }catch(error){
    results.push({engine:engine.name,status:'FAIL',error:String(error?.stack||error?.message||error)});
  }finally{
    await browser?.close?.().catch(()=>{});
  }
}

const failures=results.filter(result=>result.status!=='PASS');
console.log(JSON.stringify({
  check:'rendering-browser-compatibility',
  note:'Chromium covers the Chrome/Edge engine family, and Playwright WebKit is an engine proxy rather than physical Safari.',
  results
}));
assert.deepEqual(failures,[],'browser-engine compatibility failures: '+JSON.stringify(failures));
