import test from "node:test";
import assert from "node:assert/strict";
import { progressReceipt } from "./operation-receipts.js";

test("progress receipt preserves exact identities", () => {
  const receipt = progressReceipt({ project:"relay", assignment:"x", stage:"checks", state:"waiting-on-external-system", identities:{head_sha:"a".repeat(40)} });
  assert.equal(receipt.contract_version, "1.7.5");
  assert.equal(receipt.identities.head_sha, "a".repeat(40));
});
