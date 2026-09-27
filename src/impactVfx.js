import * as THREE from 'three';

const clamp=THREE.MathUtils.clamp;
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

export const RIDER_VFX_KIND=Object.freeze({
  IMPACT:0,
  GRIT:1,
  SMOKE:2,
  WATER:3,
  SPARK:4
});

export function createImpactVfx({scene,capacity=224}={}){
  const count=Math.max(64,Math.floor(capacity));
  const positions=new Float32Array(count*3);
  const velocities=new Float32Array(count*3);
  const alphas=new Float32Array(count);
  const sizes=new Float32Array(count);
  const shades=new Float32Array(count);
  const kinds=new Float32Array(count);
  const ages=new Float32Array(count);
  const lives=new Float32Array(count);
  const active=new Uint8Array(count);

  const geometry=new THREE.BufferGeometry();
  const pa=new THREE.BufferAttribute(positions,3);
  const aa=new THREE.BufferAttribute(alphas,1);
  const sa=new THREE.BufferAttribute(sizes,1);
  const sha=new THREE.BufferAttribute(shades,1);
  const ka=new THREE.BufferAttribute(kinds,1);
  for(const attribute of [pa,aa,sa,sha,ka])attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',pa);
  geometry.setAttribute('aAlpha',aa);
  geometry.setAttribute('aSize',sa);
  geometry.setAttribute('aShade',sha);
  geometry.setAttribute('aKind',ka);

  const material=new THREE.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    depthTest:true,
    vertexShader:[
      'attribute float aAlpha;',
      'attribute float aSize;',
      'attribute float aShade;',
      'attribute float aKind;',
      'varying float vAlpha;',
      'varying float vShade;',
      'varying float vKind;',
      'void main(){',
      'vAlpha=aAlpha;vShade=aShade;vKind=aKind;',
      'vec4 mv=modelViewMatrix*vec4(position,1.0);',
      'gl_Position=projectionMatrix*mv;',
      'gl_PointSize=aSize*clamp(22.0/max(1.0,-mv.z),.55,2.4);',
      '}'
    ].join('\n'),
    fragmentShader:[
      'varying float vAlpha;',
      'varying float vShade;',
      'varying float vKind;',
      'void main(){',
      'vec2 p=gl_PointCoord-.5;',
      'float d=length(p);',
      'if(d>.5)discard;',
      'float body=1.0-smoothstep(.34,.50,d);',
      'float soft=1.0-smoothstep(.10,.50,d);',
      'float spec=pow(max(0.0,1.0-length(p-vec2(-.16,.17))/.20),4.0);',
      'float shade=clamp(vShade,0.0,1.0);',
      'vec3 color;',
      'if(vKind<.5){color=mix(vec3(.115,.004,.010),vec3(.38,.010,.024),shade);color+=spec*vec3(.20,.035,.040);}',
      'else if(vKind<1.5){color=mix(vec3(.20,.17,.13),vec3(.55,.48,.36),shade);color+=spec*vec3(.12,.10,.07);}',
      'else if(vKind<2.5){color=mix(vec3(.30),vec3(.76),shade);}',
      'else if(vKind<3.5){color=mix(vec3(.18,.42,.58),vec3(.78,.91,1.0),shade);color+=spec*vec3(.22,.28,.34);}',
      'else{color=mix(vec3(.95,.20,.015),vec3(1.0,.92,.30),shade);color+=spec*vec3(.38,.18,.02);}',
      'float alpha=vAlpha*body*(vKind>1.5&&vKind<2.5?.78+.22*soft:.86+.14*soft);',
      'if(alpha<.006)discard;',
      'gl_FragColor=vec4(color,alpha);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '}'
    ].join('\n')
  });

  const points=new THREE.Points(geometry,material);
  points.name='rider-impact-surface-vfx';
  points.frustumCulled=false;
  points.renderOrder=12;
  scene?.add(points);

  let cursor=0;
  let serial=0;

  function touchAttributes(){
    pa.needsUpdate=true;
    aa.needsUpdate=true;
    sa.needsUpdate=true;
    sha.needsUpdate=true;
    ka.needsUpdate=true;
  }

  function spawn(x,y,z,vx,vy,vz,size,life,alpha,shade,kind=RIDER_VFX_KIND.IMPACT){
    const i=cursor++%count,k=i*3;
    active[i]=1;
    ages[i]=0;
    lives[i]=Math.max(.12,life);
    positions[k]=x;positions[k+1]=y;positions[k+2]=z;
    velocities[k]=vx;velocities[k+1]=vy;velocities[k+2]=vz;
    sizes[i]=size;
    alphas[i]=alpha;
    shades[i]=shade;
    kinds[i]=kind;
    serial++;
  }

  function emitCloud({
    x=0,y=.2,z=0,direction=1,speed=18,severity=1,kind=RIDER_VFX_KIND.GRIT,
    amount=8,spread=2.2,vertical=2.2,life=.42,size=5,alpha=.62,reducedMotion=false
  }={}){
    const motionScale=reducedMotion?.58:1;
    const particleScale=reducedMotion?.55:1;
    const total=Math.max(1,Math.round(amount*particleScale*clamp(severity,.25,1.5)));
    const dir=Math.sign(Number(direction)||1);
    const speed01=clamp((Number(speed)||0)/32,0,1);
    for(let n=0;n<total;n++){
      const r=hash(serial+n*5+11),r2=hash(serial+n*7+29),r3=hash(serial+n*13+3);
      const angle=(r-.5)*Math.PI*1.7;
      const radial=(.35+r2*spread)*motionScale;
      const away=dir*(.18+r3*(.65+speed01*1.25))*motionScale;
      spawn(
        x+(r-.5)*.30,
        y+(r2-.5)*.10,
        z+(r3-.5)*.26,
        Math.cos(angle)*radial+away,
        (.55+r2*vertical)*motionScale,
        Math.sin(angle)*radial+(r3-.5)*.85,
        size*(.72+r*.62),
        life*(.75+r2*.55),
        alpha*(.72+r3*.28),
        r2,
        kind
      );
    }
    touchAttributes();
    return total;
  }

  function burst({x=0,y=.5,z=0,direction=1,speed=40,severity=1,reducedMotion=false}={}){
    const strength=clamp(Number(severity)||1,.35,1.25);
    const speed01=clamp((Number(speed)-35)/50,0,1);
    return emitCloud({
      x,y,z,direction,speed,severity:strength,
      kind:RIDER_VFX_KIND.IMPACT,
      amount:42+speed01*32,
      spread:5.6,
      vertical:5.4+speed01*3,
      life:.62,
      size:7.1,
      alpha:.82,
      reducedMotion
    });
  }

  function puddleSplash(options={}){
    return emitCloud({
      ...options,
      kind:RIDER_VFX_KIND.WATER,
      amount:options.amount??12,
      spread:options.spread??2.8,
      vertical:options.vertical??2.6,
      life:options.life??.38,
      size:options.size??5.4,
      alpha:options.alpha??.70
    });
  }

  function skateEvent(event={},context={}){
    const type=String(event.type||'');
    if(!type)return 0;
    const wetness=clamp(Number(context.wetness)||0,0,1);
    const reducedMotion=!!context.reducedMotion;
    const common={
      x:Number(context.x)||0,
      y:Number(context.y)||.16,
      z:Number(context.z)||0,
      direction:Number(context.direction)||1,
      speed:Number(context.speed??event.speed)||0,
      reducedMotion
    };
    const eventIntensity=clamp(Number(event.intensity??event.slip??event.balance??1)||1,.2,1.35);

    if(type==='wheelRoll'){
      return emitCloud({
        ...common,
        kind:wetness>.18?RIDER_VFX_KIND.WATER:RIDER_VFX_KIND.GRIT,
        severity:.35+eventIntensity*.20,
        amount:wetness>.18?3:2,
        spread:wetness>.18?1.25:.72,
        vertical:wetness>.18?1.15:.62,
        life:wetness>.18?.30:.24,
        size:wetness>.18?3.8:3.2,
        alpha:wetness>.18?.52:.38
      });
    }
    if(type==='powerslideLoop'||type==='powerslideStart'){
      return emitCloud({
        ...common,
        kind:wetness>.18?RIDER_VFX_KIND.WATER:RIDER_VFX_KIND.SMOKE,
        severity:.65+eventIntensity*.35,
        amount:type==='powerslideStart'?9:6,
        spread:wetness>.18?2.7:2.1,
        vertical:wetness>.18?2.2:1.45,
        life:wetness>.18?.42:.58,
        size:wetness>.18?5.0:6.0,
        alpha:wetness>.18?.62:.42
      });
    }
    if(type==='tailPop'){
      return emitCloud({...common,kind:RIDER_VFX_KIND.GRIT,severity:.72,amount:7,spread:1.6,vertical:1.65,life:.32,size:4.2,alpha:.48});
    }
    if(type==='grindStart'||type==='grindLoop'||type==='grindEnd'){
      return emitCloud({
        ...common,
        kind:RIDER_VFX_KIND.SPARK,
        severity:.72+eventIntensity*.30,
        amount:type==='grindLoop'?4:9,
        spread:2.4,
        vertical:1.3,
        life:.26,
        size:3.5,
        alpha:.88
      });
    }
    if(type==='land'||type==='hardLand'||type==='trickLand'||type==='trickFail'){
      const hard=type==='hardLand'||type==='trickFail';
      if(wetness>.18)return puddleSplash({...common,severity:hard?1.05:.72,amount:hard?16:9,reducedMotion});
      return emitCloud({...common,kind:RIDER_VFX_KIND.GRIT,severity:hard?1.05:.68,amount:hard?14:8,spread:2.4,vertical:1.8,life:.36,size:4.8,alpha:.56});
    }
    if(type==='manualEnd'&&String(event.reason||'')==='balance'){
      return emitCloud({...common,kind:RIDER_VFX_KIND.SPARK,severity:.55,amount:4,spread:1.4,vertical:.65,life:.20,size:2.8,alpha:.74});
    }
    return 0;
  }

  function update(dt){
    let pd=false,ad=false,sd=false;
    for(let i=0;i<count;i++){
      if(!active[i])continue;
      ages[i]+=dt;
      if(ages[i]>=lives[i]){
        active[i]=0;
        alphas[i]=0;
        ad=true;
        continue;
      }
      const k=i*3;
      positions[k]+=velocities[k]*dt;
      positions[k+1]+=velocities[k+1]*dt;
      positions[k+2]+=velocities[k+2]*dt;
      const kind=kinds[i];
      const damping=kind===RIDER_VFX_KIND.SPARK?.18:kind===RIDER_VFX_KIND.SMOKE?.48:.30;
      velocities[k]*=Math.pow(damping,dt);
      velocities[k+1]-=(kind===RIDER_VFX_KIND.SMOKE?1.8:12.4)*dt;
      velocities[k+2]*=Math.pow(kind===RIDER_VFX_KIND.SMOKE?.52:.34,dt);
      const t=ages[i]/lives[i];
      alphas[i]=Math.min(alphas[i],(1-t)*(1-t)*.92);
      sizes[i]*=1+dt*(kind===RIDER_VFX_KIND.SMOKE?.34:.12);
      if(positions[k+1]<-1.4){active[i]=0;alphas[i]=0;}
      pd=ad=sd=true;
    }
    if(pd)pa.needsUpdate=true;
    if(ad)aa.needsUpdate=true;
    if(sd)sa.needsUpdate=true;
  }

  function reset(){
    active.fill(0);
    alphas.fill(0);
    ages.fill(0);
    lives.fill(0);
    aa.needsUpdate=true;
  }

  function dispose(){
    scene?.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return {burst,puddleSplash,skateEvent,update,reset,dispose,points,capacity:count};
}
