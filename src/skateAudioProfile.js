const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export const SKATE_SURFACE=Object.freeze({
  DRY_ASPHALT:'dry_asphalt',
  WET_ASPHALT:'wet_asphalt',
  CONCRETE:'concrete',
  SIDEWALK:'sidewalk',
  CURB:'curb',
  METAL:'metal',
  RAIL:'rail',
  LEDGE:'ledge',
  PUDDLE:'puddle',
  OIL:'oil',
  GRIND_RAIL:'grind_rail'
});

export const SKATE_SURFACE_PROFILES=Object.freeze({
  [SKATE_SURFACE.DRY_ASPHALT]:Object.freeze({rollGain:1,hissGain:.66,wetGain:0,gritGain:1,frequencyScale:1,grindMaterial:'concrete'}),
  [SKATE_SURFACE.WET_ASPHALT]:Object.freeze({rollGain:.88,hissGain:.70,wetGain:1,gritGain:.32,frequencyScale:.91,grindMaterial:'concrete'}),
  [SKATE_SURFACE.CONCRETE]:Object.freeze({rollGain:.96,hissGain:.56,wetGain:0,gritGain:.86,frequencyScale:1.08,grindMaterial:'concrete'}),
  [SKATE_SURFACE.SIDEWALK]:Object.freeze({rollGain:.92,hissGain:.50,wetGain:0,gritGain:.94,frequencyScale:1.04,grindMaterial:'concrete'}),
  [SKATE_SURFACE.CURB]:Object.freeze({rollGain:.82,hissGain:.42,wetGain:0,gritGain:.92,frequencyScale:1.02,grindMaterial:'concrete'}),
  [SKATE_SURFACE.METAL]:Object.freeze({rollGain:.64,hissGain:.42,wetGain:.04,gritGain:.16,frequencyScale:1.30,grindMaterial:'metal'}),
  [SKATE_SURFACE.RAIL]:Object.freeze({rollGain:.44,hissGain:.30,wetGain:.02,gritGain:.08,frequencyScale:1.46,grindMaterial:'metal'}),
  [SKATE_SURFACE.LEDGE]:Object.freeze({rollGain:.78,hissGain:.42,wetGain:0,gritGain:.88,frequencyScale:1.06,grindMaterial:'concrete'}),
  [SKATE_SURFACE.PUDDLE]:Object.freeze({rollGain:.70,hissGain:.50,wetGain:1.20,gritGain:.10,frequencyScale:.78,grindMaterial:'concrete'}),
  [SKATE_SURFACE.OIL]:Object.freeze({rollGain:.72,hissGain:.48,wetGain:.32,gritGain:.14,frequencyScale:.76,grindMaterial:'concrete'}),
  [SKATE_SURFACE.GRIND_RAIL]:Object.freeze({rollGain:.38,hissGain:.28,wetGain:0,gritGain:.06,frequencyScale:1.48,grindMaterial:'metal'})
});

export const SKATE_AUDIO_QUALITY=Object.freeze({
  max:Object.freeze({wheelLayers:3,ambienceGain:1,detailGain:1}),
  high:Object.freeze({wheelLayers:3,ambienceGain:.86,detailGain:.92}),
  medium:Object.freeze({wheelLayers:2,ambienceGain:.58,detailGain:.72}),
  low:Object.freeze({wheelLayers:1,ambienceGain:.28,detailGain:.48})
});

export function normalizeSkateSurface(surface){
  const raw=String(surface||'').toLowerCase().replace(/[\s-]+/g,'_');
  if(raw==='asphalt'||raw==='road'||raw==='dry')return SKATE_SURFACE.DRY_ASPHALT;
  if(raw==='wet'||raw==='rain'||raw==='wet_road')return SKATE_SURFACE.WET_ASPHALT;
  if(raw==='metal_rail'||raw==='handrail')return SKATE_SURFACE.RAIL;
  if(raw==='grindrail')return SKATE_SURFACE.GRIND_RAIL;
  if(raw==='pavement')return SKATE_SURFACE.SIDEWALK;
  return SKATE_SURFACE_PROFILES[raw]?raw:SKATE_SURFACE.DRY_ASPHALT;
}

export function getSkateSurfaceProfile(surface){
  return SKATE_SURFACE_PROFILES[normalizeSkateSurface(surface)];
}

export function normalizeSkateQualityProfile(profile){
  const key=String(profile||'').toLowerCase();
  return SKATE_AUDIO_QUALITY[key]?key:'high';
}

