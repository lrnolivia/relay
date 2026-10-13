import type {WorkItem} from './work-view-model.js';
export function projectBadge(project:string):string;
export function bindWorkViewer(root:HTMLElement,options:{id:string;defaultView?:string;initialFilter?:string;onOpen?:(item:WorkItem)=>void;predicates?:Record<string,(item:WorkItem,value:any)=>boolean>;extensionControls?:any[]}):{update(items:WorkItem[],options?:{project?:string;incomplete?:boolean}):void;refresh():void;destroy():void};
