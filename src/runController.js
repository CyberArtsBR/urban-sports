import {GAME_FLOW,createGameFlow} from './gameFlow.js';
import {createRunSession,createRunState} from './runSession.js';

export {GAME_FLOW};

/**
 * Composes the shared run state with its lifecycle/state-machine owners.
 * Gameplay systems may mutate only the fields they own; this controller owns
 * lifecycle construction/reset rather than frame-by-frame simulation.
 */
export function createRunController({mode='menu',rideMode,rideProfile,best=0,onTransition=null}={}){
  const state=createRunState({mode,rideMode,rideProfile,best});
  const runSession=createRunSession({state});
  const gameFlow=createGameFlow({state,initial:GAME_FLOW.START,onTransition});

  function reset({rideProfile:nextRideProfile}={}){
    return runSession.reset({rideProfile:nextRideProfile});
  }

  function snapshot(){
    return Object.freeze({
      ...runSession.snapshot(),
      flow:gameFlow.snapshot()
    });
  }

  return {state,runSession,gameFlow,reset,snapshot};
}
