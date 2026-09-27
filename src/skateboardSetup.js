import {RIDE_MODE} from './rideMode.js';

export const SKATEBOARD_SETUP=Object.freeze({
  STREET:'street',
  PARK:'park'
});

const PROFILES=Object.freeze({
  [SKATEBOARD_SETUP.STREET]:Object.freeze({
    id:SKATEBOARD_SETUP.STREET,
    label:'STREET SETUP',
    truckResponse:1.12,
    steeringPrecision:1.08,
    carveAuthority:.96,
    airControl:.96,
    olliePop:.96,
    rampPop:.98,
    manualStability:1.18,
    grindCapture:1.16,
    grindAngleTolerance:1.10,
    grindStability:1.14,
    grindFriction:.96
  }),
  [SKATEBOARD_SETUP.PARK]:Object.freeze({
    id:SKATEBOARD_SETUP.PARK,
    label:'PARK SETUP',
    truckResponse:.94,
    steeringPrecision:.95,
    carveAuthority:1.10,
    airControl:1.12,
    olliePop:1.08,
    rampPop:1.10,
    manualStability:.91,
    grindCapture:.92,
    grindAngleTolerance:.94,
    grindStability:.90,
    grindFriction:1.04
  })
});

export function normalizeSkateboardSetup(value){
  return String(value||'').toLowerCase()===SKATEBOARD_SETUP.PARK
    ?SKATEBOARD_SETUP.PARK
    :SKATEBOARD_SETUP.STREET;
}

export function getSkateboardSetupProfile(value=SKATEBOARD_SETUP.STREET){
  return PROFILES[normalizeSkateboardSetup(value)];
}

// The current selector exposes two legacy ride-card values. For Skateboard they
// are persistence/UI slots only: the sport still uses its own legacy ride mode
// for avatar/equipment compatibility, while these values select native handling.
export function skateboardSetupFromSelectorRideMode(rideMode){
  return String(rideMode||'').toLowerCase()===RIDE_MODE.SNOWBOARD
    ?SKATEBOARD_SETUP.PARK
    :SKATEBOARD_SETUP.STREET;
}

export function selectorRideModeForSkateboardSetup(setup){
  return normalizeSkateboardSetup(setup)===SKATEBOARD_SETUP.PARK
    ?RIDE_MODE.SNOWBOARD
    :RIDE_MODE.SKI;
}

export function listSkateboardSetupProfiles(){
  return Object.values(PROFILES);
}
