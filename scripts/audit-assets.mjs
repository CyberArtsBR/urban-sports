import {createHash} from 'node:crypto';
import {mkdir,readdir,readFile,stat,writeFile} from 'node:fs/promises';
import {extname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicDir=join(root,'public');
const sourceAssetsDir=join(root,'src','assets');
const writeReport=process.argv.includes('--write');
const enforce=process.argv.includes('--check');

const HARD_BUDGETS=Object.freeze({
  sourceBytes:16*1024*1024,
  vertices:900000,
  meshes:160,
  primitives:240,
  materials:128,
  textures:96,
  maxTextureDimension:8192,
  bones:256,
  animations:32,
  estimatedDecodedBytes:640*1024*1024
});
const PREFERRED_GLB_BYTES=6*1024*1024;
const assetExt=/\.(glb|gltf|png|jpe?g|webp|ktx2|basis|mp3|ogg|wav|m4a|woff2?|ttf|otf)$/i;

async function walk(dir,out=[]){
  for(const name of await readdir(dir)){
    const path=join(dir,name);
    const info=await stat(path);
    if(info.isDirectory())await walk(path,out);
    else if(assetExt.test(name))out.push(path);
  }
  return out;
}
function components(type){return {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16}[type]||1;}
function componentBytes(type){return {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[type]||4;}
function pngSize(bytes){
  if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)return null;
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}
function jpegSize(bytes){
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  let offset=2;
  while(offset+9<bytes.length){
    if(bytes[offset]!==0xff){offset++;continue;}
    const marker=bytes[offset+1];offset+=2;
    if(marker===0xd8||marker===0xd9)continue;
    if(offset+2>bytes.length)break;
    const length=bytes.readUInt16BE(offset);
    if(length<2||offset+length>bytes.length)break;
    if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
      return {height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};
    }
    offset+=length;
  }
  return null;
}
function webpSize(bytes){
  if(bytes.length<30||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')return null;
  const type=bytes.toString('ascii',12,16);
  if(type==='VP8X'){
    return {
      width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),
      height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)
    };
  }
  if(type==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){
    const bits=bytes.readUInt32LE(21);
    return {width:1+(bits&0x3fff),height:1+((bits>>14)&0x3fff)};
  }
  if(type==='VP8 '){
    for(let i=20;i+7<bytes.length;i++){
      if(bytes[i]===0x9d&&bytes[i+1]===0x01&&bytes[i+2]===0x2a){
        return {width:bytes.readUInt16LE(i+3)&0x3fff,height:bytes.readUInt16LE(i+5)&0x3fff};
      }
    }
  }
  return null;
}
function imageSize(bytes,mime=''){
  return mime.includes('png')?pngSize(bytes):
    (mime.includes('jpeg')||mime.includes('jpg'))?jpegSize(bytes):
    mime.includes('webp')?webpSize(bytes):
    (pngSize(bytes)||jpegSize(bytes)||webpSize(bytes));
}
function hierarchyDepth(nodes=[]){
  const referenced=new Set();
  for(const node of nodes)for(const child of node?.children||[])referenced.add(child);
  const roots=nodes.map((_,i)=>i).filter(i=>!referenced.has(i));
  let max=0;
  const stack=(roots.length?roots:nodes.map((_,i)=>i)).map(index=>({index,depth:1,path:new Set()}));
  while(stack.length){
    const item=stack.pop();max=Math.max(max,item.depth);
    if(item.path.has(item.index))return Infinity;
    const path=new Set(item.path);path.add(item.index);
    for(const child of nodes[item.index]?.children||[])if(Number.isInteger(child)&&nodes[child])stack.push({index:child,depth:item.depth+1,path});
  }
  return max;
}
function parseGlb(buffer){
  if(buffer.length<20||buffer.readUInt32LE(0)!==0x46546c67||buffer.readUInt32LE(4)!==2)throw new Error('invalid GLB header');
  if(buffer.readUInt32LE(8)!==buffer.length)throw new Error('GLB length mismatch');
  const jsonLength=buffer.readUInt32LE(12);
  if(buffer.readUInt32LE(16)!==0x4e4f534a)throw new Error('GLB JSON chunk missing');
  const json=JSON.parse(buffer.subarray(20,20+jsonLength).toString('utf8').replace(/[\u0000\u0020]+$/g,''));
  let cursor=20+jsonLength;
  let bin=null;
  while(cursor+8<=buffer.length){
    const len=buffer.readUInt32LE(cursor),type=buffer.readUInt32LE(cursor+4);
    const start=cursor+8,end=start+len;
    if(end>buffer.length)break;
    if(type===0x004e4942){bin=buffer.subarray(start,end);break;}
    cursor=end;
  }
  const nodes=json.nodes||[],meshes=json.meshes||[],accessors=json.accessors||[],materials=json.materials||[],textures=json.textures||[],images=json.images||[],skins=json.skins||[],animations=json.animations||[],views=json.bufferViews||[];
  let primitives=0,morphTargets=0;
  const positions=new Set();
  for(const mesh of meshes)for(const primitive of mesh.primitives||[]){
    primitives++;
    if(Number.isInteger(primitive?.attributes?.POSITION))positions.add(primitive.attributes.POSITION);
    morphTargets+=(primitive.targets||[]).length;
  }
  let vertices=0;
  for(const index of positions)vertices+=Number(accessors[index]?.count)||0;
  const bones=new Set();
  for(const skin of skins)for(const joint of skin.joints||[])bones.add(joint);
  const animationTracks=animations.reduce((sum,a)=>sum+(a.channels||[]).length,0);
  let accessorDecodedBytes=0;
  for(const accessor of accessors)accessorDecodedBytes+=(Number(accessor.count)||0)*components(accessor.type)*componentBytes(accessor.componentType);
  const materialSignatures=new Map();
  for(const material of materials){
    const signature=JSON.stringify(material);
    materialSignatures.set(signature,(materialSignatures.get(signature)||0)+1);
  }
  const duplicateMaterialDefinitions=[...materialSignatures.values()].filter(count=>count>1).reduce((sum,count)=>sum+count-1,0);
  const embeddedImageHashes=new Map();
  let textureDecodedBytes=0,maxTextureDimension=0,knownTextureDimensions=0;
  if(bin)for(const image of images){
    const view=views[image.bufferView];
    if(!view)continue;
    const start=Number(view.byteOffset)||0,length=Number(view.byteLength)||0;
    const imageBytes=bin.subarray(start,start+length);
    const hash=createHash('sha256').update(imageBytes).digest('hex');
    embeddedImageHashes.set(hash,(embeddedImageHashes.get(hash)||0)+1);
    const size=imageSize(imageBytes,String(image.mimeType||''));
    if(!size)continue;
    knownTextureDimensions++;
    maxTextureDimension=Math.max(maxTextureDimension,size.width,size.height);
    textureDecodedBytes+=Math.ceil(size.width*size.height*4*4/3);
  }
  return {
    nodes:nodes.length,meshes:meshes.length,primitives,accessors:accessors.length,vertices,
    materials:materials.length,textures:textures.length,images:images.length,morphTargets,
    skins:skins.length,bones:bones.size,animations:animations.length,animationTracks,
    hierarchyDepth:hierarchyDepth(nodes),maxTextureDimension,knownTextureDimensions,
    duplicateMaterialDefinitions,
    duplicateEmbeddedImages:[...embeddedImageHashes.values()].filter(count=>count>1).reduce((sum,count)=>sum+count-1,0),
    accessorDecodedBytes,textureDecodedBytes,estimatedDecodedBytes:accessorDecodedBytes+textureDecodedBytes
  };
}

