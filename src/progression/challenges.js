import {CHALLENGE_VERSION,GAMEPLAY_VERSION} from './versions.js';

const DAY_MS=86400000;
const clampNumber=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Math.max(min,Math.min(max,Number(value)||0));

export const MEDAL_TIER=Object.freeze({BRONZE:'BRONZE',SILVER:'SILVER',GOLD:'GOLD'});

export const CHALLENGE_DEFINITIONS=Object.freeze([
  Object.freeze({
    id:'distance-line',
    seedPolicy:'daily',
    targetType:'distance',
    targetValue:1800,
    allowedSport:'skateboard',
    allowedSetup:'any',
    constraints:Object.freeze({}),
    medals:Object.freeze({BRONZE:700,SILVER:1200,GOLD:1800})
  }),
  Object.freeze({
    id:'score-attack',
    seedPolicy:'daily',
    targetType:'score',
    targetValue:6500,
    allowedSport:'skateboard',
    allowedSetup:'any',
    constraints:Object.freeze({}),
    medals:Object.freeze({BRONZE:1800,SILVER:3600,GOLD:6500})
  }),
  Object.freeze({
    id:'banana-route',
    seedPolicy:'daily',
    targetType:'bananas',
    targetValue:24,
    allowedSport:'skateboard',
    allowedSetup:'any',
    constraints:Object.freeze({}),
    medals:Object.freeze({BRONZE:8,SILVER:15,GOLD:24})
  }),
  Object.freeze({
    id:'clean-lines',
    seedPolicy:'daily',
    targetType:'cleanLandings',
    targetValue:12,
    allowedSport:'skateboard',
    allowedSetup:'any',
    constraints:Object.freeze({maxBananaPowerUses:2}),
    medals:Object.freeze({BRONZE:4,SILVER:8,GOLD:12})
  }),
  Object.freeze({
    id:'near-miss-flow',
    seedPolicy:'daily',
    targetType:'nearMisses',
    targetValue:14,
    allowedSport:'skateboard',
    allowedSetup:'any',
    constraints:Object.freeze({}),
    medals:Object.freeze({BRONZE:4,SILVER:8,GOLD:14})
  }),
  Object.freeze({
    id:'trick-session',
    seedPolicy:'daily',
    targetType:'tricksLanded',
    targetValue:10,
    allowedSport:'skateboard',
    allowedSetup:'any',
    constraints:Object.freeze({maxBananaPowerUses:3}),
    medals:Object.freeze({BRONZE:3,SILVER:6,GOLD:10})
  })
]);

export function hashString(value){
  let hash=0x811c9dc5;
  const text=String(value??'');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash>>>0;
}

export function utcDateKey(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))throw new TypeError('Invalid challenge date');
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}

