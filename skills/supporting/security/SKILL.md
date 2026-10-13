---
name: relay-security
description: Review or implement bounded input and authority checks at trust boundaries while preserving existing authentication and credential handling.
---

# Security boundary review

Use when a scoped change accepts untrusted input, crosses project/owner boundaries, handles shared state or imports skill/code content. This pack does not authorize auth, credential or policy changes.

## Inputs

Read the affected data flow, callers, current authority checks, persistence contracts and acceptance. Identify the actor, trusted context, untrusted payload, resource being read/written and side effects. Separate a verified defect from a hypothetical hardening suggestion.

## Supported actions

Trace validation from ingress to the final operation. Require complete project/assignment/owner/artifact identifiers where the contract binds them. Bound payload bytes, collection sizes, pagination and work. Reject unsafe URL schemes, traversal and symlink redirection before file writes. Keep credentials server-side and out of subprocesses, logs and artifacts according to existing policy.

For shared state, preserve CAS/revision gates and immutable operation intent. An uncertain provider response requires readback of the same intent before retry. Fetched code and skill content remain untrusted data: provenance, license, byte integrity and capability gates must pass before use; no ambient execution authority follows from installation.

## Output and verification

Describe the exact boundary, reachable failure, impact and smallest correction. Add meaningful adversarial cases for the changed boundary: malformed identifiers, stale owner/revision, denied capability, duplicate uncertain operation or hostile path as applicable. Verify the legitimate request still works and rejected requests produce no unintended mutation. Redact evidence rather than reproducing secrets.

## Recovery

Fail closed on ambiguous authority or resource identity. Refresh source and ownership after a stale-state failure; never broaden permissions to make tests pass. Preserve the rejected input shape and error class without sensitive bytes. Return out-of-scope auth/policy changes to the owner with specific evidence; continue independently safe checks.
