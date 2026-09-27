const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext;

export const MAX_TRANSIENT_SOURCES=24;

export const DEFAULT_EVENT_COOLDOWN=Object.freeze({
  banana:.035,jump:.10,ramp:.12,land:.08,hardLand:.13,oil:.18,edgeScrape:.115,clear:.07,crash:.34,deathCry:.85,
  nearMiss:.14,specialReady:.45,specialActivate:.60,specialEnd:.35,newBest:1,menu:.025,button:.025,
  countTick:.10,countTickStrong:.10,speedUp:.28,go:.14,trick360Start:.20,trick360Success:.12,
  trickBackflipStart:.24,trickBackflipSuccess:.14,trickFail:.20,
  'skate-tail-pop':.075,'skate-nollie-pop':.075,'skate-wheel-land':.07,'skate-hard-land':.12,
  'skate-slide-start':.10,'skate-slide-loop':.085,'skate-slide-end':.10,
  'skate-grind-start':.09,'skate-grind-loop':.075,'skate-grind-end':.10,
  'skate-concrete-grind-start':.09,'skate-concrete-grind-loop':.085,'skate-concrete-grind-end':.10,
  'skate-ledge-scrape':.085,'skate-truck-creak':.16,'skate-trick-flip':.09,'skate-board-air':.10,
  'skate-board-scrape':.10,'skate-trick-fail':.16,'skate-near-miss':.14,
  'skate-power-ready':.45,'skate-power-start':.55,'skate-power-end':.30,'city-horn':2.5,'construction-hit':1.2
});

export function makeNoiseBuffer(context,duration=2,seed=92821){
  const length=Math.ceil(context.sampleRate*duration);
  const buffer=context.createBuffer(1,length,context.sampleRate);
  const data=buffer.getChannelData(0);
  let n=seed>>>0,last=0;
  for(let i=0;i<length;i++){
    n=(Math.imul(n,1664525)+1013904223)>>>0;
    const white=n/4294967296*2-1;
    last=last*.68+white*.32;
    data[i]=last*.78+white*.22;
  }
  return buffer;
}

function eventDuration(type){
  if(/crash|deathCry/.test(type))return .72;
  if(/hard-land|hardLand/.test(type))return .38;
  if(/power-ready|specialReady/.test(type))return .58;
  if(/power-start|specialActivate/.test(type))return .52;
  if(/grind-loop|concrete-grind-loop/.test(type))return .22;
  if(/grind|ledge|slide/.test(type))return .28;
  if(/tail-pop|nollie-pop|wheel-land|land/.test(type))return .25;
  if(/city-horn/.test(type))return .42;
  if(/construction-hit/.test(type))return .20;
  return .24;
}

function eventBuffer(context,cache,type){
  const key='event:'+type;
  if(cache.has(key))return cache.get(key);
  const duration=eventDuration(type);
  const length=Math.ceil(context.sampleRate*duration);
  const buffer=context.createBuffer(1,length,context.sampleRate);
  const data=buffer.getChannelData(0);
  let seed=311+type.length*971,phase=0,phase2=0,smooth=0;
  for(let i=0;i<length;i++){
    const t=i/context.sampleRate,u=t/duration;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const white=seed/4294967296*2-1;
    smooth=smooth*.60+white*.40;
    const impact=/tail-pop|nollie-pop|wheel-land|hard-land|hardLand|land|crash/.test(type);
    const metal=/skate-grind|construction-hit/.test(type)&&!/concrete/.test(type);
    const concrete=/concrete-grind|ledge/.test(type);
    const slide=/slide|board-scrape|edgeScrape|oil/.test(type);
    const power=/power|special/.test(type);
    const horn=/city-horn/.test(type);
    const ui=/menu|button|countTick|go|speedUp/.test(type);
    let hz=260,tone=0,noise=0;
    if(horn)hz=360+Math.sin(u*Math.PI)*90;
    else if(metal)hz=700+u*1100;
    else if(concrete)hz=230+Math.sin(u*Math.PI*8)*70;
    else if(impact)hz=/hard|crash/.test(type)?92:180+u*280;
    else if(power)hz=520+u*760;
    else if(slide)hz=310+Math.sin(u*Math.PI*6)*140;
    else if(ui)hz=type==='go'?560+u*620:500+u*120;
    else hz=420+u*300;
    phase+=Math.PI*2*hz/context.sampleRate;
    phase2+=Math.PI*2*(hz*(metal?2.14:1.51))/context.sampleRate;
    tone=Math.sin(phase)*(impact?.40:horn?.50:power?.34:ui?.52:.16);
    tone+=Math.sin(phase2)*(metal?.11:horn?.10:power?.10:ui?.08:.04);
    noise=smooth*(impact?.72:metal?.78:concrete?.88:slide?.72:.18);
    let env=Math.pow(1-u,impact?2.7:ui?2.4:1.6)*Math.min(1,t/.004);
    if(metal||concrete||slide)env=Math.pow(1-u,1.35)*Math.min(1,t/.003);
    if(horn)env=Math.pow(Math.sin(Math.PI*u),.65)*Math.min(1,t/.015);
    data[i]=(tone+noise)*env*(impact?.28:metal?.25:concrete?.22:slide?.22:horn?.18:power?.24:ui?.20:.18);
  }
  cache.set(key,buffer);
  return buffer;
}

