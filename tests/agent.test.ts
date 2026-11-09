import { test } from "node:test";
import assert from "node:assert/strict";
import { publicProduct, validateAgentOutput } from "../shared/agent-contract";
import { readyProduct } from "./fixture";
test("AI request excludes private evidence and unconfirmed values", async () => {
  const p = await readyProduct();
  p.rightsNote = "PRIVATE";
  p.facts[2] = {
    key: "material",
    value: "UNCONFIRMED",
    confirmed: false,
    source: "PRIVATE",
  };
  const wire = JSON.stringify(publicProduct(p, "shorter"));
  assert.ok(!wire.includes("PRIVATE"));
  assert.ok(!wire.includes("UNCONFIRMED"));
  assert.ok(!wire.includes("sha256"));
  assert.equal(JSON.parse(wire).images.length, 1);
});
test("AI output rejects malformed arrays and oversized copy", () => {
  const x = {
    productId: "p",
    sourceVersion: 1,
    title: "제목",
    description: "설명",
    questions: [],
    observations: [],
    keywords: [],
    checklist: [],
  };
  assert.ok(validateAgentOutput(x));
  assert.ok(!validateAgentOutput({ ...x, questions: ["ok", 42] }));
  assert.ok(!validateAgentOutput({ ...x, description: "x".repeat(10001) }));
});
