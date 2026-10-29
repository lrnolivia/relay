import {createHash} from 'node:crypto';
// Stage one deliberately cannot create the new format. Enable only after this
// reader/writer is the independently verified healthy rollback baseline.
export const CONTEXT_ROLLOVER_ENABLED = false;
export const CONTEXT_STORAGE_SCHEMA_CAPABILITY = 2;
export const contextHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digest = text => createHash('sha256').update(text).digest('hex');
const LEAF_SIZE = 32;
const clone = value => JSON.parse(JSON.stringify(value));

// Immutable bounded radix nodes. Root replacement is the only commit point;
// failed CAS leaves harmless unreachable nodes, never a partial live migration.
export class ContextTree {
 constructor(bucket,project){this.bucket=bucket;this.prefix=`context/v2/${project}/nodes/`;this.cache=new Map();this.visits=0;this.writes=0;}
 async node(id){
  if(!id)return null;if(++this.visits>2048)throw Error('Context tree traversal budget exceeded; preserve history');
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid context node identity');
  if(this.cache.has(id))return this.cache.get(id);
  const object=await this.bucket.get(this.prefix+id);if(!object)throw Error('Context history unavailable');
  const text=await object.text();if(text.length>1048576)throw Error('Context node exceeds safety bound');if(digest(text)!==id)throw Error('Context history integrity failure');
  const value=JSON.parse(text);
  if(value.kind==='leaf'){
   if(!Array.isArray(value.items)||!value.items.length||value.items.length>LEAF_SIZE||value.items.some((x,i)=>!Array.isArray(x)||x.length!==2||!/^[a-f0-9]{64}$/.test(x[0])||(i&&value.items[i-1][0]>=x[0])))throw Error('Invalid context leaf');
  }else if(value.kind==='branch'){
   if(!value.children||!Object.keys(value.children).length||Object.keys(value.children).length>16||new Set(Object.values(value.children)).size!==Object.keys(value.children).length||Object.entries(value.children).some(([k,v])=>!/^[a-f0-9]$/.test(k)||!/^[a-f0-9]{64}$/.test(v)))throw Error('Invalid context branch');
  }else throw Error('Invalid context node');
  this.cache.set(id,value);return value;
 }
 async save(value){
  const text=JSON.stringify(value),id=digest(text),key=this.prefix+id;if(++this.writes>256||text.length>1048576)throw Error('Context write exceeds safety budget; live history retained');
  await this.bucket.put(key,text,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
  const check=await this.bucket.get(key);if(!check||await check.text()!==text)throw Error('Context history write could not be verified; live history retained');
  this.cache.set(id,value);return id;
 }
 async build(items,depth=0){
  items=[...items].sort((a,b)=>a[0].localeCompare(b[0]));
  if(!items.length)return null;
  if(items.length<=LEAF_SIZE)return this.save({kind:'leaf',items});
  if(depth>=64)throw Error('Context index collision');
  const children={};for(const digit of '0123456789abcdef'){const group=items.filter(x=>x[0][depth]===digit);if(group.length)children[digit]=await this.build(group,depth+1);}
  return this.save({kind:'branch',children});
 }
 async get(root,key,depth=0){const node=await this.node(root);if(!node)return null;if(node.kind==='leaf')return clone(node.items.find(x=>x[0]===key)?.[1]??null);if(depth>=64)throw Error('Invalid context depth');return this.get(node.children[key[depth]],key,depth+1);}
 async set(root,key,value,depth=0){
  const node=await this.node(root);
  if(!node||node.kind==='leaf'){const items=(node?.items||[]).filter(x=>x[0]!==key);items.push([key,value]);return this.build(items,depth);}
  if(depth>=64)throw Error('Invalid context depth');
  const children={...node.children,[key[depth]]:await this.set(node.children[key[depth]],key,value,depth+1)};return this.save({kind:'branch',children});
 }
 async page(root,after='',limit=64){
  const items=[];let more=false;
  const visit=async(id,prefix='')=>{
   if(!id||more)return;if(after&&prefix&&prefix<after.slice(0,prefix.length))return;
   const node=await this.node(id);if(node.kind==='leaf'){if(node.items.some(x=>!x[0].startsWith(prefix)))throw Error('Context leaf prefix mismatch');for(const x of node.items){if(x[0]<=after)continue;if(items.length===limit){more=true;return;}items.push(clone(x));}return;}
   if(prefix.length>=64)throw Error('Invalid context depth');
   for(const digit of Object.keys(node.children).sort())await visit(node.children[digit],prefix+digit);
  };await visit(root);return {items,next:more?items.at(-1)[0]:null};
 }
}
export async function openContext(bucket,project){
 const key=`context/v1/${project}.json`,object=await bucket.get(key),record=object?await object.json():{schema:1,revision:0,entries:[],operations:[]};
 if(!Number.isSafeInteger(record.revision)||record.revision<0)throw Error('Invalid durable context');
 if(record.schema===1){if(!Array.isArray(record.entries)||!Array.isArray(record.operations)||record.archives?.length)throw Error('Unsupported legacy archive format; preserve history for reconciliation');}
 else if(record.schema!==2||record.format!=='relay-context-tree-v1'||(!Array.isArray(record.relationships)||record.relationships.length>200))throw Error('Invalid durable context');
 if(record.schema===2){for(const field of ['entries_root','operations_root'])if(!Object.hasOwn(record,field)||(record[field]!==null&&(typeof record[field]!=='string'||!/^[a-f0-9]{64}$/.test(record[field]))))throw Error('Invalid context root manifest');if(record.relationships.some(x=>!x||typeof x.id!=='string'||!['relationship-signal','relationship-note'].includes(x.kind))||new Set(record.relationships.map(x=>x.id)).size!==record.relationships.length)throw Error('Invalid relationship manifest');}
 const tree=new ContextTree(bucket,project);
 return {record,tree,
  async entry(id){return record.schema===1?record.entries.find(x=>x.id===id):tree.get(record.entries_root,contextHash(id));},
  async operation(id){return record.schema===1?record.operations.find(x=>x.id===id):tree.get(record.operations_root,contextHash(id));},
  async migrate(){if(record.schema===2)return;if(!CONTEXT_ROLLOVER_ENABLED)throw Error('Context rollover awaits verified compatible rollback baseline');const entries=record.entries,operations=record.operations;record.entries_root=await tree.build(entries.map(x=>[contextHash(x.id),x]));record.operations_root=await tree.build(operations.map(x=>[contextHash(x.id),x]));record.relationships=entries.filter(x=>x.kind.startsWith('relationship-'));record.schema=2;record.format='relay-context-tree-v1';delete record.entries;delete record.operations;},
  async putEntry(entry){if(record.schema===1){const at=record.entries.findIndex(x=>x.id===entry.id);if(at<0)record.entries.push(entry);else record.entries[at]=entry;}else{record.entries_root=await tree.set(record.entries_root,contextHash(entry.id),entry);if(entry.kind.startsWith('relationship-')){record.relationships=record.relationships.filter(x=>x.id!==entry.id);record.relationships.push(entry);}}},
  async putOperation(operation){if(record.schema===1)record.operations.push(operation);else record.operations_root=await tree.set(record.operations_root,contextHash(operation.id),operation);},
  async commit(){const written=await bucket.put(key,JSON.stringify(record),{onlyIf:object?{etagMatches:object.etag}:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});if(!written)throw Error('Context storage changed; re-read before retrying');}
 };
}
