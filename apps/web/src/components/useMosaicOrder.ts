import {useState} from 'react';
import {MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent} from '@dnd-kit/core';
import {sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {normalizeOrder,moveCard} from '../../public/mosaic-order.js';
const storageKey='relay.telemetry.order.v1';
const interactive=(target:EventTarget|null)=>target instanceof Element&&Boolean(target.closest('a,button,input,select,textarea,summary'))&&!target.closest('[data-drag-handle]');
class CardMouseSensor extends MouseSensor {
 static activators=MouseSensor.activators.map(activator=>({...activator,handler:(event:Parameters<typeof activator.handler>[0],options:Parameters<typeof activator.handler>[1])=>!interactive(event.target)&&activator.handler(event,options)}));
}
class CardTouchSensor extends TouchSensor {
 static activators=TouchSensor.activators.map(activator=>({...activator,handler:(event:Parameters<typeof activator.handler>[0],options:Parameters<typeof activator.handler>[1])=>!interactive(event.target)&&activator.handler(event,options)}));
}
export function useMosaicOrder(){
 const [order,setOrder]=useState<string[]>(()=>{try{return normalizeOrder(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{return normalizeOrder(null);}});
 const [editing,setEditing]=useState(false),[message,setMessage]=useState('');
 const sensors=useSensors(
  useSensor(CardMouseSensor,{activationConstraint:editing?{distance:6}:{delay:500,tolerance:8}}),
  useSensor(CardTouchSensor,{activationConstraint:{delay:500,tolerance:8}}),
  useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates})
 );
 function start(){setEditing(true);setMessage('arrange cards, then choose done to save');}
 function finish(){setEditing(false);try{localStorage.setItem(storageKey,JSON.stringify(order));setMessage('layout saved');}catch{setMessage('layout changed for this visit; saving is unavailable');}}
 function step(key:string,direction:number){setOrder(current=>{const i=current.indexOf(key),target=current[i+direction];return target?moveCard(current,key,target):current;});}
 function drop({active,over}:DragEndEvent){if(over&&active.id!==over.id){setOrder(current=>moveCard(current,String(active.id),String(over.id)));setMessage('card moved; choose done to save');}}
 return {order,editing,message,sensors,start,finish,step,drop,cancel:()=>setMessage('move cancelled; layout unchanged')};
}
