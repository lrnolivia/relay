import {brand} from '../../public/brand.js';
import {useEffect,useRef} from 'react';
import {projectBadge} from '../../../../packages/shared-ui/work-viewer.js';
import {hydrateProjectIcons} from '../../public/project-icons.js';
export function ProjectIdentity({project}:{project:string}){
 const root=useRef<HTMLSpanElement>(null);
 useEffect(()=>{if(!root.current)return;root.current.innerHTML=projectBadge(project);void hydrateProjectIcons(root.current);},[project]);
 return <span ref={root} className="telemetry-project-identity"/>;
}
export function WorkerIdentity({name}:{name?:string|null}){return name?<span className="telemetry-worker-badge"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6" r="3"/><path d="M4 17v-2a6 6 0 0 1 12 0v2"/></svg>{name}</span>:null;}
export function FeatureIdentity({feature}:{feature:'runner'|'inspector'}){return <span className="telemetry-feature-badge"><img src={brand[feature]} alt=""/>{feature}</span>;}
