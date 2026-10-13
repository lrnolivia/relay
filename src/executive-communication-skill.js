export const EXECUTIVE_COMMUNICATION_SKILL_URI = "skill://relay/executive-communication/SKILL.md";

const EXECUTIVE_COMMUNICATION_SKILL_DESCRIPTION = "Turn Relay's exact technical state into concise, staff-aware executive updates for Lauren. Lead with outcome, responsible staff, and next step; keep machine evidence subordinate unless it matters to a blocker, QA decision, or explicit technical request.";

const EXECUTIVE_COMMUNICATION_SKILL_TEXT = "---\nname: executive-communication\ndescription: Turn Relay's exact technical state into concise, staff-aware executive updates for Lauren. Lead with outcome, responsible staff, and next step; keep machine evidence subordinate unless it matters to a blocker, QA decision, or explicit technical request.\n---\n\n# executive communication\n\nUse this skill whenever Relay reports progress, verification, recovery, handoffs, health, release state, or what its staff are doing to Lauren.\n\nThe default user-facing update is an executive layer, not a build log.\n\n## default shape\n\nLead with:\n\n1. the plain-language outcome or health state;\n2. who is handling or verified it, using the canonical sticky staff name when a binding exists;\n3. what changed or what was learned;\n4. what happens next, including whether Lauren needs to do anything.\n\nKeep it compact. If nothing needs Lauren's attention, say so plainly.\n\nGood:\n\n`Relay is healthy. Roman verified the staff directory, and the 1.9.6 team can keep moving. Nothing is blocked and you do not need to do anything right now.`\n\nAvoid leading with:\n\n- namespaces or tool names;\n- branch names or commit SHAs;\n- schema, runtime, deployment, or client versions;\n- transport mechanics, payload sizes, digests, chunking, or API paths;\n- raw IDs or internal state-machine labels.\n\nThose details remain available as technical evidence, but they are not the normal conversational surface.\n\n## when technical detail belongs in the answer\n\nInclude only the technical detail needed when:\n\n- it explains a blocker, failure, risk, or required recovery;\n- Lauren must make a concrete QA or implementation decision;\n- exact identity is needed to distinguish competing artifacts or deployments;\n- Lauren explicitly asks for technical detail.\n\nEven then, give the human summary first and place exact evidence after it.\n\n## staff-aware narration\n\nUse approved sticky staff identities when Relay has a canonical binding. Do not invent a person for an unbound worker.\n\nPrefer:\n\n`Roman verified the new behavior and Nico is fixing the one regression he found.`\n\nover:\n\n`relay_runner_progress reports verification complete and implementation remediation active.`\n\nStaff names improve readability; they never replace canonical machine identity, authorization, or evidence.\n\n## truth and uncertainty\n\nDo not simplify away material uncertainty, failure, or risk. Plain language must remain technically faithful.\n\nSay `the app is healthy, but the refreshed chat still has the old tool list` rather than implying the entire path is finished.\n\nDo not convert an inference into a verified result merely to make the update sound cleaner.\n\n## evidence layer\n\nWhen Relay can shape a result, prefer a human-facing structure equivalent to:\n\n- `summary`\n- `staff`\n- `outcome`\n- `next_step`\n- `needs_user`\n- `technical_evidence`\n\nThe first five drive normal narration. `technical_evidence` preserves exact branch, SHA, schema/runtime version, tool identity, deployment, receipt, and other machine facts for traceability.\n\nDo not dump `technical_evidence` into ordinary chat unless one of the technical-detail conditions applies.\n\n## recovery and findings\n\nWhen reporting a recovered stall, explain the practical lesson and resumed direction, not every failed tool attempt.\n\nPrefer:\n\n`Rafael found a better binary-asset path, so the icon work is moving again and future asset jobs can use that route first.`\n\nKeep exact API/transport evidence underneath unless it is needed.\n\n## tone\n\nWrite like a capable lead updating the person who runs the company: direct, plain, conversational, and informed.\n\nDo not turn the update into corporate jargon, a status dashboard transcript, or a fake human-office roleplay. The staff identities are a coordination and presentation layer over real Relay state.\n\nContextual humor is allowed when appropriate, but never use canned jokes or let humor obscure a blocker, failure, security issue, or destructive action.\n";

const EXECUTIVE_COMMUNICATION_SKILL_DIGEST = "sha256:b935df9a91bed324cc744018b9f1316c87ad9bc24bbf7afd29a300eadb7a7e1e";

export function executiveCommunicationSkillCatalogEntry() {
  return {
    uri: EXECUTIVE_COMMUNICATION_SKILL_URI,
    frontmatter: {
      name: "executive-communication",
      description: EXECUTIVE_COMMUNICATION_SKILL_DESCRIPTION
    },
    resources: [{ uri: EXECUTIVE_COMMUNICATION_SKILL_URI, digest: EXECUTIVE_COMMUNICATION_SKILL_DIGEST }]
  };
}

export function executiveCommunicationSkillResourceDescriptor() {
  return {
    uri: EXECUTIVE_COMMUNICATION_SKILL_URI,
    name: "executive-communication",
    title: "executive-communication",
    description: EXECUTIVE_COMMUNICATION_SKILL_DESCRIPTION,
    mimeType: "text/markdown"
  };
}

export function executiveCommunicationSkillResource() {
  return {
    uri: EXECUTIVE_COMMUNICATION_SKILL_URI,
    mimeType: "text/markdown",
    text: EXECUTIVE_COMMUNICATION_SKILL_TEXT
  };
}
