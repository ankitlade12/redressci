import type { EvaluationCase, EvaluationRun, ResultState } from "./types";

export type WorkspaceRole = "reporter" | "reviewer" | "developer" | "admin" | "partner";
export type PhaseId = "pilot" | "assurance" | "community" | "network";

export interface WorkspaceMember {
  id: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  locale: string;
  conflictDisclosure?: string;
  compensationCents?: number;
}

export interface WorkspacePolicy {
  retentionDays: number;
  region: "us" | "eu" | "apac";
  ssoRequired: boolean;
  minimumPatternCount: number;
  severityPolicy: Record<"low" | "medium" | "high" | "critical", { allowInconclusive: boolean; requiredRepeatRuns: number }>;
  releaseBlocking: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  plan: "free" | "partner" | "enterprise";
  policy: WorkspacePolicy;
  members: WorkspaceMember[];
  verificationPartner?: { id: string; name: string; status: "invited" | "active" };
}

export interface ConsentDecision {
  id: string;
  caseId: string;
  actorId: string;
  scope: "private-review" | "anonymized-evaluation" | "public-case" | "community-pack";
  action: "granted" | "withdrawn";
  reason?: string;
  createdAt: string;
}

export interface EvidenceVersion {
  id: string;
  evidenceId: string;
  version: number;
  contentHash: string;
  locator: string;
  excerpt: string;
  reviewedBy: string;
  reviewedAt: string;
  supersedes?: string;
}

export interface EvidenceDependency {
  id: string;
  evidenceVersionId: string;
  dependentType: "assertion" | "evaluation" | "pack" | "receipt";
  dependentId: string;
  state: "current" | "invalidated" | "reviewed";
  invalidatedAt?: string;
  reason?: string;
}

export interface ReviewTask {
  id: string;
  caseId: string;
  reason: string;
  evidenceVersionId?: string;
  state: "open" | "completed";
  createdAt: string;
}

