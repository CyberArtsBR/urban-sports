import {TRICK_TYPE} from './trickSystem.js';
import {defaultLocalization} from './localization.js';

const clamp=(value,min=-1,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export function createTouchControls({
  onSteer=()=>{},
  onJump=()=>{},
  onTrick=()=>{},
  onSpecial=()=>{},
  onPause=()=>{},
  windowRef=globalThis.window,
  documentRef=globalThis.document,
  localization=defaultLocalization
}={}){
  const t=(key,fallback)=>localization?.t?.(key,fallback)||fallback;
  const root=documentRef.createElement('div');
  root.id='touch-controls';
  root.className='touch-controls';
  root.setAttribute('role','group');
  root.setAttribute('aria-label','Touch gameplay controls');
  root.innerHTML=`
    <div class="touch-steer-zone" id="touch-steer-zone" role="application" aria-label="${t('touch.steer','STEER')}">
      <div class="touch-steer-base"><div class="touch-steer-knob" id="touch-steer-knob"></div></div>
      <span>${t('touch.steer','STEER')}</span>
    </div>
    <div class="touch-action-cluster" role="group" aria-label="Jump, trick and Banana Power controls">
      <button type="button" class="touch-action touch-trick" data-touch-trick="360" aria-label="360 trick">360</button>
      <button type="button" class="touch-action touch-trick" data-touch-trick="backflip" aria-label="Backflip trick">${t('touch.flip','FLIP')}</button>
      <button type="button" class="touch-action touch-special" id="touch-special" aria-label="Banana Power">${t('touch.power','POWER')}</button>
      <button type="button" class="touch-action touch-jump" id="touch-jump" aria-label="${t('touch.jump','JUMP')}">${t('touch.jump','JUMP')}</button>
    </div>
    <button type="button" class="touch-pause" id="touch-pause" aria-label="${t('touch.pause','Pause game')}">Ⅱ</button>
    <div class="touch-orientation-hint" role="status">${t('touch.rotate','ROTATE TO LANDSCAPE FOR BETTER CONTROL')}</div>
  `;
  documentRef.body.append(root);

  const steerZone=root.querySelector('#touch-steer-zone');
  const steerKnob=root.querySelector('#touch-steer-knob');
  const jump=root.querySelector('#touch-jump');
  const special=root.querySelector('#touch-special');
  const pause=root.querySelector('#touch-pause');
  let steerPointer=null;
  const heldPointers=new Map();

  function updateSteer(event){
    const rect=steerZone.getBoundingClientRect();
    const center=rect.left+rect.width*.5;
    const radius=Math.max(36,rect.width*.34);
    const value=clamp((event.clientX-center)/radius);
    steerKnob.style.setProperty('--touch-steer-x',`${Math.round(value*34)}px`);
    onSteer(value);
  }
  function releaseSteer(event){
    if(steerPointer!==event.pointerId)return;
    steerPointer=null;
    try{steerZone.releasePointerCapture(event.pointerId);}catch{}
    steerKnob.style.setProperty('--touch-steer-x','0px');
    onSteer(0);
  }
  steerZone.addEventListener('pointerdown',event=>{
    if(steerPointer!==null)return;
    steerPointer=event.pointerId;
    if(event.isTrusted)steerZone.setPointerCapture?.(event.pointerId);
    updateSteer(event);
    event.preventDefault();
  });
  steerZone.addEventListener('pointermove',event=>{if(steerPointer===event.pointerId){updateSteer(event);event.preventDefault();}});
  steerZone.addEventListener('pointerup',releaseSteer);
  steerZone.addEventListener('pointercancel',releaseSteer);

  function bindHold(button,onChange){
    button.addEventListener('pointerdown',event=>{
      heldPointers.set(event.pointerId,{button,onChange});
      if(event.isTrusted)button.setPointerCapture?.(event.pointerId);
      button.classList.add('is-held');
      onChange(true);
      event.preventDefault();
    });
    const release=event=>{
      const held=heldPointers.get(event.pointerId);
      if(!held||held.button!==button)return;
      heldPointers.delete(event.pointerId);
      button.classList.remove('is-held');
      try{button.releasePointerCapture(event.pointerId);}catch{}
      onChange(false);
    };
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',release);
  }

  bindHold(jump,onJump);
  for(const button of root.querySelectorAll('[data-touch-trick]')){
    const type=button.dataset.touchTrick==='backflip'?TRICK_TYPE.BACKFLIP:TRICK_TYPE.SPIN_360;
    bindHold(button,pressed=>onTrick(type,pressed));
  }
  special.addEventListener('pointerdown',event=>{onSpecial();event.preventDefault();});
  pause.addEventListener('pointerdown',event=>{onPause();event.preventDefault();});

  function reset(){
    steerPointer=null;
    heldPointers.clear();
    steerKnob.style.setProperty('--touch-steer-x','0px');
    root.querySelectorAll('.is-held').forEach(element=>element.classList.remove('is-held'));
    onSteer(0);onJump(false);
    onTrick(TRICK_TYPE.SPIN_360,false);
    onTrick(TRICK_TYPE.BACKFLIP,false);
  }
  windowRef?.addEventListener?.('blur',reset);
  documentRef?.addEventListener?.('visibilitychange',()=>{if(documentRef.hidden)reset();});

  return {root,reset};
}
