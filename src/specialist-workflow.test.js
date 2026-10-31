import test from 'node:test';
import assert from 'node:assert/strict';
import {stageSpecialist,specialistWorkflow} from './specialist-workflow.js';

const assignment={state:'active',primary_staff:'nico',primary_team:'runner',supporting_staff:['roman','rafael'],supporting_teams:['inspector','source']};
test('coordinator selects a relevant routed specialist, never rotates staff or promotes a team to staffing',()=>{
 assert.deepEqual(stageSpecialist({id:'verify',kind:'test'},assignment).owner,{staff:'roman',team:'inspector'});
 assert.deepEqual(stageSpecialist({id:'integrate',kind:'implementation',specialist_role:'integrator'},assignment).owner,{staff:'rafael',team:'source'});
 assert.throws(()=>stageSpecialist({id:'verify',kind:'test'},{...assignment,supporting_staff:[]}),/staffing required/);
 assert.throws(()=>stageSpecialist({id:'verify',kind:'test'},{...assignment,supporting_staff:['felix']}),/staffing required/);
 assert.equal(stageSpecialist({kind:'ship',command:['trusted']},assignment),null);
 assert.throws(()=>stageSpecialist({id:'review',kind:'review',specialist_role:'verifier'},{}),/staffing required/);
});
test('ordinary coordinator guidance makes activation and capability limits explicit without inventing contribution',()=>{
 const workflow=specialistWorkflow(assignment);
 assert.equal(workflow.required,true);assert.equal(workflow.coordinator_only,true);assert.equal(workflow.participation,'routing');
 assert.match(workflow.steps.join(' '),/actual authorized host subagent/);
 assert.match(workflow.steps.join(' '),/single-job CLI execution does not itself/);
});
