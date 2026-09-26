import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const CINEMATIC_PROFILE='max-cinematic';
const LUT_SIZE=16;
const _sunNdc=new THREE.Vector3();

function clamp01(value){return THREE.MathUtils.clamp(Number(value)||0,0,1);}
function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}

const GRADE_PRESETS=Object.freeze({
  day:Object.freeze({gain:[1.035,1.015,.985],lift:[.002,.004,.008],contrast:1.035,saturation:1.015}),
  sunset:Object.freeze({gain:[1.085,1.025,.94],lift:[.006,.000,.010],contrast:1.055,saturation:1.055}),
  night:Object.freeze({gain:[.88,.98,1.105],lift:[.004,.010,.022],contrast:1.025,saturation:.94}),
  overcast:Object.freeze({gain:[.94,1.00,1.055],lift:[.006,.009,.014],contrast:.99,saturation:.90}),
  storm:Object.freeze({gain:[.89,.96,1.055],lift:[.004,.008,.014],contrast:1.02,saturation:.82})
});

function gradeName(weather={}){
  const preset=String(weather?.preset||weather?.mode||'day').toLowerCase();
  if(preset==='sunset')return 'sunset';
  if(preset==='night'||preset==='rain')return 'night';
  if(preset==='snow')return 'overcast';
  if(preset==='storm')return 'storm';
  return 'day';
}

function gradedRgb(r,g,b,preset){
  const p=GRADE_PRESETS[preset]||GRADE_PRESETS.day;
  const luma=r*.2126+g*.7152+b*.0722;
  r=luma+(r-luma)*p.saturation;
  g=luma+(g-luma)*p.saturation;
  b=luma+(b-luma)*p.saturation;
  r=(r-.5)*p.contrast+.5;
  g=(g-.5)*p.contrast+.5;
  b=(b-.5)*p.contrast+.5;
  r=r*p.gain[0]+p.lift[0];
  g=g*p.gain[1]+p.lift[1];
  b=b*p.gain[2]+p.lift[2];
  return [clamp01(r),clamp01(g),clamp01(b)];
}