function musicBuffer(context,cache){
  const key='music-bed';
  if(cache.has(key))return cache.get(key);
  const duration=12,length=Math.ceil(context.sampleRate*duration);
  const buffer=context.createBuffer(2,length,context.sampleRate);
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  const chords=[[110,138.59,164.81],[98,123.47,146.83],[87.31,110,130.81],[98,123.47,164.81]];
  for(let i=0;i<length;i++){
    const t=i/context.sampleRate,segment=Math.min(3,Math.floor(t/3)),local=(t-segment*3)/3,chord=chords[segment];
    const phrase=Math.pow(Math.sin(Math.PI*local),.55);
    let l=0,r=0;
    for(let n=0;n<chord.length;n++){
      const hz=chord[n],voice=Math.sin(Math.PI*2*hz*t)+Math.sin(Math.PI*4.006*hz*t)*.14,pan=(n-1)*.22;
      l+=voice*(.36-pan*.20);r+=voice*(.36+pan*.20);
    }
    const beat=t%1.5,pluck=Math.exp(-beat*7.2)*Math.sin(Math.PI*2*220*t)*.09;
    left[i]=l*.105*phrase+pluck;
    right[i]=r*.105*phrase+pluck*.82;
  }
  cache.set(key,buffer);
  return buffer;
}

