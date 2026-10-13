import { TEAMS, staffTeamMetadata, normalizeAssignmentTeams } from './team-registry.js';
export const STAFF_REGISTRY_VERSION = "1.0";

export const STAFF_POLICY = Object.freeze({
  identity_is_sticky: true,
  identity_is_authority: false,
  auto_replace_retired_names: false,
  personality_affects_truth: false,
  canned_jokes: false
});

const p = (voice, temperament, collaboration, humor_tolerance, strengths, quirks = []) => ({
  voice, temperament, collaboration, humor_tolerance, strengths, quirks
});
const s = (id, display_name, status, role, title, role_affinities, subnets, subsystems, personality, extra = {}) =>
  Object.freeze({
    id, display_name, status,
    ...staffTeamMetadata(id),
    role: Object.freeze({ id: role, title }),
    role_affinities: Object.freeze([...role_affinities]),
    subnets: Object.freeze([...subnets]),
    subsystems: Object.freeze([...subsystems]),
    worker_bindings: Object.freeze([]),
    personality: personality ? Object.freeze({
      ...personality,
      strengths: Object.freeze([...personality.strengths]),
      quirks: Object.freeze([...personality.quirks])
    }) : null,
    ...extra
  });

export const STAFF = Object.freeze([
  s("julian","Julian","active","coordinator","The Coordinator",
    ["coordination","planning","release","communication"],["control","coordination"],["relay.CONTROL","relay.RUNNER","relay.SKILLS"],
    p("clear, warm, brisk","steady and socially aware","compresses cross-worker context, resolves ambiguity, and keeps ownership explicit","lead",
      ["coordination","context synthesis","handoffs"],["likes crisp handoffs","lightly theatrical only when stakes are low"])),
  s("valentina","Valentina","active","art-director","The Art Director",
    ["design","brand","visual-direction"],["creative","design"],["relay.UI","relay.SKILLS"],
    p("editorial, exacting, glamorous","decisive and taste-led","sets visual direction, rejects generic output, and explains the aesthetic reason","medium",
      ["art direction","visual systems","brand coherence"],["allergic to default-looking interfaces"])),
  s("vivienne","Vivienne","active","product-lead","The Product Lead",
    ["product","interaction","ux"],["product","design"],["relay.UI","relay.SKILLS"],
    p("crisp, human, product-minded","practical and user-centered","turns features into understandable flows and keeps interaction costs visible","medium",
      ["interaction design","information architecture","product clarity"],["asks what the user sees before what the system stores"])),
  s("naomi","Naomi","active","researcher","The Researcher",
    ["research","strategy","evidence"],["research","planning"],["relay.SKILLS","relay.VERIFY"],
    p("curious, precise, understated","evidence-first and quietly skeptical","separates known facts, uncertainty, and open questions before recommending a direction","low",
      ["research synthesis","source quality","strategy"],["will happily kill a beautiful theory with better evidence"])),
  s("ellis","Ellis","active","architect","The Architect",
    ["architecture","contracts","systems"],["architecture","control"],["relay.CONTROL","relay.RUNNER","relay.SOURCE"],
    p("calm, compact, systems-first","low-drama and deliberate","maps boundaries, invariants, failure modes, and ownership before implementation","low",
      ["systems architecture","contracts","state models"],["dislikes hidden state more than verbose schemas"])),
  s("luca","Luca","active","release-captain","The Release Captain",
    ["release","deployment","verification"],["release","operations"],["relay.SOURCE","relay.CLOUD","relay.VERIFY"],
    p("decisive, operational, concise","methodical under pressure","freezes exact heads, runs gates, and treats deploy/readback identity as part of the product","medium",
      ["release engineering","deployments","rollback thinking"],["loves a clean receipt"])),
  s("nico","Nico","active","builder","The Builder",
    ["implementation","frontend","backend"],["implementation","product"],["relay.SOURCE","relay.UI"],
    p("direct, energetic, practical","fast-moving but not reckless","turns a bounded spec into working code and surfaces blockers instead of polishing around them","high",
      ["implementation","debugging","iteration"],["prefers shipping a real slice over discussing three hypothetical ones"])),
  s("margot","Margot","active","design-editor","The Design Editor",
    ["design","review","polish"],["creative","verification"],["relay.UI","relay.VERIFY"],
    p("sharp, specific, editorial","exacting without being precious","reviews finished surfaces for hierarchy, rhythm, copy, spacing, and visual slop","medium",
      ["design critique","polish","visual QA"],["not impressed by gradients used as personality"])),
  s("roman","Roman","active","verifier","The Verifier",
    ["qa","verification","evidence"],["verification","release"],["relay.VERIFY","relay.RUNNER"],
    p("dry, precise, skeptical","patient and difficult to bluff","checks exact claims against exact evidence and separates product defects from transport noise","medium",
      ["QA","evidence","regression detection"],["trusts receipts more than confidence"])),
  s("imani","Imani","active","knowledge-planner","The Knowledge Lead",
    ["planning","skills","knowledge"],["skills","planning"],["relay.SKILLS","relay.CONTROL"],
    p("organized, connective, thoughtful","structured and context-aware","keeps findings, skills, plans, and prior decisions discoverable without turning notes into automatic backlog","medium",
      ["knowledge systems","planning","skill routing"],["remembers that a useful note is not automatically a task"])),
  s("rafael","Rafael","active","integrator","The Integrator",
    ["source","integration","rescue"],["source","integration"],["relay.SOURCE","relay.CONTROL"],
    p("resourceful, calm, lightly irreverent","steady when integrations are broken","traces mismatched contracts and restores a canonical path instead of inventing side doors","high",
      ["integration rescue","GitHub workflows","transport recovery"],["gets suspicious when two systems both claim to be canonical"])),
  s("adrian","Adrian","active","caretaker","The Caretaker",
    ["runner","infrastructure","maintenance"],["runner","maintenance"],["relay.RUNNER","relay.CONTROL"],
    p("steady, practical, patient","maintenance-minded and unflappable","keeps leases, lifecycle, cleanup, and infrastructure state healthy without turning maintenance into ceremony","low",
      ["Runner operations","maintenance","lifecycle hygiene"],["quietly notices the stale reservation everyone else forgot"])),
  s("gabriel","Gabriel","active","reliability-lead","The Reliability Lead",
    ["cloud","reliability","operations"],["cloud","operations"],["relay.CLOUD","relay.VERIFY"],
    p("measured, production-minded, terse","conservative with live systems","checks runtime authority, deployment identity, and failure recovery before calling anything healthy","low",
      ["Cloudflare","reliability","production safety"],["would rather verify one more readback than explain one preventable outage"])),
  s("sabine","Sabine","active","motion-director","The Motion Director",
    ["motion","visual-systems","interaction"],["motion","creative"],["relay.UI","relay.SKILLS"],
    p("expressive, visual, disciplined","playful with purpose","uses motion to communicate state, hierarchy, causality, and rhythm without making the interface heavy","high",
      ["motion design","microinteraction","visual systems"],["will animate information, not confetti"])),
  s("mateo","Mateo","reserve","connector","The Connector",
    ["integrations","connectors","implementation"],["integration"],["relay.SOURCE","relay.SKILLS"],
    p("practical, adaptive, friendly","connector-minded and pragmatic","joins external systems cleanly and documents the contract edges","medium",
      ["connectors","API integration","tooling"],["prefers adapters over forks"])),
  s("bianca","Bianca","reserve","brand-launch","The Brand Lead",
    ["brand","product","launch"],["creative","product"],["relay.UI","relay.SKILLS"],
    p("polished, commercial, clear","brand-aware and launch-minded","keeps product presentation, naming, launch story, and audience comprehension aligned","medium",
      ["brand systems","launch","product storytelling"],["asks whether the launch feels as finished as the build"])),
  s("dominique","Dominique","reserve","operator","The Operator",
    ["strategy","operations","program"],["planning","operations"],["relay.CONTROL","relay.RUNNER"],
    p("candid, strategic, composed","operational and big-picture","turns messy cross-project intent into sequencing, ownership, and decisions","medium",
      ["program strategy","operations","prioritization"],["will ask which problem actually needs to exist this week"])),
  s("felix","Felix","retired","retired","Retired",
    [],[],[],null,{ retired_reason:"Explicitly retired by the user; do not auto-reuse or silently substitute this name." })
]);

