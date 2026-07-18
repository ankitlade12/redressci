import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { aiStatus, extractInteraction, proposeIncident } from "./ai.js";
import { attachIdentity, issueToken, requireRole } from "./auth.js";
import { compileCase } from "./compiler.js";
import { passesValidationGate, runEvaluation, runEvaluationHybrid } from "./evaluation.js";
import { createDemoCase } from "./fixtures.js";
import { createRedressReceipt } from "./receipt.js";
import { findUnredactedPersonalData, proposeRedaction } from "./privacy.js";
import {
  calculateSlo,
  completeReviewTask,
  configureAdapter,
  configurePlatformPersistence,
  createProofBundle,
  dashboard,
  deliverIntegration,
  enqueueEvaluation,
  executeAdapter,
  exportDataset,
  fingerprintCase,
  getPlatformState,
  listJobs,
  oecdExport,
  patternReport,
  phaseReadiness,
  proposeCounterfactuals,
  publicCase,
  recordConsent,
  recordRecurrence,
  regulatoryMappings,
  releasePack,
  resetPlatform,
  reviewCounterfactual,
  runAssuranceSuite,
  sealEscrow,
  synchronizeEvidence,
  updateEvidenceVersion,
  updateWorkspacePolicy,
  verifyAuditChain,
  verifyPlatformDocument,
  verifyProofBundle,
} from "./platform.js";
import { readEncryptedArtifact, storeEncryptedArtifact } from "./secure-storage.js";
import { createCase, getCase, listCases, resetStore, saveCase } from "./store.js";
import type { Assertion } from "../src/types.js";
import type { SignedProofBundle, WorkspaceRole } from "../src/platform-types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "text/plain", "application/pdf"];
    if (!allowed.includes(file.mimetype)) return callback(new Error("Unsupported file type"));
    callback(null, true);
  },
});

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(attachIdentity);

configurePlatformPersistence(root);
if (!process.env.REDRESSCI_PERSIST) resetPlatform(listCases());
else listCases().forEach(synchronizeEvidence);

app.get("/api/health", (_request, response) => response.json({ ok: true, ai: aiStatus(), demoMode: process.env.REDRESSCI_AUTH_REQUIRED !== "1", authRequired: process.env.REDRESSCI_AUTH_REQUIRED === "1" }));
app.post("/api/auth/demo/:role", (request, response) => {
  if (process.env.REDRESSCI_AUTH_REQUIRED === "1") return response.status(404).json({ error: "Demo authentication is disabled." });
  const role = String(request.params.role) as WorkspaceRole;
  const member = getPlatformState().workspace.members.find((entry) => entry.role === role);
  if (!member || !["reporter", "reviewer", "developer", "admin", "partner"].includes(role)) return response.status(404).json({ error: "Demo role not found." });
  response.json({ token: issueToken({ id: member.id, name: member.displayName, role, workspaceId: getPlatformState().workspace.id }), member });
});
function visibleCase(item: ReturnType<typeof getCase>, role?: WorkspaceRole) {
  if (!item) return item;
  if (role === "developer" || role === "partner") return { ...item, reporterName: "[REDACTED]", originalTranscript: "", redactions: item.redactions.map((entry) => ({ ...entry, value: "[PRIVATE]" })) };
  return item;
}

app.get("/api/cases", requireRole("reporter", "reviewer", "developer", "admin", "partner"), (request, response) => {
  const available = request.identity?.role === "reporter" ? listCases().filter((item) => item.reporterId === request.identity?.id) : listCases();
  response.json({ cases: available.map((item) => visibleCase(item, request.identity?.role)) });
});
app.get("/api/cases/:id", requireRole("reporter", "reviewer", "developer", "admin", "partner"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (request.identity?.role === "reporter" && item.reporterId !== request.identity.id) return response.status(403).json({ error: "Reporters can only access their own cases." });
  response.json({ case: visibleCase(item, request.identity?.role) });
});

app.post("/api/cases", requireRole("reporter", "admin"), (request, response) => response.status(201).json({ case: createCase({ ...request.body, reporterId: request.identity?.id }) }));

app.post("/api/reset", requireRole("admin"), (_request, response) => {
  const item = resetStore();
  resetPlatform([item]);
  response.json({ case: item });
});

