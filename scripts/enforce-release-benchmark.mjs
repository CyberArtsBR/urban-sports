import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import {
  analyzeGraphicsStability,
  evaluateGraphicsBudget,
  normalizeGraphicsBudgetProfile
} from '../src/graphicsDiagnostics.js';

const [reportPath='benchmark-results.json',requestedProfile='']=process.argv.slice(2);
const report=JSON.parse(await readFile(reportPath,'utf8'));
const profile=normalizeGraphicsBudgetProfile(requestedProfile||report?.target?.qualityProfile||'medium');

function numberEnv(name,fallback){
  const value=Number(process.env[name]);
  return Number.isFinite(value)&&value>0?value:fallback;
}
const budgets={
  p50:numberEnv('RELEASE_MAX_P50_MS',35),
  p95:numberEnv('RELEASE_MAX_P95_MS',55),
  p99:numberEnv('RELEASE_MAX_P99_MS',95),
  longFrameRatio:numberEnv('RELEASE_MAX_LONG_FRAME_RATIO',.12),
  firstPlayableMs:numberEnv('RELEASE_MAX_FIRST_PLAYABLE_MS',45000),
  avatarLoadP95Ms:numberEnv('RELEASE_MAX_AVATAR_LOAD_P95_MS',12000),
  heapGrowthBytes:numberEnv('RELEASE_MAX_LONG_RUN_HEAP_GROWTH_BYTES',64*1024*1024),
  domGrowth:numberEnv('RELEASE_MAX_LONG_RUN_DOM_GROWTH',120)
};

const required=[
  'A_initialPageLoad',
  'B_startScreenIdle',
  'C_characterSelectorOpening',
  'D_avatarSearchFilter',
  'H_repeatedSelectorOpenClose',
  'E_gameplayFirst30Seconds',
  'G_repeatedRestart'
];
if(report?.phases?.F_extendedGameplay?.status!=='PENDING')required.push('F_extendedGameplay');
for(const name of required){
  assert.equal(report?.phases?.[name]?.status,'PASS',`required benchmark phase ${name} did not PASS`);
}

function enforceFrames(name,phase){
  const frames=phase?.frames;
  assert.equal(frames?.status,'PASS',`${name}: requestAnimationFrame samples were not captured`);
  assert((frames.frames||0)>=10,`${name}: too few frame samples to be a release benchmark`);
  assert(frames.p50FrameMs<=budgets.p50,`${name}: P50 ${frames.p50FrameMs}ms > ${budgets.p50}ms`);
  assert(frames.p95FrameMs<=budgets.p95,`${name}: P95 ${frames.p95FrameMs}ms > ${budgets.p95}ms`);
  assert(frames.p99FrameMs<=budgets.p99,`${name}: P99 ${frames.p99FrameMs}ms > ${budgets.p99}ms`);
  const longRatio=(frames.framesOver50ms||0)/Math.max(1,frames.frames||0);
  assert(longRatio<=budgets.longFrameRatio,`${name}: >50ms frame ratio ${(longRatio*100).toFixed(2)}% exceeds ${(budgets.longFrameRatio*100).toFixed(2)}%`);
  return longRatio;
}

const gameplay=report.phases.E_gameplayFirst30Seconds;
const extended=report.phases.F_extendedGameplay?.status==='PASS'?report.phases.F_extendedGameplay:null;
const frameResults={
  gameplay:enforceFrames('E_gameplayFirst30Seconds',gameplay)
};
if(extended)frameResults.extended=enforceFrames('F_extendedGameplay',extended);

const firstPlayable=Number(gameplay?.startSequence?.timeToPlayingMs);
assert(Number.isFinite(firstPlayable)&&firstPlayable>0,'first playable timing was not executed');
assert(firstPlayable<=budgets.firstPlayableMs,`first playable ${firstPlayable}ms > ${budgets.firstPlayableMs}ms`);

const samples=[...(gameplay?.samples||[]),...(extended?.samples||[])];
assert(samples.length>=5,'benchmark did not collect enough gameplay diagnostics samples');

let avatarLoadP95=0,avatarLoadSamples=0;
for(const sample of samples){
  if(Number.isFinite(sample?.avatarLoadP95Ms))avatarLoadP95=Math.max(avatarLoadP95,sample.avatarLoadP95Ms);
  if(Number.isFinite(sample?.avatarLoadSamples))avatarLoadSamples=Math.max(avatarLoadSamples,sample.avatarLoadSamples);
  const graphics=evaluateGraphicsBudget(sample,profile);
  assert(graphics.ok,`graphics resource budget exceeded during benchmark: ${JSON.stringify(graphics.violations)}`);
}
assert(avatarLoadSamples>=1,'avatar loading never executed during the benchmark');
assert(avatarLoadP95<=budgets.avatarLoadP95Ms,`avatar load P95 ${avatarLoadP95}ms > ${budgets.avatarLoadP95Ms}ms`);

const stability=analyzeGraphicsStability(samples);
assert(stability.ok,`benchmark resource counts show suspicious monotonic growth: ${JSON.stringify(stability.violations)}`);

if(extended){
  const heapDelta=report?.memory?.longRunHeapDeltaBytes;
  if(report?.memory?.heapMetricsAvailable){
    assert(Number.isFinite(heapDelta),'long-run heap metrics were advertised but heap delta is unavailable');
    assert(heapDelta<=budgets.heapGrowthBytes,`long-run JS heap grew ${heapDelta} bytes > ${budgets.heapGrowthBytes}`);
  }
  const domDelta=Number(report?.memory?.longRunDomDelta);
  assert(Number.isFinite(domDelta),'long-run DOM growth metric is unavailable');
  assert(domDelta<=budgets.domGrowth,`long-run DOM grew by ${domDelta} nodes > ${budgets.domGrowth}`);
}

console.log(JSON.stringify({
  check:'release-benchmark-gate',
  reportPath,
  profile,
  requiredPhases:required,
  gameplaySamples:samples.length,
  firstPlayableMs:firstPlayable,
  avatarLoadSamples,
  avatarLoadP95Ms:avatarLoadP95,
  frameResults,
  graphicsStability:stability,
  longRunHeapDeltaBytes:report?.memory?.longRunHeapDeltaBytes??null,
  longRunDomDelta:report?.memory?.longRunDomDelta??null,
  budgets
}));
