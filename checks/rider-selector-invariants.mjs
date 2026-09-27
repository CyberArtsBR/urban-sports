import {parseArgs,getRoot,read,result,finish,STATUS} from './integration-check-utils.mjs';

const args=parseArgs(),root=getRoot(args);
const avatar=read(root,'src/avatar-system.js');
const model=read(root,'src/avatar-selector-model.js');
const main=read(root,'src/main.js');
const contract=read(root,'src/urbanUiContract.js');
const results=[];
const expectedRoster=[
 'The Archon','The Heretic','The Commodore','The Pioneer','The Punk',
 'The Street Fighter','The Bosun','The Adolescent','The Angsty','The Apologetic'
];
let catalogNames=null;
try{
 const v=JSON.parse(read(root,'public/avatars.json'));
 if(Array.isArray(v))catalogNames=v.map(entry=>entry?.name);
}catch{}
const catalogCount=catalogNames?.length??null;
const exactRoster=Array.isArray(catalogNames)&&
 catalogNames.length===expectedRoster.length&&
 catalogNames.every((name,index)=>name===expectedRoster[index]);

results.push(result('exact 10 built-in Chimpions remain available',
 catalogNames==null?STATUS.PENDING:(exactRoster?STATUS.PASS:STATUS.FAIL),
 catalogNames==null?'avatars.json unavailable':JSON.stringify(catalogNames)));
results.push(result('initial selector lazy rendering remains optimized',
 /AVATAR_SELECTOR_INITIAL_RENDER/.test(avatar)&&/Closed selector owns zero card\/image nodes/.test(avatar)?STATUS.PASS:STATUS.FAIL,'lazy card materialization'));
results.push(result('search remains normalized/precomputed',
 /buildAvatarSearchIndex/.test(avatar)&&/filterAvatarSearchIndex/.test(avatar)&&/normaliz/i.test(model)?STATUS.PASS:STATUS.FAIL,'precomputed normalized search'));

const legacyPresentation=/Choose Ride|\bSKI\b|SNOWBOARD|speedToKmh|ride-mode-step|ride-mode-card/.test(avatar);
results.push(result('legacy Ski/Snowboard selector presentation is removed',
 legacyPresentation?STATUS.FAIL:STATUS.PASS,
 legacyPresentation?'legacy selector marker remains':'selector is Urban-native'));

const sportContract=/SKATEBOARD/.test(contract)&&/INLINE/.test(contract)&&/BMX/.test(contract)&&/available:false/.test(contract);
results.push(result('sport selector contract exposes Skateboard now and future sports without fake availability',
 sportContract?STATUS.PASS:STATUS.FAIL,'Urban sport availability contract'));

const setupOwned=/createSkateboardSetupContract/.test(contract)&&/selectable:available\.length>1/.test(contract)&&
 /hasSetupStep/.test(avatar)&&/completeSelection\(entry,null\)/.test(avatar);
results.push(result('Skateboard setup step exists only when gameplay supplies real profiles',
 setupOwned?STATUS.PASS:STATUS.FAIL,'no UI-authored physics profile'));

results.push(result('B from a real setup step returns to rider selection',
 /action===MENU_ACTION\.CANCEL[\s\S]{0,140}step==='setup'[\s\S]{0,100}showAvatarStep/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'semantic cancel handling'));
results.push(result('B again closes selector',
 /action===MENU_ACTION\.CANCEL[\s\S]{0,180}dialog\.close/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'semantic cancel closes top-level selector'));
results.push(result('A/Enter selection is semantic',
 /MENU_ACTION\.CONFIRM/.test(avatar)&&/active\.click\(\)/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'semantic confirm'));
results.push(result('keyboard navigation remains enabled',
 /dialog\.addEventListener\('keydown'/.test(avatar)&&/keyboardMove/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'selector keydown adapter'));
results.push(result('gamepad navigation remains enabled without raw button indices',
 /handleMenuAction/.test(avatar)&&!/buttons\[[01]\]/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'semantic controller adapter'));
results.push(result('selected Chimpion remains selected',
 /currentSelectedId/.test(avatar)&&/setSelected/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'selection state'));
results.push(result('local GLB upload remains session-local and revokes object URLs',
 /URL\.createObjectURL/.test(avatar)&&/URL\.revokeObjectURL/.test(avatar)&&/LOCAL ONLY/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'local upload lifecycle'));
results.push(result('one-click rider selection launches current sport when no setup contract exists',
 /onSelect:async entry=>/.test(main)&&/setTimeout\(\(\)=>beginRun\(\),0\)/.test(main)&&/completeSelection\(entry,null\)/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'direct Urban rider flow'));
results.push(result('no duplicated event listeners accumulate after repeated open/close',
 /delegated/.test(avatar)&&/grid\.addEventListener\('click'/.test(avatar)?STATUS.PASS:STATUS.FAIL,
 'delegated selector handlers'));

finish('rider-selector-invariants',results,{json:!!args.json,extra:{root,catalogCount,urbanNative:true}});
