import {getRideProfile} from './rideMode.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const damp=(value,target,response,dt)=>target+(Number(value||0)-target)*Math.exp(-Math.max(0,response)*Math.max(0,Number(dt)||0));

export const WORLD_PROGRESSION_TUNING=Object.freeze({
  SPEED_RESPONSE:2.2
});

// Procedural/world velocity deliberately stays on the established 150-300 km/h
// simulation scale. Sport-native physics can derive a separate gameplay velocity
// without changing streaming distance, deterministic sections or collision cadence.
export function progressWorldSpeed(state,dt){
  const profile=getRideProfile(state.rideMode);
  const tier=Math.max(0,Math.floor((state.time||0)/profile.tierSeconds));
  const tierTime=(state.time||0)-tier*profile.tierSeconds;
  const targetSpeed=Math.min(profile.maxSpeed,profile.baseSpeed+tier*profile.tierIncrement);

  state.speedTier=tier;
  state.speedTierTime=tierTime;
  state.targetSpeed=targetSpeed;
  state.baseSpeed=profile.baseSpeed;
  state.maxSpeed=profile.maxSpeed;
  state.speed=damp(state.speed,targetSpeed,WORLD_PROGRESSION_TUNING.SPEED_RESPONSE,dt);
  state.speed=clamp(state.speed,profile.baseSpeed,profile.maxSpeed);
  return clamp((state.speed-profile.baseSpeed)/Math.max(.001,profile.maxSpeed-profile.baseSpeed),0,1);
}
