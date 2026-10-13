export function projectGroup(id:string):string;
export function projectInGroup(id:string,selected:string):boolean;
export function groupedProjects<T extends {id:string}>(projects:T[]):Array<T & {children:T[]}>;
export function groupedActivity(activity:Record<string,number>):Record<string,number>;

export function projectMembers(id:string):string[];
