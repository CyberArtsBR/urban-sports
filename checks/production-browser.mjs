import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {resolveProductionUrl} from '../scripts/production-url.mjs';

const base=resolveProductionUrl(process.env);
const expected=
  process.env.CHIMPIONS_URBAN_SPORTS_EXPECTED_COMMIT||
  process.env.CHIMPIONS_SKI_EXPECTED_COMMIT||
  '';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});

try{
  const deadline=Date.now()+10*60*1000;
  let live='';
  while(Date.now()<deadline){
    try{
      const response=await page.request.get(base+'/version.json?audit='+Date.now());
      if(response.ok()){
        const version=await response.json();
        live=version.commit||'';
        if(!expected||live===expected)break;
      }
    }catch{}
    await page.waitForTimeout(15000);
  }
  assert(live,'Production version manifest must be reachable');
  if(expected)assert.equal(live,expected,'Deployed production revision must match the audited commit');

  await page.goto(base+'/?test=1&revision='+live,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.ready===true;
  },null,{timeout:45000});

  const state=await page.evaluate(()=>window.chimpionsUrbanSports?.()??window.chimpionsSki?.()??null);
  assert(state,'Urban Sports runtime diagnostics must be available in production');
  assert.equal(state.catalogSize,10);
  assert.equal(state.startCrowdCount,0);
  assert.equal(state.startCrowdModelSources,0);
  assert.equal(state.skierFallback,true);
  assert.equal(state.mode,'menu');
  assert.equal(state.sportMode,'skateboard','Production must boot in Skateboard sport mode');
  assert.equal(state.rideMode,'snowboard','Skateboard currently uses the proven snowboard handling profile');
  assert.equal(Math.round(state.baseSpeed*3.6),150,'Default SKATEBOARD base speed must be 150 km/h');
  assert.equal(Math.round(state.maxSpeed*3.6),300,'Default SKATEBOARD max speed must be 300 km/h');
  console.log('PASS Urban Sports production desktop browser:',live,base);
}finally{
  await browser.close();
}
