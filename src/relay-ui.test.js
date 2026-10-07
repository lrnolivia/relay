import test from 'node:test';
import assert from 'node:assert/strict';
import {RELAY_CONTROL_CENTER_URI,relayControlCenterResource} from './relay-ui.js';
test('legacy control-center capability is an inert CTRL handoff, not a duplicate application',()=>{
 const resource=relayControlCenterResource();
 assert.equal(RELAY_CONTROL_CENTER_URI,'ui://relay/control-center/v5-ctrl-handoff.html');
 assert.equal(resource.uri,RELAY_CONTROL_CENTER_URI);assert.equal(resource.mimeType,'text/html;profile=mcp-app');
 assert.match(resource.text,/data-relay-ctrl-handoff/);assert.match(resource.text,/https:\/\/ctrl.loew.fi\/#\/now/);
 assert.doesNotMatch(resource.text,/<script|<iframe|id="root"|operator-nav|relay_ui_request|tools\/call|data-page="review"/);
 assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);
});
