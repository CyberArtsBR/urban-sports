import {makeNoiseBuffer} from './AudioMixer.js';
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export function createWorldAudio({mixer,playEvent=()=>false}={}){
  let graph=null,lastUpdate=-1,nextAccent=7.5,seed=0x51c17,zone='open',disposed=false;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function ensure(){
    if(graph||disposed)return graph;
    const context=mixer?.getContext?.(),mix=mixer?.getGraph?.();if(!context||!mix)return null;
    const layer=(s,duration,type,frequency,q)=>{
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      source.buffer=makeNoiseBuffer(context,duration,s);source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(mix.continuousBus);source.start();return {source,filter,gain};
    };
    graph={
      ambience:layer(44717,3.73,'lowpass',520,.35),
      traffic:layer(18371,4.61,'bandpass',310,.48),
      construction:layer(99173,5.27,'bandpass',760,.62)
    };
    return graph;
  }
  function update({mode='playing',district='downtown',speed01=0,audible=true,time=0}={}){
    const g=ensure(),context=mixer?.getContext?.();if(!g||!context)return;
    const stamp=context.currentTime;if(stamp-lastUpdate<.14)return;lastUpdate=stamp;
    const running=audible&&(mode==='playing'||mode==='countdown'),speed=clamp(speed01);
    const industrial=district==='industrial'||district==='construction',commercial=district==='commercial'||district==='entertainment';
    const tunnel=zone==='underpass'||zone==='tunnel';
    mixer.setTarget(g.ambience.gain.gain,running?(.008+(commercial?.010:.004))*(tunnel?.72:1):0,.55);
    mixer.setTarget(g.traffic.gain.gain,running?(.009+speed*.006)*(industrial?.72:1):0,.48);
    mixer.setTarget(g.construction.gain.gain,running&&industrial?.012:running?.0025:0,.65);
    mixer.setTarget(g.ambience.filter.frequency,tunnel?280:commercial?640:500,.65);
    mixer.setTarget(g.traffic.filter.frequency,tunnel?220:300+speed*140,.5);
    if(running&&stamp>=nextAccent){
      nextAccent=stamp+8+rand()*14;
      if(rand()>.55)playEvent('city-horn',{gain:.13+.07*rand(),pan:-.75+rand()*1.5,rate:.92+rand()*.16,source:'world'});
      else if(industrial)playEvent('construction-hit',{gain:.12+.05*rand(),pan:-.55+rand()*1.1,rate:.9+rand()*.12,source:'world'});
    }
    void time;
  }
  function setZone(next='open'){zone=String(next||'open').toLowerCase();return zone;}
  function reset(){nextAccent=7.5;seed=0x51c17;zone='open';}
  function diagnostics(){return {initialized:!!graph,persistentLoopCount:graph?3:0,zone,nextAccentSeconds:nextAccent};}
  function dispose(){disposed=true;for(const layer of graph?Object.values(graph):[]){try{layer.source.stop();layer.source.disconnect();layer.filter.disconnect();layer.gain.disconnect();}catch{}}graph=null;}
  return {update,setZone,reset,diagnostics,dispose};
}
