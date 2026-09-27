import {SPORT_MODE} from './sportMode.js';

export const URBAN_SPORT_SELECTOR=Object.freeze([
  Object.freeze({id:SPORT_MODE.SKATEBOARD,labelKey:'sport.skateboard',statusKey:'sport.playable',available:true}),
  Object.freeze({id:SPORT_MODE.INLINE,labelKey:'sport.inline',statusKey:'sport.comingSoon',available:false}),
  Object.freeze({id:SPORT_MODE.BMX,labelKey:'sport.bmx',statusKey:'sport.comingSoon',available:false})
]);

function normalizeSetupProfile(profile,index){
  const id=String(profile?.id||profile?.profileId||'').trim();
  if(!id)return null;
  return Object.freeze({
    id,
    label:String(profile?.label||profile?.name||`SETUP ${index+1}`).trim(),
    description:String(profile?.description||'').trim(),
    icon:String(profile?.icon||'🛹'),
    available:profile?.available!==false
  });
}

// UI-only contract. Gameplay owns the profile ids and their physics. The UI
// never invents speed/handling values and never assumes STREET/PARK exist.
export function createSkateboardSetupContract({profiles=[],activeProfileId=null}={}){
  const normalized=(profiles||[]).map(normalizeSetupProfile).filter(Boolean);
  const available=normalized.filter(profile=>profile.available);
  const active=available.some(profile=>profile.id===activeProfileId)
    ?String(activeProfileId)
    :(available[0]?.id||null);
  return Object.freeze({
    sport:SPORT_MODE.SKATEBOARD,
    profiles:Object.freeze(normalized),
    activeProfileId:active,
    selectable:available.length>1
  });
}

export const EMPTY_SKATEBOARD_SETUP_CONTRACT=createSkateboardSetupContract();
