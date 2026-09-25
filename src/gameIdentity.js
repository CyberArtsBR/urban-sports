export const GAME_IDENTITY=Object.freeze({
  title:'Chimpions Urban Sports',
  shortTitle:'Urban Sports',
  environment:'urban',
  defaultSport:'skateboard',
  sports:Object.freeze(['skateboard','inline','bmx'])
});

export const ENVIRONMENT_MODE=Object.freeze({
  URBAN:'urban',
  ALPINE:'alpine'
});

export function isUrbanGame(identity=GAME_IDENTITY){
  return identity?.environment===ENVIRONMENT_MODE.URBAN;
}
