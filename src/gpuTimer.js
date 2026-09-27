const SAMPLE_WINDOW=120;

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

export function createGpuTimer(renderer){
  const gl=renderer?.getContext?.()||null;
  const ext=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2')||null;
  const samples=[];
  const pending=[];
  let active=null;
  let lastMs=0;
  let discarded=0;
  let errors=0;

  function record(valueMs){
    if(!Number.isFinite(valueMs)||valueMs<0)return;
    lastMs=valueMs;
    samples.push(valueMs);
    if(samples.length>SAMPLE_WINDOW)samples.shift();
  }

  function poll(){
    if(!ext||!gl)return;
    while(pending.length){
      const query=pending[0];
      let available=false,disjoint=false;
      try{
        available=!!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE);
        disjoint=!!gl.getParameter(ext.GPU_DISJOINT_EXT);
      }catch{
        errors++;
        break;
      }
      if(!available)break;
      pending.shift();
      try{
        const elapsedNs=gl.getQueryParameter(query,gl.QUERY_RESULT);
        if(disjoint)discarded++;
        else record(Number(elapsedNs)/1e6);
      }catch{
        errors++;
      }finally{
        try{gl.deleteQuery(query);}catch{}
      }
    }
  }

  function begin(){
    poll();
    if(!ext||!gl||active||pending.length>=4)return false;
    try{
      const query=gl.createQuery();
      if(!query)return false;
      gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
      active=query;
      return true;
    }catch{
      active=null;
      errors++;
      return false;
    }
  }

  function end(){
    if(!ext||!gl||!active)return false;
    const query=active;
    active=null;
    try{
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(query);
      poll();
      return true;
    }catch{
      errors++;
      try{gl.deleteQuery(query);}catch{}
      return false;
    }
  }

  function getDiagnostics(){
    poll();
    const average=samples.length?samples.reduce((sum,value)=>sum+value,0)/samples.length:0;
    return {
      supported:!!ext,
      lastMs:round(lastMs),
      averageMs:round(average),
      p50Ms:round(percentile(samples,.50)),
      p95Ms:round(percentile(samples,.95)),
      samples:samples.length,
      pending:pending.length+(active?1:0),
      discarded,
      errors
    };
  }

  function dispose(){
    if(!gl)return;
    if(active){
      try{gl.endQuery(ext.TIME_ELAPSED_EXT);}catch{}
      try{gl.deleteQuery(active);}catch{}
      active=null;
    }
    while(pending.length){
      try{gl.deleteQuery(pending.pop());}catch{}
    }
    samples.length=0;
  }

  return {begin,end,poll,getDiagnostics,dispose};
}
