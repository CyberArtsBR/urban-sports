import * as THREE from 'three';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function terrainHeight(x,z){
  const downhill=-z;

  // Urban Sports uses explicit forward arcade speed, so the street does not
  // need a mountain-grade heightfield to propel the rider. Keep only broad,
  // low-amplitude road undulation so jumps/landings still have organic ground
  // contact without making sidewalks or city props visibly float.
  const longGrade=
    Math.sin(downhill*.0062+.75)*.045+
    Math.sin(downhill*.0028-.20)*.026;
  const surface=
    Math.sin(downhill*.031)*.014+
    Math.sin(downhill*.013+.55)*.010;

  // Very subtle crown: center lanes sit a few centimeters above the edges,
  // similar to a drained city street. It remains far below curb height.
  const across=clamp(Math.abs(x)/14,0,1);
  const crown=(1-across*across)*.018;

  return longGrade+surface+crown;
}

export function sampleSkiGround(heightFn,x,z,heading=0,halfWidth=.235){
  const halfLength=.68;
  const sin=Math.sin(heading),cos=Math.cos(heading);

  const leftX=x-cos*halfWidth;
  const leftZ=z-sin*halfWidth;
  const rightX=x+cos*halfWidth;
  const rightZ=z+sin*halfWidth;
  const frontX=x+sin*halfLength;
  const frontZ=z-cos*halfLength;
  const backX=x-sin*halfLength;
  const backZ=z+cos*halfLength;

  const leftGround=heightFn(leftX,leftZ);
  const rightGround=heightFn(rightX,rightZ);
  const frontGround=heightFn(frontX,frontZ);
  const backGround=heightFn(backX,backZ);
  const centerGround=heightFn(x,z);

  return {
    centerGround,
    leftGround,
    rightGround,
    frontGround,
    backGround,
    groundRoll:Math.atan2(rightGround-leftGround,halfWidth*2),
    groundPitch:Math.atan2(frontGround-backGround,halfLength*2)
  };
}

export function displaceTerrainChunk(geometry,chunkWorldZ,heightFn=terrainHeight){
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i);
    const localWorldZ=-position.getY(i);
    position.setZ(i,heightFn(x,chunkWorldZ+localWorldZ));
  }
  position.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.attributes.normal.needsUpdate=true;
}

export function dampTerrainContact(target,current,dt){
  const response=10;
  current.groundPitch=THREE.MathUtils.damp(current.groundPitch||0,target.groundPitch,response,dt);
  current.groundRoll=THREE.MathUtils.damp(current.groundRoll||0,target.groundRoll,response,dt);
  current.leftGround=target.leftGround;
  current.rightGround=target.rightGround;
  current.centerGround=target.centerGround;
  return current;
}
