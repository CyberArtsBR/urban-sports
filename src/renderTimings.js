function percentile(values,p){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const index=(sorted.length-1)*p;
  const lo=Math.floor(index),hi=Math.ceil(index);
  if(lo===hi)return sorted[lo];
  return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);
}

function round(value,digits=3){
  const scale=10**digits;
  return Math.round((Number(value)||0)*scale)/scale;
}

export function createTimingSeries({capacity=120}={}){
  const limit=Math.max(8,Math.floor(Number(capacity)||120));
  const samples=[];
  let lastMs=0;

  function record(durationMs){
    const value=Number(durationMs);
    if(!Number.isFinite(value)||value<0)return false;
    lastMs=value;
    samples.push(value);
    if(samples.length>limit)samples.shift();
    return true;
  }

  function reset(){
    samples.length=0;
    lastMs=0;
  }

  function getDiagnostics(){
    const average=samples.length?samples.reduce((sum,value)=>sum+value,0)/samples.length:0;
    return {
      lastMs:round(lastMs),
      averageMs:round(average),
      p50Ms:round(percentile(samples,.50)),
      p95Ms:round(percentile(samples,.95)),
      p99Ms:round(percentile(samples,.99)),
      maxMs:round(samples.length?Math.max(...samples):0),
      samples:samples.length
    };
  }

  return {record,reset,getDiagnostics};
}

export function instrumentShadowMap(renderer,timing){
  const shadowMap=renderer?.shadowMap;
  if(!shadowMap||typeof shadowMap.render!=='function'||!timing?.record){
    return ()=>{};
  }
  const original=shadowMap.render.bind(shadowMap);
  shadowMap.render=(...args)=>{
    const started=globalThis.performance?.now?.()??Date.now();
    try{return original(...args);}
    finally{
      const ended=globalThis.performance?.now?.()??Date.now();
      timing.record(Math.max(0,ended-started));
    }
  };
  return ()=>{
    shadowMap.render=original;
  };
}
