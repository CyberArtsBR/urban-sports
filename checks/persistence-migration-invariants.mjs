import assert from 'node:assert/strict';
import {
  LEGACY_URBAN_STORAGE_KEYS,
  URBAN_STORAGE_NAMESPACE,
  migrateUrbanPersistence,
  readUrbanSetting,
  urbanStorageKey,
  writeUrbanSetting
} from '../src/urbanPersistence.js';
import {
  loadBestScore,
  loadUserPreferences,
  saveBestScore,
  saveQualityPreference
} from '../src/userPreferences.js';

function createStorage(seed={}){
  const values=new Map(Object.entries(seed).map(([key,value])=>[key,String(value)]));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    dump:()=>Object.fromEntries(values)
  };
}

const storage=createStorage({
  'chimpions-ski-avatar':'Chimpion Legacy',
  'chimpions-ski-ride-mode':'snowboard',
  'chimpions-ski-quality':'high',
  'chimpions-ski-camera-motion':'reduced',
  'chimpions-ski-camera-view':'high-far',
  'chimpions-ski-haptics-enabled':'0',
  'chimpions-ski-best':'4321',
  'chimpions-ski-master':'0.7',
  'chimpions-ski-sfx':'0.4',
  'chimpions-ski-music':'0.3'
});

const first=migrateUrbanPersistence({storage});
assert(first.complete,'first migration did not complete');
assert(first.migrated>=9,'legacy values were not copied into Urban namespace');
assert.equal(storage.getItem(urbanStorageKey('quality')),'high');
assert.equal(storage.getItem('chimpions-ski-quality'),'high','legacy setting was deleted');
assert.equal(readUrbanSetting('best','0',{storage}),'4321');

const second=migrateUrbanPersistence({storage});
assert.equal(second.migrated,0,'migration is not idempotent');

assert(writeUrbanSetting('quality','max',{storage}));
assert.equal(storage.getItem(urbanStorageKey('quality')),'max');
assert.equal(storage.getItem('chimpions-ski-quality'),'max','compatibility mirror stopped updating');
assert.equal(LEGACY_URBAN_STORAGE_KEYS.quality[0],'chimpions-ski-quality');
assert(URBAN_STORAGE_NAMESPACE.startsWith('chimpions-urban-sports:v1:'));

const previousStorage=globalThis.localStorage;
globalThis.localStorage=storage;
try{
  const prefs=loadUserPreferences();
  assert.equal(prefs.avatarName,'Chimpion Legacy');
  assert.equal(prefs.rideMode,'snowboard');
  assert.equal(prefs.quality,'max');
  assert.equal(prefs.cameraMotion,'reduced');
  assert.equal(prefs.haptics,false);
  assert.equal(loadBestScore(),4321);
  assert(saveBestScore(5000));
  assert.equal(storage.getItem(urbanStorageKey('best')),'5000');
  assert.equal(storage.getItem('chimpions-ski-best'),'5000');
  assert(saveQualityPreference('medium'));
  assert.equal(storage.getItem(urbanStorageKey('quality')),'medium');
}finally{
  if(previousStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=previousStorage;
}

console.log(JSON.stringify({
  check:'persistence-migration-invariants',
  namespace:URBAN_STORAGE_NAMESPACE,
  legacyPreserved:true,
  idempotent:true
}));