app.post("/api/cases/:id/artifacts", requireRole("reporter", "admin"), upload.single("artifact"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (!request.file) return response.status(400).json({ error: "Artifact is required." });
  const artifact = storeEncryptedArtifact(root, { id: `${item.id}--${randomUUID()}`, name: request.file.originalname, type: request.file.mimetype, data: request.file.buffer, region: getPlatformState().workspace.policy.region });
  response.status(201).json({ artifact: { ...artifact, private: true } });
});

app.get("/api/artifacts/:id", requireRole("reporter", "reviewer", "admin"), (request, response, next) => {
  try {
    const id = String(request.params.id);
    const item = getCase(id.split("--")[0]);
    if (!item) return response.status(404).json({ error: "Artifact case not found." });
    if (request.identity?.role === "reporter" && item.reporterId !== request.identity.id) return response.status(403).json({ error: "Reporters can only access artifacts from their own cases." });
    response.type("application/octet-stream").send(readEncryptedArtifact(root, id));
  }
  catch (error) { next(error); }
});

app.post("/api/cases/:id/extract", requireRole("reporter", "reviewer", "admin"), async (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const live = await extractInteraction({ transcript: request.body.transcript || item.originalTranscript, imageDataUrl: request.body.imageDataUrl });
    const extraction = live || {
      userInput: item.userInput || "Which nearby cooling center can I enter using a wheelchair?",
      observedResponse: item.observedResponse || "Central Hall is the closest cooling center.",
      uncertainText: [],
      confidence: 0.98,
      mode: "deterministic demo",
    };
    item.userInput = extraction.userInput;
    item.observedResponse = extraction.observedResponse;
    saveCase(item);
    response.json({ extraction, ai: Boolean(live) });
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/redact", requireRole("reporter", "reviewer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  const source = request.body.transcript || item.originalTranscript;
  const { redacted, redactions } = proposeRedaction(source, item.reporterName);
  const candidate = typeof request.body.redactedTranscript === "string" ? request.body.redactedTranscript : redacted;
  const leaks = findUnredactedPersonalData(candidate, redactions);
  if (request.body.approve && leaks.length) return response.status(400).json({ error: `Privacy approval blocked. Review possible ${leaks.join(", ")}.`, leaks });
  item.redactedTranscript = candidate;
  item.redactions = redactions;
  item.privacyApproved = Boolean(request.body.approve);
  if (item.privacyApproved) {
    const reviewer = request.body.reviewer || "Reporter";
    const approvedAt = new Date().toISOString();
    item.review.privacyApprovedBy = reviewer;
    item.review.privacyApprovedAt = approvedAt;
    if (!item.timeline.some((event) => event.label === "Privacy approved")) item.timeline.push({ id: randomUUID(), label: "Privacy approved", detail: "Personal details were reviewed before developer access.", actor: reviewer, createdAt: approvedAt, complete: true });
  }
  item.status = item.privacyApproved ? "Awaiting evidence review" : "Awaiting privacy review";
  saveCase(item);
  response.json({ redacted, redactions, approved: item.privacyApproved });
});

app.post("/api/cases/:id/structure", requireRole("reviewer", "admin"), async (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const draft = await proposeIncident(item) || {
      title: item.title,
      summary: item.description,
      expectedBehavior: item.expectedBehavior,
      category: item.category,
      severity: item.severity,
      affectedAudience: item.audience,
      questions: item.questions,
      mode: "reviewed demo fixture",
    };
    response.json({ draft, ai: !Object.hasOwn(draft, "mode") });
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/evidence", requireRole("reviewer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  const evidence = { ...request.body, id: request.body.id || `EV-${Date.now()}`, status: "proposed" };
  item.evidence.push(evidence);
  saveCase(item);
  response.status(201).json({ evidence });
});

app.post("/api/cases/:id/evidence/:evidenceId/review", requireRole("reviewer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (!item.privacyApproved) return response.status(409).json({ error: "Privacy review must be approved first." });
  const evidence = item.evidence.find((entry) => entry.id === String(request.params.evidenceId));
  if (!evidence) return response.status(404).json({ error: "Evidence not found" });
  const status = request.body.status === "approved" ? "approved" : "rejected";
  evidence.status = status;
  if (status === "approved") {
    const reviewer = request.body.reviewer || "Reviewer";
    const approvedAt = new Date().toISOString();
    item.review.evidenceApprovedBy = reviewer;
    item.review.evidenceApprovedAt = approvedAt;
    if (!item.timeline.some((event) => event.label === "Evidence reviewed")) item.timeline.push({ id: randomUUID(), label: "Evidence reviewed", detail: "A reviewer approved the source used to define expected behavior.", actor: reviewer, createdAt: approvedAt, complete: true });
  }
  saveCase(item);
  synchronizeEvidence(item);
  response.json({ evidence, review: item.review });
});

