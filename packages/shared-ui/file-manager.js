import {renderControlShell,renderControlFooter,renderControlChoiceGroup} from './work-controls.js';
import {glyph} from './glyphs.js';
import {sha256} from '@noble/hashes/sha2.js';
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const human=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB';
export const fileManagerIcon='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/><path d="M3 10h18"/></svg>';
export function fileKind(filename=''){
 const ext=filename.toLowerCase().split('.').pop();
 return ['png','jpg','jpeg','gif','webp','svg','avif','heic'].includes(ext)?'images':['zip','gz','tgz','tar','7z','rar'].includes(ext)?'packages':['pdf','txt','md','doc','docx','csv','json','xlsx','pptx'].includes(ext)?'documents':'other';
}
export function filterFiles(files,{search='',state='all',kind='all',sort='newest'}={}){
 return files.filter(item=>(!search.trim()||item.filename.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))&&(state==='all'||(state==='ready'?item.state==='ready':item.state!=='ready'))&&(kind==='all'||fileKind(item.filename)===kind)).sort((a,b)=>sort==='name'?a.filename.localeCompare(b.filename):sort==='size'?b.bytes-a.bytes:b.created_at-a.created_at);
}
export function validFileName(name){return typeof name==='string'&&name.trim().length>0&&name.length<=180&&!/[\x00-\x1f\x7f/\\]/.test(name)&&!['.','..'].includes(name.trim());}
export function bindFileManager(root=document){
 let dialog=null,opener=null,files=[],working=false,paused=false,current=null,message='',refreshing=false,disposed=false,editing=null,mutating=false,capabilities={rename:false,delete:false,restore:false},filePolicy={},undo=[];
 const controller=new AbortController(),query={search:'',state:'all',kind:'all',sort:'newest'};
 async function request(path='',options={}){const r=await fetch('/api/files'+path,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000),...options,headers:{'X-Relay-File-Request':'1',...options.headers}});let value;try{value=await r.json()}catch{throw Error('Sign in again, then reopen Files before trying again.')}if(!r.ok)throw Error(value.error||'File request failed');return value;}
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node}
 function status(text){message=text;if(dialog)dialog.querySelector('[data-file-status]').textContent=text;}
 function focusAction(id,action='rename'){dialog?.querySelector('[data-file-actions="'+id+'"] [data-file-action="'+action+'"]')?.focus();}
 function editFile(item,action){if(working||mutating||refreshing)return;editing={id:item.id,action,name:item.filename,error:''};render();dialog.querySelector('.relay-file-edit input, .relay-file-edit [data-file-cancel]')?.focus();}
 async function saveEdit(item){
  if(!editing||mutating||working||refreshing)return;
  const edit=editing,name=edit.name.trim();
  if(!capabilities[edit.action]){edit.error='This file action is unavailable. Refresh Files before trying again.';render();return;}
  if(edit.action==='rename'&&!validFileName(name)){edit.error='Use a name of 1–180 characters, without slashes or control characters.';render();dialog.querySelector('.relay-file-edit input')?.focus();return;}
  mutating=true;render();
  try{const result=await request('/'+encodeURIComponent(item.id),{method:edit.action==='rename'?'PATCH':'DELETE',...(edit.action==='rename'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:name})}:{})});
   if(edit.action==='rename'){if(result.ok!==true||!result.file||result.file.id!==item.id)throw Error('The file service did not confirm the rename. Refresh Files before trying again.');files=files.map(x=>x.id===item.id?result.file:x);status('Renamed to '+result.file.filename+'.');}
   else{if(result.ok!==true||result.id!==item.id)throw Error('The file service did not confirm deletion. Refresh Files before trying again.');files=files.filter(x=>x.id!==item.id);if(capabilities.restore&&result.delete_mode==='soft'&&Number.isFinite(result.recoverable_until)&&result.recoverable_until>Date.now())undo.push({id:item.id,filename:item.filename,until:Math.min(result.recoverable_until,item.expires_at)});status(item.filename+' was deleted.');}
   editing=null;
  }catch(e){edit.error=e.message;status(e.message)}finally{mutating=false;render();if(editing)dialog.querySelector('.relay-file-edit [data-file-cancel]')?.focus();else if(edit.action==='rename')focusAction(item.id);else dialog.querySelector('[data-file-choose]')?.focus();}
 }
 async function undoDelete(){
  const entry=undo.at(-1);if(!entry||mutating||working||refreshing||!capabilities.restore)return;
  mutating=true;render();
  try{const result=await request('/'+encodeURIComponent(entry.id)+'/restore',{method:'POST'});if(result.ok!==true||!result.file||result.file.id!==entry.id)throw Error('The file service did not confirm restoration. Refresh Files before trying again.');files=[...files.filter(x=>x.id!==entry.id),result.file];undo.pop();status(result.file.filename+' was restored.');}
  catch(e){status(e.message)}finally{mutating=false;render();dialog.querySelector('[data-file-undo]:not([hidden]),[data-file-choose]')?.focus();}
 }
 function renderEdit(item,row){
  const edit=editing,form=el('form','relay-file-edit');form.setAttribute('aria-label',edit.action==='rename'?'Rename '+item.filename:'Delete '+item.filename);
  if(edit.action==='rename'){const label=el('label','','File name'),input=el('input');input.type='text';input.value=edit.name;input.maxLength=180;input.required=true;input.disabled=mutating;input.oninput=()=>{edit.name=input.value};label.append(input);form.append(label,el('p','','The file contents and expiry stay the same.'));}
  else form.append(el('strong','','Delete this file?'),el('p','','This removes '+item.filename+' from Files.'+(capabilities.restore&&filePolicy.deletion==='soft'?' You can undo this until the file expires.':'')));
  if(edit.error){const error=el('p','relay-file-edit-error',edit.error);error.setAttribute('role','alert');form.append(error);}
  const actions=el('div','relay-file-edit-actions'),cancel=el('button','','Cancel'),submit=el('button',edit.action==='delete'?'relay-file-delete':'relay-file-save',mutating?(edit.action==='rename'?'Saving…':'Deleting…'):edit.action==='rename'?'Save name':'Delete file');cancel.type='button';cancel.dataset.fileCancel='';cancel.disabled=mutating;submit.disabled=mutating||refreshing;submit.type='submit';cancel.onclick=()=>{editing=null;render();focusAction(item.id,edit.action)};actions.append(cancel,submit);form.append(actions);form.onsubmit=event=>{event.preventDefault();void saveEdit(item)};form.onkeydown=event=>{if(event.key==='Escape'&&!mutating){event.preventDefault();event.stopPropagation();editing=null;render();focusAction(item.id,edit.action)}};row.append(form);
 }
 function render(){if(!dialog)return;const list=dialog.querySelector('[data-file-list]');list.replaceChildren();
  const visible=filterFiles(files,query);dialog.querySelector('[data-file-count]').textContent=visible.length+' of '+files.length+' files';
  for(const item of visible){const row=el('li','relay-file-row'),icon=el('span','relay-file-symbol');icon.innerHTML=fileManagerIcon;const info=el('div','relay-file-info');info.append(el('strong','',item.filename),el('span','',human(item.bytes)+' · '+(item.state==='ready'?'Ready':'Upload incomplete')+' · expires '+new Date(item.expires_at).toLocaleDateString()));const action=el('div','relay-file-actions');
   action.dataset.fileActions=item.id;const routine=el('div','relay-file-routine');action.append(routine);
   if(item.state==='ready'){const a=el('a','relay-file-action relay-file-icon relay-file-download');a.innerHTML=glyph('download');a.setAttribute('aria-label','Download');a.title='Download '+item.filename;a.href='/api/files/'+encodeURIComponent(item.id)+'/download';a.setAttribute('download',item.filename);routine.append(a)}else{const b=el('button','relay-file-icon');b.innerHTML=glyph('refresh');b.setAttribute('aria-label','Resume');b.title='Resume upload of '+item.filename;b.type='button';b.disabled=working||mutating;b.onclick=()=>{current={resume:item};dialog.querySelector('input[type=file]').click()};routine.append(b)}
   for(const [key,label] of [['rename','Rename'],['delete','Delete']].filter(([key])=>capabilities[key]&&(key!=='rename'||item.state==='ready'))){const b=el('button','relay-file-icon'+(key==='delete'?' relay-file-delete':''));b.innerHTML=glyph(key==='delete'?'trash':'rename');b.setAttribute('aria-label',label);b.title=label+' '+item.filename;b.dataset.fileAction=key;b.type='button';b.disabled=working||mutating||refreshing;b.onclick=()=>editFile(item,key);(key==='delete'?action:routine).append(b)}row.append(icon,info,action);if(editing?.id===item.id)renderEdit(item,row);list.append(row)}
  if(!visible.length)list.append(el('li','relay-file-empty',refreshing?'Loading files…':files.length?'No files match. Try another filter or clear your search.':'Drop a file here, or use Upload file. Compress folders into a package first.'));
  dialog.querySelector('[data-file-pause]').hidden=!working;dialog.querySelector('[data-file-pause]').textContent=paused?'Pausing…':'Pause upload';dialog.querySelector('[data-file-choose]').disabled=working||mutating;dialog.querySelector('[data-file-refresh]').disabled=mutating;undo=undo.filter(x=>x.until>Date.now());const restore=dialog.querySelector('[data-file-undo]');restore.hidden=!undo.length||!capabilities.restore;restore.disabled=mutating||working||refreshing;restore.setAttribute('aria-label','Undo delete '+(undo.at(-1)?.filename||''));status(message);
 }
 async function refresh(){if(refreshing)return;refreshing=true;render();try{const all=[];let cursor=null,allCapabilities={rename:true,delete:true,restore:true};do{const result=await request(cursor?'?cursor='+encodeURIComponent(cursor):'');all.push(...result.files);filePolicy=result.file_policy||{};for(const key of ['rename','delete','restore'])allCapabilities[key]=allCapabilities[key]&&result.capabilities?.[key]===true;cursor=result.cursor}while(cursor&&!disposed);files=all;capabilities=allCapabilities;if(!working)status('Private to your signed-in account. Files expire after 3 days.')}catch(e){status(e.message)}finally{refreshing=false;render()}}
 async function upload(file,resume){
  if(working||mutating)return;editing=null;if(!file.size||file.size>512*1048576){status('Choose a file between 1 byte and 512 MB.');return}
  working=true;paused=false;render();const progress=dialog?.querySelector('progress');
  try{
   const hasher=sha256.create(),step=4*1048576;
   for(let offset=0;offset<file.size;offset+=step){if(paused)throw Error('Paused. Choose the same file to resume.');hasher.update(new Uint8Array(await file.slice(offset,offset+step).arrayBuffer()));status('Checking '+file.name+' · '+Math.round(Math.min(offset+step,file.size)/file.size*100)+'%');if(progress){progress.hidden=false;progress.value=Math.min(offset+step,file.size)/file.size*.15}await new Promise(r=>setTimeout(r,0))}
   const checksum=hex(hasher.digest());
   if(resume&&(resume.sha256!==checksum||resume.bytes!==file.size))throw Error('That is a different file. Choose the original package to resume.');
   // This ID identifies exact bytes, so an interrupted upload is recoverable on another device.
   const requestId='browser-'+checksum+'-'+hex(sha256(new TextEncoder().encode(file.name))).slice(0,12)+'-'+Math.floor(Date.now()/(72*3600000));
   let item=resume?(await request('/'+resume.id+'/status')).file:(await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:requestId,filename:file.name,bytes:file.size,sha256:checksum})})).file;
   current={file,item};files=[...files.filter(x=>x.id!==item.id),item];render();const present=new Set(item.uploaded_chunks||[]);
   for(let index=0;index<item.chunks;index++){
    if(paused)throw Error('Paused. Use Resume and choose the same file to continue.');
    if(!present.has(index)){const bytes=new Uint8Array(await file.slice(index*item.chunk_bytes,(index+1)*item.chunk_bytes).arrayBuffer());await request('/'+item.id+'/chunks/'+index,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Content-Sha256':hex(sha256(bytes))},body:bytes});}
    const percent=Math.round((index+1)/item.chunks*100);status('Uploading '+file.name+' · '+percent+'%');if(progress)progress.value=.15+(index+1)/item.chunks*.8;
   }
   status('Verifying the complete package…');const result=await request('/'+item.id+'/complete',{method:'POST'});files=files.map(x=>x.id===item.id?result.file:x);status(file.name+' is ready to download.');if(progress)progress.value=1;
  }catch(e){status(e.message+' Uploaded chunks are kept until expiry.')}finally{working=false;paused=false;current=null;if(progress)progress.hidden=true;render()}
 }
 function open(button){opener=button;
  if(!dialog){dialog=el('dialog','relay-file-manager');dialog.setAttribute('aria-labelledby','relay-files-title');
   dialog.innerHTML='<header class="relay-files-header"><div class="relay-files-identity"><span class="relay-files-mark">'+fileManagerIcon+'</span><div><h2 id="relay-files-title">Files</h2><p>Packages in. Downloads out.</p></div></div><button type="button" data-file-close aria-label="Close files">'+glyph('close')+'</button></header><div class="relay-files-toolbar"><button type="button" data-file-choose>'+glyph('plus')+' Upload file</button><span>Up to 512 MB</span><button type="button" data-file-refresh aria-label="Refresh files">'+glyph('refresh')+'</button></div><input type="file" hidden><div class="relay-files-content"><div class="work-view-controls relay-file-controls" data-file-controls></div><p class="work-detail-results" data-file-count role="status" aria-live="polite"></p><div class="relay-files-drop"><ul data-file-list aria-label="Your files"></ul></div></div><footer><progress max="1" value="0" hidden aria-label="Upload progress"></progress><p data-file-status role="status" aria-live="polite"></p><button type="button" data-file-pause hidden>Pause upload</button><button type="button" data-file-undo hidden>Undo delete</button></footer>';
   const filterContent=`<p class="work-control-label">show files</p><div class="work-filter-bar" role="group" aria-label="file readiness">${[['all','everything'],['ready','ready to download'],['incomplete','upload incomplete']].map(([value,label])=>`<button type="button" data-file-filter="state" data-value="${value}" aria-pressed="${query.state===value}">${label}</button>`).join('')}</div><div class="work-query-bar">${renderControlChoiceGroup({key:'kind',label:'file type',value:query.kind,options:[{value:'all',label:'all types'},{value:'images',label:'images'},{value:'packages',label:'packages'},{value:'documents',label:'documents'},{value:'other',label:'other'}]})}${renderControlChoiceGroup({key:'sort',label:'put first',value:query.sort,options:[{value:'newest',label:'newest'},{value:'name',label:'name A–Z'},{value:'size',label:'largest'}]})}</div>${renderControlFooter({hint:'Your files update as you choose.'})}`;
   dialog.querySelector('[data-file-controls]').innerHTML=renderControlShell({variant:'files',viewOptions:[],hideOrganize:true,filterContent});
   dialog.addEventListener('keydown',event=>{const button=event.target.closest('[role=radio]');if(button&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const buttons=[...button.parentElement.querySelectorAll('[role=radio]')],delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1,next=buttons[(buttons.indexOf(button)+delta+buttons.length)%buttons.length];next.click();next.focus();}});
   dialog.addEventListener('input',event=>{if(event.target.name==='search'){query.search=event.target.value;render();}});
   dialog.addEventListener('click',event=>{const choice=event.target.closest('[data-query],[data-file-filter]');if(choice){const key=choice.dataset.query||choice.dataset.fileFilter;query[key]=choice.dataset.value;for(const button of dialog.querySelectorAll(key==='state'?'[data-file-filter]':'[data-query="'+key+'"]')){const selected=button===choice;button.setAttribute(key==='state'?'aria-pressed':'aria-checked',String(selected));if(key!=='state')button.tabIndex=selected?0:-1;}render();}if(event.target.closest('[data-close-menu]'))dialog.querySelector('[data-control-menu]').open=false;});
   document.body.append(dialog);dialog.querySelector('[data-file-undo]').onclick=()=>void undoDelete();dialog.querySelector('[data-file-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>opener?.focus());dialog.querySelector('[data-file-choose]').onclick=()=>{current=null;dialog.querySelector('input[type=file]').click()};dialog.querySelector('[data-file-refresh]').onclick=refresh;dialog.querySelector('[data-file-pause]').onclick=()=>{paused=true;render()};
   dialog.querySelector('input[type=file]').onchange=event=>{const file=event.target.files?.[0],resume=current?.resume;event.target.value='';if(file)void upload(file,resume)};
   dialog.addEventListener('dragover',e=>{e.preventDefault();dialog.classList.add('dragging')});dialog.addEventListener('dragleave',()=>dialog.classList.remove('dragging'));dialog.addEventListener('drop',e=>{e.preventDefault();dialog.classList.remove('dragging');if(e.dataTransfer.files.length!==1){status('Upload one file at a time. Compress folders into a package first.');return}void upload(e.dataTransfer.files[0])});
  }
  if(!dialog.open)dialog.showModal();render();void refresh();
 }
 root.addEventListener('click',event=>{const button=event.target.closest?.('[data-file-manager]');if(button){event.preventDefault();open(button)}},{signal:controller.signal});
 window.addEventListener('beforeunload',event=>{if(working){event.preventDefault();event.returnValue=''}},{signal:controller.signal});
 return ()=>{disposed=true;paused=true;controller.abort();dialog?.remove()};
}
