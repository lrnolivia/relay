import test from "node:test";
import assert from "node:assert/strict";
import {
  QA_SKILL_URI,
  qaSkillCatalogEntry,
  qaSkillResourceDescriptor,
  qaSkillResource
} from "./qa-skill.js";

test("human QA skill publishes one native MCP skill resource", () => {
  const skill = qaSkillCatalogEntry();
  const descriptor = qaSkillResourceDescriptor();
  const resource = qaSkillResource();

  assert.equal(skill.uri, QA_SKILL_URI);
  assert.equal(skill.frontmatter.name, "human-qa");
  assert.equal(skill.resources[0].uri, QA_SKILL_URI);
  assert.match(skill.resources[0].digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(descriptor.uri, QA_SKILL_URI);
  assert.equal(descriptor.mimeType, "text/markdown");
  assert.equal(resource.uri, QA_SKILL_URI);
  assert.match(resource.text, /contracts\/human-qa-helper\.json/);
  assert.match(resource.text, /targeted questions/);
  assert.match(resource.text, /checklist/);
  assert.match(resource.text, /agent work, not user homework/);
  assert.match(resource.text, /Do not create a parallel review UI/);
});
