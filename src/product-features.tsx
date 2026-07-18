import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import type { EvidenceSuggestion, RedressCase } from "./types";
import type { GitHubCheckBundle, PlatformDashboard, ReporterStatusView, WorkspaceRole } from "./platform-types";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function VoiceInputButton({ value, onChange, label = "Dictate" }: { value: string; onChange: (value: string) => void; label?: string }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const supported = typeof window !== "undefined" && Boolean((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition);
  const toggle = () => {
    if (listening) { recognition.current?.stop(); return; }
    const browser = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { setMessage("Voice input is not available in this browser."); return; }
    const instance = new Constructor();
    instance.continuous = true;
    instance.interimResults = false;
    instance.lang = document.documentElement.lang || navigator.language || "en-US";
    instance.onresult = (event) => {
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript.trim()).filter(Boolean).join(" ");
      if (transcript) onChange(`${value}${value.trim() ? "\n" : ""}${transcript}`);
    };
    instance.onerror = (event) => { setMessage(`Voice input stopped: ${event.error}.`); setListening(false); };
    instance.onend = () => { setListening(false); setMessage("Voice input stopped. Review the text before continuing."); };
    recognition.current = instance;
    setMessage("Listening. Speak naturally; you can edit the transcript before submission.");
    setListening(true);
    instance.start();
  };
  return <div className="voice-control"><button type="button" className={`button voice-button ${listening ? "recording" : ""}`} onClick={toggle} aria-pressed={listening} disabled={!supported}><span className="voice-dot" />{listening ? "Stop listening" : label}</button><small aria-live="polite">{supported ? message || "Your browser handles speech recognition; RedressCI keeps only the editable text you submit." : "Voice input is unavailable here; typing and private attachments still work."}</small></div>;
}

export function EvidenceDiscoveryPanel({ item, onUse }: { item: RedressCase; onUse: (suggestion: EvidenceSuggestion) => void }) {
  const [suggestions, setSuggestions] = useState(item.evidenceSuggestions || []);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const discover = async () => {
    setBusy(true); setNotice("");
    try {
      const result = await api.discoverEvidence(item.id);
      setSuggestions(result.suggestions);
      setNotice(result.ai ? "GPT-5.6 found public candidates. A reviewer must inspect and approve every source." : "Live search was unavailable, so RedressCI created a clearly labeled reviewer draft.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Evidence discovery failed."); }
    finally { setBusy(false); }
  };
  return <section className="feature-panel evidence-discovery"><div className="feature-heading"><div><span>AI-ASSISTED SOURCE DISCOVERY</span><h3>Find evidence candidates</h3><p>Only the privacy-approved description is searched. Suggestions never become evidence automatically.</p></div><button className="button" type="button" disabled={busy} onClick={discover}><Icon name="search" size={16} />{busy ? "Searching…" : "Discover sources"}</button></div>{notice && <p className="feature-notice" aria-live="polite">{notice}</p>}<div className="suggestion-list">{suggestions.map((suggestion) => <article key={suggestion.id}><div><strong>{suggestion.title}</strong><span>{suggestion.sourceType.replaceAll("-", " ")}</span></div><code>{suggestion.locator}</code><p>{suggestion.excerpt}</p><small>{suggestion.rationale}</small><button type="button" className="text-link" onClick={() => onUse(suggestion)}>Use as review draft <Icon name="arrow" size={14} /></button></article>)}</div></section>;
}

export function ReporterLinkPanel({ item, role }: { item: RedressCase; role: WorkspaceRole }) {
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notice, setNotice] = useState("");
  if (role !== "reporter" && role !== "admin") return null;
  const create = async () => {
    try {
      const result = await api.createReporterLink(item.id);
      const url = new URL(result.path, window.location.origin).toString();
      setLink(url); setExpiresAt(result.expiresAt);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setNotice("Private status link created and copied. It is shown only once.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create a status link."); }
  };
  return <section className="card reporter-link-card"><div className="card-top"><div><span className="card-kicker">REPORTER CLOSURE</span><h3>Private status link</h3></div><Icon name="lock" /></div><p>Share progress without exposing the engineering workspace, original transcript, or private artifacts.</p>{link ? <><input value={link} readOnly aria-label="Private reporter status link" /><small>Expires {new Date(expiresAt).toLocaleDateString()} · create a new link to revoke reliance on this one.</small></> : <button className="button wide" onClick={create}><Icon name="user" size={16} />Create and copy private link</button>}{notice && <p className="feature-notice" aria-live="polite">{notice}</p>}</section>;
}

