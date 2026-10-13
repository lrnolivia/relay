import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverProjectIcon} from '../src/project-icons.mjs';
const project={repository:'lrnolivia/rtxForge',default_branch:'main'};
function fixture(entries){
 const calls=[];
 const files=entries.map((entry,i)=>({...entry,type:'blob',sha:(i+1).toString(16).padStart(40,'0'),size:entry.size??Buffer.byteLength(entry.content??'PNG')}));
 const request=async path=>{calls.push(path);if(path.includes('/git/trees/'))return {tree:files,truncated:false};const file=files.find(f=>path.endsWith(f.sha));assert.ok(file,'only registered-repository blobs');return {encoding:'base64',content:Buffer.from(file.content??'PNG').toString('base64')};};
 return {request,calls,files};
}
test('native reverse-domain application ID resolves at 256px',async()=>{
 const f=fixture([{path:'gui/icons/hicolor/512x512/apps/io.github.lrnolivia.RTXForge.png',size:778242},{path:'gui/icons/hicolor/256x256/apps/io.github.lrnolivia.RTXForge.png',size:52786},{path:'gui/icons/hicolor/32x32/apps/io.github.lrnolivia.RTXForge.png'}]);
 const r=await discoverProjectIcon(project,f.request);assert.equal(r.status,'found');assert.match(r.icon.path,/256x256/);assert.equal(f.calls.some(p=>p.endsWith(f.files[0].sha)),false);
});
test('native action glyphs are excluded',async()=>{
 const f=fixture([{path:'gui/icons/hicolor/256x256/actions/rtxForge.png'}]);assert.equal((await discoverProjectIcon(project,f.request)).status,'unavailable');
});
test('native identity ranks ahead of unrelated application icons',async()=>{
 const f=fixture([{path:'gui/icons/hicolor/256x256/apps/org.other.Editor.png'},{path:'gui/icons/hicolor/128x128/apps/io.github.lrnolivia.RTXForge.png'}]);assert.match((await discoverProjectIcon(project,f.request)).icon.path,/RTXForge/);
});
test('declared favicon retains precedence over native inference',async()=>{
 const f=fixture([{path:'index.html',content:'<link rel="icon" href="/favicon.png">'},{path:'favicon.png'},{path:'gui/icons/hicolor/256x256/apps/io.github.lrnolivia.RTXForge.png'}]);assert.equal((await discoverProjectIcon(project,f.request)).icon.path,'favicon.png');
});
test('unsafe native SVG is skipped without following external references',async()=>{
 const f=fixture([{path:'gui/icons/hicolor/scalable/apps/io.github.lrnolivia.RTXForge.svg',content:'<svg><image href="https://evil.example/a"/></svg>'},{path:'gui/icons/hicolor/128x128/apps/io.github.lrnolivia.RTXForge.png'}]);assert.match((await discoverProjectIcon(project,f.request)).icon.path,/128x128/);assert.ok(f.calls.every(p=>p.startsWith('/repos/lrnolivia/rtxForge/')));
});
test('truncated tree and aliases fail closed',async()=>{
 assert.equal((await discoverProjectIcon(project,async()=>({tree:[],truncated:true}))).status,'unavailable');
 assert.equal((await discoverProjectIcon({...project,alias_of:'other'},()=>{throw Error('should not fetch')})).status,'unavailable');
});

test('explicit product manifest verifies exact bytes and fails closed on drift',async()=>{
 const {createHash}=await import('node:crypto');const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>');
 const manifest={schema:1,project:'fixture',variants:{primary:{path:'assets/chosen.svg',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length}}};
 const files=[{path:'relay.assets.json',type:'blob',sha:'a'.repeat(40),size:1000},{path:'assets/chosen.svg',type:'blob',sha:'b'.repeat(40),size:bytes.length}];
 const api=async url=>url.includes('/git/trees/')?{tree:files,truncated:false}:{encoding:'base64',content:(url.endsWith('a'.repeat(40))?Buffer.from(JSON.stringify(manifest)):bytes).toString('base64')};
 const result=await discoverProjectIcon({id:'fixture',repository:'lrnolivia/fixture'},api);assert.equal(result.icon.path,'assets/chosen.svg');assert.equal(result.icon.manifest,'relay.assets.json');
 manifest.variants.primary.sha256='c'.repeat(64);assert.equal((await discoverProjectIcon({id:'fixture',repository:'lrnolivia/fixture'},api)).reason,'declared-asset-invalid');
});
