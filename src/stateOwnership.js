export const RUN_STATE_OWNERSHIP=Object.freeze({
  movement:Object.freeze({
    owner:'PlayerController',
    fields:Object.freeze(['x','vx','edge','heading','turnRate','speed','baseSpeed','targetSpeed','maxSpeed','grip','carveLoad','landingGripLoss'])
  }),
  airborne:Object.freeze({
    owner:'PlayerController',
    fields:Object.freeze(['y','vy','air','grounded','jumping','jumpSource','jumpVelocity','jumpBufferTime','jumpBuffered','jumpInputHeld','jumpHoldTime','jumpCutApplied','jumpProfile','lastJumpProfile','coyoteTime','landingPulse','rampGrace'])
  }),
  scoring:Object.freeze({
    owner:'PresentationController',
    fields:Object.freeze(['score','best','bananas','nearMisses','riskBananas','lastClearPoints','clearEvent','trickEvent'])
  }),
  combos:Object.freeze({
    owner:'PresentationController',
    fields:Object.freeze(['combo','bestCombo','successfulTricks','failedTricksCount','tricksLanded','tricksFailed','largestTrickScore'])
  }),
  course:Object.freeze({
    owner:'CourseDirector',
    fields:Object.freeze(['distance','travel','difficulty','courseSection','safeRouteX','runSeed','frame'])
  }),
  crash:Object.freeze({
    owner:'RunController',
    fields:Object.freeze(['crashType','crashVelocity','crashDirection','crashTime','crashActive','crashMotion','failedTrick','trickCrash'])
  }),
  bananaPower:Object.freeze({
    owner:'BananaPowerSystem',
    fields:Object.freeze(['bananaPowerProgress','bananaPowerUses','specialReady','specialActiveTime'])
  }),
  skateboard:Object.freeze({
    owner:'SportController/SkateboardPhysics',
    fields:Object.freeze(['skate','grinding','manual','oilSlipTime'])
  }),
  runStatistics:Object.freeze({
    owner:'RunController',
    fields:Object.freeze(['time','maxRunSpeed','cleanLandings','strongLandings','oilContacts','lastMistakeTime','speedTier','speedTierTime','maxSpeedReached','postMaxHazardTime'])
  })
});

const FIELD_OWNER=new Map();
for(const group of Object.values(RUN_STATE_OWNERSHIP)){
  for(const field of group.fields)FIELD_OWNER.set(field,group.owner);
}

export function getRunStateOwner(field){
  return FIELD_OWNER.get(field)||'Unassigned/legacy';
}

export function getRunStateOwnershipSnapshot(){
  const result={};
  for(const [name,group] of Object.entries(RUN_STATE_OWNERSHIP)){
    result[name]={owner:group.owner,fields:[...group.fields]};
  }
  return Object.freeze(result);
}