export interface EvaluationJob {
  id: string;
  idempotencyKey: string;
  caseId: string;
  target: "broken" | "fixed";
  state: "queued" | "running" | "completed" | "failed";
  runId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TargetAdapter {
  id: string;
  name: string;
  kind: "recorded" | "http" | "openai-compatible";
  baseUrl?: string;
  model?: string;
  secretEnv?: string;
  allowedHosts: string[];
  enabled: boolean;
}

export interface DatasetExport {
  provider: "langsmith" | "braintrust" | "langfuse" | "oecd";
  exportedAt: string;
  payload: Record<string, unknown>;
}

export interface MutationResult {
  id: string;
  name: string;
  response: string;
  expected: "fail";
  observed: ResultState;
  caught: boolean;
  runId: string;
}

export interface MutationReport {
  caseId: string;
  evaluationVersion: number;
  results: MutationResult[];
  detectionRate: number;
  passed: boolean;
  createdAt: string;
}

export interface CalibrationReport {
  caseId: string;
  deterministicDecisions: number;
  modelJudgedDecisions: number;
  disagreements: number;
  agreementRate: number;
  inconclusiveRate: number;
  generatedAt: string;
}

export interface StabilityReport {
  caseId: string;
  repeats: number;
  passCount: number;
  passRate: number;
  confidence95: [number, number];
  stable: boolean;
  generatedAt: string;
}

export interface ScopeGuardReport {
  caseId: string;
  neighborRuns: Array<{ evaluationId: string; state: ResultState; score: number }>;
  passed: boolean;
  generatedAt: string;
}

export interface AuditEvent {
  sequence: number;
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  details: Record<string, unknown>;
  createdAt: string;
  previousHash: string;
  hash: string;
}

export interface SignedProofBundle {
  type: "redressci-proof-bundle";
  version: "1.0";
  caseId: string;
  evaluation: EvaluationCase;
  runs: { broken: EvaluationRun; corrected: EvaluationRun };
  evidencePins: Array<{ evidenceId: string; version: number; hash: string }>;
  auditHead: string;
  issuedAt: string;
  issuer: string;
  algorithm: "Ed25519";
  publicKey: string;
  signature: string;
}

export interface FailureFingerprint {
  id: string;
  caseId: string;
  digest: string;
  mechanism: string;
  capability: string;
  assertionTypes: string[];
  evidenceAuthorities: string[];
  createdAt: string;
}

export interface Counterfactual {
  id: string;
  caseId: string;
  dimension: "language" | "phrasing" | "location" | "assistive-need";
  input: string;
  provenance: string;
  status: "proposed" | "approved" | "rejected";
  sensitive: boolean;
  reviewedBy?: string;
}

export interface EvaluationPack {
  id: string;
  name: string;
  domain: string;
  version: string;
  status: "draft" | "released";
  evaluationIds: string[];
  counterfactualIds: string[];
  maintainers: Array<{ memberId: string; role: "steward" | "reviewer"; conflictDisclosure: string; compensationCents: number }>;
  changelog: string[];
  dependencyLocks: Record<string, number>;
  locales: string[];
  accessibility: { wcagTarget: "2.2 AA"; lastAudit: string; issues: number };
}

export interface EscrowRecord {
  id: string;
  caseId: string;
  partnerId: string;
  sealedPayload: string;
  payloadHash: string;
  status: "sealed" | "verified";
  createdAt: string;
}

export interface Integration {
  id: string;
  kind: "github" | "gitlab" | "jira" | "linear" | "slack" | "teams" | "webhook";
  label: string;
  state: "configured" | "disabled";
  externalReference?: string;
  lastDelivery?: { state: "success" | "failed"; at: string; event: string };
}

export interface SloRecord {
  caseId: string;
  reportToPrivacyMinutes: number;
  privacyToReproductionMinutes: number;
  reproductionToFixMinutes: number;
  fixToNotificationMinutes: number;
  targetMinutes: number;
  breached: boolean;
}

export interface RecurrenceEvent {
  id: string;
  caseId: string;
  productVersion: string;
  runId: string;
  detectedAt: string;
  reopened: boolean;
}

export interface PatternReport {
  generatedAt: string;
  threshold: number;
  groups: Array<{ fingerprint: string; count: number; severity: string; publishable: boolean }>;
  suppressedGroups: number;
  privacyNotice: string;
}

export interface PlatformState {
  workspace: Workspace;
  consent: ConsentDecision[];
  evidenceVersions: EvidenceVersion[];
  dependencies: EvidenceDependency[];
  reviewQueue: ReviewTask[];
  jobs: EvaluationJob[];
  adapters: TargetAdapter[];
  mutations: MutationReport[];
  calibration: CalibrationReport[];
  stability: StabilityReport[];
  scopeGuards: ScopeGuardReport[];
  fingerprints: FailureFingerprint[];
  counterfactuals: Counterfactual[];
  packs: EvaluationPack[];
  escrows: EscrowRecord[];
  integrations: Integration[];
  recurrence: RecurrenceEvent[];
  audit: AuditEvent[];
}

export interface PlatformDashboard {
  workspace: Workspace;
  phases: Array<{ id: PhaseId; name: string; state: "operational"; capabilities: number; summary: string }>;
  metrics: {
    evidenceCoverage: number;
    mutationDetection: number;
    reviewerAgreement: number;
    repeatRunStability: number;
    openReviewTasks: number;
    activePacks: number;
    auditEvents: number;
    recurrences: number;
  };
  latest: {
    mutation?: MutationReport;
    calibration?: CalibrationReport;
    stability?: StabilityReport;
    scopeGuard?: ScopeGuardReport;
    pattern: PatternReport;
  };
  integrations: Integration[];
  packs: EvaluationPack[];
  reviewQueue: ReviewTask[];
  auditHead: string;
}
