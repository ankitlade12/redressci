import type { EvaluationCase, RedressCase } from "../src/types.js";
import { findUnredactedPersonalData, proposeRedaction } from "./privacy.js";

export function compileCase(item: RedressCase): EvaluationCase {
  if (!item.privacyApproved) throw new Error("Privacy review must be approved before compiling an evaluation.");
  const approvedEvidence = item.evidence.filter((evidence) => evidence.status === "approved");
  if (!approvedEvidence.length) throw new Error("At least one approved evidence source is required.");
  if (!item.review.expectedBehaviorApproved) throw new Error("Expected behavior requires explicit reviewer approval.");
  if (!item.reviewAssertions.length) throw new Error("At least one reviewer-approved assertion is required.");
  const approvedIds = new Set(approvedEvidence.map((evidence) => evidence.id));
  const invalidAssertion = item.reviewAssertions.find((assertion) => !assertion.evidenceIds.length || assertion.evidenceIds.some((id) => !approvedIds.has(id)));
  if (invalidAssertion) throw new Error(`Assertion ${invalidAssertion.id} must cite approved evidence.`);
  const privacyPayload = JSON.stringify({ evidence: approvedEvidence, assertions: item.reviewAssertions, expectedBehavior: item.expectedBehavior });
  const privacyScan = proposeRedaction(privacyPayload, item.reporterName);
  const privacyLeaks = findUnredactedPersonalData(privacyPayload, privacyScan.redactions);
  if (privacyLeaks.length) throw new Error(`Evaluation compilation blocked by possible personal data in reviewed content: ${privacyLeaks.join(", ")}.`);
  const safeInput = proposeRedaction(item.userInput, item.reporterName).redacted;
  const compiledAt = new Date().toISOString();

  return {
    id: item.id === "RC-1042" ? "cooling-center-accessibility-001" : `redress-${item.id.toLowerCase()}`,
    version: 1,
    title: item.title,
    summary: item.expectedBehavior || item.description,
    status: "reviewed",
    severity: item.severity,
    taxonomy: [item.category],
    input: { message: safeInput },
    context: { environment: item.environment, affected_audience: item.audience },
    evidence: approvedEvidence,
    assertions: item.reviewAssertions,
    grader: { passThreshold: 0.75, allowInconclusive: true, model: process.env.OPENAI_MODEL || "gpt-5.6" },
    privacy: { approved: true, containsPersonalData: false, consent: item.consent },
    provenance: { source: `Reporter submission ${item.id}`, synthetic: item.synthetic, compiledAt },
    validation: {},
  };
}
