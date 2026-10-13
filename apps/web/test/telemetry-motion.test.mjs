import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

test('telemetry updates interpolate without remounts or layout-width animation', () => {
  const component = readFileSync(new URL('../src/components/LiveTelemetry.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.ok(component.includes('useTelemetryMotion('));
  assert.ok(!/strong[^>]*key=/.test(component));
  assert.ok(component.includes('transform:`scaleX('));
  assert.ok(!/transition:width 850ms/.test(css));
  assert.ok(!/animation:telemetry-value/.test(css));
});

test('telemetry browser motion handles interruption, reduced motion and first observations', async () => {
  const source = (await build({
    stdin: {
      contents: `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{useTelemetryMotion}from'./useTelemetryMotion';
function Probe(){const[target,setTarget]=useState([10,100]);const[enabled,setEnabled]=useState(true);
window.change=setTarget;window.enable=setEnabled;const value=useTelemetryMotion(target,enabled);
return <output data-values={JSON.stringify(value)}>{value.join(',')}</output>;}
createRoot(document.getElementById('root')).render(<Probe/>);`,
      resolveDir: fileURLToPath(new URL('../src/components', import.meta.url)),
      loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife',
  })).outputFiles[0].text;
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content:source});
    const values = () => page.locator('output').evaluate(node => JSON.parse(node.dataset.values));
    await page.waitForFunction(() => Boolean(window.change));
    assert.deepEqual(await values(), [10,100]);
    const samples = await page.evaluate(async () => {
      const read=()=>JSON.parse(document.querySelector('output').dataset.values);
      window.change([90,20]);
      await new Promise(resolve=>setTimeout(resolve,180));
      const middle=read();
      window.change([30,60]);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const interrupted=read();
      await new Promise(resolve=>setTimeout(resolve,800));
      return {middle,interrupted,final:read()};
    });
    assert.ok(samples.middle[0]>10 && samples.middle[0]<90);
    assert.ok(samples.middle[1]>20 && samples.middle[1]<100);
    assert.ok(Math.abs(samples.interrupted[0]-samples.middle[0])<15);
    assert.deepEqual(samples.final,[30,60]);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>window.change([70,40]));
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output').dataset.values)[0]===70);
    assert.deepEqual(await values(),[70,40]);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>window.enable(false));
    await page.evaluate(()=>window.change([5,80]));
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output').dataset.values)[0]===5);
    await page.evaluate(()=>{window.change([50,10]);window.enable(true);});
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output').dataset.values)[0]===50);
    assert.deepEqual(await values(),[50,10]);
  } finally { await browser.close(); }
});

test('actual LiveTelemetry keeps its DOM and interpolates chart updates at desktop and phone widths', async () => {
  const snapshot = count => ({
    fetchedAt: new Date().toISOString(),
    loadingProgress: [], failedProgress: [],
    workload: {relay: [
      {state:'completed',completed_at:new Date().toISOString()},
      {state:'active'}, {state:'active'}, {state:'active'}
    ]},
    progress: {relay: {progress: Array.from({length:count},(_,index)=>({
      assignment:'fixture-'+index,state:'working',
      events:[{id:'fixture-event-'+index,type:'source-commit',at:new Date(Date.now()-60000).toISOString()}]
    }))}}
  });
  const first = snapshot(1), second = snapshot(8), third = snapshot(3);
  const source = (await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';
import{LiveTelemetry}from'./LiveTelemetry';
createRoot(document.getElementById('root')).render(<LiveTelemetry/>);`,
      resolveDir: fileURLToPath(new URL('../src/components', import.meta.url)), loader:'tsx'
    },
    bundle:true,write:false,format:'iife',jsx:'automatic',loader:{'.png':'dataurl'},
    plugins:[{
      name:'bounded-telemetry-fixture',
      setup(build){
        build.onResolve({filter:/^\.\.\/live$/},()=>({path:'live',namespace:'fixture'}));
        build.onResolve({filter:/^\.\.\/api$/},()=>({path:'api',namespace:'fixture'}));
        build.onLoad({filter:/.*/,namespace:'fixture'},args=>({
          contents:args.path==='api'?
            'export const projectLabel = value => value;':
            `import{useState}from'react';export function useLiveRelay(){const[allSnapshot,setSnapshot]=useState(${JSON.stringify(first)});window.setRelaySnapshot=setSnapshot;return{allSnapshot,state:'live',eventConnected:true,refresh:async()=>{}};}`,
          loader:'js',resolveDir:rootForFixture()
        }));
      }
    }]
  })).outputFiles[0].text;
  function rootForFixture(){return fileURLToPath(new URL('..',import.meta.url));}
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  const browser=await chromium.launch({headless:true});
  try {
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'no-preference'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.setContent('<main class="relay-home"><div id="root"></div></main>');
      await page.addStyleTag({content:css});
      await page.addScriptTag({content:source});
      await page.locator('.live-telemetry[data-complete=true]').waitFor();
      await page.waitForFunction(()=>document.querySelector('.telemetry-state strong').textContent==='1');
      const outcome=await page.evaluate(async ({second,third})=>{
        const strong=document.querySelector('.telemetry-state strong');
        const line=()=>document.querySelector('.telemetry-chart-line').getAttribute('d');
        const initial=line();
        window.setRelaySnapshot(second);
        await new Promise(resolve=>setTimeout(resolve,180));
        const middle={count:Number(strong.textContent),line:line()};
        window.setRelaySnapshot(third);
        await new Promise(resolve=>setTimeout(resolve,850));
        return{sameNode:strong===document.querySelector('.telemetry-state strong'),initial,middle,final:{count:Number(strong.textContent),line:line()},width:document.querySelector('.telemetry-meter span').style.width};
      },{second,third});
      assert.equal(outcome.sameNode,true,'updates never remount the counter');
      assert.ok(outcome.middle.count>1&&outcome.middle.count<8,'a real intermediate count is painted');
      assert.notEqual(outcome.middle.line,outcome.initial,'chart geometry advances between observations');
      assert.equal(outcome.final.count,3,'interrupted count settles to the latest record');
      assert.notEqual(outcome.final.line,outcome.middle.line);
      assert.equal(outcome.width,'','meter animation does not write layout widths');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(value=>window.setRelaySnapshot(value),second);
      await page.waitForFunction(()=>document.querySelector('.telemetry-state strong').textContent==='8');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'telemetry fits viewport');
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {await browser.close();}
});
