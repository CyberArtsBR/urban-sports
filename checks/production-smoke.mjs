import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import path from 'node:path';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const RUN_TIMEOUT=60000;
const domClick=locator=>locator.evaluate(element=>element.click());
const runtime=page=>page.evaluate(()=>window.chimpionsUrbanSports?.()??window.chimpionsSki?.()??null);

async function dismissTutorial(page){
  const tutorial=page.locator('.session-tutorial:not([hidden])');
  if(!await tutorial.isVisible().catch(()=>false))return;
  // Use the same pointer-dismiss path as a real player first. Keyboard focus can
  // still be owned by the selector on the task immediately after it closes.
  await page.mouse.click(24,24).catch(()=>{});
  await tutorial.waitFor({state:'hidden',timeout:2500}).catch(async()=>{
    await page.keyboard.press('Enter').catch(()=>{});
    await tutorial.waitFor({state:'hidden',timeout:2500}).catch(()=>{});
  });
}

function trackHttpGlbs(page){
  const urls=[];
  page.on('request',request=>{
    const url=request.url();
    if(/^https?:/i.test(url)&&/\.glb(?:[?#]|$)/i.test(url))urls.push(url);
  });
  return urls;
}

async function boot(context){
  const page=await context.newPage({viewport:{width:1440,height:900}});
  const runtimeErrors=[],badResponses=[];
  const glbs=trackHttpGlbs(page);
  page.on('pageerror',error=>runtimeErrors.push(String(error?.stack||error)));
  page.on('response',response=>{if(response.status()>=400)badResponses.push(response.status()+' '+response.url());});
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>(
    window.chimpionsUrbanSports?.()?.ready===true||
    window.chimpionsSki?.()?.ready===true
  ),null,{timeout:60000});
  await page.waitForFunction(()=>{
    const button=document.querySelector('.start-screen-play');
    return !!button&&!button.disabled;
  },null,{timeout:30000});
  return {page,runtimeErrors,badResponses,glbs};
}

async function openReadySelector(page){
  await domClick(page.locator('.start-screen-play'));
  const selector=page.locator('#chimpion-selector');
  await selector.waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    if(!dialog?.open)return false;
    return !!dialog.querySelector('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])');
  },null,{timeout:30000});
  return selector;
}

async function chooseBuiltInAvatar(selector){
  const cards=selector.locator('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])');
  assert(await cards.count()>0,'Selector rendered no enabled built-in Chimpion cards');
  await domClick(cards.first());
}

async function chooseSkateboardCompatibleRide(page,selector){
  await page.waitForFunction(()=>{
    const step=document.querySelector('#ride-mode-step');
    return !!step&&!step.hidden;
  },null,{timeout:20000});

  const choice=await selector.evaluate(dialog=>{
    const button=
      dialog.querySelector('[data-sport-mode="skateboard"]:not([aria-disabled="true"])')||
      dialog.querySelector('.ride-mode-card[data-ride-mode="skateboard"]:not([aria-disabled="true"])')||
      dialog.querySelector('.ride-mode-card[data-ride-mode="snowboard"]:not([aria-disabled="true"])')||
      Array.from(dialog.querySelectorAll('.ride-mode-card:not([aria-disabled="true"])')).find(node=>/skateboard/i.test(node.textContent||''));
    if(!button)return null;
    const mode=button.dataset.sportMode||button.dataset.rideMode||button.textContent?.trim()||'unknown';
    button.click();
    return mode;
  });
  assert(choice,'Selector exposed no Skateboard-compatible ride control');
  return choice;
}

async function waitForGameplay(page){
  await page.waitForFunction(()=>!document.querySelector('#chimpion-selector')?.open,null,{timeout:60000});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    const tutorial=document.querySelector('.session-tutorial:not([hidden])');
    return !!tutorial||d?.mode==='countdown'||d?.mode==='playing';
  },null,{timeout:20000});
  await dismissTutorial(page);
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:RUN_TIMEOUT});
}

