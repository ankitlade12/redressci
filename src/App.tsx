import { useEffect, useMemo, useState } from "react";
import { api, setApiToken } from "./api";
import { areReviewTextsEquivalent, getCaseOverviewState, isEvaluationVerified, isPrivateConsent } from "./case-state";
import { Icon } from "./icons";
import { parseRoute, routePath, type AppRoute, type Page } from "./routing";
import type { AssertionResult, EvaluationRun, RedressCase, ResultState } from "./types";
import type { PlatformDashboard, WorkspaceRole } from "./platform-types";

type CaseTab = "overview" | "evidence" | "evaluation" | "validation" | "timeline" | "ci";

const formatDate = (date: string, withTime = false) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(date));
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function StatusPill({ state, children }: { state: ResultState | "verified" | "low" | "medium" | "high" | "critical" | "synthetic" | "private"; children?: React.ReactNode }) {
  return <span className={`pill pill-${state}`}>{state === "pass" || state === "verified" ? <Icon name="check" size={13} /> : null}{children || titleCase(state)}</span>;
}

function Logo({ onDashboard }: { onDashboard?: () => void }) {
  return <button className="logo" onClick={onDashboard || (() => location.assign("/"))} aria-label="Go to dashboard"><span className="logo-mark"><Icon name="mark" size={21} /></span><span>Redress<span>CI</span></span></button>;
}

const roleLabels: Record<WorkspaceRole, string> = { reporter: "Reporter", reviewer: "Reviewer", developer: "Developer", admin: "Administrator", partner: "Verifier" };

