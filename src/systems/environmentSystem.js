import {createSkiEnvironment} from '../environment.js';
import {createUrbanEnvironment} from '../urban/index.js';

/**
 * Shared environment lifecycle used by the Urban runtime. The historical
 * alpine environment remains a compatibility backend for lighting/material
 * contracts while the native Urban renderer owns street/city presentation.
 */
export function createEnvironmentSystem({
  scene,
  world,
  renderer,
  camera,
  mode='urban',
  quality=null,
  urbanOptions={}
}={}){
  const environment=createSkiEnvironment({scene,world,renderer,camera,mode});
  const urbanEnvironment=createUrbanEnvironment({
    parent:world,
    renderer,
    quality,
    ...urbanOptions
  });

  if(urbanEnvironment.components?.road?.meshes?.[0]){
    urbanEnvironment.components.road.meshes[0].visible=false;
  }

  function reset(){
    environment.reset?.();
    urbanEnvironment.reset?.();
  }

  function applyQuality(settings){
    environment.applyQuality?.(settings);
    urbanEnvironment.setQualityProfile?.(settings);
  }

  function update(
    dt,
    worldSpeed,
    playerX,
    playerY,
    playerZ,
    speed,
    edge,
    air,
    landingPulse,
    running=true,
    groundY=playerY,
    runTime=0,
    rideMode='ski',
    rideContacts=null
  ){
    environment.update(
      dt,worldSpeed,playerX,playerY,playerZ,speed,edge,air,landingPulse,
      running,groundY,runTime,rideMode,rideContacts
    );
    urbanEnvironment.update?.(dt,worldSpeed);
  }

  function dispose(){
    urbanEnvironment.dispose?.();
    environment.dispose?.();
  }

  function getDiagnostics(){
    return Object.freeze({
      systemId:'EnvironmentSystem',
      mode,
      compatibilityBackend:'createSkiEnvironment',
      urban:urbanEnvironment.getDiagnostics?.()||null,
      legacyQuality:environment.getQualityDiagnostics?.()||null
    });
  }

  return {
    environment,
    urbanEnvironment,
    reset,
    applyQuality,
    update,
    dispose,
    getDiagnostics
  };
}
