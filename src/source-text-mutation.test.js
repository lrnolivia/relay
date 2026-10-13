import test from "node:test";
import {PROJECT_AUTHOR} from "./commit-attribution.js";
import assert from "node:assert/strict";
import {
  callSourceTextMutationTool,
  mutateSourceText,
  sourceTextMutationTools,
  validateSourceTextMutationArguments
} from "./source-text-mutation.js";

const S={
  head:"1".repeat(40),tree:"2".repeat(40),dir:"3".repeat(40),blob:"4".repeat(40),
  nextBlob:"5".repeat(40),nextTree:"6".repeat(40),commit:"7".repeat(40)
};

function fixture(text="hello world\n",options={}){
  let head=S.head,patches=0;
  const seen={blobBody:null,treeBody:null,commitBody:null};
  const request=async (_env,path,opts={})=>{
    if(path==="/repos/lrnolivia/relay") return {default_branch:"main"};
    if(path==="/repos/lrnolivia/relay/git/ref/heads/relay/test") return {object:{sha:head}};
    if(path==="/repos/lrnolivia/relay/git/commits/"+S.head) return {tree:{sha:S.tree}};
    if(path==="/repos/lrnolivia/relay/git/trees/"+S.tree) return {tree:[{path:"docs",type:"tree",sha:S.dir}]};
    if(path==="/repos/lrnolivia/relay/git/trees/"+S.dir) return {tree:[{path:"file.md",type:"blob",sha:S.blob,mode:"100755"}]};
    if(path==="/repos/lrnolivia/relay/git/blobs/"+S.blob) return {encoding:"base64",content:Buffer.from(text).toString("base64")};
    if(path==="/repos/lrnolivia/relay/git/blobs"&&opts.method==="POST"){
      seen.blobBody=opts.body;
      return {sha:S.nextBlob};
    }
    if(path==="/repos/lrnolivia/relay/git/trees"&&opts.method==="POST"){
      seen.treeBody=opts.body;
      return {sha:S.nextTree};
    }
    if(path==="/repos/lrnolivia/relay/git/commits"&&opts.method==="POST"){
      seen.commitBody=opts.body;
      return {sha:S.commit};
    }
    if(path==="/repos/lrnolivia/relay/commits/"+S.commit) return {sha:S.commit,author:PROJECT_AUTHOR,committer:PROJECT_AUTHOR,commit:{...seen.commitBody,tree:{sha:S.nextTree}},parents:[{sha:S.head}]};
    if(path==="/repos/lrnolivia/relay/git/refs/heads/relay/test"&&opts.method==="PATCH"){
      patches++;
      head=S.commit;
      if(options.throwAfterPatch) throw new Error("simulated transport failure");
      return {};
    }
    if(path==="/repos/lrnolivia/relay/contents/docs/file.md?ref=relay%2Ftest") return {sha:S.nextBlob};
    throw new Error("unexpected "+(opts.method||"GET")+" "+path);
  };
  return {request,seen,get patches(){return patches;}};
}

const base={
  repo:"relay",branch:"relay/test",path:"docs/file.md",
  expected_sha:S.blob,expected_head_sha:S.head,message:"edit docs"
};

test("publishes bounded edit and append tools",()=>{
  assert.deepEqual(sourceTextMutationTools.map(x=>x.name),["relay_source_edit_text","relay_source_append_text"]);
  assert.throws(()=>validateSourceTextMutationArguments("relay_source_edit_text",{repo:"x"}),/Missing required argument/);
  assert.throws(()=>validateSourceTextMutationArguments("relay_source_append_text",{...base,content:"x",surprise:true}),/Unsupported argument/);
});

test("exact edit loads existing blob server-side and preserves file mode",async()=>{
  const f=fixture();
  const got=await callSourceTextMutationTool("relay_source_edit_text",{
    ...base,edits:[{old_text:"world",new_text:"relay"}]
  },{},f.request);
  assert.equal(f.seen.blobBody.content,"hello relay\n");
  assert.equal(f.seen.treeBody.tree[0].mode,"100755");
  assert.equal(f.seen.commitBody.parents[0],S.head);
  assert.equal(got.previous_blob_sha,S.blob);
  assert.equal(got.blob_sha,S.nextBlob);
  assert.equal(got.head_sha,S.commit);
  assert.equal(got.operation,"edit");
  assert.equal(got.reconciled_after_transport_error,false);
});

test("append returns next identities for chained bounded chunks",async()=>{
  const f=fixture("one\n");
  const got=await callSourceTextMutationTool("relay_source_append_text",{
    ...base,message:"append docs",content:"two\n"
  },{},f.request);
  assert.equal(f.seen.blobBody.content,"one\ntwo\n");
  assert.equal(got.operation,"append");
  assert.equal(got.operation_count,1);
  assert.match(got.recovery,/returned head_sha and blob_sha/);
});

test("stale branch head rejects before any write",async()=>{
  const f=fixture();
  await assert.rejects(mutateSourceText({},{
    ...base,mode:"edit",expected_head_sha:"8".repeat(40),
    edits:[{old_text:"world",new_text:"relay"}]
  },f.request),/Branch head changed/);
  assert.equal(f.patches,0);
  assert.equal(f.seen.blobBody,null);
});

test("stale file blob rejects before mutation",async()=>{
  const f=fixture();
  await assert.rejects(mutateSourceText({},{
    ...base,mode:"edit",expected_sha:"8".repeat(40),
    edits:[{old_text:"world",new_text:"relay"}]
  },f.request),/File blob changed/);
  assert.equal(f.seen.blobBody,null);
});

test("ambiguous replacement rejects unless exact match count agrees",async()=>{
  const f=fixture("x x\n");
  await assert.rejects(mutateSourceText({},{
    ...base,mode:"edit",edits:[{old_text:"x",new_text:"y"}]
  },f.request),/expected 1 but found 2/);
  assert.equal(f.seen.blobBody,null);
});

test("default branch writes remain forbidden",async()=>{
  const request=async(_env,path)=>{
    if(path==="/repos/lrnolivia/relay") return {default_branch:"main"};
    throw new Error("unexpected "+path);
  };
  await assert.rejects(mutateSourceText({},{
    ...base,branch:"main",mode:"append",content:"x"
  },request),/refuses direct default-branch/);
});

test("transport error reconciles only when exact commit and blob read back",async()=>{
  const f=fixture("a\n",{throwAfterPatch:true});
  const got=await mutateSourceText({},{
    ...base,mode:"append",content:"b\n"
  },f.request);
  assert.equal(got.reconciled_after_transport_error,true);
  assert.equal(got.head_sha,S.commit);
  assert.equal(got.blob_sha,S.nextBlob);
});
