import test from 'node:test';
import assert from 'node:assert/strict';
import {bindLiveEvents} from '../public/live-events.js';
test('authenticated event invalidation is coalesced, never replaces state, and releases its connection',async()=>{
 let socket,wakes=0;const states=[];
 class Socket {constructor(url){this.url=url;socket=this;}close(){this.onclose?.();}send(){} }
 const close=bindLiveEvents({host:{href:'https://relay.loew.fi/'},Socket,invalidate:()=>wakes++,connection:value=>states.push(value)});
 assert.equal(socket.url,'wss://relay.loew.fi/api/events');socket.onopen();socket.onmessage({data:JSON.stringify({type:'resync',cursor:'2'})});socket.onmessage({data:JSON.stringify({type:'change',id:'3',topics:['work']})});socket.onmessage({data:'untrusted non-JSON'});
 await new Promise(resolve=>setTimeout(resolve,230));assert.equal(wakes,1);assert.deepEqual(states,[true]);close();assert.equal(states.at(-1),false);
 const disabled=bindLiveEvents({disabled:true,Socket,invalidate:()=>assert.fail('disabled MCP mode does not open a socket')});disabled();
});
