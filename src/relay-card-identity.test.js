import test from 'node:test';
import assert from 'node:assert/strict';
import {cardIdentity,cardStaff,CARD_TEAMS} from './relay-card-identity.js';
test('a routing lead is distinct from a receipt-bound current step owner',()=>{
 const record={primary_staff:'nico',primary_team:'runner',supporting_staff:['roman'],supporting_teams:['inspector']};
 const lead=cardIdentity(record);assert.equal(lead.relationship,'Assignment lead');assert.equal(lead.participation,'routing');assert.equal(lead.current_owner,null);
 const work=cardIdentity(record,{current:'verify',steps:[{id:'verify',receipt:{id:'observed'},owner:{staff:'roman',team:'inspector'}}]});
 assert.equal(work.speaker.id,'roman');assert.equal(work.lead.id,'nico');assert.equal(work.team,'inspector');
});
test('retired and unknown IDs never inherit an arbitrary portrait identity',()=>{
 assert.equal(cardStaff('felix'),null);assert.equal(cardStaff('unknown'),null);assert.equal(cardIdentity({primary_team:'inspector'}).speaker,null);assert.equal(cardStaff('dominique').status,'reserve');assert.equal(Object.keys(CARD_TEAMS).length,7);
});

test('approved portrait manifest follows the canonical roster and binds every embedded portrait to its source',async()=>{
 const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');const {STAFF}=await import('./staff-registry.js');
 const manifest=JSON.parse(await readFile(new URL('../assets/staff/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.fictional_ai_staff,true);assert.equal(manifest.identity_is_authority,false);
 assert.deepEqual(manifest.staff.map(p=>p.id).sort(),STAFF.filter(p=>p.status!=='retired').map(p=>p.id).sort());
 const {STAFF_PORTRAITS}=await import('../assets/staff/card-assets.js');
 assert.equal(Object.keys(STAFF_PORTRAITS).length,17);assert.equal(manifest.version,3);assert.equal(manifest.final,false);
 assert.equal(manifest.source_archive_sha256,'3ed80350ba3c4b5e294a00d8fa0fcd99608eae95e1fd3986876590a313a61b63');
 for(const person of manifest.staff){
  const canonical=STAFF.find(p=>p.id===person.id);assert.equal(person.status,canonical.status);assert.equal(person.home_team,canonical.home_team);
  assert.equal(person.portrait_status,['nico','julian','rafael','dominique','valentina'].includes(person.id)?'revision-pending':'approved-v3');
  assert.equal(person.face_identity_locked,['nico','julian','rafael','dominique'].includes(person.id));
  assert.equal(person.files.webp512.sha256,person.source_files.webp512.sha256);
  assert.equal(person.files.card128.source_sha256,person.files.webp512.sha256);
  const embedded=Buffer.from(STAFF_PORTRAITS[person.id].split(',')[1],'base64');
  assert.equal(createHash('sha256').update(embedded).digest('hex'),person.files.card128.sha256);
  for(const file of Object.values(person.files)){const bytes=await readFile(new URL('../assets/staff/'+file.path,import.meta.url));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 }
});
