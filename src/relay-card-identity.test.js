import test from 'node:test';
import assert from 'node:assert/strict';
import {cardIdentity,cardStaff,CARD_TEAMS} from './relay-card-identity.js';
test('a routing lead is distinct from a receipt-bound current step owner',()=>{
 const record={primary_staff:'nico',primary_team:'runner',supporting_staff:['roman'],supporting_teams:['inspector']};
 const lead=cardIdentity(record);assert.equal(lead.relationship,'Assignment lead');assert.equal(lead.speaker.id,'nico');assert.equal(lead.participation,'routing');assert.equal(lead.current_owner,null);
 const work=cardIdentity(record,{current:'verify',steps:[{id:'verify',receipt:{id:'observed'},owner:{staff:'roman',team:'inspector'}}]});
 assert.equal(work.speaker.id,'roman');assert.equal(work.lead.id,'nico');assert.equal(work.team,'inspector');
});
test('retired and unknown IDs never inherit an arbitrary portrait identity',()=>{
 assert.equal(cardStaff('felix'),null);assert.equal(cardStaff('unknown'),null);assert.equal(cardIdentity({primary_team:'inspector'}).speaker,null);assert.equal(cardStaff('dominique').status,'reserve');assert.equal(Object.keys(CARD_TEAMS).length,7);
});
test('a named person keeps their canonical team while cross-team work stays explicit across handoff',()=>{
 const record={primary_staff:'nico',primary_team:'runner'};
 const plan={current:'verify',steps:[{id:'verify',receipt:{id:'observed'},owner:{staff:'rafael',team:'inspector'}}]};
 const current=cardIdentity(record,plan);assert.equal(current.team,'source');assert.equal(current.team_label,'Integrations');assert.equal(current.step_team,'inspector');assert.equal(current.step_team_label,'Design & QA');
 const next=cardIdentity({...record,primary_staff:'julian'},{steps:[]});assert.equal(next.team,'night-shift');assert.equal(next.assignment_team,'runner');assert.equal(next.relationship,'Assignment lead');assert.equal(next.lead.id,'julian');
 assert.equal(cardIdentity({primary_team:'inspector'}).team,'inspector');
});

test('approved portrait manifest follows the canonical roster and binds every embedded portrait to its source',async()=>{
 const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');const {STAFF}=await import('./staff-registry.js');
 const manifest=JSON.parse(await readFile(new URL('../assets/staff/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.fictional_ai_staff,true);assert.equal(manifest.identity_is_authority,false);
 assert.deepEqual(manifest.staff.map(p=>p.id).sort(),STAFF.filter(p=>p.status!=='retired').map(p=>p.id).sort());
 const {STAFF_PORTRAITS}=await import('../assets/staff/card-assets.js');
 assert.equal(Object.keys(STAFF_PORTRAITS).length,17);assert.equal(manifest.version,4);assert.equal(manifest.final,true);
 assert.equal(manifest.source_archive_sha256,'4b6177a003d7155db796a9a06723f031aaae78d3309422d93468f69200ea3016');
 for(const person of manifest.staff){
  const canonical=STAFF.find(p=>p.id===person.id);assert.equal(person.status,canonical.status);assert.equal(person.home_team,canonical.home_team);
  assert.equal(person.portrait_status,'approved-v4');
  assert.equal(person.face_identity_locked,['nico','julian','rafael','dominique'].includes(person.id));
  assert.equal(person.files.webp512.sha256,person.source_files.webp512.sha256);
  assert.equal(person.files.card128.source_sha256,person.source_files.avatar512.sha256);
  const embedded=Buffer.from(STAFF_PORTRAITS[person.id].split(',')[1],'base64');
  assert.equal(createHash('sha256').update(embedded).digest('hex'),person.files.card128.sha256);
  for(const file of Object.values(person.files)){const bytes=await readFile(new URL('../assets/staff/'+file.path,import.meta.url));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 }
});

test('assignment lead stays visible without claiming receipt ownership, including finished assignments',()=>{
 for(const state of ['active','completed','held']){
  const identity=cardIdentity({state,primary_staff:'julian',primary_team:'night-shift'});
  assert.equal(identity.speaker.id,'julian');assert.equal(identity.relationship,'Assignment lead');
  assert.equal(identity.current_owner,null);assert.equal(identity.participation,'routing');
 }
 for(const primary_staff of ['unknown','felix',null])assert.equal(cardIdentity({primary_staff}).speaker,null);
 assert.equal(cardIdentity().team,'relay');assert.equal(cardIdentity().speaker,null);
});
test('explicit team-only work never becomes the lead performing the step',()=>{
 const identity=cardIdentity({primary_staff:'nico',primary_team:'runner'},{current:'verify',steps:[{id:'verify',receipt:{id:'real-team-receipt'},owner:{staff:null,team:'inspector'}}]});
 assert.equal(identity.speaker,null);assert.equal(identity.current_owner,null);
 assert.equal(identity.lead.id,'nico');assert.equal(identity.team,'inspector');assert.equal(identity.relationship,'Team update');
});
