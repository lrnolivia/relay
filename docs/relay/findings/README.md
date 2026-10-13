# Relay findings

This directory extends the Relay findings/suggestions ledger when individual entries or supporting material should not require rewriting one growing file.

- Existing historical entries may remain in `suggestions.md`.
- New findings may be stored as one file per stable RFS id here.
- Skills and planning flows must treat `suggestions.md` plus this directory as one logical ledger.
- RFS ids remain globally unique and stable.
- An index/search layer may be generated later; physical sharding must not change logical ledger semantics.

This structure exists specifically so document growth and transport limits never prevent recording or routing a finding.
