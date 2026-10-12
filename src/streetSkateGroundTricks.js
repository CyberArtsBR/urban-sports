// Adapted from CyberArtsBR/StreetSkate/src/game/TrickCatalog.js
// Ground combinations are animated in place: no extra jump impulse or teleport.
export const STREETSKATE_FLATLAND_TRICKS=Object.freeze({
  'grind+grind':Object.freeze({name:'Pogo',points:200,instability:.34}),
  'flip+flip':Object.freeze({name:'Wrap Around',points:225,instability:.30}),
  'grab+grab':Object.freeze({name:'Handstand',points:300,instability:.48}),
  'flip+grind':Object.freeze({name:'Casper',points:250,instability:.40}),
  'grind+flip':Object.freeze({name:'Truck Stand',points:300,instability:.46}),
  'flip+grab':Object.freeze({name:'Anti Casper',points:275,instability:.42}),
  'grab+flip':Object.freeze({name:'To Rail',points:250,instability:.38}),
  'grind+grab':Object.freeze({name:'Switch Foot Pogo',points:325,instability:.52}),
  'grab+grind':Object.freeze({name:'One Foot Manual',points:325,instability:.50})
});
export const STREETSKATE_FLATLAND_INPUTS=Object.freeze(['flip','grind','grab']);

const COMBO_WINDOW=.48;
const RESTART_COOLDOWN=.34;
const MIN_ROLLING_SPEED=1.5;
const valid=new Set(STREETSKATE_FLATLAND_INPUTS);
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));

export function createStreetSkateGroundTricks(){
  let time=0,pending=null,active=null,nextAvailable=0;
  function reset(){time=0;pending=null;active=null;nextAvailable=0;}
  function snapshot(){
    return Object.freeze({
      name:active?.name||'',progress:active?clamp01(active.elapsed/active.duration):0,
      active:!!active,pending:pending?.token||'',time
    });
  }
  function step(dt,{inputs=[],grounded=false,speed=0,busy=false}={}){
    const delta=Math.max(0,Math.min(.1,Number(dt)||0));
    time+=delta;
    let completed=null;
    // Airborne tricks, grinds, manuals, and falls own the rider pose.
    if(!grounded||busy||!Number.isFinite(speed)||speed<MIN_ROLLING_SPEED){
      pending=null;active=null;
      return {completed,snapshot:snapshot()};
    }
    if(active){
      active.elapsed+=delta;
      if(active.elapsed>=active.duration){
        completed={type:active.name,source:'street-skate-flatland'};
        active=null;
        nextAvailable=time+RESTART_COOLDOWN;
      }
    }
    if(pending&&time-pending.at>COMBO_WINDOW)pending=null;
    const tokens=Array.isArray(inputs)?inputs:[inputs];
    for(const token of tokens){
      if(!valid.has(token)||active||time<nextAvailable)continue;
      if(!pending){pending={token,at:time};continue;}
      const profile=STREETSKATE_FLATLAND_TRICKS[pending.token+'+'+token];
      pending=null;
      if(!profile)continue;
      // StreetSkate uses instability to describe trick difficulty; use
      // a short, repeatable presentation period rather than arbitrary physics.
      const duration=.55+profile.instability*.52;
      active={...profile,elapsed:0,duration};
    }
    return {completed,snapshot:snapshot()};
  }
  return {step,snapshot,reset};
}