function Shell({ children, page, onNavigate, onReport, ai, role, roleBusy, onRoleChange }: { children: React.ReactNode; page: Page; onNavigate: (page: Page) => void; onReport: () => void; ai: boolean; role: WorkspaceRole; roleBusy: boolean; onRoleChange: (role: WorkspaceRole) => void }) {
  const canReport = role === "reporter" || role === "developer" || role === "admin";
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo onDashboard={() => onNavigate("dashboard")} />
      <nav aria-label="Main navigation">
        <button className={page === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}><Icon name="grid" />Cases</button>
        {role !== "reporter" && <button className={page === "assurance" ? "active" : ""} onClick={() => onNavigate("assurance")}><Icon name="shield" />Assurance network</button>}
        <button onClick={onReport} disabled={!canReport} title={canReport ? "Create a private report" : "Reporter, Developer, or Administrator access is required"}><Icon name="plus" />{role === "developer" ? "Report internal incident" : "Report a failure"}</button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="workspace-card role-card">
        <span className="avatar">{role.slice(0, 2).toUpperCase()}</span>
        <label><small>VIEW PRIVACY BOUNDARY AS</small><select value={role} disabled={roleBusy} onChange={(event) => onRoleChange(event.target.value as WorkspaceRole)} aria-label="View demo as role">{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <div className={`ai-status ${ai ? "online" : ""}`}><span />{ai ? "Live AI configured" : "Synthetic demo mode"}</div>
    </aside>
    <main>{children}</main>
  </div>;
}

function Dashboard({ cases, onOpen, onReport, onReset, canReport, canReset }: { cases: RedressCase[]; onOpen: (id: string) => void; onReport: () => void; onReset: () => void; canReport: boolean; canReset: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "review" | "verified">("all");
  const verifiedCases = cases.filter(isEvaluationVerified);
  const verified = verifiedCases.length;
  const needsReview = cases.length - verified;
  const matchingCases = cases.filter((item) => {
    const matchesFilter = filter === "all" || (filter === "verified" ? isEvaluationVerified(item) : !isEvaluationVerified(item));
    const haystack = `${item.id} ${item.title} ${item.product} ${item.category}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });
  const reproduceMinutes = cases.flatMap((item) => {
    const reported = item.timeline.find((event) => event.label === "Report received");
    const reproduced = item.timeline.find((event) => event.label === "Problem reproduced");
    return reported && reproduced ? [Math.max(0, Math.round((new Date(reproduced.createdAt).getTime() - new Date(reported.createdAt).getTime()) / 60_000))] : [];
  }).sort((a, b) => a - b);
  const medianMinutes = reproduceMinutes.length ? reproduceMinutes[Math.floor(reproduceMinutes.length / 2)] : null;
  const protectedChecks = cases.reduce((total, item) => total + (item.runs.find((run) => run.target === "fixed")?.assertionResults.filter((result) => result.state === "pass").length || 0), 0);
  return <div className="page dashboard-page">
    <header className="topbar"><div /><div className="top-actions"><label className="case-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cases" aria-label="Search cases" /></label><button className="button primary" onClick={onReport} disabled={!canReport} title={canReport ? "Create a private report" : "Switch to Reporter to submit a report"}><Icon name="plus" size={17} />Report a failure</button></div></header>
    <section className="hero">
      <div className="eyebrow"><span /> FROM EXPERIENCE TO PROTECTION</div>
      <h1>Turn AI failures into<br /><em>tests that stay fixed.</em></h1>
      <p>RedressCI gives every reported failure a path to evidence, verification, and permanent regression protection.</p>
      <div className="hero-actions"><button className="button dark" disabled={!verifiedCases[0]} onClick={() => verifiedCases[0] && onOpen(verifiedCases[0].id)}>Explore the verified evaluation <Icon name="arrow" size={17} /></button>{canReset && <button className="button quiet" onClick={onReset}><Icon name="refresh" size={17} />Reset demo</button>}</div>
    </section>
    <section className="lifecycle-strip" aria-label="RedressCI workflow">{[["01", "Report", "Capture the affected person’s experience"], ["02", "Review", "Approve privacy, evidence, and expectations"], ["03", "Prove", "Require broken-fails and fixed-passes"], ["04", "Protect", "Export the case into release CI"]].map(([number, label, copy]) => <div key={number}><span>{number}</span><strong>{label}</strong><small>{copy}</small></div>)}</section>
    <section className="metrics" aria-label="Case metrics">
      <div><small>OPEN CASES</small><strong>{String(needsReview).padStart(2, "0")}</strong><span>Awaiting action</span></div>
      <div><small>EVALUATIONS VERIFIED</small><strong>{String(verified).padStart(2, "0")}</strong><span className="positive">Broken/fixed distinction proven</span></div>
      <div><small>MEDIAN TO REPRODUCE</small><strong>{medianMinutes ?? "—"}{medianMinutes !== null && <sup>m</sup>}</strong><span>From recorded timelines</span></div>
      <div className="metric-accent"><small>PROTECTED CHECKS</small><strong>{String(protectedChecks).padStart(2, "0")}</strong><span>Passing on corrected targets</span></div>
    </section>
    <section className="cases-section">
      <div className="section-heading"><div><h2>Cases</h2><p>Every report has a visible path to closure.</p></div><div className="filter-row"><button className={`filter ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All <b>{cases.length}</b></button><button className={`filter ${filter === "review" ? "active" : ""}`} onClick={() => setFilter("review")}>Needs review <b>{needsReview}</b></button><button className={`filter ${filter === "verified" ? "active" : ""}`} onClick={() => setFilter("verified")}>Verified <b>{verified}</b></button></div></div>
      <div className="case-table">
        <div className="table-head"><span>CASE</span><span>STATUS</span><span>SEVERITY</span><span>LATEST RUN</span><span>UPDATED</span><span /></div>
        {matchingCases.map((item) => <button className="case-row" onClick={() => onOpen(item.id)} key={item.id}>
          <span className="case-title"><i className="category-icon"><Icon name="shield" size={18} /></i><span><strong>{item.title}</strong><small>{item.id} · {item.product}</small></span></span>
          <span><StatusPill state={isEvaluationVerified(item) ? "verified" : "private"}>{item.status}</StatusPill></span>
          <span><StatusPill state={item.severity}>{item.severity}</StatusPill></span>
          <span className="run-cell"><i className="pass-dot" />{item.runs[0]?.state === "pass" || isEvaluationVerified(item) ? "Correction passed" : "Not run"}</span>
          <span className="date-cell">{formatDate(item.updatedAt)}</span>
          <span><Icon name="chevron" size={18} /></span>
        </button>)}
        {!matchingCases.length && <div className="case-empty"><Icon name="search" /><strong>No matching cases</strong><span>Try another search or filter.</span></div>}
      </div>
    </section>
    <footer className="trust-note"><Icon name="shield" size={18} /><span><strong>Privacy by default.</strong> Original reports remain separate from anonymized evaluations.</span></footer>
  </div>;
}

function AssurancePage({ platform, cases, refresh }: { platform: PlatformDashboard | null; cases: RedressCase[]; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const verified = cases.find((item) => item.evaluation?.status === "verified");
  const run = async () => {
    if (!verified) return;
    setBusy(true); setNotice("");
    try {
      await api.runAssurance(verified.id);
      await api.proposeCounterfactuals(verified.id);
      await api.sealEscrow(verified.id);
      await refresh();
      setNotice("Assurance suite complete: mutations, calibration, repeat runs, scope guard, variations, and sealed escrow were recorded.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Assurance run failed"); }
    finally { setBusy(false); }
  };
  if (!platform) return <div className="loading-screen"><Logo /><span /></div>;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return <div className="page assurance-page">
    <header className="assurance-hero"><div><span className="eyebrow"><span /> PROOF-CARRYING REMEDIATION</span><h1>Assurance that compounds<br /><em>across every fix.</em></h1><p>The full roadmap is represented as one operating layer: governed evidence enters once, then powers calibration, community packs, delivery policy, and independent proof.</p></div><button className="button dark" onClick={run} disabled={busy || !verified}><Icon name="flask" />{busy ? "Running assurance suite…" : "Run full assurance suite"}</button></header>
    {notice && <div className="assurance-notice"><Icon name="check" />{notice}</div>}
    <section className="assurance-metrics">
      <div><span>Evidence coverage</span><strong>{percent(platform.metrics.evidenceCoverage)}</strong><small>Version-pinned dependencies</small></div>
      <div><span>Mutation detection</span><strong>{percent(platform.metrics.mutationDetection)}</strong><small>Approved failures caught</small></div>
      <div><span>Reviewer agreement</span><strong>{percent(platform.metrics.reviewerAgreement)}</strong><small>Rule vs model decisions</small></div>
      <div><span>Repeat stability</span><strong>{percent(platform.metrics.repeatRunStability)}</strong><small>95% interval recorded</small></div>
    </section>
    <div className="assurance-body">
      <section><div className="section-heading"><div><h2>Product phases</h2><p>Each phase exposes executable controls, not a roadmap placeholder.</p></div><StatusPill state="verified">35 capabilities</StatusPill></div><div className="phase-grid">{platform.phases.map((phase, index) => <article className="phase-card" key={phase.id}><div><span>0{index + 1}</span><StatusPill state="verified">Operational</StatusPill></div><h3>{phase.name}</h3><p>{phase.summary}</p><footer><strong>{phase.capabilities}</strong> enforced capabilities</footer></article>)}</div></section>
      <section className="assurance-columns">
        <article className="card assurance-panel"><div className="card-top"><div><span className="card-kicker">ASSURANCE ENGINE</span><h3>Evaluation quality is measured</h3></div><Icon name="flask" /></div>{platform.latest.mutation ? <><div className="assurance-score"><strong>{percent(platform.latest.mutation.detectionRate)}</strong><span>mutation detection</span></div><ul>{platform.latest.mutation.results.map((result) => <li key={result.id}><Icon name={result.caught ? "check" : "alert"} size={15} /><span>{result.name}</span><b>{result.observed}</b></li>)}</ul></> : <p className="empty-copy">Run the suite to generate mutation sensitivity, disagreement, confidence, and neighboring-regression evidence.</p>}</article>
        <article className="card assurance-panel"><div className="card-top"><div><span className="card-kicker">COMMUNITY GOVERNANCE</span><h3>{platform.packs[0]?.name || "Evaluation packs"}</h3></div><Icon name="evidence" /></div>{platform.packs.map((pack) => <div className="pack-row" key={pack.id}><div><strong>v{pack.version}</strong><span>{pack.locales.join(" · ")} · {pack.accessibility.wcagTarget}</span></div><StatusPill state="verified">{pack.status}</StatusPill><p>{pack.changelog[0]}</p></div>)}<div className="governance-meta"><span><b>{platform.metrics.openReviewTasks}</b> re-reviews</span><span><b>{platform.metrics.auditEvents}</b> chained events</span><span><b>{platform.latest.pattern.suppressedGroups}</b> private patterns</span></div></article>
        <article className="card assurance-panel"><div className="card-top"><div><span className="card-kicker">DELIVERY NETWORK</span><h3>Fixes stay connected to releases</h3></div><Icon name="timeline" /></div><div className="integration-list">{platform.integrations.map((integration) => <div key={integration.id}><span className={integration.state === "configured" ? "integration-on" : ""} /><div><strong>{integration.label}</strong><small>{integration.kind} · {integration.state}</small></div></div>)}</div>{verified && <div className="proof-actions"><a className="button dark" href={`/api/cases/${verified.id}/proof`} download><Icon name="shield" size={16} />Signed proof bundle</a><a className="button" href={`/api/cases/${verified.id}/oecd`} target="_blank" rel="noreferrer"><Icon name="download" size={16} />OECD export</a></div>}</article>
      </section>
      <footer className="network-boundary"><Icon name="lock" /><p><strong>Privacy boundary remains active across the network.</strong> Pattern groups below {platform.latest.pattern.threshold} cases are suppressed, escrow payloads are encrypted, and proof bundles contain evidence hashes—not original artifacts.</p><code>{platform.auditHead.slice(0, 18)}…</code></footer>
    </div>
  </div>;
}

const tabs: Array<{ id: CaseTab; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "file" }, { id: "evidence", label: "Evidence", icon: "evidence" }, { id: "evaluation", label: "Evaluation", icon: "code" }, { id: "validation", label: "Validation", icon: "flask" }, { id: "timeline", label: "Timeline", icon: "timeline" }, { id: "ci", label: "CI export", icon: "download" },
];

function CaseDetail({ item, onBack, refresh, role }: { item: RedressCase; onBack: () => void; refresh: () => Promise<void>; role: WorkspaceRole }) {
  const [tab, setTab] = useState<CaseTab>("overview");
  const [running, setRunning] = useState(false);
  const [freshRuns, setFreshRuns] = useState<{ broken: EvaluationRun; fixed: EvaluationRun } | null>(null);
  const [notice, setNotice] = useState("");
  const validate = async () => {
    setRunning(true); setNotice("");
    try { const result = await api.validate(item.id); setFreshRuns({ broken: result.broken, fixed: result.fixed }); setNotice(result.verified ? "Validation gate passed. The recorded correction satisfies the reviewed evaluation; no deployed system was called." : "The recorded targets were not distinguished."); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Validation failed"); }
    finally { setRunning(false); }
  };
  return <div className="page case-page">
    <header className="case-header">
      <button className="back-link" onClick={onBack}>Cases <Icon name="chevron" size={14} /> <span>{item.id}</span></button>
      <div className="case-head-row"><div><div className="title-meta">{item.synthetic ? <StatusPill state="synthetic">Synthetic demonstration</StatusPill> : <StatusPill state="private">Private report</StatusPill>}<span>Updated {formatDate(item.updatedAt, true)}</span></div><h1>{item.title}</h1><p>{item.description}</p></div><StatusPill state={isEvaluationVerified(item) ? "verified" : "private"}>{item.status}</StatusPill></div>
      <div className="tabbar" role="tablist">{tabs.map((entry) => <button role="tab" aria-selected={tab === entry.id} className={tab === entry.id ? "active" : ""} onClick={() => setTab(entry.id)} key={entry.id}><Icon name={entry.icon} size={17} />{entry.label}</button>)}</div>
    </header>
    <div className="case-content">
      {notice && <div className="notice"><Icon name="check" size={17} />{notice}</div>}
      {!item.synthetic && !isEvaluationVerified(item) && <ReviewWorkspace item={item} refresh={refresh} setTab={setTab} role={role} />}
      {tab === "overview" && <Overview item={item} setTab={setTab} />}
      {tab === "evidence" && <EvidenceView item={item} />}
      {tab === "evaluation" && <EvaluationView item={item} setTab={setTab} />}
      {tab === "validation" && <ValidationView item={item} runs={freshRuns} onRun={validate} running={running} />}
      {tab === "timeline" && <TimelineView item={item} />}
      {tab === "ci" && <CIView item={item} />}
    </div>
  </div>;
}

function ReviewWorkspace({ item, refresh, setTab, role }: { item: RedressCase; refresh: () => Promise<void>; setTab: (tab: CaseTab) => void; role: WorkspaceRole }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [redacted, setRedacted] = useState(item.redactedTranscript);
  const [redactedDescription, setRedactedDescription] = useState(item.redactedDescription);
  const [review, setReview] = useState({
    sourceTitle: "",
    sourceLocator: "",
    sourceExcerpt: "",
    expectedBehavior: item.expectedBehavior,
    forbidden: "",
    required: "",
    correctedResponse: "",
    brokenVersion: "reported-version",
    correctedVersion: "candidate-fix",
    category: item.category,
    severity: item.severity,
    audience: item.audience === "Not yet reviewed" ? "People using this AI capability" : item.audience,
  });
  const set = (key: keyof typeof review, value: string) => setReview((current) => ({ ...current, [key]: value }));

  const approvePrivacy = async () => {
    setBusy(true); setError("");
    try { await api.redact(item.id, item.originalTranscript, true, item.reporterName || "Reporter", redacted, redactedDescription); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Privacy approval failed"); }
    finally { setBusy(false); }
  };

  const compileReviewedCase = async () => {
    if (areReviewTextsEquivalent(review.expectedBehavior, review.correctedResponse)) {
      setError("Expected behavior must be a general evaluation rule, not a copy of the recorded corrected response.");
      return;
    }
    setBusy(true); setError("");
    try {
      const { evidence } = await api.addEvidence(item.id, {
        title: review.sourceTitle,
        type: "Reviewer requirement",
        locator: review.sourceLocator,
        excerpt: review.sourceExcerpt,
        retrievalDate: new Date().toISOString().slice(0, 10),
        authority: "reviewer",
      });
      await api.reviewEvidence(item.id, evidence.id, "approved");
      await api.approveExpectedBehavior(item.id, {
        expectedBehavior: review.expectedBehavior,
        category: review.category,
        audience: review.audience,
        severity: review.severity,
      });
      await api.saveAssertions(item.id, [
        { id: "AS-1", type: "forbidden_entity", value: review.forbidden, label: `Must not include “${review.forbidden}”`, evidenceIds: [evidence.id], deterministic: true },
        { id: "AS-2", type: "required_concept", value: review.required, label: `Must include “${review.required}”`, evidenceIds: [evidence.id], deterministic: true },
        { id: "AS-3", type: "semantic_rubric", value: review.expectedBehavior, label: "Meet the reviewer-approved expected behavior", evidenceIds: [evidence.id], deterministic: false },
      ]);
      await api.saveTargets(item.id, {
        brokenResponse: item.observedResponse,
        correctedResponse: review.correctedResponse,
        brokenVersion: review.brokenVersion,
        correctedVersion: review.correctedVersion,
        approvedBy: "Demo reviewer",
      });
      await api.compile(item.id);
      await refresh();
      setTab("evaluation");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Review compilation failed"); }
    finally { setBusy(false); }
  };

  const ownsPrivateIntake = role === "reporter" || role === "admin" || role === "reviewer" || (role === "developer" && item.intakeType === "internal-incident" && Boolean(item.originalTranscript));
  if (!item.privacyApproved && !ownsPrivateIntake) return <section className="review-ready card"><span><Icon name="lock" /></span><div><strong>Privacy review is still in progress.</strong><p>Developers receive only the approved, redacted case—not the reporter’s original evidence.</p></div></section>;

  if (!item.privacyApproved) return <section className="review-workspace card">
    <div className="review-heading"><span className="review-step">REVIEW 1 OF 2</span><div><h2>Approve the privacy-safe case</h2><p>Compare the private original with the version developers will see. Edit the redacted copy before approving it.</p></div><Icon name="lock" /></div>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="redaction-grid"><label><span>PRIVATE IMPACT DESCRIPTION</span><textarea value={item.description} readOnly rows={4} /></label><label><span>SHARED IMPACT DESCRIPTION</span><textarea value={redactedDescription} onChange={(event) => setRedactedDescription(event.target.value)} rows={4} /></label></div>
    <div className="redaction-grid"><label><span>PRIVATE ORIGINAL</span><textarea value={item.originalTranscript} readOnly rows={7} /></label><label><span>SHARED AFTER APPROVAL</span><textarea value={redacted} onChange={(event) => setRedacted(event.target.value)} rows={7} /></label></div>
    <div className="review-footer"><p><Icon name="shield" size={16} />This approval controls developer access. It does not publish the case.</p><button className="button dark" disabled={busy || !redacted.trim()} onClick={approvePrivacy}>{busy ? "Approving…" : "Approve redaction"}<Icon name="arrow" size={15} /></button></div>
  </section>;

  if (!item.evaluation && role !== "reviewer" && role !== "admin") return <section className="review-ready card"><span><Icon name="evidence" /></span><div><strong>Privacy is approved; evidence review is next.</strong><p>An assigned reviewer must approve the source, expected behavior, and assertions before a test can compile.</p></div></section>;

  if (!item.evaluation) {
    const ready = review.sourceTitle.trim() && review.sourceLocator.trim() && review.sourceExcerpt.trim() && review.expectedBehavior.trim() && review.forbidden.trim() && review.required.trim() && review.correctedResponse.trim() && review.audience.trim();
    return <section className="review-workspace card">
      <div className="review-heading"><span className="review-step">REVIEW 2 OF 2</span><div><h2>Design the evidence-backed test</h2><p>Approve the source, define observable checks, and register a corrected response for comparative proof.</p></div><Icon name="evidence" /></div>
      {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
      <div className="review-form-grid">
        <label>Evidence title<input value={review.sourceTitle} onChange={(event) => set("sourceTitle", event.target.value)} placeholder="Policy, dataset, or reviewer-approved requirement" /></label>
        <label>Exact source locator<input value={review.sourceLocator} onChange={(event) => set("sourceLocator", event.target.value)} placeholder="Section 4.2, record ID, or URL fragment" /></label>
        <label className="full">Relevant evidence passage<textarea rows={3} value={review.sourceExcerpt} onChange={(event) => set("sourceExcerpt", event.target.value)} placeholder="Paste only the passage that establishes expected behavior." /></label>
        <label className="full">Reviewer-approved expected behavior<textarea rows={3} value={review.expectedBehavior} onChange={(event) => set("expectedBehavior", event.target.value)} placeholder="Describe the evidence-supported rule, not a candidate answer." /><small>Write a general requirement that could grade more than one valid response.</small></label>
        <label>Forbidden phrase or entity<input value={review.forbidden} onChange={(event) => set("forbidden", event.target.value)} placeholder="A value the broken response contains" /></label>
        <label>Required phrase or concept<input value={review.required} onChange={(event) => set("required", event.target.value)} placeholder="A value the corrected response must contain" /></label>
        <label>Broken version<input value={review.brokenVersion} onChange={(event) => set("brokenVersion", event.target.value)} /></label>
        <label>Corrected version<input value={review.correctedVersion} onChange={(event) => set("correctedVersion", event.target.value)} /></label>
        <label className="full">Recorded corrected response<textarea rows={4} value={review.correctedResponse} onChange={(event) => set("correctedResponse", event.target.value)} placeholder={`Write a response that includes “${review.required || "the required concept"}” and avoids the forbidden behavior.`} /><small>This is a concrete candidate output. It must be distinct from the expected-behavior rule.</small></label>
        <label className="full">Affected audience<input value={review.audience} onChange={(event) => set("audience", event.target.value)} placeholder="Who could encounter or be harmed by this failure?" /></label>
        <label>Failure category<select value={review.category} onChange={(event) => set("category", event.target.value)}><option>Other reviewer-defined failure</option><option>Factual inaccuracy</option><option>Accessibility failure</option><option>Unsafe recommendation</option><option>Citation failure</option><option>Privacy disclosure</option><option>Incorrect tool selection</option></select></label>
        <label>Severity<select value={review.severity} onChange={(event) => set("severity", event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
      </div>
      <div className="review-footer"><p><Icon name="shield" size={16} />Assertions cannot compile unless they cite this approved evidence.</p><button className="button dark" disabled={busy || !ready} onClick={compileReviewedCase}>{busy ? "Compiling…" : "Approve and compile test"}<Icon name="sparkle" size={15} /></button></div>
    </section>;
  }

  return <section className="review-ready card"><span><Icon name="check" /></span><div><strong>The reviewed test is ready for recorded-response validation.</strong><p>The evaluation becomes verified only when the recorded broken response fails and the recorded correction passes. This does not verify a deployed system.</p></div><button className="button dark" onClick={() => setTab("validation")}>Open validation <Icon name="arrow" size={15} /></button></section>;
}

export function Overview({ item, setTab }: { item: RedressCase; setTab: (tab: CaseTab) => void }) {
  const state = getCaseOverviewState(item);
  const resultSummary = (run: EvaluationRun) => ({
    label: run.state === "pass" ? "PASSED" : run.state === "fail" ? "FAILED" : "INCONCLUSIVE",
    icon: run.state === "pass" ? "check" : run.state === "fail" ? "close" : "alert",
  });
  return <div className="two-column">
    <div className="content-stack">
      <section className="card story-card"><div className="card-label"><Icon name="user" size={16} /> THE REPORTED EXPERIENCE</div><blockquote>“{item.userInput}”</blockquote><div className="observed"><span>AI RESPONSE</span><p>{item.observedResponse}</p></div><div className="impact"><strong>Why this matters</strong><p>{item.description} This can prevent someone from reaching a safe public service.</p></div></section>
      <section className="card"><div className="card-top"><div><span className="card-kicker">EXPECTED BEHAVIOR</span><h3>What should happen instead</h3></div><StatusPill state={state.expectedBehaviorApproved ? "verified" : "private"}>{state.expectedBehaviorApproved ? "Evidence-backed" : "Pending review"}</StatusPill></div><p className="large-copy">{item.expectedBehavior || "A reviewer has not defined the expected behavior yet."}</p>{state.approvedEvidenceCount > 0 ? <button className="text-link" onClick={() => setTab("evidence")}>View supporting evidence <Icon name="arrow" size={15} /></button> : <p className="state-guidance">Supporting evidence has not been approved yet.</p>}</section>
      <section className="card privacy-card"><div className="privacy-icon"><Icon name="lock" /></div><div><h3>{state.privacyApproved ? "Privacy review approved" : "Privacy review pending"}</h3><p>{state.privacyApproved ? `${item.redactions.length} personal references removed. ${item.evaluation ? "The generated evaluation excludes original identity data." : "The privacy-safe case is ready for evidence review."}` : "Original evidence remains restricted until the proposed redaction is explicitly approved."}</p></div><StatusPill state={state.privacyApproved ? "verified" : "private"}>{state.privacyApproved ? "Approved" : "Pending"}</StatusPill></section>
    </div>
    <aside className="content-stack">
      <section className="card details-card"><h3>Case details</h3><dl><div><dt>Product</dt><dd>{item.product}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div><div><dt>Severity</dt><dd><StatusPill state={item.severity}>{item.severity}</StatusPill></dd></div><div><dt>Affected audience</dt><dd>{item.audience}</dd></div><div><dt>Consent</dt><dd>{item.consent}</dd></div></dl></section>
      <section className="card gate-mini"><div className="card-label"><Icon name="flask" size={16} /> VERIFICATION GATE</div>{state.validation ? <><div className={`mini-result ${state.validation.broken.state}`}><span>Recorded broken · {state.validation.broken.targetVersion}</span><strong>{resultSummary(state.validation.broken).label} <Icon name={resultSummary(state.validation.broken).icon} size={15} /></strong></div><div className="gate-line"><span /><Icon name="arrow" size={16} /><span /></div><div className={`mini-result ${state.validation.fixed.state}`}><span>Recorded correction · {state.validation.fixed.targetVersion}</span><strong>{resultSummary(state.validation.fixed).label} <Icon name={resultSummary(state.validation.fixed).icon} size={15} /></strong></div><p><Icon name="shield" size={16} />{state.validation.verified ? "The recorded broken response failed and the recorded correction passed this evaluation." : "This recorded-response comparison has not satisfied the verification gate."}</p></> : <div className="gate-pending"><Icon name="flask" size={22} /><strong>{item.evaluation ? "Validation has not run" : "Evaluation not generated"}</strong><span>{item.evaluation ? "Run both approved recorded targets to produce comparative proof." : "Complete privacy and evidence review before generating a test."}</span></div>}<button className="button wide" disabled={!item.evaluation} onClick={() => setTab("validation")}>{item.evaluation ? "Inspect validation" : "Complete review first"}</button></section>
    </aside>
  </div>;
}

function EvidenceView({ item }: { item: RedressCase }) {
  const approved = item.evidence.filter((evidence) => evidence.status === "approved");
  return <div className="content-narrow"><div className="view-title"><div><span className="eyebrow"><span /> EVIDENCE SOURCES</span><h2>Evidence before assertion.</h2><p>Every approved expectation and check points back to a reviewed source.</p></div><StatusPill state={approved.length ? "verified" : "private"}>{approved.length} approved</StatusPill></div>
    {item.evidence.map((evidence, index) => <section className="card evidence-card" key={evidence.id}><div className="evidence-number">{String(index + 1).padStart(2, "0")}</div><div className="evidence-body"><div className="card-top"><div><span className="card-kicker">{evidence.type}</span><h3>{evidence.title}</h3></div><StatusPill state={evidence.status === "approved" ? "verified" : "private"}>{titleCase(evidence.status)}</StatusPill></div><code>{evidence.locator}</code><blockquote>{evidence.excerpt}</blockquote><div className="evidence-meta"><span>Source role: <strong>{titleCase(evidence.authority)}</strong></span><span>Retrieved {formatDate(evidence.retrievalDate)}</span><span>{evidence.id}</span></div></div></section>)}
    {!item.evidence.length && <EmptyState title="No evidence submitted for review" />}
    <div className="principle"><Icon name="shield" /><p><strong>Generated summaries never replace evidence.</strong><br />If a source changes, every dependent evaluation is flagged for human review.</p></div>
  </div>;
}

function EvaluationView({ item, setTab }: { item: RedressCase; setTab: (tab: CaseTab) => void }) {
  const evaluation = item.evaluation;
  if (!evaluation) return <EmptyState title="No evaluation generated" />;
  return <div className="two-column evaluation-layout"><div className="content-stack"><div className="view-title compact"><div><span className="eyebrow"><span /> PORTABLE REGRESSION TEST</span><h2>{evaluation.title}</h2><p>{evaluation.summary}</p></div></div><section className="card assertions"><div className="card-top"><h3>Assertions</h3><span className="muted">{evaluation.assertions.length} checks · {evaluation.assertions.filter((a) => a.deterministic).length} deterministic</span></div>{evaluation.assertions.map((assertion) => <div className="assertion" key={assertion.id}><span className={`check-type ${assertion.deterministic ? "deterministic" : "semantic"}`}><Icon name={assertion.deterministic ? "code" : "sparkle"} size={16} /></span><div><strong>{assertion.label}</strong><small>{titleCase(assertion.type)} · cites {assertion.evidenceIds.join(", ")}</small></div><span className="method">{assertion.deterministic ? "Rule" : "GPT-5.6"}</span></div>)}</section><button className="button dark inline-button" onClick={() => setTab("validation")}>Run broken vs. fixed <Icon name="arrow" size={16} /></button></div><aside className="card code-panel"><div className="code-head"><span><i /> <i /> <i /></span><strong>{evaluation.id}.json</strong><a href={`/api/cases/${item.id}/export`} download><Icon name="download" size={16} /> Export</a></div><pre>{JSON.stringify({ id: evaluation.id, version: evaluation.version, severity: evaluation.severity, input: evaluation.input, context: evaluation.context, assertions: evaluation.assertions.map(({ type, value, evidenceIds }) => ({ type, value, evidence: evidenceIds })), grader: evaluation.grader }, null, 2)}</pre></aside></div>;
}

function ResultColumn({ title, version, run, expected }: { title: string; version: string; run: EvaluationRun; expected: ResultState }) {
  const latency = run.latencyMs >= 1000 ? `${(run.latencyMs / 1000).toFixed(2)} s` : `${run.latencyMs} ms`;
  return <section className={`result-column ${run.state}`}><div className="result-head"><div><span>{title}</span><strong>{version}</strong></div><StatusPill state={run.state}>{run.state === expected ? (run.state === "fail" ? "Failed as expected" : "Passed") : run.state}</StatusPill></div><div className="response-box"><span>RECORDED RESPONSE</span><p>{run.response}</p></div><div className="checks">{run.assertionResults.map((result: AssertionResult) => <div key={result.assertionId}><span className={`result-icon ${result.state}`}><Icon name={result.state === "pass" ? "check" : result.state === "fail" ? "close" : "alert"} size={14} /></span><div><strong>{result.label}</strong><small>{result.explanation}</small></div><em>{result.evidenceIds.join(", ")}</em></div>)}</div><footer className="run-metrics"><span><small>Latency</small><strong>{latency}</strong></span><span><small>Assertions passed</small><strong>{Math.round(run.score * 100)}%</strong></span><span><small>Grader policy</small><strong title={run.promptVersion}>{run.promptVersion}</strong></span></footer></section>;
}

export function ValidationView({ item, runs, onRun, running }: { item: RedressCase; runs: { broken: EvaluationRun; fixed: EvaluationRun } | null; onRun: () => void; running: boolean }) {
  const stored = useMemo(() => getCaseOverviewState(item).validation, [item]);
  const available = runs || (stored ? { broken: stored.broken, fixed: stored.fixed } : null);
  const passed = available?.broken.state === "fail" && available.fixed.state === "pass";
  const sharingCopy = isPrivateConsent(item.consent)
    ? "Technical verification is complete. This case remains private under its current consent scope."
    : "Technical verification is complete. Any sharing remains limited to the approved consent scope and publication review.";
  return <div><div className="validation-title"><div><span className="eyebrow"><span /> RECORDED-RESPONSE PROOF</span><h2>The test must catch the failure<br />and recognize the correction.</h2><p>This gate compares reviewer-approved recorded responses; it does not call a deployed system.</p></div><button className="button dark" onClick={onRun} disabled={running || !item.evaluation}><Icon name="refresh" size={17} className={running ? "spin" : ""} />{running ? "Running both targets…" : item.evaluation ? available ? "Re-run validation" : "Run validation gate" : "Generate evaluation first"}</button></div>
    {available ? <><div className="result-grid"><ResultColumn title="RECORDED BROKEN RESPONSE" version={available.broken.targetVersion} run={available.broken} expected="fail" /><ResultColumn title="RECORDED CORRECTED RESPONSE" version={available.fixed.targetVersion} run={available.fixed} expected="pass" /></div>{passed ? <div className="gate-success"><span className="success-seal"><Icon name="shield" size={29} /></span><div><span>VALIDATION GATE PASSED · RECORDED TARGETS</span><h3>This evaluation distinguishes the recorded broken and corrected responses.</h3><p>{sharingCopy}</p></div><StatusPill state="verified">Evaluation verified</StatusPill></div> : <div className="gate-warning"><Icon name="alert" size={24} /><div><strong>Validation gate not satisfied</strong><p>The recorded broken response must fail and the recorded correction must pass before the evaluation is verified.</p></div><StatusPill state="private">Review</StatusPill></div>}</> : <EmptyState title={item.evaluation ? "Run the comparison to generate proof" : "Generate an evaluation before validation"} />}
  </div>;
}

function TimelineView({ item }: { item: RedressCase }) {
  return <div className="content-narrow"><div className="view-title"><div><span className="eyebrow"><span /> VISIBLE CLOSURE</span><h2>From report to verified evaluation.</h2><p>A reporter-safe record of what happened, what was reviewed, and what was proven.</p></div></div><div className="timeline">{item.timeline.map((event, index) => <div className="timeline-item" key={event.id}><div className="timeline-rail"><span className={event.complete ? "complete" : ""}>{event.complete ? <Icon name="check" size={14} /> : index + 1}</span></div><div className="timeline-card"><div><strong>{event.label}</strong><time>{formatDate(event.createdAt, true)}</time></div><p>{event.detail}</p><small>{event.actor}</small></div></div>)}</div></div>;
}

function CIView({ item }: { item: RedressCase }) {
  const [copied, setCopied] = useState(false);
  const workflow = `name: RedressCI regression pack\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  evaluate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: npm ci\n      - run: npm run test:ci\n      - uses: actions/upload-artifact@v4\n        if: always()\n        with:\n          name: redressci-results\n          path: results/*.json`;
  const copy = async () => { await navigator.clipboard.writeText(workflow); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="two-column ci-layout"><div className="content-stack"><div className="view-title compact"><div><span className="eyebrow"><span /> PERMANENT PROTECTION</span><h2>Ship the test with the fix.</h2><p>The portable runner returns a non-zero exit code when this failure returns.</p></div></div><section className="card install-steps"><h3>Run anywhere Node.js runs</h3><ol><li><span>1</span><div><strong>Download the evaluation</strong><p>No original artifacts, names, or secrets are included.</p></div></li><li><span>2</span><div><strong>Add the workflow</strong><p>Commit the generated GitHub Actions file.</p></div></li><li><span>3</span><div><strong>Protect your release</strong><p>A failed assertion blocks CI and writes a JSON result.</p></div></li></ol><a className="button dark wide" href={`/api/cases/${item.id}/export`} download><Icon name="download" size={17} />Download evaluation JSON</a><a className="button receipt-button wide" href={`/api/cases/${item.id}/receipt`} download><Icon name="shield" size={17} />Download Redress Receipt</a></section><div className="principle"><Icon name="shield" /><p><strong>Vendor-neutral by design.</strong><br />The case format can target an HTTP endpoint, recorded response, or local adapter.</p></div></div><section className="card code-panel workflow"><div className="code-head"><strong>.github/workflows/redressci.yml</strong><button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button></div><pre>{workflow}</pre></section></div>;
}

function ReportPage({ onCancel, onCreated, role, aiConfigured }: { onCancel: () => void; onCreated: (item: RedressCase) => void; role: WorkspaceRole; aiConfigured: boolean }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [artifact, setArtifact] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const internal = role === "developer";
  const [form, setForm] = useState({ reporterName: "", product: "", originalTranscript: "", description: "", expectedBehavior: "", consent: internal ? "Private workspace incident" : "Private to reporter" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const artifactCanSupplyTranscript = artifact?.type === "text/plain" || Boolean(artifact?.type.startsWith("image/") && aiConfigured);
  const canContinue = step === 1 ? Boolean(form.product.trim() && (form.originalTranscript.trim() || artifactCanSupplyTranscript)) : step === 2 ? Boolean(form.description.trim()) : acknowledged;
  const chooseArtifact = (file: File | null) => { setError(""); if (file && file.size > 8 * 1024 * 1024) { setArtifact(null); setError("The attachment is larger than 8 MB. Choose a smaller file."); return; } setArtifact(file); };
  const submit = async () => { setBusy(true); setError(""); try { const { case: item } = await api.createCase({ ...form, intakeType: internal ? "internal-incident" : "affected-person", title: form.description.slice(0, 70) || (internal ? "Internal AI incident" : "Reported AI failure") }); if (artifact) { const uploaded = await api.uploadArtifact(item.id, artifact) as { artifact: { id: string } }; if (artifact.type === "text/plain" || artifact.type.startsWith("image/")) await api.extract(item.id, { transcript: form.originalTranscript, artifactId: uploaded.artifact.id }); } await api.redact(item.id, form.originalTranscript, false); onCreated((await api.case(item.id)).case); } catch (reason) { setError(reason instanceof Error ? reason.message : "The report could not be submitted. Please try again."); } finally { setBusy(false); } };
  return <div className="report-page"><header><Logo /><button className="icon-button" onClick={onCancel} aria-label="Close"><Icon name="close" /></button></header><div className="report-shell"><aside><span className="eyebrow"><span /> {internal ? "REPORT AN INTERNAL INCIDENT" : "REPORT AN AI FAILURE"}</span><h1>{internal ? "Turn a discovered failure into a durable test." : "Your experience can protect the next person."}</h1><p>{internal ? "Record a QA, production, or monitoring failure without entering another person’s private report." : "You don’t need to know how software testing works. Tell us what happened; we’ll help structure it safely."}</p><div className="steps">{["What happened", "Impact & expectation", internal ? "Privacy acknowledgment" : "Privacy & consent"].map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><span>{step > index + 1 ? <Icon name="check" size={14} /> : index + 1}</span><strong>{label}</strong></div>)}</div><div className="privacy-promise"><Icon name="lock" /><p><strong>Private until approved.</strong><br />Original evidence is separated from the anonymized case.</p></div></aside><section className="report-form card">
    {step === 1 && <><span className="step-label">STEP 1 OF 3</span><h2>What happened?</h2><p>Paste the interaction exactly as observed. Text files are parsed locally; screenshots use live AI when configured.</p>{!internal && <label>Your name or alias <small>Optional · removed from shared tests</small><input value={form.reporterName} onChange={(e) => set("reporterName", e.target.value)} placeholder="e.g. Maya Chen" /></label>}<label>AI product or system <small>Required</small><input value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="e.g. City services chatbot" required /></label><label>Conversation transcript <small>Required unless using text or extractable image evidence</small><textarea rows={7} value={form.originalTranscript} onChange={(e) => set("originalTranscript", e.target.value)} placeholder={'You: What did you ask?\nAI: What did it answer?'} /></label><label className="upload-drop"><Icon name="upload" /><div><strong>{artifact ? artifact.name : "Attach private evidence"}</strong><small>{artifact ? `${Math.ceil(artifact.size / 1024)} KB · encrypted at rest` : "PNG, JPG, WebP, PDF, or text · 8 MB max"}</small></div><span>{artifact ? "Replace" : "Choose file"}</span><input className="file-input" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={(event) => chooseArtifact(event.target.files?.[0] || null)} /></label>{artifact?.type === "application/pdf" && !form.originalTranscript.trim() && <div className="field-guidance">PDF is stored as supporting evidence; paste the conversation transcript above.</div>}{artifact?.type.startsWith("image/") && !aiConfigured && !form.originalTranscript.trim() && <div className="field-guidance">Screenshot extraction is unavailable until live AI is configured; paste the transcript above.</div>}</>}
    {step === 2 && <><span className="step-label">STEP 2 OF 3</span><h2>Why did this response fail?</h2><p>Describe the effect in your own words. A reviewer will link any external claims to evidence.</p><label>What went wrong?<textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was inaccurate, inaccessible, unsafe, or misleading?" /></label><label>What should have happened? <small>Optional</small><textarea rows={5} value={form.expectedBehavior} onChange={(e) => set("expectedBehavior", e.target.value)} placeholder="Describe the outcome you expected." /></label><div className="tip"><Icon name="sparkle" /><p>GPT-5.6 can propose a structured incident and surface unanswered questions, but a human reviewer approves the expected behavior.</p></div></>}
    {step === 3 && <><span className="step-label">STEP 3 OF 3</span><h2>{internal ? "Confirm the privacy boundary." : "Choose how this can be shared."}</h2><p>{internal ? "This internal incident stays in the workspace and does not grant access to community reporters’ original evidence." : "Your original submission always stays separate from the anonymized evaluation."}</p>{!internal && <div className="consent-options">{["Private to reporter", "Shared with responsible organization", "Anonymized research use", "Anonymized public evaluation use"].map((option) => <label className={form.consent === option ? "selected" : ""} key={option}><input type="radio" name="consent" checked={form.consent === option} onChange={() => set("consent", option)} /><span><strong>{option}</strong><small>{option === "Private to reporter" ? "Only you and assigned reviewers can access it." : "Personal details are removed and a reviewer must approve sharing."}</small></span></label>)}</div>}<label className="approval-check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>{internal ? "I confirm this report contains only evidence I am authorized to submit and will complete privacy review before wider use." : "I understand this report starts private and that I can withdraw consent before public publication."}</span></label></>}
    {error && <div className="form-error"><Icon name="alert" size={16} />{error}</div>}
    <footer><button className="button quiet" onClick={step === 1 ? onCancel : () => { setError(""); setStep(step - 1); }}>{step === 1 ? "Cancel" : "Back"}</button><button className="button dark" disabled={busy || !canContinue} onClick={step === 3 ? submit : () => { setError(""); setStep(step + 1); }}>{busy ? "Creating private case…" : step === 3 ? "Submit private report" : "Continue"}<Icon name="arrow" size={16} /></button></footer>
  </section></div></div>;
}

function EmptyState({ title }: { title: string }) { return <div className="empty-state"><Icon name="flask" size={30} /><h3>{title}</h3><p>Complete the previous review step to continue.</p></div>; }

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.pathname));
  const [cases, setCases] = useState<RedressCase[]>([]);
  const [selected, setSelected] = useState<RedressCase | null>(null);
  const [ai, setAi] = useState(false);
  const [platform, setPlatform] = useState<PlatformDashboard | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("admin");
  const [roleBusy, setRoleBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const page = route.page;
  const navigate = (next: AppRoute, replace = false) => {
    const path = routePath(next);
    if (path !== window.location.pathname) window.history[replace ? "replaceState" : "pushState"]({ redressci: true }, "", path);
    setRoute(next);
    window.scrollTo(0, 0);
  };
  const navigatePage = (nextPage: Page) => navigate({ page: nextPage });
  const load = async (activeRole: WorkspaceRole = role, activeRoute: AppRoute = route) => {
    const platformRequest = activeRole === "reporter" ? Promise.resolve(null) : api.platform().then((payload) => payload.platform);
    const [{ cases: loadedCases }, health, activePlatform] = await Promise.all([api.cases(), api.health(), platformRequest]);
    setCases(loadedCases); setAi(health.ai.configured); setPlatform(activePlatform);
    if (activeRoute.page === "case" && activeRoute.caseId) {
      const matchingCase = loadedCases.find((item) => item.id === activeRoute.caseId);
      setSelected(matchingCase || (await api.case(activeRoute.caseId)).case);
    }
    setLoading(false);
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, []);
  useEffect(() => {
    window.history.replaceState({ redressci: true }, "", routePath(parseRoute(window.location.pathname)));
    const restoreRoute = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);
  useEffect(() => {
    if (loading || route.page !== "case" || !route.caseId || selected?.id === route.caseId) return;
    api.case(route.caseId).then(({ case: item }) => setSelected(item)).catch(() => navigate({ page: "dashboard" }, true));
  }, [loading, route.page, route.caseId, selected?.id]);
  const openCase = async (id: string) => { setSelected((await api.case(id)).case); navigate({ page: "case", caseId: id }); };
  const switchRole = async (nextRole: WorkspaceRole) => {
    setRoleBusy(true);
    try {
      const { token } = await api.demoAuth(nextRole);
      setApiToken(token); setRole(nextRole); setSelected(null); setLoading(true);
      navigate({ page: "dashboard" });
      await load(nextRole, { page: "dashboard" });
    } finally { setRoleBusy(false); }
  };
  const refreshSelected = async () => { if (selected) { const fresh = (await api.case(selected.id)).case; setSelected(fresh); setCases((current) => current.map((item) => item.id === fresh.id ? fresh : item)); } };
  const refreshPlatform = async () => setPlatform((await api.platform()).platform);
  const reset = async () => { const { case: item } = await api.reset(); setCases([item]); setSelected(null); await refreshPlatform(); navigate({ page: "dashboard" }); };
  if (loading) return <div className="loading-screen"><Logo /><span /></div>;
  if (page === "report") return <ReportPage role={role} aiConfigured={ai} onCancel={() => navigate({ page: "dashboard" })} onCreated={(item) => { setCases((current) => [item, ...current]); setSelected(item); navigate({ page: "case", caseId: item.id }); }} />;
  return <Shell page={page} onNavigate={navigatePage} onReport={() => navigate({ page: "report" })} ai={ai} role={role} roleBusy={roleBusy} onRoleChange={switchRole}>
    {page === "dashboard" && <Dashboard cases={cases} onOpen={openCase} onReport={() => navigate({ page: "report" })} onReset={reset} canReport={role === "reporter" || role === "developer" || role === "admin"} canReset={role === "admin"} />}
    {page === "assurance" && <AssurancePage platform={platform} cases={cases} refresh={refreshPlatform} />}
    {page === "case" && selected && <CaseDetail item={selected} onBack={() => navigate({ page: "dashboard" })} refresh={refreshSelected} role={role} />}
  </Shell>;
}
