import { githubApiRequest } from "./source.js";
import { attributedCommitBody, verifyAttributedCommit, assertProjectRepository } from './commit-attribution.js';

const SHA=/^[a-f0-9]{40}$/i;
const MAX_BYTES=12*1024*1024;
const MAX_FRAGMENT=100000;
const MAX_APPEND=200000;

function ident(v,label){
  if(typeof v!=="string"||v.length<1||v.length>128||!/^[A-Za-z0-9._-]+$/.test(v)) throw new Error("Invalid "+label);
  return v;
}
function branch(v){
  if(typeof v!=="string"||v.length<1||v.length>240||!/^[A-Za-z0-9._\/-]+$/.test(v)||v.includes("..")||v.startsWith("/")||v.endsWith("/")||v.endsWith(".lock")) throw new Error("Invalid branch");
  return v;
}
function pathName(v){
  if(typeof v!=="string"||v.length<1||v.length>1000||v.startsWith("/")) throw new Error("Invalid repository path");
  const p=v.split("/");
  if(p.some(x=>!x||x==="."||x==="..")) throw new Error("Invalid repository path");
  return p.join("/");
}
function sha(v,label){
  if(typeof v!=="string"||!SHA.test(v)) throw new Error("Invalid "+label);
  return v.toLowerCase();
}
const refName=v=>String(v).split("/").map(encodeURIComponent).join("/");
const contentPath=v=>String(v).split("/").map(encodeURIComponent).join("/");

async function treeEntry(env,request,base,treeSha,filePath){
  const parts=filePath.split("/");
  let current=treeSha;
  for(let i=0;i<parts.length;i++){
    const tree=await request(env,base+"/git/trees/"+current);
    const entries=Array.isArray(tree?.tree)?tree.tree:[];
    const entry=entries.find(x=>x?.path===parts[i]);
    if(!entry) throw new Error("Source path does not exist on the expected branch head");
    if(i<parts.length-1){
      if(entry.type!=="tree"||!entry.sha) throw new Error("Source path is not a file");
      current=entry.sha;
    }else{
      if(entry.type!=="blob"||!entry.sha) throw new Error("Source path is not a UTF-8 file");
      return entry;
    }
  }
  throw new Error("Source path does not exist");
}

function decodeText(blob){
  if(blob?.encoding!=="base64"||typeof blob?.content!=="string") throw new Error("GitHub did not return a decodable file blob");
  const bytes=Buffer.from(blob.content.replace(/\s/g,""),"base64");
  if(bytes.length>MAX_BYTES) throw new Error("Physical text blob exceeds Relay's safe server-side edit window; shard the logical artifact and continue with bounded files");
  const text=bytes.toString("utf8");
  if(!Buffer.from(text,"utf8").equals(bytes)||text.includes("\u0000")) throw new Error("relay.SOURCE text mutation only supports UTF-8 text files");
  return {text,bytes:bytes.length};
}
function count(text,needle){
  let n=0,at=0;
  while(true){
    const i=text.indexOf(needle,at);
    if(i<0) return n;
    n++; at=i+needle.length;
  }
}
function edits(v){
  if(!Array.isArray(v)||v.length<1||v.length>20) throw new Error("relay.SOURCE edit requires 1-20 bounded replacements");
  return v.map((e,i)=>{
    if(!e||typeof e!=="object"||Array.isArray(e)) throw new Error("Invalid edit "+(i+1));
    for(const k of Object.keys(e)) if(!["old_text","new_text","expected_matches"].includes(k)) throw new Error("Unsupported edit field: "+k);
    if(typeof e.old_text!=="string"||e.old_text.length<1||e.old_text.length>MAX_FRAGMENT) throw new Error("Invalid old_text in edit "+(i+1));
    if(typeof e.new_text!=="string"||e.new_text.length>MAX_FRAGMENT) throw new Error("Invalid new_text in edit "+(i+1));
    const expected=e.expected_matches===undefined?1:e.expected_matches;
    if(!Number.isInteger(expected)||expected<1||expected>1000) throw new Error("Invalid expected_matches in edit "+(i+1));
    return {old_text:e.old_text,new_text:e.new_text,expected_matches:expected};
  });
}

