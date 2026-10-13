export function activityTime(item: any): number | null;
export function workRevision(item: any): string;
export function projectActivity(snapshot: any): Record<string, number>;
export function partitionProjects<T extends {id:string}>(projects:T[], activity:Record<string,number>, seen?:Record<string,number>, now?:number, label?:(id:string)=>string):{recent:T[];rest:T[]};
export function advanceArrivalBaseline(previous:Record<string,{ids:string[]}>,snapshot:any):{next:Record<string,{ids:string[]}>;arrivals:Array<{project:string;item:any}>};
