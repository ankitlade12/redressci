import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { app } from "./index.js";

async function json(response: Response) {
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload;
}

test("a fresh report completes privacy, evidence, compilation, and comparative verification", async (context) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  context.after(() => server.close());
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const post = (path: string, body: unknown, method = "POST") => fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const created = await json(await post("/api/cases", {
    title: "Assistant returned an inaccessible venue",
    reporterName: "Jordan Lee",
    product: "Synthetic guide",
    description: "The response ignored an access requirement.",
    originalTranscript: "You: Find an accessible venue\nAI: Use Central Hall. Email jordan@example.com for details.",
    expectedBehavior: "Recommend the accessible venue supported by the reviewed record.",
  })) as { case: { id: string; userInput: string; observedResponse: string } };
  const id = created.case.id;
  assert.equal(created.case.userInput, "Find an accessible venue");
  assert.match(created.case.observedResponse, /Central Hall/);

  const proposal = await json(await post(`/api/cases/${id}/redact`, { approve: false, transcript: "You: Find an accessible venue\nAI: Use Central Hall. Email jordan@example.com for details." })) as { redacted: string };
  assert.match(proposal.redacted, /\[EMAIL\]/);
  assert.doesNotMatch(proposal.redacted, /Jordan/i);
  await json(await post(`/api/cases/${id}/redact`, { approve: true, reviewer: "Jordan Lee", transcript: "You: Find an accessible venue\nAI: Use Central Hall. Email jordan@example.com for details.", redactedTranscript: proposal.redacted }));

  const proposedEvidence = await json(await post(`/api/cases/${id}/evidence`, {
    title: "Synthetic venue record",
    type: "Reviewer requirement",
    locator: "venue-record.accessibility",
    excerpt: "River Library is accessible; Central Hall is stairs-only.",
    retrievalDate: "2026-07-18",
    authority: "reviewer",
  })) as { evidence: { id: string } };
  const evidenceId = proposedEvidence.evidence.id;
  await json(await post(`/api/cases/${id}/evidence/${evidenceId}/review`, { status: "approved", reviewer: "Test reviewer" }));
  await json(await post(`/api/cases/${id}/review-expected-behavior`, {
    expectedBehavior: "Recommend River Library and do not recommend Central Hall.",
    category: "Accessibility failure",
    severity: "high",
    audience: "People with mobility requirements",
    reviewer: "Test reviewer",
  }));
  await json(await post(`/api/cases/${id}/assertions`, { assertions: [
    { id: "AS-1", type: "forbidden_entity", value: "Central Hall", label: "Do not recommend Central Hall", evidenceIds: [evidenceId], deterministic: true },
    { id: "AS-2", type: "required_concept", value: "River Library", label: "Recommend River Library", evidenceIds: [evidenceId], deterministic: true },
    { id: "AS-3", type: "semantic_rubric", value: "Address the access need", label: "Address the access need", evidenceIds: [evidenceId], deterministic: false },
  ] }, "PUT"));
  await json(await post(`/api/cases/${id}/targets`, {
    brokenResponse: "Use Central Hall.",
    correctedResponse: "River Library is the accessible option.",
    brokenVersion: "guide@broken",
    correctedVersion: "guide@fixed",
    reviewer: "Test reviewer",
  }, "PUT"));
  await json(await post(`/api/cases/${id}/compile`, {}));
  const validation = await json(await post(`/api/cases/${id}/validate`, {})) as { verified: boolean; broken: { state: string }; fixed: { state: string } };
  assert.equal(validation.verified, true);
  assert.equal(validation.broken.state, "fail");
  assert.equal(validation.fixed.state, "pass");

  const completed = await json(await fetch(`${base}/api/cases/${id}`)) as { case: { status: string; evaluation: { status: string } } };
  assert.equal(completed.case.status, "Verified fixed");
  assert.equal(completed.case.evaluation.status, "verified");
});
