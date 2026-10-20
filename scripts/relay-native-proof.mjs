import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {continuityObjectiveDigest,expansionDigest} from '../packages/runner/src/continuity-expansion.mjs';

export const proofDirectory='test/fixtures/native-continuity-live/';
export function nativeProofConfig(assignment){
 const verify=mode=>[process.execPath,'scripts/relay-native-proof.mjs','verify',mode],input='scripts/relay-native-proof.mjs';
 return {project:'relay',assignment:assignment.id,owner:assignment.owner,branch:assignment.branch,provider:'codex',executor_id:'native-current-task',continuity:{schema:1,completion_scope:'subobjective',authorization:'User-authorized bounded non-production native continuation acceptance proof; no merge, deploy, external model or unrelated assignment execution in this subtask.',objective_digest:continuityObjectiveDigest(assignment.goal,assignment.acceptance),criteria:['native-fixture-a','native-fixture-b'],environment:{fixture_contract:'native-continuity-v1',node:process.version},stages:[
  {id:'a',kind:'implementation',criteria:['native-fixture-a'],depends_on:[],prompt:'Create '+proofDirectory+'a.json containing {"seed":7}. Discover and report the supporting validation feature returned by nativeProofProposal. Use existing native tools; do not run an external coding model.',inputs:[input,proofDirectory+'a.json'],verify:verify('a')},
  {id:'b',kind:'review',criteria:['native-fixture-b'],depends_on:['a'],prompt:'Read the actual fixture A and admitted supporting output, then create '+proofDirectory+'b.json containing their sum. Never hard-code a passing verifier or claim product deployment.',inputs:[input,proofDirectory],verify:verify('b')}
 ],expansion:{enabled:true,authorization:'Add the directly related fixture validation supporting feature while preserving the native bridge goal; no new authority or services.',original_goal:assignment.goal,allowed_paths:[proofDirectory],profiles:{'fixture-support':{kind:'test',inputs:[input,proofDirectory+'a.json',proofDirectory+'support.json'],verify:verify('support')}}}}};
}
export function nativeProofProposal(goal){return {id:'native-fixture-validation',goal_digest:expansionDigest(goal),kind:'strengthens',reason:'Exercise actual discovered supporting work, not just the original two stages',relationship:'Strengthens native-fixture-a by validating its actual seed and makes native-fixture-b consume the admitted validated value, preserving the assigned native bridge goal',supports:['native-fixture-a'],target_stage:'a',depends_on:['a'],acceptance:['Supporting output validates actual integer seed7 and records exactly twice its value; invalid seed or inconsistent output fails verification'],profile:'fixture-support',paths:[proofDirectory+'support.json'],description:'Read actual a.json, validate its seed is integer7, then write support.json with the doubled value14. This is non-production fixture work only.'};}
export async function verifyNativeProof(mode,root=process.cwd()){
 const read=async name=>{const p=path.join(root,proofDirectory,name+'.json'),st=await fs.lstat(p);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=1024);return JSON.parse(await fs.readFile(p,'utf8'));};
 const a=await read('a');assert.equal(Number.isInteger(a.seed),true);assert.equal(a.seed,7);
 if(mode==='a')return {criterion:'native-fixture-a',seed:a.seed};
 const support=await read('support');assert.equal(support.validated_seed,a.seed);assert.equal(support.doubled,a.seed*2);
 if(mode==='support')return {criterion:'admitted-supporting-validation',validated_seed:support.validated_seed,doubled:support.doubled};
 assert.equal(mode,'b');const b=await read('b');assert.equal(b.sum,a.seed+support.doubled);return {criterion:'native-fixture-b',sum:b.sum};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [action,arg]=process.argv.slice(2);
 if(action==='verify')console.log(JSON.stringify(await verifyNativeProof(arg)));
 else if(action==='config')console.log(JSON.stringify(nativeProofConfig(JSON.parse(await fs.readFile(arg,'utf8'))),null,2));
 else if(action==='proposal')console.log(JSON.stringify(nativeProofProposal(JSON.parse(await fs.readFile(arg,'utf8')).goal),null,2));
 else throw Error('Use verify a|support|b; config ASSIGNMENT_JSON; proposal ASSIGNMENT_JSON');
}
