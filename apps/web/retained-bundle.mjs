import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {normalizeRetainedBundle,previewDigest} from '../../src/retained-preview.js';
const scriptText=value=>String(value).replace(/<\/script/gi,'<\\/script');
const jsonScript=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function retainedFontCss(fetcher=fetch){
 const url='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Momo+Trust+Display&display=swap';
 const response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Retained font stylesheet unavailable: '+response.status);
 let css=await response.text();const urls=[...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(match=>match[1].replace(/["']/g,'')))];
 if(urls.length>32)throw Error('Retained font request budget exceeded');let total=0;
 for(const source of urls){const target=new URL(source);if(target.protocol!=='https:'||target.hostname!=='fonts.gstatic.com'||target.username||target.password)throw Error('Unexpected font source');const result=await fetcher(target.href,{signal:AbortSignal.timeout(30000)});if(!result.ok)throw Error('Retained font asset unavailable: '+result.status);const bytes=new Uint8Array(await result.arrayBuffer());total+=bytes.length;if(bytes.length>1024*1024||total>3*1024*1024)throw Error('Retained font size budget exceeded');const type=(result.headers.get('content-type')||'font/woff2').split(';')[0];if(!/^(font\/(woff2?|ttf)|application\/(font-woff|x-font-ttf|octet-stream))$/.test(type))throw Error('Unexpected font content type');css=css.split(source).join('data:'+type+';base64,'+Buffer.from(bytes).toString('base64'));}
 return css;
}
export async function createRetainedBundle({webAssets,sourceSha,buildId,createdAt=new Date().toISOString(),fontCss}){
 const compiled=await build({entryPoints:[fileURLToPath(new URL('./retained-fixture.js',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true});
 const fixture=compiled.outputFiles[0].text,fonts=fontCss===undefined?await retainedFontCss():fontCss;
 const documents={};
 for(const [entry,path] of [['app','/'],['inspector','/inspector']]){
  let html=webAssets[path]?.text;if(!html)throw Error('Missing compiled retained document: '+entry);
  html=html.replace(/<link\b[^>]*>/gi,tag=>{
   const href=tag.match(/href=["']([^"']+)["']/i)?.[1],rel=tag.match(/rel=["']([^"']+)["']/i)?.[1];
   if(rel==='preconnect'||rel==='modulepreload')return '';
   if(rel!=='stylesheet')return tag;
   const css=href?.startsWith('https://fonts.googleapis.com/')?fonts:webAssets[href]?.text;
   if(typeof css!=='string')throw Error('Retained stylesheet was not bundled: '+href);
   return '<style>'+css.replace(/<\/style/gi,'<\\/style')+'</style>';
  });
  html=html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,(_,before,src,after)=>{
   const asset=webAssets[src];if(!asset?.type?.includes('javascript'))throw Error('Retained script was not bundled: '+src);
   return '<script'+before+after+'>'+scriptText(asset.text)+'</script>';
  });
  const config={entry,source_sha:sourceSha,build_id:buildId,created_at:createdAt,data_mode:'synthetic'};
  html=html.replace(/<head([^>]*)>/i,match=>match+'<script>window.__RETAINED_BUILD__='+jsonScript(config)+';'+scriptText(fixture)+'</script>');
  documents[entry]=html;
 }
 const bundle=normalizeRetainedBundle({schema:1,project:'relay',source_sha:sourceSha,build_id:buildId,created_at:createdAt,fixture_version:1,data_mode:'synthetic',documents});
 return {bundle,sha256:await previewDigest(JSON.stringify(bundle))};
}
