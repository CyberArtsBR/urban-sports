export const PROGRESSION_SCHEMA_VERSION=1;
export const REPLAY_FORMAT_VERSION=1;
export const SHARE_CODE_VERSION=1;
export const CHALLENGE_VERSION='daily-v1';

// Keep these explicit. Replays/challenges must never silently cross incompatible
// gameplay rules just because the web bundle was rebuilt.
export const GAME_VERSION='0.3.0';
export const PHYSICS_VERSION='skateboard-physics-v1';
export const COURSE_VERSION='urban-course-v1';
export const GAMEPLAY_VERSION=`${PHYSICS_VERSION}+${COURSE_VERSION}`;

export const CURRENT_REPLAY_VERSIONS=Object.freeze({
  gameVersion:GAME_VERSION,
  physicsVersion:PHYSICS_VERSION,
  courseVersion:COURSE_VERSION
});
