# Relay complete-file request transport

## Evidence and scope
Lauren requested direct Relay work without workers, then explicitly asked to fix upload sizing and give supported file batches generous room on 2026-10-02.
Field's final saved mobile file is 15,537 source characters. Its JSON request exceeded the hard 16,384 limit and returned HTTP 413 before mutation.
Both src/index.js and src/relay-entry.js enforced that old limit independently.
Regression head 76baf2b52a0d469d6c18ff154192c5ee1b8e8e04 failed quality job 110691358735 with 413 != 200 before repair.

## Repair
Both paths share a streaming UTF-8 reader capped at 8 MiB (8,388,608 bytes).
Current SOURCE commit validation allows up to 20 files, 500,000 characters per file and 1,000,000 aggregate characters. Even six-byte JSON escaping per character fits with envelope room.
This is not unlimited upload support. Existing per-tool size, path, ownership, branch and expected-identity checks are unchanged.
Content-Length is only an early rejection hint. Actual streamed bytes are counted, oversized streams cancelled, and invalid UTF-8 rejected.
A request-scoped WeakMap shares the consumed body across entry layers, avoiding an unread cloned stream and duplicate unbounded buffering.
The HTTP 413 response reports max_request_bytes and states that no source write was attempted.
No credentials, authentication scopes, deployment policy, or UI resources changed.

## Verification
Regression covers legacy complete-file commit and extension exact-text tool paths exceeding 16 KB, while invalid write arguments stay refused without provider calls.
Boundary tests cover exact ceiling, worst-case full source batch JSON, absent/misleading length, multibyte chunk boundaries, oversize cancellation, invalid UTF-8/stream errors, body reuse, unauthenticated refusal and authenticated invalid JSON.
Full exact-head checks and production verification must be recorded before release completion.
After deployment, retry the entire Field file in one guarded atomic commit and compare its bytes to the saved checkpoint. The rejected partial-file plan is not used.

## Carried-forward card proof
PR115 variants A/B/C are deployed and unchanged. Actual native ChatGPT observations are pending; fixture/browser tests are not native mount proof.
The last ordinary Mac observation remains no card at all; exact invoked tool was unknown. All prior native failures and broader MCP parity criteria remain open.