app.post("/api/cases/:id/review-expected-behavior", requireRole("reviewer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (!item.evidence.some((evidence) => evidence.status === "approved")) return response.status(409).json({ error: "Approve supporting evidence first." });
  if (!request.body.expectedBehavior?.trim()) return response.status(400).json({ error: "Expected behavior is required." });
  item.expectedBehavior = request.body.expectedBehavior.trim();
  item.category = request.body.category || item.category;
  item.audience = request.body.audience || item.audience;
  item.severity = request.body.severity || item.severity;
  item.review.expectedBehaviorApproved = true;
  item.review.expectedBehaviorApprovedBy = request.body.reviewer || "Reviewer";
  item.review.expectedBehaviorApprovedAt = new Date().toISOString();
  saveCase(item);
  response.json({ case: item });
});

app.put("/api/cases/:id/assertions", requireRole("reviewer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  const approvedIds = new Set(item.evidence.filter((evidence) => evidence.status === "approved").map((evidence) => evidence.id));
  const assertions: Assertion[] = Array.isArray(request.body.assertions) ? request.body.assertions : [];
  if (!assertions.length) return response.status(400).json({ error: "At least one assertion is required." });
  if (assertions.some((assertion) => !assertion.value?.trim() || !assertion.evidenceIds?.length || assertion.evidenceIds.some((id: string) => !approvedIds.has(id)))) return response.status(400).json({ error: "Every assertion must have a value and cite approved evidence." });
  item.reviewAssertions = assertions.map((assertion, index) => ({ ...assertion, id: assertion.id || `AS-${index + 1}` }));
  saveCase(item);
  response.json({ assertions: item.reviewAssertions });
});

app.put("/api/cases/:id/targets", requireRole("reviewer", "developer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  const { brokenResponse: broken, correctedResponse: corrected } = request.body;
  if (!broken?.trim() || !corrected?.trim()) return response.status(400).json({ error: "Both recorded target responses are required." });
  item.targetPair = {
    brokenResponse: broken.trim(),
    correctedResponse: corrected.trim(),
    brokenVersion: request.body.brokenVersion?.trim() || "reported-broken",
    correctedVersion: request.body.correctedVersion?.trim() || "candidate-fix",
    approvedBy: request.body.reviewer || "Reviewer",
    approvedAt: new Date().toISOString(),
  };
  saveCase(item);
  response.json({ targetPair: item.targetPair });
});

app.post("/api/cases/:id/compile", requireRole("reviewer", "developer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    item.evaluation = compileCase(item);
    item.status = "Test generated";
    item.timeline.push({ id: randomUUID(), label: "Regression test generated", detail: "The reviewed report is now a portable, evidence-linked evaluation.", actor: "RedressCI", createdAt: new Date().toISOString(), complete: true });
    saveCase(item);
    response.json({ evaluation: item.evaluation });
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/runs", requireRole("reviewer", "developer", "admin"), async (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item || !item.evaluation) return response.status(409).json({ error: "Generate an evaluation before running it." });
    const target = request.body.target === "fixed" ? "fixed" : "broken";
    const run = await runEvaluationHybrid(item.evaluation, target, request.body.response);
    item.runs.unshift(run);
    item.status = target === "broken" && run.state === "fail" ? "Reproduced" : item.status;
    saveCase(item);
    response.status(201).json({ run });
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/validate", requireRole("reviewer", "developer", "admin"), async (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item || !item.evaluation) return response.status(409).json({ error: "Generate an evaluation before validation." });
    if (!item.targetPair) return response.status(409).json({ error: "Register reviewer-approved broken and corrected targets before validation." });
    const [broken, fixed] = await Promise.all([
      runEvaluationHybrid(item.evaluation, "broken", item.targetPair.brokenResponse),
      runEvaluationHybrid(item.evaluation, "fixed", item.targetPair.correctedResponse),
    ]);
    broken.targetVersion = item.targetPair.brokenVersion;
    fixed.targetVersion = item.targetPair.correctedVersion;
    const verified = passesValidationGate(broken, fixed);
    item.runs = [fixed, broken, ...item.runs].slice(0, 20);
    item.evaluation.validation = { brokenRunId: broken.id, correctedRunId: fixed.id };
    item.evaluation.status = verified ? "verified" : "reviewed";
    item.status = verified ? "Verified fixed" : "Ready for verification";
    item.timeline.push({ id: randomUUID(), label: verified ? "Fix independently verified" : "Validation needs review", detail: verified ? "The test failed on the broken version and passed on the corrected version." : "The comparison did not distinguish the two target versions.", actor: "RedressCI validation gate", createdAt: new Date().toISOString(), complete: verified });
    saveCase(item);
    response.json({ verified, broken, fixed, gate: { requiresBrokenFailure: true, requiresFixedPass: true } });
  } catch (error) { next(error); }
});

