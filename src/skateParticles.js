const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export const SKATE_PARTICLE_KIND=Object.freeze({
  DUST:1,
  WET:2,
  SLIDE:3,
  SPARK:4,
  POWER:5
});

export const SKATE_PARTICLE_QUALITY=Object.freeze({
  max:1,
  high:.82,
  medium:.52,
  low:.22
});

const hash=n=>{
  const x=Math.sin(n*127.1+311.7)*43758.5453;
  return x-Math.floor(x);
};

export function createSkateParticlePool({capacity=256,quality='high'}={}){
  const count=Math.max(32,Math.floor(capacity));
  const positions=new Float32Array(count*3);
  const velocities=new Float32Array(count*3);
  const alpha=new Float32Array(count);
  const size=new Float32Array(count);
  const age=new Float32Array(count);
  const life=new Float32Array(count);
  const kinds=new Float32Array(count);
  const power=new Float32Array(count);
  const active=new Uint8Array(count);

  let cursor=0;
  let serial=0;
  let spawned=0;
  let qualityName=SKATE_PARTICLE_QUALITY[quality]!=null?quality:'high';

  function setQuality(next){
    qualityName=SKATE_PARTICLE_QUALITY[next]!=null?next:'high';
    return qualityName;
  }

  function spawnBurst({
    kind=SKATE_PARTICLE_KIND.DUST,
    x=0,y=0,z=0,
    intensity=.5,
    speed=1,
    powered=false,
    amount
  }={}){
    const scale=SKATE_PARTICLE_QUALITY[qualityName];
    const base=amount??(kind===SKATE_PARTICLE_KIND.SPARK?18:kind===SKATE_PARTICLE_KIND.POWER?22:12);
    const total=Math.max(0,Math.min(count,Math.round(base*scale*(.55+clamp(intensity)*.75))));

    for(let n=0;n<total;n++){
      const i=cursor++%count;
      const k=i*3;
      const r=hash(serial+n*7+1);
      const r2=hash(serial+n*11+5);
      const r3=hash(serial+n*17+9);
      active[i]=1;
      age[i]=0;
      life[i]=kind===SKATE_PARTICLE_KIND.SPARK
        ?.16+r*.26
        :kind===SKATE_PARTICLE_KIND.POWER
          ?.22+r*.34
          :.28+r*.44;
      positions[k]=x+(r-.5)*.18;
      positions[k+1]=y+r2*.08;
      positions[k+2]=z+(r3-.5)*.18;

      const velocityScale=(.55+clamp(speed/90)*1.45)*(kind===SKATE_PARTICLE_KIND.SPARK?3.2:1);
      velocities[k]=(r-.5)*velocityScale*2.2;
      velocities[k+1]=(kind===SKATE_PARTICLE_KIND.SPARK?1.4:kind===SKATE_PARTICLE_KIND.WET?.55:.85)+r2*velocityScale;
      velocities[k+2]=(r3-.5)*velocityScale*2.6;
      size[i]=(kind===SKATE_PARTICLE_KIND.SPARK?2.4:4.2)+r*5.2;
      alpha[i]=.34+r2*.54;
      kinds[i]=kind;
      power[i]=powered?1:0;
      serial++;
      spawned++;
    }
    return total;
  }

  function step(dt,worldSpeed=0){
    const delta=Math.max(0,Number(dt)||0);
    const advance=(Number(worldSpeed)||0)*delta;

    for(let i=0;i<count;i++){
      if(!active[i])continue;
      age[i]+=delta;
      if(age[i]>=life[i]){
        active[i]=0;
        alpha[i]=0;
        continue;
      }

      const k=i*3;
      positions[k]+=velocities[k]*delta;
      positions[k+1]+=velocities[k+1]*delta;
      positions[k+2]+=velocities[k+2]*delta+advance;
      velocities[k]*=Math.pow(.16,delta);
      velocities[k+1]-=6.8*delta;
      velocities[k+2]*=Math.pow(.18,delta);
      alpha[i]=Math.max(0,(1-age[i]/life[i])*(kinds[i]===SKATE_PARTICLE_KIND.SPARK?1:.72));
    }
  }

  function reset(){
    active.fill(0);
    alpha.fill(0);
    age.fill(0);
    life.fill(0);
  }

  function diagnostics(){
    let activeCount=0;
    for(let i=0;i<count;i++)activeCount+=active[i]?1:0;
    return {
      capacity:count,
      activeCount,
      spawned,
      quality:qualityName,
      qualityScale:SKATE_PARTICLE_QUALITY[qualityName]
    };
  }

  return {
    spawnBurst,
    step,
    reset,
    setQuality,
    diagnostics,
    arrays:{positions,alpha,size,kinds,power,active}
  };
}
