import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderHumanFirst, shapeCommunicationResult, shapeToolResult } from "./communication-presentation.js";
import { HUMAN_CATALOG, normalizeCommunicationResult, formatRelay, presentationOperation, withHumanPresentation, safePresentationText } from './communication-presentation.js';

const present=(data,operation={kind:'query',name:'relay_source_checks'},options={})=>formatRelay(normalizeCommunicationResult(data,{operation,...options}),options);

test('unrecognized reads and command receipts make no claim about saved changes or freshness',()=>{
  const operations=[presentationOperation('relay_source_file'),presentationOperation('relay_source_inventory'),presentationOperation('relay_context',{action:'read'}),presentationOperation('relay_context',{action:'record'}),{name:'unregistered_operation',kind:'unknown'}];
  for(const operation of operations)for(const data of [{ok:true,revision:36},{ok:true,branches:[]},{ok:true,content:'same content'},{ok:true,state:'new-provider-state'},{ok:true,human_v1:{label:'Saved',summary:'A fresh update was recorded.'}}]){
    const before=structuredClone(data),normalized=normalizeCommunicationResult(data,{operation}),out=formatRelay(normalized);
    assert.equal(out.message_id,'data.unrecognized');assert.equal(out.label,'Response received');
    assert.equal(out.summary,'Relay returned a response without a recognized status.');assert.equal(out.severity,'neutral');
    assert.doesNotMatch(out.label+' '+out.summary,/recorded|saved|updated|fresh|latest|new information|succeeded|complete/i);
    assert.equal(normalized.mutation,operation.kind==='query'?'not_applicable':'unknown');assert.equal(normalized.outcome,'observed');
    assert.equal(normalized.retry.policy,'none');assert.equal(normalized.retry.scheduled_at,null);assert.equal(out.next_step,null);assert.equal(out.timestamp,undefined);
    const formatted=withHumanPresentation(data,{operation});const {human_v1,presentation_mode,...machine}=formatted;
    const {human_v1:untrusted,...expectedMachine}=before;assert.deepEqual(machine,expectedMachine);assert.deepEqual(data,before);
  }
  for(const mutation of ['not_attempted','confirmed_applied','confirmed_not_applied','unknown']){
    const normalized=normalizeCommunicationResult({ok:true,mutation},{operation:presentationOperation('relay_context',{action:'record'})});
    assert.equal(normalized.mutation,mutation);assert.equal(formatRelay(normalized).label,'Response received');
  }
});

test('human_v1 catalog is closed, deterministic and conservative for unknown input',()=>{
  for(const message_id of Object.keys(HUMAN_CATALOG)){
    const input={...normalizeCommunicationResult(),message_id};
    const a=formatRelay(input),b=formatRelay(input);
    assert.deepEqual(a,b);assert.equal(a.message_id,message_id);assert.ok(a.summary.length>0);
  }
  const forged={version:1,message_id:'release.live_verified',params:{},summary:'Everything is safe'};
  assert.equal(formatRelay(forged).message_id,'data.unrecognized');
  assert.equal(present({ok:true,human:{health:'healthy',what_changed:'Everything is safe'},human_v1:forged}).message_id,'data.unrecognized');
  assert.equal(formatRelay({...normalizeCommunicationResult(),message_id:'release.merged',params:{secret:'not allowed'}}).severity,'neutral');
});

test('registered operation metadata handles mixed read and write tools without name inference',()=>{
  for(const [tool,action] of [['relay_execution','status'],['relay_context','read'],['relay_night_shift','read']])assert.equal(presentationOperation(tool,{action}).kind,'query');
  for(const [tool,action] of [['relay_execution','submit'],['relay_context','record'],['relay_night_shift','shift']])assert.equal(presentationOperation(tool,{action}).kind,'command');
  assert.equal(presentationOperation('relay_ui_request',{method:'GET'}).kind,'query');
  assert.equal(presentationOperation('relay_ui_request',{method:'POST'}).kind,'command');
  assert.equal(presentationOperation('a_read_sounding_unregistered_tool').kind,'unknown');
});

