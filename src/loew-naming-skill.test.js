import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  LOEW_NAMING_SKILL_URI,
  loewNamingSkillCatalogEntry,
  loewNamingSkillResourceDescriptor,
  loewNamingSkillResource
} from "./loew-naming-skill.js";

test("loew naming skill publishes one native MCP skill resource", () => {
  const skill = loewNamingSkillCatalogEntry();
  const descriptor = loewNamingSkillResourceDescriptor();
  const resource = loewNamingSkillResource();

  assert.equal(skill.uri, LOEW_NAMING_SKILL_URI);
  assert.equal(skill.frontmatter.name, "loew-naming");
  assert.equal(skill.resources[0].uri, LOEW_NAMING_SKILL_URI);
  assert.equal(descriptor.uri, LOEW_NAMING_SKILL_URI);
  assert.equal(descriptor.mimeType, "text/markdown");
  assert.equal(resource.uri, LOEW_NAMING_SKILL_URI);
  assert.match(resource.text, /product, subsystem, or primitive/);
  assert.match(resource.text, /field.*relay.*runner.*inspector.*arc.*revyme/);
  assert.match(resource.text, /name by loew\.fi/);
  assert.match(resource.text, /Do not claim a trademark/);

  const digest = "sha256:" + createHash("sha256").update(resource.text, "utf8").digest("hex");
  assert.equal(skill.resources[0].digest, digest);
});
