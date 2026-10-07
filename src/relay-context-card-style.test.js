import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { relayContextCardResource, relayStatusCardResource, contextCardModel } from './relay-chat-ui.js';
import { styleContextCard } from './relay-context-card-style.js';
import { contextCardBrandAssets } from '../apps/web/generated.js';

test('versioned legacy bridge preserves the byte-exact host and style shell', () => {
  // The v4 presentation program intentionally changes. Its generated model has
  // separate server/browser parity tests; all surrounding v3 host/style bytes
  // remain bound to the independently verified pre-migration shell hash.
  const shell=relayStatusCardResource().text.replace(/const DIRECTORY=[\s\S]*?(?=const FEATURES=)/,'');
  assert.equal(createHash('sha256').update(shell).digest('hex'), '7f4696e724d991398f6def4dc5b34006f580c59415aec3b478643fec9b37d40c');
  assert.doesNotMatch(relayStatusCardResource().text, /data-context-card-parity|CARD_BRAND_ASSETS/);
});
test('context card embeds canonical artwork and Momo without external fonts', () => {
  const html = relayContextCardResource().text;
  for (const name of ['relay','runner','inspector','night-shift']) assert.ok(html.includes(contextCardBrandAssets[name]));
  assert.match(html, /data:font\/woff;base64,/);
  assert.match(html, /SIL OPEN FONT LICENSE Version 1.1/);
  assert.match(html, /font-family:"Momo Trust Display"/);
  assert.match(html, /id="feature-kicker"[^>]*hidden aria-hidden="true"/);
  assert.ok(html.indexOf('id="diag"') > html.indexOf('<details id="details"'));
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.ok(Buffer.byteLength(html) < 512 * 1024, 'self-contained card remains bounded');
  assert.equal(html.split(contextCardBrandAssets.relay).length-1,1,'canonical initial icon bytes are embedded once');
  assert.match(html,/CARD_BRAND_ASSETS=\{"relay":document\.querySelector\("#feature-mark img"\)\.getAttribute\("src"\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /visibilitychange/);
});
test('no reported percentage is represented as unknown, never invented zero', () => {
  for (const value of [undefined,null,'',' ',false,true,{},'unknown',-1,101,Infinity]) {
    const model = contextCardModel({project:'relay', progress_percent:value});
    assert.equal(model.percent,null,JSON.stringify(value));
    assert.notEqual(model.metric,'0%');
  }
  assert.equal(contextCardModel({project:'relay',progress_percent:0}).percent,0);
  assert.equal(contextCardModel({project:'relay',progress_percent:'42'}).percent,42);
});
test('asset omissions fail the build instead of shipping broken brand images', () => {
  assert.throws(() => styleContextCard('',{}), /Missing bundled card brand/);
  assert.throws(() => styleContextCard('',{...contextCardBrandAssets,relay:'https://untrusted.example/icon.png'}), /Missing bundled card brand/);
});

test('material explanations and actionable next steps remain visible without duplicated status metrics',()=>{
  const html=relayContextCardResource().text;
  assert.match(html,/data-signal="danger".*summary[\s\S]*?-webkit-line-clamp:unset!important/);
  assert.match(html,/#next:not\(\[hidden\]\)\{display:block!important\}/);
  assert.match(html,/m\.has_metric===false\?'none':''/);
  const failure=contextCardModel({ok:false,error:{class:'uncertain_write'}});
  assert.equal(failure.blocker,null);assert.equal(failure.has_metric,false);
  assert.match(failure.summary,/whether or not/);assert.match(failure.next_step,/status before/);
  const assigned=contextCardModel({claim:{state:'active'}});
  assert.equal(assigned.has_metric,false);
  assert.equal(contextCardModel({claims:[{state:'active'}]}).has_metric,true);
});
