import assert from 'node:assert/strict';

const base=process.env.PRODUCTION_URL||process.env.BASE_URL||'https://chimpions-urban-sports.onrender.com';
const response=await fetch(base,{redirect:'follow'});
assert(response.ok,'production root returned HTTP '+response.status);
const get=name=>response.headers.get(name)||'';

assert.equal(get('x-content-type-options').toLowerCase(),'nosniff','production is missing X-Content-Type-Options: nosniff');
assert(get('referrer-policy').toLowerCase().includes('strict-origin-when-cross-origin'),'production Referrer-Policy is not hardened');
assert(get('permissions-policy').toLowerCase().includes('camera=()'),'production Permissions-Policy is missing camera denial');
assert.equal(get('x-frame-options').toUpperCase(),'DENY','production X-Frame-Options must be DENY');
const csp=get('content-security-policy');
for(const token of ["default-src 'self'","object-src 'none'","frame-ancestors 'none'","connect-src 'self' blob:"]){
  assert(csp.includes(token),'production CSP missing '+token);
}
assert.equal(get('cross-origin-opener-policy'),'','COOP was enabled without release approval');
assert.equal(get('cross-origin-embedder-policy'),'','COEP was enabled without release approval');

console.log(JSON.stringify({
  check:'production-security-headers',
  url:response.url,
  csp:true,
  referrerPolicy:get('referrer-policy'),
  permissionsPolicy:true,
  frameProtection:true,
  coopCoep:false
}));
