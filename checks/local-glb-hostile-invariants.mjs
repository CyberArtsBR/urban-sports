import assert from 'node:assert/strict';
import {
  LOCAL_GLB_CONTAINER_LIMITS,
  MAX_LOCAL_GLB_BYTES,
  MAX_LOCAL_GLB_JSON_BYTES,
  validateLocalGlbFile
} from '../src/localAvatarUpload.js';

function paddedJsonBuffer(json){
  const raw=Buffer.from(JSON.stringify(json),'utf8');
  const pad=(4-(raw.length%4))%4;
  return pad?Buffer.concat([raw,Buffer.alloc(pad,0x20)]):raw;
}

function makeGlb(json){
  const payload=paddedJsonBuffer(json);
  const total=20+payload.length;
  const buffer=Buffer.alloc(total);
  buffer.writeUInt32LE(0x46546c67,0);
  buffer.writeUInt32LE(2,4);
  buffer.writeUInt32LE(total,8);
  buffer.writeUInt32LE(payload.length,12);
  buffer.writeUInt32LE(0x4e4f534a,16);
  payload.copy(buffer,20);
  return buffer;
}

function fileLike(buffer,{name='avatar.glb',size=buffer.length}={}){
  return {
    name,
    size,
    slice(start=0,end=buffer.length){
      const part=buffer.subarray(Math.max(0,start),Math.min(buffer.length,end));
      return {
        async arrayBuffer(){
          return part.buffer.slice(part.byteOffset,part.byteOffset+part.byteLength);
        }
      };
    }
  };
}

async function rejectsCode(file,code,label){
  await assert.rejects(
    ()=>validateLocalGlbFile(file),
    error=>{
      if(code)assert.equal(error?.code,code,label+' returned the wrong error code');
      return true;
    },
    label
  );
}

const minimal=makeGlb({asset:{version:'2.0'},scene:0,scenes:[{}],nodes:[]});
const valid=await validateLocalGlbFile(fileLike(minimal));
assert.equal(valid.name,'avatar.glb');
assert.equal(valid.size,minimal.length);
assert.equal(valid.containerStats.nodes,0);

{
  const broken=Buffer.from(minimal);
  broken.writeUInt32LE(0,0);
  await assert.rejects(()=>validateLocalGlbFile(fileLike(broken)),/header/i,'invalid magic must be rejected');
}

{
  const broken=Buffer.from(minimal);
  broken.writeUInt32LE(minimal.length+16,8);
  await assert.rejects(()=>validateLocalGlbFile(fileLike(broken)),/length/i,'mismatched declared file length must be rejected');
}

await assert.rejects(
  ()=>validateLocalGlbFile(fileLike(minimal,{size:MAX_LOCAL_GLB_BYTES+1})),
  /too large/i,
  'oversized local GLB must be rejected before parsing'
);

{
  const prefix=Buffer.alloc(20);
  const declaredJson=MAX_LOCAL_GLB_JSON_BYTES+4;
  const total=20+declaredJson;
  prefix.writeUInt32LE(0x46546c67,0);
  prefix.writeUInt32LE(2,4);
  prefix.writeUInt32LE(total,8);
  prefix.writeUInt32LE(declaredJson,12);
  prefix.writeUInt32LE(0x4e4f534a,16);
  await rejectsCode(fileLike(prefix,{size:total}),'LOCAL_GLB_JSON_TOO_LARGE','huge JSON chunk');
}

await rejectsCode(
  fileLike(makeGlb({
    asset:{version:'2.0'},
    nodes:Array.from({length:LOCAL_GLB_CONTAINER_LIMITS.nodes+1},()=>({}))
  })),
  'LOCAL_GLB_CONTAINER_TOO_COMPLEX',
  'excessive nodes'
);

await rejectsCode(
  fileLike(makeGlb({
    asset:{version:'2.0'},
    textures:Array.from({length:LOCAL_GLB_CONTAINER_LIMITS.textures+1},()=>({}))
  })),
  'LOCAL_GLB_CONTAINER_TOO_COMPLEX',
  'excessive textures'
);

await rejectsCode(
  fileLike(makeGlb({
    asset:{version:'2.0'},
    buffers:[{uri:'https://example.invalid/remote.bin',byteLength:4}]
  })),
  'LOCAL_GLB_EXTERNAL_URI',
  'remote buffer URI'
);

await rejectsCode(
  fileLike(makeGlb({
    asset:{version:'2.0'},
    images:[{uri:'textures/remote.png'}]
  })),
  'LOCAL_GLB_EXTERNAL_URI',
  'relative external texture URI'
);

{
  const channels=Array.from(
    {length:LOCAL_GLB_CONTAINER_LIMITS.animationChannels+1},
    ()=>({sampler:0,target:{node:0,path:'translation'}})
  );
  await rejectsCode(
    fileLike(makeGlb({
      asset:{version:'2.0'},
      nodes:[{}],
      animations:[{samplers:[{input:0,output:1}],channels}]
    })),
    'LOCAL_GLB_CONTAINER_TOO_COMPLEX',
    'pathological animation channels'
  );
}

await rejectsCode(
  fileLike(makeGlb({
    asset:{version:'2.0'},
    bufferViews:[],
    accessors:[{componentType:9999,type:'VEC3',count:3}]
  })),
  'LOCAL_GLB_MALFORMED_ACCESSOR',
  'malformed accessor component type'
);

await rejectsCode(
  fileLike(makeGlb({
    asset:{version:'2.0'},
    bufferViews:[],
    accessors:[{componentType:5126,type:'VEC3',count:3,bufferView:4}]
  })),
  'LOCAL_GLB_MALFORMED_ACCESSOR',
  'malformed accessor bufferView'
);

const dataUri=await validateLocalGlbFile(fileLike(makeGlb({
  asset:{version:'2.0'},
  images:[{uri:'data:image/png;base64,iVBORw0KGgo='}]
})));
assert.equal(dataUri.containerStats.images,1,'embedded data URI should remain local-only and valid');

console.log(JSON.stringify({
  check:'local-glb-hostile-invariants',
  invalidHeader:true,
  mismatchedLength:true,
  oversized:true,
  hugeJson:true,
  excessiveNodes:true,
  excessiveTextures:true,
  externalUriBlocked:true,
  pathologicalAnimations:true,
  malformedAccessors:true
}));
