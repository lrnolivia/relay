// One-time migration ledger: canonical CAS, exact merged-B6 proof, no ownership release.
import { execFileSync } from 'node:child_process';
const repository = 'lrnolivia/relay';
function api(path, method='GET', body) {
 const args=['api',path,'--method',method]; if(body) args.push('--input','-');
 return JSON.parse(execFileSync('gh',args,{encoding:'utf8',input:body?JSON.stringify(body):undefined,stdio:['pipe','pipe','pipe']}));
}
const number=Number(process.argv[2]); if(!Number.isInteger(number)||number<1) throw Error('Merged B6 PR number required');
const pr=api(`repos/${repository}/pulls/${number}`);
if(!pr.merged || pr.base.repo.full_name!==repository || pr.base.ref!=='main' || pr.head.ref!=='relay/consolidation-b6-retirement') throw Error('Exact merged retirement PR required');
const path='coordination/relay.json';const snapshot=api(`repos/${repository}/contents/${path}?ref=main`);
const record=JSON.parse(Buffer.from(snapshot.content,'base64'));
const claim=record.claims.find(c=>c.id==='relay-consolidation-b6-retirement-20260930');
if(!claim || claim.owner!==claim.id || claim.branch!==pr.head.ref) throw Error('Retirement owner/branch mismatch');
const ownerProof=record.claims.map(c=>[c.id,c.owner,c.branch]);
let changed=false;
for(const q of record.queue) {
 const completed=record.claims.find(c=>c.id===q.id && c.state==='completed' && c.work_accounted && c.merge_commit_sha);
 if(completed && q.state!=='completed') {Object.assign(q,{state:'completed',merge_commit_sha:completed.merge_commit_sha,completed_by:completed.owner});changed=true;}
 if(q.id==='inspector-visual-review-web-20260930' && q.state==='queued') {Object.assign(q,{state:'superseded',superseded_by:claim.id,reason:'Shared Relay Review shipped in B4; standalone Inspector product retired in B6.',merge_commit_sha:pr.merge_commit_sha});changed=true;}
}
const program=record.claims.find(c=>c.id==='relay-monorepo-consolidation-20260930');
if(program && program.delivery?.merge_commit_sha!==pr.merge_commit_sha) {program.delivery={state:'delivered',assignment:claim.id,pr:number,merge_commit_sha:pr.merge_commit_sha,note:'All six consolidation batches delivered; original ownership and branch retained.'};changed=true;}
if(!changed) {console.log(JSON.stringify({ok:true,unchanged:true,merge_commit_sha:pr.merge_commit_sha}));process.exit(0);}
record.updated_at=new Date().toISOString();
const result=api(`repos/${repository}/contents/${path}`,'PUT',{branch:'main',sha:snapshot.sha,message:'coordination: reconcile exact merged Relay retirement',content:Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64')});
const check=api(`repos/${repository}/contents/${path}?ref=main`);const value=JSON.parse(Buffer.from(check.content,'base64'));
if(JSON.stringify(value.claims.map(c=>[c.id,c.owner,c.branch]))!==JSON.stringify(ownerProof) || value.queue.find(q=>q.id==='inspector-visual-review-web-20260930')?.state!=='superseded') throw Error('Readback failed; refresh, never blindly replay');
console.log(JSON.stringify({ok:true,record_sha:check.sha,commit_sha:result.commit.sha,merge_commit_sha:pr.merge_commit_sha,ownership_preserved:true},null,2));
