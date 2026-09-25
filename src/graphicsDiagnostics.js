const PROFILE_NAMES=Object.freeze(['low','medium','auto','high']);

const LOW=Object.freeze({
  rendererCalls:180,
  rendererTriangles:500000,
  rendererGeometries:256,
  rendererTextures:96,
  sceneObjectCount:900,
  instancedMeshCount:96,
  materialCount:180,
  lightCount:12,
  streamingSegmentCount:48,
  urbanPropPopulation:650,
  skylinePopulation:80,
  urbanDrawCalls:40,
  urbanInstances:900
});

const MEDIUM=Object.freeze({
  rendererCalls:260,
  rendererTriangles:900000,
  rendererGeometries:340,
  rendererTextures:128,
  sceneObjectCount:1250,
  instancedMeshCount:128,
  materialCount:250,
  lightCount:18,
  streamingSegmentCount:56,
  urbanPropPopulation:950,
  skylinePopulation:120,
  urbanDrawCalls:56,
  urbanInstances:1350
});

const HIGH=Object.freeze({
  rendererCalls:380,
  rendererTriangles:1600000,
  rendererGeometries:480,
  rendererTextures:180,
  sceneObjectCount:1800,
  instancedMeshCount:176,
  materialCount:360,
  lightCount:28,
  streamingSegmentCount:64,
  urbanPropPopulation:1450,
  skylinePopulation:180,
  urbanDrawCalls:80,
  urbanInstances:2200
});

export const GRAPHICS_QUALITY_BUDGETS=Object.freeze({
  low:LOW,
  medium:MEDIUM,
  auto:MEDIUM,
  high:HIGH,
  max:HIGH
});

export const GRAPHICS_BUDGET_METRICS=Object.freeze(Object.keys(HIGH));

const STABILITY_LIMITS=Object.freeze({
  rendererGeometries:{absolute:4,fraction:.05},
  rendererTextures:{absolute:2,fraction:.05},
  sceneGeometryCount:{absolute:4,fraction:.05},
  sceneTextureCount:{absolute:2,fraction:.05},
  sceneObjectCount:{absolute:20,fraction:.08},
  instancedMeshCount:{absolute:2,fraction:.05},
  materialCount:{absolute:4,fraction:.06},
  lightCount:{absolute:1,fraction:.05},
  streamingSegmentCount:{absolute:2,fraction:.05},
  urbanPropPopulation:{absolute:24,fraction:.08},
  skylinePopulation:{absolute:6,fraction:.08},
  urbanInstances:{absolute:32,fraction:.08}
});

