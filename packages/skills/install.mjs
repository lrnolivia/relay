import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createSkillsRuntime } from '../../src/skills-runtime.js';

// Installs one complete, immutable, content-addressed pack set. The caller must
// provide its normal admission check; installing skills does not claim ownership.
export async function installSkills({bundles,selection,context={},directory,admit}) {
  if(typeof admit!=='function')throw Error('Skill installation requires an admission check');
  if(!path.isAbsolute(directory))throw Error('Skill output directory must be absolute');
  const runtime=createSkillsRuntime({manifests:bundles.map(x=>x.manifest),loader:async m=>bundles.find(x=>x.manifest.id===m.id)});
  const loaded=await runtime.load(selection,context);
  const digest=createHash('sha256').update(JSON.stringify(loaded.map(x=>[x.manifest.id,x.manifest.version,x.manifest.integrity,x.manifest.license_integrity||null]))).digest('hex');
  // Refuse symlink ancestors so an approved output path cannot redirect writes.
  let ancestor=path.parse(directory).root;
  for(const segment of directory.slice(ancestor.length).split(path.sep).filter(Boolean)){
    ancestor=path.join(ancestor,segment);
    try{if((await fs.lstat(ancestor)).isSymbolicLink())throw Error('Skill install path contains a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const destination=path.join(directory,digest);
  await admit({directory:destination,files:loaded.flatMap(x=>[`${x.manifest.id}/SKILL.md`,`${x.manifest.id}/manifest.json`,...(x.license_text?[`${x.manifest.id}/LICENSE`]:[])]).concat('skills.lock.json')});
  const expected=new Map(loaded.flatMap(x=>[[`${x.manifest.id}/SKILL.md`,x.text],[`${x.manifest.id}/manifest.json`,JSON.stringify(x.manifest,null,2)+'\n']]));
  for(const bundle of loaded)if(bundle.license_text)expected.set(bundle.manifest.id+'/LICENSE',bundle.license_text);
  expected.set('skills.lock.json',JSON.stringify({schema:1,digest,project:context.project||null,packs:loaded.map(x=>({id:x.manifest.id,version:x.manifest.version,integrity:x.manifest.integrity,license_integrity:x.manifest.license_integrity||null,provenance:x.manifest.provenance,license:x.manifest.license}))},null,2)+'\n');
  async function verify(){if(!(await fs.lstat(destination)).isDirectory())throw Error('Installed skill directory is not a real directory');for(const bundle of loaded)if(!(await fs.lstat(path.join(destination,bundle.manifest.id))).isDirectory())throw Error('Installed skill pack is not a real directory');for(const [file,text] of expected){const filePath=path.join(destination,file);if(!(await fs.lstat(filePath)).isFile()||await fs.readFile(filePath,'utf8')!==text)throw Error('Installed skill readback differs from the pinned bundle');}}
  try{await fs.stat(destination);await verify();return {installed:true,replayed:true,directory:destination,digest};}catch(error){if(error.code!=='ENOENT')throw error;}
  await fs.mkdir(directory,{recursive:true});const staging=await fs.mkdtemp(path.join(directory,'.staging-'));
  try{
    for(const [file,text] of expected){const filePath=path.join(staging,file);await fs.mkdir(path.dirname(filePath),{recursive:true});await fs.writeFile(filePath,text,{flag:'wx',mode:0o644});}
    try{await fs.rename(staging,destination);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes(error.code))throw error;}
    await verify();return {installed:true,replayed:false,directory:destination,digest,executable:false};
  }finally{await fs.rm(staging,{recursive:true,force:true});}
}
