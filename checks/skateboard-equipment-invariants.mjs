import assert from 'node:assert/strict';
import {createSkateboardEquipment} from '../src/skateboardEquipment.js';

const board=createSkateboardEquipment();

assert.equal(board.root.name,'skateboard-equipment','equipment root remains discoverable by name');
assert.equal(board.root.userData.equipmentType,'skateboard','equipment advertises its type');
assert.ok(board.root.userData.restPosition,'equipment keeps the existing rider rest-position contract');
assert.equal(board.wheels.length,4,'skateboard has exactly four animated wheels');
assert.equal(new Set(board.wheels).size,4,'all four wheel handles are unique');
assert.equal(board.wheelContacts.length,4,'all four wheel-ground contacts are exposed');
assert.equal(new Set(board.wheelContacts).size,4,'wheel-ground contacts are unique');
assert.equal(board.trailContacts.length,2,'two rear trail contacts preserve the existing two-contact rider convention');
assert.deepEqual(board.trailContacts,board.wheelContacts.slice(2),'trail contacts remain the rear wheel pair');
assert.equal(board.root.userData.trailContacts,board.trailContacts,'trail contacts are available through userData');
assert.equal(board.root.userData.setPowerGlow,board.setPowerGlow,'Banana Power hook is exposed through userData');
assert.equal(board.root.userData.updateMotion,board.updateMotion,'motion hook is exposed through userData');

board.setWheelRotation(.75);
for(const wheel of board.wheels)assert.equal(wheel.rotation.x,.75,'setWheelRotation updates every wheel');
const wheelBefore=board.wheels.map(wheel=>wheel.rotation.x);
const state=board.updateMotion({dt:1/60,speed:12,lean:.7,steer:.4});
board.wheels.forEach((wheel,index)=>assert.notEqual(wheel.rotation.x,wheelBefore[index],'wheel rotation responds to board speed'));
assert.notEqual(board.motionRoot.rotation.z,0,'board lean responds without altering the rider/gameplay root transform');
assert(Number.isFinite(state.frontTruckSteer)&&Number.isFinite(state.rearTruckSteer),'steering diagnostics stay finite');

board.setLean(99,{immediate:true});
assert(Math.abs(board.motionRoot.rotation.z)<=.220001,'lean is clamped to the skateboard contract');
const front=board.root.getObjectByName('skateboard-front-truck');
const rear=board.root.getObjectByName('skateboard-rear-truck');
board.setTruckSteer(99,{immediate:true});
assert.ok(front.rotation.y>0&&rear.rotation.y<0,'front and rear trucks articulate in opposing directions');
assert(Math.abs(front.rotation.y)<=.115001&&Math.abs(rear.rotation.y)<=.115001,'truck steering is clamped to the equipment contract');

board.setPowerGlow(0,0);
const powerNodes=[];
board.root.traverse(object=>{if(object.name?.startsWith('banana-power-'))powerNodes.push(object);});
assert.ok(powerNodes.length>=6,'Banana Power exposes deck and wheel LED nodes');
assert.equal(powerNodes.filter(node=>node.visible).length,0,'Banana Power LEDs are off at zero charge');
board.setPowerGlow(1,0);
assert.equal(board.root.userData.powerGlow,1,'Banana Power glow reaches full strength');
assert.equal(powerNodes.filter(node=>node.visible).length,powerNodes.length,'deck and wheel LEDs illuminate together');

for(const contact of board.wheelContacts)assert.match(contact.name,/^skateboard-(front|rear)-(left|right)-contact$/,'wheel contact remains semantically named');
assert.doesNotThrow(()=>board.dispose(),'skateboard equipment remains disposable');

console.log(JSON.stringify({check:'skateboard-equipment-invariants',wheels:board.wheels.length,wheelContacts:board.wheelContacts.length,trailContacts:board.trailContacts.length,bananaPowerNodes:powerNodes.length}));
