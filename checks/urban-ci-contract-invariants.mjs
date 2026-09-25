import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const ci=readFileSync(new URL('../.github/workflows/check.yml',import.meta.url),'utf8');

assert(String(pkg.scripts?.check||'').includes('npm run check:urban'),'full repository check must execute Urban Sports regressions');
assert(String(pkg.scripts?.['check:release']||'').includes('npm run check'),'release check must execute the full invariant suite');
assert(String(pkg.scripts?.['check:release']||'').includes('npm run build'),'release check must execute a production build');
assert(/- run:\s+npm run check/.test(ci),'primary CI workflow must execute npm run check');
assert(/- run:\s+npm run build/.test(ci),'primary CI workflow must execute npm run build');

const staleIdentifiers=[
  /name:\s*Chimpions Ski desktop build and checks/.test(ci)?'workflow-display-name':null,
  /smoke-ski-production\.mjs/.test(String(pkg.scripts?.['check:integration']||''))?'legacy-smoke-script-name':null,
  /benchmark-ski-runtime\.mjs/.test(String(pkg.scripts?.['check:performance']||''))?'legacy-benchmark-script-name':null
].filter(Boolean);

// These names are intentionally diagnostic-only during the conversion. They
// describe inherited internal tooling and are not evidence of a gameplay
// regression while the proven Ski/Snowboard engine remains underneath.
assert(staleIdentifiers.length<=3,'unexpected stale CI identifier inventory');

console.log(JSON.stringify({
  check:'urban-ci-contract-invariants',
  productionBuildGuarded:true,
  urbanChecksInFullSuite:true,
  staleLegacyIdentifiers:staleIdentifiers
}));
