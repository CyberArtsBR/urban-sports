import {INPUT_ACTION,actionLabel} from './actionMap.js';

export const CONTROL_COPY=Object.freeze({
  carve:`${actionLabel(INPUT_ACTION.STEER_LEFT,'keyboard')} / ${actionLabel(INPUT_ACTION.STEER_LEFT,'gamepad')}`,
  jump:`${actionLabel(INPUT_ACTION.JUMP,'keyboard')} / ${actionLabel(INPUT_ACTION.JUMP,'gamepad')}`,
  pause:`${actionLabel(INPUT_ACTION.PAUSE,'keyboard')} / ${actionLabel(INPUT_ACTION.PAUSE,'gamepad')}`,
  special:`${actionLabel(INPUT_ACTION.SPECIAL,'keyboard')} / ${actionLabel(INPUT_ACTION.SPECIAL,'gamepad')} · BANANA POWER`,
  camera:`${actionLabel(INPUT_ACTION.CAMERA,'keyboard')} / ${actionLabel(INPUT_ACTION.CAMERA,'gamepad')}`,
  cameraMotion:`${actionLabel(INPUT_ACTION.CAMERA_MOTION,'keyboard')} / ${actionLabel(INPUT_ACTION.CAMERA_MOTION,'gamepad')}`,
  confirm:`${actionLabel(INPUT_ACTION.CONFIRM,'keyboard')} / ${actionLabel(INPUT_ACTION.CONFIRM,'gamepad')}`,
  cancel:`${actionLabel(INPUT_ACTION.CANCEL,'keyboard')} / ${actionLabel(INPUT_ACTION.CANCEL,'gamepad')}`,
  trick360:'↑ / W + JUMP = 360',
  trickBackflip:'↓ / S + JUMP = BACKFLIP',
  controllerTrick:'D-PAD / STICK + A uses the same directions'
});
