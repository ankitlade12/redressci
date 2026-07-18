import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runEvaluation } from "../server/evaluation.js";
import { createDemoCase } from "../server/fixtures.js";
import { Overview, ValidationView } from "./App.js";
import { areReviewTextsEquivalent, getCaseOverviewState } from "./case-state.js";

test("pending intake never claims privacy, evidence, or validation approval", () => {
  const item = createDemoCase();
  item.privacyApproved = false;
  item.review.expectedBehaviorApproved = false;
  item.evidence.forEach((evidence) => { evidence.status = "proposed"; });
  item.evaluation = undefined;
  item.runs = [];

  const state = getCaseOverviewState(item);
  assert.equal(state.privacyApproved, false);
  assert.equal(state.expectedBehaviorApproved, false);
  assert.equal(state.approvedEvidenceCount, 0);
  assert.equal(state.validation, null);
});

test("expected behavior is evidence-backed only after both human approvals", () => {
  const item = createDemoCase();
  item.review.expectedBehaviorApproved = false;
  assert.equal(getCaseOverviewState(item).expectedBehaviorApproved, false);

  item.review.expectedBehaviorApproved = true;
  item.evidence.forEach((evidence) => { evidence.status = "proposed"; });
  assert.equal(getCaseOverviewState(item).expectedBehaviorApproved, false);

  item.evidence[0].status = "approved";
  assert.equal(getCaseOverviewState(item).expectedBehaviorApproved, true);
});

test("verification summary uses only the runs pinned by comparative validation", () => {
  const item = createDemoCase();
  const evaluation = item.evaluation!;
  const broken = runEvaluation(evaluation, "broken");
  const fixed = runEvaluation(evaluation, "fixed");
  item.runs = [fixed, broken];
  evaluation.validation = {};
  assert.equal(getCaseOverviewState(item).validation, null);

  evaluation.validation = { brokenRunId: broken.id, correctedRunId: fixed.id };
  const validation = getCaseOverviewState(item).validation;
  assert.equal(validation?.broken.id, broken.id);
  assert.equal(validation?.fixed.id, fixed.id);
  assert.equal(validation?.verified, true);
});

test("pending Overview renders no premature approval or verification claims", () => {
  const item = createDemoCase();
  item.privacyApproved = false;
  item.review.expectedBehaviorApproved = false;
  item.evidence = [];
  item.evaluation = undefined;
  item.runs = [];

  const html = renderToStaticMarkup(createElement(Overview, { item, setTab: () => undefined }));
  assert.match(html, /Privacy review pending/);
  assert.match(html, /Pending review/);
  assert.match(html, /Evaluation not generated/);
  assert.doesNotMatch(html, /Privacy review approved/);
  assert.doesNotMatch(html, /Evidence-backed/);
  assert.doesNotMatch(html, /Known-broken/);
});

test("review rules and corrected targets must be meaningfully distinct records", () => {
  assert.equal(areReviewTextsEquivalent("Recommend a step-free location.", " recommend a step-free location "), true);
  assert.equal(areReviewTextsEquivalent("Recommend a verified step-free location.", "River Library has verified step-free access."), false);
});

test("private recorded-response validation never claims publication or a deployed fix", () => {
  const item = createDemoCase();
  const evaluation = item.evaluation!;
  const broken = runEvaluation(evaluation, "broken");
  const fixed = runEvaluation(evaluation, "fixed");
  item.consent = "Private to reporter";
  item.runs = [fixed, broken];
  evaluation.validation = { brokenRunId: broken.id, correctedRunId: fixed.id };

  const html = renderToStaticMarkup(createElement(ValidationView, { item, runs: null, onRun: () => undefined, running: false }));
  assert.match(html, /recorded broken and corrected responses/i);
  assert.match(html, /remains private under its current consent scope/i);
  assert.match(html, /Evaluation verified/);
  assert.match(html, /Assertions passed/);
  assert.match(html, /Grader prompt/);
  assert.doesNotMatch(html, /Publication is allowed/i);
  assert.doesNotMatch(html, /independently verified/i);
});
