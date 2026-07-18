import {
  createCipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RedressCase } from "../src/types.js";
import type {
  AuditEvent,
  CalibrationReport,
  ConsentDecision,
  Counterfactual,
  DatasetExport,
  EvaluationJob,
  EvaluationPack,
  EvidenceDependency,
  EvidenceVersion,
  FailureFingerprint,
  Integration,
  MutationReport,
  PatternReport,
  PlatformDashboard,
  PlatformState,
  RecurrenceEvent,
  ScopeGuardReport,
  SignedProofBundle,
  SloRecord,
  StabilityReport,
  TargetAdapter,
  Workspace,
} from "../src/platform-types.js";
import type { Identity } from "./auth.js";
import { deterministicGrade, runEvaluation } from "./evaluation.js";

const now = () => new Date().toISOString();
const digest = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

const generatedSigningKeys = process.env.REDRESSCI_SIGNING_PRIVATE_KEY ? null : generateKeyPairSync("ed25519");
const signingPrivateKey = process.env.REDRESSCI_SIGNING_PRIVATE_KEY
  ? createPrivateKey(process.env.REDRESSCI_SIGNING_PRIVATE_KEY.replace(/\\n/g, "\n"))
  : generatedSigningKeys!.privateKey;
const signingPublicKey = createPublicKey(signingPrivateKey.export({ type: "pkcs8", format: "pem" }));
const publicKey = signingPublicKey.export({ type: "spki", format: "pem" }).toString();

function workspaceSeed(): Workspace {
  return {
    id: "workspace-open-public-lab",
    name: "Open Public Lab",
    plan: "partner",
    policy: {
      retentionDays: 90,
      region: "us",
      ssoRequired: false,
      minimumPatternCount: 3,
      severityPolicy: {
        low: { allowInconclusive: true, requiredRepeatRuns: 3 },
        medium: { allowInconclusive: false, requiredRepeatRuns: 5 },
        high: { allowInconclusive: false, requiredRepeatRuns: 10 },
        critical: { allowInconclusive: false, requiredRepeatRuns: 20 },
      },
      releaseBlocking: true,
    },
    members: [
      { id: "member-reporter", displayName: "Maya C.", email: "reporter@example.invalid", role: "reporter", locale: "en" },
      { id: "member-reviewer", displayName: "Demo reviewer", email: "reviewer@example.invalid", role: "reviewer", locale: "en", conflictDisclosure: "No conflict in this synthetic demonstration.", compensationCents: 7500 },
      { id: "member-developer", displayName: "Product developer", email: "developer@example.invalid", role: "developer", locale: "en" },
      { id: "member-admin", displayName: "Demo administrator", email: "admin@example.invalid", role: "admin", locale: "en" },
      { id: "member-partner", displayName: "Independent Access Lab", email: "partner@example.invalid", role: "partner", locale: "en", conflictDisclosure: "Independent synthetic verification partner.", compensationCents: 12000 },
    ],
    verificationPartner: { id: "partner-access-lab", name: "Independent Access Lab", status: "active" },
  };
}

function platformSeed(): PlatformState {
  return {
    workspace: workspaceSeed(),
    consent: [{ id: "CONSENT-001", caseId: "RC-1042", actorId: "member-reporter", scope: "anonymized-evaluation", action: "granted", createdAt: "2026-07-18T14:17:00.000Z" }],
    evidenceVersions: [],
    dependencies: [],
    reviewQueue: [],
    jobs: [],
    adapters: [
      { id: "adapter-recorded", name: "Recorded comparison", kind: "recorded", allowedHosts: [], enabled: true },
      { id: "adapter-http", name: "Allowlisted HTTP target", kind: "http", baseUrl: "https://example.invalid/evaluate", secretEnv: "REDRESSCI_TARGET_TOKEN", allowedHosts: [], enabled: false },
      { id: "adapter-openai", name: "OpenAI-compatible target", kind: "openai-compatible", model: "configured-by-workspace", secretEnv: "REDRESSCI_TARGET_API_KEY", allowedHosts: [], enabled: false },
    ],
    mutations: [], calibration: [], stability: [], scopeGuards: [], fingerprints: [], counterfactuals: [], packs: [], escrows: [],
    integrations: [
      { id: "integration-github", kind: "github", label: "GitHub status checks", state: "configured", externalReference: "ankitlade12/redressci" },
      { id: "integration-webhook", kind: "webhook", label: "Release protection webhook", state: "configured" },
      { id: "integration-slack", kind: "slack", label: "Reviewer notifications", state: "disabled" },
    ],
    recurrence: [],
    audit: [],
  };
}

let state = platformSeed();
let persistenceFile: string | undefined;

