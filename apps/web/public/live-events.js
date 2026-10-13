// Invalidation wakes a canonical re-read; event payloads never replace project truth.
export function bindLiveEvents({invalidate,connection=()=>{},host=globalThis.location,Socket=globalThis.WebSocket,disabled=false}) {
 if(disabled||!Socket||!host)return ()=>{};
 let socket,closed=false,retry=null,debounce=null,heartbeat=null,cursor='',attempt=0;
 const wake=()=>{if(!debounce)debounce=setTimeout(()=>{debounce=null;invalidate();},200);};
 function connect(){
  if(closed)return;
  const url=new URL('/api/events',host.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';if(cursor)url.searchParams.set('cursor',cursor);
  socket=new Socket(url.href);
  socket.onopen=()=>{attempt=0;connection(true);heartbeat=setInterval(()=>{if(socket.readyState===1)socket.send('ping');},30000);};
  socket.onmessage=event=>{if(event.data==='pong')return;let value;try{value=JSON.parse(event.data);}catch{return;}
   if(value.type==='resync'&&/^\d{1,20}$/.test(value.cursor||'')){cursor=value.cursor;wake();}
   if(value.type==='change'&&/^\d{1,20}$/.test(value.id||'')&&Array.isArray(value.topics)){cursor=value.id;if(value.topics.some(topic=>['work','projects','workers','reviews','evidence'].includes(topic)))wake();}
  };
  socket.onerror=()=>socket.close();
  socket.onclose=()=>{connection(false);clearInterval(heartbeat);if(!closed)retry=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));};
 }
 connect();return()=>{closed=true;clearTimeout(retry);clearTimeout(debounce);clearInterval(heartbeat);socket?.close();};
}
