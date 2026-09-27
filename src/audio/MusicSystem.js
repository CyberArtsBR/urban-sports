const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
export const URBAN_MUSIC_URL='/audio/music-full.mp3';

export const MIX_SNAPSHOTS=Object.freeze({
  MENU:Object.freeze({media:.16,fallback:.035,filter:1450}),
  COUNTDOWN:Object.freeze({media:.22,fallback:.070,filter:1750}),
  PLAYING:Object.freeze({media:.38,fallback:.130,filter:2300}),
  BANANA_POWER:Object.freeze({media:.24,fallback:.082,filter:980}),
  PAUSED:Object.freeze({media:.08,fallback:.025,filter:1100}),
  CRASH:Object.freeze({media:.075,fallback:.020,filter:900}),
  RESULTS:Object.freeze({media:.14,fallback:.042,filter:1350})
});

function snapshotName(mode,specialActive=false){
  if(specialActive)return 'BANANA_POWER';
  const value=String(mode||'menu').toLowerCase();
  if(value==='countdown')return 'COUNTDOWN';
  if(value==='playing')return 'PLAYING';
  if(value==='paused')return 'PAUSED';
  if(value==='crashed'||value==='crash')return 'CRASH';
  if(value==='results'||value==='result')return 'RESULTS';
  return 'MENU';
}

export function createMusicSystem({mixer,getSettings=()=>({master:.82,music:.25,musicEnabled:true})}={}){
  let media=null,ready=false,failed=false,disposed=false,duckUntil=0,duckAmount=0,lastSnapshot='MENU';
  const graph=()=>mixer?.getGraph?.();
  const context=()=>mixer?.getContext?.();
  const now=()=>context()?.currentTime??((globalThis.performance?.now?.()??Date.now())/1000);

  function ensureMedia({load=false}={}){
    if(disposed||typeof globalThis.Audio==='undefined')return null;
    if(!media){
      try{
        media=new globalThis.Audio();
        media.loop=true;media.preload='none';media.volume=0;media.src=URBAN_MUSIC_URL;
        media.addEventListener('canplay',()=>{ready=true;failed=false;},{once:true});
        media.addEventListener('error',()=>{failed=true;ready=false;});
      }catch{failed=true;return null;}
    }
    if(load&&media.preload!=='auto'){media.preload='auto';try{media.load();}catch{}}
    return media;
  }

  function duck(kind='important',amount=.36,duration=.22){
    if(!['crash','bananaPower','majorTrick','results','important'].includes(kind))return false;
    const t=now();duckUntil=Math.max(duckUntil,t+Math.max(.06,duration));duckAmount=Math.max(duckAmount,clamp(amount,0,.7));return true;
  }

  function update({mode='menu',intensity=0,specialActive=false}={}){
    if(disposed)return;
    const settings=getSettings()||{},name=snapshotName(mode,specialActive),snapshot=MIX_SNAPSHOTS[name];
    lastSnapshot=name;
    const needsLoad=name==='COUNTDOWN'||name==='PLAYING';
    const audio=ensureMedia({load:needsLoad});
    const activeDuck=now()<duckUntil?1-duckAmount:1;
    if(now()>=duckUntil)duckAmount=0;
    const musicOn=settings.musicEnabled!==false;
    const mediaLevel=clamp((settings.master??.82)*(settings.music??.25)*snapshot.media*activeDuck);
    const canUseMedia=!!audio&&ready&&!failed&&musicOn;
    if(audio){
      audio.volume=canUseMedia?mediaLevel:0;
      const shouldContinue=canUseMedia&&name!=='MENU';
      if(shouldContinue&&audio.paused)audio.play().catch(()=>{});
      if(!shouldContinue&&!audio.paused)audio.pause();
    }
    const g=graph();
    if(g){
      const fallback=canUseMedia?0:snapshot.fallback*(.84+clamp(intensity)*.16)*activeDuck;
      mixer.setTarget(g.musicGain.gain,musicOn?fallback:0,.28);
      mixer.setTarget(g.musicFilter.frequency,snapshot.filter+clamp(intensity)*650,specialActive?.10:.24);
    }
  }

  function dispose(){
    disposed=true;
    if(media){
      try{media.pause();media.removeAttribute?.('src');media.load?.();}catch{}
      media=null;
    }
  }

  function diagnostics(){return {snapshot:lastSnapshot,mediaInitialized:!!media,mediaReady:ready,mediaFailed:failed,mediaPreload:media?.preload||'none',duckActive:now()<duckUntil};}
  return {update,duck,dispose,diagnostics};
}
