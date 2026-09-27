import assert from 'node:assert/strict';
import {
  completeUrbanStartFlow,
  launchReleaseBrowser,
  releaseTargetUrl,
  runtime
} from './release-browser-utils.mjs';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await launchReleaseBrowser();

async function installVirtualPad(context){
  await context.addInitScript(()=>{
    const state={connected:true,axes:[0,0],pressed:new Set()};
    const buttons=Array.from({length:16},(_,index)=>({
      get pressed(){return state.pressed.has(index);},
      get value(){return state.pressed.has(index)?1:0;}
    }));
    const pad={
      index:0,id:'Release QA Standard Pad',mapping:'standard',
      get connected(){return state.connected;},
      get axes(){return state.axes;},
      buttons
    };
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>state.connected?[pad]:[]});
    Object.defineProperty(window,'__releasePad',{value:{
      press(index){state.pressed.add(index);},
      release(index){state.pressed.delete(index);},
      axis(index,value){state.axes[index]=Number(value)||0;},
      connect(value){state.connected=!!value;},
      neutral(){state.axes=[0,0];state.pressed.clear();}
    }});
  });
}
async function pulse(page,index,ms=160){
  await page.evaluate(i=>window.__releasePad.press(i),index);
  await page.waitForTimeout(ms);
  await page.evaluate(i=>window.__releasePad.release(i),index);
  await page.waitForTimeout(100);
}
async function axisPulse(page,index,value,ms=160){
  await page.evaluate(([i,v])=>window.__releasePad.axis(i,v),[index,value]);
  await page.waitForTimeout(ms);
  await page.evaluate(i=>window.__releasePad.axis(i,0),index);
  await page.waitForTimeout(100);
}
async function waitControllerPolls(page,frames=2){
  await page.evaluate(frameCount=>new Promise(resolve=>{
    let remaining=Math.max(1,Number(frameCount)||1);
    const tick=()=>{
      remaining--;
      if(remaining<=0)resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }),frames);
}

const controllerContext=await browser.newContext({viewport:{width:1280,height:720}});
await installVirtualPad(controllerContext);
const controllerPage=await controllerContext.newPage();

try{
  await controllerPage.goto(releaseTargetUrl(BASE_URL,{quality:'low',weather:'day',seed:'controller-browser'}),{
    waitUntil:'domcontentloaded',timeout:60000
  });
  await controllerPage.waitForFunction(()=>window.chimpionsUrbanSports?.()?.ready===true||window.chimpionsSki?.()?.ready===true,null,{timeout:60000});

  // Hold A/Cross until the start screen actually consumes the controller edge.
  // Fixed sub-frame pulses are flaky under heavily loaded headless CI and can
  // miss requestAnimationFrame polling without representing a real regression.
  await controllerPage.evaluate(()=>window.__releasePad.press(0));
  await controllerPage.waitForFunction(()=>document.querySelector('#chimpion-selector')?.open===true,null,{timeout:10000});
  await controllerPage.evaluate(()=>window.__releasePad.release(0));
  await controllerPage.locator('#chimpion-selector').waitFor({state:'visible',timeout:5000});

  assert.equal(await controllerPage.evaluate(()=>document.activeElement?.id),'chimpion-search','selector should begin at the search field');
  // menuInputRepeat intentionally rearms only after a neutral frame. Give the
  // just-opened modal that neutral poll before asserting controller movement.
  await controllerPage.evaluate(()=>window.__releasePad.neutral());
  await waitControllerPolls(controllerPage,3);

  await controllerPage.evaluate(()=>window.__releasePad.axis(1,.92));
  await controllerPage.waitForFunction(()=>document.activeElement?.dataset?.filterIndex==='0',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.axis(1,0));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>window.__releasePad.axis(0,.92));
  await controllerPage.waitForFunction(()=>document.activeElement?.dataset?.filterIndex==='1',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.axis(0,0));
  await waitControllerPolls(controllerPage,2);
  assert.equal(await controllerPage.evaluate(()=>document.activeElement?.dataset?.filterIndex??null),'1','single analog navigation double-moved after release');

  await controllerPage.evaluate(()=>window.__releasePad.press(15));
  await controllerPage.waitForFunction(()=>document.activeElement?.dataset?.filterIndex==='2',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(15));
  await waitControllerPolls(controllerPage,2);
  assert.equal(await controllerPage.evaluate(()=>document.activeElement?.dataset?.filterIndex??null),'2','single D-pad navigation double-moved after release');

  await controllerPage.evaluate(()=>window.__releasePad.press(0));
  await controllerPage.waitForFunction(()=>!document.querySelector('#ride-mode-step')?.hidden,null,{timeout:10000});
  await controllerPage.evaluate(()=>window.__releasePad.release(0));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>window.__releasePad.press(1));
  await controllerPage.waitForFunction(()=>document.querySelector('#ride-mode-step')?.hidden===true,null,{timeout:10000});
  await controllerPage.evaluate(()=>window.__releasePad.release(1));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>window.__releasePad.press(0));
  await controllerPage.waitForFunction(()=>!document.querySelector('#ride-mode-step')?.hidden,null,{timeout:10000});
  await controllerPage.evaluate(()=>window.__releasePad.release(0));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>window.__releasePad.press(0));
  await controllerPage.waitForFunction(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    return dialog?.getAttribute('aria-busy')==='true'||dialog?.open===false;
  },null,{timeout:10000});
  await controllerPage.evaluate(()=>window.__releasePad.release(0));
  await controllerPage.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return !!document.querySelector('.session-tutorial:not([hidden])')||d?.mode==='countdown'||d?.mode==='playing';
  },null,{timeout:30000});
  const tutorial=controllerPage.locator('.session-tutorial:not([hidden])');
  if(await tutorial.isVisible().catch(()=>false))await controllerPage.mouse.click(20,20);
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='playing';},null,{timeout:60000});

  await controllerPage.evaluate(()=>window.__releasePad.press(9));
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='paused';},null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(9));
  await controllerPage.waitForFunction(()=>document.activeElement?.id==='resume-game',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.neutral());
  await waitControllerPolls(controllerPage,3);

  await controllerPage.evaluate(()=>window.__releasePad.press(13));
  await controllerPage.waitForFunction(()=>document.activeElement?.id==='restart-pause',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(13));
  await waitControllerPolls(controllerPage,2);
  assert.equal(await controllerPage.evaluate(()=>document.activeElement?.id),'restart-pause','D-pad down skipped or double-navigated');

  await controllerPage.evaluate(()=>window.__releasePad.axis(1,.92));
  await controllerPage.waitForFunction(()=>document.activeElement?.id==='settings-pause',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.axis(1,0));
  await waitControllerPolls(controllerPage,2);
  assert.equal(await controllerPage.evaluate(()=>document.activeElement?.id),'settings-pause','analog down did not navigate one settings row');

  await controllerPage.evaluate(()=>window.__releasePad.press(0));
  await controllerPage.locator('#settings-overlay').waitFor({state:'visible',timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(0));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>window.__releasePad.press(1));
  await controllerPage.locator('#settings-overlay').waitFor({state:'hidden',timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(1));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>window.__releasePad.press(1));
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='playing';},null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(1));
  await waitControllerPolls(controllerPage,2);

  await controllerPage.evaluate(()=>{
    window.__releasePad.press(9);
    window.__releasePad.connect(false);
  });
  await waitControllerPolls(controllerPage,2);
  await controllerPage.evaluate(()=>window.__releasePad.connect(true));
  await waitControllerPolls(controllerPage,3);
  assert.equal((await runtime(controllerPage))?.mode,'playing','held Start leaked through reconnect quarantine');
  await controllerPage.evaluate(()=>window.__releasePad.release(9));
  await waitControllerPolls(controllerPage,3);
  await controllerPage.evaluate(()=>window.__releasePad.press(9));
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='paused';},null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(9));
  await waitControllerPolls(controllerPage,2);

  // Return to gameplay, force the real crash path in test mode, surface the
  // results UI, and prove controller confirm restarts from results.
  await controllerPage.evaluate(()=>window.__releasePad.press(1));
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='playing';},null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.release(1));
  await waitControllerPolls(controllerPage,2);
  const crashTriggered=await controllerPage.evaluate(()=>{
    if(typeof window.__urbanReleaseTest?.forceCrash!=='function')return false;
    window.__urbanReleaseTest.forceCrash('test');
    return true;
  });
  assert.equal(crashTriggered,true,'test-mode crash hook was unavailable');
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='crashed';},null,{timeout:5000});
  const resultsShown=await controllerPage.evaluate(()=>window.__urbanReleaseTest?.showCrashResults?.()===true);
  assert.equal(resultsShown,true,'crash results could not be surfaced');
  await controllerPage.locator('#result-overlay').waitFor({state:'visible',timeout:5000});
  await controllerPage.waitForFunction(()=>document.activeElement?.id==='restart-result',null,{timeout:5000});
  await controllerPage.evaluate(()=>window.__releasePad.neutral());
  await waitControllerPolls(controllerPage,3);
  await controllerPage.evaluate(()=>window.__releasePad.press(0));
  await controllerPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='playing';},null,{timeout:30000});
  await controllerPage.evaluate(()=>window.__releasePad.release(0));
}finally{
  await controllerContext.close();
}

