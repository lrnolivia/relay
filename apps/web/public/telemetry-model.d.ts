import type { DashboardSnapshot, ObservedProgress } from '../src/types';
type Item=ObservedProgress&{project:string};
export function telemetryModel(snapshot:DashboardSnapshot|null,now?:number):{items:Item[];open:number;completed:number;total:number;percent:number|null;moving:Item[];waiting:Item[];needs:Item[];projects:{project:string;count:number}[];bins:number[];events:number};
