import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const audioSource=fs.readFileSync('src/audio.js','utf8');
const mixerSource=fs.readFileSync('src/audio/AudioMixer.js','utf8');
const musicSource=fs.readFileSync('src/audio/MusicSystem.js','utf8');
const persistenceSource=fs.readFileSync('src/audio/AudioPersistence.js','utf8');
const mainSource=fs.readFileSync('src/main.js','utf8');
const musicPath='public/audio/music-full.mp3';

assert(fs.existsSync(musicPath),'Bundled music is missing');
const music=fs.readFileSync(musicPath);
assert(music.length>4_000_000,'Bundled music looks unexpectedly small');

const gitBlob=crypto.createHash('sha1')
  .update(Buffer.from('blob '+music.length+'\0'))
  .update(music)
  .digest('hex');
assert.equal(
  gitBlob,
  '9606f2230f5a3b78fb7f9517b80014132205ec52',
  'Bundled music bytes differ from the established local asset'
);

assert(musicSource.includes("URBAN_MUSIC_URL='/audio/music-full.mp3'"),'Audio must use the local music asset');
assert(musicSource.includes("media.preload='none'"),'music must not be eagerly preloaded from the menu');
assert(musicSource.includes("const needsLoad=name==='COUNTDOWN'||name==='PLAYING'"),'music loading must wait for countdown/gameplay');
assert(!audioSource.includes('chimp-jump.onrender.com/audio/music-full.mp3'),'Runtime music hotlink returned');
assert(audioSource.includes('function playClear(clearEvent)'), 'Combo presentation audio hook is missing');
assert(audioSource.includes('function resetRun()'), 'Audio run-reset hook is missing');
assert(mixerSource.includes('MAX_TRANSIENT_SOURCES=24'),'Transient source budget is missing');
assert(mixerSource.includes('activeTransientSources.delete(source)'),'Transient cleanup is missing');
assert(persistenceSource.includes("'chimpions-urban-sfx'")&&persistenceSource.includes("'chimpions-ski-sfx'"),'Urban/legacy audio persistence bridge is missing');
assert(mainSource.includes("audio.play('oil',.34)"),'Oil gameplay event is not wired to the distinct skid cue');
assert(mainSource.includes('audio.playClear?.(state.clearEvent??null)'), 'Airborne clear events are not wired to audio presentation');
assert(mainSource.includes('audio.resetRun?.()'), 'Restart does not reset audio event presentation state');
assert(mainSource.includes('audio.dispose?.()'),'Runtime teardown does not dispose audio');

console.log(JSON.stringify({
  check:'audio-invariants',
  musicBytes:music.length,
  sourceGitBlob:gitBlob,
  localPath:'/audio/music-full.mp3',
  modularMixer:true,
  fallback:'procedural music bed retained'
}));
