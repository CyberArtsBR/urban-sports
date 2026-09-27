import {RIDE_MODE} from './rideMode.js';

export const SPORT_ID=Object.freeze({
  SKATEBOARD:'skateboard',
  INLINE:'inline',
  BMX:'bmx'
});

const REQUIRED_FIELDS=Object.freeze([
  'id','physics','equipment','animator','inputMap','scoring','cameraTuning',
  'audioProfile','courseProfile','uiCopy','displaySpeed','setupProfiles','diagnostics'
]);

function freezeRecord(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const nested of Object.values(value))freezeRecord(nested);
  return Object.freeze(value);
}

/**
 * @typedef {Object} SportDefinition
 * @property {string} id
 * @property {string|null} physics
 * @property {string} equipment
 * @property {string|null} animator
 * @property {string} inputMap
 * @property {string} scoring
 * @property {string} cameraTuning
 * @property {string} audioProfile
 * @property {string} courseProfile
 * @property {{label:string,shortLabel:string}} uiCopy
 * @property {string} displaySpeed
 * @property {{legacyRideMode:string,stance:string,wheelCount:number}} setupProfiles
 * @property {Object} diagnostics
 */

export function defineSport(definition){
  if(!definition||typeof definition!=='object')throw new TypeError('SportDefinition must be an object');
  for(const field of REQUIRED_FIELDS){
    if(!(field in definition))throw new TypeError('SportDefinition missing '+field);
  }
  if(!Object.values(SPORT_ID).includes(definition.id))throw new TypeError('Unknown sport id: '+definition.id);
  if(!definition.uiCopy?.label)throw new TypeError('SportDefinition requires uiCopy.label');
  return freezeRecord({...definition});
}

const DEFINITIONS=Object.freeze({
  [SPORT_ID.SKATEBOARD]:defineSport({
    id:SPORT_ID.SKATEBOARD,
    physics:'skateboard-native',
    equipment:'skateboard',
    animator:'skateboard',
    inputMap:'urban-skateboard-v1',
    scoring:'urban-tricks-v1',
    cameraTuning:'urban-chase-v1',
    audioProfile:'skateboard',
    courseProfile:'urban-street-v1',
    uiCopy:{label:'SKATEBOARD',shortLabel:'SKATE'},
    displaySpeed:'skateboard',
    setupProfiles:{legacyRideMode:RIDE_MODE.SNOWBOARD,stance:'sideways',wheelCount:4},
    diagnostics:{
      status:'active',
      nativePhysics:true,
      supportsGrinding:true,
      supportsManuals:true,
      supportsPowerslides:true
    }
  }),
  [SPORT_ID.INLINE]:defineSport({
    id:SPORT_ID.INLINE,
    physics:null,
    equipment:'inline-skates',
    animator:null,
    inputMap:'urban-inline-reserved',
    scoring:'urban-tricks-reserved',
    cameraTuning:'urban-chase-v1',
    audioProfile:'inline-reserved',
    courseProfile:'urban-street-v1',
    uiCopy:{label:'INLINE',shortLabel:'INLINE'},
    displaySpeed:'legacy',
    setupProfiles:{legacyRideMode:RIDE_MODE.SKI,stance:'forward',wheelCount:8},
    diagnostics:{status:'planned',nativePhysics:false,supportsGrinding:true,supportsManuals:false,supportsPowerslides:false}
  }),
  [SPORT_ID.BMX]:defineSport({
    id:SPORT_ID.BMX,
    physics:null,
    equipment:'bmx',
    animator:null,
    inputMap:'urban-bmx-reserved',
    scoring:'urban-tricks-reserved',
    cameraTuning:'urban-chase-v1',
    audioProfile:'bmx-reserved',
    courseProfile:'urban-street-v1',
    uiCopy:{label:'BMX',shortLabel:'BMX'},
    displaySpeed:'legacy',
    setupProfiles:{legacyRideMode:RIDE_MODE.SNOWBOARD,stance:'bike',wheelCount:2},
    diagnostics:{status:'planned',nativePhysics:false,supportsGrinding:true,supportsManuals:false,supportsPowerslides:false}
  })
});

export function normalizeSportId(value){
  const id=String(value??'').trim().toLowerCase();
  return DEFINITIONS[id]?id:SPORT_ID.SKATEBOARD;
}

export function getSportDefinition(value=SPORT_ID.SKATEBOARD){
  return DEFINITIONS[normalizeSportId(value)];
}

export function listSportDefinitions(){
  return Object.values(DEFINITIONS);
}
