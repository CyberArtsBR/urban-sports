export const MAX_LOCAL_GLB_BYTES=50*1024*1024;
export const MAX_LOCAL_GLB_JSON_BYTES=4*1024*1024;
export const LOCAL_AVATAR_ID='local-user-glb';

const GLB_MAGIC=0x46546c67;
const GLB_VERSION=2;
const GLB_JSON_CHUNK=0x4e4f534a;

export const LOCAL_GLB_PREFLIGHT_LIMITS=Object.freeze({
  nodes:512,
  meshes:96,
  primitives:256,
  accessors:2048,
  vertices:500000,
  materials:64,
  textures:48,
  images:48,
  morphTargets:128,
  skins:16,
  bones:180,
  animations:24,
  animationTracks:700,
  hierarchyDepth:64,
  declaredBufferBytes:192*1024*1024,
  estimatedDecodedBytes:256*1024*1024
});

export const LOCAL_GLB_COMPLEXITY_LIMITS=Object.freeze({
  vertices:500000,
  meshes:96,
  materials:64,
  textures:48,
  maxTextureDimension:4096,
  bones:180,
  animations:24,
  animationTracks:700,
  estimatedDecodedGpuBytes:256*1024*1024
});

export const UPLOAD_AVATAR_ACTION=Object.freeze({
  id:'__upload-local-glb__',
  name:'UPLOAD YOUR 3D CHARACTER (GLB)',
  tribe:'LOCAL FILE · NO UPLOAD',
  image:'',
  url:'',
  localUploadAction:true
});

export function isUploadAvatarAction(entry){
  return entry?.id===UPLOAD_AVATAR_ACTION.id||entry?.localUploadAction===true;
}

function decodeJsonChunk(bytes){
  let text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  text=text.replace(/[\u0000\u0020]+$/g,'');
  if(!text)throw new Error('GLB JSON chunk is empty.');
  try{return JSON.parse(text);}
  catch{throw new Error('GLB JSON chunk is invalid JSON.');}
}

