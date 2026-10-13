import { createHash } from "node:crypto";
const SHA256=/^[a-f0-9]{64}$/;
export function sha256(bytes){const view=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);return createHash("sha256").update(view).digest("hex");}
export function verifyExactArtifact({bytes,expected_bytes,expected_sha256}){
  const view=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  if(!Number.isInteger(expected_bytes)||expected_bytes<0) throw new Error("expected_bytes must be a non-negative integer");
  if(typeof expected_sha256!=="string"||!SHA256.test(expected_sha256)) throw new Error("expected_sha256 must be lowercase sha256 hex");
  const actual={bytes:view.length,sha256:sha256(view)};
  if(actual.bytes!==expected_bytes) throw new Error(`artifact byte-count mismatch: expected ${expected_bytes}, got ${actual.bytes}`);
  if(actual.sha256!==expected_sha256) throw new Error(`artifact sha256 mismatch: expected ${expected_sha256}, got ${actual.sha256}`);
  return Object.freeze({ok:true,...actual});
}
export function artifactIngressPlan({canonical_location,transport,expected_bytes,expected_sha256}){
  if(!canonical_location) throw new Error("canonical_location is required");
  if(!["repo-upload","binary-safe","machine-chunked"].includes(transport)) throw new Error("transport must preserve canonical bytes");
  if(transport==="machine-chunked"&&(!Number.isInteger(expected_bytes)||!expected_sha256)) throw new Error("machine-chunked transport requires final digest and byte-count verification");
  return Object.freeze({canonical_location,transport,expected_bytes,expected_sha256,model_transcription_allowed:false,readback_required:true});
}
export function auditSkillManifest(manifest){
  const findings=[];
  if(manifest.origin==="upstream"&&manifest.license.toLowerCase()==="unknown") findings.push({severity:"block",code:"unknown-license"});
  if(manifest.executable===true) findings.push({severity:"review",code:"executable-content"});
  if(manifest.update_policy==="tracked"&&manifest.origin==="project-private") findings.push({severity:"review",code:"private-tracked-update"});
  return Object.freeze({ok:!findings.some(x=>x.severity==="block"),findings});
}
