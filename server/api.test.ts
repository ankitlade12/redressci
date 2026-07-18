import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";

// The judge-path suite must stay deterministic even when a developer has a
// live key in .env. Live model access is verified separately.
process.env.OPENAI_API_KEY = "";
const { app } = await import("./index.js");

test("judge API path exposes demo, executes gate, and issues a receipt", async (context) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  context.after(() => server.close());
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/api/health`).then((response) => response.json()) as { ok: boolean; demoMode: boolean };
  assert.equal(health.ok, true);
  assert.equal(health.demoMode, true);

  const cases = await fetch(`${base}/api/cases`).then((response) => response.json()) as { cases: Array<{ id: string }> };
  assert.equal(cases.cases[0].id, "RC-1042");

  const validationResponse = await fetch(`${base}/api/cases/RC-1042/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const validation = await validationResponse.json() as { verified: boolean; broken: { state: string }; fixed: { state: string } };
  assert.equal(validation.verified, true);
  assert.equal(validation.broken.state, "fail");
  assert.equal(validation.fixed.state, "pass");

  const receiptResponse = await fetch(`${base}/api/cases/RC-1042/receipt`);
  const receipt = await receiptResponse.json() as { proofSha256: string; privacy: { containsPersonalData: boolean } };
  assert.equal(receiptResponse.status, 200);
  assert.equal(receipt.privacy.containsPersonalData, false);
  assert.match(receipt.proofSha256, /^[a-f0-9]{64}$/);

  const assuranceResponse = await fetch(`${base}/api/cases/RC-1042/assurance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const assurance = await assuranceResponse.json() as { assurance: { mutation: { detectionRate: number }; stability: { stable: boolean }; scopeGuard: { passed: boolean } } };
  assert.equal(assuranceResponse.status, 200);
  assert.equal(assurance.assurance.mutation.detectionRate, 1);
  assert.equal(assurance.assurance.stability.stable, true);
  assert.equal(assurance.assurance.scopeGuard.passed, true);

  const proofResponse = await fetch(`${base}/api/cases/RC-1042/proof`);
  const proof = await proofResponse.json();
  const proofVerification = await fetch(`${base}/api/platform/proofs/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(proof) }).then((response) => response.json()) as { valid: boolean };
  assert.equal(proofVerification.valid, true);

  const platform = await fetch(`${base}/api/platform`).then((response) => response.json()) as { platform: { phases: unknown[]; metrics: { mutationDetection: number }; auditHead: string } };
  assert.equal(platform.platform.phases.length, 4);
  assert.equal(platform.platform.metrics.mutationDetection, 1);
  assert.match(platform.platform.auditHead, /^[a-f0-9]{64}$/);

  const reporterAuth = await fetch(`${base}/api/auth/demo/reporter`, { method: "POST" }).then((response) => response.json()) as { token: string };
  const forbiddenPolicyUpdate = await fetch(`${base}/api/platform/workspace/policy`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${reporterAuth.token}` }, body: JSON.stringify({ retentionDays: 30 }) });
  assert.equal(forbiddenPolicyUpdate.status, 403);

  const developerAuth = await fetch(`${base}/api/auth/demo/developer`, { method: "POST" }).then((response) => response.json()) as { token: string };
  const developerView = await fetch(`${base}/api/cases/RC-1042`, { headers: { Authorization: `Bearer ${developerAuth.token}` } }).then((response) => response.json()) as { case: { reporterName: string; originalTranscript: string; artifacts: unknown[]; userInput: string } };
  assert.equal(developerView.case.reporterName, "[REDACTED]");
  assert.equal(developerView.case.originalTranscript, "");
  assert.deepEqual(developerView.case.artifacts, []);
  assert.equal(developerView.case.userInput, "Which nearby cooling center can I enter using a wheelchair?");

  const internalResponse = await fetch(`${base}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${developerAuth.token}` },
    body: JSON.stringify({ product: "Internal support assistant", description: "The assistant returned an incorrect refund rule.", consent: "Anonymized public evaluation use" }),
  });
  const internal = await internalResponse.json() as { case: { id: string; intakeType: string; reporterId: string; consent: string; originalTranscript: string } };
  assert.equal(internalResponse.status, 201);
  assert.equal(internal.case.intakeType, "internal-incident");
  assert.equal(internal.case.reporterId, "member-developer");
  assert.equal(internal.case.consent, "Private workspace incident");
  assert.equal(internal.case.originalTranscript, "");

  const evidenceForm = new FormData();
  evidenceForm.append("artifact", new Blob(["You: Why was my refund denied?\nAI: Your refund was denied because the window expired."], { type: "text/plain" }), "conversation.txt");
  const uploadResponse = await fetch(`${base}/api/cases/${internal.case.id}/artifacts`, { method: "POST", headers: { Authorization: `Bearer ${developerAuth.token}` }, body: evidenceForm });
  const uploaded = await uploadResponse.json() as { artifact: { id: string; encrypted: boolean; type: string } };
  assert.equal(uploadResponse.status, 201);
  assert.equal(uploaded.artifact.encrypted, true);
  assert.equal(uploaded.artifact.type, "text/plain");

  const extractionResponse = await fetch(`${base}/api/cases/${internal.case.id}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${developerAuth.token}` },
    body: JSON.stringify({ artifactId: uploaded.artifact.id }),
  });
  const extracted = await extractionResponse.json() as { extraction: { userInput: string; observedResponse: string }; ai: boolean; error?: string };
  assert.equal(extractionResponse.status, 200, extracted.error);
  assert.equal(extracted.ai, false);
  assert.equal(extracted.extraction.userInput, "Why was my refund denied?");
  assert.match(extracted.extraction.observedResponse, /window expired/);
  const extractedCase = await fetch(`${base}/api/cases/${internal.case.id}`, { headers: { Authorization: `Bearer ${developerAuth.token}` } }).then((response) => response.json()) as { case: { originalTranscript: string } };
  assert.match(extractedCase.case.originalTranscript, /Why was my refund denied/);

  const reporterCrossUpload = new FormData();
  reporterCrossUpload.append("artifact", new Blob(["private"], { type: "text/plain" }), "private.txt");
  const deniedUpload = await fetch(`${base}/api/cases/${internal.case.id}/artifacts`, { method: "POST", headers: { Authorization: `Bearer ${reporterAuth.token}` }, body: reporterCrossUpload });
  assert.equal(deniedUpload.status, 403);

  const invalidTokenResponse = await fetch(`${base}/api/platform`, { headers: { Authorization: "Bearer invalid.token" } });
  assert.equal(invalidTokenResponse.status, 403);
});
