export const QA_SKILL_URI = "skill://relay/human-qa/SKILL.md";

const QA_SKILL_DESCRIPTION = "Populate and use Runner's human QA helper for exact-artifact visual and behavioral review. Generate targeted questions and observable checklists for the user; keep deterministic verification agent-owned.";

const QA_SKILL_TEXT = "---\nname: human-qa\ndescription: Populate and use Runner's human QA helper for exact-artifact visual and behavioral review. Generate targeted questions and observable checklists for the user; keep deterministic verification agent-owned.\n---\n\n# human QA\n\nUse this skill whenever Relay is preparing a human review in Runner qa-shell, handing off screenshot/video evidence, or asking the user for visual, interaction, usability, wording, comparison, or product-direction judgment.\n\nRunner owns the canonical contract:\n\n- `lrnolivia/relay/contracts/human-qa-helper.json`\n- `lrnolivia/relay/docs/HUMAN_QA_HELPER.md`\n- `lrnolivia/relay/docs/VISUAL_EVIDENCE_POLICY.md`\n\nRead the current contract through relay.SOURCE before populating a review when exact details matter.\n\n## agent responsibility\n\nDo the machine-verifiable work first. Tests, check status, source/head identity, deployment/version identity, HTTP assertions, logs, and other deterministic facts are agent work, not user homework.\n\nOnly open a human review when a meaningful judgment remains.\n\nBind the review to the exact project and artifact. Include exact head SHA, PR/branch when applicable, environment/route, deployment/version when applicable, and Runner Visuals evidence IDs or run ID when media exists.\n\nIf that identity changes materially, preserve the old review as history but treat it as stale.\n\n## questions\n\nGenerate the questions for the user before opening qa-shell. Do not ask the user to invent the review.\n\nDefault to 2-4 targeted questions; never exceed the Runner contract limit.\n\nEach question should:\n\n- ask one concrete judgment;\n- map to an acceptance criterion, known ambiguity, or product decision;\n- say what to look at or try;\n- use plain product language;\n- be answerable while the relevant preview or evidence is visible.\n\nAvoid generic prompts such as `does this look good?` when a criterion-specific prompt is possible.\n\nExample:\n\n`does the darker secondary header feel clearly subordinate to the page title without disappearing into the warm charcoal background?`\n\nDo not ask the user to verify facts Relay can prove itself.\n\n## checklists\n\nUse a short checklist when there are multiple observable conditions or interaction steps. Keep it scannable while the preview is open.\n\nGood checklist items are things the user can see or try, such as:\n\n- floating Runner does not cover the element under review;\n- live preview remains interactive;\n- captured fallback appears when live preview is unavailable;\n- secondary headers are visibly smaller than primary headers;\n- notes remain after reopening the same review.\n\nDo not convert automated assertions into checklist items merely to make the user reconfirm them.\n\nA single-criterion review does not need a checklist.\n\n## Visuals and qa-shell\n\nVisual evidence belongs in Runner Visuals. Screenshot/video transfer may be asynchronous; once Runner has a durable `queued` or `uploading` receipt, the producer may continue.\n\nThe human review may be prepared while media is uploading, but a visual criterion is not human-proven until the image/video or live preview is viewable.\n\nUse the existing qa-shell as the human surface. Do not create a parallel review UI, evidence store, approval registry, or question store.\n\nQuestions, checklist state, notes, and the overall verdict must attach to the exact review/evidence identity.\n\nThe overall verdict remains separate from targeted questions: `looks_good`, `needs_work`, or `not_sure`.\n\nHuman QA never overrides required tests, security gates, branch protection, or other deterministic policy.\n";

const QA_SKILL_DIGEST = "sha256:c6c2ae0bf862e73102937c351eb3b12dd327939eb694d82f30c5630ceded905d";

export function qaSkillCatalogEntry() {
  return {
    uri: QA_SKILL_URI,
    frontmatter: {
      name: "human-qa",
      description: QA_SKILL_DESCRIPTION
    },
    resources: [{ uri: QA_SKILL_URI, digest: QA_SKILL_DIGEST }]
  };
}

export function qaSkillResourceDescriptor() {
  return {
    uri: QA_SKILL_URI,
    name: "human-qa",
    title: "human-qa",
    description: QA_SKILL_DESCRIPTION,
    mimeType: "text/markdown"
  };
}

export function qaSkillResource() {
  return {
    uri: QA_SKILL_URI,
    mimeType: "text/markdown",
    text: QA_SKILL_TEXT
  };
}