export function getSkateQualityProfile(profile='high'){
  return SKATE_AUDIO_QUALITY[normalizeSkateQualityProfile(profile)];
}

// Optional output + traction objects let realtime callers avoid per-frame allocation.
export function getSkateContinuousMix(
  speed01=0,
  slideAmount=0,
  wetness=0,
  airborne=false,
  surface=SKATE_SURFACE.DRY_ASPHALT,
  manual='none',
  quality='high',
  out={},
  traction={}
){
  const speed=clamp(speed01);
  const slide=clamp(slideAmount);
  const wet=clamp(wetness);
  const surfaceProfile=getSkateSurfaceProfile(surface);
  const q=getSkateQualityProfile(quality);
  const grip=traction.grip==null?1:clamp(traction.grip);
  const lateralSlip=clamp(traction.lateralSlip);
  const powerslide=clamp(traction.powerslide===true?1:traction.powerslide);
  const landingLoss=clamp(traction.landingGripLoss);
  const tractionLoss=clamp(Math.max(1-grip,lateralSlip,powerslide*.92,landingLoss*.72));

  if(airborne){
    out.lowRoll=0;
    out.bearing=0;
    out.roadHiss=0;
    out.wetHiss=0;
    out.slide=0;
    out.wind=.040+speed*.102;
    out.city=.016*q.ambienceGain;
    out.lowFrequency=210;
    out.bearingFrequency=1450;
    out.roadFrequency=2600;
    out.slideFrequency=1850;
    out.tractionLoss=tractionLoss;
    return out;
  }

  const manualLoad=(manual==='manual'||manual==='nose_manual'||manual==='nosemanual')?.12:0;
  const contact=clamp(1-landingLoss*.30,.62,1);
  const highFrequencyRelief=1-wet*.20-tractionLoss*.18;
  out.lowRoll=(.018+speed*.050)*(1+manualLoad)*surfaceProfile.rollGain*contact;
  out.bearing=q.wheelLayers>=2?(.005+speed*.033)*surfaceProfile.rollGain*q.detailGain*clamp(highFrequencyRelief,.58,1):0;
  out.roadHiss=q.wheelLayers>=3?(.0035+speed*.044)*surfaceProfile.hissGain*q.detailGain*clamp(highFrequencyRelief,.54,1):0;
  out.wetHiss=(.004+speed*.036)*Math.max(wet,surfaceProfile.wetGain)*q.detailGain;
  out.slide=clamp(Math.max(slide,tractionLoss*.84))*(.010+speed*.054)*(.72+surfaceProfile.frequencyScale*.28);
  out.wind=.011+speed*.084;
  out.city=(.009+speed*.005)*q.ambienceGain;
  out.lowFrequency=170+speed*230-surfaceProfile.gritGain*18;
  out.bearingFrequency=(980+speed*2050)*surfaceProfile.frequencyScale;
  out.roadFrequency=(1580+speed*2750)*surfaceProfile.frequencyScale;
  out.slideFrequency=(930+speed*1320)*surfaceProfile.frequencyScale*(1-wet*.12);
  out.tractionLoss=tractionLoss;
  return out;
}

const CUES=Object.freeze({
  jump:Object.freeze({sound:'skate-tail-pop',gain:.84,rate:1}),
  ramp:Object.freeze({sound:'skate-tail-pop',gain:.78,rate:.96}),
  land:Object.freeze({sound:'skate-wheel-land',gain:.74,rate:1}),
  hardLand:Object.freeze({sound:'skate-hard-land',gain:.88,rate:.94}),
  oil:Object.freeze({sound:'skate-slide-start',gain:.70,rate:.88}),
  edgeScrape:Object.freeze({sound:'skate-board-scrape',gain:.44,rate:1}),
  nearMiss:Object.freeze({sound:'skate-near-miss',gain:.74,rate:1}),
  specialReady:Object.freeze({sound:'skate-power-ready',gain:.76,rate:1}),
  specialActivate:Object.freeze({sound:'skate-power-start',gain:.88,rate:1}),
  specialEnd:Object.freeze({sound:'skate-power-end',gain:.66,rate:1}),
  trick360Start:Object.freeze({sound:'skate-board-air',gain:.62,rate:1.04}),
  trick360Success:Object.freeze({sound:'skate-wheel-land',gain:.68,rate:1.06}),
  trickBackflipStart:Object.freeze({sound:'skate-board-air',gain:.66,rate:.94}),
  trickBackflipSuccess:Object.freeze({sound:'skate-hard-land',gain:.70,rate:1.02}),
  trickFail:Object.freeze({sound:'skate-trick-fail',gain:.72,rate:.90})
});

