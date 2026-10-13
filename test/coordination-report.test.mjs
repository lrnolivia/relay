import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {coordinationOutcome} from '../scripts/coordination-report.mjs';

test('cleanup retains every finding without misreporting operation failure',()=>{
 const findings=[{type:'expired',assignment:'held-work'},{type:'missing_branch',assignment:'held-work'},{type:'scope_drift',paths:['source.ts']},{type:'post_merge_commits',branch:'field/work'}];
 const input={project:'field',findings,deleted:[]};const out=coordinationOutcome('cleanup',input);
 assert.equal(out.exitCode,0);assert.equal(out.report.cleanup_status,'completed');assert.equal(out.report.coordination_status,'needs_reconciliation');
 assert.deepEqual(out.report.findings,findings);assert.deepEqual(input,{project:'field',findings,deleted:[]});
 assert.equal(coordinationOutcome('audit',input).exitCode,2,'audit still blocks on findings');
 assert.equal(coordinationOutcome('cleanup',{findings:[],deleted:['field/done']}).report.coordination_status,'clear');
 assert.throws(()=>coordinationOutcome('pr-gate',input));
});

test('actual cleanup CLI keeps held work and preserves failures and preflight gates',()=>{
 const dir=mkdtempSync(join(tmpdir(),'relay-coord-test-'));
 try{
 const registration={repository:'fixture/field',default_branch:'main',coordination:{max_active_branches:4,lease_hours:12},implementation:{branch_prefixes:['field/'],excluded_branches:['main']}};
 const record={schema:1,project:'field',legacy_branches:[],queue:[],claims:[{id:'held-work',owner:'fixture-owner',branch:'field/held',state:'held',paths:['source.ts'],resources:[],created_at:'2019-01-01T00:00:00Z',lease_until:'2020-01-01T00:00:00Z'}]};
 const script=`#!/usr/bin/env node\nconst endpoint=process.argv[3];const method=process.argv[process.argv.indexOf('--method')+1];if(method!=='GET'){console.error('Unexpected mutation');process.exit(91)};if(process.env.FAIL_INVENTORY==='yes'&&endpoint.includes('/branches')){console.error('Fixture provider unavailable');process.exit(1)};let value;if(endpoint.includes('/contents/projects/'))value={type:'file',encoding:'base64',sha:'a'.repeat(40),content:Buffer.from(JSON.stringify(${JSON.stringify(registration)})).toString('base64')};else if(endpoint.includes('/contents/coordination/'))value={type:'file',encoding:'base64',sha:'b'.repeat(40),content:Buffer.from(JSON.stringify(${JSON.stringify(record)})).toString('base64')};else if(endpoint.includes('/branches')||endpoint.includes('/pulls?'))value=[];else{console.error('Unexpected endpoint '+endpoint);process.exit(92)};console.log(JSON.stringify(value));\n`;
 const gh=join(dir,'gh');writeFileSync(gh,script);chmodSync(gh,0o755);
 const run=(action,extra={})=>spawnSync(process.execPath,[resolve('scripts/coordinate.mjs'),action,'field',join(dir,'request.json')],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,GH_TOKEN:'fixture',RELAY_RUNNER_CONTROL_REPOSITORY:'fixture/relay',...extra}});
 writeFileSync(join(dir,'request.json'),JSON.stringify({id:'held-work',owner:'fixture-owner',paths:['source.ts']}));
 const cleanup=run('cleanup');assert.equal(cleanup.status,0,cleanup.stderr);const receipt=JSON.parse(cleanup.stdout);
 assert.equal(receipt.coordination_status,'needs_reconciliation');assert.deepEqual(receipt.deleted,[]);assert.ok(receipt.findings.some(x=>x.type==='expired'));assert.ok(receipt.findings.some(x=>x.type==='missing_branch'));
 assert.equal(run('audit').status,2);assert.notEqual(run('preflight').status,0);assert.notEqual(run('cleanup',{FAIL_INVENTORY:'yes'}).status,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