function createLutTexture(name,size=LUT_SIZE){
  const width=size*size,height=size;
  const data=new Uint8Array(width*height*4);
  let offset=0;
  for(let g=0;g<size;g++){
    for(let b=0;b<size;b++){
      for(let r=0;r<size;r++){
        const [rr,gg,bb]=gradedRgb(r/(size-1),g/(size-1),b/(size-1),name);
        data[offset++]=Math.round(rr*255);
        data[offset++]=Math.round(gg*255);
        data[offset++]=Math.round(bb*255);
        data[offset++]=255;
      }
    }
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.name='urban-cinematic-lut-'+name;
  texture.minFilter=THREE.LinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.generateMipmaps=false;
  texture.colorSpace=THREE.NoColorSpace;
  texture.needsUpdate=true;
  return texture;
}

const LUT_SHADER={
  name:'UrbanCinematicLUT',
  uniforms:{
    tDiffuse:{value:null},
    tLut:{value:null},
    lutSize:{value:LUT_SIZE},
    intensity:{value:.82}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tLut;
    uniform float lutSize;
    uniform float intensity;
    varying vec2 vUv;

    vec3 sampleLut(vec3 color){
      color=clamp(color,0.0,1.0);
      float blue=color.b*(lutSize-1.0);
      float slice0=floor(blue);
      float slice1=min(lutSize-1.0,slice0+1.0);
      float width=lutSize*lutSize;
      float x0=(slice0*lutSize+color.r*(lutSize-1.0)+0.5)/width;
      float x1=(slice1*lutSize+color.r*(lutSize-1.0)+0.5)/width;
      float y=(color.g*(lutSize-1.0)+0.5)/lutSize;
      vec3 a=texture2D(tLut,vec2(x0,y)).rgb;
      vec3 b=texture2D(tLut,vec2(x1,y)).rgb;
      return mix(a,b,fract(blue));
    }

    void main(){
      vec4 source=texture2D(tDiffuse,vUv);
      float hdrScale=max(1.0,max(source.r,max(source.g,source.b)));
      vec3 mapped=sampleLut(source.rgb/hdrScale)*hdrScale;
      gl_FragColor=vec4(mix(source.rgb,mapped,clamp(intensity,0.0,1.0)),source.a);
    }
  `
};

const SHARPEN_SHADER={
  name:'UrbanCinematicCAS',
  uniforms:{
    tDiffuse:{value:null},
    resolution:{value:new THREE.Vector2(1,1)},
    strength:{value:.30}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;

    void main(){
      vec2 px=1.0/max(resolution,vec2(1.0));
      vec4 c=texture2D(tDiffuse,vUv);
      vec3 n=texture2D(tDiffuse,vUv+vec2(0.0,px.y)).rgb;
      vec3 s=texture2D(tDiffuse,vUv-vec2(0.0,px.y)).rgb;
      vec3 e=texture2D(tDiffuse,vUv+vec2(px.x,0.0)).rgb;
      vec3 w=texture2D(tDiffuse,vUv-vec2(px.x,0.0)).rgb;
      vec3 blur=(n+s+e+w)*.25;
      vec3 detail=c.rgb-blur;
      float luma=dot(c.rgb,vec3(.2126,.7152,.0722));
      float edge=max(max(length(c.rgb-n),length(c.rgb-s)),max(length(c.rgb-e),length(c.rgb-w)));
      float adaptive=(1.0-smoothstep(.20,.72,luma))*0.20+0.80;
      adaptive*=1.0-smoothstep(.20,.70,edge);
      vec3 result=c.rgb+detail*strength*adaptive;
      gl_FragColor=vec4(max(result,vec3(0.0)),c.a);
    }
  `
};

const DOF_SHADER={
  name:'UrbanCinematicDOF',
  uniforms:{
    tDiffuse:{value:null},
    resolution:{value:new THREE.Vector2(1,1)},
    strength:{value:0}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;

    void main(){
      vec2 px=1.0/max(resolution,vec2(1.0));
      vec2 focus=vec2(.5,.48);
      float radial=smoothstep(.20,.72,distance(vUv,focus));
      float amount=clamp(strength*radial,0.0,1.0);
      vec2 o=px*(1.2+amount*4.0);
      vec4 base=texture2D(tDiffuse,vUv);
      vec3 blur=texture2D(tDiffuse,vUv+vec2(o.x,0.0)).rgb+
                texture2D(tDiffuse,vUv-vec2(o.x,0.0)).rgb+
                texture2D(tDiffuse,vUv+vec2(0.0,o.y)).rgb+
                texture2D(tDiffuse,vUv-vec2(0.0,o.y)).rgb+
                texture2D(tDiffuse,vUv+o).rgb+
                texture2D(tDiffuse,vUv-o).rgb;
      blur/=6.0;
      gl_FragColor=vec4(mix(base.rgb,blur,amount*.72),base.a);
    }
  `
};

class ReducedAtmospherePass extends Pass{
  constructor({scale=.5}={}){
    super();
    this.needsSwap=true;
    this.scale=THREE.MathUtils.clamp(finite(scale,.5),.25,.5);
    this.width=1;
    this.height=1;
    this.target=new THREE.WebGLRenderTarget(1,1,{
      type:THREE.HalfFloatType,
      minFilter:THREE.LinearFilter,
      magFilter:THREE.LinearFilter,
      depthBuffer:false,
      stencilBuffer:false
    });
    this.target.texture.name='urban-cinematic-atmosphere';
    this.downsampleMaterial=new THREE.ShaderMaterial({
      name:'UrbanCinematicAtmosphereLowRes',
      depthTest:false,
      depthWrite:false,
      uniforms:{
        tDiffuse:{value:null},
        tDepth:{value:null},
        cameraNear:{value:.1},
        cameraFar:{value:1000},
        maxDistance:{value:420},
        time:{value:0},
        fogDensity:{value:.003},
        storm:{value:0},
        night:{value:0},
        rain:{value:0},
        sunUv:{value:new THREE.Vector2(.5,.25)},
        shaftStrength:{value:0},
        hazeStrength:{value:.08}
      },
      vertexShader:`
        varying vec2 vUv;
        void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
      `,
      fragmentShader:`
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float maxDistance;
        uniform float time;
        uniform float fogDensity;
        uniform float storm;
        uniform float night;
        uniform float rain;
        uniform vec2 sunUv;
        uniform float shaftStrength;
        uniform float hazeStrength;
        varying vec2 vUv;

        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
        float viewDistance(float depth){
          float z=depth*2.0-1.0;
          return (2.0*cameraNear*cameraFar)/max(.0001,cameraFar+cameraNear-z*(cameraFar-cameraNear));
        }

        void main(){
          vec3 src=texture2D(tDiffuse,vUv).rgb;
          float depth=texture2D(tDepth,vUv).x;
          float distanceFade=smoothstep(32.0,max(48.0,maxDistance),viewDistance(depth));
          float corridor=1.0-smoothstep(.08,.46,abs(vUv.x-.5));
          corridor*=1.0-smoothstep(.30,.83,vUv.y);
          float horizon=1.0-smoothstep(.18,.96,vUv.y);
          float mist=(.22+.78*horizon)*(1.0-corridor*.78)*mix(.22,1.0,distanceFade);
          float noise=hash(floor(vUv*vec2(260.0,150.0))+floor(time*3.0))-.5;
          float density=clamp(hazeStrength+fogDensity*16.0+storm*.055+rain*.035,0.0,.34);
          vec3 haze=mix(vec3(.70,.78,.84),vec3(.43,.54,.68),clamp(night+storm*.42,0.0,1.0));
          vec2 ray=vUv-sunUv;
          float radial=exp(-dot(ray,ray)*7.0);
          float streak=.78+.22*sin(length(ray)*145.0-time*.18);
          float shafts=radial*streak*shaftStrength*(1.0-corridor*.58)*mix(.28,1.0,distanceFade);
          float fogAmount=clamp(mist*density+noise*.004*distanceFade,0.0,.38);
          float highlightGuard=1.0-smoothstep(1.0,3.5,max(src.r,max(src.g,src.b)));
          fogAmount*=mix(.65,1.0,highlightGuard);
          vec3 premultipliedScatter=haze*fogAmount+vec3(1.0,.78,.52)*shafts*.075;
          gl_FragColor=vec4(premultipliedScatter,fogAmount);
        }
      `
    });
    this.compositeMaterial=new THREE.ShaderMaterial({
      name:'UrbanCinematicAtmosphereComposite',
      depthTest:false,
      depthWrite:false,
      uniforms:{tDiffuse:{value:null},tAtmosphere:{value:null}},
      vertexShader:`
        varying vec2 vUv;
        void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
      `,
      fragmentShader:`
        uniform sampler2D tDiffuse;
        uniform sampler2D tAtmosphere;
        varying vec2 vUv;
        void main(){
          vec4 source=texture2D(tDiffuse,vUv);
          vec4 atmosphere=texture2D(tAtmosphere,vUv);
          vec3 result=source.rgb*(1.0-atmosphere.a)+atmosphere.rgb;
          gl_FragColor=vec4(result,source.a);
        }
      `
    });
    this.fsQuad=new FullScreenQuad(this.downsampleMaterial);
  }
  setResolutionScale(scale){
    this.scale=THREE.MathUtils.clamp(finite(scale,this.scale),.25,.5);
    this.setSize(this.width,this.height);
  }
  setSize(width,height){
    this.width=Math.max(1,Math.floor(width));
    this.height=Math.max(1,Math.floor(height));
    this.target.setSize(
      Math.max(1,Math.floor(this.width*this.scale)),
      Math.max(1,Math.floor(this.height*this.scale))
    );
  }
  render(renderer,writeBuffer,readBuffer){
    const previousTarget=renderer.getRenderTarget();
    this.downsampleMaterial.uniforms.tDiffuse.value=readBuffer.texture;
    this.fsQuad.material=this.downsampleMaterial;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    this.fsQuad.render(renderer);

    this.compositeMaterial.uniforms.tDiffuse.value=readBuffer.texture;
    this.compositeMaterial.uniforms.tAtmosphere.value=this.target.texture;
    this.fsQuad.material=this.compositeMaterial;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);
    if(this.clear)renderer.clear();
    this.fsQuad.render(renderer);
    renderer.setRenderTarget(previousTarget);
  }
  dispose(){
    this.target.dispose();
    this.downsampleMaterial.dispose();
    this.compositeMaterial.dispose();
    this.fsQuad.dispose();
  }
}

function supportsHalfFloatTarget(renderer){
  try{
    return !!renderer?.extensions?.has?.('EXT_color_buffer_float');
  }catch{return false;}
}

export function createRiderContactShadow({scene}={}){
  if(!scene)throw new TypeError('createRiderContactShadow requires scene');
  const geometry=new THREE.PlaneGeometry(1,1);
  const material=new THREE.ShaderMaterial({
    name:'UrbanRiderContactShadow',
    transparent:true,
    depthWrite:false,
    depthTest:true,
    toneMapped:false,
    uniforms:{opacity:{value:0}},
    vertexShader:`
      varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
    `,
    fragmentShader:`
      uniform float opacity;
      varying vec2 vUv;
      void main(){
        vec2 p=(vUv-.5)*2.0;
        float radius=dot(p,p);
        float alpha=(1.0-smoothstep(.05,1.0,radius))*opacity;
        gl_FragColor=vec4(0.015,0.022,0.03,alpha);
      }
    `
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='urban-rider-contact-shadow';
  mesh.rotation.x=-Math.PI/2;
  mesh.renderOrder=3;
  mesh.frustumCulled=false;
  mesh.visible=false;
  scene.add(mesh);

  function update({enabled=false,player=null,state=null,terrainHeight=null}={}){
    if(!enabled||!player||!state||typeof terrainHeight!=='function'){
      mesh.visible=false;
      material.uniforms.opacity.value=0;
      return;
    }
    const ground=finite(terrainHeight(state.x,player.position.z-state.travel),0)+.026;
    const height=Math.max(0,finite(player.position.y,ground)-ground);
    const landing=clamp01(state.landingPulse);
    const airborne=state.air?1:0;
    const opacity=THREE.MathUtils.clamp(.24*Math.exp(-height*.78)*(1+landing*.34)*(airborne?.72:1),0,.30);
    const spread=THREE.MathUtils.clamp(2.15+height*.32,2.15,3.75);
    mesh.visible=opacity>.006;
    mesh.position.set(player.position.x,ground,player.position.z+.05);
    mesh.rotation.set(-Math.PI/2+finite(state.groundPitch,0),0,-finite(state.groundRoll,0));
    mesh.scale.set(spread,spread*.58,1);
    material.uniforms.opacity.value=opacity;
  }

  function dispose(){
    mesh.removeFromParent();
    geometry.dispose();
    material.dispose();
  }

  return {mesh,update,dispose,getDiagnostics:()=>({enabled:mesh.visible,opacity:material.uniforms.opacity.value})};
}

export function createCinematicRendering({renderer,scene,camera,settings=null}={}){
  if(!renderer||!scene||!camera)throw new TypeError('createCinematicRendering requires renderer, scene and camera');

  let composer=null;
  let renderPass=null;
  let gtaoPass=null;
  let bloomPass=null;
  let atmospherePass=null;
  let lutPass=null;
  let dofPass=null;
  let sharpenPass=null;
  let outputPass=null;
  let active=false;
  let failed=false;
  let failureReason='';
  let width=1;
  let height=1;
  let pixelRatio=1;
  let currentGrade='day';
  let currentSettings=settings||{};
  let renderTargetType='none';
  let postRenderMs=0;
  let lastDofState=false;
  const lutTextures=new Map(Object.keys(GRADE_PRESETS).map(name=>[name,createLutTexture(name)]));
  const aoSize=new THREE.Vector2(1,1);

  function disposeComposer(){
    try{composer?.dispose?.();}catch{}
    try{gtaoPass?.dispose?.();}catch{}
    try{atmospherePass?.dispose?.();}catch{}
    try{bloomPass?.dispose?.();}catch{}
    try{lutPass?.dispose?.();}catch{}
    try{dofPass?.dispose?.();}catch{}
    try{sharpenPass?.dispose?.();}catch{}
    composer=null;
    renderPass=null;
    gtaoPass=null;
    bloomPass=null;
    atmospherePass=null;
    lutPass=null;
    dofPass=null;
    sharpenPass=null;
    outputPass=null;
    active=false;
  }

  function fail(error){
    failed=true;
    failureReason=String(error?.message||error||'cinematic pipeline failure');
    disposeComposer();
  }

  function ensure(){
    if(composer||failed)return !!composer;
    try{
      const halfFloat=supportsHalfFloatTarget(renderer);
      const type=halfFloat?THREE.HalfFloatType:THREE.UnsignedByteType;
      renderTargetType=halfFloat?'half-float':'unsigned-byte-fallback';
      const target=new THREE.WebGLRenderTarget(1,1,{
        type,
        format:THREE.RGBAFormat,
        minFilter:THREE.LinearFilter,
        magFilter:THREE.LinearFilter,
        depthBuffer:true,
        stencilBuffer:false
      });
      target.samples=0;
      target.texture.name='urban-max-cinematic-color';

      composer=new EffectComposer(renderer,target);
      renderPass=new RenderPass(scene,camera);
      composer.addPass(renderPass);

      gtaoPass=new GTAOPass(scene,camera,1,1);
      gtaoPass.output=GTAOPass.OUTPUT.Default;
      gtaoPass.blendIntensity=finite(currentSettings.aoIntensity,.82);
      gtaoPass.updateGtaoMaterial({
        radius:finite(currentSettings.aoRadius,.18),
        distanceExponent:1.3,
        thickness:finite(currentSettings.aoThickness,.75),
        distanceFallOff:.12,
        scale:1
      });
      gtaoPass.updatePdMaterial({
        lumaPhi:9,
        depthPhi:2,
        normalPhi:3,
        radius:5,
        radiusExponent:1.8,
        rings:2,
        samples:12
      });
      composer.addPass(gtaoPass);

      bloomPass=new UnrealBloomPass(
        new THREE.Vector2(1,1),
        finite(currentSettings.bloomStrength,.65),
        finite(currentSettings.bloomRadius,.48),
        finite(currentSettings.bloomThreshold,1.60)
      );
      composer.addPass(bloomPass);

      atmospherePass=new ReducedAtmospherePass({scale:finite(currentSettings.volumetricResolutionScale,.5)});
      atmospherePass.downsampleMaterial.uniforms.tDepth.value=gtaoPass.depthTexture;
      atmospherePass.downsampleMaterial.uniforms.cameraNear.value=camera.near;
      atmospherePass.downsampleMaterial.uniforms.cameraFar.value=camera.far;
      atmospherePass.downsampleMaterial.uniforms.maxDistance.value=finite(currentSettings.volumetricDistance,420);
      composer.addPass(atmospherePass);

      lutPass=new ShaderPass(LUT_SHADER);
      lutPass.uniforms.tLut.value=lutTextures.get(currentGrade);
      lutPass.uniforms.intensity.value=finite(currentSettings.colorGradeIntensity,.82);
      composer.addPass(lutPass);

      dofPass=new ShaderPass(DOF_SHADER);
      dofPass.enabled=false;
      composer.addPass(dofPass);

      sharpenPass=new ShaderPass(SHARPEN_SHADER);
      sharpenPass.uniforms.strength.value=finite(currentSettings.sharpenStrength,.30);
      composer.addPass(sharpenPass);

      outputPass=new OutputPass();
      composer.addPass(outputPass);
      resize(width,height,pixelRatio);
      configure(currentSettings);
      return true;
    }catch(error){
      fail(error);
      return false;
    }
  }

  function configure(next={}){
    currentSettings=next||{};
    const shouldEnable=currentSettings.profile===CINEMATIC_PROFILE;
    active=shouldEnable&&!failed;
    if(!shouldEnable)return false;
    if(!ensure())return false;

    gtaoPass.enabled=currentSettings.ambientOcclusion!==false;
    gtaoPass.blendIntensity=finite(currentSettings.aoIntensity,.82);
    gtaoPass.updateGtaoMaterial({
      radius:finite(currentSettings.aoRadius,.18),
      thickness:finite(currentSettings.aoThickness,.75)
    });

    bloomPass.enabled=currentSettings.bloomEnabled!==false;
    bloomPass.strength=finite(currentSettings.bloomStrength,.65);
    bloomPass.radius=finite(currentSettings.bloomRadius,.48);
    bloomPass.threshold=finite(currentSettings.bloomThreshold,1.60);

    atmospherePass.enabled=currentSettings.volumetricFog!==false||currentSettings.lightShafts!==false;
    atmospherePass.setResolutionScale(finite(currentSettings.volumetricResolutionScale,.5));
    atmospherePass.downsampleMaterial.uniforms.cameraNear.value=camera.near;
    atmospherePass.downsampleMaterial.uniforms.cameraFar.value=camera.far;
    atmospherePass.downsampleMaterial.uniforms.maxDistance.value=finite(currentSettings.volumetricDistance,420);

    lutPass.enabled=currentSettings.colorGrading!==false;
    lutPass.uniforms.intensity.value=finite(currentSettings.colorGradeIntensity,.82);

    sharpenPass.enabled=currentSettings.sharpenEnabled!==false;
    sharpenPass.uniforms.strength.value=finite(currentSettings.sharpenStrength,.30);

    resize(width,height,pixelRatio);
    return true;
  }

  function resize(nextWidth,nextHeight,nextPixelRatio=renderer.getPixelRatio()){
    width=Math.max(1,Math.floor(finite(nextWidth,width)));
    height=Math.max(1,Math.floor(finite(nextHeight,height)));
    pixelRatio=Math.max(.5,finite(nextPixelRatio,1));
    if(!composer)return;
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width,height);

    const effectiveWidth=Math.max(1,Math.floor(width*pixelRatio));
    const effectiveHeight=Math.max(1,Math.floor(height*pixelRatio));
    const aoScale=THREE.MathUtils.clamp(finite(currentSettings.aoResolutionScale,.5),.25,.75);
    const aoWidth=Math.max(1,Math.floor(effectiveWidth*aoScale));
    const aoHeight=Math.max(1,Math.floor(effectiveHeight*aoScale));
    gtaoPass?.setSize?.(aoWidth,aoHeight);
    aoSize.set(aoWidth,aoHeight);

    sharpenPass?.uniforms?.resolution?.value?.set(effectiveWidth,effectiveHeight);
    dofPass?.uniforms?.resolution?.value?.set(effectiveWidth,effectiveHeight);
  }

  function setContext({weather={},mode='playing',sun=null,time=0}={}){
    if(!composer)return;
    const nextGrade=gradeName(weather);
    if(nextGrade!==currentGrade){
      currentGrade=nextGrade;
      lutPass.uniforms.tLut.value=lutTextures.get(currentGrade)||lutTextures.get('day');
    }

    const uniforms=atmospherePass.downsampleMaterial.uniforms;
    const preset=String(weather?.preset||weather?.mode||'day').toLowerCase();
    const rain=clamp01(weather?.rain);
    const night=clamp01(weather?.night??(preset==='night'||preset==='rain'||preset==='storm'?1:0));
    const cloud=clamp01(weather?.cloud??(preset==='storm'?1:preset==='snow'?.88:.25));
    uniforms.time.value=finite(time,0);
    uniforms.rain.value=rain;
    uniforms.night.value=night;
    uniforms.storm.value=preset==='storm'?1:0;
    uniforms.fogDensity.value=finite(weather?.fogDensity,preset==='storm'?.0105:preset==='snow'?.0105:.0065);
    uniforms.hazeStrength.value=THREE.MathUtils.clamp(
      finite(currentSettings.volumetricDensity,.065)+cloud*.035+rain*.028,
      .025,.22
    );

    let shaft=0;
    if(currentSettings.lightShafts!==false){
      if(preset==='sunset')shaft=.72;
      else if(preset==='day')shaft=.18+cloud*.12;
      else if(preset==='storm')shaft=.04+clamp01(weather?.flash)*.12;
    }
    uniforms.shaftStrength.value=shaft;

    if(sun?.position){
      _sunNdc.copy(sun.position).project(camera);
      uniforms.sunUv.value.set(
        THREE.MathUtils.clamp(_sunNdc.x*.5+.5,-.25,1.25),
        THREE.MathUtils.clamp(_sunNdc.y*.5+.5,-.25,1.25)
      );
    }

    const cinematic=currentSettings.depthOfField==='cinematic'&&
      (mode==='countdown'||mode==='crashed'||mode==='results'||mode==='menu');
    dofPass.enabled=cinematic;
    dofPass.uniforms.strength.value=mode==='crashed'?.52:cinematic?.26:0;
    lastDofState=cinematic;
  }

  function render(delta=0){
    if(!active||!composer)return false;
    const started=globalThis.performance?.now?.()??0;
    try{
      composer.render(delta);
      const ended=globalThis.performance?.now?.()??started;
      postRenderMs=Math.max(0,ended-started);
      return true;
    }catch(error){
      fail(error);
      return false;
    }
  }

  function getDiagnostics(){
    return {
      profile:currentSettings?.profile||null,
      enabled:active&&!!composer,
      failed,
      failureReason:failureReason||null,
      renderTargetType,
      msaaSamples:0,
      postResolutionScale:1,
      bloomEnabled:!!bloomPass?.enabled,
      bloomStrength:bloomPass?.strength??0,
      bloomRadius:bloomPass?.radius??0,
      bloomThreshold:bloomPass?.threshold??0,
      ambientOcclusion:!!gtaoPass?.enabled,
      aoType:gtaoPass?'GTAO':null,
      aoResolutionScale:finite(currentSettings.aoResolutionScale,.5),
      aoResolution:gtaoPass?{width:aoSize.x,height:aoSize.y}:null,
      aoIntensity:gtaoPass?.blendIntensity??0,
      colorGrading:!!lutPass?.enabled,
      colorGrade:currentGrade,
      sharpenEnabled:!!sharpenPass?.enabled,
      sharpenStrength:sharpenPass?.uniforms?.strength?.value??0,
      volumetricFog:!!atmospherePass?.enabled&&currentSettings.volumetricFog!==false,
      volumetricResolutionScale:atmospherePass?.scale??0,
      volumetricResolution:atmospherePass?{width:atmospherePass.target.width,height:atmospherePass.target.height}:null,
      lightShafts:!!atmospherePass?.enabled&&currentSettings.lightShafts!==false,
      depthOfField:lastDofState,
      depthOfFieldMode:currentSettings.depthOfField||'off',
      postProcessingMs:Math.round(postRenderMs*1000)/1000,
      renderTargetCount:composer?2+(gtaoPass?3:0)+(atmospherePass?1:0):0
    };
  }

  function dispose(){
    disposeComposer();
    for(const texture of lutTextures.values())texture.dispose();
    lutTextures.clear();
  }

  configure(currentSettings);
  return {configure,resize,setContext,render,getDiagnostics,dispose,get active(){return active&&!!composer;}};
}