export function createAudioMixer({getSettings=()=>({master:.82,sfx:.25,music:.25,sfxEnabled:true,musicEnabled:true})}={}){
  let context=null,graph=null,disposed=false;
  const buffers=new Map(),activeTransientSources=new Set(),eventLast=new Map();
  let peakTransientCount=0,peakRequestedGain=0,duckUntil=-Infinity,duckDepth=0;

  function setTarget(param,value,time=.08){
    if(!context||!param)return;
    try{param.setTargetAtTime(Number(value)||0,context.currentTime,Math.max(.001,time));}catch{}
  }

  function makeLoop(buffer){
    const source=context.createBufferSource();source.buffer=buffer;source.loop=true;return source;
  }

  function makeLayer(seed,frequency,q=.55,type='bandpass',destination){
    const source=makeLoop(makeNoiseBuffer(context,2.4+((seed%5)*.17),seed));
    const filter=context.createBiquadFilter(),gain=context.createGain();
    filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;
    source.connect(filter);filter.connect(gain);gain.connect(destination);source.start();
    return {source,filter,gain};
  }

  function ensureGraph(){
    if(graph||!context||disposed)return graph;
    const master=context.createGain(),lifecycleGain=context.createGain(),sfxBus=context.createGain(),musicBus=context.createGain();
    const continuousBus=context.createGain(),eventBus=context.createGain(),continuousDuck=context.createGain();
    const worldFilter=context.createBiquadFilter(),compressor=context.createDynamicsCompressor();
    worldFilter.type='lowpass';worldFilter.frequency.value=14000;worldFilter.Q.value=.35;
    compressor.threshold.value=-12;compressor.knee.value=10;compressor.ratio.value=4.2;compressor.attack.value=.003;compressor.release.value=.18;
    continuousBus.connect(continuousDuck);continuousDuck.connect(worldFilter);worldFilter.connect(sfxBus);eventBus.connect(sfxBus);
    sfxBus.connect(master);musicBus.connect(master);master.connect(lifecycleGain);lifecycleGain.connect(compressor);compressor.connect(context.destination);

    const contact=makeLayer(19531,760,.55,'bandpass',continuousBus);
    const carve=makeLayer(72317,1450,.90,'bandpass',continuousBus);
    const boardScrape=makeLayer(66571,560,.48,'bandpass',continuousBus);
    const wind=makeLayer(44963,1100,.38,'bandpass',continuousBus);
    const skateWheelLow=makeLayer(54121,260,.72,'bandpass',continuousBus);
    const skateBearing=makeLayer(93481,1700,1.2,'bandpass',continuousBus);
    const skateRoad=makeLayer(61211,3100,.50,'highpass',continuousBus);
    const skateWet=makeLayer(71867,2400,.46,'highpass',continuousBus);
    const skateSlide=makeLayer(82723,1550,.90,'bandpass',continuousBus);

    const musicSource=makeLoop(musicBuffer(context,buffers)),musicFilter=context.createBiquadFilter(),musicGain=context.createGain();
    musicFilter.type='lowpass';musicFilter.frequency.value=1750;musicGain.gain.value=0;
    musicSource.connect(musicFilter);musicFilter.connect(musicGain);musicGain.connect(musicBus);musicSource.start();

    graph={master,lifecycleGain,sfxBus,musicBus,continuousBus,eventBus,continuousDuck,worldFilter,compressor,
      contact,carve,boardScrape,wind,skateWheelLow,skateBearing,skateRoad,skateWet,skateSlide,musicSource,musicFilter,musicGain,
      sources:[contact.source,carve.source,boardScrape.source,wind.source,skateWheelLow.source,skateBearing.source,skateRoad.source,skateWet.source,skateSlide.source,musicSource]};
    lifecycleGain.gain.value=1;continuousDuck.gain.value=1;
    setBusLevels();return graph;
  }

  function unlock(){
    if(disposed||!AudioContextClass)return false;
    try{
      context??=new AudioContextClass();
      ensureGraph();
      if(context.state==='suspended')context.resume().catch(()=>{});
      return true;
    }catch{return false;}
  }

  function setBusLevels(){
    if(!graph)return;
    const settings=getSettings()||{};
    setTarget(graph.master.gain,clamp(settings.master??.82),.04);
    setTarget(graph.sfxBus.gain,settings.sfxEnabled===false?0:clamp(settings.sfx??.25),.04);
    setTarget(graph.musicBus.gain,settings.musicEnabled===false?0:clamp(settings.music??.25),.08);
  }

  function setLifecycleAudible(value){if(graph)setTarget(graph.lifecycleGain.gain,value?1:0,value?.08:.03);}

  function suspend(){try{if(context?.state==='running')context.suspend().catch(()=>{});}catch{}}
  function resume(){try{if(context?.state==='suspended')context.resume().catch(()=>{});}catch{}}

  function playTransient(type,gain=1,rateScale=1,pan=0){
    unlock();
    const settings=getSettings()||{};
    if(!context||!graph||settings.sfxEnabled===false||disposed)return false;
    const now=context.currentTime,cooldown=DEFAULT_EVENT_COOLDOWN[type]??.035,last=eventLast.get(type)??-Infinity;
    if(now-last<cooldown||activeTransientSources.size>=MAX_TRANSIENT_SOURCES)return false;
    eventLast.set(type,now);
    const source=context.createBufferSource(),amp=context.createGain();
    const panner=Math.abs(pan)>.001&&typeof context.createStereoPanner==='function'?context.createStereoPanner():null;
    source.buffer=eventBuffer(context,buffers,type);
    const variation=type==='go'?0:/crash|deathCry/.test(type)?.025:type.startsWith('skate-')?.016:.03;
    source.playbackRate.value=clamp(rateScale,.72,1.65)*(1+(Math.random()*2-1)*variation);
    const safeGain=Math.min(.92,Math.max(0,Number(gain)||0));
    amp.gain.value=safeGain;peakRequestedGain=Math.max(peakRequestedGain,safeGain);
    source.connect(amp);
    if(panner){panner.pan.value=clamp(pan,-1,1);amp.connect(panner);panner.connect(graph.eventBus);}else amp.connect(graph.eventBus);
    activeTransientSources.add(source);peakTransientCount=Math.max(peakTransientCount,activeTransientSources.size);
    source.onended=()=>{
      activeTransientSources.delete(source);
      try{source.disconnect();amp.disconnect();panner?.disconnect();}catch{}
      source.onended=null;
    };
    source.start();return true;
  }

  function duckImportant({depth=.22,duration=.16}={}){
    if(!context||!graph)return;
    duckDepth=Math.max(duckDepth,clamp(depth,0,.6));duckUntil=Math.max(duckUntil,context.currentTime+Math.max(.04,duration));
  }

  function updateDucking(){
    if(!context||!graph)return;
    const active=context.currentTime<duckUntil;
    setTarget(graph.continuousDuck.gain,active?1-duckDepth:1,active?.025:.10);
    if(!active)duckDepth=0;
  }

  function stopTransientSources(){
    for(const source of activeTransientSources){try{source.onended=null;source.stop();source.disconnect();}catch{}}
    activeTransientSources.clear();
  }

  function resetTransientState(){stopTransientSources();eventLast.clear();duckUntil=-Infinity;duckDepth=0;if(graph)setTarget(graph.continuousDuck.gain,1,.01);}

  function diagnostics(){
    const persistent=graph?.sources?.length||0;
    return {contextState:context?.state??'uninitialized',graphInitialized:!!graph,persistentLoopCount:persistent,
      activeTransientCount:activeTransientSources.size,maxTransientCount:MAX_TRANSIENT_SOURCES,peakTransientCount,
      peakRequestedGain,bufferCount:buffers.size,activeNodeEstimate:persistent+activeTransientSources.size+(graph?18:0)};
  }

  function dispose(){
    if(disposed)return;disposed=true;resetTransientState();
    for(const source of graph?.sources||[]){try{source.stop();source.disconnect();}catch{}}
    try{graph?.master?.disconnect();graph?.lifecycleGain?.disconnect();graph?.sfxBus?.disconnect();graph?.musicBus?.disconnect();graph?.continuousBus?.disconnect();graph?.eventBus?.disconnect();graph?.compressor?.disconnect();}catch{}
    graph=null;buffers.clear();eventLast.clear();
    try{context?.close?.().catch?.(()=>{});}catch{}
    context=null;
  }

  return {unlock,resume,suspend,ensureGraph,getContext:()=>context,getGraph:()=>graph,setTarget,setBusLevels,setLifecycleAudible,
    playTransient,duckImportant,updateDucking,resetTransientState,stopTransientSources,diagnostics,dispose};
}
