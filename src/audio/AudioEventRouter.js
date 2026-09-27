export const AUDIO_SEMANTIC_EVENT=Object.freeze({
  GRIND_START:'GRIND_START',
  GRIND_END:'GRIND_END',
  HARD_LANDING:'HARD_LANDING',
  LANDING:'LANDING',
  BANANA_POWER_READY:'BANANA_POWER_READY',
  BANANA_POWER_ACTIVATE:'BANANA_POWER_ACTIVATE',
  THUNDER:'THUNDER',
  CRASH:'CRASH',
  POWERSLIDE_START:'POWERSLIDE_START',
  POWERSLIDE_END:'POWERSLIDE_END',
  OLLIE:'OLLIE',
  NOLLIE:'NOLLIE',
  NEAR_MISS:'NEAR_MISS'
});

const CAPTIONS=Object.freeze({
  GRIND_START:'GRIND START',
  GRIND_END:'GRIND END',
  HARD_LANDING:'HARD LANDING',
  LANDING:'LANDING',
  BANANA_POWER_READY:'BANANA POWER READY',
  BANANA_POWER_ACTIVATE:'BANANA POWER',
  THUNDER:'THUNDER',
  CRASH:'CRASH',
  POWERSLIDE_START:'POWERSLIDE',
  POWERSLIDE_END:'POWERSLIDE END',
  OLLIE:'OLLIE',
  NOLLIE:'NOLLIE',
  NEAR_MISS:'NEAR MISS'
});

export function createAudioEventRouter({historyLimit=48}={}){
  const listeners=new Set();
  const history=[];

  function emit(type,payload={}){
    const key=String(type||'').trim().toUpperCase();
    if(!key)return null;
    const event=Object.freeze({
      type:key,
      caption:CAPTIONS[key]||String(payload.caption||key.replace(/_/g,' ')),
      intensity:Math.max(0,Math.min(1,Number(payload.intensity??1)||0)),
      time:Number(payload.time)||0,
      source:String(payload.source||'audio'),
      ...payload
    });
    history.push(event);
    while(history.length>historyLimit)history.shift();
    for(const listener of [...listeners]){
      try{listener(event);}catch{}
    }
    return event;
  }

  function subscribe(listener){
    if(typeof listener!=='function')return ()=>{};
    listeners.add(listener);
    return ()=>listeners.delete(listener);
  }

  function reset(){history.length=0;}
  function diagnostics(){return {subscriberCount:listeners.size,historyCount:history.length,lastEvent:history.at(-1)?.type||null};}

  return {emit,subscribe,reset,diagnostics};
}
