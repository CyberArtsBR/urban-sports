const UI_CUES=Object.freeze({
  menu:Object.freeze({gain:.18,rate:1}),
  button:Object.freeze({gain:.22,rate:1}),
  countTick:Object.freeze({gain:.27,rate:1}),
  countTickStrong:Object.freeze({gain:.36,rate:1}),
  go:Object.freeze({gain:.76,rate:1}),
  speedUp:Object.freeze({gain:.34,rate:1})
});

export function getUIAudioCue(name){
  return UI_CUES[String(name||'')]||null;
}

export function isUIAudioEvent(name){
  return !!getUIAudioCue(name);
}
