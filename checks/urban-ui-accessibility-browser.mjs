import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:600},locale:'en-US'});
const errors=[];
page.on('pageerror',error=>{errors.push(String(error));console.error(error);});
// Deliver each tap for one actual gamepad poll, then a neutral sample. This
// exercises the production adapter without timing taps against GPU frame rate.
await page.addInitScript(()=>{
  window.testPad={connected:true,queue:[],polls:0};
  Object.defineProperty(navigator,'getGamepads',{value:()=>{
    const state=window.testPad;
    state.polls++;
    if(!state.connected)return [];
    const sample=state.queue.shift()||{};
    return [{id:'UI regression controller',index:0,connected:true,mapping:'standard',
      axes:sample.axes||[0,0],buttons:Array.from({length:17},(_,i)=>({pressed:(sample.buttons||[]).includes(i),value:(sample.buttons||[]).includes(i)?1:0}))}];
  }});
});
async function pad(sample={}){
  console.log('Controller sample',JSON.stringify(sample));
  const target=await page.evaluate(sample=>{
    const state=window.testPad;
    state.queue.push({},sample,{});
    return state.polls+state.queue.length;
  },sample);
  await page.waitForFunction(target=>window.testPad.polls>=target,target,{timeout:60000});
}
async function focusIs(id){
  console.log('Focus',id);
  await page.waitForFunction(id=>document.activeElement?.id===id,id,{timeout:10000});
}
async function modeIs(mode){
  await page.waitForFunction(mode=>window.chimpionsUrbanSports?.().mode===mode,mode,{timeout:30000});
}
try{
  await page.goto(base+'/?test=1&seed=urban-ui-controller',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.chimpionsUrbanSports?.().ready,{timeout:45000});
  await page.waitForFunction(()=>document.activeElement?.classList.contains('start-screen-play'));
  await pad({buttons:[13],axes:[0,1]});
  assert(await page.locator('.start-screen-back').evaluate(el=>el===document.activeElement),'D-pad plus stick must move exactly once');
  await pad({axes:[0,-1]});
  assert(await page.locator('.start-screen-play').evaluate(el=>el===document.activeElement),'Analog navigation must return to Start');
  await pad({buttons:[0]});
  await page.locator('#chimpion-selector').waitFor({state:'visible'});
  assert.equal(await page.locator('#ride-mode-step').count(),0,'Legacy ride selector returned');
  assert.equal(await page.locator('#skateboard-setup-step:not([hidden])').count(),0,'Fake gameplay setup returned');
  await pad({buttons:[1]});
  await page.locator('#chimpion-selector').waitFor({state:'hidden'});
  await focusIs('start');
  // Regression: closing rider selection leaves the menu Start entry active.
  await pad({buttons:[0]});
  await page.locator('#chimpion-selector').waitFor({state:'visible'});
  await pad({buttons:[13]});
  assert(await page.evaluate(()=>document.activeElement?.classList.contains('chimpion-card')),'Controller must reach a rider from search');
  await pad({buttons:[0]});
  await modeIs('playing');
  await pad({buttons:[9]});
  await modeIs('paused');
  await focusIs('resume-game');
  await pad({buttons:[13],axes:[0,1]});
  await focusIs('restart-pause');
  await pad({buttons:[13]});
  await focusIs('settings-pause');
  await pad({buttons:[0]});
  await focusIs('how-to-play');
  await page.keyboard.press('Shift+Tab');
  await focusIs('settings-close');
  await page.keyboard.press('Tab');
  await focusIs('how-to-play');

  await page.locator('#high-contrast').click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.highContrast),'true');
  await page.emulateMedia({reducedMotion:'reduce'});
  const animation=await page.locator('.settings-card').evaluate(el=>getComputedStyle(el).animationName);
  assert.equal(animation,'none','System reduced motion must suppress modal animation');
  await page.locator('#reduced-motion').click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.reducedMotion),'true');
  await page.locator('#language-setting').click(); // AUTO -> en-US
  await page.locator('#language-setting').click(); // en-US -> pt-BR
  assert.match(await page.locator('#settings-overlay').textContent(),/CONFIGURAÇÕES/);
  await page.locator('#language-setting').click(); // pt-BR -> AUTO (en-US)
  await pad({buttons:[1]});
  await focusIs('settings-pause');
  assert.equal(await page.locator('#settings-overlay').isVisible(),false,'B must close only Settings');
  await modeIs('paused');
  await pad({buttons:[13]});
  await focusIs('give-up-pause');
  await pad({buttons:[0]});
  await focusIs('leave-confirm-no');
  await pad({buttons:[1]});
  await focusIs('give-up-pause');
  await modeIs('paused');

  await page.evaluate(()=>{window.testPad.connected=false;});
  await page.waitForFunction(()=>document.querySelector('#controller-status')?.textContent.includes('disconnected'));
  assert.equal(await page.locator('#controller-status').getAttribute('role'),'status');
  await page.evaluate(()=>{window.testPad.connected=true;});
  await page.waitForFunction(()=>document.querySelector('#controller-status')?.textContent==='Controller connected.');
  await pad({buttons:[1]});
  await modeIs('playing');
  await pad({buttons:[9]});
  await focusIs('resume-game');
  await pad({buttons:[13]});
  await focusIs('restart-pause');
  await pad({buttons:[0]});
  await modeIs('playing');

  // Results are a component integration fixture: invoke the production UI's
  // public showResults contract rather than force a crash or alter physics.
  // Navigate away first so the full game renderer is disposed.
  await page.route('**/__ui-results/src/*.js',async route=>{
    const file=new URL(route.request().url()).pathname.split('/').pop();
    assert(/^[a-zA-Z0-9-]+\.js$/.test(file));
    await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../src/'+file,import.meta.url),'utf8')});
  });
  await page.route('**/__ui-results/',route=>route.fulfill({contentType:'text/html',body:`
    <html lang="en"><body><div class="hud"></div><div id="overlay"><button id="start">Start</button><button id="choose">Rider</button></div>
    <script type="module">
      import {createGameUI} from './src/ui.js';
      import {readPad} from './src/input.js';
      const ui=createGameUI({audio:{play(){},getSettings(){return {sfxEnabled:true,musicEnabled:false,sfxVolume:1,musicVolume:1};}}});
      ui.setMode('crashed');
      ui.showResults({distance:123,score:456,bananas:7},0);
      function tick(){ui.updateController(readPad(navigator.getGamepads()));requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    </script></body></html>`}));
  await page.goto(base+'/__ui-results/');
  await page.locator('#result-overlay').waitFor({state:'visible'});
  assert.equal(await page.locator('#result-distance').textContent(),'123 m');
  await focusIs('restart-result');
  await pad({buttons:[13]});
  await focusIs('choose-result');
  await pad({buttons:[13]});
  await focusIs('give-up-result');
  await pad({buttons:[1]});
  await focusIs('leave-confirm-no');
  await pad({buttons:[1]});
  await focusIs('give-up-result');
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log(JSON.stringify({check:'urban-ui-accessibility-browser',status:'PASS',flows:['start','selector-back-start','dpad-stick-no-double','pause','restart','settings','tab-trap','focus-restoration','leave-cancel','results','disconnect-reconnect','high-contrast','reduced-motion','localization']}));
}catch(error){
  console.error('UI failure context',await page.evaluate(()=>({focus:document.activeElement?.id,mode:window.chimpionsUrbanSports?.().mode,pad:window.testPad})).catch(()=>null));
  throw error;
}finally{
  await browser.close();
}
