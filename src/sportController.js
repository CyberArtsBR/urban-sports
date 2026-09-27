import {getSportDefinition,normalizeSportId,SPORT_ID} from './sportDefinition.js';

export function createSportController({initialSport=SPORT_ID.SKATEBOARD}={}){
  let sportId=normalizeSportId(initialSport);
  let definition=getSportDefinition(sportId);

  function setSport(next){
    const normalized=normalizeSportId(next);
    sportId=normalized;
    definition=getSportDefinition(normalized);
    return definition;
  }

  function snapshot(){
    return Object.freeze({
      sportId,
      label:definition.uiCopy.label,
      physics:definition.physics,
      equipment:definition.equipment,
      courseProfile:definition.courseProfile,
      audioProfile:definition.audioProfile,
      legacyRideMode:definition.setupProfiles.legacyRideMode,
      status:definition.diagnostics.status
    });
  }

  return {
    setSport,
    snapshot,
    get definition(){return definition;},
    get sportId(){return sportId;},
    get legacyRideMode(){return definition.setupProfiles.legacyRideMode;}
  };
}
