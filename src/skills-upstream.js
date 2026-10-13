export function compareUpstream(manifest,{revision,integrity,license}={}){
  const changes=[];
  if(revision&&revision!==manifest.provenance.revision) changes.push("revision");
  if(integrity&&integrity!==manifest.integrity) changes.push("integrity");
  if(license&&license!==manifest.license) changes.push("license");
  const policy=manifest.update_policy;
  return Object.freeze({
    changed:changes.length>0,
    changes,
    action:!changes.length?"none":policy==="tracked"?"review-update":policy==="manual"?"manual-review":"stay-pinned"
  });
}

export function canIngestUpstream(manifest){
  if(manifest.origin!=="upstream") return {ok:true,reason:"not-upstream"};
  if(!manifest.license||manifest.license.toLowerCase()==="unknown") return {ok:false,reason:"unknown-license"};
  if(!/^[a-f0-9]{40}$/.test(manifest.provenance?.revision||"")||!/^sha256:[a-f0-9]{64}$/.test(manifest.integrity||"")) return {ok:false,reason:"unpinned-source"};
  if(!["MIT","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","CC0-1.0","CC-BY-4.0"].includes(manifest.license)) return {ok:false,reason:"license-review-required"};
  if(manifest.executable===true) return {ok:false,reason:"executable-requires-explicit-review"};
  return {ok:true,reason:"pinned-and-licensed"};
}

export function planUpstreamUpdate(manifest,next={}){
  const ingest=canIngestUpstream(manifest);
  if(!ingest.ok) return Object.freeze({allowed:false,action:"block",reason:ingest.reason});
  const drift=compareUpstream(manifest,next);
  if(!drift.changed) return Object.freeze({allowed:true,action:"none",changes:[]});
  if(drift.changes.includes("license")) return Object.freeze({allowed:false,action:"license-review",changes:drift.changes});
  if(manifest.update_policy==="pinned") return Object.freeze({allowed:false,action:"stay-pinned",changes:drift.changes});
  return Object.freeze({allowed:true,action:drift.action,changes:drift.changes});
}