const files=[...(await walk(publicDir)),...(await walk(sourceAssetsDir))];
const assets=[];
for(const path of files){
  const bytes=await readFile(path);
  const item={
    path:relative(root,path).replaceAll('\\','/'),
    extension:extname(path).slice(1).toLowerCase(),
    sourceBytes:bytes.length,
    transferBytesEstimate:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')
  };
  if(['png','jpg','jpeg','webp'].includes(item.extension)){
    const dimensions=imageSize(bytes,item.extension);
    if(dimensions){
      item.width=dimensions.width;
      item.height=dimensions.height;
      item.estimatedDecodedBytes=Math.ceil(dimensions.width*dimensions.height*4*4/3);
    }
  }
  if(item.extension==='glb'){
    try{Object.assign(item,parseGlb(bytes));}
    catch(error){item.glbError=String(error?.message||error);}
  }
  assets.push(item);
}
assets.sort((a,b)=>b.sourceBytes-a.sourceBytes);

const duplicates=[];
const byHash=new Map();
for(const item of assets){
  const list=byHash.get(item.sha256)||[];list.push(item.path);byHash.set(item.sha256,list);
}
for(const [sha256,paths] of byHash)if(paths.length>1)duplicates.push({sha256,paths});

const glbs=assets.filter(item=>item.extension==='glb');
const violations=[];
for(const item of glbs){
  for(const [key,max] of Object.entries(HARD_BUDGETS)){
    if(Number.isFinite(item[key])&&item[key]>max)violations.push({path:item.path,metric:key,value:item[key],max});
  }
  if(item.glbError)violations.push({path:item.path,metric:'glbParse',value:item.glbError,max:'valid GLB'});
}
const report={
  generatedAt:new Date().toISOString(),
  totals:{
    assets:assets.length,
    sourceBytes:assets.reduce((sum,item)=>sum+item.sourceBytes,0),
    estimatedTransferBytes:assets.reduce((sum,item)=>sum+item.transferBytesEstimate,0),
    glbBytes:glbs.reduce((sum,item)=>sum+item.sourceBytes,0)
  },
  budgets:{hard:HARD_BUDGETS,preferredGlbBytes:PREFERRED_GLB_BYTES},
  largest:assets.slice(0,20),
  builtInAvatars:glbs.map(item=>({...item,preferredSizeOk:item.sourceBytes<=PREFERRED_GLB_BYTES})),
  duplicates,
  violations
};

if(writeReport){
  const dir=join(root,'artifacts');await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'asset-audit.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
if(enforce&&violations.length){
  console.error('Asset hard-budget violations:',JSON.stringify(violations));
  process.exitCode=1;
}
