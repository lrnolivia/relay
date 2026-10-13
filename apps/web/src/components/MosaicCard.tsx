import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useEffect,useState,type ReactNode,type CSSProperties} from 'react';
export function MosaicCard({id,editing,children}:{id:string;editing:boolean;children:ReactNode}){
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 const {setNodeRef,setActivatorNodeRef,attributes,listeners,transform,transition,isDragging}=useSortable({id,transition:reduced?null:{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'}});
 const style:CSSProperties={transform:CSS.Translate.toString(transform),transition,zIndex:isDragging?2:undefined};
 return <article ref={setNodeRef} className={'telemetry-card telemetry-'+id} data-card={id} data-dragging={isDragging} style={style} {...listeners}>
  {editing&&<button ref={setActivatorNodeRef} type="button" className="telemetry-drag-handle" data-drag-handle {...attributes} {...listeners} aria-label={'drag '+id+' card'}><span aria-hidden="true">⠿</span></button>}
  {children}
 </article>;
}
