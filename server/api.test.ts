import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { app } from "./index.js";

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
  const developerView = await fetch(`${base}/api/cases/RC-1042`, { headers: { Authorization: `Bearer ${developerAuth.token}` } }).then((response) => response.json()) as { case: { reporterName: string; originalTranscript: string } };
  assert.equal(developerView.case.reporterName, "[REDACTED]");
  assert.equal(developerView.case.originalTranscript, "");

  const invalidTokenResponse = await fetch(`${base}/api/platform`, { headers: { Authorization: "Bearer invalid.token" } });
  assert.equal(invalidTokenResponse.status, 403);
});