const touchContext=await browser.newContext({
  viewport:{width:844,height:390},
  hasTouch:true,
  isMobile:true
});
const touchPage=await touchContext.newPage();

try{
  await touchPage.goto(releaseTargetUrl(BASE_URL,{quality:'low',weather:'day',seed:'touch-browser'}),{
    waitUntil:'domcontentloaded',timeout:60000
  });
  await completeUrbanStartFlow(touchPage);

  const steer=touchPage.locator('#touch-steer-zone');
  const rect=await steer.boundingBox();
  assert(rect&&rect.width>0&&rect.height>0,'touch steering zone is not laid out in landscape mobile viewport');
  const x=rect.x+rect.width*.82,y=rect.y+rect.height*.5;
  await steer.dispatchEvent('pointerdown',{pointerId:41,clientX:x,clientY:y,pointerType:'touch'});
  await touchPage.waitForTimeout(80);
  let diag=await runtime(touchPage);
  assert(Math.abs(diag?.inputState?.touchSteer||0)>.25,'touch steering did not reach semantic input');

  const jump=touchPage.locator('#touch-jump');
  await jump.dispatchEvent('pointerdown',{pointerId:42,pointerType:'touch'});
  await touchPage.waitForTimeout(80);
  diag=await runtime(touchPage);
  assert.equal(diag?.inputState?.touchJump,true,'multi-touch jump was not held while steering');

  await jump.dispatchEvent('pointercancel',{pointerId:42,pointerType:'touch'});
  await steer.dispatchEvent('pointercancel',{pointerId:41,clientX:x,clientY:y,pointerType:'touch'});
  await touchPage.waitForTimeout(80);
  diag=await runtime(touchPage);
  assert.equal(diag?.inputState?.touchJump,false,'touch cancellation left jump stuck');
  assert.equal(diag?.inputState?.touchSteer,0,'touch cancellation left steering stuck');

  const trick=touchPage.locator('[data-touch-trick="360"]');
  await trick.dispatchEvent('pointerdown',{pointerId:43,pointerType:'touch'});
  await touchPage.waitForTimeout(50);
  diag=await runtime(touchPage);
  assert(diag?.inputState?.touchTricks?.includes('360'),'touch trick did not reach semantic input');
  await trick.dispatchEvent('pointerup',{pointerId:43,pointerType:'touch'});

  const powerQueued=await touchPage.evaluate(()=>{
    const button=document.querySelector('#touch-special');
    button?.dispatchEvent(new PointerEvent('pointerdown',{pointerId:44,pointerType:'touch',bubbles:true}));
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.inputState?.specialQueued===true;
  });
  assert.equal(powerQueued,true,'touch Banana Power button did not queue the semantic special action');
  await touchPage.waitForTimeout(120);

  await touchPage.locator('#touch-pause').dispatchEvent('pointerdown',{pointerId:45,pointerType:'touch'});
  await touchPage.waitForFunction(()=>{const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();return d?.mode==='paused';},null,{timeout:5000});

  const landscapeLayout=await touchPage.evaluate(()=>{
    const steer=document.querySelector('#touch-steer-zone')?.getBoundingClientRect();
    const pause=document.querySelector('#touch-pause')?.getBoundingClientRect();
    return {
      steerLeft:steer?.left??-1,
      pauseRight:pause?innerWidth-pause.right:-1
    };
  });
  assert(landscapeLayout.steerLeft>=8,'touch steering ignored the left safe inset');
  assert(landscapeLayout.pauseRight>=8,'touch pause ignored the right safe inset');

  await touchPage.setViewportSize({width:390,height:844});
  await touchPage.waitForTimeout(120);
  const portraitHint=await touchPage.evaluate(()=>{
    const hint=document.querySelector('.touch-orientation-hint');
    if(!hint)return null;
    const css=getComputedStyle(hint);
    return {display:css.display,visibility:css.visibility};
  });
  assert(portraitHint&&portraitHint.display!=='none'&&portraitHint.visibility!=='hidden','portrait orientation hint is not visible');
  await touchPage.setViewportSize({width:844,height:390});
}finally{
  await touchContext.close();
  await browser.close();
}

console.log(JSON.stringify({
  check:'release-input-browser',
  controller:['start A/Cross','analog navigation','D-pad navigation','no double navigation','B/Circle','Start','pause','settings','selector','disconnect/reconnect','crash','results','results restart'],
  touch:['steering','jump','trick','Banana Power','pause','pointercancel','multi-touch','portrait orientation','safe-area inset layout']
}));
