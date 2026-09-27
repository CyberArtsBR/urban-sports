import {createSkiCamera} from '../skiCamera.js';

/**
 * Urban-native camera facade. The legacy camera implementation remains the
 * compatibility backend until a dedicated camera replacement is justified.
 */
export function createCameraSystem(camera){
  const runtime=createSkiCamera(camera);
  return Object.assign(runtime,{
    systemId:'CameraSystem',
    compatibilityBackend:'skiCamera'
  });
}
