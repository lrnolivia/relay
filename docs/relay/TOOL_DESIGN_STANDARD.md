# Relay agentic tool design standard v1

Status: normative for new Relay tools and operation recipes from Relay 1.9.8 forward.

Reference baseline: https://www.arcade.dev/patterns/ — Arcade's Agentic Tool Patterns. Arcade is guidance, not an authority override. Relay keeps its own Runner ownership, SOURCE/CLOUD/VERIFY boundaries, exact-head/CAS safety, no-standing-secret law, and project/runtime allowlists.

## 1. Tool role must be obvious

Every exposed capability is classified as one of:
- **discovery** — reveals capabilities, registrations, schemas, identity, or health;
- **query** — read-only observation; safe to retry and parallelize when the provider permits;
- **command** — changes state or triggers an external side effect;
- **recipe** — a durable higher-level chain with explicit checkpoints and completion criteria.

Descriptions are written for model selection: lead with the role, say what the tool accomplishes, state important side effects, identify required prior reads when applicable, and name the safest recovery action.

## 2. Inputs

Prefer constrained enums, ranges, patterns, unique arrays, and small bounded text. Use sensible defaults only when the default is genuinely safe. Human-friendly identifiers may be accepted when Relay can resolve them deterministically.

Guarded mutations use exact identities when stale writes are dangerous. Mutually exclusive modes are enforced server-side. Unknown fields fail closed.

## 3. Discovery and dependency hints

Use layered discovery instead of trial calls. Typical chains:
- CONTROL health -> registered project -> assignment/preflight;
- SOURCE inventory/file/PR/checks -> guarded mutation -> readback;
- CLOUD project authority -> upload/version -> deploy -> VERIFY;
- RUNNER resume/assignments -> preflight -> coordinate -> resume/progress;
- VERIFY plan/query -> deterministic recipe -> browser session only when needed.

Descriptions should tell the agent when a preceding call is necessary; do not require redundant reads when current exact state is already in context.

## 4. Composition

Keep atomic tools for precise control, but prefer a durable recipe/task bundle when the same fragile multi-call sequence recurs. Do not create one tool per tiny step merely to satisfy a pattern.

High-level recipes must expose operation/resume identity, stage, exact source/deployment/evidence identities, and completion criteria while retaining bounded lower-level primitives for inspection/recovery.

## 5. Execution boundaries

Read-only queries are retryable. Commands require idempotency/readback/CAS rules appropriate to risk.

For uncertain command outcomes, **read back first; never replay blindly**.

Destructive or production-affecting commands must be explicit in description/annotations and remain permission-gated in code. Long-running external work should return durable identity/status rather than hold an unbounded synchronous call.

## 6. Outputs

Default outputs are structured and bounded. Lead with information needed for the next decision. Put large history/evidence behind resource references, pagination, detail modes, or follow-up queries.

Preserve exact identity even when human narration is simplified. Partial success must identify which items succeeded and which failed.

## 7. Context and identity

Runner owner/project/assignment identity is canonical for managed work. Staff/team identity shapes routing and presentation only.

Credentials are injected server-side. Never ask the model to carry tokens/secrets between tools. Fallbacks are permitted only when they preserve the requested authority and truth; no hidden writer substitution.

## 8. Error contract

Errors should classify at least:
`validation`, `auth`, `permission`, `not_found`, `conflict`, `capacity`, `timeout`, `uncertain_write`, or `provider`.

Return:
- human-readable message;
- retryable boolean;
- whether auth/user action is required;
- actionable recovery guidance.

A transport timeout on a mutation is treated as an uncertain write unless Relay can prove no side effect occurred.

## 9. Security

- secrets remain server-side;
- code enforces permissions/scopes; descriptions do not grant authority;
- dangerous inputs are bounded and validated;
- mutations keep audit/exact identities;
- SOURCE default-branch protection and Runner control-state authority remain separate;
- project Cloud authority and runtime allowlists both gate deployment.

## Applicability matrix

| Family | Primary role | Key patterns | Relay-specific rule / deliberate deviation |
| --- | --- | --- | --- |
| CONTROL | discovery | health check, capability matching, identity/context anchor | reports capability/authority, not personal user identity |
| RUNNER queries | query/discovery | token-efficient response, resource reference, context boundary | canonical state beats chat history |
| RUNNER coordinate | command/transaction | constrained input, transactional boundary, recovery guide | CAS record SHA; no blind takeover/replay |
| SOURCE reads | query/discovery | natural identifier, paginated/bounded result | GitHub owner restricted; exact identities returned |
| SOURCE mutations | command | idempotency/readback, conflict guard, dependency hint | non-default branch; expected SHAs where stale write is dangerous |
| CLOUD reads | query/discovery | health/permission check | project + runtime allowlist are separate rails |
| CLOUD deploy/upload | command | permission gate, operation chain, readback | deployment does not imply runtime correctness |
| VERIFY | query/execution | abstraction ladder, recipe, progressive detail | deterministic evidence preferred over exploratory browser work |
| STAFF / SKILLS | discovery | capability matching, context injection | identity/routing only; never authorization |
| UI tools | command/presentation | progressive detail, GUI handoff | UI never becomes a parallel canonical state store |
| operation recipes | recipe | task bundle, tool chain, checkpoints, compensation/recovery | preserve lower-level exact identities and bounded rollback |

## Review checklist

A new or changed tool fails review when it has ambiguous purpose, unconstrained dangerous inputs, raw opaque errors, hidden side effects, an unauthorized fallback, giant default output, or duplicates an existing higher-level capability without a clear need.
