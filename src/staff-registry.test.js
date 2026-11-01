import test from "node:test";
import assert from "node:assert/strict";
import {
  STAFF,
  STAFF_POLICY,
  validateStaffRegistry,
  getStaff,
  listStaff,
  staffCandidates,
  bindStaffIdentity,
  assertStaffNameAvailable,
  staffDirectorySnapshot
} from "./staff-registry.js";

test("canonical staff roster has expected active, reserve, and retired identities", () => {
  assert.equal(validateStaffRegistry(STAFF), true);
  const snapshot = staffDirectorySnapshot();
  assert.deepEqual(snapshot.counts, { active: 21, reserve: 0, retired: 1 });
  assert.equal(STAFF_POLICY.identity_is_sticky, true);
  assert.equal(STAFF_POLICY.identity_is_authority, false);
  assert.equal(STAFF_POLICY.canned_jokes, false);

  const activeNames = listStaff({ status: "active" }).map(person => person.display_name);
  for (const name of ["Julian","Valentina","Vivienne","Naomi","Ellis","Luca","Nico","Margot","Roman","Imani","Rafael","Adrian","Gabriel","Sabine"]) {
    assert.ok(activeNames.includes(name), `missing active staff: ${name}`);
  }
  const reserveNames = listStaff({ status: "reserve" }).map(person => person.display_name);
  assert.deepEqual(reserveNames.sort(), []);
  assert.equal(getStaff("Felix").status, "retired");
});

test("sticky names resolve case-insensitively and cannot be silently reused", () => {
  assert.equal(getStaff("roman").id, "roman");
  assert.equal(getStaff("ROMAN").display_name, "Roman");
  assert.throws(() => assertStaffNameAvailable("Roman"), /already sticky/);
  assert.throws(() => assertStaffNameAvailable("felix"), /already sticky/);
  assert.throws(() => assertStaffNameAvailable("Celeste"), /already sticky/);
  assert.equal(assertStaffNameAvailable("UnassignedExample"), true);
});

test("retired staff cannot be bound and binding preserves canonical owner authority", () => {
  assert.throws(() => bindStaffIdentity({
    staff_id: "felix",
    owner_id: "worker-1"
  }), /Retired staff identity/);

  const binding = bindStaffIdentity({
    staff_id: "rafael",
    owner_id: "relay-source-worker-01",
    assignment: "relay-source-repair",
    worker: "worker-42"
  });
  assert.equal(binding.staff_id, "rafael");
  assert.equal(binding.display_name, "Rafael");
  assert.equal(binding.owner_id, "relay-source-worker-01");
  assert.equal(binding.assignment, "relay-source-repair");
  assert.equal(binding.role, "integrator");

  assert.throws(() => bindStaffIdentity({ staff_id: "rafael" }), /owner_id is required/);
});

test("role and subnet lookup is deterministic and excludes retired identities", () => {
  const source = staffCandidates({ subnet: "source" });
  assert.deepEqual(source.map(person => person.display_name), ["Rafael"]);
  const creative = staffCandidates({ subnet: "creative" });
  assert.deepEqual(creative.map(person => person.display_name), ["Bianca","Margot","Sabine","Valentina"]);
  assert.equal(creative.some(person => person.status === "retired"), false);

  const verify = listStaff({ role: "verification" });
  assert.deepEqual(verify.map(person => person.display_name), ["Celeste","Luca","Roman","Theo"]);
});

test("personality metadata shapes presentation but never authority or truth policy", () => {
  const julian = getStaff("julian");
  assert.equal(julian.personality.humor_tolerance, "lead");
  assert.ok(julian.personality.strengths.includes("coordination"));
  assert.equal(STAFF_POLICY.personality_affects_truth, false);

  const margot = getStaff("margot");
  assert.match(margot.personality.voice, /sharp/);
  assert.ok(margot.personality.quirks.some(item => /gradients/i.test(item)));
});

test("validator rejects duplicate ids, duplicate names, retired records without reason, and missing personalities", () => {
  const base = STAFF.slice(0, 2).map(person => ({
    ...person,
    role: { ...person.role },
    role_affinities: [...person.role_affinities],
    subnets: [...person.subnets],
    subsystems: [...person.subsystems],
    worker_bindings: [...person.worker_bindings],
    personality: person.personality ? {
      ...person.personality,
      strengths: [...person.personality.strengths],
      quirks: [...person.personality.quirks]
    } : null
  }));

  assert.throws(() => validateStaffRegistry([base[0], { ...base[1], id: base[0].id }]), /Duplicate staff id/);
  assert.throws(() => validateStaffRegistry([base[0], { ...base[1], display_name: base[0].display_name.toLowerCase() }]), /Duplicate or empty staff name/);
  assert.throws(() => validateStaffRegistry([{ ...base[0], status: "retired", retired_reason: "", personality: null }]), /requires a reason/);
  assert.throws(() => validateStaffRegistry([{ ...base[0], personality: null }]), /requires personality/);
});