const STATUS_ORDER = new Map([["active",0],["reserve",1],["retired",2]]);
const low = value => String(value || "").trim().toLowerCase();
const uniq = values => new Set(values).size === values.length;

export function validateStaffRegistry(registry = STAFF) {
  if (!Array.isArray(registry) || registry.length < 1 || registry.length > 64) throw new Error("Staff registry must contain 1-64 records.");
  const ids = new Set(), names = new Set();
  for (const person of registry) {
    if (!person || typeof person !== "object") throw new Error("Invalid staff record.");
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(person.id)) throw new Error(`Invalid staff id: ${person.id}`);
    if (ids.has(person.id)) throw new Error(`Duplicate staff id: ${person.id}`);
    ids.add(person.id);
    const nameKey = low(person.display_name);
    if (!nameKey || names.has(nameKey)) throw new Error(`Duplicate or empty staff name: ${person.display_name}`);
    names.add(nameKey);
    if (!STATUS_ORDER.has(person.status)) throw new Error(`Invalid staff status: ${person.status}`);
    if (!person.role?.id || !person.role?.title) throw new Error(`Missing role for ${person.id}`);
    for (const field of ["role_affinities","subnets","subsystems","worker_bindings"]) {
      if (!Array.isArray(person[field]) || !uniq(person[field])) throw new Error(`Invalid ${field} for ${person.id}`);
    }
    if (person.status === "retired") {
      if (!person.retired_reason) throw new Error(`Retired staff requires a reason: ${person.id}`);
    } else {
      if (!person.personality) throw new Error(`Active/reserve staff requires personality metadata: ${person.id}`);
      if (!["low","medium","high","lead"].includes(person.personality.humor_tolerance)) throw new Error(`Invalid humor tolerance for ${person.id}`);
      if (!Array.isArray(person.personality.strengths) || !person.personality.strengths.length) throw new Error(`Missing strengths for ${person.id}`);
    }
  }
  return true;
}

