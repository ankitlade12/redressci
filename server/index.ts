import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { aiStatus, extractInteraction, proposeIncident } from "./ai.js";
import { attachIdentity, issueToken, requireRole, type Identity } from "./auth.js";
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
import { createCase, getCase, listCases, parseTranscript, resetStore, saveCase } from "./store.js";
import type { Assertion } from "../src/types.js";
import { areReviewTextsEquivalent, caseTitleFromDescription } from "../src/case-state.js";
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

const aiRequests = new Map<string, number[]>();
function limitAiUsage(request: express.Request, response: express.Response, next: express.NextFunction) {
  if (!aiStatus().configured) return next();
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const maximum = Math.max(1, Math.min(100, Number(process.env.REDRESSCI_AI_RATE_LIMIT_PER_HOUR) || 20));
  const key = request.ip || request.socket.remoteAddress || "unknown";
  const recent = (aiRequests.get(key) || []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= maximum) {
    response.setHeader("Retry-After", "3600");
    return response.status(429).json({ error: "Live AI limit reached for this hour. The deterministic workflow remains available." });
  }
  recent.push(now);
  aiRequests.set(key, recent);
  next();
}

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
function canAccessOriginal(item: NonNullable<ReturnType<typeof getCase>>, identity?: Identity) {
  if (!identity) return false;
  if (identity.role === "admin" || identity.role === "reviewer") return true;
  if (identity.role === "reporter") return item.reporterId === identity.id;
  return identity.role === "developer" && item.intakeType === "internal-incident" && item.reporterId === identity.id;
}

function visibleCase(item: ReturnType<typeof getCase>, identity?: Identity) {
  if (!item) return item;
  if (!canAccessOriginal(item, identity)) return {
    ...item,
    reporterName: "[REDACTED]",
    originalTranscript: "",
    artifacts: [],
    title: item.privacyApproved ? item.redactedTitle : "Case awaiting privacy review",
    description: item.privacyApproved ? item.redactedDescription : "[PENDING PRIVACY REVIEW]",
    userInput: item.privacyApproved ? item.redactedUserInput : "[PENDING PRIVACY REVIEW]",
    observedResponse: item.privacyApproved ? item.redactedObservedResponse : "[PENDING PRIVACY REVIEW]",
    redactions: item.redactions.map((entry) => ({ ...entry, value: "[PRIVATE]" })),
  };
  return item;
}

app.get("/api/cases", requireRole("reporter", "reviewer", "developer", "admin", "partner"), (request, response) => {
  const available = request.identity?.role === "reporter" ? listCases().filter((item) => item.reporterId === request.identity?.id) : listCases();
  response.json({ cases: available.map((item) => visibleCase(item, request.identity)) });
});
app.get("/api/cases/:id", requireRole("reporter", "reviewer", "developer", "admin", "partner"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (request.identity?.role === "reporter" && item.reporterId !== request.identity.id) return response.status(403).json({ error: "Reporters can only access their own cases." });
  response.json({ case: visibleCase(item, request.identity) });
});

app.post("/api/cases", requireRole("reporter", "developer", "admin"), (request, response) => {
  const text = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
  const product = text(request.body.product, 200);
  const description = text(request.body.description, 5000);
  const originalTranscript = text(request.body.originalTranscript, 100_000);
  if (!product) return response.status(400).json({ error: "AI product or system is required." });
  if (!description) return response.status(400).json({ error: "A description of what went wrong is required." });
  if (typeof request.body.originalTranscript === "string" && request.body.originalTranscript.length > 100_000) return response.status(413).json({ error: "The pasted transcript is too large. Attach it as a text file instead." });
  const internal = request.identity?.role === "developer" || (request.identity?.role === "admin" && request.body.intakeType === "internal-incident");
  const consentOptions = new Set(["Private to reporter", "Shared with responsible organization", "Anonymized research use", "Anonymized public evaluation use"]);
  const suppliedTitle = text(request.body.title, 140);
  const titleWasGeneratedByOlderClient = suppliedTitle.length === 70 && description.startsWith(suppliedTitle);
  const item = createCase({
    product,
    description,
    originalTranscript,
    title: suppliedTitle && !titleWasGeneratedByOlderClient ? suppliedTitle : caseTitleFromDescription(description, internal ? "Internal AI incident" : "Reported AI failure"),
    expectedBehavior: text(request.body.expectedBehavior, 5000),
    reporterId: request.identity?.id,
    intakeType: internal ? "internal-incident" : "affected-person",
    reporterName: internal ? request.identity?.name || "Internal developer" : text(request.body.reporterName, 120),
    consent: internal ? "Private workspace incident" : consentOptions.has(request.body.consent) ? request.body.consent : "Private to reporter",
  });
  response.status(201).json({ case: visibleCase(item, request.identity) });
});

