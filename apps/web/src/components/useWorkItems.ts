import {useEffect,useState} from 'react';
import {assignmentItem,checkItem,type WorkItem} from '../../../../packages/shared-ui/work-view-model.js';
import type {DashboardSnapshot} from '../types';
export function useWorkItems(snapshot:DashboardSnapshot|null,kind:'assignment'|'check'='assignment') {
 const [items,setItems]=useState<WorkItem[]>([]);
 useEffect(()=>{let current=true;const promises=kind==='assignment'?Object.entries(snapshot?.progress||{}).flatMap(([project,payload])=>(payload.progress||[]).map(item=>assignmentItem(project,item))):(snapshot?.workers||[]).filter(worker=>worker.runtime?.last_run_at).map(checkItem);void Promise.all(promises).then(next=>{if(current)setItems(next);});return()=>{current=false;};},[snapshot,kind]);
 return items;
}
