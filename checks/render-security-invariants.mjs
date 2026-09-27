import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const yaml=await readFile(new URL('../render.yaml',import.meta.url),'utf8');

assert(yaml.includes('buildCommand: npm ci && npm run build'),'Render build must use npm ci');
assert(yaml.includes('autoDeploy: false'),'production autoDeploy must remain disabled');
assert(/name:\s*X-Content-Type-Options[\s\S]*?value:\s*"nosniff"/.test(yaml),'X-Content-Type-Options nosniff is missing');
assert(/name:\s*Referrer-Policy[\s\S]*?strict-origin-when-cross-origin/.test(yaml),'Referrer-Policy is missing');
assert(/name:\s*Permissions-Policy/.test(yaml),'Permissions-Policy is missing');
assert(/name:\s*X-Frame-Options[\s\S]*?DENY/.test(yaml),'frame protection is missing');
assert(/name:\s*Content-Security-Policy/.test(yaml),'Content-Security-Policy is missing');
for(const token of [
  "default-src 'self'",
  "script-src 'self'",
  "img-src 'self' data: blob: https://cdn.helius-rpc.com https://arweave.net",
  "connect-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
]){
  assert(yaml.includes(token),'CSP missing required directive: '+token);
}
assert(!/Cross-Origin-Opener-Policy|Cross-Origin-Embedder-Policy|require-corp/i.test(yaml),'COOP/COEP must not be enabled without a demonstrated cross-origin-isolation requirement');

console.log(JSON.stringify({
  check:'render-security-invariants',
  npmCi:true,
  autoDeploy:false,
  csp:true,
  frameProtection:true,
  coopCoep:false
}));
