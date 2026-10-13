# Exact-byte artifact ingress

When canonical bytes already exist, never manually reconstruct them through model-authored base64 or text.

1. Prefer direct upload to the exact admitted repository/branch/folder when the user has the file and GitHub is the better transport.
2. Otherwise use another binary-safe exact-byte transport.
3. Machine-derived chunking is allowed only with deterministic ordering and final byte-count + SHA-256 verification.
4. Read the stored artifact back and verify it before CI, release, transformation, or publication.

If the available path cannot preserve exact bytes, stop that path and route through an approved binary-safe intake. Never guess, retype, redraw, recompress, or silently substitute canonical bytes.