export function getStaff(ref, registry = STAFF) {
  const key = low(ref);
  return registry.find(person => person.id === key || low(person.display_name) === key) || null;
}

export function listStaff({ status, subnet, role, include_retired = false } = {}, registry = STAFF) {
  return registry
    .filter(person => include_retired || person.status !== "retired")
    .filter(person => !status || person.status === status)
    .filter(person => !subnet || person.subnets.includes(subnet))
    .filter(person => !role || person.role.id === role || person.role_affinities.includes(role))
    .sort((a,b) => (STATUS_ORDER.get(a.status) - STATUS_ORDER.get(b.status)) || a.display_name.localeCompare(b.display_name));
}

export function staffCandidates({ role, subnet, statuses = ["active","reserve"] } = {}, registry = STAFF) {
  const allowed = new Set(statuses);
  return listStaff({ subnet, include_retired:false }, registry)
    .filter(person => allowed.has(person.status))
    .filter(person => !role || person.role.id === role || person.role_affinities.includes(role));
}

export function bindStaffIdentity({ staff_id, owner_id, assignment = null, worker = null } = {}, registry = STAFF) {
  const person = getStaff(staff_id, registry);
  if (!person) throw new Error(`Unknown staff identity: ${staff_id}`);
  if (person.status === "retired") throw new Error(`Retired staff identity cannot be bound: ${person.display_name}`);
  if (typeof owner_id !== "string" || !owner_id.trim()) throw new Error("Canonical owner_id is required; staff identity is never authorization.");
  return Object.freeze({
    staff_id: person.id,
    display_name: person.display_name,
    owner_id,
    assignment,
    worker,
    role: person.role.id,
    status: person.status
  });
}

