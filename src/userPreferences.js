import {migrateUrbanPersistence,readUrbanSetting,writeUrbanSetting} from './urbanPersistence.js';
import {ACCESSIBILITY_DEFAULTS,normalizeAccessibilityPreferences} from './uiAccessibility.js';
import {LOCALE} from './localization.js';

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
  const namedHaptic=normalizedChoice(readUrbanSetting('hapticIntensity','high'),['off','low','medium','high'],'high');
  const namedHapticScale={off:0,low:.35,medium:.7,high:1}[namedHaptic]??1;
  const accessibility=normalizeAccessibilityPreferences({
    uiScale:readUrbanSetting('uiScale',ACCESSIBILITY_DEFAULTS.uiScale),
    highContrast:readUrbanSetting('highContrast',ACCESSIBILITY_DEFAULTS.highContrast?1:0)!=='0',
    reducedMotion:readUrbanSetting('reducedMotion',ACCESSIBILITY_DEFAULTS.reducedMotion),
    reducedVfx:readUrbanSetting('reducedVfx',ACCESSIBILITY_DEFAULTS.reducedVfx?1:0)!=='0',
    reducedFlashes:readUrbanSetting('reducedFlashes',ACCESSIBILITY_DEFAULTS.reducedFlashes?1:0)!=='0',
    cameraShake:readUrbanSetting('cameraShake',ACCESSIBILITY_DEFAULTS.cameraShake),
    controllerDeadzone:readUrbanSetting('controllerDeadzone',ACCESSIBILITY_DEFAULTS.controllerDeadzone),
    steeringSensitivity:readUrbanSetting('steeringSensitivity',ACCESSIBILITY_DEFAULTS.steeringSensitivity),
    hapticsIntensity:readUrbanSetting('hapticsIntensity',namedHapticScale),
    captions:readUrbanSetting('captions',ACCESSIBILITY_DEFAULTS.captions?1:0)!=='0'
  });
  const localeRaw=readUrbanSetting('locale',LOCALE.AUTO);
  const locale=[LOCALE.AUTO,LOCALE.EN_US,LOCALE.PT_BR].includes(localeRaw)?localeRaw:LOCALE.AUTO;
  return {
    avatarName:readUrbanSetting('avatar',''),
    sportMode:normalizedChoice(readUrbanSetting('sportMode','skateboard'),['skateboard','inline','bmx'],'skateboard'),
    rideMode:normalizedChoice(readUrbanSetting('rideMode','ski'),['ski','snowboard'],'ski'),
    quality:normalizedChoice(readUrbanSetting('quality','auto'),['auto','high','max','medium','low'],'auto'),
    cameraMotion:normalizedChoice(readUrbanSetting('cameraMotion',CAMERA_MOTION.FULL),Object.values(CAMERA_MOTION),CAMERA_MOTION.FULL),
    cameraView:normalizedChoice(readUrbanSetting('cameraView',CAMERA_VIEW.CHASE),Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE),
    haptics:readUrbanSetting('haptics','1')!=='0',
    hapticIntensity:namedHaptic,
    locale,
    ...accessibility
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
export function saveUiScalePreference(value){return writeUrbanSetting('uiScale',normalizeAccessibilityPreferences({uiScale:value}).uiScale);}
export function saveHighContrastPreference(value){return writeUrbanSetting('highContrast',value?1:0);}
export function saveReducedMotionPreference(value){
  const normalized=['system','on','off'].includes(String(value).toLowerCase())?String(value).toLowerCase():'system';
  return writeUrbanSetting('reducedMotion',normalized);
}
export function saveReducedVfxPreference(value){return writeUrbanSetting('reducedVfx',value?1:0);}
export function saveReducedFlashesPreference(value){return writeUrbanSetting('reducedFlashes',value?1:0);}
export function saveCameraShakePreference(value){return writeUrbanSetting('cameraShake',normalizeAccessibilityPreferences({cameraShake:value}).cameraShake);}
export function saveControllerDeadzonePreference(value){return writeUrbanSetting('controllerDeadzone',normalizeAccessibilityPreferences({controllerDeadzone:value}).controllerDeadzone);}
export function saveSteeringSensitivityPreference(value){return writeUrbanSetting('steeringSensitivity',normalizeAccessibilityPreferences({steeringSensitivity:value}).steeringSensitivity);}
export function saveHapticsIntensityPreference(value){
  const normalized=normalizeAccessibilityPreferences({hapticsIntensity:value}).hapticsIntensity;
  writeUrbanSetting('hapticsIntensity',normalized);
  const named=normalized<=.01?'off':normalized<.51?'low':normalized<.84?'medium':'high';
  writeUrbanSetting('hapticIntensity',named);
  return true;
}
export function saveCaptionsPreference(value){return writeUrbanSetting('captions',value?1:0);}
export function saveLocalePreference(value){
  const normalized=[LOCALE.AUTO,LOCALE.EN_US,LOCALE.PT_BR].includes(value)?value:LOCALE.AUTO;
  return writeUrbanSetting('locale',normalized);
}
export function loadBestScore(fallback=0){
  const value=Number(readUrbanSetting('best',fallback));
  return Number.isFinite(value)&&value>=0?value:Number(fallback)||0;
}
export function saveBestScore(value){
  const normalized=Math.max(0,Number(value)||0);
  return writeUrbanSetting('best',normalized);
}
