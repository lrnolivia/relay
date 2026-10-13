# Night Shift promotion policy

## Goal

Ready work should reach `main` without user babysitting.

Automatic promotion is deterministic infrastructure, not an agent opinion.

## Candidate selection

A branch is eligible only when:

- its repository is managed
- it matches a configured implementation prefix
- it is not explicitly excluded
- it maps to an active assignment or recognized migration record
- its base is the configured default branch

Do not treat every non-main branch as implementation work.

## Preflight

For each candidate:

1. resolve branch head SHA
2. resolve current main SHA
3. locate/create the Draft PR as policy permits
4. verify assignment ownership
5. compare main...head
6. determine whether branch is behind main
7. update from main when safe and conflict-free
8. run required clean-room dependency/build/test/lint validation
9. run project-specific QA
10. record exact tested head/main SHAs

## Merge gate

Immediately before merge, refresh:

- PR head SHA
- main SHA
- mergeability
- required checks
- QA record
- ownership
- tested head/main SHAs

Merge only if all required evidence still applies.

Default merge method is squash unless a project manifest says otherwise.

## Automatic repair

The promotion manager may repair:

- stale branch sync
- missing PR metadata
- missing runner control records
- transient CI failures
- runner-owned harness problems
- safe dependency lock drift

It may not resolve semantic source conflicts by choosing one side.

## After merge

Record:

- repository
- assignment
- PR
- merged SHA
- previous main SHA
- validation evidence
- repaired artificial blockers
- remaining follow-up

Then close the assignment if its acceptance criteria are satisfied.

## Failure

If merge fails, re-read current Git state before classifying the failure.

Never retry a stale assumption.
