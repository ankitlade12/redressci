import assert from "node:assert/strict";
import test from "node:test";
import { issueToken, verifyToken, type Identity } from "./auth.js";
import {
  createDeploymentProof,
  createProofBundle,
  createReporterAccessLink,
  dashboard,
  exportDataset,
  getPlatformState,
  githubCheckBundle,
  patternReport,
  proposeCounterfactuals,
  recordConsent,
  recordDeploymentVerification,
  resetPlatform,
  reviewCounterfactual,
  resolveReporterAccessLink,
  runAssuranceSuite,
  sealEscrow,
  synchronizeEvidence,
  updateEvidenceVersion,
  updateReporterPreferences,
  verifyAuditChain,
  verifyPlatformDocument,
  verifyProofBundle,
} from "./platform.js";
import { runEvaluation } from "./evaluation.js";
import { getCase, resetStore } from "./store.js";

const admin: Identity = { id: "member-admin", name: "Demo administrator", role: "admin", workspaceId: "workspace-open-public-lab" };
const reviewer: Identity = { id: "member-reviewer", name: "Demo reviewer", role: "reviewer", workspaceId: "workspace-open-public-lab" };

function demo() {
  resetStore();
  const item = getCase("RC-1042");
  assert.ok(item);
  resetPlatform([item]);
  return item;
}

test("signed role tokens reject tampering and preserve workspace roles", () => {
  const token = issueToken(reviewer, 60);
  assert.deepEqual(verifyToken(token), reviewer);
  assert.equal(verifyToken(`${token}x`), null);
});

test("evidence version changes invalidate exact dependents and enqueue re-review", () => {
  const item = demo();
  synchronizeEvidence(item);
  const result = updateEvidenceVersion(reviewer, item, "EV-201", {
    locator: "facilities.json → central-hall.accessibility@2026-07-19",
    excerpt: "Central Hall remains stairs-only while elevator work is pending.",
  });
  assert.equal(result.version.version, 2);
  assert.ok(result.invalidated.length >= 2);
  assert.ok(result.invalidated.every((dependency) => dependency.state === "invalidated"));
  assert.equal(getPlatformState().reviewQueue.at(-1)?.state, "open");
  assert.equal(verifyAuditChain(), true);
});
test("assurance suite catches mutations, records stability, and guards neighboring scope", () => {
  const item = demo();
  const result = runAssuranceSuite(admin, item);
  assert.equal(result.mutation.detectionRate, 1);
  assert.equal(result.mutation.passed, true);
  assert.equal(result.stability.passRate, 1);
  assert.equal(result.stability.stable, true);
  assert.equal(result.scopeGuard.passed, true);
  const view = dashboard([item]);
  assert.equal(view.metrics.mutationDetection, 1);
  assert.equal(view.metrics.repeatRunStability, 1);
});

test("proof bundles are signed, evidence-pinned, and fail verification after tampering", () => {
  const item = demo();
  const bundle = createProofBundle(admin, item);
  assert.equal(verifyProofBundle(bundle), true);
  assert.equal(bundle.evidencePins.length, item.evidence.length);
  const tampered = structuredClone(bundle);
  tampered.caseId = "RC-TAMPERED";
  assert.equal(verifyProofBundle(tampered), false);
});

test("community variations require review and escrow never returns its sealed payload", () => {
  const item = demo();
  const variations = proposeCounterfactuals(reviewer, item);
  assert.equal(variations.length, 4);
  const sensitive = variations.find((entry) => entry.sensitive);
  assert.ok(sensitive);
  assert.equal(reviewCounterfactual(reviewer, sensitive.id, "approved").status, "approved");
  const escrow = sealEscrow(reviewer, item);
  assert.equal(escrow.sealedPayload, "[sealed]");
  assert.match(escrow.payloadHash, /^[a-f0-9]{64}$/);
});

test("interoperability exports omit originals and pattern reporting suppresses small groups", () => {
  const item = demo();
  const braintrust = exportDataset(item, "braintrust");
  assert.ok(Array.isArray(braintrust.payload.records));
  assert.doesNotMatch(JSON.stringify(braintrust), new RegExp(item.reporterName));
  const patterns = patternReport();
  assert.equal(patterns.groups.length, 0);
  assert.ok(patterns.suppressedGroups >= 1);
});

test("consent history is append-only and withdrawal is explicit", () => {
  const item = demo();
  const decision = recordConsent({ ...admin, id: "member-reporter", role: "reporter" }, { caseId: item.id, scope: "community-pack", action: "withdrawn", reason: "Reporter changed their sharing preference." });
  assert.equal(decision.action, "withdrawn");
  assert.equal(getPlatformState().consent.at(-1)?.reason, decision.reason);
  assert.equal(verifyAuditChain(), true);
});

test("private reporter links store only hashes and support scoped preferences", () => {
  const item = demo();
  const created = createReporterAccessLink({ ...admin, id: "member-reporter", role: "reporter" }, item);
  assert.ok(created.token.length >= 24);
  assert.doesNotMatch(JSON.stringify(getPlatformState()), new RegExp(created.token));
  const resolved = resolveReporterAccessLink(created.token);
  assert.equal(resolved.caseId, item.id);
  const preferences = updateReporterPreferences(created.token, { reviewQuestions: false });
  assert.equal(preferences.reviewQuestions, false);
  assert.throws(() => resolveReporterAccessLink(`${created.token}x`), /invalid or expired/);
});

test("deployed verification produces a distinct signed proof", () => {
  const item = demo();
  assert.ok(item.evaluation);
  const response = item.targetPair?.correctedResponse || "River Library is accessible according to the facility register.";
  const run = runEvaluation(item.evaluation, "custom", response);
  item.runs.unshift(run);
  recordDeploymentVerification(admin, item, {
    id: "LIVE-TEST",
    adapterId: "adapter-http",
    adapterName: "Test deployment",
    targetVersion: "civicaid@test",
    endpointOrigin: "https://example.invalid",
    runId: run.id,
    responseSha256: "a".repeat(64),
    state: run.state,
    verified: run.state === "pass",
    createdAt: new Date().toISOString(),
  });
  const proof = createDeploymentProof(admin, item);
  assert.equal(verifyPlatformDocument(proof), true);
  assert.equal(item.status, "Verified fixed");
});

test("GitHub workflow calls a deployed target and privacy threshold reveals only grouped patterns", () => {
  const item = demo();
  const bundle = githubCheckBundle(item);
  assert.match(bundle.workflow, /REDRESSCI_TARGET_URL/);
  assert.match(bundle.workflow, /runner\/cli\.ts/);
  assert.doesNotMatch(bundle.workflow, new RegExp(item.reporterName));

  const second = structuredClone(item); second.id = "RC-2042";
  const third = structuredClone(item); third.id = "RC-3042";
  resetPlatform([item, second, third]);
  const report = patternReport();
  assert.equal(report.groups.length, 1);
  assert.equal(report.groups[0].count, 3);
  assert.ok(report.groups[0].mechanism);
  assert.ok(report.groups[0].capability);
});
