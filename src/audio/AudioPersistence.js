const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export const AUDIO_STORAGE_KEYS=Object.freeze({
  master:Object.freeze({urban:'chimpions-urban-master',legacy:'chimpions-ski-master'}),
  sfx:Object.freeze({urban:'chimpions-urban-sfx',legacy:'chimpions-ski-sfx'}),
  music:Object.freeze({urban:'chimpions-urban-music',legacy:'chimpions-ski-music'}),
  sfxEnabled:Object.freeze({urban:'chimpions-urban-sfx-enabled',legacy:'chimpions-ski-sfx-enabled'}),
  musicEnabled:Object.freeze({urban:'chimpions-urban-music-enabled',legacy:'chimpions-ski-music-enabled'}),
  impactIntensity:Object.freeze({urban:'chimpions-urban-audio-impact-intensity',legacy:'chimpions-ski-audio-impact-intensity'})
});

const storage=()=>globalThis.localStorage||null;

function readRaw(pair){
  try{
    const store=storage();
    if(!store)return null;
    const urban=store.getItem(pair.urban);
    if(urban!==null)return urban;
    const legacy=store.getItem(pair.legacy);
    if(legacy!==null){
      try{store.setItem(pair.urban,legacy);}catch{}
      return legacy;
    }
  }catch{}
  return null;
}

function readNumber(name,fallback){
  const raw=readRaw(AUDIO_STORAGE_KEYS[name]);
  if(raw===null)return fallback;
  const value=Number(raw);
  return Number.isFinite(value)?clamp(value):fallback;
}

function readBool(name,fallback){
  const raw=readRaw(AUDIO_STORAGE_KEYS[name]);
  return raw===null?fallback:raw!=='0';
}

export function loadAudioSettings(){
  return {
    master:readNumber('master',.82),
    sfx:readNumber('sfx',.25),
    music:readNumber('music',.25),
    sfxEnabled:readBool('sfxEnabled',true),
    musicEnabled:readBool('musicEnabled',true),
    impactIntensity:readNumber('impactIntensity',1)
  };
}

export function writeAudioSetting(name,value){
  const pair=AUDIO_STORAGE_KEYS[name];
  if(!pair)return false;
  try{
    const store=storage();
    if(!store)return false;
    const serialized=String(value);
    store.setItem(pair.urban,serialized);
    // Keep legacy consumers working during the namespace transition.
    store.setItem(pair.legacy,serialized);
    return true;
  }catch{
    return false;
  }
}

export function getAudioStorageDiagnostics(){
  const migrated={};
  for(const [name,pair] of Object.entries(AUDIO_STORAGE_KEYS)){
    try{
      migrated[name]={
        urban:storage()?.getItem(pair.urban)!==null,
        legacy:storage()?.getItem(pair.legacy)!==null
      };
    }catch{
      migrated[name]={urban:false,legacy:false};
    }
  }
  return migrated;
}
