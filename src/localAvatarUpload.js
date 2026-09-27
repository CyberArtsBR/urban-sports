export const MAX_LOCAL_GLB_BYTES=50*1024*1024;
export const MAX_LOCAL_GLB_JSON_BYTES=4*1024*1024;
export const LOCAL_AVATAR_ID='local-user-glb';

export const LOCAL_GLB_CONTAINER_LIMITS=Object.freeze({
  nodes:800,
  meshes:160,
  materials:128,
  textures:96,
  images:96,
  accessors:1600,
  bufferViews:1600,
  animations:32,
  animationChannels:1200
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

const GLB_MAGIC=0x46546c67;
const GLB_VERSION=2;
const GLB_JSON_CHUNK=0x4e4f534a;
const ACCESSOR_COMPONENT_TYPES=new Set([5120,5121,5122,5123,5125,5126]);
const ACCESSOR_TYPES=new Set(['SCALAR','VEC2','VEC3','VEC4','MAT2','MAT3','MAT4']);

function localGlbError(message,code){
  const error=new Error(message);
  error.code=code;
  return error;
}

function boundedArrayLength(json,key,limit,label=key){
  const value=json?.[key];
  if(value==null)return 0;
  if(!Array.isArray(value))throw localGlbError('Malformed GLB JSON: '+label+' must be an array.','LOCAL_GLB_MALFORMED_JSON');
  if(value.length>limit)throw localGlbError('This local GLB declares too many '+label+' ('+value.length+', limit '+limit+').','LOCAL_GLB_CONTAINER_TOO_COMPLEX');
  return value.length;
}

export function inspectLocalGlbJson(json,{limits=LOCAL_GLB_CONTAINER_LIMITS}={}){
  if(!json||typeof json!=='object'||Array.isArray(json))throw localGlbError('Malformed GLB JSON document.','LOCAL_GLB_MALFORMED_JSON');

  const stats={
    nodes:boundedArrayLength(json,'nodes',limits.nodes),
    meshes:boundedArrayLength(json,'meshes',limits.meshes),
    materials:boundedArrayLength(json,'materials',limits.materials),
    textures:boundedArrayLength(json,'textures',limits.textures),
    images:boundedArrayLength(json,'images',limits.images),
    accessors:boundedArrayLength(json,'accessors',limits.accessors),
    bufferViews:boundedArrayLength(json,'bufferViews',limits.bufferViews),
    animations:boundedArrayLength(json,'animations',limits.animations),
    animationChannels:0
  };

  const externalUris=[];
  for(const [collectionName,items] of [['buffers',json.buffers],['images',json.images]]){
    if(items==null)continue;
    if(!Array.isArray(items))throw localGlbError('Malformed GLB JSON: '+collectionName+' must be an array.','LOCAL_GLB_MALFORMED_JSON');
    for(const item of items){
      const uri=typeof item?.uri==='string'?item.uri.trim():'';
      if(uri&&!/^data:/i.test(uri))externalUris.push({collection:collectionName,uri});
    }
  }
  if(externalUris.length){
    throw localGlbError('Local GLB files must be self-contained and cannot reference external URIs.','LOCAL_GLB_EXTERNAL_URI');
  }

  for(const [index,accessor] of (json.accessors||[]).entries()){
    if(!accessor||typeof accessor!=='object')throw localGlbError('Malformed accessor '+index+'.','LOCAL_GLB_MALFORMED_ACCESSOR');
    if(!ACCESSOR_COMPONENT_TYPES.has(accessor.componentType))throw localGlbError('Malformed accessor '+index+': unsupported componentType.','LOCAL_GLB_MALFORMED_ACCESSOR');
    if(!ACCESSOR_TYPES.has(accessor.type))throw localGlbError('Malformed accessor '+index+': unsupported type.','LOCAL_GLB_MALFORMED_ACCESSOR');
    if(!Number.isInteger(accessor.count)||accessor.count<0)throw localGlbError('Malformed accessor '+index+': invalid count.','LOCAL_GLB_MALFORMED_ACCESSOR');
    if(accessor.bufferView!=null&&(!Number.isInteger(accessor.bufferView)||accessor.bufferView<0||accessor.bufferView>=stats.bufferViews)){
      throw localGlbError('Malformed accessor '+index+': invalid bufferView.','LOCAL_GLB_MALFORMED_ACCESSOR');
    }
    if(accessor.byteOffset!=null&&(!Number.isInteger(accessor.byteOffset)||accessor.byteOffset<0)){
      throw localGlbError('Malformed accessor '+index+': invalid byteOffset.','LOCAL_GLB_MALFORMED_ACCESSOR');
    }
  }

  for(const animation of json.animations||[]){
    const channels=Array.isArray(animation?.channels)?animation.channels:[];
    const samplers=Array.isArray(animation?.samplers)?animation.samplers:[];
    stats.animationChannels+=channels.length;
    if(stats.animationChannels>limits.animationChannels){
      throw localGlbError('This local GLB declares too many animation channels ('+stats.animationChannels+', limit '+limits.animationChannels+').','LOCAL_GLB_CONTAINER_TOO_COMPLEX');
    }
    for(const channel of channels){
      const sampler=channel?.sampler;
      if(!Number.isInteger(sampler)||sampler<0||sampler>=samplers.length){
        throw localGlbError('Malformed animation channel sampler.','LOCAL_GLB_MALFORMED_ANIMATION');
      }
    }
  }

  return stats;
}

export async function validateLocalGlbFile(file,{maxBytes=MAX_LOCAL_GLB_BYTES,maxJsonBytes=MAX_LOCAL_GLB_JSON_BYTES,containerLimits=LOCAL_GLB_CONTAINER_LIMITS}={}){
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

  const jsonLength=view.getUint32(12,true);
  const jsonType=view.getUint32(16,true);
  if(jsonType!==GLB_JSON_CHUNK)throw localGlbError('The GLB JSON chunk is missing or malformed.','LOCAL_GLB_MALFORMED_JSON');
  if(jsonLength<=0||jsonLength>maxJsonBytes){
    throw localGlbError('The GLB JSON chunk is too large or invalid. Maximum JSON size is '+Math.round(maxJsonBytes/1048576)+' MB.','LOCAL_GLB_JSON_TOO_LARGE');
  }
  if(20+jsonLength>size)throw localGlbError('The GLB JSON chunk length exceeds the file length.','LOCAL_GLB_MALFORMED_JSON');

  const jsonBuffer=await file.slice(20,20+jsonLength).arrayBuffer();
  if(jsonBuffer.byteLength!==jsonLength)throw localGlbError('The GLB JSON chunk is incomplete.','LOCAL_GLB_MALFORMED_JSON');
  let json;
  try{
    const text=new TextDecoder().decode(jsonBuffer).replace(/\u0000+$/g,'').trim();
    json=JSON.parse(text);
  }catch{
    throw localGlbError('The GLB JSON chunk cannot be parsed.','LOCAL_GLB_MALFORMED_JSON');
  }
  const containerStats=inspectLocalGlbJson(json,{limits:containerLimits});
  return {name,size,jsonBytes:jsonLength,containerStats};
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
      for(const value of Object.values(material)){
        if(value?.isTexture)textures.add(value);
      }
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
    vertices,
    meshes,
    geometries:geometries.size,
    materials:materials.size,
    textures:textures.size,
    maxTextureDimension,
    bones:bones.size,
    animations:animations.length,
    animationTracks,
    geometryBytes,
    textureBytes,
    estimatedDecodedGpuBytes
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
