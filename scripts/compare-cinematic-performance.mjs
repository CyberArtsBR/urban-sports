import {readFile,writeFile} from 'node:fs/promises';

const [legacyPath='benchmark-max.json',cinematicPath='benchmark-max-cinematic.json',outputPath='benchmark-max-vs-cinematic.json']=process.argv.slice(2);

async function load(path){return JSON.parse(await readFile(path,'utf8'));}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function deltaPct(next,base){
  const a=finite(next),b=finite(base);
  if(a==null||b==null||Math.abs(b)<1e-9)return null;
  return Math.round(((a-b)/b)*10000)/100;
}
function phase(report,name){
  const value=report?.phases?.[name]||{};
  return {
    status:value.status??'UNAVAILABLE',
    averageFrameMs:finite(value.frames?.averageFrameMs),
    p50FrameMs:finite(value.frames?.p50FrameMs),
    p95FrameMs:finite(value.frames?.p95FrameMs),
    p99FrameMs:finite(value.frames?.p99FrameMs),
    averageFps:finite(value.frames?.averageFps)
  };
}
function comparePhase(legacy,cinematic,name){
  const a=phase(legacy,name),b=phase(cinematic,name);
  return {
    legacy:a,
    cinematic:b,
    deltaPct:{
      averageFrameMs:deltaPct(b.averageFrameMs,a.averageFrameMs),
      p50FrameMs:deltaPct(b.p50FrameMs,a.p50FrameMs),
      p95FrameMs:deltaPct(b.p95FrameMs,a.p95FrameMs),
      p99FrameMs:deltaPct(b.p99FrameMs,a.p99FrameMs),
      averageFps:deltaPct(b.averageFps,a.averageFps)
    }
  };
}

const [legacy,cinematic]=await Promise.all([load(legacyPath),load(cinematicPath)]);
const phases=['E_gameplayFirst30Seconds','F_extendedGameplay','G_repeatedRestart','K_trickHeavy'];
const comparison={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  note:'Software/headless measurements are directional. Validate final GPU cost on representative hardware before promoting MAX CINEMATIC into AUTO.',
  legacyTarget:legacy?.target??null,
  cinematicTarget:cinematic?.target??null,
  phases:Object.fromEntries(phases.map(name=>[name,comparePhase(legacy,cinematic,name)]))
};
await writeFile(outputPath,JSON.stringify(comparison,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'COMPLETE',outputPath,gameplay:comparison.phases.E_gameplayFirst30Seconds},null,2));