export function configurePlatformPersistence(root: string) {
  if (!process.env.REDRESSCI_PERSIST) return;
  const dir = path.join(root, "data", "state");
  mkdirSync(dir, { recursive: true });
  persistenceFile = path.join(dir, "platform.json");
  if (existsSync(persistenceFile)) {
    state = JSON.parse(readFileSync(persistenceFile, "utf8")) as PlatformState;
  } else persist();
}

function persist() {
  if (!persistenceFile) return;
  const temporary = `${persistenceFile}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(temporary, persistenceFile);
}

function appendAudit(identity: Identity, action: string, subjectType: string, subjectId: string, details: Record<string, unknown> = {}) {
  const previousHash = state.audit.at(-1)?.hash || "0".repeat(64);
  const unsigned = {
    sequence: state.audit.length + 1,
    id: `AUD-${randomUUID().slice(0, 8).toUpperCase()}`,
    workspaceId: identity.workspaceId,
    actorId: identity.id,
    action,
    subjectType,
    subjectId,
    details,
    createdAt: now(),
    previousHash,
  };
  const event: AuditEvent = { ...unsigned, hash: digest(unsigned) };
  state.audit.push(event);
  persist();
  return event;
}

export function verifyAuditChain(events = state.audit) {
  let previous = "0".repeat(64);
  for (const event of events) {
    const { hash, ...unsigned } = event;
    if (event.previousHash !== previous || digest(unsigned) !== hash) return false;
    previous = hash;
  }
  return true;
}

export function signPlatformDocument<T extends Record<string, unknown>>(document: T) {
  return {
    ...document,
    signature: {
      algorithm: "Ed25519" as const,
      publicKey,
      value: sign(null, Buffer.from(JSON.stringify(document)), signingPrivateKey).toString("base64url"),
    },
  };
}

export function verifyPlatformDocument(document: Record<string, unknown> & { signature?: { algorithm?: string; publicKey?: string; value?: string } }) {
  if (!document.signature?.publicKey || !document.signature.value) return false;
  const { signature, ...unsigned } = document;
  const key = signature.publicKey as string;
  const value = signature.value as string;
  try { return verify(null, Buffer.from(JSON.stringify(unsigned)), key, Buffer.from(value, "base64url")); }
  catch { return false; }
}

export function resetPlatform(cases: RedressCase[] = []) {
  state = platformSeed();
  for (const item of cases) synchronizeEvidence(item);
  appendAudit({ id: "system", name: "RedressCI", role: "admin", workspaceId: state.workspace.id }, "workspace.reset", "workspace", state.workspace.id, { synthetic: true });
  persist();
  return state;
}

export function getPlatformState() { return state; }

export function synchronizeEvidence(item: RedressCase) {
  for (const evidence of item.evidence.filter((entry) => entry.status === "approved")) {
    if (state.evidenceVersions.some((entry) => entry.evidenceId === evidence.id)) continue;
    const version: EvidenceVersion = {
      id: `${evidence.id}-V1`, evidenceId: evidence.id, version: 1, contentHash: digest({ locator: evidence.locator, excerpt: evidence.excerpt }),
      locator: evidence.locator, excerpt: evidence.excerpt, reviewedBy: item.review.evidenceApprovedBy || "Demo reviewer", reviewedAt: item.review.evidenceApprovedAt || now(),
    };
    state.evidenceVersions.push(version);
    for (const assertion of item.reviewAssertions.filter((entry) => entry.evidenceIds.includes(evidence.id))) {
      state.dependencies.push({ id: `DEP-${evidence.id}-${assertion.id}`, evidenceVersionId: version.id, dependentType: "assertion", dependentId: assertion.id, state: "current" });
    }
    if (item.evaluation) state.dependencies.push({ id: `DEP-${evidence.id}-${item.evaluation.id}`, evidenceVersionId: version.id, dependentType: "evaluation", dependentId: item.evaluation.id, state: "current" });
  }
  if (item.evaluation && !state.fingerprints.some((entry) => entry.caseId === item.id)) state.fingerprints.push(createFingerprint(item));
  if (item.evaluation && !state.packs.length) state.packs.push(createSeedPack(item));
  persist();
}

export function recordConsent(identity: Identity, decision: Omit<ConsentDecision, "id" | "actorId" | "createdAt">) {
  const entry: ConsentDecision = { ...decision, id: `CONSENT-${randomUUID().slice(0, 8).toUpperCase()}`, actorId: identity.id, createdAt: now() };
  state.consent.push(entry);
  appendAudit(identity, `consent.${entry.action}`, "case", entry.caseId, { scope: entry.scope, reason: entry.reason });
  return entry;
}

export function updateEvidenceVersion(identity: Identity, item: RedressCase, evidenceId: string, update: { locator: string; excerpt: string }) {
  const versions = state.evidenceVersions.filter((entry) => entry.evidenceId === evidenceId).sort((a, b) => b.version - a.version);
  const previous = versions[0];
  if (!previous) throw new Error("Synchronize approved evidence before creating a new version.");
  const version: EvidenceVersion = {
    id: `${evidenceId}-V${previous.version + 1}`, evidenceId, version: previous.version + 1, contentHash: digest(update), locator: update.locator, excerpt: update.excerpt,
    reviewedBy: identity.id, reviewedAt: now(), supersedes: previous.id,
  };
  state.evidenceVersions.push(version);
  const affected = state.dependencies.filter((entry) => entry.evidenceVersionId === previous.id && entry.state === "current");
  for (const dependency of affected) {
    dependency.state = "invalidated";
    dependency.invalidatedAt = now();
    dependency.reason = `Evidence ${evidenceId} changed from version ${previous.version} to ${version.version}.`;
  }
  state.reviewQueue.push({ id: `REVIEW-${randomUUID().slice(0, 8).toUpperCase()}`, caseId: item.id, reason: `${affected.length} assurance dependencies require re-review after an evidence change.`, evidenceVersionId: version.id, state: "open", createdAt: now() });
  appendAudit(identity, "evidence.versioned", "evidence", evidenceId, { previous: previous.id, current: version.id, invalidated: affected.length });
  return { version, invalidated: affected };
}

export function completeReviewTask(identity: Identity, taskId: string) {
  const task = state.reviewQueue.find((entry) => entry.id === taskId);
  if (!task) throw new Error("Review task not found.");
  task.state = "completed";
  appendAudit(identity, "review.completed", "review-task", task.id, { caseId: task.caseId });
  return task;
}

export function enqueueEvaluation(identity: Identity, item: RedressCase, input: { target: "broken" | "fixed"; idempotencyKey: string }) {
  const existing = state.jobs.find((entry) => entry.idempotencyKey === input.idempotencyKey);
  if (existing) return { job: existing, duplicate: true };
  if (!item.evaluation) throw new Error("Compile the evaluation before queueing a run.");
  const job: EvaluationJob = { id: `JOB-${randomUUID().slice(0, 8).toUpperCase()}`, idempotencyKey: input.idempotencyKey, caseId: item.id, target: input.target, state: "queued", createdAt: now() };
  state.jobs.push(job);
  appendAudit(identity, "evaluation.queued", "job", job.id, { caseId: item.id, target: input.target });
  queueMicrotask(() => {
    try {
      job.state = "running";
      const run = runEvaluation(item.evaluation!, input.target, input.target === "broken" ? item.targetPair?.brokenResponse : item.targetPair?.correctedResponse);
      item.runs.unshift(run);
      job.runId = run.id; job.state = "completed"; job.completedAt = now();
      persist();
    } catch (error) {
      job.state = "failed"; job.error = error instanceof Error ? error.message : "Evaluation failed"; job.completedAt = now(); persist();
    }
  });
  return { job, duplicate: false };
}

export function listJobs() { return [...state.jobs].reverse(); }

function allowedTargetHosts() {
  return new Set((process.env.REDRESSCI_TARGET_ALLOWLIST || "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean));
}

export function configureAdapter(identity: Identity, adapterId: string, input: Partial<TargetAdapter>) {
  const adapter = state.adapters.find((entry) => entry.id === adapterId);
  if (!adapter) throw new Error("Adapter not found.");
  if (input.baseUrl) {
    const url = new URL(input.baseUrl);
    if (url.protocol !== "https:") throw new Error("Live adapters require HTTPS.");
    const allowlist = allowedTargetHosts();
    if (!allowlist.has(url.hostname.toLowerCase())) throw new Error("Target host is not in REDRESSCI_TARGET_ALLOWLIST.");
    adapter.baseUrl = url.toString(); adapter.allowedHosts = [url.hostname.toLowerCase()];
  }
  if (typeof input.enabled === "boolean") adapter.enabled = input.enabled;
  if (input.model) adapter.model = input.model;
  if (input.secretEnv) adapter.secretEnv = input.secretEnv;
  appendAudit(identity, "adapter.configured", "adapter", adapter.id, { kind: adapter.kind, enabled: adapter.enabled, hosts: adapter.allowedHosts });
  return adapter;
}

export async function executeAdapter(adapterId: string, input: { message: string }) {
  const adapter = state.adapters.find((entry) => entry.id === adapterId);
  if (!adapter?.enabled || !adapter.baseUrl) throw new Error("Adapter is not enabled and configured.");
  const url = new URL(adapter.baseUrl);
  if (!adapter.allowedHosts.includes(url.hostname.toLowerCase()) || !allowedTargetHosts().has(url.hostname.toLowerCase())) throw new Error("Adapter host failed the runtime allowlist check.");
  const secret = adapter.secretEnv ? process.env[adapter.secretEnv] : undefined;
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify(input), signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error(`Target returned HTTP ${response.status}.`);
  const body = await response.json() as Record<string, unknown>;
  const output = body.output ?? body.response ?? body.text;
  if (typeof output !== "string") throw new Error("Target response must contain output, response, or text.");
  return output;
}

export function exportDataset(item: RedressCase, provider: DatasetExport["provider"]): DatasetExport {
  if (!item.evaluation) throw new Error("No evaluation is available for export.");
  const base = { id: item.evaluation.id, input: item.evaluation.input, expected: item.expectedBehavior, metadata: { caseId: item.id, severity: item.severity, evidenceIds: item.evaluation.evidence.map((entry) => entry.id) } };
  const payload: Record<string, unknown> = provider === "langsmith" ? { examples: [{ inputs: base.input, outputs: { expected: base.expected }, metadata: base.metadata }] }
    : provider === "braintrust" ? { records: [{ input: base.input, expected: base.expected, metadata: base.metadata }] }
      : provider === "langfuse" ? { datasetItems: [{ input: base.input, expectedOutput: base.expected, metadata: base.metadata }] }
        : oecdExport(item);
  return { provider, exportedAt: now(), payload };
}

export function runMutationLab(identity: Identity, item: RedressCase): MutationReport {
  if (!item.evaluation) throw new Error("No evaluation is available.");
  const required = item.evaluation.assertions.find((entry) => entry.type === "required_concept")?.value || "required concept";
  const forbidden = item.evaluation.assertions.find((entry) => entry.type === "forbidden_entity")?.value || "prohibited option";
  const mutations = [
    { name: "Reintroduce prohibited recommendation", response: `${forbidden} is the best recommendation.` },
    { name: "Remove required evidence-backed option", response: "No suitable option is available." },
    { name: "Strip grounding and accessibility context", response: `${required} may work, but no supporting source or access information is available.` },
  ];
  const results = mutations.map((mutation) => {
    const run = runEvaluation(item.evaluation!, "broken", mutation.response);
    return { id: `MUT-${randomUUID().slice(0, 8).toUpperCase()}`, ...mutation, expected: "fail" as const, observed: run.state, caught: run.state === "fail", runId: run.id };
  });
  const detectionRate = results.filter((entry) => entry.caught).length / results.length;
  const report: MutationReport = { caseId: item.id, evaluationVersion: item.evaluation.version, results, detectionRate, passed: detectionRate >= (item.severity === "critical" ? .9 : .66), createdAt: now() };
  state.mutations.push(report);
  appendAudit(identity, "assurance.mutations-run", "case", item.id, { detectionRate, mutations: results.length });
  return report;
}

export function generateCalibration(identity: Identity, item: RedressCase): CalibrationReport {
  const decisions = item.runs.flatMap((run) => run.assertionResults);
  const deterministic = decisions.filter((entry) => entry.deterministic);
  const model = decisions.filter((entry) => !entry.deterministic);
  const conclusiveDeterministic = deterministic.filter((entry) => entry.state !== "inconclusive");
  const majority = conclusiveDeterministic.filter((entry) => entry.state === "pass").length >= Math.max(1, conclusiveDeterministic.length / 2) ? "pass" : "fail";
  const disagreements = model.filter((entry) => entry.state !== "inconclusive" && entry.state !== majority).length;
  const comparable = model.filter((entry) => entry.state !== "inconclusive").length;
  const report: CalibrationReport = {
    caseId: item.id, deterministicDecisions: deterministic.length, modelJudgedDecisions: model.length, disagreements,
    agreementRate: comparable ? (comparable - disagreements) / comparable : 1,
    inconclusiveRate: decisions.length ? decisions.filter((entry) => entry.state === "inconclusive").length / decisions.length : 0,
    generatedAt: now(),
  };
  state.calibration.push(report);
  appendAudit(identity, "assurance.calibrated", "case", item.id, { agreementRate: report.agreementRate });
  return report;
}

function wilson(successes: number, total: number): [number, number] {
  if (!total) return [0, 0];
  const z = 1.96, p = successes / total, denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function runStability(identity: Identity, item: RedressCase, requestedRepeats?: number): StabilityReport {
  if (!item.evaluation || !item.targetPair) throw new Error("A compiled evaluation and target pair are required.");
  const policy = state.workspace.policy.severityPolicy[item.severity];
  const repeats = Math.max(policy.requiredRepeatRuns, Math.min(requestedRepeats || policy.requiredRepeatRuns, 50));
  const runs = Array.from({ length: repeats }, () => runEvaluation(item.evaluation!, "fixed", item.targetPair!.correctedResponse));
  const passCount = runs.filter((entry) => entry.state === "pass").length;
  const report: StabilityReport = { caseId: item.id, repeats, passCount, passRate: passCount / repeats, confidence95: wilson(passCount, repeats), stable: passCount === repeats, generatedAt: now() };
  state.stability.push(report);
  appendAudit(identity, "assurance.stability-run", "case", item.id, { repeats, passRate: report.passRate });
  return report;
}

export function runScopeGuard(identity: Identity, item: RedressCase): ScopeGuardReport {
  if (!item.evaluation || !item.targetPair) throw new Error("A compiled evaluation and target pair are required.");
  const baseline = runEvaluation(item.evaluation, "fixed", item.targetPair.correctedResponse);
  const privacyAssertion = { id: "scope-privacy", type: "forbidden_entity" as const, value: item.reporterName, label: "Do not reintroduce the reporter identity", evidenceIds: item.evaluation.evidence.map((entry) => entry.id), deterministic: true };
  const privacyEvaluation = { ...item.evaluation, id: `${item.evaluation.id}-privacy-neighbor`, assertions: [privacyAssertion], grader: { ...item.evaluation.grader, passThreshold: 1 } };
  const privacy = runEvaluation(privacyEvaluation, "fixed", item.targetPair.correctedResponse);
  const report: ScopeGuardReport = { caseId: item.id, neighborRuns: [{ evaluationId: item.evaluation.id, state: baseline.state, score: baseline.score }, { evaluationId: privacyEvaluation.id, state: privacy.state, score: privacy.score }], passed: baseline.state === "pass" && privacy.state === "pass", generatedAt: now() };
  state.scopeGuards.push(report);
  appendAudit(identity, "assurance.scope-guard", "case", item.id, { passed: report.passed, neighbors: report.neighborRuns.length });
  return report;
}

export function runAssuranceSuite(identity: Identity, item: RedressCase) {
  synchronizeEvidence(item);
  const mutation = runMutationLab(identity, item);
  const calibration = generateCalibration(identity, item);
  const stability = runStability(identity, item);
  const scopeGuard = runScopeGuard(identity, item);
  return { mutation, calibration, stability, scopeGuard, policy: state.workspace.policy.severityPolicy[item.severity] };
}

export function createProofBundle(identity: Identity, item: RedressCase): SignedProofBundle {
  if (!item.evaluation || item.evaluation.status !== "verified") throw new Error("A verified evaluation is required.");
  const broken = item.runs.find((entry) => entry.id === item.evaluation?.validation.brokenRunId) || item.runs.find((entry) => entry.target === "broken" && entry.state === "fail");
  const corrected = item.runs.find((entry) => entry.id === item.evaluation?.validation.correctedRunId) || item.runs.find((entry) => entry.target === "fixed" && entry.state === "pass");
  if (!broken || !corrected) throw new Error("Comparative proof is incomplete.");
  synchronizeEvidence(item);
  const unsigned = {
    type: "redressci-proof-bundle" as const, version: "1.0" as const, caseId: item.id, evaluation: item.evaluation, runs: { broken, corrected },
    evidencePins: item.evaluation.evidence.map((evidence) => {
      const pin = state.evidenceVersions.filter((entry) => entry.evidenceId === evidence.id).sort((a, b) => b.version - a.version)[0];
      return { evidenceId: evidence.id, version: pin?.version || 1, hash: pin?.contentHash || digest(evidence) };
    }),
    auditHead: state.audit.at(-1)?.hash || "0".repeat(64), issuedAt: now(), issuer: state.workspace.id, algorithm: "Ed25519" as const, publicKey,
  };
  const signature = sign(null, Buffer.from(JSON.stringify(unsigned)), signingPrivateKey).toString("base64url");
  const bundle: SignedProofBundle = { ...unsigned, signature };
  appendAudit(identity, "proof.issued", "case", item.id, { signature: digest(signature), evaluation: item.evaluation.id });
  return bundle;
}

export function verifyProofBundle(bundle: SignedProofBundle) {
  const { signature, ...unsigned } = bundle;
  try { return verify(null, Buffer.from(JSON.stringify(unsigned)), bundle.publicKey, Buffer.from(signature, "base64url")); }
  catch { return false; }
}

function createFingerprint(item: RedressCase): FailureFingerprint {
  const assertionTypes = [...new Set(item.reviewAssertions.map((entry) => entry.type))].sort();
  const evidenceAuthorities = [...new Set(item.evidence.map((entry) => entry.authority))].sort();
  const mechanism = item.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const capability = item.product.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id: `FP-${randomUUID().slice(0, 8).toUpperCase()}`, caseId: item.id, digest: digest({ mechanism, capability, assertionTypes, evidenceAuthorities }), mechanism, capability, assertionTypes, evidenceAuthorities, createdAt: now() };
}

export function fingerprintCase(identity: Identity, item: RedressCase) {
  const existing = state.fingerprints.find((entry) => entry.caseId === item.id);
  if (existing) return existing;
  const fingerprint = createFingerprint(item); state.fingerprints.push(fingerprint);
  appendAudit(identity, "fingerprint.created", "case", item.id, { digest: fingerprint.digest });
  return fingerprint;
}

export function proposeCounterfactuals(identity: Identity, item: RedressCase): Counterfactual[] {
  const templates: Array<Pick<Counterfactual, "dimension" | "input" | "sensitive">> = [
    { dimension: "phrasing", input: "Please identify a nearby option that has step-free wheelchair access.", sensitive: false },
    { dimension: "language", input: "¿Qué centro cercano tiene acceso para silla de ruedas?", sensitive: false },
    { dimension: "location", input: item.userInput.replace(/nearby/i, "in the east district"), sensitive: false },
    { dimension: "assistive-need", input: item.userInput.replace(/wheelchair/i, "walker"), sensitive: true },
  ];
  const created = templates.map((entry) => ({ id: `CF-${randomUUID().slice(0, 8).toUpperCase()}`, caseId: item.id, ...entry, provenance: `Reviewer-controlled variation of ${item.id}`, status: "proposed" as const }));
  state.counterfactuals.push(...created);
  appendAudit(identity, "counterfactuals.proposed", "case", item.id, { count: created.length, sensitive: created.filter((entry) => entry.sensitive).length });
  return created;
}

export function reviewCounterfactual(identity: Identity, id: string, status: "approved" | "rejected") {
  const item = state.counterfactuals.find((entry) => entry.id === id);
  if (!item) throw new Error("Counterfactual not found.");
  item.status = status; item.reviewedBy = identity.id;
  appendAudit(identity, `counterfactual.${status}`, "counterfactual", id, { sensitive: item.sensitive });
  return item;
}

function createSeedPack(item: RedressCase): EvaluationPack {
  return {
    id: "pack-public-accessibility", name: "Public Information Accessibility", domain: "public-service-accessibility", version: "1.0.0", status: "released",
    evaluationIds: item.evaluation ? [item.evaluation.id] : [], counterfactualIds: [],
    maintainers: [{ memberId: "member-reviewer", role: "steward", conflictDisclosure: "No conflict in this synthetic demonstration.", compensationCents: 7500 }],
    changelog: ["1.0.0 — Added wheelchair-accessible cooling-center remediation case."],
    dependencyLocks: Object.fromEntries(item.evidence.map((entry) => [entry.id, 1])), locales: ["en", "es"],
    accessibility: { wcagTarget: "2.2 AA", lastAudit: "2026-07-18", issues: 0 },
  };
}

export function releasePack(identity: Identity, packId: string, input: { version: string; changelog: string }) {
  const pack = state.packs.find((entry) => entry.id === packId);
  if (!pack) throw new Error("Pack not found.");
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) throw new Error("Pack versions must use semantic versioning.");
  const approved = state.counterfactuals.filter((entry) => entry.status === "approved");
  pack.version = input.version; pack.status = "released"; pack.changelog.unshift(`${input.version} — ${input.changelog}`); pack.counterfactualIds = approved.map((entry) => entry.id);
  appendAudit(identity, "pack.released", "pack", pack.id, { version: pack.version, counterfactuals: pack.counterfactualIds.length });
  return pack;
}

function escrowKey() { return createHash("sha256").update(process.env.REDRESSCI_ESCROW_KEY || "redressci-demo-escrow-key-change-in-production").digest(); }

export function sealEscrow(identity: Identity, item: RedressCase) {
  if (!item.evaluation) throw new Error("An evaluation is required before escrow.");
  const payload = Buffer.from(JSON.stringify({ assertions: item.evaluation.assertions, evidencePins: item.evaluation.evidence.map((entry) => entry.id) }));
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", escrowKey(), iv); const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]); const tag = cipher.getAuthTag();
  const record = { id: `ESC-${randomUUID().slice(0, 8).toUpperCase()}`, caseId: item.id, partnerId: state.workspace.verificationPartner?.id || "unassigned", sealedPayload: Buffer.concat([iv, tag, encrypted]).toString("base64"), payloadHash: digest(payload), status: "sealed" as const, createdAt: now() };
  state.escrows.push(record); appendAudit(identity, "escrow.sealed", "case", item.id, { escrowId: record.id, partner: record.partnerId });
  return { ...record, sealedPayload: "[sealed]" };
}

export function oecdExport(item: RedressCase): Record<string, unknown> {
  return {
    schema: "redressci-oecd-incident-compatible/1.0", recordId: item.id, reportDate: item.createdAt, submitterRole: "affected-user",
    aiSystem: { name: item.product, version: item.targetPair?.brokenVersion, deploymentContext: item.environment },
    incident: { title: item.title, description: item.description, harmType: item.category, severity: item.severity, affectedStakeholders: item.audience },
    supportingMaterials: item.evidence.filter((entry) => entry.status === "approved").map((entry) => ({ id: entry.id, title: entry.title, locator: entry.locator, hash: digest(entry.excerpt) })),
    remediation: { status: item.status, correctedVersion: item.targetPair?.correctedVersion, evaluationId: item.evaluation?.id },
    privacy: { anonymized: true, originalIncluded: false }, legalConclusion: null,
  };
}

export function publicCase(item: RedressCase) {
  const consent = [...state.consent].reverse().find((entry) => entry.caseId === item.id && entry.scope === "public-case");
  if (!item.synthetic && consent?.action !== "granted") throw new Error("Public-case consent is required.");
  return { id: item.id, title: item.title, summary: item.description, category: item.category, severity: item.severity, status: item.status, evaluationId: item.evaluation?.id, evidenceCount: item.evidence.filter((entry) => entry.status === "approved").length, fingerprint: state.fingerprints.find((entry) => entry.caseId === item.id)?.digest, privacy: "Anonymized; original evidence excluded" };
}

export function calculateSlo(item: RedressCase): SloRecord {
  const at = (...labels: string[]) => new Date(item.timeline.find((entry) => labels.includes(entry.label))?.createdAt || item.createdAt).getTime();
  const minutes = (start: number, end: number) => Math.max(0, Math.round((end - start) / 60_000));
  const report = at("Report received"), privacy = at("Privacy approved"), reproduced = at("Problem reproduced"), fixed = at("Recorded correction verified", "Fix independently verified");
  const targetMinutes = item.severity === "critical" ? 240 : item.severity === "high" ? 1440 : 4320;
  const total = minutes(report, fixed);
  return { caseId: item.id, reportToPrivacyMinutes: minutes(report, privacy), privacyToReproductionMinutes: minutes(privacy, reproduced), reproductionToFixMinutes: minutes(reproduced, fixed), fixToNotificationMinutes: 0, targetMinutes, breached: total > targetMinutes };
}

export function recordRecurrence(identity: Identity, item: RedressCase, productVersion: string, runId: string): RecurrenceEvent {
  const run = item.runs.find((entry) => entry.id === runId);
  if (!run || run.state !== "fail") throw new Error("A failing executed run is required to record recurrence.");
  const event: RecurrenceEvent = { id: `REC-${randomUUID().slice(0, 8).toUpperCase()}`, caseId: item.id, productVersion, runId, detectedAt: now(), reopened: true };
  state.recurrence.push(event); item.status = "Regression detected";
  appendAudit(identity, "recurrence.detected", "case", item.id, { productVersion, runId, releaseBlocked: state.workspace.policy.releaseBlocking });
  return event;
}

export function patternReport(): PatternReport {
  const groups = new Map<string, FailureFingerprint[]>();
  for (const fingerprint of state.fingerprints) groups.set(fingerprint.digest, [...(groups.get(fingerprint.digest) || []), fingerprint]);
  const threshold = state.workspace.policy.minimumPatternCount;
  const summaries = [...groups.entries()].map(([fingerprint, entries]) => ({ fingerprint, count: entries.length, severity: "mixed", publishable: entries.length >= threshold }));
  return { generatedAt: now(), threshold, groups: summaries.filter((entry) => entry.publishable), suppressedGroups: summaries.filter((entry) => !entry.publishable).length, privacyNotice: `Groups smaller than ${threshold} are suppressed to reduce re-identification risk.` };
}

export function updateWorkspacePolicy(identity: Identity, input: Partial<Workspace["policy"]>) {
  if (input.retentionDays !== undefined && (input.retentionDays < 1 || input.retentionDays > 3650)) throw new Error("Retention must be between 1 and 3650 days.");
  state.workspace.policy = { ...state.workspace.policy, ...input, severityPolicy: input.severityPolicy ? { ...state.workspace.policy.severityPolicy, ...input.severityPolicy } : state.workspace.policy.severityPolicy };
  appendAudit(identity, "workspace.policy-updated", "workspace", state.workspace.id, { retentionDays: state.workspace.policy.retentionDays, region: state.workspace.policy.region, ssoRequired: state.workspace.policy.ssoRequired });
  return state.workspace.policy;
}

export function deliverIntegration(identity: Identity, integrationId: string, event: string) {
  const integration = state.integrations.find((entry) => entry.id === integrationId);
  if (!integration || integration.state !== "configured") throw new Error("Integration is not configured.");
  integration.lastDelivery = { state: "success", at: now(), event };
  appendAudit(identity, "integration.delivered", "integration", integration.id, { event });
  return integration;
}

export function regulatoryMappings(item: RedressCase) {
  return {
    notice: "Operational crosswalk only; this is not a legal conclusion or compliance certification.",
    mappings: [
      { framework: "NIST AI RMF", controls: ["MAP 5.1 affected communities", "MANAGE 4.1 post-deployment feedback"], evidence: [item.id, item.evaluation?.id].filter(Boolean) },
      { framework: "OECD incident reporting", controls: ["submitter role", "affected stakeholder", "system version", "supporting materials"], evidence: [item.id] },
      { framework: "EU AI Act incident operations", controls: ["incident investigation record", "corrective action trace"], evidence: item.evaluation ? [item.evaluation.id] : [] },
    ],
  };
}

export function dashboard(cases: RedressCase[]): PlatformDashboard {
  for (const item of cases) synchronizeEvidence(item);
  const currentDependencies = state.dependencies.filter((entry) => entry.state === "current").length;
  const latest = <T>(items: T[]) => items.at(-1);
  const latestMutation = latest(state.mutations), latestCalibration = latest(state.calibration), latestStability = latest(state.stability);
  return {
    workspace: state.workspace,
    phases: [
      { id: "pilot", name: "Design-partner foundation", state: "operational", capabilities: 10, summary: "Roles, consent, evidence graph, jobs, adapters, exports, and signed closure." },
      { id: "assurance", name: "Assurance engine", state: "operational", capabilities: 8, summary: "Mutation sensitivity, calibration, stability, scope protection, and proof bundles." },
      { id: "community", name: "Community evaluation packs", state: "operational", capabilities: 9, summary: "Private fingerprints, governed variations, versioned packs, escrow, and accessibility metadata." },
      { id: "network", name: "Remediation network", state: "operational", capabilities: 8, summary: "Workspace policy, integrations, SLOs, recurrence, privacy thresholds, and standards crosswalks." },
    ],
    metrics: {
      evidenceCoverage: state.dependencies.length ? currentDependencies / state.dependencies.length : 1,
      mutationDetection: latestMutation?.detectionRate ?? 0,
      reviewerAgreement: latestCalibration?.agreementRate ?? 1,
      repeatRunStability: latestStability?.passRate ?? 0,
      openReviewTasks: state.reviewQueue.filter((entry) => entry.state === "open").length,
      activePacks: state.packs.filter((entry) => entry.status === "released").length,
      auditEvents: state.audit.length,
      recurrences: state.recurrence.length,
    },
    latest: { mutation: latestMutation, calibration: latestCalibration, stability: latestStability, scopeGuard: latest(state.scopeGuards), pattern: patternReport() },
    integrations: state.integrations, packs: state.packs, reviewQueue: state.reviewQueue, auditHead: state.audit.at(-1)?.hash || "0".repeat(64),
  };
}

export function phaseReadiness(cases: RedressCase[]) {
  const verified = cases.filter((entry) => entry.evaluation?.status === "verified");
  return {
    localProduct: "complete",
    operationalCapabilities: 35,
    verifiedCases: verified.length,
    externalMilestones: {
      designPartnerCases: { target: 30, current: cases.length, requiresExternalPartners: true },
      maintainedCommunityPacks: { target: 3, current: state.packs.length, requiresNamedExternalStewards: true },
      hostedDeployment: { complete: false, requiresCloudAccount: true },
      ssoProviderConnection: { complete: false, requiresIdentityProvider: true },
      independentVerificationNetwork: { target: 1, current: state.workspace.verificationPartner ? 1 : 0, synthetic: true },
    },
  };
}

export function testDeterministicPolicy(item: RedressCase) {
  if (!item.evaluation || !item.targetPair) return [];
  return deterministicGrade(item.evaluation, item.targetPair.correctedResponse);
}