app.get("/api/cases/:id/export", requireRole("reporter", "reviewer", "developer", "admin", "partner"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item?.evaluation) return response.status(404).json({ error: "No evaluation available." });
  const filename = `${item.evaluation.id}.json`;
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.type("application/json").send(JSON.stringify(item.evaluation, null, 2));
});

app.get("/api/cases/:id/receipt", requireRole("reporter", "reviewer", "developer", "admin", "partner"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const receipt = createRedressReceipt(item);
    response.setHeader("Content-Disposition", `attachment; filename="${item.id.toLowerCase()}-redress-receipt.json"`);
    response.type("application/json").send(JSON.stringify(receipt, null, 2));
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/status", requireRole("reporter", "reviewer", "developer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (request.identity?.role === "reporter" && (item.reporterId !== request.identity.id || request.body.status !== "Withdrawn")) return response.status(403).json({ error: "Reporters may only withdraw their own case." });
  if (request.identity?.role === "developer" && !["Fix in progress", "Ready for verification"].includes(request.body.status)) return response.status(403).json({ error: "Developers may only move a case through fix implementation states." });
  if (request.body.status === "Verified fixed" && item.evaluation?.status !== "verified") return response.status(409).json({ error: "The broken-versus-fixed gate must pass before this case can be marked verified." });
  item.status = request.body.status;
  saveCase(item);
  response.json({ case: item });
});

// All-phase product APIs. The credential-free demo receives an admin identity;
// bearer tokens from /api/auth/demo/:role exercise the same role boundaries.
app.get("/api/platform", requireRole("reviewer", "developer", "admin", "partner"), (_request, response) => response.json({ platform: dashboard(listCases()) }));
app.get("/api/platform/readiness", requireRole("reviewer", "developer", "admin", "partner"), (_request, response) => response.json({ readiness: phaseReadiness(listCases()) }));
app.get("/api/platform/audit", requireRole("reviewer", "admin", "partner"), (_request, response) => response.json({ valid: verifyAuditChain(), events: getPlatformState().audit }));

app.post("/api/cases/:id/consent", requireRole("reporter", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const consent = recordConsent(request.identity!, { caseId: item.id, scope: request.body.scope, action: request.body.action, reason: request.body.reason });
    if (consent.action === "withdrawn") { item.status = "Withdrawn"; saveCase(item); }
    response.status(201).json({ consent });
  } catch (error) { next(error); }
});

app.put("/api/cases/:id/evidence/:evidenceId/version", requireRole("reviewer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.json(updateEvidenceVersion(request.identity!, item, String(request.params.evidenceId), { locator: request.body.locator, excerpt: request.body.excerpt }));
  } catch (error) { next(error); }
});

app.post("/api/platform/reviews/:taskId/complete", requireRole("reviewer", "admin"), (request, response, next) => {
  try { response.json({ task: completeReviewTask(request.identity!, String(request.params.taskId)) }); }
  catch (error) { next(error); }
});

app.get("/api/platform/jobs", requireRole("reviewer", "developer", "admin"), (_request, response) => response.json({ jobs: listJobs() }));
app.post("/api/cases/:id/jobs", requireRole("reviewer", "developer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.status(202).json(enqueueEvaluation(request.identity!, item, { target: request.body.target === "broken" ? "broken" : "fixed", idempotencyKey: request.body.idempotencyKey || `${item.id}:${request.body.target || "fixed"}` }));
  } catch (error) { next(error); }
});

app.put("/api/platform/adapters/:adapterId", requireRole("developer", "admin"), (request, response, next) => {
  try { response.json({ adapter: configureAdapter(request.identity!, String(request.params.adapterId), request.body) }); }
  catch (error) { next(error); }
});
app.post("/api/platform/adapters/:adapterId/run", requireRole("developer", "admin"), async (request, response, next) => {
  try { response.json({ output: await executeAdapter(String(request.params.adapterId), { message: request.body.message }) }); }
  catch (error) { next(error); }
});

