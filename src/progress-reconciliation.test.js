import test from "node:test";
import assert from "node:assert/strict";
import { reconcileExecution } from "./progress-reconciliation.js";

test("held reservations are not reported as active execution", () => {
  assert.equal(reconcileExecution({id:"x",state:"held",branch:"relay/x"}, []).disposition, "reserved-not-executing");
});
test("branch drift requires reconciliation", () => {
  assert.equal(reconcileExecution({id:"x",state:"active",branch:"relay/x"}, [{type:"missing_branch",assignment:"x",branch:"relay/x"}]).disposition, "reconciliation-required");
});
test('retired work stays terminal even when its old branch needs reconciliation', () => {
  for (const state of ['cancelled', 'superseded']) {
    assert.equal(reconcileExecution({ id: 'x', state }, [{ type: 'missing_branch', assignment: 'x' }]).disposition, state);
  }
});
