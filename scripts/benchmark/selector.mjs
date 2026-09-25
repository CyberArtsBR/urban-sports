import {frameMark,frameSummarySince,pending,round} from './core.mjs';

export async function openSelector(page){
  const mark=await frameMark(page);
  const started=Date.now();
  const opened=await page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    if(dialog?.open)return {ok:true,action:'already-open'};

    const startScreen=document.querySelector('.start-screen');
    const startPlay=startScreen?.querySelector('.start-screen-play');
    const startVisible=!!startScreen&&!startScreen.hidden&&getComputedStyle(startScreen).display!=='none'&&getComputedStyle(startScreen).visibility!=='hidden';
    if(startVisible&&startPlay&&!startPlay.disabled){
      startPlay.click();
      return {ok:true,action:'start-screen'};
    }

    const choose=document.querySelector('#choose');
    if(choose&&!choose.disabled){
      choose.click();
      return {ok:true,action:'choose'};
    }

    return {ok:false,reason:'No enabled selector entry control is available'};
  });
  if(!opened.ok)return {status:'PENDING',reason:opened.reason};

  try{
    await page.waitForFunction(()=>{
      const dialog=document.querySelector('#chimpion-selector');
      return !!dialog?.open&&!!dialog.querySelector('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])');
    },undefined,{timeout:15000});
  }catch{
    return pending((opened.action||'selector entry')+' did not open a ready #chimpion-selector');
  }

  const dom=await selectorDomMetrics(page);
  const frames=await frameSummarySince(page,mark);
  return {status:'PASS',action:opened.action,openTimeMs:round(Date.now()-started,3),frames,...dom};
}

export async function selectorDomMetrics(page){
  return page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    return {
      selectorOpen:!!dialog?.open,
      selectorDomNodes:dialog?dialog.getElementsByTagName('*').length:0,
      cards:dialog?.querySelectorAll('.chimpion-card').length??0,
      enabledBuiltInCards:dialog?.querySelectorAll('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])').length??0,
      images:dialog?.querySelectorAll('img').length??0,
      totalDomNodes:document.getElementsByTagName('*').length,
      imageUrls:dialog?Array.from(dialog.querySelectorAll('img')).map(img=>img.currentSrc||img.src).filter(Boolean):[]
    };
  });
}

export async function closeSelector(page){
  const state=await page.evaluate(()=>{
    const dialog=document.querySelector('#chimpion-selector');
    if(!dialog?.open)return {closed:true};
    const close=dialog.querySelector('.selector-close');
    if(close&&!close.disabled){close.click();return {closed:true};}
    dialog.close();
    return {closed:true};
  });
  try{await page.waitForFunction(()=>!document.querySelector('#chimpion-selector')?.open,undefined,{timeout:5000});}catch{}
  const after=await selectorDomMetrics(page);
  return {...state,after};
}

export async function benchmarkSearch(page,terms){
  const results=[];
  for(const term of terms){
    const result=await page.evaluate(async searchTerm=>{
      const input=document.querySelector('#chimpion-search');
      if(!input)return {status:'PENDING',term:searchTerm,reason:'#chimpion-search unavailable'};
      const started=performance.now();
      input.value=searchTerm;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const dialog=document.querySelector('#chimpion-selector');
      return {
        status:'PASS',
        term:searchTerm,
        updateTimeMs:performance.now()-started,
        cards:dialog?.querySelectorAll('.chimpion-card').length??0,
        enabledBuiltInCards:dialog?.querySelectorAll('.chimpion-card:not(.is-upload-avatar):not([aria-disabled="true"])').length??0,
        images:dialog?.querySelectorAll('img').length??0,
        totalDomNodes:document.getElementsByTagName('*').length
      };
    },term);
    if(Number.isFinite(result.updateTimeMs))result.updateTimeMs=round(result.updateTimeMs,3);
    results.push(result);
  }
  await page.evaluate(()=>{
    const input=document.querySelector('#chimpion-search');
    if(input){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  return results;
}

export async function benchmarkRepeatedSelector(page,iterations,portraitUrls){
  if(iterations<=0)return pending('SELECTOR_ITERATIONS=0');
  const cycles=[];
  for(let i=0;i<iterations;i++){
    if(await page.evaluate(()=>document.querySelector('#chimpion-selector')?.open===true))await closeSelector(page);
    const opened=await openSelector(page);
    if(opened.status!=='PASS')return opened;
    for(const url of opened.imageUrls||[])portraitUrls.add(url);
    const closed=await closeSelector(page);
    cycles.push({
      iteration:i+1,
      entryAction:opened.action,
      openTimeMs:opened.openTimeMs,
      cardsOpen:opened.cards,
      enabledBuiltInCardsOpen:opened.enabledBuiltInCards,
      imagesOpen:opened.images,
      cardsClosed:closed.after.cards,
      imagesClosed:closed.after.images,
      totalDomNodesClosed:closed.after.totalDomNodes
    });
  }
  return {
    status:'PASS',
    iterations:cycles,
    averageOpenTimeMs:round(cycles.reduce((sum,item)=>sum+item.openTimeMs,0)/cycles.length,3),
    maxClosedCards:Math.max(...cycles.map(item=>item.cardsClosed)),
    maxClosedImages:Math.max(...cycles.map(item=>item.imagesClosed))
  };
}
