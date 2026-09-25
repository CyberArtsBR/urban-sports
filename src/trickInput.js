import {TRICK_TYPE} from './trickSystem.js';

export const TRICK_AXIS_THRESHOLD=.45;

export function readTrickIntent(keys,pad={}){
  const keyUp=!!keys?.has?.('ArrowUp')||!!keys?.has?.('KeyW');
  const keyDown=!!keys?.has?.('ArrowDown')||!!keys?.has?.('KeyS');
  const axisY=Number(pad?.axisY)||0;
  const padUp=!!pad?.dpad?.up||axisY<=-TRICK_AXIS_THRESHOLD;
  const padDown=!!pad?.dpad?.down||axisY>=TRICK_AXIS_THRESHOLD;
  const up=keyUp||padUp;
  const back=keyDown||padDown;
  if(up===back)return null;
  // Arcade mapping: UP + Jump spins; BACK/DOWN + Jump backflips.
  // FRONT FLIP intentionally has no normal-control route.
  return up?TRICK_TYPE.SPIN_360:TRICK_TYPE.BACKFLIP;
}

export function readAirborneTrickIntent(keys,pad={}){
  // Directional + Jump keeps the same mapping in air. A plain second airborne
  // Jump remains the arcade shortcut for a 360, subject to airtime gating.
  return readTrickIntent(keys,pad)||TRICK_TYPE.SPIN_360;
}

export function readSkateboardTrickIntent(keys,pad={}, {airborne=false}={}){
  const left=!!keys?.has?.('ArrowLeft')||!!keys?.has?.('KeyA')||!!pad?.dpad?.left||(Number(pad?.axis)||0)<=-TRICK_AXIS_THRESHOLD;
  const right=!!keys?.has?.('ArrowRight')||!!keys?.has?.('KeyD')||!!pad?.dpad?.right||(Number(pad?.axis)||0)>=TRICK_AXIS_THRESHOLD;
  const up=!!keys?.has?.('ArrowUp')||!!keys?.has?.('KeyW')||!!pad?.dpad?.up||(Number(pad?.axisY)||0)<=-TRICK_AXIS_THRESHOLD;
  const down=!!keys?.has?.('ArrowDown')||!!keys?.has?.('KeyS')||!!pad?.dpad?.down||(Number(pad?.axisY)||0)>=TRICK_AXIS_THRESHOLD;
  const shoulderLeft=!!pad?.buttons?.[4];
  const shoulderRight=!!pad?.buttons?.[5];
  const modifier=!!keys?.has?.('ShiftLeft')||!!keys?.has?.('ShiftRight')||shoulderLeft||shoulderRight;
  const advanced=!!keys?.has?.('AltLeft')||!!keys?.has?.('AltRight')||(shoulderLeft&&shoulderRight);

  if(modifier){
    if(advanced){
      if(left&&!right)return TRICK_TYPE.VARIAL_FLIP;
      if(right&&!left)return TRICK_TYPE.TRE_FLIP;
    }
    if(airborne){
      if(left&&!right)return TRICK_TYPE.MELON;
      if(right&&!left)return TRICK_TYPE.NOSEGRAB;
      if(up&&!down)return TRICK_TYPE.KICKFLIP;
      if(down&&!up)return TRICK_TYPE.HEELFLIP;
      return TRICK_TYPE.INDY;
    }
    if(up&&!down)return TRICK_TYPE.KICKFLIP;
    if(down&&!up)return TRICK_TYPE.HEELFLIP;
    if(left&&!right)return TRICK_TYPE.POP_SHOVE_IT;
    if(right&&!left)return TRICK_TYPE.FRONTSIDE_SHOVE_IT;
    return TRICK_TYPE.KICKFLIP;
  }

  if((left&&!right)||(right&&!left))return TRICK_TYPE.SPIN_180;
  return airborne?readAirborneTrickIntent(keys,pad):readTrickIntent(keys,pad);
}
