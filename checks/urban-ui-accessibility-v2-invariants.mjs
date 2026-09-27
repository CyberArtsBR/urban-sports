import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INPUT_ACTION,createActionMap,actionHasKey,gamepadButtonFor} from '../src/actionMap.js';
import {LOCALE,createLocalization,normalizeLocale} from '../src/localization.js';
import {URBAN_SPORT_SELECTOR,createSkateboardSetupContract} from '../src/urbanUiContract.js';
import {applyAccessibilityPreferences,normalizeAccessibilityPreferences,shouldReduceMotion} from '../src/uiAccessibility.js';
import {MENU_ACTION,createMenuFocusController} from '../src/menuNavigation.js';
import {createMenuInputRepeat,MENU_INPUT_DEFAULTS} from '../src/menuInputRepeat.js';
import {configureControllerInput,getControllerInputSettings} from '../src/input.js';

const pt=createLocalization({locale:LOCALE.PT_BR,browserLocale:'en-US'});
assert.equal(pt.t('settings.title'),'CONFIGURAÇÕES');
assert.equal(pt.t('missing.key','Fallback'),'Fallback');
assert.equal(normalizeLocale('auto','pt-BR'),LOCALE.PT_BR);
assert.equal(normalizeLocale('auto','en-GB'),LOCALE.EN_US);

assert.deepEqual(
  URBAN_SPORT_SELECTOR.map(({id,available})=>[id,available]),
  [['skateboard',true],['inline',false],['bmx',false]],
  'sport availability contract changed'
);
const noSetup=createSkateboardSetupContract();
assert.equal(noSetup.selectable,false,'UI invented a setup when gameplay supplied none');
const realSetup=createSkateboardSetupContract({
  profiles:[
    {id:'street',label:'STREET',description:'Gameplay supplied'},
    {id:'park',label:'PARK',description:'Gameplay supplied'}
  ],
  activeProfileId:'park'
});
assert.equal(realSetup.selectable,true);
assert.equal(realSetup.activeProfileId,'park');
assert.equal('speed' in realSetup.profiles[0],false,'UI setup contract leaked physics values');

const remap=createActionMap({
  keyboard:{[INPUT_ACTION.JUMP]:['KeyJ']},
  gamepad:{[INPUT_ACTION.SPECIAL]:4}
});
assert(actionHasKey(remap,INPUT_ACTION.JUMP,'KeyJ'));
assert.equal(gamepadButtonFor(remap,INPUT_ACTION.SPECIAL),4);

configureControllerInput({deadzone:.22,actionMap:remap});
assert.equal(getControllerInputSettings().deadzone,.22);
configureControllerInput({deadzone:.14});

