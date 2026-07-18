import type { PlatformDashboard, SignedProofBundle } from "../src/platform-types.js";
import type { RedressCase } from "../src/types.js";

export interface RedressCIOptions {
  baseUrl: string;
  token?: string;
}

export class RedressCIClient {
  constructor(private readonly options: RedressCIOptions) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.options.baseUrl), {
      ...init,
      headers: { "Content-Type": "application/json", ...(this.options.token ? { Authorization: `Bearer ${this.options.token}` } : {}), ...init?.headers },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `RedressCI request failed with ${response.status}.`);
    return payload as T;
  }

  dashboard() { return this.request<{ platform: PlatformDashboard }>("/api/platform"); }
  case(id: string) { return this.request<{ case: RedressCase }>(`/api/cases/${encodeURIComponent(id)}`); }
  runAssurance(id: string) { return this.request(`/api/cases/${encodeURIComponent(id)}/assurance`, { method: "POST", body: "{}" }); }
  proof(id: string) { return this.request<SignedProofBundle>(`/api/cases/${encodeURIComponent(id)}/proof`); }
  verifyProof(bundle: SignedProofBundle) { return this.request<{ valid: boolean }>("/api/platform/proofs/verify", { method: "POST", body: JSON.stringify(bundle) }); }
  recordRecurrence(id: string, productVersion: string, runId: string) {
    return this.request(`/api/cases/${encodeURIComponent(id)}/recurrences`, { method: "POST", body: JSON.stringify({ productVersion, runId }) });
  }
}
