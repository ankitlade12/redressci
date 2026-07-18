import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { aiStatus, extractInteraction, proposeIncident } from "./ai.js";
import { compileCase } from "./compiler.js";
import { passesValidationGate, runEvaluation, runEvaluationHybrid } from "./evaluation.js";
import { createDemoCase } from "./fixtures.js";
import { createRedressReceipt } from "./receipt.js";
import { findUnredactedPersonalData, proposeRedaction } from "./privacy.js";
import { createCase, getCase, listCases, resetStore, saveCase } from "./store.js";
import type { Assertion } from "../src/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalDir = path.join(root, "data", "originals");
mkdirSync(originalDir, { recursive: true });
const upload = multer({
  dest: originalDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "text/plain", "application/pdf"];
    if (!allowed.includes(file.mimetype)) return callback(new Error("Unsupported file type"));
    callback(null, true);
  },
});

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => response.json({ ok: true, ai: aiStatus(), demoMode: true }));
app.get("/api/cases", (_request, response) => response.json({ cases: listCases() }));
app.get("/api/cases/:id", (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  response.json({ case: item });
});

app.post("/api/cases", (request, response) => response.status(201).json({ case: createCase(request.body) }));

app.post("/api/reset", (_request, response) => response.json({ case: resetStore() }));

app.post("/api/cases/:id/artifacts", upload.single("artifact"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  response.status(201).json({ artifact: request.file ? { id: randomUUID(), name: request.file.originalname, type: request.file.mimetype, private: true } : null });
});

app.post("/api/cases/:id/extract", async (request, response, next) => {
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

app.post("/api/cases/:id/redact", (request, response) => {
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

app.post("/api/cases/:id/structure", async (request, response, next) => {
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

app.post("/api/cases/:id/evidence", (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  const evidence = { ...request.body, id: request.body.id || `EV-${Date.now()}`, status: "proposed" };
  item.evidence.push(evidence);
  saveCase(item);
  response.status(201).json({ evidence });
});

app.post("/api/cases/:id/evidence/:evidenceId/review", (request, response) => {
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
  response.json({ evidence, review: item.review });
});

app.post("/api/cases/:id/review-expected-behavior", (request, response) => {
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

app.put("/api/cases/:id/assertions", (request, response) => {
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

app.put("/api/cases/:id/targets", (request, response) => {
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

app.post("/api/cases/:id/compile", (request, response, next) => {
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

app.post("/api/cases/:id/runs", async (request, response, next) => {
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

app.post("/api/cases/:id/validate", async (request, response, next) => {
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

app.get("/api/cases/:id/export", (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item?.evaluation) return response.status(404).json({ error: "No evaluation available." });
  const filename = `${item.evaluation.id}.json`;
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.type("application/json").send(JSON.stringify(item.evaluation, null, 2));
});

app.get("/api/cases/:id/receipt", (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    const receipt = createRedressReceipt(item);
    response.setHeader("Content-Disposition", `attachment; filename="${item.id.toLowerCase()}-redress-receipt.json"`);
    response.type("application/json").send(JSON.stringify(receipt, null, 2));
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/status", (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (request.body.status === "Verified fixed" && item.evaluation?.status !== "verified") return response.status(409).json({ error: "The broken-versus-fixed gate must pass before this case can be marked verified." });
  item.status = request.body.status;
  saveCase(item);
  response.json({ case: item });
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