const attrs={};
const classes=new Set();
const fakeRoot={
  dataset:{},
  style:{setProperty:(key,value)=>{attrs[key]=value;}}
};
const fakeBody={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
const fakeDoc={documentElement:fakeRoot,body:fakeBody};
const normalized=normalizeAccessibilityPreferences({
  uiScale:1.3,highContrast:true,reducedMotion:'on',reducedVfx:true,reducedFlashes:true,
  cameraShake:.5,controllerDeadzone:.2,steeringSensitivity:1.25,hapticsIntensity:.7,captions:true
});
const applied=applyAccessibilityPreferences(normalized,{documentRef:fakeDoc,windowRef:{matchMedia:()=>({matches:false})}});
assert.equal(applied.reduceMotion,true);
assert.equal(fakeRoot.dataset.highContrast,'true');
assert.equal(fakeRoot.dataset.reducedVfx,'true');
assert.equal(fakeRoot.dataset.reducedFlashes,'true');
assert.equal(fakeRoot.dataset.captions,'true');
assert.equal(attrs['--ui-scale'],'1.3');
assert(classes.has('a11y-high-contrast'));
assert.equal(shouldReduceMotion({reducedMotion:'system'},{matchMedia:()=>({matches:true})}),true);

function classList(){
  const set=new Set();
  return {add:v=>set.add(v),remove:v=>set.delete(v),contains:v=>set.has(v)};
}
const doc={activeElement:null};
const button=name=>({
  name,disabled:false,hidden:false,isConnected:true,dataset:{},classList:classList(),
  focus(){doc.activeElement=this;},click(){}
});
const outside=button('outside'),first=button('first'),second=button('second');
const root={contains:item=>item===first||item===second};
doc.activeElement=outside;
const focus=createMenuFocusController({documentRef:doc,getRoot:()=>root,getItems:()=>[first,second]});
focus.open({root,defaultElement:first,restoreFrom:outside});
const tab={key:'Tab',shiftKey:false,preventDefault(){this.prevented=true;},stopPropagation(){}};
assert.equal(focus.trapTab(tab,{root}),true);
assert.equal(doc.activeElement,second);
focus.trapTab({...tab,shiftKey:false},{root});
assert.equal(doc.activeElement,first,'focus trap did not wrap');
focus.close({root,restore:true});
assert.equal(doc.activeElement,outside,'focus restoration regressed');

const repeatActions=[];
const repeat=createMenuInputRepeat({adapter:{move:d=>repeatActions.push(d),confirm(){},cancel(){},menu(){}}});
const neutral={connected:true,axis:0,axisY:0,dpad:{up:false,down:false,left:false,right:false},confirm:false,cancel:false,menu:false};
repeat.update({...neutral,axisY:.8},0);
repeat.update({...neutral,axisY:.8},MENU_INPUT_DEFAULTS.initialRepeatDelayMs-1);
assert.equal(repeatActions.length,1,'analog input double-navigated before repeat delay');
repeat.update({...neutral,axisY:.8},MENU_INPUT_DEFAULTS.initialRepeatDelayMs);
assert.equal(repeatActions.length,2,'analog repeat did not fire at configured delay');

const avatar=readFileSync(new URL('../src/avatar-system.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
const start=readFileSync(new URL('../src/startScreen.js',import.meta.url),'utf8');
const touch=readFileSync(new URL('../src/touchControls.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const prefs=readFileSync(new URL('../src/userPreferences.js',import.meta.url),'utf8');
const haptics=readFileSync(new URL('../src/haptics.js',import.meta.url),'utf8');
const camera=readFileSync(new URL('../src/skiCamera.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/floatingUI.css',import.meta.url),'utf8');

assert(!/\bSKI\b|SNOWBOARD|Choose Ride|speedToKmh/.test(avatar),'legacy Ski/Snowboard selector presentation remains');
assert(!avatar.includes('ride-mode-step')&&!avatar.includes('ride-mode-card'),'legacy ride-selector DOM remains');
assert(avatar.includes('hasSetupStep')&&avatar.includes('completeSelection(entry,null)'),'one-click rider flow / gameplay setup contract missing');
assert(avatar.includes('URL.createObjectURL(file)')&&avatar.includes('URL.revokeObjectURL'),'local avatar lifecycle regressed');
assert(avatar.includes("role=\"status\" aria-live=\"polite\""),'avatar loading status is not announced');

assert(!ui.includes('applyUrbanSelectorCopy'),'UI still mutates a legacy selector after creation');
for(const category of ['settings.gameplay','settings.controls','settings.camera','settings.graphics','settings.audio','settings.accessibility']){
  assert(ui.includes(category),`grouped settings missing ${category}`);
}
assert(ui.includes('updateControllerConnection'),'controller disconnect UI feedback missing');
assert(ui.includes("menuFocus.trapTab(event,{root})"),'modal keyboard focus trap is not wired');
assert(ui.includes('setPresentationText(distance')&&ui.includes('setPresentationText(speed'),'HUD still rewrites unchanged values every frame');
assert(ui.includes("aria-disabled=\"true\""),'unavailable sport semantics missing');
assert(ui.includes("sport.available?'aria-current=\"true\"':'aria-disabled=\"true\"'"),'playable/future sport distinction regressed');

assert(start.includes('createMenuInputRepeat'),'start screen bypasses shared controller repeat');
assert(start.includes("data-menu-default=\"true\""),'Start Game is not the predictable default focus');
assert(!start.includes('buttons[0]')&&!start.includes('axisLatch'),'start screen decodes raw controller input');
assert(touch.includes('touch-special')&&touch.includes('onSpecial'),'touch Banana Power control is missing');
assert(touch.includes('pointercancel')&&touch.includes('setPointerCapture'),'touch pointer lifecycle regressed');

assert(main.includes('configureControllerInput({deadzone:userPreferences.controllerDeadzone})'),'saved controller deadzone is not applied');
assert(main.includes('gameplayInput.setSteeringSensitivity?.(userPreferences.steeringSensitivity)'),'saved steering sensitivity is not applied');
assert(main.includes('ui.updateControllerConnection?.(pad)'),'controller status is not polled across screens');
assert(main.includes('localization=createLocalization'),'shared localization runtime is missing');
assert(main.includes('applyAccessibilityPreferences'),'accessibility settings are not applied');
assert(main.includes('sportMode:selectedSportMode'),'results still receive a legacy Ski ride identity');

for(const fn of ['saveUiScalePreference','saveHighContrastPreference','saveReducedMotionPreference','saveReducedVfxPreference','saveReducedFlashesPreference','saveCameraShakePreference','saveControllerDeadzonePreference','saveSteeringSensitivityPreference','saveHapticsIntensityPreference','saveCaptionsPreference','saveLocalePreference']){
  assert(prefs.includes(`function ${fn}`),`preference persistence missing ${fn}`);
}
assert(haptics.includes('setIntensity')&&haptics.includes('hapticsIntensity'),'haptics intensity architecture missing');
assert(camera.includes('setMotionAmount'),'camera shake/motion amount architecture missing');

assert(css.includes('body.a11y-high-contrast'),'high contrast presentation missing');
assert(css.includes('html[data-reduced-motion="true"]'),'explicit reduced-motion presentation missing');
assert(css.includes('@media (prefers-reduced-motion:reduce)'),'system reduced-motion support missing');
assert(css.includes('html[data-reduced-vfx="true"]'),'reduced VFX presentation missing');
assert(css.includes('html[data-reduced-flashes="true"]'),'reduced flashes presentation missing');
assert(css.includes('body[data-mode="playing"] canvas')&&css.includes('touch-action:none'),'gameplay-only touch gesture suppression missing');
assert(css.includes('env(safe-area-inset-bottom)'),'touch/controller feedback ignores safe areas');

console.log(JSON.stringify({
  check:'urban-ui-accessibility-v2-invariants',
  covered:[
    'keyboard-navigation','gamepad-actions','analog-repeat-no-double-nav','focus-trap-restoration',
    'urban-native-selector','gameplay-owned-setup-contract','controller-disconnect','touch-banana-power',
    'local-avatar-flow','reduced-motion','high-contrast','reduced-vfx','reduced-flashes',
    'input-settings','haptics-intensity','camera-shake','localization-fallback','grouped-settings'
  ]
}));
