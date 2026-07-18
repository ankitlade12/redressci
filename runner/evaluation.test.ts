import assert from "node:assert/strict";
import test from "node:test";
import { createDemoCase } from "../server/fixtures.js";
import { deterministicGrade, passesValidationGate, runEvaluation } from "../server/evaluation.js";

test("the known-broken target fails for the intended accessibility reason", () => {
  const evaluation = createDemoCase().evaluation!;
  const run = runEvaluation(evaluation, "broken");
  assert.equal(run.state, "fail");
  assert.equal(run.assertionResults.find((result) => result.assertionId === "AS-1")?.state, "fail");
});

test("the corrected target passes all required checks", () => {
  const evaluation = createDemoCase().evaluation!;
  const run = runEvaluation(evaluation, "fixed");
  assert.equal(run.state, "pass");
  assert.equal(run.assertionResults.every((result) => result.state === "pass"), true);
});

test("validation gate only passes for a broken failure and corrected pass", () => {
  const evaluation = createDemoCase().evaluation!;
  const broken = runEvaluation(evaluation, "broken");
  const fixed = runEvaluation(evaluation, "fixed");
  assert.equal(passesValidationGate(broken, fixed), true);
  assert.equal(passesValidationGate(fixed, broken), false);
});

test("comparative runs use the same immutable grader prompt provenance", () => {
  const evaluation = createDemoCase().evaluation!;
  const broken = runEvaluation(evaluation, "broken");
  const fixed = runEvaluation(evaluation, "fixed");

  assert.equal(broken.promptVersion, fixed.promptVersion);
  assert.match(broken.promptVersion, /^semantic-grade@[a-f0-9]{12}$/);
});

test("insufficient semantic evidence remains inconclusive", () => {
  const evaluation = createDemoCase().evaluation!;
  const results = deterministicGrade(evaluation, "I cannot answer that question.");
  assert.equal(results.find((result) => result.assertionId === "AS-4")?.state, "inconclusive");
});
