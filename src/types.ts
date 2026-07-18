export type CaseStatus =
  | "Draft"
  | "Awaiting privacy review"
  | "Awaiting evidence review"
  | "Test generated"
  | "Reproduced"
  | "Fix in progress"
  | "Ready for verification"
  | "Verified fixed"
  | "Regression detected"
  | "Rejected"
  | "Withdrawn";

export type ResultState = "pass" | "fail" | "inconclusive";

export interface Evidence {
  id: string;
  title: string;
  type: "Public dataset record" | "Product specification" | "Reviewer requirement" | "User-provided artifact";
  locator: string;
  excerpt: string;
  retrievalDate: string;
  status: "proposed" | "approved" | "rejected";
  authority: "authoritative" | "reporter" | "reviewer";
}

export interface Assertion {
  id: string;
  type: "forbidden_entity" | "required_concept" | "evidence_citation_required" | "semantic_rubric" | "tool_called" | "tool_not_called" | "turn_contains";
  value: string;
  label: string;
  evidenceIds: string[];
  deterministic: boolean;
}

export interface EvaluationCase {
  id: string;
  version: number;
  title: string;
  summary: string;
  status: "draft" | "reviewed" | "verified";
  severity: "low" | "medium" | "high" | "critical";
  taxonomy: string[];
  input: { message: string };
  trajectory?: {
    turns: Array<{ role: "user" | "assistant" | "tool"; content: string; toolName?: string }>;
    tools: Array<{ name: string; arguments?: Record<string, unknown>; required: boolean }>;
  };
  context: Record<string, string>;
  evidence: Evidence[];
  assertions: Assertion[];
  grader: { passThreshold: number; allowInconclusive: boolean; model: string };
  privacy: { approved: boolean; containsPersonalData: boolean; consent: string };
  provenance: { source: string; synthetic: boolean; compiledAt: string };
  validation: { brokenRunId?: string; correctedRunId?: string };
}

export interface AssertionResult {
  assertionId: string;
  label: string;
  state: ResultState;
  explanation: string;
  evidenceIds: string[];
  deterministic: boolean;
}

export interface EvaluationRun {
  id: string;
  caseId: string;
  target: "broken" | "fixed" | "custom";
  targetVersion: string;
  model: string;
  promptVersion: string;
  response: string;
  state: ResultState;
  score: number;
  latencyMs: number;
  createdAt: string;
  assertionResults: AssertionResult[];
}

export interface TimelineEvent {
  id: string;
  label: string;
  detail: string;
  actor: string;
  createdAt: string;
  complete: boolean;
}

export interface TargetPair {
  brokenResponse: string;
  correctedResponse: string;
  brokenVersion: string;
  correctedVersion: string;
  approvedBy: string;
  approvedAt: string;
}

export interface CaseReview {
  privacyApprovedBy?: string;
  privacyApprovedAt?: string;
  evidenceApprovedBy?: string;
  evidenceApprovedAt?: string;
  expectedBehaviorApproved: boolean;
  expectedBehaviorApprovedBy?: string;
  expectedBehaviorApprovedAt?: string;
}

export interface RedressCase {
  id: string;
  reporterId?: string;
  title: string;
  description: string;
  product: string;
  reporterName: string;
  userInput: string;
  observedResponse: string;
  expectedBehavior: string;
  redactedTranscript: string;
  originalTranscript: string;
  redactions: Array<{ value: string; replacement: string; type: string }>;
  privacyApproved: boolean;
  consent: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  audience: string;
  environment: string;
  status: CaseStatus;
  synthetic: boolean;
  evidence: Evidence[];
  reviewAssertions: Assertion[];
  targetPair?: TargetPair;
  review: CaseReview;
  evaluation?: EvaluationCase;
  runs: EvaluationRun[];
  timeline: TimelineEvent[];
  questions: string[];
  createdAt: string;
  updatedAt: string;
}
