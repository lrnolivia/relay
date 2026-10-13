# field guidance cleanup manifest

Status: actionable when the listed external Project source can be edited or removed.

Runner and the live field repository now force current agents to rehydrate from Runner first and resolve the canonical repository as `lrnolivia/field`.

## external Project source to retire or replace

### `LOEWFI_MASTER_REVYME_WORKER_HANDOFF.md`

Problem:
- historical worker handoff
- directs execution toward `revyme-loewfi` and an old local Revyme checkout
- predates current `lrnolivia/field` repository identity
- predates Runner-first QA law

Required cleanup when the Project source is editable:
1. remove it from active field Project Sources, or replace its contents with a short historical/deprecation pointer
2. the pointer must direct agents to:
   - `lrnolivia/loew-runner@main/contracts/manifest.json`
   - `lrnolivia/loew-runner@main/LOEW_CHAT_BIBLE.md`
   - `lrnolivia/loew-runner@main/projects/field.json`
   - `lrnolivia/field@main/AGENTS.md`
3. retain it only as archived history if its old implementation notes still have evidentiary value

Until cleanup is possible, this file is **non-authoritative historical evidence** for repository identity, execution process, and QA policy.

## intentionally retained Revyme references

Do not remove Revyme references that describe:
- technical origin / required attribution
- live compatibility identifiers
- protocol/storage/environment/dependency contracts such as legacy event names
- historical implementation evidence that is clearly marked as history

The migration is from an old execution target to field, not an attempt to erase provenance or break compatibility.
