import {
  AVATAR_SELECTOR_INITIAL_RENDER,
  AVATAR_SELECTOR_RENDER_CHUNK,
  buildAvatarSearchIndex,
  filterAvatarSearchIndex,
  getAvatarRenderTarget
} from './avatar-selector-model.js';
import {EMPTY_SKATEBOARD_SETUP_CONTRACT,createSkateboardSetupContract} from './urbanUiContract.js';
import {defaultLocalization} from './localization.js';
import {AVATAR_COMPATIBILITY_STATUS,getAvatarCompatibility} from './avatarCompatibility.js';
import {MENU_ACTION,menuActionFromKeyboardEvent} from './menuNavigation.js';
import {BUILTIN_AVATAR_NAMES,canonicalizeBuiltinCatalog} from './avatarRoster.js';
import {UPLOAD_AVATAR_ACTION,createLocalAvatarEntry,isUploadAvatarAction,validateLocalGlbFile} from './localAvatarUpload.js';

export async function loadAvatarCatalog(){
  // Metadata/thumbnails are cheap; GLBs remain lazy and are loaded only after a
  // concrete rider selection.
  const response=await fetch('/avatars.json');
  if(!response.ok)throw new Error('Could not load Chimpion catalog');
  const entries=canonicalizeBuiltinCatalog(await response.json())
    .map(entry=>({...entry,compatibility:getAvatarCompatibility(entry)}));
  if(entries.length!==BUILTIN_AVATAR_NAMES.length)throw new Error('Built-in Chimpion roster is incomplete');
  return entries;
}

export function randomAvatar(catalog){
  return catalog[Math.floor(Math.random()*catalog.length)];
}

export function disposeAvatarObject(root){
  if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root.traverse?.(object=>{
    if(object.geometry?.dispose)geometries.add(object.geometry);
    if(object.skeleton?.dispose)skeletons.add(object.skeleton);
    const list=Array.isArray(object.material)?object.material:[object.material];
    for(const material of list){
      if(!material)continue;
      materials.add(material);
      for(const key of Object.keys(material)){
        const value=material[key];
        if(value?.isTexture&&value.dispose)textures.add(value);
      }
      if(material.uniforms){
        for(const uniform of Object.values(material.uniforms)){
          const value=uniform?.value;
          if(value?.isTexture&&value.dispose)textures.add(value);
        }
      }
    }
  });
  for(const skeleton of skeletons)skeleton.dispose();
  for(const texture of textures)texture.dispose();
  for(const material of materials)material.dispose?.();
  for(const geometry of geometries)geometry.dispose();
}


function createFallback(){
  const fallback=document.createElement('span');
  fallback.className='portrait-fallback';
  fallback.textContent='🐵';
  return fallback;
}

function replaceFailedPortrait(image){
  if(!image?.isConnected)return;
  image.replaceWith(createFallback());
}

function createPortrait(entry,className=''){
  const wrap=document.createElement('span');
  wrap.className=('portrait '+className).trim();
  if(entry?.image){
    const image=document.createElement('img');
    image.src=entry.image;
    image.alt='';
    image.loading='lazy';
    image.decoding='async';
    image.fetchPriority='low';
    image.draggable=false;
    wrap.append(image);
  }else{
    wrap.append(createFallback());
  }
  return wrap;
}