function accessorComponents(type){
  return {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16}[type]||1;
}
function componentBytes(componentType){
  return {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[componentType]||4;
}
function countHierarchyDepth(nodes=[]){
  if(!nodes.length)return 0;
  const referenced=new Set();
  for(const node of nodes)for(const child of node?.children||[])if(Number.isInteger(child))referenced.add(child);
  const roots=nodes.map((_,index)=>index).filter(index=>!referenced.has(index));
  const starts=roots.length?roots:nodes.map((_,index)=>index);
  let maxDepth=0;
  const stack=starts.map(index=>({index,depth:1,path:new Set()}));
  while(stack.length){
    const item=stack.pop();
    if(item.depth>maxDepth)maxDepth=item.depth;
    if(item.path.has(item.index))return Number.POSITIVE_INFINITY;
    const nextPath=new Set(item.path);nextPath.add(item.index);
    const node=nodes[item.index];
    for(const child of node?.children||[]){
      if(Number.isInteger(child)&&child>=0&&child<nodes.length){
        stack.push({index:child,depth:item.depth+1,path:nextPath});
      }
    }
  }
  return maxDepth;
}
function collectExternalUris(json){
  const uris=[];
  for(const buffer of json?.buffers||[])if(typeof buffer?.uri==='string'&&!/^data:/i.test(buffer.uri))uris.push(buffer.uri);
  for(const image of json?.images||[])if(typeof image?.uri==='string'&&!/^data:/i.test(image.uri))uris.push(image.uri);
  return uris;
}

export function inspectLocalGlbJson(json={}){
  const nodes=Array.isArray(json.nodes)?json.nodes:[];
  const meshes=Array.isArray(json.meshes)?json.meshes:[];
  const accessors=Array.isArray(json.accessors)?json.accessors:[];
  const materials=Array.isArray(json.materials)?json.materials:[];
  const textures=Array.isArray(json.textures)?json.textures:[];
  const images=Array.isArray(json.images)?json.images:[];
  const skins=Array.isArray(json.skins)?json.skins:[];
  const animations=Array.isArray(json.animations)?json.animations:[];
  const bufferViews=Array.isArray(json.bufferViews)?json.bufferViews:[];
  const buffers=Array.isArray(json.buffers)?json.buffers:[];

  let primitives=0;
  let morphTargets=0;
  const positionAccessors=new Set();
  for(const mesh of meshes){
    for(const primitive of mesh?.primitives||[]){
      primitives++;
      if(Number.isInteger(primitive?.attributes?.POSITION))positionAccessors.add(primitive.attributes.POSITION);
      morphTargets+=Array.isArray(primitive?.targets)?primitive.targets.length:0;
    }
  }
  let vertices=0;
  for(const index of positionAccessors)vertices+=Number(accessors[index]?.count)||0;

  const boneIndexes=new Set();
  for(const skin of skins)for(const joint of skin?.joints||[])if(Number.isInteger(joint))boneIndexes.add(joint);
  const animationTracks=animations.reduce((sum,animation)=>sum+(Array.isArray(animation?.channels)?animation.channels.length:0),0);
  const declaredBufferBytes=buffers.reduce((sum,buffer)=>sum+(Number(buffer?.byteLength)||0),0);

  let accessorDecodedBytes=0;
  for(const accessor of accessors){
    accessorDecodedBytes+=(Number(accessor?.count)||0)*accessorComponents(accessor?.type)*componentBytes(accessor?.componentType);
  }
  let embeddedImageSourceBytes=0;
  for(const image of images){
    const index=Number(image?.bufferView);
    if(Number.isInteger(index)&&index>=0)embeddedImageSourceBytes+=Number(bufferViews[index]?.byteLength)||0;
  }
  const estimatedDecodedBytes=accessorDecodedBytes+embeddedImageSourceBytes*8;

  return {
    nodes:nodes.length,
    meshes:meshes.length,
    primitives,
    accessors:accessors.length,
    vertices,
    materials:materials.length,
    textures:textures.length,
    images:images.length,
    morphTargets,
    skins:skins.length,
    bones:boneIndexes.size,
    animations:animations.length,
    animationTracks,
    hierarchyDepth:countHierarchyDepth(nodes),
    declaredBufferBytes,
    accessorDecodedBytes,
    embeddedImageSourceBytes,
    estimatedDecodedBytes,
    externalUris:collectExternalUris(json)
  };
}

function enforcePreflightLimits(stats,limits=LOCAL_GLB_PREFLIGHT_LIMITS){
  if(stats.externalUris.length){
    const error=new Error('Local GLB must be self-contained. External resource URIs are not allowed.');
    error.code='LOCAL_GLB_EXTERNAL_URI';
    error.externalUris=[...stats.externalUris];
    throw error;
  }
  const failures=[];
  const labels={
    nodes:'nodes',meshes:'meshes',primitives:'primitives',accessors:'accessors',vertices:'vertices',
    materials:'materials',textures:'textures',images:'images',morphTargets:'morph targets',skins:'skins',
    bones:'bones',animations:'animations',animationTracks:'animation tracks',hierarchyDepth:'hierarchy depth',
    declaredBufferBytes:'declared buffer bytes',estimatedDecodedBytes:'estimated decoded bytes'
  };
  for(const [key,label] of Object.entries(labels)){
    const limit=Number(limits?.[key]);
    if(Number.isFinite(limit)&&stats[key]>limit)failures.push(`${label} ${stats[key]} (limit ${limit})`);
  }
  if(failures.length){
    const error=new Error('This local GLB is too complex to inspect safely: '+failures.join('; ')+'.');
    error.code='LOCAL_GLB_PREFLIGHT_LIMIT';
    error.stats=stats;
    throw error;
  }
  return stats;
}

export function inspectGlbContainerBytes(arrayBuffer,{maxJsonBytes=MAX_LOCAL_GLB_JSON_BYTES,limits=LOCAL_GLB_PREFLIGHT_LIMITS}={}){
  if(!(arrayBuffer instanceof ArrayBuffer))throw new Error('GLB preflight requires an ArrayBuffer.');
  if(arrayBuffer.byteLength<20)throw new Error('This GLB is incomplete.');
  const view=new DataView(arrayBuffer);
  if(view.getUint32(0,true)!==GLB_MAGIC)throw new Error('Invalid GLB file header.');
  if(view.getUint32(4,true)!==GLB_VERSION)throw new Error('Only GLB version 2 is supported.');
  if(view.getUint32(8,true)!==arrayBuffer.byteLength)throw new Error('The GLB file length does not match its header.');
  const jsonBytes=view.getUint32(12,true);
  const chunkType=view.getUint32(16,true);
  if(chunkType!==GLB_JSON_CHUNK)throw new Error('GLB JSON chunk must be the first chunk.');
  if(jsonBytes<=0||jsonBytes>maxJsonBytes)throw new Error('GLB JSON chunk is too large.');
  if(20+jsonBytes>arrayBuffer.byteLength)throw new Error('GLB JSON chunk exceeds the file length.');
  const json=decodeJsonChunk(new Uint8Array(arrayBuffer,20,jsonBytes));
  const stats=inspectLocalGlbJson(json);
  enforcePreflightLimits(stats,limits);
  return {json,stats,jsonBytes};
}

export async function validateLocalGlbFile(file,{maxBytes=MAX_LOCAL_GLB_BYTES,maxJsonBytes=MAX_LOCAL_GLB_JSON_BYTES,limits=LOCAL_GLB_PREFLIGHT_LIMITS}={}){
  const name=String(file?.name||'');
  const size=Number(file?.size)||0;
  if(!/\.glb$/i.test(name))throw new Error('Choose a .glb file.');
  if(size<20)throw new Error('This GLB is empty or incomplete.');
  if(size>maxBytes)throw new Error('This GLB is too large. Maximum size is '+Math.round(maxBytes/1048576)+' MB.');
  if(typeof file?.slice!=='function')throw new Error('The selected file cannot be read.');

  const prefix=await file.slice(0,20).arrayBuffer();
  if(prefix.byteLength<20)throw new Error('This GLB is incomplete.');
  const view=new DataView(prefix);
  if(view.getUint32(0,true)!==GLB_MAGIC)throw new Error('Invalid GLB file header.');
  if(view.getUint32(4,true)!==GLB_VERSION)throw new Error('Only GLB version 2 is supported.');
  if(view.getUint32(8,true)!==size)throw new Error('The GLB file length does not match its header.');
  const jsonBytes=view.getUint32(12,true);
  const chunkType=view.getUint32(16,true);
  if(chunkType!==GLB_JSON_CHUNK)throw new Error('GLB JSON chunk must be the first chunk.');
  if(jsonBytes<=0||jsonBytes>maxJsonBytes)throw new Error('GLB JSON chunk is too large.');
  if(20+jsonBytes>size)throw new Error('GLB JSON chunk exceeds the file length.');

  const jsonBuffer=await file.slice(20,20+jsonBytes).arrayBuffer();
  if(jsonBuffer.byteLength!==jsonBytes)throw new Error('GLB JSON chunk could not be read completely.');
  const json=decodeJsonChunk(new Uint8Array(jsonBuffer));
  const stats=inspectLocalGlbJson(json);
  enforcePreflightLimits(stats,limits);
  return {name,size,jsonBytes,preflight:stats};
}

function textureSize(texture){
  const source=texture?.source?.data??texture?.image??texture?.source;
  const width=Number(source?.width??source?.videoWidth??0)||0;
  const height=Number(source?.height??source?.videoHeight??0)||0;
  return {width,height};
}

export function inspectParsedLocalGlb(gltf){
  const root=gltf?.scene??gltf;
  const geometries=new Set();
  const materials=new Set();
  const textures=new Set();
  const bones=new Set();
  let meshes=0;
  let vertices=0;
  let geometryBytes=0;
  let textureBytes=0;
  let maxTextureDimension=0;

  root?.traverse?.(object=>{
    if(object?.isBone)bones.add(object);
    if(!object?.isMesh)return;
    meshes++;
    const geometry=object.geometry;
    if(geometry&&!geometries.has(geometry)){
      geometries.add(geometry);
      const position=geometry.attributes?.position;
      vertices+=Number(position?.count)||0;
      for(const attribute of Object.values(geometry.attributes||{})){
        const array=attribute?.array;
        if(array?.byteLength)geometryBytes+=array.byteLength;
      }
      if(geometry.index?.array?.byteLength)geometryBytes+=geometry.index.array.byteLength;
      for(const morphList of Object.values(geometry.morphAttributes||{})){
        for(const attribute of morphList||[]){
          const array=attribute?.array;
          if(array?.byteLength)geometryBytes+=array.byteLength;
        }
      }
    }

    const list=Array.isArray(object.material)?object.material:[object.material];
    for(const material of list){
      if(!material)continue;
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      for(const uniform of Object.values(material.uniforms||{})){
        const value=uniform?.value;
        if(value?.isTexture)textures.add(value);
      }
    }
  });

  for(const texture of textures){
    const {width,height}=textureSize(texture);
    maxTextureDimension=Math.max(maxTextureDimension,width,height);
    if(width>0&&height>0)textureBytes+=Math.ceil(width*height*4*4/3);
  }

  const animations=Array.isArray(gltf?.animations)?gltf.animations:[];
  const animationTracks=animations.reduce((sum,clip)=>sum+(clip?.tracks?.length||0),0);
  const estimatedDecodedGpuBytes=geometryBytes+textureBytes;

  return {
    vertices,meshes,geometries:geometries.size,materials:materials.size,textures:textures.size,
    maxTextureDimension,bones:bones.size,animations:animations.length,animationTracks,
    geometryBytes,textureBytes,estimatedDecodedGpuBytes
  };
}

export function validateParsedLocalGlb(gltf,{limits=LOCAL_GLB_COMPLEXITY_LIMITS}={}){
  const stats=inspectParsedLocalGlb(gltf);
  const failures=[];
  const check=(key,label,format=value=>String(value))=>{
    const limit=Number(limits?.[key]);
    if(Number.isFinite(limit)&&stats[key]>limit)failures.push(`${label} ${format(stats[key])} (limit ${format(limit)})`);
  };
  check('vertices','vertices');
  check('meshes','meshes');
  check('materials','materials');
  check('textures','textures');
  check('maxTextureDimension','texture dimension',value=>Math.round(value)+' px');
  check('bones','bones');
  check('animations','animations');
  check('animationTracks','animation tracks');
  check('estimatedDecodedGpuBytes','estimated decoded GPU memory',value=>Math.round(value/1048576)+' MB');

  if(failures.length){
    const error=new Error('This local GLB is too complex for safe real-time use: '+failures.join('; ')+'. Try reducing texture resolution, mesh count, or animation data.');
    error.code='LOCAL_GLB_TOO_COMPLEX';
    error.stats=stats;
    throw error;
  }
  return stats;
}

export function createLocalAvatarEntry(file,objectUrl){
  if(!objectUrl||!String(objectUrl).startsWith('blob:'))throw new Error('Local avatar must use a browser object URL.');
  const displayName=String(file?.name||'Custom Chimpion').replace(/\.glb$/i,'').trim()||'Custom Chimpion';
  return {
    id:LOCAL_AVATAR_ID,
    name:displayName,
    image:'',
    tribe:'LOCAL GLB · SESSION ONLY',
    url:'',
    localObjectUrl:String(objectUrl),
    localOnly:true,
    fileName:String(file?.name||''),
    fileSize:Number(file?.size)||0,
    lastModified:Number(file?.lastModified)||0
  };
}
