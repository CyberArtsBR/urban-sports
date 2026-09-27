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

const KEYS=Object.freeze({
  avatar:'chimpions-urban-avatar',
  rideMode:'chimpions-urban-compat-ride-mode',
  quality:'chimpions-urban-quality',
  cameraMotion:'chimpions-urban-camera-motion',
  cameraView:'chimpions-urban-camera-view',
  haptics:'chimpions-urban-haptics-enabled',
  uiScale:'chimpions-urban-ui-scale',
  highContrast:'chimpions-urban-high-contrast',
  reducedMotion:'chimpions-urban-reduced-motion',
  reducedVfx:'chimpions-urban-reduced-vfx',
  reducedFlashes:'chimpions-urban-reduced-flashes',
  cameraShake:'chimpions-urban-camera-shake',
  controllerDeadzone:'chimpions-urban-controller-deadzone',
  steeringSensitivity:'chimpions-urban-steering-sensitivity',
  hapticsIntensity:'chimpions-urban-haptics-intensity',
  captions:'chimpions-urban-captions',
  locale:'chimpions-urban-locale'
});

const LEGACY_KEYS=Object.freeze({
  avatar:'chimpions-ski-avatar',
  rideMode:'chimpions-ski-ride-mode',
  quality:'chimpions-ski-quality',
  cameraMotion:'chimpions-ski-camera-motion',
  cameraView:'chimpions-ski-camera-view',
  haptics:'chimpions-ski-haptics-enabled'
});

function read(key,fallback=''){
  try{
    const value=globalThis.localStorage?.getItem(key);
    return value==null?fallback:value;
  }catch{
    return fallback;
  }
}
function readCompat(key,legacyKey,fallback=''){
  const value=read(key,'');
  return value!==''?value:(legacyKey?read(legacyKey,fallback):fallback);
}
function write(key,value){
  try{
    globalThis.localStorage?.setItem(key,String(value));
    return true;
  }catch{
    return false;
  }
}
function normalizedChoice(value,allowed,fallback){
  const normalized=String(value??'').trim().toLowerCase();
  return allowed.includes(normalized)?normalized:fallback;
}
function readBool(key,fallback=false){
  const value=read(key,'');
  if(value==='')return !!fallback;
  return value!=='0'&&value!=='false';
}
function readNumber(key,fallback){
  const value=Number(read(key,''));
  return Number.isFinite(value)?value:fallback;
}

export function loadUserPreferences(){
  const accessibility=normalizeAccessibilityPreferences({
    uiScale:readNumber(KEYS.uiScale,ACCESSIBILITY_DEFAULTS.uiScale),
    highContrast:readBool(KEYS.highContrast,ACCESSIBILITY_DEFAULTS.highContrast),
    reducedMotion:read(KEYS.reducedMotion,ACCESSIBILITY_DEFAULTS.reducedMotion),
    reducedVfx:readBool(KEYS.reducedVfx,ACCESSIBILITY_DEFAULTS.reducedVfx),
    reducedFlashes:readBool(KEYS.reducedFlashes,ACCESSIBILITY_DEFAULTS.reducedFlashes),
    cameraShake:readNumber(KEYS.cameraShake,ACCESSIBILITY_DEFAULTS.cameraShake),
    controllerDeadzone:readNumber(KEYS.controllerDeadzone,ACCESSIBILITY_DEFAULTS.controllerDeadzone),
    steeringSensitivity:readNumber(KEYS.steeringSensitivity,ACCESSIBILITY_DEFAULTS.steeringSensitivity),
    hapticsIntensity:readNumber(KEYS.hapticsIntensity,ACCESSIBILITY_DEFAULTS.hapticsIntensity),
    captions:readBool(KEYS.captions,ACCESSIBILITY_DEFAULTS.captions)
  });
  const localeRaw=read(KEYS.locale,LOCALE.AUTO);
  const locale=[LOCALE.AUTO,LOCALE.EN_US,LOCALE.PT_BR].includes(localeRaw)?localeRaw:LOCALE.AUTO;
  return {
    avatarName:readCompat(KEYS.avatar,LEGACY_KEYS.avatar,''),
    rideMode:normalizedChoice(readCompat(KEYS.rideMode,LEGACY_KEYS.rideMode,'ski'),['ski','snowboard'],'ski'),
    quality:normalizedChoice(readCompat(KEYS.quality,LEGACY_KEYS.quality,'auto'),['auto','high','max','medium','low'],'auto'),
    cameraMotion:normalizedChoice(readCompat(KEYS.cameraMotion,LEGACY_KEYS.cameraMotion,CAMERA_MOTION.AUTO),Object.values(CAMERA_MOTION),CAMERA_MOTION.AUTO),
    cameraView:normalizedChoice(readCompat(KEYS.cameraView,LEGACY_KEYS.cameraView,CAMERA_VIEW.CHASE),Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE),
    haptics:readCompat(KEYS.haptics,LEGACY_KEYS.haptics,'1')!=='0',
    locale,
    ...accessibility
  };
}

export function saveAvatarPreference(name){
  const value=String(name??'').trim();
  return value?write(KEYS.avatar,value):false;
}
export function saveRideModePreference(mode){return write(KEYS.rideMode,normalizedChoice(mode,['ski','snowboard'],'ski'));}
export function saveQualityPreference(mode){return write(KEYS.quality,normalizedChoice(mode,['auto','high','max','medium','low'],'auto'));}
export function saveCameraMotionPreference(mode){return write(KEYS.cameraMotion,normalizedChoice(mode,Object.values(CAMERA_MOTION),CAMERA_MOTION.FULL));}
export function saveCameraViewPreference(mode){return write(KEYS.cameraView,normalizedChoice(mode,Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE));}
export function saveHapticsPreference(enabled){return write(KEYS.haptics,enabled?1:0);}
export function saveUiScalePreference(value){return write(KEYS.uiScale,normalizeAccessibilityPreferences({uiScale:value}).uiScale);}
export function saveHighContrastPreference(value){return write(KEYS.highContrast,value?1:0);}
export function saveReducedMotionPreference(value){
  const normalized=['system','on','off'].includes(String(value).toLowerCase())?String(value).toLowerCase():'system';
  return write(KEYS.reducedMotion,normalized);
}
export function saveReducedVfxPreference(value){return write(KEYS.reducedVfx,value?1:0);}
export function saveReducedFlashesPreference(value){return write(KEYS.reducedFlashes,value?1:0);}
export function saveCameraShakePreference(value){return write(KEYS.cameraShake,normalizeAccessibilityPreferences({cameraShake:value}).cameraShake);}
export function saveControllerDeadzonePreference(value){return write(KEYS.controllerDeadzone,normalizeAccessibilityPreferences({controllerDeadzone:value}).controllerDeadzone);}
export function saveSteeringSensitivityPreference(value){return write(KEYS.steeringSensitivity,normalizeAccessibilityPreferences({steeringSensitivity:value}).steeringSensitivity);}
export function saveHapticsIntensityPreference(value){return write(KEYS.hapticsIntensity,normalizeAccessibilityPreferences({hapticsIntensity:value}).hapticsIntensity);}
export function saveCaptionsPreference(value){return write(KEYS.captions,value?1:0);}
export function saveLocalePreference(value){
  const normalized=[LOCALE.AUTO,LOCALE.EN_US,LOCALE.PT_BR].includes(value)?value:LOCALE.AUTO;
  return write(KEYS.locale,normalized);
}
