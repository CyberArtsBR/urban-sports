import assert from 'node:assert/strict';
import {STREETSKATE_FLATLAND_TRICKS,createStreetSkateGroundTricks} from '../src/streetSkateGroundTricks.js';
import {TRICK_POINTS} from '../src/trickScoring.js';
import {createGameplayInput} from '../src/gameplayInput.js';

const combos=Object.entries(STREETSKATE_FLATLAND_TRICKS);
assert.equal(combos.length,9,'StreetSkate ships nine distinct flatland combinations');
for(const [pair,trick] of combos){
  assert.equal(TRICK_POINTS[trick.name],trick.points,'scoring must match StreetSkate catalog');
  const machine=createStreetSkateGroundTricks();
  const [first,second]=pair.split('+');
  const context={grounded:true,speed:8,busy:false};
  machine.step(1/60,{...context,inputs:[first]});
  const secondResult=machine.step(1/60,{...context,inputs:[second]});
  assert.equal(secondResult.snapshot.name,trick.name,pair+' did not start');
  let completed=null,commits=0;
  for(let frame=0;frame<100;frame++){
    const result=machine.step(1/60,context);
    if(result.completed){completed=result.completed;commits++;}
  }
  assert.deepEqual(completed,{type:trick.name,source:'street-skate-flatland'});
  assert.equal(commits,1,'ground trick must score exactly once');
  assert.equal(machine.snapshot().active,false);
  machine.reset();
  assert.equal(machine.snapshot().active,false);
}
{
  const g=createStreetSkateGroundTricks(),context={grounded:true,speed:8};
  g.step(.02,{...context,inputs:['flip']});
  for(let i=0;i<6;i++)g.step(.10,context);
  assert.equal(g.step(.01,{...context,inputs:['grind']}).snapshot.active,false,'expired input must not start combo');
  g.step(.01,{...context,inputs:['grind']});
  assert.equal(g.snapshot().name,'Pogo','consecutive grind inputs must produce Pogo');
  assert.equal(g.step(.01,{...context,grounded:false}).snapshot.active,false,'falling cancels flatland');
}
{
  const g=createStreetSkateGroundTricks();
  assert.equal(g.step(.01,{inputs:['flip','grab'],grounded:true,speed:.2}).snapshot.active,false,'stationary rider must not initiate trick');
  assert.equal(g.step(.01,{inputs:['flip','grab'],grounded:true,speed:8,busy:true}).snapshot.active,false,'air/manual/grind animation must have priority');
}
{
  const handlers={};
  const windowRef={addEventListener:(key,fn)=>handlers[key]=fn};
  const input=createGameplayInput({windowRef,documentRef:{addEventListener(){}}});
  const key=code=>handlers.keydown({code,repeat:false,target:null,preventDefault(){}});
  key('KeyZ');
  assert.deepEqual(input.read({}).flatlandInputs,['flip'],'keyboard flip event missing');
  assert.deepEqual(input.read({}).flatlandInputs,[],'keyboard event must be one-shot');
  key('KeyC');
  assert.deepEqual(input.read({}).flatlandInputs,['grab'],'keyboard grab event missing');
  input.resetTransient();
  const buttons=Array(16).fill(false);buttons[4]=true;buttons[2]=true;
  const pad={activeKey:'controller-1',buttons,edges:{pressed:{special:true,camera:false,cameraMotion:false}}};
  let event=input.read(pad);
  assert.deepEqual(event.flatlandInputs,['flip'],'controller LB+X must trigger flip');
  assert.equal(event.specialPressed,false,'flatland chord must not activate Banana Power');
  assert.deepEqual(input.read(pad).flatlandInputs,[],'gamepad flatland press must be edge-triggered');
}
console.log(JSON.stringify({check:'streetskate-ground-invariants',tricks:combos.length,keyboard:true,gamepad:true,scoreGuard:true}));
