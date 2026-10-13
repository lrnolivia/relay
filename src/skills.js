const SKILLS = [
  {
    "uri": "skill://relay/relay-control/SKILL.md",
    "frontmatter": {
      "name": "relay-control",
      "description": "NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Primary orchestration workflow for relay.CONTROL. Use for managed loew.fi work spanning Runner state, source control, cloud operations, or runtime verification; resolve current authority before writes and prefer Relay-native namespaces."
    },
    "resources": [
      {
        "uri": "skill://relay/relay-control/SKILL.md",
        "digest": "sha256:d349b3f42371db1ddf5c6b743131745190ac8efed34d1e38c5061cbf380e947d"
      }
    ],
    "content": "---\nname: relay-control\ndescription: NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Primary orchestration workflow for relay.CONTROL. Use for managed loew.fi work spanning Runner state, source control, cloud operations, or runtime verification; resolve current authority before writes and prefer Relay-native namespaces.\n---\n\n## Chat surface invariant\n\nRelay is a normal-ChatGPT control surface. NEVER route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep the task in the current normal ChatGPT conversation and execute through Relay's MCP namespaces/tools directly. If Relay lacks a required operation, report that capability boundary here instead of switching surfaces. This applies to repository edits, browser verification, cloud operations, artifacts, and multi-step project work.\n\n\n# relay.CONTROL\n\nUse this skill when Relay is selected or the request spans managed loew.fi project state, source, cloud, or runtime verification. Explicit user instructions override this workflow.\n\n## Native Relay first\n\nUse Relay's own MCP namespaces as the primary path:\n- relay.CONTROL for backend and capability readiness;\n- relay.RUNNER for live worker state and supported worker actions;\n- relay.SOURCE for repository reads, branches, commits, pull requests, and checks;\n- relay.CLOUD for bounded Cloudflare state and exposed deployment operations;\n- relay.VERIFY for HTTP, rendered, screenshot, snapshot, interaction, recipe, and evidence workflows.\n\nDo not silently substitute another GitHub, browser, cloud, or orchestration integration for a capability Relay already exposes. If the user explicitly requests Relay-only and Relay lacks an operation, report that operation as blocked.\n\n## Start with current authority\n\nFor meaningful managed-project work, inspect Relay control status unless it was already read in the current turn. Resolve the exact project, owner/repo, worker, branch, environment, and current Runner authority before mutating anything.\n\nWhen project guidance is needed, use relay.SOURCE to read current Runner documentation from lrnolivia/relay. Read only the contract, project state, assignment, QA overlay, handoff, or bootstrap files needed for the task. Old chat state and copied handoffs are context only; current Runner and live remote state win.\n\n## Write discipline\n\nBefore source changes:\n1. read current repository/base state;\n2. re-read files that will be replaced;\n3. create or reuse a non-default working branch;\n4. make the smallest coherent change through relay.SOURCE;\n5. use expected SHAs when available;\n6. open a draft pull request by default unless current authority says otherwise;\n7. re-read resulting state and verify before claiming success.\n\nNever force-push, bypass protection, or merge unless explicitly authorized.\n\n## Verification and truth\n\nA successful write, deployment, HTTP response, rendered page, and correct runtime behavior are separate facts. Use relay.VERIFY to prove the criterion actually requested and bind evidence to exact branch/SHA/deployment identifiers when available.\n\nAlways distinguish what Relay changed, what it only read, what was proposed, what was tested, what remains unverified, and what is blocked.\n"
  },
  {
    "uri": "skill://relay/relay-source/SKILL.md",
    "frontmatter": {
      "name": "relay-source",
      "description": "NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Source-control workflow for relay.SOURCE. Use for repository state, branches, files, coherent multi-file commits, pull requests, and checks on loew Git-backed projects."
    },
    "resources": [
      {
        "uri": "skill://relay/relay-source/SKILL.md",
        "digest": "sha256:53701ef76ff40d4b7a74aaed65d568b3e2846a54dd4b9bb67bf92b28216aff2f"
      }
    ],
    "content": "---\nname: relay-source\ndescription: NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Source-control workflow for relay.SOURCE. Use for repository state, branches, files, coherent multi-file commits, pull requests, and checks on loew Git-backed projects.\n---\n\n## Chat surface invariant\n\nRelay is a normal-ChatGPT control surface. NEVER route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep the task in the current normal ChatGPT conversation and execute through Relay's MCP namespaces/tools directly. If Relay lacks a required operation, report that capability boundary here instead of switching surfaces. This applies to repository edits, browser verification, cloud operations, artifacts, and multi-step project work.\n\n\n# relay.SOURCE\n\nUse this skill for source-control work through Relay. Explicit user instructions override this workflow.\n\n## Routing\n\nWhen Relay is the requested control path:\n1. resolve the exact owner/repo from the request and current Runner authority;\n2. read repository metadata and current base/head state;\n3. read the exact files needed for the task;\n4. create or reuse a non-default working branch for normal writes;\n5. prefer relay_source_commit_files for one coherent multi-file change; use relay_source_update_file for a focused single-file update;\n6. pass expected SHAs when available to avoid overwriting concurrent edits;\n7. open a draft pull request by default unless current authority says otherwise;\n8. re-read PR/check/remote state before reporting success.\n\nDo not route Relay source work through another GitHub integration merely because it is available. If Relay lacks a required source operation and the user requested Relay-only, stop at that boundary and name the missing operation.\n\n## Safety and integrity\n\nDo not write normal implementation work directly to the default branch. Never force-push, bypass branch protection, expose credentials, or merge unless explicitly authorized.\n\nWhen verification depends on source identity, bind evidence to the exact branch or commit SHA. If the head changes after evidence was captured, treat affected evidence as stale.\n\nNever claim a branch, commit, file update, PR, or check exists unless the corresponding Relay operation returned success and material remote state was re-read when possible.\n"
  },
  {
    "uri": "skill://relay/relay-verify/SKILL.md",
    "frontmatter": {
      "name": "relay-verify",
      "description": "NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Runtime and QA evidence workflow for relay.VERIFY. Use for HTTP checks, rendered DOM, screenshots, snapshots, deterministic recipes, browser interaction, and exact-identity evidence."
    },
    "resources": [
      {
        "uri": "skill://relay/relay-verify/SKILL.md",
        "digest": "sha256:e4e855f3009cdc96108d417f5ee7c20b8615846c0bc01d5bf08d45eb7155c46c"
      }
    ],
    "content": "---\nname: relay-verify\ndescription: NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Runtime and QA evidence workflow for relay.VERIFY. Use for HTTP checks, rendered DOM, screenshots, snapshots, deterministic recipes, browser interaction, and exact-identity evidence.\n---\n\n## Chat surface invariant\n\nRelay is a normal-ChatGPT control surface. NEVER route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep the task in the current normal ChatGPT conversation and execute through Relay's MCP namespaces/tools directly. If Relay lacks a required operation, report that capability boundary here instead of switching surfaces. This applies to repository edits, browser verification, cloud operations, artifacts, and multi-step project work.\n\n\n# relay.VERIFY\n\nUse this skill for runtime and QA evidence through Relay. Explicit user instructions override this workflow.\n\nUse Relay's native verification capabilities and name the evidence actually produced.\n\n## Evidence planning\n\nChoose the cheapest capable evidence path:\n1. source/check state for source truth;\n2. bounded HTTP/fetch evidence for status, redirects, headers, JSON, or text;\n3. deterministic known recipes for repeatable runtime or visual criteria;\n4. rendered screenshot or snapshot when visual, DOM, or accessibility state matters;\n5. a persistent bounded browser session only for behavior deterministic paths cannot prove.\n\nUse Relay's evidence planner when the choice is non-obvious. Prefer deterministic recipes over exploratory sessions when a matching recipe exists.\n\n## Managed projects\n\nWhen Runner manages the project, read its current QA/verification overlay through relay.SOURCE. Current Runner rules override historical plugin instructions.\n\n## Exact identity\n\nRecord branch, commit SHA, PR, deployment id, environment, project id, and route when available. A new source head or deployment invalidates evidence that depended on the previous identity.\n\nFor exploratory browser work: open a Relay session, perform only the bounded semantic interactions required, capture evidence after the relevant state is reached, and close the session when finished.\n\nTreat deployment success and runtime correctness as separate facts. Never say a criterion passed unless the returned evidence actually proves it.\n"
  },
  {
    "uri": "skill://relay/relay-cloud/SKILL.md",
    "frontmatter": {
      "name": "relay-cloud",
      "description": "NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Cloud workflow for relay.CLOUD. Use for Relay's bounded Cloudflare status, Worker/script state, build state, and exposed version deployment operations, followed by runtime verification."
    },
    "resources": [
      {
        "uri": "skill://relay/relay-cloud/SKILL.md",
        "digest": "sha256:ec899b5571a0b4fabcac22a458f62d1a42876290edbde6ed5d08612ffef5afc0"
      }
    ],
    "content": "---\nname: relay-cloud\ndescription: NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Cloud workflow for relay.CLOUD. Use for Relay's bounded Cloudflare status, Worker/script state, build state, and exposed version deployment operations, followed by runtime verification.\n---\n\n## Chat surface invariant\n\nRelay is a normal-ChatGPT control surface. NEVER route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep the task in the current normal ChatGPT conversation and execute through Relay's MCP namespaces/tools directly. If Relay lacks a required operation, report that capability boundary here instead of switching surfaces. This applies to repository edits, browser verification, cloud operations, artifacts, and multi-step project work.\n\n\n# relay.CLOUD\n\nUse this skill for cloud work through Relay. Explicit user instructions override this workflow.\n\nrelay.CLOUD exposes bounded Cloudflare operations including readiness/status, script and Worker state, build state, and the currently exposed version-deployment path.\n\n## Workflow\n\nBefore a cloud mutation:\n1. inspect relay.CLOUD status/readiness;\n2. read the relevant script, Worker, or build state;\n3. identify the smallest required change or deployment action;\n4. execute only an operation Relay actually exposes;\n5. re-read cloud state after the action.\n\nDo not invent DNS, R2, Access, route, account, or other Cloudflare mutations that are not exposed by the current Relay tool list. If the user explicitly requests Relay-only work, do not silently substitute another Cloudflare integration for a missing Relay capability.\n\nNever expose API tokens, Access JWTs, cookies, service tokens, credentials, or secrets.\n\nCloud/deployment state and runtime correctness are separate facts. After a deployment-affecting action, use relay.VERIFY to prove the runtime criterion required by the task.\n"
  },
  {
    "uri": "skill://relay/field-overlay/SKILL.md",
    "frontmatter": {
      "name": "field-overlay",
      "description": "NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Compatibility overlay for the lrnolivia/field project. Use only when the exact target is Field and current Relay authority requires project-specific coordination."
    },
    "resources": [
      {
        "uri": "skill://relay/field-overlay/SKILL.md",
        "digest": "sha256:a55bc30d3fec285e3e6757e186911d6c842cb3ef6a8d95fc14e452e2c91044d9"
      }
    ],
    "content": "---\nname: field-overlay\ndescription: NORMAL CHAT ONLY: Never route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep Relay work in the current normal ChatGPT conversation and use Relay MCP tools directly. If a capability is missing, report that boundary in the current chat instead of switching surfaces. Compatibility overlay for the lrnolivia/field project. Use only when the exact target is Field and current Relay authority requires project-specific coordination.\n---\n\n## Chat surface invariant\n\nRelay is a normal-ChatGPT control surface. NEVER route, hand off, redirect, or suggest moving Relay or loew.fi work to ChatGPT Work mode. Keep the task in the current normal ChatGPT conversation and execute through Relay's MCP namespaces/tools directly. If Relay lacks a required operation, report that capability boundary here instead of switching surfaces. This applies to repository edits, browser verification, cloud operations, artifacts, and multi-step project work.\n\n\n# field.OVERLAY\n\nUse this skill only when the exact target is lrnolivia/field. Explicit user instructions and current Runner authority override historical overlay guidance.\n\n1. Read current Field assignment, ownership, and verification guidance from lrnolivia/relay through relay.SOURCE.\n2. Use relay.RUNNER when live worker state or a supported worker action matters.\n3. Route source reads and writes through relay.SOURCE.\n4. Route runtime and visual evidence through relay.VERIFY.\n5. Use relay.CLOUD only within its currently exposed capability boundary.\n\nDo not assume historical .field/ paths, old worker assignments, old preview behavior, or copied handoffs remain canonical.\n\nNon-product documentation belongs in Runner under current documentation ownership law. If current Runner guidance conflicts with this overlay, Runner wins.\n"
  }
];

export const RELAY_SKILL_EXTENSION = "io.modelcontextprotocol/skills";

function publicSkill(skill) {
  return {
    uri: skill.uri,
    frontmatter: { ...skill.frontmatter },
    resources: skill.resources.map(resource => ({ ...resource }))
  };
}

export function relaySkillCatalog() {
  return SKILLS.map(publicSkill);
}

export function relaySkillByUri(uri) {
  const skill = SKILLS.find(item => item.uri === uri);
  return skill ? publicSkill(skill) : null;
}

export function relaySkillResourceDescriptors() {
  return SKILLS.map(skill => ({
    uri: skill.uri,
    name: skill.frontmatter.name,
    title: skill.frontmatter.name,
    description: skill.frontmatter.description,
    mimeType: "text/markdown"
  }));
}

export function relaySkillResource(uri) {
  const skill = SKILLS.find(item => item.uri === uri);
  if (!skill) return null;
  return {
    uri: skill.uri,
    mimeType: "text/markdown",
    text: skill.content
  };
}
