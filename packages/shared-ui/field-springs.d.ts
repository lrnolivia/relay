export function bindFieldMotion(root?:Document|HTMLElement):()=>void;
export function captureMotionLayout(root:HTMLElement,selector?:string):Map<string,any>;
export function settleMotionLayout(root:HTMLElement,before:Map<string,any>,selector?:string):void;
