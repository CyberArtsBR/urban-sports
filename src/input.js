import {SKI_TUNING} from './gameplayTuning.js';
import {DEFAULT_ACTION_MAP,GAMEPAD_BUTTON,INPUT_ACTION,createActionMap,gamepadButtonFor} from './actionMap.js';

const clampSetting=(value,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
let controllerDeadzone=clampSetting(SKI_TUNING.CONTROLLER_DEADZONE,0,.45,.14);
let controllerActionMap=createActionMap(DEFAULT_ACTION_MAP);
const BUTTON_PRESS_THRESHOLD=.5;

let activeKey=null;
let activeAxisState=makeAxisPair();
let previousSemantic=emptySemantic();
let lastSnapshot=null;
const reconnectGuards=new Map();

function deadzoneEnter(){return Math.min(.55,controllerDeadzone+.03);}
function switchAxisThreshold(){return Math.max(.28,deadzoneEnter()+.08);}
function makeAxisState(){return {engaged:false,sign:0};}
function makeAxisPair(){return {x:makeAxisState(),y:makeAxisState()};}
function emptySemantic(){return {confirm:false,jump:false,cancel:false,cameraMotion:false,special:false,camera:false,menu:false};}
function clampAxis(value=0){return Math.max(-1,Math.min(1,Number(value)||0));}
function buttonPressed(button){
  if(typeof button==='boolean')return button;
  if(typeof button==='number')return button>=BUTTON_PRESS_THRESHOLD;
  return !!button&&(!!button.pressed||(Number(button.value)||0)>=BUTTON_PRESS_THRESHOLD);
}
function padKey(pad,slot){
  const index=Number.isInteger(pad?.index)?pad.index:slot;
  return `${index}:${String(pad?.id||'gamepad')}`;
}
function rawButtons(pad){return Array.from(pad?.buttons||[],buttonPressed);}
function rawAxes(pad){return [clampAxis(pad?.axes?.[0]),clampAxis(pad?.axes?.[1])];}
function resetAxisState(){activeAxisState=makeAxisPair();}

export function configureControllerInput({deadzone=controllerDeadzone,actionMap=null}={}){
  controllerDeadzone=clampSetting(deadzone,.05,.35,.14);
  if(actionMap)controllerActionMap=createActionMap(actionMap);
  resetAxisState();
  return getControllerInputSettings();
}
export function getControllerInputSettings(){return {deadzone:controllerDeadzone,actionMap:controllerActionMap};}

function filteredAxis(raw,state){
  const value=clampAxis(raw);
  const magnitude=Math.abs(value);
  const sign=Math.sign(value);
  const enter=deadzoneEnter();

  if(!state.engaged){
    if(magnitude<=enter)return 0;
    state.engaged=true;state.sign=sign;
  }else{
    if(magnitude<=controllerDeadzone){state.engaged=false;state.sign=0;return 0;}
    if(sign&&state.sign&&sign!==state.sign){
      if(magnitude<=enter){state.engaged=false;state.sign=0;return 0;}
      state.sign=sign;
    }
  }

  const scaled=(magnitude-controllerDeadzone)/(1-controllerDeadzone);
  return sign*Math.max(0,Math.min(1,scaled));
}

function createReconnectGuard(snapshot){
  if(!snapshot)return null;
  const blockedButtons=new Set();
  snapshot.buttons.forEach((pressed,index)=>{if(pressed)blockedButtons.add(index);});
  return {blockedButtons,blockX:Math.abs(snapshot.axes[0])>controllerDeadzone,blockY:Math.abs(snapshot.axes[1])>controllerDeadzone};
}
function refreshGuard(entry){
  const guard=reconnectGuards.get(entry.key);
  if(!guard)return null;
  const buttons=rawButtons(entry.pad);
  for(const index of [...guard.blockedButtons])if(!buttons[index])guard.blockedButtons.delete(index);
  const axes=rawAxes(entry.pad);
  if(guard.blockX&&Math.abs(axes[0])<=controllerDeadzone)guard.blockX=false;
  if(guard.blockY&&Math.abs(axes[1])<=controllerDeadzone)guard.blockY=false;
  if(!guard.blockedButtons.size&&!guard.blockX&&!guard.blockY){reconnectGuards.delete(entry.key);return null;}
  return guard;
}
function effectiveRaw(entry){
  const buttons=rawButtons(entry.pad),axes=rawAxes(entry.pad);
  const guard=reconnectGuards.get(entry.key);
  if(guard){
    for(const index of guard.blockedButtons)buttons[index]=false;
    if(guard.blockX)axes[0]=0;
    if(guard.blockY)axes[1]=0;
  }
  return {buttons,axes};
}
function hasMeaningfulActivity(entry){
  const {buttons,axes}=effectiveRaw(entry);
  const threshold=switchAxisThreshold();
  return buttons.some(Boolean)||Math.abs(axes[0])>=threshold||Math.abs(axes[1])>=threshold;
}
function sortConnected(entries){
  return entries.sort((a,b)=>{
    const ai=Number.isInteger(a.pad.index)?a.pad.index:a.slot;
    const bi=Number.isInteger(b.pad.index)?b.pad.index:b.slot;
    return ai-bi||a.slot-b.slot;
  });
}
function edgeData(current){
  const pressed={},released={};
  for(const key of Object.keys(current)){
    pressed[key]=current[key]&&!previousSemantic[key];
    released[key]=!current[key]&&previousSemantic[key];
  }
  return {pressed,released};
}
function disconnectedState(){
  const current=emptySemantic(),edges=edgeData(current);previousSemantic=current;
  return {connected:false,axis:0,axisY:0,buttons:[],...current,edges,activeIndex:null,activeKey:null,activeGamepad:null,id:'',mapping:'',controllerChanged:false,dpad:{left:false,right:false,up:false,down:false}};
}

export function readPad(pads){
  const entries=sortConnected(Array.from(pads||[]).map((pad,slot)=>({pad,slot,key:padKey(pad,slot)})).filter(entry=>entry.pad?.connected));

  let current=activeKey?entries.find(entry=>entry.key===activeKey):null;
  if(activeKey&&!current){
    const guard=createReconnectGuard(lastSnapshot?.key===activeKey?lastSnapshot:null);
    if(guard&&(guard.blockedButtons.size||guard.blockX||guard.blockY))reconnectGuards.set(activeKey,guard);
    activeKey=null;current=null;resetAxisState();lastSnapshot=null;
  }

  for(const entry of entries)refreshGuard(entry);
  if(!entries.length)return disconnectedState();

  let selected=current;
  if(!selected)selected=entries.find(hasMeaningfulActivity)||entries[0];
  else if(!hasMeaningfulActivity(selected)){
    const takeover=entries.find(entry=>entry.key!==selected.key&&hasMeaningfulActivity(entry));
    if(takeover)selected=takeover;
  }

  const changed=selected.key!==activeKey;
  if(changed){activeKey=selected.key;resetAxisState();previousSemantic=emptySemantic();}

  const physicalButtons=rawButtons(selected.pad),physicalAxes=rawAxes(selected.pad);
  const {buttons,axes}=effectiveRaw(selected);
  const analogX=filteredAxis(axes[0],activeAxisState.x),analogY=filteredAxis(axes[1],activeAxisState.y);
  const left=!!buttons[GAMEPAD_BUTTON.LEFT],right=!!buttons[GAMEPAD_BUTTON.RIGHT],up=!!buttons[GAMEPAD_BUTTON.UP],down=!!buttons[GAMEPAD_BUTTON.DOWN];
  const dpadX=Number(right)-Number(left),dpadY=Number(down)-Number(up);
  const horizontalDpad=left||right,verticalDpad=up||down;
  const at=action=>!!buttons[gamepadButtonFor(controllerActionMap,action,-1)];
  const semantic={
    confirm:at(INPUT_ACTION.CONFIRM),
    jump:at(INPUT_ACTION.JUMP),
    cancel:at(INPUT_ACTION.CANCEL),
    cameraMotion:at(INPUT_ACTION.CAMERA_MOTION),
    special:at(INPUT_ACTION.SPECIAL),
    camera:at(INPUT_ACTION.CAMERA),
    menu:at(INPUT_ACTION.PAUSE)
  };
  const edges=edgeData(semantic);
  previousSemantic=semantic;
  lastSnapshot={key:selected.key,buttons:physicalButtons,axes:physicalAxes};

  return {
    connected:true,
    axis:horizontalDpad?dpadX:analogX,
    axisY:verticalDpad?dpadY:analogY,
    buttons,
    ...semantic,
    edges,
    activeIndex:Number.isInteger(selected.pad.index)?selected.pad.index:selected.slot,
    activeKey:selected.key,
    activeGamepad:selected.pad,
    id:String(selected.pad.id||''),
    mapping:String(selected.pad.mapping||''),
    controllerChanged:changed,
    dpad:{left,right,up,down}
  };
}
