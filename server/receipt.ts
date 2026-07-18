import { createHash } from "node:crypto";
import type { RedressCase } from "../src/types.js";
import { signPlatformDocument } from "./platform.js";

export function createRedressReceipt(item: RedressCase) {
  if (!item.evaluation || item.evaluation.status !== "verified") throw new Error("A receipt requires a verified evaluation.");
  const broken = item.runs.find((run) => run.id === item.evaluation?.validation.brokenRunId) || item.runs.find((run) => run.target === "broken");
  const fixed = item.runs.find((run) => run.id === item.evaluation?.validation.correctedRunId) || item.runs.find((run) => run.target === "fixed");
  if (!broken || !fixed || broken.state !== "fail" || fixed.state !== "pass") throw new Error("Comparative run proof is incomplete.");
  const evaluationHash = createHash("sha256").update(JSON.stringify(item.evaluation)).digest("hex");
  const proofHash = createHash("sha256").update(`${evaluationHash}:${broken.id}:${fixed.id}`).digest("hex");

  return signPlatformDocument({
    type: "redressci-remediation-receipt",
    version: 2,
    caseId: item.id,
    title: item.title,
    statement: "The reported behavior was reproduced in the known-broken version and was not present in the corrected version under this evaluation.",
    scopeNotice: "This receipt verifies one reviewed behavior. It does not certify the entire system as safe.",
    privacy: { containsOriginalArtifact: false, containsPersonalData: false, consent: item.consent },
    evidence: item.evidence.filter((evidence) => evidence.status === "approved").map(({ id, title, locator }) => ({ id, title, locator })),
    evaluation: { id: item.evaluation.id, version: item.evaluation.version, sha256: evaluationHash },
    comparison: {
      broken: { version: broken.targetVersion, result: broken.state, runId: broken.id },
      corrected: { version: fixed.targetVersion, result: fixed.state, runId: fixed.id },
    },
    issuedAt: new Date().toISOString(),
    proofSha256: proofHash,
  });
}