function finite(value){
  if(value==null||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

function materialList(material){
  if(!material)return [];
  return Array.isArray(material)?material:[material];
}

function addMaterialTextures(material,textures){
  for(const value of Object.values(material||{})){
    if(value?.isTexture)textures.add(value);
  }
}

export function normalizeGraphicsBudgetProfile(value='high'){
  const normalized=String(value??'high').trim().toLowerCase();
  if(normalized==='max')return 'high';
  if(PROFILE_NAMES.includes(normalized))return normalized;
  if(normalized==='reduced')return 'medium';
  return 'high';
}

export function inspectSceneResources(scene){
  const geometries=new Set();
  const materials=new Set();
  const textures=new Set();
  let sceneObjectCount=0;
  let instancedMeshCount=0;
  let lightCount=0;
  let taggedStreamingSegments=0;

  scene?.traverse?.(object=>{
    sceneObjectCount++;
    if(object?.isInstancedMesh)instancedMeshCount++;
    if(object?.isLight)lightCount++;
    if(object?.geometry)geometries.add(object.geometry);
    for(const material of materialList(object?.material)){
      if(!material?.isMaterial)continue;
      materials.add(material);
      addMaterialTextures(material,textures);
    }
    const data=object?.userData||{};
    if(data.streamingSegment===true||data.courseSegment===true||data.urbanStreamingSegment===true){
      taggedStreamingSegments++;
    }
  });

  return {
    sceneObjectCount,
    instancedMeshCount,
    materialCount:materials.size,
    sceneGeometryCount:geometries.size,
    sceneTextureCount:textures.size,
    lightCount,
    taggedStreamingSegments
  };
}

function componentByName(diagnostics,name){
  return diagnostics?.components?.find?.(component=>component?.name===name)||null;
}

function logicalPopulation(component,divisor=1){
  const logical=finite(component?.logical);
  if(logical!=null)return logical;
  const instances=finite(component?.instances);
  return instances==null?0:Math.round(instances/Math.max(1,divisor));
}

export function extractUrbanGraphicsPopulation(urbanEnvironment){
  let diagnostics=null;
  try{diagnostics=urbanEnvironment?.getDiagnostics?.()??urbanEnvironment??null;}catch{}
  if(!diagnostics||typeof diagnostics!=='object'){
    return {
      streamingSegmentCount:0,
      urbanPropPopulation:0,
      skylinePopulation:0,
      urbanDrawCalls:0,
      urbanInstances:0
    };
  }

  const road=componentByName(diagnostics,'road');
  const markings=componentByName(diagnostics,'markings');
  const skyline=componentByName(diagnostics,'skyline');
  const decorativeNames=['streetlights','traffic-cones','barriers','signs','roadside-scenery'];
  const urbanPropPopulation=decorativeNames.reduce((sum,name)=>{
    const part=componentByName(diagnostics,name);
    return sum+logicalPopulation(part,Math.max(1,finite(part?.drawCalls)||1));
  },0);
  // Road entries are the actual recycled streaming segments. Marking entries
  // are individual dash instances within those segments and must not inflate
  // the segment count.
  const roadSegments=road?logicalPopulation(road,5):0;

  return {
    streamingSegmentCount:roadSegments,
    urbanPropPopulation,
    skylinePopulation:logicalPopulation(skyline,3),
    urbanDrawCalls:finite(diagnostics.drawCalls)??0,
    urbanInstances:finite(diagnostics.instances)??0
  };
}

export function captureGraphicsDiagnostics({renderer=null,scene=null,urbanEnvironment=null}={}){
  const sceneStats=inspectSceneResources(scene);
  const urban=extractUrbanGraphicsPopulation(urbanEnvironment);
  return {
    rendererCalls:finite(renderer?.info?.render?.calls),
    rendererTriangles:finite(renderer?.info?.render?.triangles),
    rendererGeometries:finite(renderer?.info?.memory?.geometries),
    rendererTextures:finite(renderer?.info?.memory?.textures),
    ...sceneStats,
    ...urban
  };
}

export function evaluateGraphicsBudget(snapshot,profile='high'){
  const normalized=normalizeGraphicsBudgetProfile(profile);
  const budget=GRAPHICS_QUALITY_BUDGETS[normalized];
  const violations=[];
  const checked={};
  for(const metric of GRAPHICS_BUDGET_METRICS){
    const value=finite(snapshot?.[metric]);
    if(value==null)continue;
    const max=budget[metric];
    checked[metric]={value,max,headroom:max-value};
    if(value>max)violations.push({metric,value,max,over:value-max});
  }
  return {ok:violations.length===0,profile:normalized,budget,checked,violations};
}

function monotonicFraction(values){
  if(values.length<2)return 0;
  let nonDecreasing=0;
  for(let index=1;index<values.length;index++){
    if(values[index]>=values[index-1])nonDecreasing++;
  }
  return nonDecreasing/(values.length-1);
}

export function analyzeGraphicsStability(samples,{limits=STABILITY_LIMITS,ignoredMetrics=[]}={}){
  const analyses={};
  const violations=[];
  const ignored=new Set(ignoredMetrics||[]);
  for(const [metric,rule] of Object.entries(limits)){
    if(ignored.has(metric))continue;
    const values=(samples||[]).map(sample=>finite(sample?.[metric])).filter(value=>value!=null);
    if(values.length<4){
      analyses[metric]={status:'UNAVAILABLE',samples:values.length};
      continue;
    }
    const start=values[0];
    const end=values.at(-1);
    const max=Math.max(...values);
    const growth=end-start;
    const allowed=Math.max(rule.absolute,Math.abs(start)*rule.fraction);
    const fraction=monotonicFraction(values);
    const suspicious=growth>allowed&&fraction>=.75;
    analyses[metric]={status:suspicious?'FAIL':'PASS',samples:values.length,start,end,max,growth,allowed,monotonicUpFraction:fraction};
    if(suspicious)violations.push({metric,start,end,growth,allowed,monotonicUpFraction:fraction});
  }
  return {ok:violations.length===0,analyses,violations};
}