test("bounded staff directory read contract supports person and subnet lookup", async () => {
  const mod = await import("./staff-registry.js");
  const { staffDirectoryTool, validateStaffDirectoryArguments, callStaffDirectory } = mod;
  assert.equal(staffDirectoryTool.name, "relay_staff_directory");
  assert.equal(staffDirectoryTool.annotations.readOnlyHint, true);
  assert.equal(validateStaffDirectoryArguments({ staff: "Roman" }).staff, "Roman");
  assert.throws(() => validateStaffDirectoryArguments({ surprise: true }), /Unsupported staff directory argument/);

  const roman = callStaffDirectory({ staff: "roman" });
  assert.equal(roman.namespace, "relay.STAFF");
  assert.equal(roman.staff.display_name, "Roman");
  assert.equal(roman.staff.role.title, "The Verifier");

  const source = callStaffDirectory({ subnet: "source" });
  assert.deepEqual(source.staff.map(person => person.display_name), ["Rafael"]);

  const retiredHidden = callStaffDirectory({ staff: "Felix" });
  assert.equal(retiredHidden.staff, null);
  const retiredVisible = callStaffDirectory({ staff: "Felix", include_retired: true });
  assert.equal(retiredVisible.staff.status, "retired");
});

test('assignment routing chooses active staff deterministically and explicit reserve stays sticky', async () => {
  const { normalizeAssignmentStaff } = await import('./staff-registry.js');
  assert.deepEqual(normalizeAssignmentStaff({primary_role:'systems-architect',supporting_roles:['verifier']}),{primary_team:'runner',supporting_teams:['inspector'],primary_staff:'ellis',supporting_staff:['roman']});
  assert.deepEqual(normalizeAssignmentStaff({primary_staff:'Mateo'}),{primary_team:'source',supporting_teams:[],primary_staff:'mateo',supporting_staff:[]});
  assert.throws(()=>normalizeAssignmentStaff({primary_staff:'felix'}),/Retired/);
  assert.throws(()=>normalizeAssignmentStaff({primary_staff:'unknown'}),/Unknown/);
  assert.throws(()=>normalizeAssignmentStaff({primary_staff:'roman',primary_role:'architect'}),/incompatible/);
  assert.throws(()=>normalizeAssignmentStaff({primary_staff:'julian',supporting_staff:['Julian']}),/Duplicate/);
  assert.throws(()=>normalizeAssignmentStaff({supporting_staff:['Roman','roman']}),/Duplicate/);
  assert.equal(normalizeAssignmentStaff({primary_role:'unknown-specialty'}).primary_staff,null);
});

test('routing ranks role and team fit instead of sending all implementation to the first builder', async () => {
  const { normalizeAssignmentStaff } = await import('./staff-registry.js');
  const pick = input => normalizeAssignmentStaff(input).primary_staff;
  assert.equal(pick({category:'implementation'}),'nico');
  assert.equal(pick({category:'implementation',primary_team:'source'}),'rafael');
  assert.equal(pick({category:'implementation',resources:['relay-cloud-runtime']}),'gabriel');
  assert.equal(pick({category:'maintenance'}),'adrian');
  // An explicit role with no in-team holder falls back to the best cross-team match, not null.
  assert.equal(pick({primary_role:'builder',primary_team:'source'}),'nico');
  // Exact verifier role beats the release captain's verification affinity.
  assert.deepEqual(normalizeAssignmentStaff({primary_role:'integrator',supporting_roles:['verification']}).supporting_staff,['roman']);
  assert.equal(pick({primary_team:'runner',primary_role:'brand-launch'}),'bianca');
});

test('card attribution names role and team, keeps the executor owner separate and explains gaps', async () => {
  const { assignmentStaffAttribution } = await import('./staff-registry.js');
  const resolved = assignmentStaffAttribution({owner:'claude-code-session_x',primary_staff:'rafael',supporting_staff:['roman'],primary_team:'source',supporting_teams:['inspector']});
  assert.equal(resolved.status,'resolved');
  assert.deepEqual(resolved.primary,{id:'rafael',display_name:'Rafael',role:'The Integrator',home_team:'source'});
  assert.equal(resolved.supporting[0].role,'The Verifier');
  assert.equal(resolved.executor_owner,'claude-code-session_x');
  assert.equal(resolved.participation,'routing');
  const unmatched = assignmentStaffAttribution({primary_staff:null,primary_role:'brand-launch',primary_team:'runner'});
  assert.equal(unmatched.status,'unresolved');assert.equal(unmatched.reason,'no-match');
  assert.match(unmatched.explanation,/brand-launch on the runner team/);
  assert.equal(assignmentStaffAttribution({}).reason,'not-recorded');
  assert.equal(assignmentStaffAttribution({primary_staff:'ghost'}).reason,'unknown-staff');
});