try{
  const builtInContext=await browser.newContext();
  const built=await boot(builtInContext);
  const {page}=built;
  const fresh=await runtime(page);
  assert(fresh,'Runtime diagnostics unavailable after boot');
  assert.equal(fresh.catalogSize,10,'Fresh runtime must expose exactly 10 built-in avatars');
  assert.equal(fresh.startCrowdCount,0,'Real Chimpion crowd must be disabled');
  assert.equal(fresh.startCrowdModelSources,0,'Crowd must own zero character GLB sources');
  assert.equal(built.glbs.length,0,'Fresh initial load must not request any character GLB');

  const selector=await openReadySelector(page);
  assert.equal(await selector.locator('.chimpion-card:not(.is-upload-avatar)').count(),10,'Selector must render exactly 10 built-in cards');
  assert.equal(await selector.locator('.chimpion-card.is-upload-avatar').count(),1,'Selector must expose exactly one local GLB upload action');

  await chooseBuiltInAvatar(selector);
  const selectedRideControl=await chooseSkateboardCompatibleRide(page,selector);
  await waitForGameplay(page);

  const ride=await runtime(page);
  assert(ride,'Runtime diagnostics unavailable in gameplay');
  assert.equal(ride.sportMode,'skateboard');
  assert.equal(ride.rideMode,'snowboard','Skateboard should currently use the proven snowboard handling profile');
  assert.equal(Math.round(ride.baseSpeed*3.6),150,'SKATEBOARD base speed must be 150 km/h');
  assert.equal(Math.round(ride.maxSpeed*3.6),300,'SKATEBOARD max speed must be 300 km/h');
  assert.equal(ride.startCrowdCount,0);
  assert.equal(ride.startCrowdModelSources,0);
  assert.equal(new Set(built.glbs).size,1,'Normal gameplay should request only the selected built-in GLB');

  await page.keyboard.press('Escape');
  await page.locator('#pause-overlay').waitFor({state:'visible',timeout:5000});
  await domClick(page.locator('#resume-game'));
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:5000});
  await page.keyboard.press('Escape');
  await page.locator('#pause-overlay').waitFor({state:'visible',timeout:5000});
  await domClick(page.locator('#restart-pause'));
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='countdown'||d?.mode==='playing';
  },null,{timeout:10000});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:RUN_TIMEOUT});
  const restarted=await runtime(page);
  assert(restarted,'Runtime diagnostics unavailable after restart');
  assert(restarted.distance<120,'Restart did not reset run distance');
  assert.equal(new Set(built.glbs).size,1,'Restart must reuse the selected rider without downloading additional GLBs');

  assert.equal(built.runtimeErrors.length,0,'Runtime errors: '+built.runtimeErrors.join('\n'));
  assert.equal(built.badResponses.filter(line=>line.startsWith('404 ')).length,0,'Required resource 404s: '+built.badResponses.join('\n'));
  await builtInContext.close();

  const localContext=await browser.newContext();
  const local=await boot(localContext);
  const custom=local.page;
  assert.equal(local.glbs.length,0,'Custom-upload fresh boot must not request a GLB');
  const customSelector=await openReadySelector(custom);

  const input=customSelector.locator('#local-glb-upload');
  await input.setInputFiles({name:'invalid.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('invalid glb')});
  await customSelector.locator('.selector-status.is-error').waitFor({state:'visible',timeout:5000});
  assert.match(await customSelector.locator('.selector-status').textContent(),/GLB|incomplete|invalid/i,'Invalid local GLB should fail understandably');
  assert.equal(local.glbs.length,0,'Invalid local GLB must create zero remote GLB requests');

  await input.setInputFiles(path.resolve('public/model/characters/The Heretic.glb'));
  await customSelector.locator('#ride-mode-step:not([hidden])').waitFor({state:'visible',timeout:20000});
  assert.equal(local.glbs.length,0,'Valid local GLB parsing must stay local-only');
  const customRideControl=await chooseSkateboardCompatibleRide(custom,customSelector);
  await waitForGameplay(custom);

  const customRide=await runtime(custom);
  assert(customRide,'Runtime diagnostics unavailable for local rider');
  assert.equal(customRide.sportMode,'skateboard');
  assert.equal(customRide.rideMode,'snowboard');
  assert.equal(Math.round(customRide.baseSpeed*3.6),150,'SKATEBOARD base speed must be 150 km/h');
  assert.equal(Math.round(customRide.maxSpeed*3.6),300,'SKATEBOARD max speed must be 300 km/h');
  assert.equal(customRide.selectedAvatarLocal,true,'Uploaded rider must be marked local-only');
  assert.equal(local.glbs.length,0,'Custom gameplay must create zero server GLB traffic');
  assert.equal(customRide.startCrowdCount,0);
  assert.equal(local.runtimeErrors.length,0,'Custom runtime errors: '+local.runtimeErrors.join('\n'));
  assert.equal(local.badResponses.filter(line=>line.startsWith('404 ')).length,0,'Custom-flow required resource 404s: '+local.badResponses.join('\n'));
  await localContext.close();

  console.log(JSON.stringify({
    check:'production-smoke',
    builtInRoster:10,
    freshBootGlbRequests:0,
    crowdGlbRequests:0,
    builtInGameplayUniqueGlbs:1,
    customGlbRemoteRequests:0,
    skateboard:true,
    legacySnowboardHandling:true,
    selectedRideControl,
    customRideControl,
    invalidCustomFailsSafely:true
  }));
}finally{
  await browser.close();
}
