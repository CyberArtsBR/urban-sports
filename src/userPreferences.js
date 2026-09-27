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
  avatar:'chimpions-ski-avatar',
  rideMode:'chimpions-ski-ride-mode',
  quality:'chimpions-ski-quality',
  cameraMotion:'chimpions-ski-camera-motion',
  cameraView:'chimpions-ski-camera-view',
  haptics:'chimpions-urban-haptics-enabled',
  hapticsLegacy:'chimpions-ski-haptics-enabled',
  hapticIntensity:'chimpions-urban-haptics-intensity',
  hapticIntensityLegacy:'chimpions-ski-haptics-intensity'
});

function read(key,fallback=''){
  try{
    const value=globalThis.localStorage?.getItem(key);
    return value==null?fallback:value;
  }catch{
    return fallback;
  }
}
function write(key,value){
  try{
    globalThis.localStorage?.setItem(key,String(value));
    return true;
  }catch{
    return false;
  }
}
function readMigrated(primary,legacy,fallback=''){
  const current=read(primary,'');
  if(current!=='')return current;
  const previous=read(legacy,'');
  if(previous!==''){
    write(primary,previous);
    return previous;
  }
  return fallback;
}
function writeMigrated(primary,legacy,value){
  const modern=write(primary,value);
  write(legacy,value);
  return modern;
}
function normalizedChoice(value,allowed,fallback){
  const normalized=String(value??'').trim().toLowerCase();
  return allowed.includes(normalized)?normalized:fallback;
}

export function loadUserPreferences(){
  return {
    avatarName:read(KEYS.avatar,''),
    rideMode:normalizedChoice(read(KEYS.rideMode,'ski'),['ski','snowboard'],'ski'),
    quality:normalizedChoice(read(KEYS.quality,'auto'),['auto','high','max','medium','low'],'auto'),
    cameraMotion:normalizedChoice(read(KEYS.cameraMotion,CAMERA_MOTION.FULL),Object.values(CAMERA_MOTION),CAMERA_MOTION.FULL),
    cameraView:normalizedChoice(read(KEYS.cameraView,CAMERA_VIEW.CHASE),Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE),
    haptics:readMigrated(KEYS.haptics,KEYS.hapticsLegacy,'1')!=='0',
    hapticIntensity:normalizedChoice(
      readMigrated(KEYS.hapticIntensity,KEYS.hapticIntensityLegacy,'high'),
      ['off','low','medium','high'],
      'high'
    )
  };
}

export function saveAvatarPreference(name){
  const value=String(name??'').trim();
  return value?write(KEYS.avatar,value):false;
}
export function saveRideModePreference(mode){
  return write(KEYS.rideMode,normalizedChoice(mode,['ski','snowboard'],'ski'));
}
export function saveQualityPreference(mode){
  return write(KEYS.quality,normalizedChoice(mode,['auto','high','max','medium','low'],'auto'));
}
export function saveCameraMotionPreference(mode){
  return write(KEYS.cameraMotion,normalizedChoice(mode,Object.values(CAMERA_MOTION),CAMERA_MOTION.FULL));
}
export function saveCameraViewPreference(mode){
  return write(KEYS.cameraView,normalizedChoice(mode,Object.values(CAMERA_VIEW),CAMERA_VIEW.CHASE));
}
export function saveHapticsPreference(enabled){
  return writeMigrated(KEYS.haptics,KEYS.hapticsLegacy,enabled?1:0);
}
export function saveHapticIntensityPreference(intensity){
  return writeMigrated(
    KEYS.hapticIntensity,
    KEYS.hapticIntensityLegacy,
    normalizedChoice(intensity,['off','low','medium','high'],'high')
  );
}
