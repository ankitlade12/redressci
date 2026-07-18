import { randomUUID } from "node:crypto";
import type { RedressCase } from "../src/types.js";
import { runEvaluation } from "./evaluation.js";
import { createDemoCase } from "./fixtures.js";

const cases = new Map<string, RedressCase>();

export function resetStore() {
  cases.clear();
  const demo = createDemoCase();
  if (demo.evaluation) {
    const broken = runEvaluation(demo.evaluation, "broken");
    const fixed = runEvaluation(demo.evaluation, "fixed");
    demo.evaluation.validation = { brokenRunId: broken.id, correctedRunId: fixed.id };
    demo.runs = [fixed, broken];
  }
  cases.set(demo.id, demo);
  return demo;
}

resetStore();

export function listCases() {
  return [...cases.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCase(id: string) {
  return cases.get(id);
}

export function saveCase(item: RedressCase) {
  item.updatedAt = new Date().toISOString();
  cases.set(item.id, item);
  return item;
}

export function createCase(input: Partial<RedressCase>) {
  const now = new Date().toISOString();
  const transcript = input.originalTranscript || "";
  const userMatch = transcript.match(/(?:^|\n)\s*(?:you|user|reporter)\s*:\s*([^\n]+)/i);
  const assistantMatch = transcript.match(/(?:^|\n)\s*(?:ai|assistant|bot|agent)\s*:\s*([^\n]+(?:\n(?!\s*\w+\s*:)[^\n]+)*)/i);
  const item: RedressCase = {
    id: `RC-${Math.floor(1000 + Math.random() * 9000)}`,
    title: input.title || "New AI failure report",
    description: input.description || "",
    product: input.product || "Unspecified AI system",
    reporterName: input.reporterName || "Reporter",
    userInput: input.userInput || userMatch?.[1]?.trim() || "Interaction supplied in the private artifact",
    observedResponse: input.observedResponse || assistantMatch?.[1]?.trim() || "Response supplied in the private artifact",
    expectedBehavior: input.expectedBehavior || "",
    originalTranscript: input.originalTranscript || "",
    redactedTranscript: input.originalTranscript || "",
    redactions: [],
    privacyApproved: false,
    consent: input.consent || "Private to reporter",
    category: input.category || "Other reviewer-defined failure",
    severity: input.severity || "medium",
    audience: input.audience || "Not yet reviewed",
    environment: input.environment || "Web · submitted report",
    status: "Awaiting privacy review",
    synthetic: false,
    evidence: input.evidence || [],
    reviewAssertions: input.reviewAssertions || [],
    targetPair: input.targetPair,
    review: input.review || { expectedBehaviorApproved: false },
    runs: [],
    timeline: [
      { id: randomUUID(), label: "Report received", detail: "Your report was saved privately and is waiting for privacy review.", actor: "Reporter", createdAt: now, complete: true },
    ],
    questions: [],
    createdAt: now,
    updatedAt: now,
  };
  return saveCase(item);
}
