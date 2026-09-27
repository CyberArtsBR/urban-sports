import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

export const CHROMIUM_ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];

export function releaseTargetUrl(base,{quality='high',seed='release-hardening',weather='',graphicsFault=''}={}){
  const url=new URL(base);
  url.searchParams.set('test','1');
  url.searchParams.set('quality',quality);
  url.searchParams.set('seed',seed);
  if(weather)url.searchParams.set('weather',weather);
  if(graphicsFault)url.searchParams.set('graphicsFault',graphicsFault);
  return url.toString();
}

export async function launchReleaseBrowser(){
  return chromium.launch({headless:true,args:CHROMIUM_ARGS});
}

export async function runtime(page){
  return page.evaluate(()=>{
    try{return window.chimpionsUrbanSports?.()??window.chimpionsSki?.()??null;}catch{return null;}
  });
}

async function dismissTutorial(page){
  const tutorial=page.locator('.session-tutorial:not([hidden])');
  if(!await tutorial.isVisible().catch(()=>false))return;
  await page.mouse.click(24,24).catch(()=>{});
  await tutorial.waitFor({state:'hidden',timeout:3000}).catch(async()=>{
    await page.keyboard.press('Enter').catch(()=>{});
    await tutorial.waitFor({state:'hidden',timeout:3000}).catch(()=>{});
  });
}

export async function completeUrbanStartFlow(page){
  await page.waitForFunction(()=>(
    window.chimpionsUrbanSports?.()?.ready===true||
    window.chimpionsSki?.()?.ready===true
  ),null,{timeout:60000});

  const play=page.locator('.start-screen-play');
  await play.waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('.start-screen-play')?.disabled,null,{timeout:30000});
  await play.evaluate(element=>element.click());

  const selector=page.locator('#chimpion-selector');
  await selector.waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    return !!dialog?.querySelector('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])');
  },null,{timeout:30000});

  const avatar=selector.locator('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])').first();
  await avatar.evaluate(element=>element.click());

  await page.waitForFunction(()=>!document.querySelector('#ride-mode-step')?.hidden,null,{timeout:20000});
  const ride=selector.locator('[data-sport-mode="skateboard"]:not([aria-disabled="true"]),.ride-mode-card[data-ride-mode="skateboard"]:not([aria-disabled="true"]),.ride-mode-card[data-ride-mode="snowboard"]:not([aria-disabled="true"])').first();
  assert(await ride.count()>0,'No Skateboard-compatible ride control is available');
  await ride.evaluate(element=>element.click());

  await page.waitForFunction(()=>!document.querySelector('#chimpion-selector')?.open,null,{timeout:60000});
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return !!document.querySelector('.session-tutorial:not([hidden])')||d?.mode==='countdown'||d?.mode==='playing';
  },null,{timeout:25000});
  await dismissTutorial(page);
  await page.waitForFunction(()=>{
    const d=window.chimpionsUrbanSports?.()??window.chimpionsSki?.();
    return d?.mode==='playing';
  },null,{timeout:60000});

  const state=await runtime(page);
  assert.equal(state?.mode,'playing','gameplay did not start');
  assert.equal(state?.sportMode,'skateboard','release browser test left Urban skateboard mode');
  return state;
}

export async function sampleMeaningfulCanvas(page,{sampleSize=64}={}){
  return page.evaluate(async size=>{
    const canvas=document.querySelector('canvas');
    if(!canvas)return {ok:false,reason:'missing-canvas'};
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const out=document.createElement('canvas');
    out.width=size;out.height=size;
    const ctx=out.getContext('2d',{willReadFrequently:true});
    if(!ctx)return {ok:false,reason:'missing-2d-context'};
    try{
      ctx.drawImage(canvas,0,0,size,size);
      const data=ctx.getImageData(0,0,size,size).data;
      let nonBlack=0,nonTransparent=0,minLuma=255,maxLuma=0,lumaTotal=0;
      const buckets=new Set();
      const pixels=size*size;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        const luma=.2126*r+.7152*g+.0722*b;
        if(a>8)nonTransparent++;
        if(r+g+b>18)nonBlack++;
        minLuma=Math.min(minLuma,luma);
        maxLuma=Math.max(maxLuma,luma);
        lumaTotal+=luma;
        buckets.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
      }
      const css=getComputedStyle(canvas);
      return {
        ok:true,
        width:canvas.width,
        height:canvas.height,
        clientWidth:canvas.clientWidth,
        clientHeight:canvas.clientHeight,
        display:css.display,
        visibility:css.visibility,
        nonBlackRatio:nonBlack/pixels,
        nonTransparentRatio:nonTransparent/pixels,
        lumaRange:maxLuma-minLuma,
        meanLuma:lumaTotal/pixels,
        colorBuckets:buckets.size
      };
    }catch(error){
      return {ok:false,reason:'canvas-sample-failed',error:String(error?.message||error)};
    }
  },sampleSize);
}

export function assertMeaningfulCanvas(sample,label='gameplay'){
  assert.equal(sample?.ok,true,`${label}: canvas sampling failed: ${JSON.stringify(sample)}`);
  assert(sample.width>=320&&sample.height>=180,`${label}: WebGL canvas backing buffer is unexpectedly small`);
  assert(sample.clientWidth>0&&sample.clientHeight>0,`${label}: canvas has no visible layout area`);
  assert.notEqual(sample.display,'none',`${label}: canvas is display:none`);
  assert.notEqual(sample.visibility,'hidden',`${label}: canvas is hidden`);
  assert(sample.nonTransparentRatio>.95,`${label}: canvas output is mostly transparent`);
  assert(sample.nonBlackRatio>.08,`${label}: rendered gameplay is effectively black (${(sample.nonBlackRatio*100).toFixed(2)}% non-black)`);
  assert(sample.lumaRange>12,`${label}: rendered gameplay has no meaningful luminance range`);
  assert(sample.colorBuckets>=8,`${label}: rendered gameplay has insufficient color diversity`);
}

export async function exerciseContextLoss(page){
  return page.evaluate(async()=>{
    const canvas=document.querySelector('canvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const ext=gl?.getExtension?.('WEBGL_lose_context');
    if(!canvas||!gl||!ext)return {supported:false};

    const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',()=>resolve(true),{once:true}));
    ext.loseContext();
    await Promise.race([lost,new Promise(resolve=>setTimeout(()=>resolve(false),3000))]);

    await new Promise(resolve=>setTimeout(resolve,80));
    const restored=new Promise(resolve=>canvas.addEventListener('webglcontextrestored',()=>resolve(true),{once:true}));
    ext.restoreContext();
    const restoredEvent=await Promise.race([restored,new Promise(resolve=>setTimeout(()=>resolve(false),6000))]);
    return {supported:true,restoredEvent};
  });
}
