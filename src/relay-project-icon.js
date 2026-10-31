import {createHash} from 'node:crypto';
import {projectIcon} from '../packages/runner/src/project-icons.mjs';
import {githubApiRequest} from './source.js';
import {readRunnerFile,runnerControlBase} from './runner-control-core.js';
import {isWorkCardTool} from './work-card-delivery.js';

const CARD_READS=new Set(['relay_render_context_card','relay_runner_progress','relay_runner_assignments','relay_runner_resume']);
// Shared response decoration: no browser credentials and no user-supplied URLs.
// The existing discovery cache is partitioned by the actual credential material.
export async function withCardProjectIcon(name,data,env={},apiOverride){
 if(!data||typeof data!=='object'||(!isWorkCardTool(name)&&!CARD_READS.has(name))||!/^[-a-z0-9]{1,80}$/.test(data.project||''))return data;
 const project=data.project,api=apiOverride||((path,options)=>githubApiRequest(env,path,options));
 const unavailable={project,status:'unavailable',icon:null};
 try{
  const file=await readRunnerFile(api,runnerControlBase(env),'projects/'+project+'.json');
  const registration=JSON.parse(file.content);
  if(registration.id!==project||registration.alias_of)return {...data,project_icon:unavailable};
  const scope=createHash('sha256').update(JSON.stringify([env.RELAY_GITHUB_APP_ID||'',env.RELAY_GITHUB_APP_PRIVATE_KEY||'',env.RELAY_GITHUB_TOKEN||'',env.RELAY_GITHUB_OWNER||'',Boolean(apiOverride)])).digest('hex');
  const result=await projectIcon(registration,api,scope);
  return {...data,project_icon:{project,name:registration.name||project,...result}};
 }catch{return {...data,project_icon:unavailable};}
}