app.post("/api/reset", requireRole("admin"), (_request, response) => {
  const item = resetStore();
  resetPlatform([item]);
  response.json({ case: item });
});

app.post("/api/cases/:id/artifacts", requireRole("reporter", "developer", "admin"), upload.single("artifact"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (!canAccessOriginal(item, request.identity)) return response.status(403).json({ error: "You can only attach evidence to reports you own." });
  if (!request.file) return response.status(400).json({ error: "Artifact is required." });
  const artifact = storeEncryptedArtifact(root, { id: `${item.id}--${randomUUID()}`, name: request.file.originalname, type: request.file.mimetype, data: request.file.buffer, region: getPlatformState().workspace.policy.region });
  item.artifacts.push(artifact);
  saveCase(item);
  response.status(201).json({ artifact: { ...artifact, private: true } });
});

app.get("/api/artifacts/:id", requireRole("reporter", "reviewer", "developer", "admin"), (request, response, next) => {
  try {
    const id = String(request.params.id);
    const item = getCase(id.split("--")[0]);
    if (!item) return response.status(404).json({ error: "Artifact case not found." });
    const artifact = item.artifacts.find((entry) => entry.id === id);
    if (!artifact) return response.status(404).json({ error: "Artifact not found." });
    if (!canAccessOriginal(item, request.identity)) return response.status(403).json({ error: "This original artifact is outside your privacy boundary." });
    response.type(artifact.type).send(readEncryptedArtifact(root, id));
  }
  catch (error) { next(error); }
});

app.post("/api/cases/:id/extract", requireRole("reporter", "reviewer", "developer", "admin"), limitAiUsage, async (request, response, next) => {
  try {
    const item = getCase(String(request.params.id));
    if (!item) return response.status(404).json({ error: "Case not found" });
    if (!canAccessOriginal(item, request.identity)) return response.status(403).json({ error: "This original evidence is outside your privacy boundary." });
    let transcript = String(request.body.transcript || item.originalTranscript || "");
    let imageDataUrl: string | undefined;
    if (request.body.artifactId) {
      const artifact = item.artifacts.find((entry) => entry.id === String(request.body.artifactId));
      if (!artifact) return response.status(404).json({ error: "Private artifact not found for this case." });
      const data = readEncryptedArtifact(root, artifact.id);
      if (artifact.type === "text/plain") {
        if (!transcript.trim()) transcript = data.toString("utf8");
      } else if (artifact.type.startsWith("image/")) imageDataUrl = `data:${artifact.type};base64,${data.toString("base64")}`;
      else return response.status(400).json({ error: "PDF files are stored as supporting evidence. Paste the conversation transcript for extraction." });
    }
    if (transcript.length > 100_000) return response.status(413).json({ error: "The transcript is too large to extract. Reduce it to the relevant interaction." });
    if (!transcript.trim() && imageDataUrl && !aiStatus().configured) return response.status(503).json({ error: "Screenshot extraction needs live AI. Paste the transcript or configure OPENAI_API_KEY." });
    if (!transcript.trim() && !imageDataUrl) return response.status(400).json({ error: "A transcript or screenshot is required for extraction." });
    const live = await extractInteraction({ transcript, imageDataUrl });
    const parsed = parseTranscript(transcript);
    const extraction = live || (parsed.userInput && parsed.observedResponse ? { ...parsed, uncertainText: [], confidence: 1, mode: "deterministic transcript parser" } : null);
    if (!extraction) return response.status(422).json({ error: "Could not separate the conversation. Label the text with ‘You:’ and ‘AI:’, then try again." });
    item.userInput = extraction.userInput;
    item.observedResponse = extraction.observedResponse;
    if (!item.originalTranscript.trim()) item.originalTranscript = transcript.trim() || `You: ${extraction.userInput}\nAI: ${extraction.observedResponse}`;
    if (!item.redactedTranscript.trim()) item.redactedTranscript = item.originalTranscript;
    item.redactedUserInput = item.userInput;
    item.redactedObservedResponse = item.observedResponse;
    saveCase(item);
    response.json({ extraction, ai: Boolean(live) });
  } catch (error) { next(error); }
});