test('quota deadline is eligibility only, with conservative invalid or stale reset handling',()=>{
  const data={ok:false,error:{class:'rate_limit',retry_at:'2026-10-07T12:00:00Z',upstream:{provider:'github'}}};
  const input=normalizeCommunicationResult(data,{operation:{kind:'command',name:'relay_source_edit_text'},now:'2026-10-07T11:00:00Z'});
  assert.equal(input.retry.policy,'after_provider_window');assert.equal(input.retry.scheduled_at,null);
  const out=formatRelay(input,{timeZone:'UTC'});
  assert.match(out.summary,/resume after/);assert.doesNotMatch(out.summary,/will retry|sign in|refresh tools/i);assert.equal(out.action,undefined);
  for(const retry_at of ['not a timestamp','2026-10-07T10:00:00Z']){
    const out=present({...data,error:{...data.error,retry_at}},undefined,{now:'2026-10-07T11:00:00Z'});
    assert.match(out.summary,/hasn't provided a current retry time/);assert.doesNotMatch(out.summary,/resume after/);
  }
});

test('unknown mutation and upload before a manifest never promise retained bytes or safe replay',()=>{
  for(const kind of ['command','unknown']){
    const data={ok:false,error:{class:'timeout',message:'private backend diagnostic'}};
    const input=normalizeCommunicationResult(data,{operation:{kind,name:'relay_execution'}});
    assert.equal(input.mutation,'unknown');assert.equal(input.retry.policy,'read_first');
    assert.equal(formatRelay(input).message_id,'error.uncertain_write');assert.match(formatRelay(input).next_step,/Check.*status/);
  }
  const upload=present({ok:false,error:{class:'provider'}},{kind:'command',name:'relay_transfer_write'});
  assert.equal(upload.message_id,'file.upload_unknown');assert.doesNotMatch(upload.summary,/saved parts|retained|resume the saved/i);
});

test('failure, partial coverage and stale observations take precedence over a merged milestone',()=>{
  const merged={pull_request:{merged:true,number:9,title:'Useful change'}};
  const next_action={code:'verify_release',actor:'relay',availability:'unavailable'};
  assert.match(present({...merged,next_action}).next_step,/live checks/);
  assert.equal(present({...merged,ok:false,error:{class:'permission'}}).message_id,'error.permission');
  assert.equal(present({...merged,partial:true}).message_id,'data.partial');
  assert.equal(present({...merged,state:'officially-stale'}).message_id,'progress.stale');
  for(const [conclusion,id] of [['failure','release.check_failed'],['cancelled','release.check_cancelled'],['skipped','release.check_skipped'],['neutral','release.check_neutral']])assert.equal(present({...merged,check_runs:[{status:'completed',conclusion}]}).message_id,id);
  assert.equal(present({check_runs:[]}).message_id,'release.checks_unverified');
  assert.equal(present({check_runs:[{status:'completed',conclusion:'success'}]}).severity,'neutral');
});

test('additive metadata leaves the machine result intact and excludes raw error content',()=>{
  const legacy={ok:false,error:{class:'permission',message:'Bearer forbidden-secret; https://example.test/file?token=forbidden-secret',upstream:{provider:'github',private_token:'forbidden-secret'}}};
  const frozen=JSON.parse(JSON.stringify(legacy));const result=withHumanPresentation(legacy,{operation:{kind:'command',name:'relay_source_edit_text'}});
  const {human_v1,presentation_mode,...rest}=result;assert.equal(presentation_mode,'human_v1');assert.deepEqual(rest,frozen);assert.deepEqual(legacy,frozen);
  assert.doesNotMatch(JSON.stringify(human_v1),/forbidden-secret|private_token|example.test|Bearer/);
  assert.equal(human_v1.message_id,'error.permission');
  assert.equal(safePresentationText('hello\u202eevil Bearer abc123'),'hello evil [redacted]');
  for(const data of [null,[],{claims:{},check_runs:[null],human_v1:{summary:'bad'}},{error:{upstream:{rate_limit_reset:Number.MAX_SAFE_INTEGER}}}])assert.doesNotThrow(()=>present(data));
});

test('presentation rollback changes only additive fields, without altering machine facts',()=>{
  const data={ok:false,error:{class:'permission',message:'Exact legacy error'}};
  const out=withHumanPresentation(data,{mode:'legacy'});
  assert.deepEqual(out,{...data,presentation_mode:'legacy'});assert.equal(out.human_v1,undefined);
});

test("human-first result preserves exact evidence underneath",()=>{
  const shaped=shapeToolResult({branch:"relay/x",head_sha:"a".repeat(40)},{
    health:"healthy",
    outcome:"the verification pass is complete",
    staff_id:"roman",
    next_step:"continue the release",
    needs_user:false
  });
  assert.equal(shaped.human.responsible_staff.display_name,"Roman");
  assert.equal(shaped.technical_evidence.tool_result.head_sha,"a".repeat(40));
  const text=renderHumanFirst(shaped);
  assert.match(text,/Roman/);
  assert.doesNotMatch(text,/relay\/x/);
  assert.doesNotMatch(text,/aaaaaaaaaa/);
});

test("QA-critical identity stays in human layer while unrelated machine detail stays subordinate",()=>{
  const shaped=shapeCommunicationResult({
    health:"waiting",
    outcome:"the preview is ready",
    staff_id:"margot",
    next_step:"review the preview",
    needs_user:true,
    qa:{
      surface:"Today card",
      intended_result:"pulse reads clearly",
      evidence_identity:"preview 123",
      checks:["pulse is visible","labels are lowercase"]
    },
    technical_evidence:{head_sha:"b".repeat(40)}
  });
  const text=renderHumanFirst(shaped);
  assert.match(text,/preview 123/);
  assert.doesNotMatch(text,/bbbbbbbbbb/);
});

test("communication eval fixtures stay plain-language staff-aware and preserve blockers",async()=>{
  const raw=await readFile(new URL("../test/communication-evals/fixtures.json",import.meta.url),"utf8");
  const fixtures=JSON.parse(raw);
  for(const item of fixtures){
    const shaped=shapeCommunicationResult({...item.human,technical_evidence:item.technical_evidence});
    const rendered=renderHumanFirst(shaped);
    const lower=rendered.toLowerCase();
    for(const expected of item.expect.contains) assert.equal(lower.includes(expected.toLowerCase()),true,item.name+" missing "+expected);
    for(const hidden of item.expect.omits) assert.equal(rendered.includes(hidden),false,item.name+" leaked technical detail");
    assert.deepEqual(shaped.technical_evidence,item.technical_evidence,item.name+" lost technical evidence");
  }
});

test('canonical assignment team drives human narration above optional presentation hints',()=>{
  const result=shapeToolResult({claim:{primary_staff:'julian',supporting_staff:['roman'],owner:'machine-worker'},head_sha:'a'.repeat(40)},{outcome:'the release can proceed',staff_id:'nico'});
  assert.match(renderHumanFirst(result),/^Julian with Roman/);
  assert.equal(result.technical_evidence.tool_result.claim.owner,'machine-worker');
});

test('human_v1 schema and surface manifest match the implemented catalog without claiming full migration',async()=>{
  const schema=JSON.parse(await readFile(new URL('../contracts/presentation/human-v1.schema.json',import.meta.url),'utf8'));
  const manifest=JSON.parse(await readFile(new URL('../contracts/human-output-surfaces.json',import.meta.url),'utf8'));
  assert.deepEqual(schema.properties.message_id.enum,Object.keys(HUMAN_CATALOG));
  assert.deepEqual(schema.$defs.input.properties.message_id.enum,Object.keys(HUMAN_CATALOG));
  assert.equal(schema.$defs.input.properties.params.additionalProperties,false);
  assert.ok(manifest.surfaces.some(item=>item.surface==='website'&&item.status==='migration-pending'));
  for(const message_id of Object.keys(HUMAN_CATALOG)){
    const out=formatRelay({...normalizeCommunicationResult(),message_id});
    for(const key of schema.required)assert.ok(Object.hasOwn(out,key),message_id+' lacks '+key);
    assert.deepEqual(Object.keys(out).filter(key=>!Object.hasOwn(schema.properties,key)),[]);
  }
});

test('normal progress uses a typed last update or avoids repeating the status when a next step exists',()=>{
  const data={claim:{state:'working',next_action:'Check the card in the browser',latest_event:{type:'source-commit',at:'2026-10-07T10:00:00Z'}}};
  assert.equal(present(data).summary,'A source change was recorded.');
  assert.equal(present({...data,claim:{...data.claim,latest_event:undefined}}).summary,'');
  assert.equal(present({state:'constructor'}).message_id,'data.unrecognized');
  assert.equal(present({ok:false,error:{class:'constructor'}}).message_id,'error.unknown_read');
  const input={...normalizeCommunicationResult({state:'working'}),technical:{service:'constructor'},evidence:{latest_event:{type:'constructor'}}};
  assert.equal(typeof formatRelay(input).summary,'string');
});

test('quota times use the supplied display timezone without changing eligibility',()=>{
  const input=normalizeCommunicationResult({ok:false,error:{class:'rate_limit',retry_at:'2026-10-07T11:00:00Z'}},{operation:{kind:'query',name:'relay_source_checks'}});
  const utc=formatRelay(input,{timeZone:'UTC'}),tokyo=formatRelay(input,{timeZone:'Asia/Tokyo'});
  assert.notEqual(utc.summary,tokyo.summary);assert.deepEqual(utc.details,tokyo.details);
  assert.equal(input.retry.not_before,'2026-10-07T11:00:00.000Z');
});
