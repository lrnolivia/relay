export const CTRL_ORIGIN='https://ctrl.loew.fi';
export function ctrlHref(destination) {
 const value=String(destination||'');
 const url=new URL(value.startsWith('#')?'/'+value:value,'https://relay.loew.fi');
 if(!['https://relay.loew.fi',CTRL_ORIGIN].includes(url.origin))throw Error('Workspace link must use a canonical product origin');
 const route=url.pathname==='/'?url.hash.slice(1).split('?')[0]:url.pathname;
 if(!/^\/(?:today|now|runner|night-shift|inspector)(?:\/|$)/.test(route))throw Error('Unsupported workspace destination');
 url.protocol='https:';url.host='ctrl.loew.fi';
 if(url.hash.startsWith('#/today'))url.hash=url.hash.replace('#/today','#/now');
 return url.href;
}
// Keep external source/preview URLs and Relay connection controls unchanged.
export function workspaceLink(value) {
 try{return ctrlHref(value);}catch{return value;}
}
