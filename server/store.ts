import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RedressCase } from "../src/types.js";
import { caseTitleFromDescription } from "../src/case-state.js";
import { runEvaluation } from "./evaluation.js";
import { createDemoCase } from "./fixtures.js";

const cases = new Map<string, RedressCase>();
const persistenceFile = process.env.REDRESSCI_PERSIST ? path.resolve("data", "state", "cases.json") : undefined;

function persistCases() {
  if (!persistenceFile) return;
  mkdirSync(path.dirname(persistenceFile), { recursive: true });
  const temporary = `${persistenceFile}.tmp`;
  writeFileSync(temporary, JSON.stringify([...cases.values()], null, 2), { mode: 0o600 });
  renameSync(temporary, persistenceFile);
}

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
  persistCases();
  return demo;
}

if (persistenceFile && existsSync(persistenceFile)) {
  const saved = JSON.parse(readFileSync(persistenceFile, "utf8")) as RedressCase[];
  for (const item of saved) {
    const generatedTitle = item.title.length === 70 && item.description.startsWith(item.title)
      ? caseTitleFromDescription(item.description)
      : item.title;
    const generatedRedactedTitle = item.redactedTitle?.length === 70 && item.redactedDescription?.startsWith(item.redactedTitle)
      ? caseTitleFromDescription(item.redactedDescription)
      : item.redactedTitle || generatedTitle;
    cases.set(item.id, {
      ...item,
      title: generatedTitle,
      redactedTitle: generatedRedactedTitle,
      status: item.status === "Verified fixed" ? "Evaluation verified" : item.status,
      intakeType: item.intakeType || "affected-person",
      artifacts: item.artifacts || [],
      redactedDescription: item.redactedDescription || item.description,
      redactedUserInput: item.redactedUserInput || item.userInput,
      redactedObservedResponse: item.redactedObservedResponse || item.observedResponse,
      evidenceSuggestions: item.evidenceSuggestions || [],
      liveVerifications: item.liveVerifications || [],
      timeline: item.timeline.map((event) => event.label === "Fix independently verified" ? {
        ...event,
        label: "Recorded correction verified",
        detail: "The recorded broken response failed and the recorded corrected response passed this evaluation. No deployed system was called.",
        actor: "RedressCI validation gate",
      } : event),
    });
  }
} else resetStore();

export function listCases() {
  return [...cases.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCase(id: string) {
  return cases.get(id);
}

export function saveCase(item: RedressCase) {
  item.updatedAt = new Date().toISOString();
  cases.set(item.id, item);
  persistCases();
  return item;
}

export function parseTranscript(transcript: string) {
  const userMatch = transcript.match(/(?:^|\n)\s*(?:you|user|reporter|customer)\s*:\s*([^\n]+(?:\n(?!\s*\w+\s*:)[^\n]+)*)/i);
  const assistantMatch = transcript.match(/(?:^|\n)\s*(?:ai|assistant|bot|agent)\s*:\s*([^\n]+(?:\n(?!\s*\w+\s*:)[^\n]+)*)/i);
  const turns = [...transcript.matchAll(/(?:^|\n)\s*[^:\n]{1,40}:\s*([^\n]+)/g)].map((match) => match[1].trim());
  return {
    userInput: userMatch?.[1]?.trim() || turns[0] || "",
    observedResponse: assistantMatch?.[1]?.trim() || turns[1] || "",
  };
}

export function createCase(input: Partial<RedressCase>) {
  const now = new Date().toISOString();
  const transcript = input.originalTranscript || "";
  const parsed = parseTranscript(transcript);
  const item: RedressCase = {
    id: `RC-${Math.floor(1000 + Math.random() * 9000)}`,
    reporterId: input.reporterId,
    intakeType: input.intakeType || "affected-person",
    title: input.title || "New AI failure report",
    redactedTitle: input.redactedTitle || input.title || "New AI failure report",
    description: input.description || "",
    redactedDescription: input.redactedDescription || input.description || "",
    product: input.product || "Unspecified AI system",
    reporterName: input.reporterName || "Reporter",
    userInput: input.userInput || parsed.userInput || "Interaction supplied in the private artifact",
    observedResponse: input.observedResponse || parsed.observedResponse || "Response supplied in the private artifact",
    redactedUserInput: input.redactedUserInput || input.userInput || parsed.userInput || "Interaction supplied in the private artifact",
    redactedObservedResponse: input.redactedObservedResponse || input.observedResponse || parsed.observedResponse || "Response supplied in the private artifact",
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
    artifacts: input.artifacts || [],
    evidence: input.evidence || [],
    reviewAssertions: input.reviewAssertions || [],
    targetPair: input.targetPair,
    review: input.review || { expectedBehaviorApproved: false },
    runs: [],
    timeline: [
      { id: randomUUID(), label: input.intakeType === "internal-incident" ? "Internal incident received" : "Report received", detail: "The report was saved privately and is waiting for privacy review.", actor: input.intakeType === "internal-incident" ? "Developer" : "Reporter", createdAt: now, complete: true },
    ],
    questions: [],
    evidenceSuggestions: [],
    liveVerifications: [],
    createdAt: now,
    updatedAt: now,
  };
  return saveCase(item);
}
