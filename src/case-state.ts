import type { EvaluationRun, RedressCase } from "./types";

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