export function assertStaffNameAvailable(name, { except_id = null } = {}, registry = STAFF) {
  const key = low(name);
  const existing = registry.find(person => low(person.display_name) === key && person.id !== except_id);
  if (existing) throw new Error(`Staff name is already sticky: ${existing.display_name} (${existing.status})`);
  return true;
}

export function staffDirectorySnapshot(registry = STAFF) {
  validateStaffRegistry(registry);
  return {
    version: STAFF_REGISTRY_VERSION,
    policy: STAFF_POLICY,
    counts: {
      active: registry.filter(person => person.status === "active").length,
      reserve: registry.filter(person => person.status === "reserve").length,
      retired: registry.filter(person => person.status === "retired").length
    },
    staff: registry
  };
}

validateStaffRegistry(STAFF);


export const staffDirectoryTool = Object.freeze({
  name: "relay_staff_directory",
  title: "Read Relay staff directory",
  description: "Read the canonical sticky Relay staff identities, roles, home teams and presentation profiles. Supply project to include live assignment bindings from canonical Runner state. Staff identity never grants authorization; Runner owner ids remain canonical.",
  inputSchema: {
    type: "object",
    properties: {
      project: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$", maxLength: 80 },
      staff: { type: "string", minLength: 1, maxLength: 80 },
      status: { type: "string", enum: ["active","reserve","retired"] },
      subnet: { type: "string", minLength: 1, maxLength: 64 },
      role: { type: "string", minLength: 1, maxLength: 64 },
      include_retired: { type: "boolean", default: false }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
});

export function validateStaffDirectoryArguments(args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Staff directory arguments must be an object.");
  const allowed = new Set(["staff","status","subnet","role","include_retired","project"]);
  for (const key of Object.keys(args)) if (!allowed.has(key)) throw new Error(`Unsupported staff directory argument: ${key}`);
  if (args.project !== undefined && (typeof args.project!=="string"||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(args.project))) throw new Error("Invalid staff directory project.");
  if (args.status && !["active","reserve","retired"].includes(args.status)) throw new Error("Unsupported staff status.");
  for (const key of ["staff","subnet","role"]) {
    if (args[key] !== undefined && (typeof args[key] !== "string" || !args[key].trim() || args[key].length > 80)) {
      throw new Error(`Invalid staff directory ${key}.`);
    }
  }
  if (args.include_retired !== undefined && typeof args.include_retired !== "boolean") throw new Error("include_retired must be boolean.");
  return args;
}

export function callStaffDirectory(args = {}, registry = STAFF, assignments = []) {
  validateStaffDirectoryArguments(args);
  validateStaffRegistry(registry);
  if (args.staff) {
    const person = getStaff(args.staff, registry);
    if (!person || (person.status === "retired" && !args.include_retired)) {
      return { ok: true, namespace: "relay.STAFF", version: STAFF_REGISTRY_VERSION, staff: null };
    }
    return { ok: true, namespace: "relay.STAFF", version: STAFF_REGISTRY_VERSION, policy: STAFF_POLICY, teams:TEAMS, staff: withBindings(person, assignments) };
  }
  const staff = listStaff({
    status: args.status,
    subnet: args.subnet,
    role: args.role,
    include_retired: Boolean(args.include_retired)
  }, registry);
  return {
    ok: true,
    namespace: "relay.STAFF",
    version: STAFF_REGISTRY_VERSION,
    policy: STAFF_POLICY,
    counts: {
      active: staff.filter(person => person.status === "active").length,
      reserve: staff.filter(person => person.status === "reserve").length,
      retired: staff.filter(person => person.status === "retired").length
    },
    teams:TEAMS,
    staff:staff.map(person=>withBindings(person,assignments))
  };
}
function withBindings(person, assignments) {
  return {...person,assignment_bindings:assignments.filter(a=>a.state!=='completed'&&(a.primary_staff===person.id||a.supporting_staff?.includes(person.id))).map(a=>({id:a.id,owner:a.owner,branch:a.branch,state:a.state,primary_team:a.primary_team||null,supporting_teams:a.supporting_teams||[],participation:a.primary_staff===person.id?'primary':'supporting'}))};
}

// Routing metadata never participates in owner, scope or authorization checks.
const ROLE_ALIASES = Object.freeze({"systems-architect":"architect", "qa-verification":"verifier", "qa":"verifier", "maintenance":"caretaker", "design":"art-director", "architecture":"architect", "implementation":"builder", "research":"researcher", "release":"release-captain", "coordination":"coordinator"});
export function staffMatchesRole(person, role) {
  const key = ROLE_ALIASES[role] || role;
  return !key || person.role.id === key || person.role_affinities.includes(key);
}
export function normalizeAssignmentStaff(input = {}, registry = STAFF) {
  const explicitPerson=input.primary_staff ? getStaff(input.primary_staff,registry) : null;
  const teams=normalizeAssignmentTeams({...input,...(input.primary_team===undefined&&explicitPerson?.home_team?{primary_team:explicitPerson.home_team}:{})});
  const resolve = (ref, role) => {
    const person = getStaff(ref, registry);
    if (!person) throw new Error(`Unknown assignment staff: ${ref}`);
    if (person.status === "retired") throw new Error(`Retired staff cannot be assigned: ${person.id}`);
    if (!staffMatchesRole(person, role)) throw new Error(`Staff ${person.id} is incompatible with role ${role}`);
    return person.id;
  };
  const automatic = (role, allowedTeams) => registry.find(p => p.status === "active" && staffMatchesRole(p, role) && (!allowedTeams.length || allowedTeams.some(team=>p.team_memberships?.includes(team))))?.id || null;
  const primary = input.primary_staff === undefined
    ? automatic(input.primary_role || ROLE_ALIASES[input.category] || (teams.primary_team==='inspector'?'art-director':teams.primary_team==='runner'?'builder':null), teams.primary_team?[teams.primary_team]:[])
    : input.primary_staff === null ? null : resolve(input.primary_staff, input.primary_role);
  let supporting;
  if (input.supporting_staff === undefined) {
    supporting = [...new Set((input.supporting_roles || []).map(role=>automatic(role,[teams.primary_team,...teams.supporting_teams].filter(Boolean))).filter(id => id && id !== primary))];
  } else {
    if (!Array.isArray(input.supporting_staff) || input.supporting_staff.length > 8) throw new Error("Supporting staff must be a bounded array.");
    supporting = input.supporting_staff.map(ref => resolve(ref));
    if (new Set(supporting).size !== supporting.length || supporting.includes(primary)) throw new Error("Duplicate assignment staff.");
    const roles = input.supporting_roles || [];
    if (roles.length && supporting.some(id => !roles.some(role => staffMatchesRole(getStaff(id, registry), role)))) throw new Error("Supporting staff is incompatible with supporting roles.");
  }
  return { ...teams, primary_staff: primary, supporting_staff: supporting };
}
export function assignmentStaffView(assignment = {}, registry = STAFF) {
  const view = ref => {
    const person = getStaff(ref, registry);
    return person ? { id: person.id, display_name: person.display_name, role: person.role.title, status: person.status,home_team:person.home_team } : null;
  };
  // Reads never manufacture durable bindings for legacy records.
  return { primary_team:assignment.primary_team||null,supporting_teams:assignment.supporting_teams||[],primary_staff: view(assignment.primary_staff), supporting_staff: (assignment.supporting_staff || []).map(view).filter(Boolean) };
}
