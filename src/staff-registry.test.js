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
  assert.deepEqual(snapshot.counts, { active: 14, reserve: 3, retired: 1 });
  assert.equal(STAFF_POLICY.identity_is_sticky, true);
  assert.equal(STAFF_POLICY.identity_is_authority, false);
  assert.equal(STAFF_POLICY.canned_jokes, false);

  const activeNames = listStaff({ status: "active" }).map(person => person.display_name);
  for (const name of ["Julian","Valentina","Vivienne","Naomi","Ellis","Luca","Nico","Margot","Roman","Imani","Rafael","Adrian","Gabriel","Sabine"]) {
    assert.ok(activeNames.includes(name), `missing active staff: ${name}`);
  }
  const reserveNames = listStaff({ status: "reserve" }).map(person => person.display_name);
  assert.deepEqual(reserveNames.sort(), ["Bianca","Dominique","Mateo"]);
  assert.equal(getStaff("Felix").status, "retired");
});

test("sticky names resolve case-insensitively and cannot be silently reused", () => {
  assert.equal(getStaff("roman").id, "roman");
  assert.equal(getStaff("ROMAN").display_name, "Roman");
  assert.throws(() => assertStaffNameAvailable("Roman"), /already sticky/);
  assert.throws(() => assertStaffNameAvailable("felix"), /already sticky/);
  assert.equal(assertStaffNameAvailable("Celeste"), true);
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
  assert.deepEqual(creative.map(person => person.display_name), ["Margot","Sabine","Valentina","Bianca"]);
  assert.equal(creative.some(person => person.status === "retired"), false);

  const verify = listStaff({ role: "verification" });
  assert.deepEqual(verify.map(person => person.display_name), ["Luca","Roman"]);
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
