import {fieldMotion,fieldGlyphVariants} from './field-motion.js';
// Analytic damped spring: frame-rate independent, preserving velocity on retarget.
export function springStep(value,velocity,target,seconds,{stiffness=500,damping=22,mass=.44}={}) {
 const t=Math.max(0,seconds),w=Math.sqrt(stiffness/mass),z=damping/(2*Math.sqrt(stiffness*mass)),x=value-target;
 if(z<1-1e-4){const wd=w*Math.sqrt(1-z*z),a=x,b=(velocity+z*w*x)/wd,e=Math.exp(-z*w*t),c=Math.cos(wd*t),s=Math.sin(wd*t);const y=e*(a*c+b*s);return {value:target+y,velocity:e*(-z*w*(a*c+b*s)+wd*(-a*s+b*c))};}
 if(z<=1+1e-4){const b=velocity+w*x,e=Math.exp(-w*t);return {value:target+e*(x+b*t),velocity:e*(b-w*(x+b*t))};}
 const q=Math.sqrt(z*z-1),r1=-w*(z-q),r2=-w*(z+q),a=(velocity-r2*x)/(r1-r2),b=x-a;
 return {value:target+a*Math.exp(r1*t)+b*Math.exp(r2*t),velocity:a*r1*Math.exp(r1*t)+b*r2*Math.exp(r2*t)};
}
const defaults={x:0,y:0,rotate:0,scale:1,scaleX:1,scaleY:1};
const states=new WeakMap(),active=new Set();let frame=0,last=0;
function allowed(){return typeof document!=='undefined'&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.presentationMotion!=='calm';}
function paint(state){
 const v=Object.fromEntries(Object.entries(state.values).map(([key,value])=>[key,value.value]));
 if(state.kind==='glyph')state.element.style.transform=`translate3d(${v.x}px,${v.y}px,0) rotate(${v.rotate}deg) scale(${v.scale*v.scaleX},${v.scale*v.scaleY})`;
 else {state.element.style.translate=`${v.x}px ${v.y}px`;state.element.style.scale=String(v.scale);if(state.blurElement){const speed=Math.hypot(state.values.x.velocity,state.values.y.velocity);state.blurElement.style.filter=speed>3?'blur('+Math.min(innerWidth<=900?.6:1,speed*.006)+'px)':state.restFilter;}}
}
function finish(state){for(const [key,target] of Object.entries(state.target))state.values[key]={value:target,velocity:0};paint(state);active.delete(state);if(state.kind!=='glyph'){state.element.style.translate='';state.element.style.scale='';if(state.blurElement)state.blurElement.style.filter=state.restFilter;}}
function tick(now){
 const dt=last?Math.min((now-last)/1000,.064):1/60;last=now;
 for(const state of active){if(!state.element.isConnected||!allowed()){finish(state);continue;}let settled=true;
  for(const [key,target] of Object.entries(state.target)){const current=state.values[key],next=springStep(current.value,current.velocity,target,dt,state.profile);state.values[key]=next;if(Math.abs(next.value-target)>.001||Math.abs(next.velocity)>.005)settled=false;}
  paint(state);if(settled)finish(state);
 }
 frame=active.size?requestAnimationFrame(tick):0;if(!frame)last=0;
}
export function springTo(element,target,{kind='glyph',profile=fieldMotion.glyph,from,velocity}={}){
 let state=states.get(element);
 if(!state){state={element,kind,profile,values:Object.fromEntries(Object.entries({...defaults,...from}).map(([key,value])=>[key,{value,velocity:velocity?.[key]||0}])),target:{...defaults,...target},blurElement:kind==='panel'?element.querySelector('strong'):null};state.restFilter=state.blurElement?.style.filter||'';states.set(element,state);}
 else {state.target={...defaults,...target};state.profile=profile;if(from&&!active.has(state))state.values=Object.fromEntries(Object.entries({...defaults,...from}).map(([key,value])=>[key,{value,velocity:0}]));}
 element.dataset.loewSpring='true';
 if(!allowed()||active.size>=32&&!active.has(state)){finish(state);return;}
 active.add(state);paint(state);if(!frame){last=0;frame=requestAnimationFrame(tick);}
}
export function captureMotionLayout(root,selector='[data-work-key]'){
 return new Map([...root.querySelectorAll(selector)].slice(0,60).map(element=>[element.dataset.workKey||element.dataset.projectId,{rect:element.getBoundingClientRect(),state:states.get(element)}]));
}
export function settleMotionLayout(root,before,selector='[data-work-key]'){
 if(!allowed())return;
 const candidates=[...root.querySelectorAll(selector)].slice(0,60).map(element=>({element,previous:before.get(element.dataset.workKey||element.dataset.projectId),rect:element.getBoundingClientRect()}));
 for(const {element,previous,rect} of candidates){if(!previous||rect.bottom<0||rect.top>innerHeight)continue;const x=previous.rect.left-rect.left,y=previous.rect.top-rect.top;if(Math.abs(x)+Math.abs(y)<1)continue;
  const velocity=previous.state?Object.fromEntries(Object.entries(previous.state.values).map(([key,v])=>[key,v.velocity])):undefined;
  // Field's structural slabs use critical damping; small glyphs own the bounce.
  springTo(element,{x:0,y:0,scale:1},{kind:'layout',profile:{stiffness:520,damping:42.3,mass:.86},from:{x,y,scale:1},velocity});
 }
}
export function bindFieldMotion(root=document){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
 const selector='button:not(:disabled),a[href],summary,[role="button"]:not([aria-disabled="true"])';
 const control=event=>event.target instanceof Element?event.target.closest(selector):null;
 function set(node,state){if(!node)return;for(const glyph of node.querySelectorAll('[data-loew-glyph]')){const behavior=glyph.dataset.loewGlyph,variant=fieldGlyphVariants[behavior]||fieldGlyphVariants.generic;springTo(glyph,variant[state]);}}
 function over(event){const node=control(event);if(fine.matches&&event.pointerType!=='touch'&&!node?.contains(event.relatedTarget))set(node,'hover');}
 function out(event){const node=control(event);if(!node?.contains(event.relatedTarget))set(node,'rest');}
 const down=event=>set(control(event),'tap');
 const up=event=>{const node=control(event);set(node,fine.matches&&event.pointerType==='mouse'&&node?.matches(':hover')?'hover':'rest');};
 const focus=event=>set(control(event),'hover'),blur=event=>set(control(event),'rest');
 function toggle(event){const node=event.target;if(node instanceof HTMLDetailsElement&&node.matches('.presentation-menu,.inspector-card-studio')){const panel=node.querySelector('.presentation-panel,#chat-card-preview');if(panel&&node.open)springTo(panel,{y:0,scale:1},{kind:'panel',profile:fieldMotion.disclosure,from:{y:-6,scale:.985}});}}
 function preference(){if(!allowed()){for(const state of active)finish(state);if(frame)cancelAnimationFrame(frame);frame=0;last=0;}}
 const observer=new MutationObserver(preference);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-presentation-motion']});
 const listeners=[['pointerover',over],['pointerout',out],['pointerdown',down],['pointerup',up],['pointercancel',out],['focusin',focus],['focusout',blur],['toggle',toggle]];
 for(const [name,fn]of listeners)root.addEventListener(name,fn,true);document.addEventListener('visibilitychange',preference);reduced.addEventListener('change',preference);
 return()=>{for(const [name,fn]of listeners)root.removeEventListener(name,fn,true);document.removeEventListener('visibilitychange',preference);reduced.removeEventListener('change',preference);observer.disconnect();for(const state of active)finish(state);if(frame)cancelAnimationFrame(frame);frame=0;last=0;};
}