export function LiveVerificationPanel({ item, role, refresh }: { item: RedressCase; role: WorkspaceRole; refresh: () => Promise<void> }) {
  const [platform, setPlatform] = useState<PlatformDashboard | null>(null);
  const [adapterId, setAdapterId] = useState("adapter-http");
  const [baseUrl, setBaseUrl] = useState("");
  const [targetVersion, setTargetVersion] = useState(item.targetPair?.correctedVersion || "deployed-candidate");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (role === "developer" || role === "admin") api.platform().then(({ platform: value }) => setPlatform(value)).catch(() => undefined); }, [role]);
  if (role !== "developer" && role !== "admin") return item.liveVerifications[0] ? <section className="feature-panel live-proof"><h3>Deployed-system verification</h3><p>{item.liveVerifications[0].verified ? "The configured deployment passed this reviewed evaluation." : "The latest deployed run did not satisfy the evaluation."}</p></section> : null;
  const adapter = platform?.adapters.find((entry) => entry.id === adapterId);
  const configure = async () => {
    setBusy(true); setNotice("");
    try { await api.configureAdapter(adapterId, { baseUrl, secretEnv: "REDRESSCI_TARGET_TOKEN", enabled: true }); const result = await api.platform(); setPlatform(result.platform); setNotice("Live adapter configured. The hostname passed the server allowlist."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Adapter configuration failed."); }
    finally { setBusy(false); }
  };
  const run = async () => {
    setBusy(true); setNotice("");
    try { const result = await api.liveVerify(item.id, { adapterId, targetVersion }); setNotice(result.deploymentVerified ? "Deployed fix verified. A signed deployment proof is ready." : "The deployed response failed the reviewed evaluation."); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Live verification failed."); }
    finally { setBusy(false); }
  };
  const latest = item.liveVerifications[0];
  return <section className="feature-panel live-verification"><div className="feature-heading"><div><span>LIVE REMEDIATION LOOP</span><h3>Verify the deployed system</h3><p>Recorded proof must pass first. Secrets stay server-side and target hosts must be explicitly allowlisted.</p></div>{latest && <b className={latest.verified ? "success-text" : "danger-text"}>{latest.verified ? "DEPLOYED FIX VERIFIED" : "DEPLOYED RUN FAILED"}</b>}</div><div className="live-config"><label>Adapter<select value={adapterId} onChange={(event) => setAdapterId(event.target.value)}>{platform?.adapters.filter((entry) => entry.kind !== "recorded").map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.enabled ? "configured" : "not configured"}</option>)}</select></label><label>HTTPS target endpoint<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={adapter?.baseUrl || "https://api.example.org/evaluate"} /></label><label>Deployed version<input value={targetVersion} onChange={(event) => setTargetVersion(event.target.value)} /></label></div><div className="feature-actions"><button className="button" onClick={configure} disabled={busy || !baseUrl.trim()}>Configure endpoint</button><button className="button dark" onClick={run} disabled={busy || !adapter?.enabled || item.evaluation?.status !== "verified"}><Icon name="flask" size={16} />{busy ? "Working…" : "Run deployed verification"}</button>{latest?.verified && <a className="button" href={`/api/cases/${item.id}/deployment-proof`} download><Icon name="shield" size={16} />Deployment proof</a>}</div>{notice && <p className="feature-notice" aria-live="polite">{notice}</p>}{latest && <dl className="proof-facts"><div><dt>Endpoint</dt><dd>{latest.endpointOrigin}</dd></div><div><dt>Version</dt><dd>{latest.targetVersion}</dd></div><div><dt>Response hash</dt><dd><code>{latest.responseSha256.slice(0, 16)}…</code></dd></div></dl>}</section>;
}