export function createAvatarSelector({
  catalog,
  onSelect,
  onValidateLocalAvatar=async()=>true,
  selectedId='',
  selectedRideMode='',
  skateboardSetup=EMPTY_SKATEBOARD_SETUP_CONTRACT,
  localization=defaultLocalization
}) {
  const t=(key,fallback)=>localization?.t?.(key,fallback)||fallback;
  const setupContract=createSkateboardSetupContract(skateboardSetup||{});
  const hasSetupStep=setupContract.selectable;
  const dialog=document.createElement('dialog');
  dialog.id='chimpion-selector';
  dialog.className='selector-dialog';
  dialog.setAttribute('aria-labelledby','selector-title');
  dialog.innerHTML=`<form method="dialog" class="selector-shell"><header class="selector-head"><div><small>THE CHIMPIONS</small><h2 id="selector-title" data-i18n="avatar.title">${t('avatar.title','Choose your Chimpion')}</h2></div><button class="selector-close" value="close" data-i18n-aria-label="avatar.close" aria-label="${t('avatar.close','Close Chimpion selector')}">×</button></header><div class="selector-featured"><span id="selector-preview-portrait" class="selector-preview-portrait">🐵</span><span><small id="selector-step-label">${hasSetupStep?'STEP 1 OF 2 · RIDER':t('avatar.step','RIDER SELECT')}</small><strong id="selector-preview-name" data-i18n="avatar.previewEmpty">${t('avatar.previewEmpty','Choose a Chimpion')}</strong><em id="selector-preview-tribe">The Chimpions</em></span></div><input id="chimpion-search" class="selector-search" type="search" data-i18n-placeholder="avatar.search" placeholder="${t('avatar.search','Search Chimpion…')}" autocomplete="off" data-i18n-aria-label="avatar.searchLabel" aria-label="${t('avatar.searchLabel','Search Chimpions')}"><div id="chimpion-grid" class="selector-grid" role="group" aria-label="${t('avatar.searchLabel','Search Chimpions')}"></div><input id="local-glb-upload" type="file" accept=".glb,model/gltf-binary" hidden><p id="selector-status" class="selector-status" role="status" aria-live="polite" hidden></p><section class="skateboard-setup-step" id="skateboard-setup-step" hidden aria-labelledby="skateboard-setup-title"><div class="setup-profile-copy"><small>SKATEBOARD</small><strong id="skateboard-setup-title" data-i18n="setup.title">${t('setup.title','Choose skateboard setup')}</strong><span>Gameplay profiles are supplied by the skateboard gameplay system.</span></div><div class="skateboard-setup-options">${setupContract.profiles.map(profile=>`<button type="button" class="setup-profile-card skateboard-setup-card" data-setup-id="${profile.id}" ${profile.available?'':'disabled aria-disabled="true"'}><b aria-hidden="true">${profile.icon}</b><strong>${profile.label}</strong><span>${profile.description}</span></button>`).join('')}</div><button type="button" class="setup-profile-back setup-back" data-i18n="setup.back">${t('setup.back','BACK TO RIDERS')}</button></section><div class="selector-help" data-i18n="avatar.help">${t('avatar.help','D-PAD / STICK · Navigate · A / ENTER · Select · B / ESC · Back')}</div></form>`;
  document.body.append(dialog);
  localization?.apply?.(dialog);
  const grid=dialog.querySelector('#chimpion-grid');
  const search=dialog.querySelector('#chimpion-search');
  const previewPortrait=dialog.querySelector('#selector-preview-portrait');
  const previewName=dialog.querySelector('#selector-preview-name');
  const previewTribe=dialog.querySelector('#selector-preview-tribe');
  const title=dialog.querySelector('#selector-title');
  const stepLabel=dialog.querySelector('#selector-step-label');
  const closeButton=dialog.querySelector('.selector-close');
  const setupStep=dialog.querySelector('#skateboard-setup-step');
  const setupButtons=Array.from(dialog.querySelectorAll('.skateboard-setup-card:not([disabled])'));
  const setupBack=dialog.querySelector('.setup-back');
  const fileInput=dialog.querySelector('#local-glb-upload');
  const status=dialog.querySelector('#selector-status');

  let customEntry=null;
  let customObjectUrl='';
  function selectorEntries(){return [...catalog,...(customEntry?[customEntry]:[]),UPLOAD_AVATAR_ACTION];}
  let searchIndex=buildAvatarSearchIndex(selectorEntries());
  let entryById=new Map(searchIndex.map(record=>[record.id,record.entry]));
  function rebuildSearchIndex(){
    searchIndex=buildAvatarSearchIndex(selectorEntries());
    entryById=new Map(searchIndex.map(record=>[record.id,record.entry]));
  }
  let currentSelectedId=String(selectedId||'');
  let currentSetupId=String(setupContract.activeProfileId||'');
  void selectedRideMode;
  let pendingEntry=null;
  let step='avatar';
  let loading=false;
  let visibleRecords=searchIndex;
  let renderedCount=0;
  let previewId='';
  let openReturnFocus=null;
  let menuSelected=null;

  function markMenuFocus(element){
    if(menuSelected===element)return;
    menuSelected?.classList?.remove('is-menu-selected');
    menuSelected=element?.matches?.('button:not([disabled])')?element:null;
    menuSelected?.classList?.add('is-menu-selected');
  }

  const metrics={
    catalogSize:catalog.length,
    filteredCount:catalog.length,
    renderedCardCount:0,
    initialRenderLimit:AVATAR_SELECTOR_INITIAL_RENDER,
    renderChunkSize:AVATAR_SELECTOR_RENDER_CHUNK,
    cardNodesCreated:0,
    lastOpenRenderMs:0,
    lastSearchRenderMs:0
  };

  function getEntry(id){return entryById.get(String(id));}

  function updatePreview(entry){
    if(!entry)return;
    const id=String(entry.id??'');
    if(id===previewId)return;
    previewId=id;
    previewPortrait.replaceChildren();
    if(entry.image){
      const image=document.createElement('img');
      image.src=entry.image;
      image.alt='';
      image.loading='eager';
      image.decoding='async';
      image.fetchPriority='high';
      image.draggable=false;
      image.onerror=()=>replaceFailedPortrait(image);
      previewPortrait.append(image);
    }else previewPortrait.append(createFallback());
    previewName.textContent=entry.name||'Chimpion';
    const compatibility=entry.compatibility||getAvatarCompatibility(entry);
    previewTribe.textContent=compatibility.status===AVATAR_COMPATIBILITY_STATUS.UNSUPPORTED
      ?`UNSUPPORTED · ${compatibility.reason}`
      :(entry.tribe||'Chimpion');
  }

  function syncSetupButtons(){
    for(const button of setupButtons){
      const selected=button.dataset.setupId===currentSetupId;
      button.classList.toggle('is-selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
  }

  function syncSelectedCards(){
    for(const card of grid.querySelectorAll('.chimpion-card')){
      const selected=String(card.dataset.avatarId)===currentSelectedId;
      card.classList.toggle('is-selected',selected);
      card.setAttribute('aria-pressed',String(selected));
    }
  }

  function setLoading(value){
    loading=!!value;
    dialog.classList.toggle('is-loading',loading);
    dialog.setAttribute('aria-busy',String(loading));
    search.disabled=loading;
    for(const button of grid.querySelectorAll('button'))button.disabled=loading||button.dataset.unavailable==='true';
    for(const button of setupButtons)button.disabled=loading;
    setupBack.disabled=loading;
    closeButton.disabled=loading;
  }

  function showSetupStep(entry){
    if(loading||!entry||!hasSetupStep)return false;
    const compatibility=entry.compatibility||getAvatarCompatibility(entry);
    if(compatibility.status===AVATAR_COMPATIBILITY_STATUS.UNSUPPORTED){updatePreview(entry);return false;}
    pendingEntry=entry;step='setup';updatePreview(entry);
    title.textContent=t('setup.title','Choose skateboard setup');
    stepLabel.textContent='STEP 2 OF 2 · SKATEBOARD';
    search.hidden=true;grid.hidden=true;setupStep.hidden=false;
    syncSetupButtons();
    const preferred=setupButtons.find(button=>button.dataset.setupId===currentSetupId)||setupButtons[0]||setupBack;
    setTimeout(()=>preferred?.focus(),0);
    return true;
  }

  function showAvatarStep({focusGrid=true}={}){
    step='avatar';
    title.textContent=t('avatar.title','Choose your Chimpion');
    stepLabel.textContent=hasSetupStep?'STEP 1 OF 2 · RIDER':t('avatar.step','RIDER SELECT');
    setupStep.hidden=true;search.hidden=false;grid.hidden=false;
    const entry=pendingEntry||getEntry(currentSelectedId)||visibleRecords[0]?.entry;
    if(entry)updatePreview(entry);
    if(focusGrid){
      const pendingId=String(pendingEntry?.id||currentSelectedId||'');
      const index=visibleRecords.findIndex(record=>record.id===pendingId);
      setTimeout(()=>index>=0?focusCard(index):search.focus(),0);
    }
  }

  async function completeSelection(entry=pendingEntry,setupId=currentSetupId||null){
    if(loading||!entry)return false;
    const compatibility=entry.compatibility||getAvatarCompatibility(entry);
    if(compatibility.status===AVATAR_COMPATIBILITY_STATUS.UNSUPPORTED){updatePreview(entry);return false;}
    setLoading(true);showStatus(t('avatar.loading','Loading rider…'));
    try{
      await onSelect(entry,setupId||null);
      currentSelectedId=String(entry.id);
      if(setupId)currentSetupId=String(setupId);
      syncSetupButtons();syncSelectedCards();updatePreview(entry);showStatus('');dialog.close();
      return true;
    }catch(error){
      console.warn('Could not load selected Chimpion:',error);
      showStatus(error?.message||t('avatar.localFailed','This rider could not be loaded.'),true);
      return false;
    }finally{setLoading(false);}
  }

  function chooseEntry(entry){
    if(loading||!entry)return false;
    const compatibility=entry.compatibility||getAvatarCompatibility(entry);
    if(compatibility.status===AVATAR_COMPATIBILITY_STATUS.UNSUPPORTED){updatePreview(entry);return false;}
    pendingEntry=entry;updatePreview(entry);
    if(hasSetupStep)return showSetupStep(entry);
    void completeSelection(entry,null);
    return true;
  }

  function cardFor(record,filteredIndex){
    const {entry}=record;
    const uploadAction=isUploadAvatarAction(entry);
    const button=document.createElement('button');
    button.type='button';
    button.className='chimpion-card';
    if(uploadAction)button.classList.add('is-upload-avatar');
    const compatibility=uploadAction?null:(entry.compatibility||getAvatarCompatibility(entry));
    if(compatibility?.status===AVATAR_COMPATIBILITY_STATUS.UNSUPPORTED){
      button.classList.add('is-unsupported');
      button.setAttribute('aria-disabled','true');
      button.dataset.unavailable='true';
      button.disabled=true;
      button.title=compatibility.reason;
    }
    button.dataset.avatarId=entry.id;
    button.dataset.filterIndex=String(filteredIndex);
    const selected=!uploadAction&&String(entry.id)===currentSelectedId;
    button.setAttribute('aria-pressed',String(selected));
    if(selected)button.classList.add('is-selected');
    if(loading)button.disabled=true;
    if(uploadAction){
      const portrait=document.createElement('span');
      portrait.className='portrait local-upload-portrait';
      portrait.innerHTML='<span class="portrait-fallback" aria-hidden="true">⬆</span>';
      button.append(portrait);
    }else button.append(createPortrait(entry));
    const name=document.createElement('strong');name.textContent=entry.name;
    const tribe=document.createElement('small');
    tribe.textContent=uploadAction?'LOCAL ONLY · NO UPLOAD':(compatibility?.status===AVATAR_COMPATIBILITY_STATUS.UNSUPPORTED?'UNSUPPORTED · RIG':(entry.tribe||'Chimpion'));
    button.append(name,tribe);
    metrics.cardNodesCreated++;
    return button;
  }

  function appendUntil(targetCount){
    const target=Math.min(targetCount,visibleRecords.length);
    if(target<=renderedCount)return;
    const fragment=document.createDocumentFragment();
    for(let index=renderedCount;index<target;index++)fragment.append(cardFor(visibleRecords[index],index));
    grid.append(fragment);
    renderedCount=target;
    metrics.renderedCardCount=renderedCount;
  }
  function appendNextChunk(){
    appendUntil(getAvatarRenderTarget(visibleRecords.length,renderedCount,AVATAR_SELECTOR_RENDER_CHUNK));
  }
  function applyFilter(reason='search'){
    const started=performance.now();
    visibleRecords=filterAvatarSearchIndex(searchIndex,search.value);
    renderedCount=0;
    grid.replaceChildren();
    grid.scrollTop=0;
    appendUntil(getAvatarRenderTarget(visibleRecords.length,0,AVATAR_SELECTOR_RENDER_CHUNK));
    metrics.filteredCount=visibleRecords.length;
    metrics.renderedCardCount=renderedCount;
    const elapsed=performance.now()-started;
    if(reason==='open')metrics.lastOpenRenderMs=elapsed;
    else metrics.lastSearchRenderMs=elapsed;
    const selected=getEntry(currentSelectedId)||visibleRecords[0]?.entry;
    if(selected)updatePreview(selected);
  }
  function ensureRenderedThrough(index){
    if(index<0)return;
    while(renderedCount<=index&&renderedCount<visibleRecords.length)appendNextChunk();
  }
  function cardAt(index){
    if(index<0||index>=visibleRecords.length)return null;
    ensureRenderedThrough(index);
    return grid.querySelector('.chimpion-card[data-filter-index="'+index+'"]');
  }
  function focusCard(index){
    if(!visibleRecords.length)return;
    const clamped=Math.max(0,Math.min(visibleRecords.length-1,index));
    const card=cardAt(clamped);
    if(!card)return;
    card.focus({preventScroll:true});
    card.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function activeCardIndex(){
    const active=document.activeElement;
    if(!active?.classList?.contains('chimpion-card'))return -1;
    const index=Number(active.dataset.filterIndex);
    return Number.isFinite(index)?index:-1;
  }
  function columns(){return Math.max(1,Math.floor(grid.clientWidth/155));}

  function handleMenuAction(action){
    if(!dialog.open||loading||!action)return false;
    if(action===MENU_ACTION.CANCEL){if(step==='setup')showAvatarStep();else dialog.close();return true;}
    if(step==='setup'){
      const active=document.activeElement;
      const currentIndex=Math.max(0,setupButtons.indexOf(active));
      if(action===MENU_ACTION.CONFIRM){
        if(active===setupBack){setupBack.click();return true;}
        const target=setupButtons.includes(active)?active:(setupButtons.find(button=>button.dataset.setupId===currentSetupId)||setupButtons[0]);
        target?.click();return true;
      }
      if(action===MENU_ACTION.DOWN&&setupButtons.includes(active)){setupBack.focus();return true;}
      if(action===MENU_ACTION.UP&&active===setupBack){(setupButtons.find(button=>button.dataset.setupId===currentSetupId)||setupButtons[0])?.focus();return true;}
      if([MENU_ACTION.LEFT,MENU_ACTION.RIGHT,MENU_ACTION.UP,MENU_ACTION.DOWN].includes(action)&&setupButtons.length){
        const direction=(action===MENU_ACTION.LEFT||action===MENU_ACTION.UP)?-1:1;
        setupButtons[(currentIndex+direction+setupButtons.length)%setupButtons.length]?.focus();return true;
      }
      return false;
    }
    if(action===MENU_ACTION.CONFIRM){
      const active=document.activeElement;
      if(active===search){focusCard(0);return true;}
      if(active?.classList?.contains('chimpion-card')){active.click();return true;}
      const selectedIndex=visibleRecords.findIndex(record=>record.id===currentSelectedId);
      focusCard(selectedIndex>=0?selectedIndex:0);return true;
    }
    if(!visibleRecords.length)return false;
    const active=document.activeElement;
    if(active===search){if(action===MENU_ACTION.DOWN){focusCard(0);return true;}return false;}
    const index=activeCardIndex();
    if(index<0){focusCard(0);return true;}
    const columnCount=columns();let next=index;
    if(action===MENU_ACTION.RIGHT)next=index+1;
    else if(action===MENU_ACTION.LEFT)next=index-1;
    else if(action===MENU_ACTION.DOWN)next=index+columnCount;
    else if(action===MENU_ACTION.UP){if(index<columnCount){search.focus();return true;}next=index-columnCount;}
    else return false;
    focusCard(next);return true;
  }

  function keyboardMove(event){
    const editableSearch=document.activeElement===search;
    const action=menuActionFromKeyboardEvent(event,{allowWASD:!editableSearch,allowSpace:!editableSearch});
    if(!action)return;
    if(handleMenuAction(action)){
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function setSelected(entryOrId,setupId=currentSetupId){
    currentSelectedId=String(typeof entryOrId==='object'?entryOrId?.id:entryOrId??'');
    if(setupId&&setupContract.profiles.some(profile=>profile.id===String(setupId)))currentSetupId=String(setupId);
    const entry=typeof entryOrId==='object'?entryOrId:getEntry(currentSelectedId);
    if(entry){previewId='';updatePreview(entry);}
    syncSelectedCards();syncSetupButtons();
  }

  function getDiagnostics(){
    return {...metrics,selectorStep:step,setupId:currentSetupId,hasSetupStep};
  }

  search.addEventListener('input',()=>applyFilter('search'));
  dialog.addEventListener('focusin',event=>markMenuFocus(event.target));
  dialog.addEventListener('keydown',keyboardMove);
  dialog.addEventListener('cancel',event=>{
    if(loading){event.preventDefault();return;}
    if(step==='setup'){event.preventDefault();showAvatarStep();}
  });
  dialog.addEventListener('close',()=>{
    step='avatar';
    pendingEntry=null;
    setupStep.hidden=true;
    search.hidden=false;
    grid.hidden=false;
    menuSelected?.classList?.remove('is-menu-selected');
    menuSelected=null;
    const target=openReturnFocus;
    openReturnFocus=null;
    setTimeout(()=>{if(target?.isConnected&&!target.disabled)target.focus();},0);
  });
  setupBack.addEventListener('click',()=>{if(!loading)showAvatarStep();});
  setupStep.addEventListener('click',event=>{
    const button=event.target.closest?.('.skateboard-setup-card');
    if(!button||!setupStep.contains(button)||button.disabled)return;
    void completeSelection(pendingEntry,button.dataset.setupId);
  });

  function showStatus(message='',isError=false){
    status.textContent=message;
    status.classList.toggle('is-error',!!isError);
    status.hidden=!message;
  }

  async function handleLocalFile(file){
    if(!file)return;
    setLoading(true);
    showStatus(t('avatar.localChecking','Checking local GLB…'));
    let nextUrl='';
    let nextEntry=null;
    try{
      await validateLocalGlbFile(file);
      nextUrl=URL.createObjectURL(file);
      nextEntry=createLocalAvatarEntry(file,nextUrl);
      await onValidateLocalAvatar(nextEntry);
      const oldUrl=customObjectUrl;
      customEntry=nextEntry;
      customObjectUrl=nextUrl;
      nextUrl='';
      if(oldUrl)URL.revokeObjectURL(oldUrl);
      rebuildSearchIndex();
      search.value='';
      applyFilter('upload');
      showStatus(t('avatar.localReady','Local GLB ready. It stays on this device for this session.'));
    }catch(error){
      if(nextUrl)URL.revokeObjectURL(nextUrl);
      showStatus(error?.message||t('avatar.localFailed','This GLB could not be used.'),true);
      nextEntry=null;
    }finally{
      fileInput.value='';
      setLoading(false);
    }
    if(nextEntry)chooseEntry(nextEntry);
  }

  fileInput.addEventListener('change',()=>handleLocalFile(fileInput.files?.[0]));

  // One delegated listener per interaction type instead of three listeners per card.
  grid.addEventListener('focusin',event=>{
    const button=event.target.closest?.('.chimpion-card');
    if(!button)return;
    const record=visibleRecords[Number(button.dataset.filterIndex)];
    if(record)updatePreview(record.entry);
  });
  grid.addEventListener('pointerover',event=>{
    const button=event.target.closest?.('.chimpion-card');
    if(!button||button.contains(event.relatedTarget))return;
    const record=visibleRecords[Number(button.dataset.filterIndex)];
    if(record)updatePreview(record.entry);
  });
  grid.addEventListener('click',event=>{
    const button=event.target.closest?.('.chimpion-card');
    if(!button||!grid.contains(button))return;
    const record=visibleRecords[Number(button.dataset.filterIndex)];
    if(!record)return;
    if(isUploadAvatarAction(record.entry)){
      showStatus(t('avatar.localPick','Choose a local .glb file (maximum 50 MB).'));
      fileInput.click();
      return;
    }
    chooseEntry(record.entry);
  });
  grid.addEventListener('error',event=>{
    const image=event.target;
    if(image?.tagName==='IMG'&&image.closest('.portrait'))replaceFailedPortrait(image);
  },true);
  grid.addEventListener('scroll',()=>{
    if(renderedCount>=visibleRecords.length)return;
    if(grid.scrollTop+grid.clientHeight>=grid.scrollHeight-240)appendNextChunk();
  },{passive:true});

  // Closed selector owns zero card/image nodes. Cards are materialized only on open.
  metrics.filteredCount=visibleRecords.length;
  metrics.renderedCardCount=0;
  syncSetupButtons();

  function open(){
    if(loading)return;
    openReturnFocus=document.activeElement;
    search.value='';
    showStatus('');
    pendingEntry=null;
    step='avatar';
    applyFilter('open');
    showAvatarStep({focusGrid:false});
    dialog.showModal();
    search.focus();
  }

  function dispose(){
    if(customObjectUrl){
      URL.revokeObjectURL(customObjectUrl);
      customObjectUrl='';
    }
    window.removeEventListener('pagehide',dispose);
    dialog.remove();
  }
  window.addEventListener('pagehide',dispose,{once:true});

  return {
    open,
    close:()=>dialog.close(),
    dispose,
    dialog,
    handleMenuAction,
    setSelected,
    setLoading,
    getDiagnostics,
    getSetupId:()=>currentSetupId,
    getRideMode:()=>null
  };
}
