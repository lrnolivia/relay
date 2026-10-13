import test from 'node:test';
import assert from 'node:assert/strict';
import {TEAMS, normalizeAssignmentTeams} from './team-registry.js';
import {STAFF, normalizeAssignmentStaff, callStaffDirectory} from './staff-registry.js';

test('canonical teams and sticky home teams cover every approved staff identity',()=>{
  assert.deepEqual(TEAMS.map(t=>t.id),['inspector','runner','night-shift','source','cloud','release','skills']);
  for(const person of STAFF.filter(p=>p.status!=='retired')) {
    assert.ok(TEAMS.some(t=>t.id===person.home_team));
    assert.ok(person.team_memberships.includes(person.home_team));
  }
  assert.equal(STAFF.find(p=>p.id==='roman').home_team,'inspector');
  assert.ok(STAFF.find(p=>p.id==='roman').team_memberships.includes('release'));
  assert.equal(STAFF.find(p=>p.id==='felix').home_team,null);
});
test('roles and explicit teams route before active staff without granting authority',()=>{
  for(const [category,team,staff] of [['design','inspector','valentina'],['implementation','runner','nico'],['coordination','night-shift','julian'],['release','release','luca'],['research','night-shift','naomi']]) {
    const result=normalizeAssignmentStaff({category});
    assert.equal(result.primary_team,team);assert.equal(result.primary_staff,staff);
  }
  assert.equal(normalizeAssignmentStaff({primary_team:'source',primary_role:'integrator'}).primary_staff,'rafael');
  assert.equal(normalizeAssignmentTeams({resources:['relay-cloud-runtime']}).primary_team,'cloud');
  assert.throws(()=>normalizeAssignmentTeams({primary_team:'admin'}),/Unknown/);
  assert.throws(()=>normalizeAssignmentTeams({primary_team:'runner',supporting_teams:['runner']}),/Duplicate/);
  assert.equal(normalizeAssignmentStaff({primary_team:'runner',primary_role:'brand-launch'}).primary_staff,null);
});
test('cross-team support keeps home identity and directory bindings use canonical owners',()=>{
  const assignment={id:'release-task',owner:'machine-owner',branch:'relay/task',state:'active',primary_team:'release',supporting_teams:['inspector'],primary_staff:'luca',supporting_staff:['roman']};
  const directory=callStaffDirectory({staff:'Roman'},STAFF,[assignment,{...assignment,id:'closed',state:'completed'}]);
  assert.equal(directory.staff.home_team,'inspector');
  assert.deepEqual(directory.staff.assignment_bindings,[{id:'release-task',owner:'machine-owner',branch:'relay/task',state:'active',primary_team:'release',supporting_teams:['inspector'],participation:'supporting'}]);
  assert.equal(directory.policy.identity_is_authority,false);
  assert.equal(normalizeAssignmentStaff({...assignment,category:'design'}).primary_staff,'luca');
});
