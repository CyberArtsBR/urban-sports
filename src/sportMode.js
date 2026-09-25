import {RIDE_MODE} from './rideMode.js';

export const SPORT_MODE=Object.freeze({
  SKATEBOARD:'skateboard',
  INLINE:'inline',
  BMX:'bmx'
});

// Urban sports keep a legacy ride-mode compatibility layer for shared speed,
// avatar and equipment contracts. Native sport physics can then own handling
// without forcing a rewrite of the proven course/runtime engine.
const SPORT_PROFILES=Object.freeze({
  [SPORT_MODE.SKATEBOARD]:Object.freeze({
    mode:SPORT_MODE.SKATEBOARD,
    label:'SKATEBOARD',
    legacyRideMode:RIDE_MODE.SNOWBOARD,
    physicsProfile:'skateboard-native',
    displaySpeedProfile:'skateboard',
    equipment:'skateboard',
    stance:'sideways',
    wheelCount:4,
    supportsGrinding:true,
    supportsManuals:true,
    supportsPowerslides:true
  }),
  [SPORT_MODE.INLINE]:Object.freeze({
    mode:SPORT_MODE.INLINE,
    label:'INLINE',
    legacyRideMode:RIDE_MODE.SKI,
    equipment:'inline-skates',
    stance:'forward',
    wheelCount:8,
    supportsGrinding:true
  }),
  [SPORT_MODE.BMX]:Object.freeze({
    mode:SPORT_MODE.BMX,
    label:'BMX',
    legacyRideMode:RIDE_MODE.SNOWBOARD,
    equipment:'bmx',
    stance:'bike',
    wheelCount:2,
    supportsGrinding:true
  })
});

export function normalizeSportMode(mode){
  const value=String(mode||'').toLowerCase();
  return SPORT_PROFILES[value]?value:SPORT_MODE.SKATEBOARD;
}

export function getSportProfile(mode=SPORT_MODE.SKATEBOARD){
  return SPORT_PROFILES[normalizeSportMode(mode)];
}

export function getLegacyRideModeForSport(mode=SPORT_MODE.SKATEBOARD){
  return getSportProfile(mode).legacyRideMode;
}

export function listSportProfiles(){
  return Object.values(SPORT_PROFILES);
}
