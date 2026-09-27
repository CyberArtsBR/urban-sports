import {SPORT_ID,getSportDefinition,listSportDefinitions,normalizeSportId} from './sportDefinition.js';

// Compatibility adapter retained for modules/checks that still consume the old
// sportMode facade. New runtime code should consume SportDefinition directly.
export const SPORT_MODE=SPORT_ID;

export function normalizeSportMode(mode){
  return normalizeSportId(mode);
}

export function getSportProfile(mode=SPORT_MODE.SKATEBOARD){
  const definition=getSportDefinition(mode);
  return Object.freeze({
    mode:definition.id,
    label:definition.uiCopy.label,
    legacyRideMode:definition.setupProfiles.legacyRideMode,
    physicsProfile:definition.physics,
    displaySpeedProfile:definition.displaySpeed,
    equipment:definition.equipment,
    stance:definition.setupProfiles.stance,
    wheelCount:definition.setupProfiles.wheelCount,
    supportsGrinding:!!definition.diagnostics.supportsGrinding,
    supportsManuals:!!definition.diagnostics.supportsManuals,
    supportsPowerslides:!!definition.diagnostics.supportsPowerslides
  });
}

export function getLegacyRideModeForSport(mode=SPORT_MODE.SKATEBOARD){
  return getSportDefinition(mode).setupProfiles.legacyRideMode;
}

export function listSportProfiles(){
  return listSportDefinitions().map(definition=>getSportProfile(definition.id));
}
