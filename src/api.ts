import type { Assertion, Evidence, RedressCase, TargetPair } from "./types";
import type { PlatformDashboard } from "./platform-types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong");
  return payload;
}

export const api = {
  health: () => request<{ ok: boolean; ai: { configured: boolean; model: string }; demoMode: boolean }>("/api/health"),
  cases: () => request<{ cases: RedressCase[] }>("/api/cases"),
  case: (id: string) => request<{ case: RedressCase }>(`/api/cases/${id}`),
  reset: () => request<{ case: RedressCase }>("/api/reset", { method: "POST" }),
  createCase: (body: Partial<RedressCase>) => request<{ case: RedressCase }>("/api/cases", { method: "POST", body: JSON.stringify(body) }),
  uploadArtifact: async (id: string, file: File) => {
    const form = new FormData();
    form.append("artifact", file);
    const response = await fetch(`/api/cases/${id}/artifacts`, { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Upload failed");
    return payload;
  },
  extract: (id: string, body: { transcript?: string; imageDataUrl?: string }) => request(`/api/cases/${id}/extract`, { method: "POST", body: JSON.stringify(body) }),
  validate: (id: string) => request<{ verified: boolean; broken: RedressCase["runs"][number]; fixed: RedressCase["runs"][number] }>(`/api/cases/${id}/validate`, { method: "POST", body: "{}" }),
  compile: (id: string) => request(`/api/cases/${id}/compile`, { method: "POST", body: "{}" }),
  redact: (id: string, transcript: string, approve = true, reviewer = "Reporter", redactedTranscript?: string) => request<{ redacted: string; approved: boolean }>(`/api/cases/${id}/redact`, { method: "POST", body: JSON.stringify({ transcript, approve, reviewer, redactedTranscript }) }),
  addEvidence: (id: string, evidence: Omit<Evidence, "id" | "status">) => request<{ evidence: Evidence }>(`/api/cases/${id}/evidence`, { method: "POST", body: JSON.stringify(evidence) }),
  reviewEvidence: (id: string, evidenceId: string, status: "approved" | "rejected", reviewer = "Demo reviewer") => request(`/api/cases/${id}/evidence/${evidenceId}/review`, { method: "POST", body: JSON.stringify({ status, reviewer }) }),
  approveExpectedBehavior: (id: string, body: { expectedBehavior: string; category: string; audience: string; severity: RedressCase["severity"]; reviewer?: string }) => request(`/api/cases/${id}/review-expected-behavior`, { method: "POST", body: JSON.stringify(body) }),
  saveAssertions: (id: string, assertions: Assertion[]) => request<{ assertions: Assertion[] }>(`/api/cases/${id}/assertions`, { method: "PUT", body: JSON.stringify({ assertions }) }),
  saveTargets: (id: string, targetPair: Omit<TargetPair, "approvedAt">) => request<{ targetPair: TargetPair }>(`/api/cases/${id}/targets`, { method: "PUT", body: JSON.stringify({ ...targetPair, reviewer: targetPair.approvedBy }) }),
  platform: () => request<{ platform: PlatformDashboard }>("/api/platform"),
  runAssurance: (id: string) => request<{ assurance: { mutation: NonNullable<PlatformDashboard["latest"]["mutation"]>; calibration: NonNullable<PlatformDashboard["latest"]["calibration"]>; stability: NonNullable<PlatformDashboard["latest"]["stability"]>; scopeGuard: NonNullable<PlatformDashboard["latest"]["scopeGuard"]> } }>(`/api/cases/${id}/assurance`, { method: "POST", body: "{}" }),
  proposeCounterfactuals: (id: string) => request(`/api/cases/${id}/counterfactuals`, { method: "POST", body: "{}" }),
  sealEscrow: (id: string) => request(`/api/cases/${id}/escrow`, { method: "POST", body: "{}" }),
};