app.get("/api/cases/:id/export/:provider", requireRole("reviewer", "developer", "admin", "partner"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const provider = String(request.params.provider);
    if (!["langsmith", "braintrust", "langfuse", "oecd"].includes(provider)) return response.status(400).json({ error: "Unsupported export provider." });
    response.json({ export: exportDataset(item, provider as "langsmith" | "braintrust" | "langfuse" | "oecd") });
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/assurance", requireRole("reviewer", "developer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.json({ assurance: runAssuranceSuite(request.identity!, item) });
  } catch (error) { next(error); }
});

app.get("/api/cases/:id/proof", requireRole("reviewer", "developer", "admin", "partner"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const proof = createProofBundle(request.identity!, item);
    response.setHeader("Content-Disposition", `attachment; filename="${item.id.toLowerCase()}-proof.json"`);
    response.json(proof);
  } catch (error) { next(error); }
});
app.post("/api/platform/proofs/verify", (request, response) => response.json({ valid: verifyProofBundle(request.body as SignedProofBundle) }));
app.post("/api/platform/documents/verify", (request, response) => response.json({ valid: verifyPlatformDocument(request.body) }));

app.post("/api/cases/:id/fingerprint", requireRole("reviewer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.json({ fingerprint: fingerprintCase(request.identity!, item) });
  } catch (error) { next(error); }
});
app.post("/api/cases/:id/counterfactuals", requireRole("reviewer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.status(201).json({ counterfactuals: proposeCounterfactuals(request.identity!, item) });
  } catch (error) { next(error); }
});
app.post("/api/platform/counterfactuals/:id/review", requireRole("reviewer", "admin"), (request, response, next) => {
  try { response.json({ counterfactual: reviewCounterfactual(request.identity!, String(request.params.id), request.body.status === "approved" ? "approved" : "rejected") }); }
  catch (error) { next(error); }
});
app.put("/api/platform/packs/:id/release", requireRole("reviewer", "admin"), (request, response, next) => {
  try { response.json({ pack: releasePack(request.identity!, String(request.params.id), { version: request.body.version, changelog: request.body.changelog }) }); }
  catch (error) { next(error); }
});

app.post("/api/cases/:id/escrow", requireRole("reviewer", "admin", "partner"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.status(201).json({ escrow: sealEscrow(request.identity!, item) });
  } catch (error) { next(error); }
});
app.get("/api/public/cases/:id", (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.json({ case: publicCase(item) });
  } catch (error) { next(error); }
});
app.get("/api/cases/:id/oecd", requireRole("reviewer", "admin", "partner"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  response.json({ record: oecdExport(item) });
});

app.get("/api/cases/:id/slo", requireRole("reviewer", "developer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  response.json({ slo: calculateSlo(item) });
});
app.post("/api/cases/:id/recurrences", requireRole("developer", "admin"), (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    response.status(201).json({ recurrence: recordRecurrence(request.identity!, item, request.body.productVersion, request.body.runId) });
  } catch (error) { next(error); }
});
app.get("/api/platform/patterns", requireRole("reviewer", "admin", "partner"), (_request, response) => response.json({ report: patternReport() }));
app.put("/api/platform/workspace/policy", requireRole("admin"), (request, response, next) => {
  try { response.json({ policy: updateWorkspacePolicy(request.identity!, request.body) }); }
  catch (error) { next(error); }
});
app.post("/api/platform/integrations/:id/deliver", requireRole("developer", "admin"), (request, response, next) => {
  try { response.json({ integration: deliverIntegration(request.identity!, String(request.params.id), request.body.event || "evaluation.verified") }); }
  catch (error) { next(error); }
});
app.get("/api/cases/:id/regulatory-mappings", requireRole("reviewer", "admin", "partner"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  response.json(regulatoryMappings(item));
});

if (process.env.NODE_ENV === "production" || process.argv.includes("--production")) {
  app.use(express.static(path.join(root, "dist")));
  app.get(/.*/, (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
}

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(400).json({ error: error.message || "Request failed" });
});

export function startServer(port = Number(process.env.PORT || 8787)) {
  return app.listen(port, () => console.log(`RedressCI API listening on http://localhost:${port}`));
}

const isDirectEntry = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectEntry) startServer();

export { app };
