import { randomUUID } from "node:crypto";
import type { AssertionResult, EvaluationCase, EvaluationRun, ResultState } from "../src/types.js";
import { brokenResponse, fixedResponse } from "./fixtures.js";
import { aiStatus, semanticGrade } from "./ai.js";

function summarizeResults(evaluation: EvaluationCase, assertionResults: AssertionResult[]) {
  const conclusive = assertionResults.filter((result) => result.state !== "inconclusive");
  const passed = conclusive.filter((result) => result.state === "pass").length;
  const score = conclusive.length ? passed / conclusive.length : 0;
  const hasFailure = assertionResults.some((result) => result.state === "fail");
  const hasInconclusive = assertionResults.some((result) => result.state === "inconclusive");
  const state: ResultState = hasFailure ? "fail" : hasInconclusive && !evaluation.grader.allowInconclusive ? "inconclusive" : score >= evaluation.grader.passThreshold ? "pass" : "fail";
  return { score, state };
}

export function deterministicGrade(evaluation: EvaluationCase, response: string): AssertionResult[] {
  const normalized = response.toLocaleLowerCase();
  return evaluation.assertions.map((assertion) => {
    let state: ResultState = "inconclusive";
    let explanation = "This assertion requires a model-assisted semantic review.";

    if (assertion.type === "forbidden_entity") {
      const found = normalized.includes(assertion.value.toLocaleLowerCase());
      state = found ? "fail" : "pass";
      explanation = found
        ? `Found prohibited recommendation “${assertion.value}”.`
        : `The response does not recommend “${assertion.value}”.`;
    }

    if (assertion.type === "required_concept") {
      const found = normalized.includes(assertion.value.toLocaleLowerCase());
      state = found ? "pass" : "fail";
      explanation = found
        ? `Found required accessible option “${assertion.value}”.`
        : `Missing the evidence-backed option “${assertion.value}”.`;
    }

    if (assertion.type === "evidence_citation_required") {
      const tokens = assertion.value.toLocaleLowerCase().split(/\s+/);
      const found = tokens.some((token) => token.length > 4 && normalized.includes(token));
      state = found ? "pass" : "fail";
      explanation = found
        ? "The response names the supporting facility record."
        : "No recognizable reference to the approved facility record was found.";
    }

    if (assertion.type === "semantic_rubric") {
      const addressesNeed = /wheelchair|accessible|step-free|access/i.test(response);
      state = addressesNeed ? "pass" : "inconclusive";
      explanation = addressesNeed
        ? "The response directly acknowledges and addresses the access requirement."
        : "The response does not give enough information to judge accessibility handling.";
    }

    return { assertionId: assertion.id, label: assertion.label, state, explanation, evidenceIds: assertion.evidenceIds, deterministic: assertion.deterministic };
  });
}

export function runEvaluation(evaluation: EvaluationCase, target: "broken" | "fixed", targetResponse?: string): EvaluationRun {
  const started = performance.now();
  const response = targetResponse ?? (target === "broken" ? brokenResponse : fixedResponse);
  const assertionResults = deterministicGrade(evaluation, response);
  const { score, state } = summarizeResults(evaluation, assertionResults);

  return {
    id: `RUN-${randomUUID().slice(0, 8).toUpperCase()}`,
    caseId: evaluation.id,
    target,
    targetVersion: target === "broken" ? "civicaid@1.3-broken" : "civicaid@1.4-fixed",
    model: "demo-rule-target",
    promptVersion: target === "broken" ? "system-prompt@7" : "system-prompt@8",
    response,
    state,
    score,
    latencyMs: Math.max(18, Math.round(performance.now() - started) + (target === "broken" ? 42 : 57)),
    createdAt: new Date().toISOString(),
    assertionResults,
  };
}

export async function runEvaluationHybrid(evaluation: EvaluationCase, target: "broken" | "fixed", targetResponse?: string) {
  const started = performance.now();
  const run = runEvaluation(evaluation, target, targetResponse);
  if (!aiStatus().configured) return run;
  const semanticAssertions = evaluation.assertions.filter((assertion) => !assertion.deterministic);
  for (const assertion of semanticAssertions) {
    const evidence = evaluation.evidence.filter((entry) => assertion.evidenceIds.includes(entry.id));
    const grade = await semanticGrade({ response: run.response, rubric: assertion, evidence });
    if (!grade) continue;
    const result = run.assertionResults.find((entry) => entry.assertionId === assertion.id);
    if (result) {
      result.state = grade.state;
      result.explanation = grade.explanation;
      result.evidenceIds = grade.evidenceIds.length ? grade.evidenceIds : assertion.evidenceIds;
      result.deterministic = false;
    }
  }
  const summary = summarizeResults(evaluation, run.assertionResults);
  run.score = summary.score;
  run.state = summary.state;
  run.model = process.env.OPENAI_MODEL || "gpt-5.6";
  run.latencyMs = Math.max(run.latencyMs, Math.round(performance.now() - started));
  return run;
}

export function passesValidationGate(broken: EvaluationRun, fixed: EvaluationRun): boolean {
  return broken.target === "broken" && broken.state === "fail" && fixed.target === "fixed" && fixed.state === "pass";
}
