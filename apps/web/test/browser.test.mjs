// The former full Inspector browser surface is preserved in the retirement checkpoint.
// Keep shared camera mathematics and verify the production exposure boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webAssets,mcpHtml} from '../generated.js';
import {reactJs} from '../generated-react.js';
import {legacyScript} from '../generated-inspector.js';
import {fitTransform,wheelPanDelta,wheelZoomFactor} from '../public/qa-viewport.js';

test('Inspector camera math mirrors Field input semantics',()=>{
 const fit=fitTransform(1200,800,1440,900);assert.ok(fit.scale>0&&fit.scale<=2);assert.ok(Number.isFinite(fit.x)&&Number.isFinite(fit.y));
 const pan=wheelPanDelta({deltaMode:0,deltaX:12,deltaY:18},800);assert.ok(pan.dx<0&&pan.dy<0);
 assert.ok(wheelZoomFactor({deltaMode:0,deltaY:-12,metaKey:false})>1);
});
test('production and standalone Vite entrypoints cannot expose the retired Inspector program',async()=>{
 assert.equal(legacyScript,'');
 for(const path of ['/relay-app.js','/operator.js','/mcp-bridge.js','/qa.js'])assert.equal(webAssets[path],undefined,path);
 assert.doesNotMatch(reactJs,/operator-nav react-operator-nav|data-bulk|qa-review-loading/);
 assert.doesNotMatch(mcpHtml,/<script|<iframe|tools\/call|relay_ui_request/);
 const config=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');assert.match(config,/publicDir:\s*false/);
 const builder=await readFile(new URL('../build.mjs',import.meta.url),'utf8');assert.match(builder,/publicDir:\s*false/);assert.doesNotMatch(builder,/bundle\("public\/operator\.js"\)/);
});
