import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  RELAY_SKILL_EXTENSION,
  relaySkillCatalog,
  relaySkillByUri,
  relaySkillResource
} from "./skills.js";

test("Relay advertises five importable skills with valid digests", () => {
  assert.equal(RELAY_SKILL_EXTENSION, "io.modelcontextprotocol/skills");
  const skills = relaySkillCatalog();
  assert.equal(skills.length, 5);
  assert.equal(new Set(skills.map(skill => skill.frontmatter.name)).size, 5);

  for (const skill of skills) {
    assert.equal(skill.uri, `skill://relay/${skill.frontmatter.name}/SKILL.md`);
    assert.equal(skill.resources.length, 1);
    assert.equal(skill.resources[0].uri, skill.uri);

    const resource = relaySkillResource(skill.uri);
    assert.ok(resource);
    assert.equal(resource.uri, skill.uri);
    assert.equal(resource.mimeType, "text/markdown");
    assert.ok(resource.text.startsWith(`---\nname: ${skill.frontmatter.name}\ndescription: ${skill.frontmatter.description}\n---\n`));

    const digest = "sha256:" + createHash("sha256").update(resource.text, "utf8").digest("hex");
    assert.equal(skill.resources[0].digest, digest);
    assert.deepEqual(relaySkillByUri(skill.uri), skill);
  }
});
