import {migrateUrbanPersistence,readUrbanSetting,writeUrbanSetting} from './urbanPersistence.js';

export const CAMERA_MOTION=Object.freeze({
  AUTO:'auto',
  FULL:'full',
  FIXED:'fixed',
  REDUCED:'reduced'
});

export const CAMERA_VIEW=Object.freeze({
  CHASE:'chase',
  FIXED:'fixed',
  HIGH_FAR:'high-far',
  FIRST_PERSON:'first-person'
});

function normalizedChoice(value,allowed,fallback){
  const normalized=String(value??'').trim().toLowerCase();
  return allowed.includes(normalized)?normalized:fallback;
}

export function loadUserPreferences(){
  migrateUrbanPersistence();
  return {
    avatarName:readUrbanSetting('avatar',''),
    sportMode:normalizedChoice(readUrbanSetting('sportMode','skateboard'),['skateboard','inline','bmx'],'skateboard'),
    rideMode:normalizedChoice(readUrbanSetting('rideMode','ski'),['ski','snowboard'],'ski'),
    quality:normalizedChoice(readUrbanSetting('quality','auto'),['auto','high','max','medium','low'],'auto'),
    cameraMotion:normalizedChoice(readUrbanSetting('cameraMotion',CAMERA_MOTION.FULL),Object.values(CAMERA_MOTION),CAMERA_MOTION.FULL),
    cameraView:normalizedChoice(readUrbanSetting('cameraView',CAMERA_VIEW.CHASE),Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE),
    haptics:readUrbanSetting('haptics','1')!=='0',
    hapticIntensity:normalizedChoice(readUrbanSetting('hapticIntensity','high'),['off','low','medium','high'],'high')
  };
}

export function saveAvatarPreference(name){
  const value=String(name??'').trim();
  return value?writeUrbanSetting('avatar',value):false;
}
export function saveSportPreference(mode){
  return writeUrbanSetting('sportMode',normalizedChoice(mode,['skateboard','inline','bmx'],'skateboard'));
}
export function saveRideModePreference(mode){
  return writeUrbanSetting('rideMode',normalizedChoice(mode,['ski','snowboard'],'ski'));
}
export function saveQualityPreference(mode){
  return writeUrbanSetting('quality',normalizedChoice(mode,['auto','high','max','medium','low'],'auto'));
}
export function saveCameraMotionPreference(mode){
  return writeUrbanSetting('cameraMotion',normalizedChoice(mode,Object.values(CAMERA_MOTION),CAMERA_MOTION.FULL));
}
export function saveCameraViewPreference(mode){
  return writeUrbanSetting('cameraView',normalizedChoice(mode,Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE));
}
export function saveHapticsPreference(enabled){
  return writeUrbanSetting('haptics',enabled?1:0);
}
export function saveHapticIntensityPreference(intensity){
  return writeUrbanSetting('hapticIntensity',normalizedChoice(intensity,['off','low','medium','high'],'high'));
}
export function loadBestScore(fallback=0){
  const value=Number(readUrbanSetting('best',fallback));
  return Number.isFinite(value)&&value>=0?value:Number(fallback)||0;
}
export function saveBestScore(value){
  const normalized=Math.max(0,Number(value)||0);
  return writeUrbanSetting('best',normalized);
}