export const sourceTextMutationTools=[
  {
    name:"relay_source_edit_text",
    title:"Edit text by exact fragments",
    description:"COMMAND — edit an existing UTF-8 file on a non-default branch using 1-20 bounded exact replacements. Read the file and branch head first; pass both expected blob SHA and expected branch-head SHA. Relay commits and verifies readback. On conflict or uncertain outcome, refresh file/head identities before retrying; never replay a mutation against stale SHAs.",
    inputSchema:{
      type:"object",
      properties:{
        owner:{type:"string"},repo:{type:"string"},branch:{type:"string"},path:{type:"string"},
        expected_sha:{type:"string",pattern:"^[a-fA-F0-9]{40}$"},
        expected_head_sha:{type:"string",pattern:"^[a-fA-F0-9]{40}$"},
        message:{type:"string",minLength:1,maxLength:500},
        edits:{type:"array",minItems:1,maxItems:20,items:{
          type:"object",
          properties:{
            old_text:{type:"string",minLength:1,maxLength:MAX_FRAGMENT},
            new_text:{type:"string",maxLength:MAX_FRAGMENT},
            expected_matches:{type:"integer",minimum:1,maximum:1000,default:1}
          },
          required:["old_text","new_text"],additionalProperties:false
        }}
      },
      required:["repo","branch","path","expected_sha","expected_head_sha","message","edits"],
      additionalProperties:false
    },
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}
  },
  {
    name:"relay_source_append_text",
    title:"Append bounded text",
    description:"COMMAND — append one bounded UTF-8 chunk to an existing file on a non-default branch. Read the file and branch head first; pass both expected blob SHA and expected branch-head SHA. Relay verifies readback and returns the next identities for safe chaining. On conflict/uncertain outcome, refresh before retrying.",
    inputSchema:{
      type:"object",
      properties:{
        owner:{type:"string"},repo:{type:"string"},branch:{type:"string"},path:{type:"string"},
        expected_sha:{type:"string",pattern:"^[a-fA-F0-9]{40}$"},
        expected_head_sha:{type:"string",pattern:"^[a-fA-F0-9]{40}$"},
        message:{type:"string",minLength:1,maxLength:500},
        content:{type:"string",minLength:1,maxLength:MAX_APPEND}
      },
      required:["repo","branch","path","expected_sha","expected_head_sha","message","content"],
      additionalProperties:false
    },
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}
  }
];

export function isSourceTextMutationTool(name){
  return sourceTextMutationTools.some(t=>t.name===name);
}
export function validateSourceTextMutationArguments(name,args){
  if(!isSourceTextMutationTool(name)) throw new Error("Unknown source text mutation tool");
  if(!args||typeof args!=="object"||Array.isArray(args)) throw new Error("Tool arguments must be an object");
  const common=["owner","repo","branch","path","expected_sha","expected_head_sha","message"];
  const allowed=name==="relay_source_edit_text"?[...common,"edits"]:[...common,"content"];
  const required=common.filter(x=>x!=="owner").concat(name==="relay_source_edit_text"?"edits":"content");
  for(const k of Object.keys(args)) if(!allowed.includes(k)) throw new Error("Unsupported argument: "+k);
  for(const k of required) if(!(k in args)) throw new Error("Missing required argument: "+k);
  return args;
}

