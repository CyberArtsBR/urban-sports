import assert from 'node:assert/strict';
import {createSkateboardEquipment} from '../src/skateboardEquipment.js';

const board=createSkateboardEquipment();

assert.equal(board.root.name,'skateboard-equipment','equipment root remains discoverable by name');
assert.equal(board.root.userData.equipmentType,'skateboard','equipment advertises its type');
assert.ok(board.root.userData.restPosition,'equipment keeps the existing rider rest-position contract');
assert.equal(board.wheels.length,4,'skateboard has four animated wheels');
assert.equal(board.wheelContacts.length,4,'all four wheel-ground contacts are exposed');
assert.equal(board.trailContacts.length,2,'two rear trail contacts preserve the existing two-contact rider convention');
assert.equal(board.root.userData.trailContacts,board.trailContacts,'trail contacts are available through userData');
assert.equal(board.root.userData.setPowerGlow,board.setPowerGlow,'Banana Power hook is exposed through userData');
assert.equal(board.root.userData.updateMotion,board.updateMotion,'motion hook is exposed through userData');

const initialWheel=board.wheels[0].rotation.x;
board.updateMotion({dt:1/60,speed:12,lean:.7});
assert.notEqual(board.wheels[0].rotation.x,initialWheel,'wheel rotation responds to board speed');
assert.notEqual(board.motionRoot.rotation.z,0,'board lean responds without altering the rider/gameplay root transform');

board.setPowerGlow(1,0);
assert.equal(board.root.userData.powerGlow,1,'Banana Power glow reaches full strength');
const visibleLeds=[];
board.root.traverse(object=>{
  if(object.name?.startsWith('banana-power-')&&object.visible)visibleLeds.push(object);
});
assert.ok(visibleLeds.length>=6,'deck and wheel LEDs illuminate together');

const front=board.root.getObjectByName('skateboard-front-truck');
const rear=board.root.getObjectByName('skateboard-rear-truck');
board.setTruckSteer(1,{immediate:true});
assert.ok(front.rotation.y>0&&rear.rotation.y<0,'front and rear trucks articulate in opposing directions');

board.dispose();
console.log('skateboard equipment invariants: ok');