const NAMED_TRICKS=new Set(['ollie','nollie','180','360','kickflip','heelflip','shove_it','frontside_shove_it','grabs']);

function normalizeEventName(name){
  return String(name||'').trim().replace(/[-\s]+/g,'_').toLowerCase();
}

function cue(sound,gain=.7,rate=1){
  return {sound,gain,rate};
}

function grindCue(event,payload,intensity){
  const surface=getSkateSurfaceProfile(payload.surface||SKATE_SURFACE.GRIND_RAIL);
  const material=surface.grindMaterial;
  const loop=event.includes('loop'),end=event.includes('end');
  const sound=material==='metal'
    ?(loop?'skate-grind-loop':end?'skate-grind-end':'skate-grind-start')
    :(loop?'skate-concrete-grind-loop':end?'skate-concrete-grind-end':'skate-concrete-grind-start');
  const type=String(payload.type||payload.trick||'').toLowerCase();
  const typeRate=(type.includes('boardslide')||type.includes('lipslide'))?.93:((type.includes('5-0')||type.includes('nosegrind'))?1.04:1);
  const speed=clamp(payload.speed01??((Number(payload.speed)||0)/83.3333));
  const balance=clamp(Math.abs(Number(payload.balance)||0));
  const eventGain=(loop?.38:(end?.52:.68))*intensity*(1-balance*.12);
  const rate=typeRate*(loop?(.90+speed*.18):1)*(material==='metal'?1.03:.94);
  return cue(sound,eventGain,rate);
}

export function getSkateEventCue(name,payload={}){
  if(CUES[name])return CUES[name];
  const event=normalizeEventName(name);
  const intensity=.52+clamp(payload.intensity??payload.amount??.5)*.48;

  if(event==='tailpop'||event==='tail_pop'||event==='ollie')return cue(payload.nollie?'skate-nollie-pop':'skate-tail-pop',.80*intensity,payload.nollie?1.04:1);
  if(event==='nollie')return cue('skate-nollie-pop',.78*intensity,1.04);
  if(event==='land'||event==='trickland'||event==='trick_land')return cue('skate-wheel-land',.65*intensity,.98+clamp(payload.force??payload.impact/18)*.07);
  if(event==='hardland'||event==='hard_land')return cue('skate-hard-land',.79*intensity,.94);
  if(event==='powerslidestart'||event==='powerslide_start')return cue('skate-slide-start',.62*intensity,.94);
  if(event==='powerslideloop'||event==='powerslide_loop')return cue('skate-slide-loop',.40*intensity,.90+clamp(payload.speed01)*.16);
  if(event==='powerslideend'||event==='powerslide_end')return cue('skate-slide-end',.42*intensity,1.02);
  if(event==='boardscrape'||event==='board_scrape')return cue('skate-board-scrape',.46*intensity,.96);

  if(event==='grindstart'||event==='grind_start'||event==='grindloop'||event==='grind_loop'||event==='grindend'||event==='grind_end'){
    return grindCue(event,payload,intensity);
  }

  if(event==='manualstart'||event==='manual_start'||event==='manualend'||event==='manual_end')return cue('skate-truck-creak',.22*intensity,1);
  if(event==='bananapowerready'||event==='banana_power_ready')return cue('skate-power-ready',.76,1);
  if(event==='bananapowerstart'||event==='banana_power_start')return cue('skate-power-start',.88,1);
  if(event==='bananapowerend'||event==='banana_power_end')return cue('skate-power-end',.64,1);
  if(event==='trickfail'||event==='trick_fail')return cue('skate-trick-fail',.68*intensity,.90);

  if(event==='trickstart'||event==='trick_start'||event==='trickland'||event==='trick_land'){
    const trick=normalizeEventName(payload.trick||payload.type);
    if(trick==='ollie'||trick==='nollie')return getSkateEventCue(trick,payload);
    if(['kickflip','heelflip','shove_it','frontside_shove_it'].includes(trick)){
      return cue('skate-trick-flip',.55*intensity,.96+clamp(payload.speed01)*.10);
    }
    return cue('skate-board-air',.45*intensity,1);
  }

  if(NAMED_TRICKS.has(event)){
    if(event==='ollie'||event==='nollie')return getSkateEventCue(event,payload);
    if(['kickflip','heelflip','shove_it','frontside_shove_it'].includes(event))return cue('skate-trick-flip',.55*intensity,1);
    return cue('skate-board-air',.45*intensity,1);
  }
  return null;
}