export async function mutateSourceText(env,args,request=githubApiRequest){
  const configured=ident(String(env?.RELAY_GITHUB_OWNER||"lrnolivia"),"configured GitHub owner");
  if(args.owner&&String(args.owner).toLowerCase()!==configured.toLowerCase()) throw new Error("relay.SOURCE is restricted to GitHub owner "+configured);
  const owner=configured,repo=ident(args.repo,"repository"),br=branch(args.branch),file=pathName(args.path);
  const expectedBlob=sha(args.expected_sha,"expected file blob SHA"),expectedHead=sha(args.expected_head_sha,"expected branch head SHA");
  if(typeof args.message!=="string"||args.message.length<1||args.message.length>500) throw new Error("Invalid commit message");
  const mode=args.mode;
  if(!["edit","append"].includes(mode)) throw new Error("Unsupported source text mutation");

  const base="/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo);
  assertProjectRepository(base);
  const meta=await request(env,base);
  const defaultBranch=branch(meta?.default_branch);
  if(br===defaultBranch) throw new Error("relay.SOURCE refuses direct default-branch commits; coordination control state must be mutated through relay.RUNNER");

  const refPath=base+"/git/ref/heads/"+refName(br);
  const ref=await request(env,refPath);
  const head=sha(ref?.object?.sha,"branch head SHA");
  if(head!==expectedHead) throw new Error("Branch head changed; refresh before mutating text");

  const parent=await request(env,base+"/git/commits/"+head);
  const treeSha=sha(parent?.tree?.sha,"parent tree SHA");
  const entry=await treeEntry(env,request,base,treeSha,file);
  const currentBlob=sha(entry.sha,"current file blob SHA");
  if(currentBlob!==expectedBlob) throw new Error("File blob changed; refresh before mutating text");

  const decoded=decodeText(await request(env,base+"/git/blobs/"+currentBlob));
  let next=decoded.text,operationCount=0;
  if(mode==="edit"){
    for(const e of edits(args.edits)){
      const found=count(next,e.old_text);
      if(found!==e.expected_matches) throw new Error("Edit match count changed; expected "+e.expected_matches+" but found "+found);
      next=next.split(e.old_text).join(e.new_text); operationCount++;
    }
  }else{
    if(typeof args.content!=="string"||args.content.length<1||args.content.length>MAX_APPEND) throw new Error("Append content must be 1-"+MAX_APPEND+" characters");
    next+=args.content; operationCount=1;
  }
  if(next===decoded.text) throw new Error("Source text mutation produced no change");
  const bytesAfter=Buffer.byteLength(next,"utf8");
  if(bytesAfter>MAX_BYTES) throw new Error("Mutation would exceed Relay's safe physical text-blob window; shard the logical artifact and continue with bounded files");

  const blob=await request(env,base+"/git/blobs",{method:"POST",body:{content:next,encoding:"utf-8"}});
  const nextBlob=sha(blob?.sha,"created file blob SHA");
  const tree=await request(env,base+"/git/trees",{method:"POST",body:{
    base_tree:treeSha,tree:[{path:file,mode:entry.mode||"100644",type:"blob",sha:nextBlob}]
  }});
  const nextTree=sha(tree?.sha,"created tree SHA");
  const commitBody=attributedCommitBody({message:args.message,tree:nextTree,parents:[head]});
  const commit=await request(env,base+"/git/commits",{method:"POST",body:commitBody});
  const commitSha=sha(commit?.sha,"created commit SHA");
  await verifyAttributedCommit((path,options)=>request(env,path,options),base,commitSha,commitBody);

  let writeError=null;
  try{
    await request(env,base+"/git/refs/heads/"+refName(br),{method:"PATCH",body:{sha:commitSha,force:false}});
  }catch(error){writeError=error;}

  const verifiedHead=sha((await request(env,refPath))?.object?.sha,"verified branch head SHA");
  if(verifiedHead!==commitSha){
    if(writeError) throw writeError;
    throw new Error("Branch head readback differs from the created commit; refresh before retrying");
  }
  const verified=await request(env,base+"/contents/"+contentPath(file)+"?ref="+encodeURIComponent(br));
  const verifiedBlob=sha(verified?.sha,"verified file blob SHA");
  if(verifiedBlob!==nextBlob) throw new Error("File readback differs from the created blob; reconcile before retrying");

  return {
    ok:true,namespace:"relay.SOURCE",repository:owner+"/"+repo,branch:br,path:file,operation:mode,
    operation_count:operationCount,previous_head_sha:head,head_sha:commitSha,commit_sha:commitSha,
    previous_blob_sha:currentBlob,blob_sha:nextBlob,bytes_before:decoded.bytes,bytes_after:bytesAfter,
    reconciled_after_transport_error:Boolean(writeError),
    recovery:"Use the returned head_sha and blob_sha as the expected identities for the next bounded mutation."
  };
}

export async function callSourceTextMutationTool(name,args,env,request=githubApiRequest){
  validateSourceTextMutationArguments(name,args);
  return mutateSourceText(env,{...args,mode:name==="relay_source_edit_text"?"edit":"append"},request);
}
