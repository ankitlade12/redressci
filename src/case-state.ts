import type { EvaluationRun, RedressCase } from "./types";

export function isEvaluationVerified(item: RedressCase) {
  return item.status === "Evaluation verified" || item.status === "Verified fixed";
}

export function isPrivateConsent(consent: string) {
  return consent.toLowerCase().includes("private");
}

export function areReviewTextsEquivalent(first: string, second: string) {
  const normalize = (value: string) => value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Boolean(normalize(first)) && normalize(first) === normalize(second);
}

export interface CaseOverviewValidation {
  broken: EvaluationRun;
  fixed: EvaluationRun;
  verified: boolean;
}

export function getCaseOverviewState(item: RedressCase) {
  const approvedEvidenceCount = item.evidence.filter((evidence) => evidence.status === "approved").length;
  const brokenRunId = item.evaluation?.validation.brokenRunId;
  const fixedRunId = item.evaluation?.validation.correctedRunId;
  const broken = brokenRunId ? item.runs.find((run) => run.id === brokenRunId && run.target === "broken") : undefined;
  const fixed = fixedRunId ? item.runs.find((run) => run.id === fixedRunId && run.target === "fixed") : undefined;
  const validation: CaseOverviewValidation | null = broken && fixed ? {
    broken,
    fixed,
    verified: item.evaluation?.status === "verified" && broken.state === "fail" && fixed.state === "pass",
  } : null;

  return {
    privacyApproved: item.privacyApproved,
    approvedEvidenceCount,
    expectedBehaviorApproved: item.review.expectedBehaviorApproved && approvedEvidenceCount > 0,
    validation,
  };
}
