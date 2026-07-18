import assert from "node:assert/strict";
import test from "node:test";
import { compileCase } from "./compiler.js";
import { createDemoCase } from "./fixtures.js";
import { createRedressReceipt } from "./receipt.js";
import { runEvaluation } from "./evaluation.js";

test("compiler blocks cases without privacy approval", () => {
  const item = createDemoCase();
  item.privacyApproved = false;
  assert.throws(() => compileCase(item), /Privacy review/);
});

test("compiler blocks cases without approved evidence", () => {
  const item = createDemoCase();
  item.evidence = [];
  assert.throws(() => compileCase(item), /approved evidence/);
});

test("compiled assertions preserve evidence links and exclude personal data", () => {
  const evaluation = compileCase(createDemoCase());
  assert.equal(evaluation.assertions.every((assertion) => assertion.evidenceIds.length > 0), true);
  assert.equal(JSON.stringify(evaluation).includes("Maya Chen"), false);
});

test("compiler blocks reviewed evidence that still contains personal data", () => {
  const item = createDemoCase();
  item.evidence[0].excerpt = "Contact maya@example.com for the source record.";
  assert.throws(() => compileCase(item), /personal data/);
});

test("compiler requires explicit expected-behavior approval", () => {
  const item = createDemoCase();
  item.review.expectedBehaviorApproved = false;
  assert.throws(() => compileCase(item), /explicit reviewer approval/);
});

test("redress receipt requires and records comparative proof", () => {
  const item = createDemoCase();
  const evaluation = item.evaluation!;
  const broken = runEvaluation(evaluation, "broken");
  const fixed = runEvaluation(evaluation, "fixed");
  evaluation.validation = { brokenRunId: broken.id, correctedRunId: fixed.id };
  item.runs = [fixed, broken];
  const receipt = createRedressReceipt(item);
  assert.equal(receipt.comparison.broken.result, "fail");
  assert.equal(receipt.comparison.corrected.result, "pass");
  assert.match(receipt.proofSha256, /^[a-f0-9]{64}$/);
});
