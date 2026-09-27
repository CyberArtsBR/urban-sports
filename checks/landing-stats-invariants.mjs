import assert from 'node:assert/strict';
import {recordLandingFeedbackStats,recordLandingOutcome} from '../src/landingStats.js';

const clean={cleanLandings:0,strongLandings:0,time:12};
const first=recordLandingOutcome(clean,{landed:true,quality:'clean'});
assert.equal(first.cleanDelta,1);
assert.equal(clean.cleanLandings,1,'clean landing must increment exactly once');

recordLandingFeedbackStats(clean,{quality:'clean',dramatic:false});
assert.equal(clean.cleanLandings,1,'clean feedback must never count the same landing again');

recordLandingFeedbackStats(clean,{quality:'clean',dramatic:true});
assert.equal(clean.cleanLandings,1,'dramatic clean feedback must not double-count clean landings');
assert.equal(clean.strongLandings,1,'dramatic clean landing may independently count as strong');

const rough={cleanLandings:7,time:33};
recordLandingOutcome(rough,{landed:true,quality:'sketchy'});
assert.equal(rough.cleanLandings,7);
assert.equal(rough.lastMistakeTime,33);

const hard={cleanLandings:2,strongLandings:4,time:44};
recordLandingOutcome(hard,{landed:true,quality:'failed'});
recordLandingFeedbackStats(hard,{quality:'hard',dramatic:true});
assert.equal(hard.cleanLandings,2);
assert.equal(hard.strongLandings,4,'hard landing must not count as a strong clean-style landing');

const noLanding={cleanLandings:5,time:50};
recordLandingOutcome(noLanding,{landed:false,quality:'clean'});
assert.equal(noLanding.cleanLandings,5);

console.log(JSON.stringify({
  check:'landing-stats-invariants',
  cleanLandingExactlyOnce:true,
  feedbackCannotDoubleCount:true,
  roughMarksMistake:true
}));
