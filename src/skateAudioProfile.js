const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export const SKATE_SURFACE=Object.freeze({
  DRY_ASPHALT:'dry_asphalt',
  WET_ASPHALT:'wet_asphalt',
  OIL:'oil',
  METAL:'metal',
  CONCRETE:'concrete',
  GRIND_RAIL:'grind_rail'
});

export const SKATE_SURFACE_PROFILES=Object.freeze({
  [SKATE_SURFACE.DRY_ASPHALT]:Object.freeze({rollGain:1,hissGain:.72,wetGain:0,gritGain:1,frequencyScale:1}),
  [SKATE_SURFACE.WET_ASPHALT]:Object.freeze({rollGain:.88,hissGain:.82,wetGain:1,gritGain:.34,frequencyScale:.92}),
  [SKATE_SURFACE.OIL]:Object.freeze({rollGain:.74,hissGain:.64,wetGain:.38,gritGain:.18,frequencyScale:.78}),
  [SKATE_SURFACE.METAL]:Object.freeze({rollGain:.62,hissGain:.48,wetGain:.04,gritGain:.18,frequencyScale:1.34}),
  [SKATE_SURFACE.CONCRETE]:Object.freeze({rollGain:.94,hissGain:.62,wetGain:0,gritGain:.82,frequencyScale:1.12}),
  [SKATE_SURFACE.GRIND_RAIL]:Object.freeze({rollGain:.38,hissGain:.34,wetGain:0,gritGain:.08,frequencyScale:1.48})
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
  if(raw==='rail')return SKATE_SURFACE.GRIND_RAIL;
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

// The optional output object allows realtime callers to reuse one scratch object.
export function getSkateContinuousMix(
  speed01=0,
  slideAmount=0,
  wetness=0,
  airborne=false,
  surface=SKATE_SURFACE.DRY_ASPHALT,
  manual='none',
  quality='high',
  out={}
){
  const speed=clamp(speed01);
  const slide=clamp(slideAmount);
  const wet=clamp(wetness);
  const surfaceProfile=getSkateSurfaceProfile(surface);
  const q=getSkateQualityProfile(quality);

  if(airborne){
    out.lowRoll=0;
    out.bearing=0;
    out.roadHiss=0;
    out.wetHiss=0;
    out.slide=0;
    out.wind=.042+speed*.108;
    out.city=.018*q.ambienceGain;
    out.lowFrequency=210;
    out.bearingFrequency=1450;
    out.roadFrequency=2600;
    out.slideFrequency=1850;
    return out;
  }

  const manualLoad=(manual==='manual'||manual==='nose_manual') ? .12 : 0;
  out.lowRoll=(.018+speed*.048)*(1+manualLoad)*surfaceProfile.rollGain;
  out.bearing=q.wheelLayers>=2?(.006+speed*.036)*surfaceProfile.rollGain*q.detailGain:0;
  out.roadHiss=q.wheelLayers>=3?(.004+speed*.052)*surfaceProfile.hissGain*q.detailGain:0;
  out.wetHiss=(.006+speed*.040)*Math.max(wet,surfaceProfile.wetGain)*q.detailGain;
  out.slide=slide*(.012+speed*.060)*(.72+surfaceProfile.frequencyScale*.28);
  out.wind=.012+speed*.088;
  out.city=(.010+speed*.006)*q.ambienceGain;
  out.lowFrequency=180+speed*240;
  out.bearingFrequency=(1050+speed*2200)*surfaceProfile.frequencyScale;
  out.roadFrequency=(1700+speed*3100)*surfaceProfile.frequencyScale;
  out.slideFrequency=(1050+speed*1500)*surfaceProfile.frequencyScale;
  return out;
}

const CUES=Object.freeze({
  jump:Object.freeze({sound:'skate-tail-pop',gain:.88,rate:1}),
  ramp:Object.freeze({sound:'skate-tail-pop',gain:.82,rate:.96}),
  land:Object.freeze({sound:'skate-wheel-land',gain:.78,rate:1}),
  hardLand:Object.freeze({sound:'skate-hard-land',gain:.92,rate:.94}),
  oil:Object.freeze({sound:'skate-slide-start',gain:.74,rate:.88}),
  edgeScrape:Object.freeze({sound:'skate-slide-loop',gain:.48,rate:1}),
  nearMiss:Object.freeze({sound:'skate-near-miss',gain:.78,rate:1}),
  specialReady:Object.freeze({sound:'skate-power-ready',gain:.78,rate:1}),
  specialActivate:Object.freeze({sound:'skate-power-start',gain:.92,rate:1}),
  specialEnd:Object.freeze({sound:'skate-power-end',gain:.70,rate:1}),
  trick360Start:Object.freeze({sound:'skate-board-air',gain:.66,rate:1.04}),
  trick360Success:Object.freeze({sound:'skate-wheel-land',gain:.72,rate:1.06}),
  trickBackflipStart:Object.freeze({sound:'skate-board-air',gain:.70,rate:.94}),
  trickBackflipSuccess:Object.freeze({sound:'skate-hard-land',gain:.74,rate:1.02}),
  trickFail:Object.freeze({sound:'skate-trick-fail',gain:.76,rate:.90})
});

const NAMED_TRICKS=new Set([
  'ollie','nollie','180','360','kickflip','heelflip','shove_it','frontside_shove_it','grabs'
]);

function normalizeEventName(name){
  return String(name||'').trim().replace(/[-\s]+/g,'_').toLowerCase();
}

function cue(sound,gain=.7,rate=1){
  return {sound,gain,rate};
}

export function getSkateEventCue(name,payload={}){
  if(CUES[name])return CUES[name];
  const event=normalizeEventName(name);
  const intensity=.55+clamp(payload.intensity??payload.amount??.5)*.45;

  if(event==='tailpop'||event==='tail_pop'||event==='ollie')return cue('skate-tail-pop',.82*intensity,1);
  if(event==='nollie')return cue('skate-nollie-pop',.80*intensity,1.04);
  if(event==='land'||event==='trickland'||event==='trick_land')return cue('skate-wheel-land',.68*intensity,.98+clamp(payload.force)*.08);
  if(event==='hardland'||event==='hard_land')return cue('skate-hard-land',.82*intensity,.94);
  if(event==='powerslidestart'||event==='powerslide_start')return cue('skate-slide-start',.66*intensity,.94);
  if(event==='powerslideloop'||event==='powerslide_loop')return cue('skate-slide-loop',.46*intensity,.92+clamp(payload.speed01)*.18);
  if(event==='powerslideend'||event==='powerslide_end')return cue('skate-slide-end',.46*intensity,1.02);

  if(
    event==='grindstart'||event==='grind_start'||
    event==='grindloop'||event==='grind_loop'||
    event==='grindend'||event==='grind_end'
  ){
    const metal=/metal|rail/i.test(String(payload.surface||'grind_rail'));
    const loop=event.includes('loop');
    const end=event.includes('end');
    const sound=metal
      ?(loop?'skate-grind-loop':end?'skate-grind-end':'skate-grind-start')
      :'skate-ledge-scrape';
    const type=String(payload.type||'').toLowerCase();
    const typeRate=(type.includes('boardslide')||type.includes('lipslide'))
      ?.94
      :((type.includes('5-0')||type.includes('nosegrind'))?1.04:1);
    const eventGain=(loop?.44:(end?.58:.72))*intensity;
    const rate=typeRate*(loop?(.92+clamp(payload.speed01)*.20):1);
    return cue(sound,eventGain,rate);
  }

  if(event==='manualstart'||event==='manual_start'||event==='manualend'||event==='manual_end')return cue('skate-truck-creak',.24*intensity,1);
  if(event==='bananapowerready'||event==='banana_power_ready')return cue('skate-power-ready',.78,1);
  if(event==='bananapowerstart'||event==='banana_power_start')return cue('skate-power-start',.92,1);
  if(event==='bananapowerend'||event==='banana_power_end')return cue('skate-power-end',.68,1);
  if(event==='trickfail'||event==='trick_fail')return cue('skate-trick-fail',.72*intensity,.90);

  if(event==='trickstart'||event==='trick_start'||event==='trickland'||event==='trick_land'){
    const trick=normalizeEventName(payload.trick||payload.type);
    if(trick==='ollie'||trick==='nollie')return getSkateEventCue(trick,payload);
    if(['kickflip','heelflip','shove_it','frontside_shove_it'].includes(trick)){
      return cue('skate-trick-flip',.58*intensity,.96+clamp(payload.speed01)*.10);
    }
    return cue('skate-board-air',.48*intensity,1);
  }

  if(NAMED_TRICKS.has(event)){
    if(event==='ollie'||event==='nollie')return getSkateEventCue(event,payload);
    if(['kickflip','heelflip','shove_it','frontside_shove_it'].includes(event)){
      return cue('skate-trick-flip',.58*intensity,1);
    }
    return cue('skate-board-air',.48*intensity,1);
  }

  return null;
}
