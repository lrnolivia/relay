export type WorkItem={project:string;kind:string;id:string;title:string;detail:string;next:string;sourceState:string;time:number|null;priority:string|null;revision:string;href?:string;screenshot?:string;source:any};
export type ReviewRecord={source_revision:string;status:string;archived:boolean;etag:string|null;updated_at?:string};
export const reviewStates:string[];
export const reviewFilters:string[];
export function reviewKey(item:Pick<WorkItem,'project'|'kind'|'id'>):string;
export function sourceRevision(item:any):Promise<string>;
export function effectiveReview(item:WorkItem,record?:ReviewRecord):{status:string;archived:boolean};
export function priorityValue(value:unknown):number|null;
export function selectWork(items:WorkItem[],query?:any,records?:Record<string,ReviewRecord>,predicates?:Record<string,(item:WorkItem,value:any)=>boolean>):WorkItem[];
export function bulkTargets(items:WorkItem[],visible:WorkItem[],selection:string[],scope:string):WorkItem[];
export function reviewTransition(previous:any,action:string):{status:string;archived:boolean};
export function assignmentItem(project:string,source:any):Promise<WorkItem>;
export function evidenceItem(source:any):Promise<WorkItem>;

export function workerSource(worker:any):any;
export function checkItem(worker:any):Promise<WorkItem>;
