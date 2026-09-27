const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const ACCESSIBILITY_DEFAULTS=Object.freeze({
  uiScale:1,
  highContrast:false,
  reducedMotion:'system',
  reducedVfx:false,
  reducedFlashes:false,
  cameraShake:1,
  controllerDeadzone:.14,
  steeringSensitivity:1,
  hapticsIntensity:1,
  captions:false
});

export function normalizeAccessibilityPreferences(input={}){
  const motion=String(input.reducedMotion??ACCESSIBILITY_DEFAULTS.reducedMotion).toLowerCase();
  return {
    uiScale:clamp(input.uiScale??ACCESSIBILITY_DEFAULTS.uiScale,.85,1.35),
    highContrast:!!input.highContrast,
    reducedMotion:['system','on','off'].includes(motion)?motion:'system',
    reducedVfx:!!input.reducedVfx,
    reducedFlashes:!!input.reducedFlashes,
    cameraShake:clamp(input.cameraShake??ACCESSIBILITY_DEFAULTS.cameraShake,0,1),
    controllerDeadzone:clamp(input.controllerDeadzone??ACCESSIBILITY_DEFAULTS.controllerDeadzone,.05,.35),
    steeringSensitivity:clamp(input.steeringSensitivity??ACCESSIBILITY_DEFAULTS.steeringSensitivity,.65,1.5),
    hapticsIntensity:clamp(input.hapticsIntensity??ACCESSIBILITY_DEFAULTS.hapticsIntensity,0,1),
    captions:!!input.captions
  };
}

export function systemPrefersReducedMotion(windowRef=globalThis.window){
  try{return !!windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}catch{return false;}
}

export function shouldReduceMotion(preferences,windowRef=globalThis.window){
  const normalized=normalizeAccessibilityPreferences(preferences);
  if(normalized.reducedMotion==='on')return true;
  if(normalized.reducedMotion==='off')return false;
  return systemPrefersReducedMotion(windowRef);
}

export function applyAccessibilityPreferences(preferences,{
  documentRef=globalThis.document,
  windowRef=globalThis.window
}={}){
  const normalized=normalizeAccessibilityPreferences(preferences);
  const root=documentRef?.documentElement;
  const body=documentRef?.body;
  const reduceMotion=shouldReduceMotion(normalized,windowRef);
  if(root){
    root.style?.setProperty?.('--ui-scale',String(normalized.uiScale));
    root.dataset.uiScale=String(normalized.uiScale);
    root.dataset.highContrast=normalized.highContrast?'true':'false';
    root.dataset.reducedMotion=reduceMotion?'true':'false';
    root.dataset.reducedVfx=normalized.reducedVfx?'true':'false';
    root.dataset.reducedFlashes=normalized.reducedFlashes?'true':'false';
    root.dataset.captions=normalized.captions?'true':'false';
  }
  body?.classList?.toggle?.('a11y-high-contrast',normalized.highContrast);
  body?.classList?.toggle?.('a11y-reduced-motion',reduceMotion);
  body?.classList?.toggle?.('a11y-reduced-vfx',normalized.reducedVfx);
  body?.classList?.toggle?.('a11y-reduced-flashes',normalized.reducedFlashes);
  return {...normalized,reduceMotion};
}
