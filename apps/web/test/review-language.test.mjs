// The unshipped panel tests formerly at this path are checkpointed at d412624.
// This file now covers the backend diagnostic/presentation boundary only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ControlError} from '../../../src/runner-control-core.js';
import {runnerControlError} from '../../../src/runner-control.js';
import {withHumanPresentation} from '../../../src/human-presentation.js';
const operation={name:'relay_runner_coordinate',kind:'command'};

test('provider diagnostics do not turn an unconfirmed write into a different human outcome or a retry promise',()=>{
 for(const status of [401,403,429,500]){
  const error=new ControlError('uncertain_write','Readback differs from the proposed transaction.',{record_sha:'a'.repeat(40),github:{provider:'github',status,method:'PUT',endpoint:'/repos/lrnolivia/relay/contents/coordination/relay.json',phase:'resource_request',auth_mode:'github_app_installation',retry_after_seconds:60,token:'private-fixture-value'}});
  const raw=runnerControlError(error),before=structuredClone(raw),result=withHumanPresentation(raw,{operation});
  assert.deepEqual(raw,before);assert.deepEqual(result.error,raw.error);
  assert.equal(result.error.upstream.status,status);assert.equal(result.error.retryable,false);
  assert.equal(result.human_v1.message_id,'error.uncertain_write');
  assert.match(result.human_v1.summary,/couldn't confirm whether or not the change was saved/);
  assert.match(result.human_v1.next_step,/Check the latest status before trying again/);
  assert.doesNotMatch(JSON.stringify(result),/private-fixture-value|will retry|retry scheduled/i);
  const legacy=withHumanPresentation(raw,{operation,mode:'legacy'});assert.equal(legacy.human_v1,undefined);assert.deepEqual(legacy.error,result.error);
 }
});

test('direct provider failures retain their original auth, permission and quota distinctions',()=>{
 for(const [status,code,messageId] of [[401,undefined,'error.auth'],[403,undefined,'error.permission'],[429,'rate_limit','error.rate_limit']]){
  const error=Object.assign(new Error('Bearer private-fixture-value'),{status,code,github:{provider:'github',status,method:'GET',endpoint:'/repos/lrnolivia/relay/contents/projects/relay.json',phase:'resource_request',auth_mode:'github_app_installation'}});
  const result=withHumanPresentation(runnerControlError(error),{operation:{name:'relay_runner_assignments',kind:'query'}});
  assert.equal(result.human_v1.message_id,messageId);assert.doesNotMatch(JSON.stringify(result),/private-fixture-value/);
 }
});
