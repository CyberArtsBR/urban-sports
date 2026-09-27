export const INPUT_ACTION=Object.freeze({
  STEER_LEFT:'steer-left',
  STEER_RIGHT:'steer-right',
  FORWARD:'forward',
  BACK:'back',
  JUMP:'jump',
  SPECIAL:'special',
  CAMERA:'camera',
  CAMERA_MOTION:'camera-motion',
  PAUSE:'pause',
  CONFIRM:'confirm',
  CANCEL:'cancel'
});

export const GAMEPAD_BUTTON=Object.freeze({
  CONFIRM:0,
  CANCEL:1,
  SPECIAL:2,
  CAMERA:3,
  MENU:9,
  UP:12,
  DOWN:13,
  LEFT:14,
  RIGHT:15
});

const DEFAULT_KEYBOARD=Object.freeze({
  [INPUT_ACTION.STEER_LEFT]:Object.freeze(['ArrowLeft','KeyA']),
  [INPUT_ACTION.STEER_RIGHT]:Object.freeze(['ArrowRight','KeyD']),
  [INPUT_ACTION.FORWARD]:Object.freeze(['ArrowUp','KeyW']),
  [INPUT_ACTION.BACK]:Object.freeze(['ArrowDown','KeyS']),
  [INPUT_ACTION.JUMP]:Object.freeze(['Space']),
  [INPUT_ACTION.SPECIAL]:Object.freeze(['KeyQ']),
  [INPUT_ACTION.CAMERA]:Object.freeze(['KeyE']),
  [INPUT_ACTION.CAMERA_MOTION]:Object.freeze(['KeyR']),
  [INPUT_ACTION.PAUSE]:Object.freeze(['Escape']),
  [INPUT_ACTION.CONFIRM]:Object.freeze(['Enter','NumpadEnter','Space']),
  [INPUT_ACTION.CANCEL]:Object.freeze(['Escape'])
});

const DEFAULT_GAMEPAD=Object.freeze({
  [INPUT_ACTION.JUMP]:GAMEPAD_BUTTON.CONFIRM,
  [INPUT_ACTION.CONFIRM]:GAMEPAD_BUTTON.CONFIRM,
  [INPUT_ACTION.CANCEL]:GAMEPAD_BUTTON.CANCEL,
  [INPUT_ACTION.CAMERA_MOTION]:GAMEPAD_BUTTON.CANCEL,
  [INPUT_ACTION.SPECIAL]:GAMEPAD_BUTTON.SPECIAL,
  [INPUT_ACTION.CAMERA]:GAMEPAD_BUTTON.CAMERA,
  [INPUT_ACTION.PAUSE]:GAMEPAD_BUTTON.MENU
});

export const DEFAULT_ACTION_MAP=Object.freeze({
  keyboard:DEFAULT_KEYBOARD,
  gamepad:DEFAULT_GAMEPAD
});

function normalizeKeys(value,fallback=[]){
  const list=Array.isArray(value)?value:[value];
  const keys=list.map(item=>String(item||'').trim()).filter(Boolean);
  return keys.length?keys:[...fallback];
}

export function createActionMap(overrides={}){
  const keyboard={};
  const gamepad={...DEFAULT_GAMEPAD};
  for(const action of Object.values(INPUT_ACTION)){
    keyboard[action]=normalizeKeys(overrides?.keyboard?.[action],DEFAULT_KEYBOARD[action]||[]);
    const button=Number(overrides?.gamepad?.[action]);
    if(Number.isInteger(button)&&button>=0)gamepad[action]=button;
  }
  return {keyboard,gamepad};
}

export function actionHasKey(map,action,code){
  return !!map?.keyboard?.[action]?.includes?.(String(code||''));
}

export function gamepadButtonFor(map,action,fallback=null){
  const value=Number(map?.gamepad?.[action]);
  return Number.isInteger(value)&&value>=0?value:fallback;
}

export function actionLabel(action,device='keyboard'){
  const labels={
    [INPUT_ACTION.STEER_LEFT]:{keyboard:'A / ←',gamepad:'LEFT STICK / D-PAD'},
    [INPUT_ACTION.STEER_RIGHT]:{keyboard:'D / →',gamepad:'LEFT STICK / D-PAD'},
    [INPUT_ACTION.JUMP]:{keyboard:'SPACE',gamepad:'A / CROSS'},
    [INPUT_ACTION.SPECIAL]:{keyboard:'Q',gamepad:'X / SQUARE'},
    [INPUT_ACTION.CAMERA]:{keyboard:'E',gamepad:'Y / TRIANGLE'},
    [INPUT_ACTION.CAMERA_MOTION]:{keyboard:'R',gamepad:'B / CIRCLE'},
    [INPUT_ACTION.PAUSE]:{keyboard:'ESC',gamepad:'START / MENU'},
    [INPUT_ACTION.CONFIRM]:{keyboard:'ENTER / SPACE',gamepad:'A / CROSS'},
    [INPUT_ACTION.CANCEL]:{keyboard:'ESC',gamepad:'B / CIRCLE'}
  };
  return labels[action]?.[device]||String(action||'').toUpperCase();
}
