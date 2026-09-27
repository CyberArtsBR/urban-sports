import {TRICK_TYPE} from './trickSystem.js';
import {readSkateboardTrickIntent} from './trickInput.js';
import {DEFAULT_ACTION_MAP,INPUT_ACTION,actionHasKey,createActionMap} from './actionMap.js';

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const clamp=(value,min=-1,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function editableTarget(target){return !!target?.closest?.(EDITABLE);}

export function createGameplayInput({
  windowRef=globalThis.window,
  documentRef=globalThis.document,
  actionMap=DEFAULT_ACTION_MAP,
  steeringSensitivity=1
}={}){
  const map=actionMap===DEFAULT_ACTION_MAP?createActionMap():createActionMap(actionMap);
  const keys=new Set();
  const touchTricks=new Set();
  let touchSteer=0;
  let touchJump=false;
  let jumpQueued=false;
  let specialQueued=false;
  let cameraQueued=false;
  let cameraMotionQueued=false;
  let pauseQueued=false;
  let touchTrickIntent=null;
  let steerSensitivity=clamp(steeringSensitivity,.65,1.5);

  const matches=(action,code)=>actionHasKey(map,action,code);
  const anyHeld=action=>(map.keyboard[action]||[]).some(code=>keys.has(code));

  function onKeyDown(event){
    if(editableTarget(event.target))return;
    keys.add(event.code);
    if(matches(INPUT_ACTION.JUMP,event.code)&&!event.repeat){jumpQueued=true;event.preventDefault?.();}
    if(matches(INPUT_ACTION.SPECIAL,event.code)&&!event.repeat)specialQueued=true;
    if(matches(INPUT_ACTION.CAMERA,event.code)&&!event.repeat)cameraQueued=true;
    if(matches(INPUT_ACTION.CAMERA_MOTION,event.code)&&!event.repeat)cameraMotionQueued=true;
    if(matches(INPUT_ACTION.PAUSE,event.code)&&!event.repeat)pauseQueued=true;
  }
  function onKeyUp(event){keys.delete(event.code);}
  function setTouchSteer(value){touchSteer=clamp(value);}
  function setTouchJump(pressed){
    const next=!!pressed;
    if(next&&!touchJump)jumpQueued=true;
    touchJump=next;
  }
  function setTouchTrick(type,pressed){
    const normalized=type===TRICK_TYPE.BACKFLIP?TRICK_TYPE.BACKFLIP:TRICK_TYPE.SPIN_360;
    if(pressed){
      if(!touchTricks.has(normalized)){
        touchTricks.add(normalized);
        touchTrickIntent=normalized;
        jumpQueued=true;
      }
    }else touchTricks.delete(normalized);
  }
  function requestSpecial(){specialQueued=true;}
  function requestPause(){pauseQueued=true;}
  function setSteeringSensitivity(value){steerSensitivity=clamp(value,.65,1.5);return steerSensitivity;}
  function resetTransient(){
    touchSteer=0;touchJump=false;touchTricks.clear();touchTrickIntent=null;
    jumpQueued=false;specialQueued=false;cameraQueued=false;cameraMotionQueued=false;pauseQueued=false;keys.clear();
  }
  function read(pad={}){
    const keyboardSteer=Number(anyHeld(INPUT_ACTION.STEER_RIGHT))-Number(anyHeld(INPUT_ACTION.STEER_LEFT));
    const rawSteer=Math.abs(touchSteer)>.01?touchSteer:(keyboardSteer||Number(pad.axis)||0);
    const steer=clamp(rawSteer*steerSensitivity);
    const keyboardVertical=Number(anyHeld(INPUT_ACTION.BACK))-Number(anyHeld(INPUT_ACTION.FORWARD));
    const verticalIntent=clamp(keyboardVertical||Number(pad.axisY)||0);
    const trickModifier=keys.has('ShiftLeft')||keys.has('ShiftRight')||!!pad?.buttons?.[4]||!!pad?.buttons?.[5];
    const padJumpPressed=!!pad?.edges?.pressed?.jump;
    const jumpPressed=jumpQueued||padJumpPressed;
    const jumpHeld=touchJump||touchTricks.size>0||anyHeld(INPUT_ACTION.JUMP)||!!pad.jump;
    const authoredTrick=touchTrickIntent;
    const trickIntent=authoredTrick||(jumpPressed?readSkateboardTrickIntent(keys,pad,{airborne:false}):null);
    const airborneTrickIntent=authoredTrick||(jumpPressed?readSkateboardTrickIntent(keys,pad,{airborne:true}):null);
    const specialPressed=specialQueued||!!pad?.edges?.pressed?.special;
    const cameraPressed=cameraQueued||!!pad?.edges?.pressed?.camera;
    const cameraMotionPressed=cameraMotionQueued||!!pad?.edges?.pressed?.cameraMotion;
    const pausePressed=pauseQueued||!!pad?.edges?.pressed?.menu;

    jumpQueued=false;specialQueued=false;cameraQueued=false;cameraMotionQueued=false;pauseQueued=false;touchTrickIntent=null;

    return {
      steer,verticalIntent,trickModifier,jumpPressed,jumpHeld,trickIntent,airborneTrickIntent,
      specialPressed,cameraPressed,cameraMotionPressed,pausePressed,
      keyboardActive:keyboardSteer!==0||keyboardVertical!==0||anyHeld(INPUT_ACTION.JUMP)||keys.has('ShiftLeft')||keys.has('ShiftRight')||anyHeld(INPUT_ACTION.SPECIAL)||anyHeld(INPUT_ACTION.CAMERA)||anyHeld(INPUT_ACTION.CAMERA_MOTION),
      touchActive:Math.abs(touchSteer)>.01||touchJump||touchTricks.size>0,
      keys
    };
  }
  function getDiagnostics(){
    return {keyboardKeys:[...keys],touchSteer,touchJump,specialQueued,cameraQueued,cameraMotionQueued,touchTricks:[...touchTricks],steeringSensitivity:steerSensitivity};
  }

  windowRef?.addEventListener?.('keydown',onKeyDown);
  windowRef?.addEventListener?.('keyup',onKeyUp);
  windowRef?.addEventListener?.('blur',resetTransient);
  documentRef?.addEventListener?.('visibilitychange',()=>{if(documentRef.hidden)resetTransient();});

  return {keys,read,setTouchSteer,setTouchJump,setTouchTrick,requestSpecial,requestPause,setSteeringSensitivity,resetTransient,getDiagnostics};
}
