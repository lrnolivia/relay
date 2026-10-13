import {useEffect,useRef} from 'react';
import {bindWorkViewer} from '../../../../packages/shared-ui/work-viewer.js';
import type {WorkItem} from '../../../../packages/shared-ui/work-view-model.js';
export function WorkViewer({id,items,project='',incomplete=false,defaultView='list'}:{id:string;items:WorkItem[];project?:string;incomplete?:boolean;defaultView?:string}) {
 const root=useRef<HTMLDivElement>(null),controller=useRef<ReturnType<typeof bindWorkViewer>|null>(null);
 useEffect(()=>{if(!root.current)return;controller.current=bindWorkViewer(root.current,{id,defaultView});return()=>{controller.current?.destroy();controller.current=null;};},[id,defaultView]);
 useEffect(()=>{controller.current?.update(items,{project,incomplete});},[items,project,incomplete]);
 return <div ref={root}/>;
}