export function utcWeekKey(value=new Date()){
  const date=value instanceof Date?new Date(value.getTime()):new Date(value);
  if(Number.isNaN(date.getTime()))throw new TypeError('Invalid challenge date');
  const day=date.getUTCDay()||7;
  date.setUTCDate(date.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const week=Math.ceil((((date-yearStart)/DAY_MS)+1)/7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

export function createChallengeSeed({periodKey,challengeVersion=CHALLENGE_VERSION,gameplayVersion=GAMEPLAY_VERSION}={}){
  if(!periodKey)throw new Error('Challenge seed requires a period key');
  const material=`urban-challenge|${periodKey}|${challengeVersion}|${gameplayVersion}`;
  return `uc-${hashString(material).toString(36)}-${hashString(material+'|seed').toString(36)}`;
}

function cloneDefinition(definition){
  return {
    ...definition,
    constraints:{...(definition.constraints||{})},
    medals:{...(definition.medals||{})}
  };
}

export function getDailyChallenge(date=new Date(),{
  challengeVersion=CHALLENGE_VERSION,
  gameplayVersion=GAMEPLAY_VERSION,
  definitions=CHALLENGE_DEFINITIONS
}={}){
  if(!Array.isArray(definitions)||definitions.length===0)throw new Error('Daily challenges require definitions');
  const dateKey=utcDateKey(date);
  const selectionHash=hashString(`${dateKey}|${challengeVersion}|${gameplayVersion}|definition`);
  const definition=cloneDefinition(definitions[selectionHash%definitions.length]);
  return {
    ...definition,
    id:`daily:${dateKey}:${definition.id}:${challengeVersion}`,
    period:'daily',
    dateKey,
    challengeVersion,
    gameplayVersion,
    seed:createChallengeSeed({periodKey:dateKey,challengeVersion,gameplayVersion})
  };
}

// Future-facing weekly architecture intentionally reuses the same data contract.
export function getWeeklyChallenge(date=new Date(),{
  challengeVersion=`${CHALLENGE_VERSION}-weekly`,
  gameplayVersion=GAMEPLAY_VERSION,
  definitions=CHALLENGE_DEFINITIONS
}={}){
  if(!Array.isArray(definitions)||definitions.length===0)throw new Error('Weekly challenges require definitions');
  const weekKey=utcWeekKey(date);
  const selectionHash=hashString(`${weekKey}|${challengeVersion}|${gameplayVersion}|definition`);
  const definition=cloneDefinition(definitions[selectionHash%definitions.length]);
  return {
    ...definition,
    id:`weekly:${weekKey}:${definition.id}:${challengeVersion}`,
    period:'weekly',
    weekKey,
    challengeVersion,
    gameplayVersion,
    seed:createChallengeSeed({periodKey:weekKey,challengeVersion,gameplayVersion})
  };
}

function challengeMetric(run,targetType){
  switch(targetType){
    case 'distance': return clampNumber(run?.distance);
    case 'score': return clampNumber(run?.score);
    case 'bananas': return clampNumber(run?.bananas);
    case 'tricks':
    case 'tricksLanded': return clampNumber(run?.tricksLanded);
    case 'cleanLandings': return clampNumber(run?.cleanLandings);
    case 'nearMisses': return clampNumber(run?.nearMisses);
    case 'cleanRunDuration': return clampNumber(run?.cleanRunDuration);
    default:return 0;
  }
}

export function challengeAllowsRun(challenge,run){
  if(!challenge||!run)return {allowed:false,reason:'missing-data'};
  if(challenge.allowedSport&&challenge.allowedSport!=='any'&&challenge.allowedSport!==run.sport)return {allowed:false,reason:'sport'};
  if(challenge.allowedSetup&&challenge.allowedSetup!=='any'&&challenge.allowedSetup!==run.setup)return {allowed:false,reason:'setup'};
  const maxPower=Number(challenge.constraints?.maxBananaPowerUses);
  if(Number.isFinite(maxPower)&&(Number(run.bananaPowerUses)||0)>maxPower)return {allowed:false,reason:'banana-power-limit'};
  return {allowed:true,reason:''};
}

export function evaluateChallenge(challenge,run){
  const eligibility=challengeAllowsRun(challenge,run);
  const value=challengeMetric(run,challenge?.targetType);
  let medal=null;
  if(eligibility.allowed){
    if(value>=Number(challenge.medals?.GOLD||Infinity))medal=MEDAL_TIER.GOLD;
    else if(value>=Number(challenge.medals?.SILVER||Infinity))medal=MEDAL_TIER.SILVER;
    else if(value>=Number(challenge.medals?.BRONZE||Infinity))medal=MEDAL_TIER.BRONZE;
  }
  return {
    challengeId:challenge?.id||'',
    allowed:eligibility.allowed,
    reason:eligibility.reason,
    targetType:challenge?.targetType||'',
    targetValue:Number(challenge?.targetValue)||0,
    value,
    medal,
    completed:eligibility.allowed&&value>=Number(challenge?.targetValue||Infinity)
  };
}
