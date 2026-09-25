import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILTIN_AVATAR_NAMES,builtinAvatarUrl} from '../src/avatarRoster.js';
import {AVATAR_COMPATIBILITY_STATUS,getAvatarCompatibility} from '../src/avatarCompatibility.js';

const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const scripts=pkg.scripts||{};
for(const name of BUILTIN_AVATAR_NAMES){
  const compatibility=getAvatarCompatibility(name);
  assert.equal(compatibility.status,AVATAR_COMPATIBILITY_STATUS.SUPPORTED,name+' unexpectedly lost avatar compatibility during the Urban Sports conversion');
  assert.match(builtinAvatarUrl(name),/\.glb$/,'built-in avatar URL contract must remain GLB-based');
}
const requiredWiring=[
  ['check:core','checks/input-invariants.mjs','controller/input invariant suite'],
  ['check:core','checks/course-invariants.mjs','course generation safety suite'],
  ['check:core','checks/course-runtime-performance-invariants.mjs','course streaming performance suite'],
  ['check:core','checks/course-collision-lategame-invariants.mjs','late-game collision safety suite'],
  ['check:integration','checks/input-collision-invariants.mjs','input/collision integration suite'],
  ['check:integration','checks/long-run-integration-invariants.mjs','long-run allocation suite'],
  ['check:visual','checks/avatar-compatibility-invariants.mjs','avatar compatibility suite'],
  ['check:urban','checks/skateboard-equipment-invariants.mjs','skateboard equipment suite'],
  ['check:urban','checks/sport-mode-invariants.mjs','urban sport profile suite'],
  ['check:urban','checks/urban-environment-invariants.mjs','urban environment performance/disposal suite']
];
for(const [script,file,label] of requiredWiring)assert(String(scripts[script]||'').includes(file),label+' is no longer wired into npm run '+script);
assert(String(scripts.check||'').includes('npm run check:urban'),'main CI check path must execute Urban Sports regressions');
console.log(JSON.stringify({check:'urban-sports-regression-invariants',avatars:BUILTIN_AVATAR_NAMES.length,guardedSuites:requiredWiring.length}));