app.post("/api/cases/:id/redact", requireRole("reporter", "reviewer", "developer", "admin"), (request, response) => {
  const item = getCase(String(request.params.id));
  if (!item) return response.status(404).json({ error: "Case not found" });
  if (!canAccessOriginal(item, request.identity)) return response.status(403).json({ error: "This original evidence is outside your privacy boundary." });
  const source = request.body.transcript || item.originalTranscript;
  if (!source.trim()) return response.status(400).json({ error: "Privacy review needs a transcript. Extract or paste the conversation first." });
  const { redacted, redactions } = proposeRedaction(source, item.reporterName);
  const descriptionProposal = proposeRedaction(item.description, item.reporterName);
  const titleProposal = proposeRedaction(item.title, item.reporterName);
  const candidate = typeof request.body.redactedTranscript === "string" ? request.body.redactedTranscript : redacted;
  const candidateDescription = typeof request.body.redactedDescription === "string" ? request.body.redactedDescription : descriptionProposal.redacted;
  const leaks = [...new Set([...findUnredactedPersonalData(candidate, redactions), ...findUnredactedPersonalData(candidateDescription, descriptionProposal.redactions), ...findUnredactedPersonalData(titleProposal.redacted, titleProposal.redactions)])];
  if (request.body.approve && leaks.length) return response.status(400).json({ error: `Privacy approval blocked. Review possible ${leaks.join(", ")}.`, leaks });
  item.redactedTranscript = candidate;
  item.redactedTitle = titleProposal.redacted;
  item.redactedDescription = candidateDescription;
  const safeTurns = parseTranscript(candidate);
  item.redactedUserInput = safeTurns.userInput || "See the approved privacy-safe transcript.";
  item.redactedObservedResponse = safeTurns.observedResponse || "See the approved privacy-safe transcript.";
  item.redactions = [...redactions, ...descriptionProposal.redactions, ...titleProposal.redactions];
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
  response.json({ redacted, redactedDescription: descriptionProposal.redacted, redactions: item.redactions, approved: item.privacyApproved });
});

app.post("/api/cases/:id/structure", requireRole("reviewer", "admin"), limitAiUsage, async (request, response, next) => {
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
  if (areReviewTextsEquivalent(item.expectedBehavior, corrected)) return response.status(400).json({ error: "Expected behavior and the recorded corrected response must be distinct. Define a general evaluation rule, then provide a concrete response to test against it." });
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

app.post("/api/cases/:id/validate", requireRole("reviewer", "developer", "admin"), limitAiUsage, async (request, response, next) => {
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
    item.status = verified ? "Evaluation verified" : "Ready for verification";
    item.timeline.push({ id: randomUUID(), label: verified ? "Recorded correction verified" : "Validation needs review", detail: verified ? "The recorded broken response failed and the recorded corrected response passed this evaluation. No deployed system was called." : "The recorded-response comparison did not distinguish the two target versions.", actor: "RedressCI validation gate", createdAt: new Date().toISOString(), complete: verified });
    saveCase(item);
    response.json({ verified, broken, fixed, gate: { requiresBrokenFailure: true, requiresFixedPass: true, verificationScope: "recorded-responses", deploymentVerified: false } });
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
  if (request.body.status === "Verified fixed") return response.status(409).json({ error: "Verified fixed requires a successful run against a configured live system adapter. A recorded-response comparison can only mark the evaluation verified." });
  if (request.body.status === "Evaluation verified" && item.evaluation?.status !== "verified") return response.status(409).json({ error: "The recorded broken-versus-corrected gate must pass before this evaluation can be marked verified." });
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
