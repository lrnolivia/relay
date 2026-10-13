import { createHash } from 'node:crypto';
import { canIngestUpstream } from '../../src/skills-upstream.js';
const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
export async function vendorUpstream(input,api){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository||'')||!/^[a-f0-9]{40}$/.test(input.revision||'')||!/^upstream\.[a-z][a-z0-9.-]{1,80}$/.test(input.id||''))throw Error('Upstream vendor requires exact repository, immutable revision and namespaced id');
 if(typeof input.path!=='string'||input.path.startsWith('/')||input.path.includes('\\')||input.path.split('/').some(x=>!x||x==='.'||x==='..')||!input.path.endsWith('SKILL.md'))throw Error('Upstream path must name a repository-relative SKILL.md');
 const manifest={id:input.id,version:'1.0.0',origin:'upstream',license:input.license,provenance:{source:`https://github.com/${input.repository}/blob/${input.revision}/${input.path}`,revision:input.revision},integrity:input.integrity,entrypoint:'SKILL.md',context_budget:32768,required_capabilities:[],optional_capabilities:[],dependencies:[],platforms:['generic'],tags:[],update_policy:'pinned',executable:false};
 const gate=canIngestUpstream(manifest);if(!gate.ok)throw Error('Upstream vendor blocked: '+gate.reason);
 const [entry,license]=await Promise.all([api(`/repos/${input.repository}/contents/${input.path.split('/').map(encodeURIComponent).join('/')}?ref=${input.revision}`),api(`/repos/${input.repository}/license?ref=${input.revision}`)]);
 function bytes(file){if(file.type==='symlink'||file.encoding!=='base64'||typeof file.content!=='string'||file.content.length>180000)throw Error('Upstream file is incomplete or exceeds its bounded size');return Buffer.from(file.content.replace(/\s/g,''),'base64');}
 const content=bytes(entry),licenseBytes=bytes(license);
 if(hash(content)!==input.integrity)throw Error('Upstream entrypoint integrity mismatch');
 if(license.license?.spdx_id!==input.license||!licenseBytes.length)throw Error('Repository license differs from the requested license; review before vendoring');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(content),licenseText=new TextDecoder('utf-8',{fatal:true}).decode(licenseBytes);
 if(!text.startsWith('---\n'))throw Error('Portable upstream entrypoint requires SKILL.md frontmatter');
 if(/(?:scripts|references|assets)\//.test(text)||[...text.matchAll(/\]\(([^)\s]+)/g)].some(([,href])=>!/^https?:|^#|^(?:\.\/)?LICENSE$/.test(href)))throw Error('Upstream pack has supporting-file references; vendor its complete audited dependency bundle through an admitted source change');
 manifest.context_budget=Math.max(256,Math.ceil(content.length/4));manifest.license_integrity=hash(licenseBytes);
 return {manifest,text,license_text:licenseText};
}
