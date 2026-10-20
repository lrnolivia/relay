import {createHash} from 'node:crypto';
import {githubApiRequest} from './source.js';
import {readRunnerJsonFile, runnerControlBase} from './runner-control-core.js';
import {stripToolCoauthors} from './commit-attribution.js';

export const AI_CLEANUP_VERSION = '1.0.0';
export const AI_CLEANUP_LIMITS = Object.freeze({files:64, file_bytes:65536, total_bytes:131072, tree_entries:4096, findings:256, output_bytes:786432});
const SHA = /^[a-f0-9]{40}$/;
const hex = (bytes, algorithm='sha256') => createHash(algorithm).update(bytes).digest('hex');
export const cleanupBlobSha = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
const digest = value => hex(JSON.stringify(stable(value)));
const fail = (code,message) => {throw Object.assign(Error(message),{code});};
const reference = /\b(?:AI|Codex|Claude|ChatGPT|OpenAI|Anthropic|LLM)\b/i;
const legalText = /SPDX-License-Identifier|Copyright\s+(?:\(c\)|©|\d{4})|Permission is hereby granted|All rights reserved|Licensed under/i;
const sensitive = /(?:api[_ -]?key|(?:access[_ -]?)?token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_+\/-]{12,}/i;
const generated = /DO NOT EDIT|auto[- ]generated|generated file/i;
const markdown = /\.(?:md|markdown|txt|rst)$/i;
const code = /\.(?:js|mjs|cjs|jsx|ts|tsx|css|scss|py|sh|bash)$/i;

export function cleanupPath(path) {
  if (typeof path!=='string' || path.length<1 || path.length>240 || !/^[A-Za-z0-9_.\/-]+$/.test(path) || path.startsWith('/') || path.split('/').some(p=>!p||p==='.'||p==='..')) fail('validation','Use bounded literal repository file paths; no traversal or globbing');
  if (/(^|\/)(?:\.git|\.aws|\.ssh|\.env(?:\.[^/]*)?|credentials|secrets|id_rsa)(\/|$)/i.test(path)) fail('permission','Credential/configuration paths are outside AI Cleanup');
  return path;
}

