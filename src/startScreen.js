import {MENU_ACTION,createMenuFocusController,menuActionFromKeyboardEvent} from './menuNavigation.js';
import {createMenuInputRepeat} from './menuInputRepeat.js';
import {defaultLocalization} from './localization.js';

const GAME_SELECTION_URL='https://chimp-jump.onrender.com/';

export function createStartScreen({
  audio,
  onStart,
  assetUrl='/start/chimpions-urban-sports-start.webp',
  transitionMs=300,
  localization=defaultLocalization
}={}){
  const t=(key,fallback)=>localization?.t?.(key,fallback)||fallback;
  const root=document.createElement('section');
  root.className='start-screen is-loading';
  root.setAttribute('aria-label',t('start.title','Chimpions Urban Sports start screen'));
  root.innerHTML=`
    <div class="start-screen-stage">
      <img class="start-screen-art" src="${assetUrl}" alt="" aria-hidden="true" width="1600" height="900" decoding="async" fetchpriority="high" draggable="false" />
      <nav class="start-screen-actions" aria-label="Main menu">
        <button class="start-screen-hit start-screen-play" type="button" data-menu-default="true" disabled><span>${t('start.start','START GAME')}</span></button>
        <a class="start-screen-hit start-screen-back" href="${GAME_SELECTION_URL}"><span>${t('start.back','BACK TO GAME SELECTION')}</span></a>
      </nav>
      <div class="start-screen-status" role="status" aria-live="polite">${t('start.loading','Loading start screen…')}</div>
    </div>
  `;
  document.body.append(root);
  document.body.classList.add('start-screen-active');

  const art=root.querySelector('.start-screen-art');
  const play=root.querySelector('.start-screen-play');
  const back=root.querySelector('.start-screen-back');
  const status=root.querySelector('.start-screen-status');
  let chimpionReady=false;
  let artReady=art.complete&&art.naturalWidth>0;
  let artFailed=false;
  let closing=false;

  const items=()=>[play,back].filter(element=>element&&!element.disabled&&!element.hidden);
  const focus=createMenuFocusController({
    getRoot:()=>root,
    getItems:items,
    onMove:()=>audio?.play?.('menu',.12),
    onCancel:()=>back?.click?.(),
    onMenu:()=>start()
  });
  const repeat=createMenuInputRepeat({
    adapter:{
      move(direction){
        const action=(direction==='up'||direction==='left')?MENU_ACTION.UP:MENU_ACTION.DOWN;
        focus.handle(action,{root});
      },
      confirm(){focus.handle(MENU_ACTION.CONFIRM,{root});},
      cancel(){back?.click?.();},
      menu(){start();}
    }
  });

  function refreshReady(){
    const ready=chimpionReady&&artReady&&!artFailed;
    play.disabled=!ready;
    root.classList.toggle('is-loading',!ready);
    if(artFailed)status.textContent='Start artwork unavailable';
    else if(!artReady)status.textContent=t('start.loading','Loading start screen…');
    else if(!chimpionReady)status.textContent=t('start.riderLoading','Loading Chimpion…');
    else status.textContent=t('start.ready','ENTER / A · START GAME');
    if(ready&&root.isConnected&&!root.hidden&&(document.activeElement===document.body||!root.contains(document.activeElement))){
      requestAnimationFrame(()=>{if(!play.disabled&&!root.hidden)focus.focus(play);});
    }
    return ready;
  }

  art.addEventListener('load',()=>{
    artReady=true;artFailed=false;root.classList.add('is-art-ready');refreshReady();
  },{once:true});
  art.addEventListener('error',()=>{artReady=false;artFailed=true;refreshReady();},{once:true});
  if(artReady)root.classList.add('is-art-ready');

  function setReady(value){chimpionReady=!!value;refreshReady();}

  function start(){
    if(play.disabled||closing||root.hidden)return false;
    closing=true;
    repeat.reset();
    audio?.unlock?.();
    root.classList.add('is-leaving');
    const retireArtwork=()=>{
      root.hidden=true;
      document.body.classList.remove('start-screen-active');
      const started=onStart?.();
      if(started===false){
        root.hidden=false;
        document.body.classList.add('start-screen-active');
        closing=false;
        root.classList.remove('is-leaving');
        refreshReady();
        repeat.reset();
        return false;
      }
      return true;
    };
    const delay=Math.max(0,Number(transitionMs)||0);
    if(delay>0)setTimeout(retireArtwork,delay); else retireArtwork();
    return true;
  }

  play.addEventListener('click',start);
  back.addEventListener('click',()=>audio?.play?.('button',.18));
  root.addEventListener('focusin',event=>focus.syncFromFocus(event.target));
  root.addEventListener('keydown',event=>{
    if(event.repeat||closing)return;
    if(event.key==='Tab'){
      if(focus.trapTab?.(event,{root}))return;
    }
    const action=menuActionFromKeyboardEvent(event);
    if(!action)return;
    if(action===MENU_ACTION.CANCEL){event.preventDefault();back.click();return;}
    if(focus.handle(action,{root})){event.preventDefault();event.stopPropagation();}
  });

  function updateController(pad={}){
    if(root.hidden||closing){
      repeat.reset();
      return false;
    }
    const events=repeat.update(pad);
    return events.length>0;
  }

  refreshReady();

  return {
    setReady,
    updateController,
    start,
    get isActive(){return !root.hidden;},
    get isReady(){return !play.disabled;},
    gameSelectionUrl:GAME_SELECTION_URL
  };
}
