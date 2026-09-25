import assert from 'node:assert/strict';
import {RIDE_MODE,getRideProfile} from '../src/rideMode.js';
import {SPORT_MODE,getLegacyRideModeForSport,getSportProfile,listSportProfiles,normalizeSportMode} from '../src/sportMode.js';

const expected={
  [SPORT_MODE.SKATEBOARD]:{legacyRideMode:RIDE_MODE.SNOWBOARD,equipment:'skateboard',stance:'sideways',wheelCount:4,supportsGrinding:true},
  [SPORT_MODE.INLINE]:{legacyRideMode:RIDE_MODE.SKI,equipment:'inline-skates',stance:'forward',wheelCount:8,supportsGrinding:true},
  [SPORT_MODE.BMX]:{legacyRideMode:RIDE_MODE.SNOWBOARD,equipment:'bmx',stance:'bike',wheelCount:2,supportsGrinding:true}
};
const profiles=listSportProfiles();
assert.equal(profiles.length,3,'exactly three Phase-1 urban sport profiles are registered');
assert.equal(new Set(profiles.map(profile=>profile.mode)).size,3,'sport profile modes are unique');
for(const mode of Object.values(SPORT_MODE)){
  const profile=getSportProfile(mode);
  assert.equal(profile.mode,mode,mode+' profile normalizes to itself');
  for(const [key,value] of Object.entries(expected[mode]))assert.equal(profile[key],value,mode+' '+key+' contract changed');
  const rideProfile=getRideProfile(profile.legacyRideMode);
  for(const key of ['baseSpeed','tierSeconds','tierIncrement','maxSpeed','edgeResponseScale','reversalResponseScale','turnRateScale','lateralScale','lateralResponseScale','landingReengageScale']){
    assert(Number.isFinite(rideProfile[key]),mode+' legacy handling profile lost finite '+key);
  }
}
assert.equal(normalizeSportMode('SKATEBOARD'),SPORT_MODE.SKATEBOARD,'sport normalization remains case-insensitive');
assert.equal(normalizeSportMode('unknown-future-sport'),SPORT_MODE.SKATEBOARD,'unknown sport safely falls back to Skateboard');
assert.equal(getLegacyRideModeForSport(SPORT_MODE.SKATEBOARD),RIDE_MODE.SNOWBOARD,'Skateboard must continue using the proven legacy snowboard handling profile during Phase 1');
assert.strictEqual(getRideProfile(getLegacyRideModeForSport(SPORT_MODE.SKATEBOARD)),getRideProfile(RIDE_MODE.SNOWBOARD),'Skateboard resolves to the same immutable snowboard handling profile');

console.log(JSON.stringify({check:'sport-mode-invariants',profiles:profiles.map(({mode,legacyRideMode,equipment,wheelCount})=>({mode,legacyRideMode,equipment,wheelCount}))}));