export function cleanupPathKind(path, project) {
  if (/(^|\/)(?:LICENSE[^/]*|COPYING[^/]*|NOTICE[^/]*|AUTHORS[^/]*|CREDITS[^/]*|CONTRIBUTORS[^/]*|ACKNOWLEDG[^/]*|THIRD[-_]PARTY[^/]*)(\/|$)/i.test(path)) return 'mandatory_notice';
  if (/(^|\/)(?:package(?:-lock)?\.json|[^/]*\.lock|requirements[^/]*\.txt|pyproject\.toml|Cargo\.toml|go\.(?:mod|sum)|wrangler[^/]*|\.node-version|[^/]*config\.[^/]+)$/i.test(path) || /^(?:\.github\/|\.claude\/|\.codex\/)/.test(path)) return 'build_or_tool_configuration';
  if (/(^|\/)(?:AGENTS\.md|CLAUDE\.md|SKILL\.md)$/i.test(path) || /^\.agents\//.test(path)) return 'agent_guidance';
  if (project==='relay' && /^(?:docs\/|assignments\/|coordination\/|reports\/)/.test(path)) return 'canonical_development_record';
  if (/\.(?:png|jpe?g|webp|gif|ico|pdf|zip|woff2?|mp[34]|wasm|exe|dylib|so)$/i.test(path)) return 'binary_asset';
  if (markdown.test(path) && (/(^|\/)(?:HANDOFF|DEV[-_]NOTES|DEVELOPMENT|AGENT[-_]NOTES|SESSION[-_]NOTES|WORKLOG|TODO)(?:[_.-]|$)/i.test(path) || /^(?:notes|handoffs|qa-evidence|docs\/(?:development|handoffs|operations))\//i.test(path))) return 'misplaced_development_record';
  return code.test(path) ? 'source' : markdown.test(path) ? 'technical_document' : 'other';
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schema!==1 || !/^[a-z0-9-]{1,64}$/.test(snapshot.project||'') || !/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(snapshot.repository||'') || !SHA.test(snapshot.head_sha||'') || !SHA.test(snapshot.tree_sha||'') || !SHA.test(snapshot.policy_sha||'') || snapshot.complete!==true || !Array.isArray(snapshot.scope) || !snapshot.scope.length || snapshot.scope.length>AI_CLEANUP_LIMITS.files || !Array.isArray(snapshot.files) || snapshot.files.length!==snapshot.scope.length) fail('validation','A complete bounded project/source/policy snapshot is required');
  if (new Set(snapshot.scope).size!==snapshot.scope.length) fail('validation','Duplicate scope paths');
  const scope=[...snapshot.scope].map(cleanupPath).sort(),files=[...snapshot.files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if (scope.some((path,i)=>path!==files[i]?.path)) fail('validation','Snapshot must contain every declared path exactly once');
  let total=0;
  for (const file of files) {
    cleanupPath(file.path);
    if (!SHA.test(file.blob_sha||'') || !['100644','100755','120000','160000'].includes(file.mode)) fail('validation','Invalid file object identity or mode');
    if (file.excluded===true) {
      if (!['binary_asset','mandatory_notice','build_or_tool_configuration'].includes(cleanupPathKind(file.path,snapshot.project))) fail('validation','Unexplained content exclusion');
      continue;
    }
    if (!['100644','100755'].includes(file.mode)) continue;
    if (typeof file.content!=='string') fail('validation','Missing source bytes');
    const bytes=Buffer.from(file.content,'utf8'); total+=bytes.length;
    if (bytes.length>AI_CLEANUP_LIMITS.file_bytes || total>AI_CLEANUP_LIMITS.total_bytes) fail('capacity','AI Cleanup text window exceeded; choose a smaller explicit scope');
    if (cleanupBlobSha(bytes)!==file.blob_sha) fail('conflict','Source bytes do not match their Git blob identity');
  }
  return {scope,files};
}

function creditLine(line, isMarkdown) {
  const text=line.replace(/\r?\n$/,'');
  if (/^Co-authored-by\s*:/i.test(text) && isMarkdown && stripToolCoauthors(text).trim()!==text.trim()) return 'tool_coauthor';
  let payload;
  if (isMarkdown && !/^\s/.test(text)) payload=text;
  if (!isMarkdown && /^\s*(?:\/\/|#)\s*/.test(text)) payload=text.replace(/^\s*(?:\/\/|#)\s*/,'');
  const wrapped=isMarkdown?text.match(/^\s*<!--\s*(.*?)\s*-->\s*$/):text.match(/^\s*\/\*\s*(.*?)\s*\*\/\s*$/);
  if (wrapped) payload=wrapped[1];
  return typeof payload==='string' && /^(?:🤖\s*)?Generated (?:with|by) (?:Claude Code|Codex|ChatGPT)\.?\s*$/i.test(payload) ? 'standalone_tool_credit' : null;
}

// Only prologue comments in source files are removable. After the first code
// token, strings/templates/regexes and technical comments remain untouched.
function candidates(file) {
  const lines=file.content.match(/[^\n]*\n|[^\n]+$/g)||[],found=[];
  const isMarkdown=markdown.test(file.path); let prologue=true,block=false,fence=null,frontmatter=null,html=null,inlineTicks=null;
  for(let i=0;i<lines.length;i++) {
    const text=lines[i].replace(/\r?\n$/,'');
    if (isMarkdown) {
      if(i===0&&['---','+++'].includes(text.trim())){frontmatter=text.trim();continue;}
      if(frontmatter){if(text.trim()===frontmatter)frontmatter=null;continue;}
      if(html){if(text.toLowerCase().includes(html))html=null;continue;}
      const marker=text.match(/^\s{0,3}(`{3,}|~{3,})/);
      if(marker){if(!fence)fence={char:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.char&&marker[1].length>=fence.length)fence=null;continue;}
      if(fence || /^\s{4}|^\s*>/.test(text)) continue;
      const inlineBefore=inlineTicks;
      for(const ticks of text.match(/(?<!\\)`{1,2}(?!`)/g)||[]){if(inlineTicks===null)inlineTicks=ticks.length;else if(inlineTicks===ticks.length)inlineTicks=null;}
      if(inlineBefore!==null||inlineTicks!==null)continue;
      if(/^\s*<!--/.test(text)&&!text.includes('-->')){html='-->';continue;}
      if(/^\s*<!\[CDATA\[/.test(text)){if(!text.includes(']]>'))html=']]>';continue;}
      if(/^\s*<\?/.test(text)){if(!text.includes('?>'))html='?>';continue;}
      const tag=text.match(/^\s*<([A-Za-z][A-Za-z0-9:-]*)\b/);
      if(tag){const close='</'+tag[1].toLowerCase()+'>';if(!text.toLowerCase().includes(close)&&!text.trim().endsWith('/>'))html=close;continue;}
    } else {
      if(!prologue) continue;
      if(block){if(text.includes('*/')){block=false;if(text.slice(text.indexOf('*/')+2).trim())prologue=false;}continue;}
      if(/^\s*\/\*/.test(text)&&!text.includes('*/')){block=true;continue;}
      if(text.trim() && !/^\s*(?:\/\/|#|\/\*.*\*\/\s*$)/.test(text)){prologue=false;continue;}
      if(/^\s*#!/.test(text)) continue;
    }
    const rule=creditLine(lines[i],isMarkdown);
    if(rule)found.push({line:i+1,rule});
  }
  return found;
}

export function scanAiCleanup(snapshot) {
  const {scope,files}=validateSnapshot(snapshot),findings=[],inventory=[];
  const add=(file,category,disposition,reason,line=0)=>{
    if(findings.length>=AI_CLEANUP_LIMITS.findings)fail('capacity','Too many findings for a bounded report; narrow the explicit scope');
    findings.push({id:digest({path:file.path,blob:file.blob_sha,category,line}).slice(0,24),path:file.path,blob_sha:file.blob_sha,line,category,disposition,reason});
  };
  for(const file of files) {
    const kind=cleanupPathKind(file.path,snapshot.project); inventory.push({path:file.path,blob_sha:file.blob_sha,mode:file.mode,kind,content_inspected:file.excluded!==true&&['100644','100755'].includes(file.mode)});
    if(!['100644','100755'].includes(file.mode)){add(file,'non_regular_source','preserve','Symlinks and submodules are never followed or edited');continue;}
    if(file.excluded===true || ['mandatory_notice','build_or_tool_configuration','binary_asset'].includes(kind)){add(file,kind,'preserve','Mandatory notice, asset or build/tool configuration is protected');continue;}
    if(file.content.includes('\0')){add(file,'binary_content','preserve','Binary content is outside text cleanup');continue;}
    if(legalText.test(file.content)){add(file,'legal_or_human_notice','preserve','Content includes a legal notice; credit removal requires manual review');continue;}
    if(generated.test(file.content)){add(file,'generated_provenance','preserve','Generator/DO NOT EDIT provenance may be required by the build');continue;}
    if(kind==='canonical_development_record'){add(file,kind,'preserve','Relay is already the canonical documentation home');continue;}
    if(kind==='agent_guidance'){add(file,kind,'review_only','Agent guidance may be required bootstrap; review a migration and retained pointer');continue;}
    if(kind==='misplaced_development_record'){add(file,kind,'migration_proposal','Propose a lossless copy to Relay docs; leave this source intact until migration is verified');continue;}
    const removals=['source','technical_document'].includes(kind)?candidates(file):[];
    for(const item of removals)add(file,item.rule,'patch_candidate','Exact standalone development credit; only this line can be removed after selection',item.line);
    if(reference.test(file.content))add(file,'product_or_technical_reference','preserve','AI/tool words may be product features, API/model integration, examples or useful technical comments');
    if(!removals.length&&!reference.test(file.content))add(file,'no_recognized_residue','preserve','No recognized removable residue in this declared file');
  }
  const report={schema:1,tool:'AI Cleanup',policy_version:AI_CLEANUP_VERSION,project:snapshot.project,repository:snapshot.repository,branch:snapshot.branch||null,head_sha:snapshot.head_sha,tree_sha:snapshot.tree_sha,policy_sha:snapshot.policy_sha,scope,coverage:'declared-files-only; protected exclusions are not content-scanned',complete:true,inventory,findings};
  return {...report,report_sha256:digest(report)};
}

function removalDiff(path,before,removed) {
  const lines=before.match(/[^\n]*\n|[^\n]+$/g)||[];
  const ranges=[];
  for(const line of [...removed].sort((a,b)=>a-b)){const a=Math.max(0,line-3),b=Math.min(lines.length,line+4),previous=ranges.at(-1);if(previous&&a<=previous[1])previous[1]=Math.max(previous[1],b);else ranges.push([a,b]);}
  const outputLine=(prefix,line)=>prefix+line+(line.endsWith('\n')?'':'\n\\ No newline at end of file\n');
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n`+ranges.map(([start,end])=>{
    const deletedBefore=[...removed].filter(i=>i<start).length,deleted=[...removed].filter(i=>i>=start&&i<end).length,newCount=end-start-deleted;
    const newStart=newCount?start+1-deletedBefore:start-deletedBefore;
    return `@@ -${start+1},${end-start} +${newStart},${newCount} @@\n`+lines.slice(start,end).map((line,i)=>outputLine(removed.has(start+i)?'-':' ',line)).join('');
  }).join('');
}

export function prepareAiCleanup(snapshot,{expected_report_sha256,selected_findings}) {
  const report=scanAiCleanup(snapshot);
  if(report.report_sha256!==expected_report_sha256)fail('conflict','Scan report/source/policy identity changed; rescan before patch preparation');
  if(!Array.isArray(selected_findings)||!selected_findings.length||selected_findings.length>64||new Set(selected_findings).size!==selected_findings.length)fail('validation','Select a bounded unique list of findings from the exact scan');
  const chosen=selected_findings.map(id=>report.findings.find(f=>f.id===id));
  if(chosen.some(f=>!f||!['patch_candidate','migration_proposal'].includes(f.disposition)))fail('permission','Unknown, protected or ambiguous finding cannot produce a patch');
  const files=[],migrations=[];
  for(const path of [...new Set(chosen.map(f=>f.path))].sort()) {
    const source=snapshot.files.find(f=>f.path===path),bytes=Buffer.from(source.content,'utf8');
    if(sensitive.test(source.content))fail('permission','Potential sensitive content requires manual review; no source-byte export was prepared');
    const items=chosen.filter(f=>f.path===path);
    if(items.some(f=>f.disposition==='migration_proposal')){
      migrations.push({source_path:path,source_blob_sha:source.blob_sha,source_sha256:hex(bytes),mode:source.mode,destination_repository:'lrnolivia/relay',destination_path:`docs/${snapshot.project}/${path}`,content_base64:bytes.toString('base64'),source_removal_allowed:false,requires:'Verified external copy and reviewed caller/reference updates before a separate source removal'});continue;
    }
    const removed=new Set(items.map(f=>f.line-1)),lines=source.content.match(/[^\n]*\n|[^\n]+$/g)||[];
    const after=lines.filter((_,i)=>!removed.has(i)).join(''),next=Buffer.from(after,'utf8');
    files.push({path,mode:source.mode,expected_blob_sha:source.blob_sha,before_sha256:hex(bytes),after_sha256:hex(next),after_blob_sha:cleanupBlobSha(next),before_base64:bytes.toString('base64'),after_base64:next.toString('base64'),removed_lines:items.map(f=>f.line).sort((a,b)=>a-b),patch:removalDiff(path,source.content,removed)});
  }
  // Reverse application uses git apply -R on the exact reviewed patch; the full
  // before bytes/hashes are also retained. Nothing modifies a repository here.
  const patch=files.map(f=>f.patch).join('');
  const plan={schema:1,tool:'AI Cleanup',policy_version:AI_CLEANUP_VERSION,project:report.project,repository:report.repository,branch:report.branch,head_sha:report.head_sha,tree_sha:report.tree_sha,policy_sha:report.policy_sha,report_sha256:report.report_sha256,scope:report.scope,selected_findings:[...selected_findings].sort(),state:'review_required',applied:false,files,migrations,patch,rollback:{method:'git apply -R after exact-after checks, or retained original bytes',before_source_sha:report.head_sha},limitations:['No history rewrite, source deletion, external-doc publication, commit or credential change','Migration source stays intact; external migration verification is a separate gate']};
  if(Buffer.byteLength(JSON.stringify(plan))>AI_CLEANUP_LIMITS.output_bytes)fail('capacity','Review artifact exceeds the bounded output window');
  return {...plan,plan_sha256:digest(plan)};
}

export function verifyAiCleanupPlan(snapshot,plan) {
  if(!plan||typeof plan!=='object')fail('validation','A complete review plan is required');
  const expected=prepareAiCleanup(snapshot,{expected_report_sha256:plan.report_sha256,selected_findings:plan.selected_findings});
  const {plan_sha256,...body}=plan;
  if(plan_sha256!==expected.plan_sha256||digest(body)!==plan_sha256)fail('conflict','Review plan contents differ from the exact recomputed source-bound proposal');
  return expected;
}

export function validateAiCleanupArguments(args) {
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!['action','project','branch','expected_head_sha','paths','expected_report_sha256','selected_findings'].includes(k)))fail('validation','Unsupported AI Cleanup argument');
  if(!['scan','prepare_patch'].includes(args.action)||!/^[a-z0-9-]{1,64}$/.test(args.project||'')||!SHA.test(args.expected_head_sha||'')||!Array.isArray(args.paths)||!args.paths.length||args.paths.length>AI_CLEANUP_LIMITS.files||new Set(args.paths).size!==args.paths.length)fail('validation','Explicit project, exact head and bounded unique file scope are required');
  args.paths.forEach(cleanupPath);
  if(args.branch!==undefined&&(!/^[A-Za-z0-9_.\/-]{1,240}$/.test(args.branch)||args.branch.includes('..')||args.branch.startsWith('/')||args.branch.endsWith('/')||args.branch.endsWith('.lock')))fail('validation','Invalid source branch');
  if(args.action==='scan'&&(args.expected_report_sha256!==undefined||args.selected_findings!==undefined))fail('validation','Scan does not accept patch selections');
  if(args.action==='prepare_patch'&&(!/^[a-f0-9]{64}$/.test(args.expected_report_sha256||'')||!Array.isArray(args.selected_findings)||!args.selected_findings.length||args.selected_findings.length>64||new Set(args.selected_findings).size!==args.selected_findings.length||args.selected_findings.some(id=>!/^[a-f0-9]{24}$/.test(id))))fail('validation','Patch preparation requires the exact scan digest and explicit finding IDs');
  return args;
}

export const aiCleanupTool = Object.freeze({
  name:'relay_ai_cleanup',title:'AI Cleanup',description:'READ-ONLY SCAN / PATCH PREPARATION — inventory explicit files in a registered project at an exact head; distinguish development residue from product AI, preserve legal/human credits and dependencies, and emit a reviewable patch with lossless migration/rollback bytes. No source edits or history changes. Rescan stale/incomplete input; migration requires verified external copy before later source removal.',
  inputSchema:{type:'object',properties:{action:{type:'string',enum:['scan','prepare_patch']},project:{type:'string',pattern:'^[a-z0-9-]{1,64}$'},branch:{type:'string'},expected_head_sha:{type:'string',pattern:'^[a-f0-9]{40}$'},paths:{type:'array',minItems:1,maxItems:64,items:{type:'string'}},expected_report_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},selected_findings:{type:'array',minItems:1,maxItems:64,items:{type:'string',pattern:'^[a-f0-9]{24}$'}}},required:['action','project','expected_head_sha','paths'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
});

export async function githubCleanupSnapshot(env,args,request=githubApiRequest) {
  validateAiCleanupArguments(args); const api=path=>request(env,path,{maxResponseBytes:1024*1024});
  const policy=await readRunnerJsonFile(api,runnerControlBase(env),`projects/${args.project}.json`),registration=policy.value;
  if(registration?.id!==args.project||registration?.managed!==true||!/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(registration.repository||'')||typeof registration.default_branch!=='string')fail('permission','AI Cleanup requires a current registered Lauren-owned project');
  if(cleanupBlobSha(Buffer.from(policy.content,'utf8'))!==policy.sha)fail('conflict','Project policy bytes do not match the Git blob');
  const branch=args.branch||registration.default_branch,base=`/repos/${registration.repository}`,ref=`${base}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
  validateAiCleanupArguments({...args,branch});
  const head=await api(ref);if(head?.object?.sha!==args.expected_head_sha)fail('conflict','Source head changed; refresh before scanning');
  const commit=await api(`${base}/git/commits/${args.expected_head_sha}`);if(commit?.sha!==args.expected_head_sha||!SHA.test(commit?.tree?.sha||''))fail('provider','Invalid exact commit/tree response');
  const tree=await api(`${base}/git/trees/${commit.tree.sha}?recursive=1`);
  if(tree?.sha!==commit.tree.sha||tree?.truncated!==false||!Array.isArray(tree.tree)||tree.tree.length>AI_CLEANUP_LIMITS.tree_entries)fail('capacity','Source tree is incomplete or exceeds the bounded inventory');
  const files=[];let total=0;
  for(const path of [...args.paths].sort()) {
    const entries=tree.tree.filter(e=>e.path===path);if(entries.length!==1)fail('provider','Declared source path is missing or duplicated');const entry=entries[0];
    const file={path,blob_sha:entry.sha,mode:entry.mode};
    if(!['100644','100755'].includes(entry.mode)){files.push(file);continue;}
    if(entry.type!=='blob'||!SHA.test(entry.sha||''))fail('provider','Invalid declared file identity');
    if(['mandatory_notice','binary_asset','build_or_tool_configuration'].includes(cleanupPathKind(path,args.project))){files.push({...file,excluded:true});continue;}
    if(!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>AI_CLEANUP_LIMITS.file_bytes||(total+=entry.size)>AI_CLEANUP_LIMITS.total_bytes)fail('capacity','AI Cleanup text window exceeded; narrow the file scope');
    const blob=await api(`${base}/git/blobs/${entry.sha}`);if(blob?.sha!==entry.sha||blob.encoding!=='base64'||blob.truncated||typeof blob.content!=='string'||blob.content.length>AI_CLEANUP_LIMITS.file_bytes*2)fail('provider','Invalid bounded source blob response');
    const encoded=blob.content.replace(/\s/g,''),bytes=Buffer.from(encoded,'base64');if(bytes.toString('base64')!==encoded||bytes.length!==entry.size||blob.size!==entry.size||cleanupBlobSha(bytes)!==entry.sha)fail('conflict','Source blob byte integrity failed');
    const content=bytes.toString('utf8');if(!Buffer.from(content,'utf8').equals(bytes))fail('validation','Invalid UTF-8 source requires manual review');files.push({...file,content});
  }
  if((await api(ref))?.object?.sha!==args.expected_head_sha)fail('conflict','Source moved during inventory; no patch prepared');
  return {schema:1,project:args.project,repository:registration.repository,branch,head_sha:args.expected_head_sha,tree_sha:commit.tree.sha,policy_sha:policy.sha,scope:[...args.paths].sort(),complete:true,files};
}

export async function callAiCleanup(env,args,request=githubApiRequest) {
  const snapshot=await githubCleanupSnapshot(env,args,request);
  return {ok:true,namespace:'relay.SOURCE',...(args.action==='scan'?{report:scanAiCleanup(snapshot)}:{plan:prepareAiCleanup(snapshot,args)})};
}
