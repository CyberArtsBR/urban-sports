export const URBAN_STORAGE_NAMESPACE='chimpions-urban-sports:v1:';

export const LEGACY_URBAN_STORAGE_KEYS=Object.freeze({
  avatar:Object.freeze(['chimpions-ski-avatar']),
  rideMode:Object.freeze(['chimpions-ski-ride-mode']),
  sportMode:Object.freeze([]),
  quality:Object.freeze(['chimpions-ski-quality']),
  cameraMotion:Object.freeze(['chimpions-ski-camera-motion']),
  cameraView:Object.freeze(['chimpions-ski-camera-view']),
  haptics:Object.freeze(['chimpions-ski-haptics-enabled']),
  best:Object.freeze(['chimpions-ski-best']),
  master:Object.freeze(['chimpions-ski-master']),
  sfx:Object.freeze(['chimpions-ski-sfx']),
  music:Object.freeze(['chimpions-ski-music']),
  sfxEnabled:Object.freeze(['chimpions-ski-sfx-enabled']),
  musicEnabled:Object.freeze(['chimpions-ski-music-enabled'])
});

const MIGRATION_MARKER=URBAN_STORAGE_NAMESPACE+'migration-complete';

export function urbanStorageKey(name){
  return URBAN_STORAGE_NAMESPACE+String(name);
}

function resolveStorage(storage){
  if(storage)return storage;
  try{return globalThis.localStorage||null;}catch{return null;}
}

function safeGet(storage,key){
  try{return storage?.getItem?.(key)??null;}catch{return null;}
}

function safeSet(storage,key,value){
  try{
    if(!storage?.setItem)return false;
    storage.setItem(key,String(value));
    return true;
  }catch{
    return false;
  }
}

export function migrateUrbanPersistence({storage=null}={}){
  const target=resolveStorage(storage);
  if(!target)return Object.freeze({available:false,migrated:0,preservedLegacy:true,complete:false});
  let migrated=0;
  let complete=true;
  for(const [name,legacyKeys] of Object.entries(LEGACY_URBAN_STORAGE_KEYS)){
    const nextKey=urbanStorageKey(name);
    if(safeGet(target,nextKey)!==null)continue;
    let legacyValue=null;
    for(const legacyKey of legacyKeys){
      legacyValue=safeGet(target,legacyKey);
      if(legacyValue!==null)break;
    }
    if(legacyValue===null)continue;
    if(safeSet(target,nextKey,legacyValue))migrated++;
    else complete=false;
  }
  if(complete)safeSet(target,MIGRATION_MARKER,'1');
  return Object.freeze({
    available:true,
    migrated,
    preservedLegacy:true,
    complete:complete&&safeGet(target,MIGRATION_MARKER)==='1'
  });
}

export function readUrbanSetting(name,fallback='',{storage=null}={}){
  const target=resolveStorage(storage);
  if(!target)return fallback;
  const key=urbanStorageKey(name);
  const current=safeGet(target,key);
  if(current!==null)return current;
  for(const legacyKey of LEGACY_URBAN_STORAGE_KEYS[name]||[]){
    const legacyValue=safeGet(target,legacyKey);
    if(legacyValue===null)continue;
    safeSet(target,key,legacyValue);
    return legacyValue;
  }
  return fallback;
}

export function writeUrbanSetting(name,value,{storage=null,mirrorLegacy=true}={}){
  const target=resolveStorage(storage);
  if(!target)return false;
  const primaryWritten=safeSet(target,urbanStorageKey(name),value);
  if(primaryWritten&&mirrorLegacy){
    for(const legacyKey of LEGACY_URBAN_STORAGE_KEYS[name]||[])safeSet(target,legacyKey,value);
  }
  return primaryWritten;
}

export function getUrbanPersistenceDiagnostics({storage=null}={}){
  const target=resolveStorage(storage);
  return Object.freeze({
    namespace:URBAN_STORAGE_NAMESPACE,
    available:!!target,
    migrated:target?safeGet(target,MIGRATION_MARKER)==='1':false,
    legacyValuesPreserved:true
  });
}
