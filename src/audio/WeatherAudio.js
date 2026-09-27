import {makeNoiseBuffer} from './AudioMixer.js';
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export function createWeatherAudio({mixer,emitSemantic=()=>{}}={}){
  let graph=null,noise=null,lastUpdate=-1,disposed=false;
  const activeThunder=new Set();

  function ensure(){
    if(graph||disposed)return graph;
    const context=mixer?.getContext?.(),mix=mixer?.getGraph?.();
    if(!context||!mix)return null;
    noise=makeNoiseBuffer(context,4.1,32941);
    const layer=(type,frequency,q=.4)=>{
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      source.buffer=noise;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(mix.sfxBus);source.start();return {source,filter,gain};
    };
    graph={rain:layer('highpass',1500,.34),wind:layer('lowpass',430,.42)};
    return graph;
  }

  function update(weather={},mode='playing',{audible=true,intensityScale=1}={}){
    const g=ensure(),context=mixer?.getContext?.();if(!g||!context)return;
    const stamp=context.currentTime;if(stamp-lastUpdate<.11)return;lastUpdate=stamp;
    const active=audible&&mode!=='paused'?1:0,scale=clamp(intensityScale);
    mixer.setTarget(g.rain.gain.gain,clamp(weather.rain)*.115*active*scale,.34);
    mixer.setTarget(g.wind.gain.gain,clamp(weather.wind)*.045*active*scale,.52);
  }

  function playThunder({intensity=.75,intensityScale=1}={}){
    const g=ensure(),context=mixer?.getContext?.(),mix=mixer?.getGraph?.();
    if(!g||!context||!mix||activeThunder.size>=2||globalThis.document?.hidden)return false;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),t=context.currentTime;
    source.buffer=noise;filter.type='lowpass';filter.frequency.setValueAtTime(360,t);filter.frequency.exponentialRampToValueAtTime(70,t+3.0);
    const peak=Math.min(.72,clamp(intensity)*.72*clamp(intensityScale));
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.001,peak),t+.08);gain.gain.exponentialRampToValueAtTime(.12,t+.75);gain.gain.exponentialRampToValueAtTime(.001,t+3.35);
    source.connect(filter);filter.connect(gain);gain.connect(mix.sfxBus);activeThunder.add(source);
    source.onended=()=>{activeThunder.delete(source);try{source.disconnect();filter.disconnect();gain.disconnect();}catch{}};
    source.start();source.stop(t+3.45);emitSemantic('THUNDER',{intensity:clamp(intensity)});return true;
  }

  function silence(){if(graph){mixer.setTarget(graph.rain.gain.gain,0,.05);mixer.setTarget(graph.wind.gain.gain,0,.05);}lastUpdate=-1;}
  function reset(){silence();}
  function diagnostics(){return {initialized:!!graph,persistentLoopCount:graph?2:0,activeThunderCount:activeThunder.size};}
  function dispose(){
    disposed=true;
    for(const source of activeThunder){try{source.stop();source.disconnect();}catch{}}
    activeThunder.clear();
    for(const layer of graph?[graph.rain,graph.wind]:[]){try{layer.source.stop();layer.source.disconnect();layer.filter.disconnect();layer.gain.disconnect();}catch{}}
    graph=null;noise=null;
  }
  return {update,playThunder,silence,reset,diagnostics,dispose};
}
