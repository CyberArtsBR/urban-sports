export function recordLandingOutcome(state,landing){
  if(!state||!landing?.landed)return {cleanDelta:0,mistake:false};
  const clean=landing.quality==='clean';
  if(clean)state.cleanLandings=(state.cleanLandings||0)+1;
  else state.lastMistakeTime=state.time;
  return {cleanDelta:clean?1:0,mistake:!clean};
}

export function recordLandingFeedbackStats(state,feedback){
  if(!state||!feedback)return {strongDelta:0};
  const strong=!!feedback.dramatic&&feedback.quality!=='hard';
  if(strong)state.strongLandings=(state.strongLandings||0)+1;
  return {strongDelta:strong?1:0};
}