export function GitHubCheckPanel({ item }: { item: RedressCase }) {
  const [bundle, setBundle] = useState<GitHubCheckBundle | null>(null);
  const [configured, setConfigured] = useState(false);
  const [commitSha, setCommitSha] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (item.evaluation) api.githubCheck(item.id).then((result) => { setBundle(result.bundle); setConfigured(result.configured); }).catch((error) => setNotice(error instanceof Error ? error.message : "Could not generate the GitHub check.")); }, [item.id, item.evaluation?.id]);
  const publish = async () => {
    try { const result = await api.publishGitHubCheck(item.id, commitSha); setNotice(`GitHub check ${result.check.id} published with conclusion ${result.check.conclusion}.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not publish the check."); }
  };
  if (!item.evaluation) return null;
  return <section className="card github-check"><div className="card-top"><div><span className="card-kicker">GITHUB RELEASE CHECK</span><h3>Run this case against the deployed target</h3></div><span className={`integration-badge ${configured ? "configured" : ""}`}>{configured ? "API configured" : "Workflow ready"}</span></div><p>The generated workflow calls the target from repository secrets, evaluates the real response, and blocks the check when the failure returns.</p><div className="feature-actions"><a className="button dark" href={`/api/cases/${item.id}/github-workflow`} download><Icon name="download" size={16} />Download workflow</a>{bundle && <button className="button" onClick={() => navigator.clipboard.writeText(bundle.workflow).then(() => setNotice("Workflow copied."))}>Copy YAML</button>}</div>{configured && <div className="github-publish"><input value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="40-character commit SHA" aria-label="Commit SHA" /><button className="button" onClick={publish} disabled={!/^[a-f0-9]{40}$/i.test(commitSha)}>Publish check run</button></div>}{bundle && <small>Required repository secrets: {bundle.requiredSecrets.join(" and ")}.</small>}{notice && <p className="feature-notice" aria-live="polite">{notice}</p>}</section>;
}

export function FailureRadarPage({ platform }: { platform: PlatformDashboard | null }) {
  if (!platform) return <div className="loading-screen"><span /></div>;
  const report = platform.latest.pattern;
  return <div className="page radar-page"><header className="radar-hero"><span className="eyebrow"><span /> PRIVACY-SAFE FAILURE RADAR</span><h1>See recurring mechanisms,<br /><em>not private stories.</em></h1><p>Signals are grouped from hashes and reviewed metadata. Raw reports and small groups never appear.</p></header><section className="radar-summary"><div><strong>{report.groups.length}</strong><span>publishable patterns</span></div><div><strong>{report.suppressedGroups}</strong><span>groups hidden for privacy</span></div><div><strong>{report.threshold}</strong><span>minimum cases per pattern</span></div></section><section className="radar-grid">{report.groups.map((group) => <article className="card" key={group.fingerprint}><span className="card-kicker">{group.mechanism.replaceAll("-", " ")}</span><h3>{group.capability.replaceAll("-", " ")}</h3><strong>{group.count} related cases</strong><code>{group.fingerprint.slice(0, 18)}…</code></article>)}{!report.groups.length && <article className="card radar-empty"><Icon name="lock" /><h3>No pattern has crossed the privacy threshold</h3><p>{report.suppressedGroups} group{report.suppressedGroups === 1 ? " is" : "s are"} intentionally hidden until at least {report.threshold} related cases exist.</p></article>}</section><footer className="network-boundary"><Icon name="shield" /><p><strong>Minimum-group suppression is enforced server-side.</strong> {report.privacyNotice}</p></footer></div>;
}

export function ReporterStatusPage({ token, onHome }: { token: string; onHome: () => void }) {
  const [status, setStatus] = useState<ReporterStatusView | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = () => api.reporterStatus(token).then((result) => setStatus(result.status)).catch((reason) => setError(reason instanceof Error ? reason.message : "This status link is unavailable."));
  useEffect(() => { void load(); }, [token]);
  const preference = async (key: keyof ReporterStatusView["preferences"], value: boolean) => { try { const result = await api.updateReporterPreferences(token, { [key]: value }); setStatus((current) => current ? { ...current, preferences: result.preferences } : current); setNotice("Notification preferences saved."); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Preferences could not be saved."); } };
  const withdraw = async () => { if (!window.confirm("Withdraw this report from further sharing and review?")) return; try { await api.withdrawFromStatusLink(token); setNotice("Consent withdrawn. The case is now closed to further processing."); await load(); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Consent could not be withdrawn."); } };
  if (error) return <div className="report-page status-page"><header><button className="logo" onClick={onHome}>RedressCI</button></header><main className="card status-error"><Icon name="alert" /><h1>Private link unavailable</h1><p>{error}</p><button className="button" onClick={onHome}>Return home</button></main></div>;
  if (!status) return <div className="loading-screen"><span /></div>;
  return <div className="report-page status-page"><header><button className="logo" onClick={onHome}>RedressCI</button><span className="pill pill-private"><Icon name="lock" size={13} />Private reporter view</span></header><main className="status-shell"><section className="status-hero"><span>{status.caseId} · {status.product}</span><h1>{status.title}</h1><div><b>{status.status}</b><small>Updated {new Date(status.updatedAt).toLocaleString()}</small></div></section><div className="status-columns"><section className="card"><h2>Your remediation timeline</h2><div className="compact-timeline">{status.timeline.map((event) => <div key={`${event.label}-${event.createdAt}`}><span className={event.complete ? "complete" : ""}><Icon name={event.complete ? "check" : "clock"} size={14} /></span><div><strong>{event.label}</strong><p>{event.detail}</p><small>{new Date(event.createdAt).toLocaleString()}</small></div></div>)}</div></section><aside className="content-stack"><section className="card"><span className="card-kicker">WHAT WAS PROVEN</span><h3>{status.deploymentVerified ? "Deployed fix verified" : status.receiptAvailable ? "Evaluation verified" : "Review in progress"}</h3><p>{status.expectedBehavior || "Expected behavior is still awaiting reviewer approval."}</p>{status.receiptAvailable && <a className="button wide" href={`/api/public/status/${encodeURIComponent(token)}/receipt`} download>Download Redress Receipt</a>}</section><section className="card"><h3>Updates you want</h3>{Object.entries(status.preferences).map(([key, checked]) => <label className="preference" key={key}><input type="checkbox" checked={checked} onChange={(event) => preference(key as keyof ReporterStatusView["preferences"], event.target.checked)} /><span>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span></label>)}</section><section className="card privacy-card"><Icon name="shield" /><p>{status.privacyNotice}</p></section><button className="button danger-button" onClick={withdraw} disabled={status.status === "Withdrawn"}>{status.status === "Withdrawn" ? "Report withdrawn" : "Withdraw consent"}</button></aside></div>{notice && <div className="notice" aria-live="polite">{notice}</div>}</main></div>;
}
