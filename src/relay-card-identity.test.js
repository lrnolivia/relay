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

test('portrait manifest follows the canonical roster and preserves the four locked identities',async()=>{
 const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');const {STAFF}=await import('./staff-registry.js');
 const manifest=JSON.parse(await readFile(new URL('../assets/staff/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.fictional_ai_staff,true);assert.equal(manifest.identity_is_authority,false);
 assert.deepEqual(manifest.staff.map(p=>p.id).sort(),STAFF.filter(p=>p.status!=='retired').map(p=>p.id).sort());
 const locked={nico:'0a338ce958ab480f78c01c815d468b3497b55500c9011c9a82d66584421ed293',julian:'3d2e2035753dcf4e674d6a3372319bcbbfe3d797b1d5b1c30430651c4e568719',rafael:'094ffb7b53daa4246291ccdf78fa210cd395c9d8651b97e2a24bda0e4ddeb81c',dominique:'cb6ef1c47408e04e55d2fee152d491281dcdf60cb2a8efd19821d45178ac2664'};
 for(const person of manifest.staff){
  const canonical=STAFF.find(p=>p.id===person.id);assert.equal(person.status,canonical.status);assert.equal(person.home_team,canonical.home_team);
  if(locked[person.id])assert.equal(person.files.webp512.sha256,locked[person.id]);
  for(const file of Object.values(person.files)){const bytes=await readFile(new URL('../assets/staff/'+file.path,import.meta.url));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 }
});
