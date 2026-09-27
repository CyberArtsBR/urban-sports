import {createSkiAudio} from '../audio.js';

/**
 * Sport-aware audio facade. It preserves the proven audio graph while removing
 * direct legacy-factory knowledge from the game bootstrap.
 */
export function createAudioSystem({sportDefinition=null}={}){
  const runtime=createSkiAudio();
  if(sportDefinition?.setupProfiles?.legacyRideMode){
    runtime.setRideMode?.(sportDefinition.setupProfiles.legacyRideMode);
  }
  return Object.assign(runtime,{
    systemId:'AudioSystem',
    sportId:sportDefinition?.id||'skateboard',
    audioProfile:sportDefinition?.audioProfile||'skateboard',
    compatibilityBackend:'createSkiAudio'
  });
}
