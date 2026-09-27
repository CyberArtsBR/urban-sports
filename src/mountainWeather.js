import * as THREE from 'three';
import './mountainWeather.css';
import {createWeatherState,weatherName} from './weatherState.js';
import {createAlpineWeather} from './alpineWeather.js';
import {createStaticEnvironment} from './weatherAssets.js';
import {quality} from './renderQuality.js';
import {saveQualityPreference} from './userPreferences.js';
import {createUrbanAtmosphere} from './urban/urbanAtmosphere.js';

const budgets={
  high:{snowCount:850,rainCount:1400,splashCount:64,mistCount:18,glow:1},
  'max-cinematic':{snowCount:1200,rainCount:2000,splashCount:96,mistCount:24,glow:1},
  max:{snowCount:1200,rainCount:2000,splashCount:96,mistCount:24,glow:1},
  medium:{snowCount:420,rainCount:650,splashCount:32,mistCount:10,glow:.6},
  low:{snowCount:220,rainCount:320,splashCount:16,mistCount:6,glow:.35}
};

export function createMountainWeather({app,scene,camera,renderer,environment,audio}){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('chimpions-ski-atmosphere')||'{}')||{};}catch{}

  const query=new URLSearchParams(location.search);
  const preferences={
    weather:weatherName(query.get('weather')||saved.weather||'auto'),
    reducedFlashes:saved.reducedFlashes??matchMedia('(prefers-reduced-motion: reduce)').matches
  };
  const controller=createWeatherState(preferences.weather,preferences.reducedFlashes);

  // UrbanRuntimeEnvironment intentionally omits Alpine-only allocations such as
  // sky/snow materials/particles/surface detail. Weather must treat those
  // bindings as optional so the native Urban runtime can boot independently.
  const bindings=environment?.weatherBindings||{};
  const {
    sky=null,
    snowLayers=[],
    sun,
    ambient,
    rim,
    fill,
    snowMaterials=null,
    atmosphere=null,
    snowParticles=null,
    surfaceDetail=null
  }=bindings;

  if(sky)sky.visible=false;
  for(const layer of snowLayers||[]){
    if(!layer?.points)continue;
    layer.points.visible=false;
    layer.points.userData??={};
    layer.points.userData.externalWeather=true;
  }

  if(sun?.target&&!sun.target.parent)scene.add(sun.target);
  scene.environment??=createStaticEnvironment(renderer);

  const rendererWeather=createAlpineWeather({
    scene,camera,renderer,sun,ambient,rim,
    settings:budgets[quality.active]||budgets.high
  });
  const urbanAtmosphere=createUrbanAtmosphere({
    scene,renderer,ambient,rim,fill,quality:quality.active
  });

  const sceneMaterials=new Set();
  atmosphere?.traverse?.(object=>{
    for(const material of (Array.isArray(object.material)?object.material:[object.material])){
      if(material?.color)sceneMaterials.add(material);
    }
  });

  app.insertAdjacentHTML('beforeend',`<details class="graphics-panel" id="mountain-atmosphere"><summary aria-label="City atmosphere settings"><span aria-hidden="true">🌆</span> City atmosphere</summary><div class="graphics-content"><div class="graphics-heading">MAKE IT YOUR CITY</div><label>Graphics<select id="atmosphere-quality"><option value="auto">Auto</option><option value="high">High</option><option value="max-cinematic">Max Cinematic</option><option value="max">Legacy Max</option><option value="medium">Balanced</option><option value="low">Low</option></select></label><label>Atmosphere<select id="atmosphere-mode"><option value="auto">Changing skies</option><option value="day">City daylight</option><option value="sunset">Golden hour</option><option value="night">City night</option><option value="snow">Cold haze</option><option value="rain">Night rain</option><option value="storm">Thunderstorm</option></select></label><label class="graphics-toggle"><input type="checkbox" id="atmosphere-flashes"> Gentle lightning</label><p>Skies change gradually. Audio follows your sound settings. Riding physics stay the same.</p></div></details>`);

  const panel=document.getElementById('mountain-atmosphere');
  const mode=document.getElementById('atmosphere-mode');
  const qualitySelect=document.getElementById('atmosphere-quality');
  const flashes=document.getElementById('atmosphere-flashes');

  const persist=()=>{
    try{localStorage.setItem('chimpions-ski-atmosphere',JSON.stringify(preferences));}catch{}
  };

  mode.value=preferences.weather;
  flashes.checked=preferences.reducedFlashes;
  panel.addEventListener('keydown',event=>event.stopPropagation());
  mode.addEventListener('change',()=>{
    preferences.weather=weatherName(mode.value);
    controller.setMode(preferences.weather);
    persist();
  });
  flashes.addEventListener('change',()=>{
    preferences.reducedFlashes=flashes.checked;
    controller.setReducedFlashes(flashes.checked);
    persist();
  });
  qualitySelect.addEventListener('change',()=>{
    quality.setProfile(qualitySelect.value);
    saveQualityPreference(qualitySelect.value);
  });

  quality.subscribe(settings=>{
    rendererWeather.setQuality(budgets[settings.profile]||budgets.high);
    urbanAtmosphere.setQuality(settings.profile);
    qualitySelect.value=quality.current;
  },{immediate:true});

  const dryRoughness=new Map();
  const wetMaterials=new Set();
  for(const [name,material] of Object.entries(environment?.courseMaterials||{})){
    if(!['rock','trunk','log','logEnd'].includes(name)||!material)continue;
    wetMaterials.add(material);
    dryRoughness.set(material,material.roughness);
  }

  const equipment=new Set();
  function setRider(root){
    equipment.clear();
    if(!root)return;
    for(const ski of root.userData?.skis||[]){
      ski?.traverse?.(object=>{
        for(const material of (Array.isArray(object.material)?object.material:[object.material])){
          if(!material?.isMeshStandardMaterial)continue;
          equipment.add(material);
          material.userData.atmosphereDryRoughness??=material.roughness;
        }
      });
    }
  }

  function update(dt,state){
    const w=controller.update(dt);
    rendererWeather.update(dt,state,w);

    if(fill){
      fill.color.copy(w.ambient);
      fill.intensity=.25+w.night*.14;
    }

    if(snowMaterials?.terrain&&snowMaterials?.bank&&snowMaterials?.shadowBank){
      snowMaterials.terrain.color.copy(w.snow);
      snowMaterials.bank.color.copy(w.snow);
      snowMaterials.shadowBank.color.copy(w.snow).multiplyScalar(.77);
      snowMaterials.terrain.roughness=.86-w.wet*.08;
      snowMaterials.terrain.envMapIntensity=.12+w.wet*.14;
    }

    snowParticles?.setTint?.(w.snow);
    if(surfaceDetail?.moundMaterial?.color)surfaceDetail.moundMaterial.color.copy(w.snow);
    if(surfaceDetail?.ridgeMaterial?.color)surfaceDetail.ridgeMaterial.color.copy(w.snow).multiplyScalar(.77);

    for(const material of sceneMaterials)material.color.copy(w.snow).lerp(w.fog,.25);
    for(const material of wetMaterials){
      material.roughness=Math.max(.35,dryRoughness.get(material)-w.wet*.25);
      material.envMapIntensity=.35+w.wet*.25;
    }
    for(const material of equipment){
      material.roughness=Math.max(.16,material.userData.atmosphereDryRoughness-w.wet*.13);
      material.envMapIntensity=.65+w.wet*.2;
    }

    urbanAtmosphere.update(dt,state,w);
    audio.updateWeather?.(w,state.mode);
    if(w.thunder)audio.playWeatherThunder?.();
  }

  return {
    update,
    setRider,
    getState:()=>({
      mode:preferences.weather,
      preset:controller.values.preset,
      rain:controller.values.rain,
      night:controller.values.night,
      cloud:controller.values.cloud,
      wet:controller.values.wet,
      fogDensity:controller.values.fogDensity,
      flash:controller.values.flash,
      reducedFlashes:preferences.reducedFlashes
    }),
    getLightingDiagnostics:()=>urbanAtmosphere.getDiagnostics()
  };
}
