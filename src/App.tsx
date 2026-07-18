import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import type { AssertionResult, EvaluationRun, RedressCase, ResultState } from "./types";
import type { PlatformDashboard } from "./platform-types";

type Page = "dashboard" | "case" | "report" | "assurance";
type CaseTab = "overview" | "evidence" | "evaluation" | "validation" | "timeline" | "ci";

const formatDate = (date: string, withTime = false) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(date));
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function StatusPill({ state, children }: { state: ResultState | "verified" | "low" | "medium" | "high" | "critical" | "synthetic" | "private"; children?: React.ReactNode }) {
  return <span className={`pill pill-${state}`}>{state === "pass" || state === "verified" ? <Icon name="check" size={13} /> : null}{children || titleCase(state)}</span>;
}

function Logo() {
  return <button className="logo" onClick={() => location.reload()} aria-label="Go to dashboard"><span className="logo-mark"><Icon name="mark" size={21} /></span><span>Redress<span>CI</span></span></button>;
}

function Shell({ children, page, onNavigate, onReport, ai }: { children: React.ReactNode; page: Page; onNavigate: (page: Page) => void; onReport: () => void; ai: boolean }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <nav aria-label="Main navigation">
        <button className={page === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}><Icon name="grid" />Cases</button>
        <button className={page === "assurance" ? "active" : ""} onClick={() => onNavigate("assurance")}><Icon name="shield" />Assurance network</button>
        <button onClick={onReport}><Icon name="plus" />Report a failure</button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="workspace-card">
        <span className="avatar">OP</span>
        <div><strong>Open Public Lab</strong><small>Demo workspace</small></div>
      </div>
      <div className={`ai-status ${ai ? "online" : ""}`}><span />{ai ? "GPT-5.6 connected" : "Synthetic demo mode"}</div>
    </aside>
    <main>{children}</main>
  </div>;
}

function Dashboard({ cases, onOpen, onReport, onReset }: { cases: RedressCase[]; onOpen: (id: string) => void; onReport: () => void; onReset: () => void }) {
  const verified = cases.filter((item) => item.status === "Verified fixed").length;
  return <div className="page dashboard-page">
    <header className="topbar"><div /><div className="top-actions"><button className="icon-button" aria-label="Search"><Icon name="search" /></button><button className="button primary" onClick={onReport}><Icon name="plus" size={17} />Report a failure</button></div></header>
    <section className="hero">
      <div className="eyebrow"><span /> FROM EXPERIENCE TO PROTECTION</div>
      <h1>Turn AI failures into<br /><em>tests that stay fixed.</em></h1>
      <p>RedressCI gives every reported failure a path to evidence, verification, and permanent regression protection.</p>
      <div className="hero-actions"><button className="button dark" onClick={() => cases[0] && onOpen(cases[0].id)}>Explore the verified demo <Icon name="arrow" size={17} /></button><button className="button quiet" onClick={onReset}><Icon name="refresh" size={17} />Reset demo</button></div>
    </section>
    <section className="metrics" aria-label="Case metrics">
      <div><small>OPEN CASES</small><strong>{String(Math.max(cases.length - verified, 0)).padStart(2, "0")}</strong><span>Awaiting action</span></div>
      <div><small>VERIFIED FIXED</small><strong>{String(verified).padStart(2, "0")}</strong><span className="positive">↑ Permanent protection</span></div>
      <div><small>MEDIAN TO REPRODUCE</small><strong>38<sup>m</sup></strong><span>Synthetic workspace</span></div>
      <div className="metric-accent"><small>REGRESSIONS BLOCKED</small><strong>12</strong><span>This evaluation pack</span></div>
    </section>
    <section className="cases-section">
      <div className="section-heading"><div><h2>Cases</h2><p>Every report has a visible path to closure.</p></div><div className="filter-row"><button className="filter active">All <b>{cases.length}</b></button><button className="filter">Needs review</button><button className="filter">Verified</button></div></div>
      <div className="case-table">
        <div className="table-head"><span>CASE</span><span>STATUS</span><span>SEVERITY</span><span>LATEST RUN</span><span>UPDATED</span><span /></div>
        {cases.map((item) => <button className="case-row" onClick={() => onOpen(item.id)} key={item.id}>
          <span className="case-title"><i className="category-icon"><Icon name="shield" size={18} /></i><span><strong>{item.title}</strong><small>{item.id} · {item.product}</small></span></span>
          <span><StatusPill state={item.status === "Verified fixed" ? "verified" : "private"}>{item.status}</StatusPill></span>
          <span><StatusPill state={item.severity}>{item.severity}</StatusPill></span>
          <span className="run-cell"><i className="pass-dot" />{item.runs[0]?.state === "pass" || item.status === "Verified fixed" ? "Passed on fixed" : "Not run"}</span>
          <span className="date-cell">{formatDate(item.updatedAt)}</span>
          <span><Icon name="chevron" size={18} /></span>
        </button>)}
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

function CaseDetail({ item, onBack, refresh }: { item: RedressCase; onBack: () => void; refresh: () => Promise<void> }) {
  const [tab, setTab] = useState<CaseTab>("overview");
  const [running, setRunning] = useState(false);
  const [freshRuns, setFreshRuns] = useState<{ broken: EvaluationRun; fixed: EvaluationRun } | null>(null);
  const [notice, setNotice] = useState("");
  const validate = async () => {
    setRunning(true); setNotice("");
    try { const result = await api.validate(item.id); setFreshRuns({ broken: result.broken, fixed: result.fixed }); setNotice(result.verified ? "Validation gate passed. The fix is independently verified." : "The targets were not distinguished."); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Validation failed"); }
    finally { setRunning(false); }
  };
  return <div className="page case-page">
    <header className="case-header">
      <button className="back-link" onClick={onBack}>Cases <Icon name="chevron" size={14} /> <span>{item.id}</span></button>
      <div className="case-head-row"><div><div className="title-meta">{item.synthetic ? <StatusPill state="synthetic">Synthetic demonstration</StatusPill> : <StatusPill state="private">Private report</StatusPill>}<span>Updated {formatDate(item.updatedAt, true)}</span></div><h1>{item.title}</h1><p>{item.description}</p></div><StatusPill state={item.status === "Verified fixed" ? "verified" : "private"}>{item.status}</StatusPill></div>
      <div className="tabbar" role="tablist">{tabs.map((entry) => <button role="tab" aria-selected={tab === entry.id} className={tab === entry.id ? "active" : ""} onClick={() => setTab(entry.id)} key={entry.id}><Icon name={entry.icon} size={17} />{entry.label}</button>)}</div>
    </header>
    <div className="case-content">
      {notice && <div className="notice"><Icon name="check" size={17} />{notice}</div>}
      {!item.synthetic && item.status !== "Verified fixed" && <ReviewWorkspace item={item} refresh={refresh} setTab={setTab} />}
      {tab === "overview" && <Overview item={item} setTab={setTab} />}
      {tab === "evidence" && <EvidenceView item={item} />}
      {tab === "evaluation" && <EvaluationView item={item} setTab={setTab} />}
      {tab === "validation" && <ValidationView item={item} runs={freshRuns} onRun={validate} running={running} />}
      {tab === "timeline" && <TimelineView item={item} />}
      {tab === "ci" && <CIView item={item} />}
    </div>
  </div>;
}

function ReviewWorkspace({ item, refresh, setTab }: { item: RedressCase; refresh: () => Promise<void>; setTab: (tab: CaseTab) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [redacted, setRedacted] = useState(item.redactedTranscript);
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
    try { await api.redact(item.id, item.originalTranscript, true, item.reporterName || "Reporter", redacted); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Privacy approval failed"); }
    finally { setBusy(false); }
  };

  const compileReviewedCase = async () => {
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

  if (!item.privacyApproved) return <section className="review-workspace card">
    <div className="review-heading"><span className="review-step">REVIEW 1 OF 2</span><div><h2>Approve the privacy-safe case</h2><p>Compare the private original with the version developers will see. Edit the redacted copy before approving it.</p></div><Icon name="lock" /></div>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="redaction-grid"><label><span>PRIVATE ORIGINAL</span><textarea value={item.originalTranscript} readOnly rows={7} /></label><label><span>SHARED AFTER APPROVAL</span><textarea value={redacted} onChange={(event) => setRedacted(event.target.value)} rows={7} /></label></div>
    <div className="review-footer"><p><Icon name="shield" size={16} />This approval controls developer access. It does not publish the case.</p><button className="button dark" disabled={busy || !redacted.trim()} onClick={approvePrivacy}>{busy ? "Approving…" : "Approve redaction"}<Icon name="arrow" size={15} /></button></div>
  </section>;

  if (!item.evaluation) {
    const ready = review.sourceTitle.trim() && review.sourceLocator.trim() && review.sourceExcerpt.trim() && review.expectedBehavior.trim() && review.forbidden.trim() && review.required.trim() && review.correctedResponse.trim();
    return <section className="review-workspace card">
      <div className="review-heading"><span className="review-step">REVIEW 2 OF 2</span><div><h2>Design the evidence-backed test</h2><p>Approve the source, define observable checks, and register a corrected response for comparative proof.</p></div><Icon name="evidence" /></div>
      {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
      <div className="review-form-grid">
        <label>Evidence title<input value={review.sourceTitle} onChange={(event) => set("sourceTitle", event.target.value)} placeholder="Policy, dataset, or reviewer-approved requirement" /></label>
        <label>Exact source locator<input value={review.sourceLocator} onChange={(event) => set("sourceLocator", event.target.value)} placeholder="Section 4.2, record ID, or URL fragment" /></label>
        <label className="full">Relevant evidence passage<textarea rows={3} value={review.sourceExcerpt} onChange={(event) => set("sourceExcerpt", event.target.value)} placeholder="Paste only the passage that establishes expected behavior." /></label>
        <label className="full">Reviewer-approved expected behavior<textarea rows={3} value={review.expectedBehavior} onChange={(event) => set("expectedBehavior", event.target.value)} placeholder="Describe the evidence-supported outcome." /></label>
        <label>Forbidden phrase or entity<input value={review.forbidden} onChange={(event) => set("forbidden", event.target.value)} placeholder="A value the broken response contains" /></label>
        <label>Required phrase or concept<input value={review.required} onChange={(event) => set("required", event.target.value)} placeholder="A value the corrected response must contain" /></label>
        <label>Broken version<input value={review.brokenVersion} onChange={(event) => set("brokenVersion", event.target.value)} /></label>
        <label>Corrected version<input value={review.correctedVersion} onChange={(event) => set("correctedVersion", event.target.value)} /></label>
        <label className="full">Recorded corrected response<textarea rows={4} value={review.correctedResponse} onChange={(event) => set("correctedResponse", event.target.value)} placeholder={`Write a response that includes “${review.required || "the required concept"}” and avoids the forbidden behavior.`} /></label>
        <label>Failure category<select value={review.category} onChange={(event) => set("category", event.target.value)}><option>Other reviewer-defined failure</option><option>Factual inaccuracy</option><option>Accessibility failure</option><option>Unsafe recommendation</option><option>Citation failure</option><option>Privacy disclosure</option><option>Incorrect tool selection</option></select></label>
        <label>Severity<select value={review.severity} onChange={(event) => set("severity", event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
      </div>
      <div className="review-footer"><p><Icon name="shield" size={16} />Assertions cannot compile unless they cite this approved evidence.</p><button className="button dark" disabled={busy || !ready} onClick={compileReviewedCase}>{busy ? "Compiling…" : "Approve and compile test"}<Icon name="sparkle" size={15} /></button></div>
    </section>;
  }

  return <section className="review-ready card"><span><Icon name="check" /></span><div><strong>The reviewed test is ready for comparative validation.</strong><p>Run it against both recorded versions. Verified status remains blocked until the broken response fails and the corrected response passes.</p></div><button className="button dark" onClick={() => setTab("validation")}>Open validation <Icon name="arrow" size={15} /></button></section>;
}

function Overview({ item, setTab }: { item: RedressCase; setTab: (tab: CaseTab) => void }) {
  return <div className="two-column">
    <div className="content-stack">
      <section className="card story-card"><div className="card-label"><Icon name="user" size={16} /> THE REPORTED EXPERIENCE</div><blockquote>“{item.userInput}”</blockquote><div className="observed"><span>AI RESPONSE</span><p>{item.observedResponse}</p></div><div className="impact"><strong>Why this matters</strong><p>{item.description} This can prevent someone from reaching a safe public service.</p></div></section>
      <section className="card"><div className="card-top"><div><span className="card-kicker">EXPECTED BEHAVIOR</span><h3>What should happen instead</h3></div><StatusPill state="verified">Evidence-backed</StatusPill></div><p className="large-copy">{item.expectedBehavior}</p><button className="text-link" onClick={() => setTab("evidence")}>View supporting evidence <Icon name="arrow" size={15} /></button></section>
      <section className="card privacy-card"><div className="privacy-icon"><Icon name="lock" /></div><div><h3>Privacy review approved</h3><p>{item.redactions.length} personal references removed. The generated evaluation contains no original identity data.</p></div><StatusPill state="verified">Approved</StatusPill></section>
    </div>
    <aside className="content-stack">
      <section className="card details-card"><h3>Case details</h3><dl><div><dt>Product</dt><dd>{item.product}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div><div><dt>Severity</dt><dd><StatusPill state={item.severity}>{item.severity}</StatusPill></dd></div><div><dt>Affected audience</dt><dd>{item.audience}</dd></div><div><dt>Consent</dt><dd>{item.consent}</dd></div></dl></section>
      <section className="card gate-mini"><div className="card-label"><Icon name="flask" size={16} /> VERIFICATION GATE</div><div className="mini-result fail"><span>Known-broken · v1.3</span><strong>FAILED <Icon name="close" size={15} /></strong></div><div className="gate-line"><span /><Icon name="arrow" size={16} /><span /></div><div className="mini-result pass"><span>Corrected · v1.4</span><strong>PASSED <Icon name="check" size={15} /></strong></div><p><Icon name="shield" size={16} /> Both outcomes are required for a verified badge.</p><button className="button wide" onClick={() => setTab("validation")}>Inspect validation</button></section>
    </aside>
  </div>;
}

function EvidenceView({ item }: { item: RedressCase }) {
  return <div className="content-narrow"><div className="view-title"><div><span className="eyebrow"><span /> REVIEWED SOURCES</span><h2>Evidence before assertion.</h2><p>Every expected behavior and check points back to an approved source.</p></div><StatusPill state="verified">{item.evidence.length} approved</StatusPill></div>
    {item.evidence.map((evidence, index) => <section className="card evidence-card" key={evidence.id}><div className="evidence-number">{String(index + 1).padStart(2, "0")}</div><div className="evidence-body"><div className="card-top"><div><span className="card-kicker">{evidence.type}</span><h3>{evidence.title}</h3></div><StatusPill state="verified">Approved</StatusPill></div><code>{evidence.locator}</code><blockquote>{evidence.excerpt}</blockquote><div className="evidence-meta"><span>Source role: <strong>{titleCase(evidence.authority)}</strong></span><span>Retrieved {formatDate(evidence.retrievalDate)}</span><span>{evidence.id}</span></div></div></section>)}
    <div className="principle"><Icon name="shield" /><p><strong>Generated summaries never replace evidence.</strong><br />If a source changes, every dependent evaluation is flagged for human review.</p></div>
  </div>;
}

function EvaluationView({ item, setTab }: { item: RedressCase; setTab: (tab: CaseTab) => void }) {
  const evaluation = item.evaluation;
  if (!evaluation) return <EmptyState title="No evaluation generated" />;
  return <div className="two-column evaluation-layout"><div className="content-stack"><div className="view-title compact"><div><span className="eyebrow"><span /> PORTABLE REGRESSION TEST</span><h2>{evaluation.title}</h2><p>{evaluation.summary}</p></div></div><section className="card assertions"><div className="card-top"><h3>Assertions</h3><span className="muted">{evaluation.assertions.length} checks · {evaluation.assertions.filter((a) => a.deterministic).length} deterministic</span></div>{evaluation.assertions.map((assertion) => <div className="assertion" key={assertion.id}><span className={`check-type ${assertion.deterministic ? "deterministic" : "semantic"}`}><Icon name={assertion.deterministic ? "code" : "sparkle"} size={16} /></span><div><strong>{assertion.label}</strong><small>{titleCase(assertion.type)} · cites {assertion.evidenceIds.join(", ")}</small></div><span className="method">{assertion.deterministic ? "Rule" : "GPT-5.6"}</span></div>)}</section><button className="button dark inline-button" onClick={() => setTab("validation")}>Run broken vs. fixed <Icon name="arrow" size={16} /></button></div><aside className="card code-panel"><div className="code-head"><span><i /> <i /> <i /></span><strong>{evaluation.id}.json</strong><a href={`/api/cases/${item.id}/export`} download><Icon name="download" size={16} /> Export</a></div><pre>{JSON.stringify({ id: evaluation.id, version: evaluation.version, severity: evaluation.severity, input: evaluation.input, context: evaluation.context, assertions: evaluation.assertions.map(({ type, value, evidenceIds }) => ({ type, value, evidence: evidenceIds })), grader: evaluation.grader }, null, 2)}</pre></aside></div>;
}

function ResultColumn({ title, version, run, expected }: { title: string; version: string; run: EvaluationRun; expected: ResultState }) {
  return <section className={`result-column ${run.state}`}><div className="result-head"><div><span>{title}</span><strong>{version}</strong></div><StatusPill state={run.state}>{run.state === expected ? (run.state === "fail" ? "Failed as expected" : "Passed") : run.state}</StatusPill></div><div className="response-box"><span>TARGET RESPONSE</span><p>{run.response}</p></div><div className="checks">{run.assertionResults.map((result: AssertionResult) => <div key={result.assertionId}><span className={`result-icon ${result.state}`}><Icon name={result.state === "pass" ? "check" : result.state === "fail" ? "close" : "alert"} size={14} /></span><div><strong>{result.label}</strong><small>{result.explanation}</small></div><em>{result.evidenceIds.join(", ")}</em></div>)}</div><footer><span>{run.latencyMs} ms</span><span>{Math.round(run.score * 100)}% score</span><span>{run.promptVersion}</span></footer></section>;
}

function ValidationView({ item, runs, onRun, running }: { item: RedressCase; runs: { broken: EvaluationRun; fixed: EvaluationRun } | null; onRun: () => void; running: boolean }) {
  const available = runs || useMemo(() => {
    const broken = item.runs.find((run) => run.target === "broken"); const fixed = item.runs.find((run) => run.target === "fixed");
    return broken && fixed ? { broken, fixed } : null;
  }, [item.runs, runs]);
  return <div><div className="validation-title"><div><span className="eyebrow"><span /> COMPARATIVE PROOF</span><h2>The test must catch the failure<br />and recognize the fix.</h2></div><button className="button dark" onClick={onRun} disabled={running}><Icon name="refresh" size={17} className={running ? "spin" : ""} />{running ? "Running both targets…" : "Run validation gate"}</button></div>
    {available ? <><div className="result-grid"><ResultColumn title="KNOWN-BROKEN TARGET" version={available.broken.targetVersion} run={available.broken} expected="fail" /><ResultColumn title="CORRECTED TARGET" version={available.fixed.targetVersion} run={available.fixed} expected="pass" /></div><div className="gate-success"><span className="success-seal"><Icon name="shield" size={29} /></span><div><span>VALIDATION GATE PASSED</span><h3>This evaluation distinguishes the broken and corrected systems.</h3><p>Publication is allowed because the broken target failed for the intended reason and the corrected target passed every required check.</p></div><StatusPill state="verified">Verified</StatusPill></div></> : <EmptyState title="Run the comparison to generate proof" />}
  </div>;
}

function TimelineView({ item }: { item: RedressCase }) {
  return <div className="content-narrow"><div className="view-title"><div><span className="eyebrow"><span /> VISIBLE CLOSURE</span><h2>From report to verified fix.</h2><p>A reporter-safe record of what happened and what was proven.</p></div></div><div className="timeline">{item.timeline.map((event, index) => <div className="timeline-item" key={event.id}><div className="timeline-rail"><span className={event.complete ? "complete" : ""}>{event.complete ? <Icon name="check" size={14} /> : index + 1}</span></div><div className="timeline-card"><div><strong>{event.label}</strong><time>{formatDate(event.createdAt, true)}</time></div><p>{event.detail}</p><small>{event.actor}</small></div></div>)}</div></div>;
}

function CIView({ item }: { item: RedressCase }) {
  const workflow = `name: RedressCI regression pack\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  evaluate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: npm ci\n      - run: npm run test:ci\n      - uses: actions/upload-artifact@v4\n        if: always()\n        with:\n          name: redressci-results\n          path: results/*.json`;
  const copy = () => navigator.clipboard.writeText(workflow);
  return <div className="two-column ci-layout"><div className="content-stack"><div className="view-title compact"><div><span className="eyebrow"><span /> PERMANENT PROTECTION</span><h2>Ship the test with the fix.</h2><p>The portable runner returns a non-zero exit code when this failure returns.</p></div></div><section className="card install-steps"><h3>Run anywhere Node.js runs</h3><ol><li><span>1</span><div><strong>Download the evaluation</strong><p>No original artifacts, names, or secrets are included.</p></div></li><li><span>2</span><div><strong>Add the workflow</strong><p>Commit the generated GitHub Actions file.</p></div></li><li><span>3</span><div><strong>Protect your release</strong><p>A failed assertion blocks CI and writes a JSON result.</p></div></li></ol><a className="button dark wide" href={`/api/cases/${item.id}/export`} download><Icon name="download" size={17} />Download evaluation JSON</a><a className="button receipt-button wide" href={`/api/cases/${item.id}/receipt`} download><Icon name="shield" size={17} />Download Redress Receipt</a></section><div className="principle"><Icon name="shield" /><p><strong>Vendor-neutral by design.</strong><br />The case format can target an HTTP endpoint, recorded response, or local adapter.</p></div></div><section className="card code-panel workflow"><div className="code-head"><strong>.github/workflows/redressci.yml</strong><button onClick={copy}>Copy</button></div><pre>{workflow}</pre></section></div>;
}

function ReportPage({ onCancel, onCreated }: { onCancel: () => void; onCreated: (item: RedressCase) => void }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [artifact, setArtifact] = useState<File | null>(null);
  const [form, setForm] = useState({ reporterName: "", product: "", originalTranscript: "", description: "", expectedBehavior: "", consent: "Private to reporter" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => { setBusy(true); try { const { case: item } = await api.createCase({ ...form, title: form.description.slice(0, 70) || "Reported AI failure" }); if (artifact) { await api.uploadArtifact(item.id, artifact); if (artifact.type.startsWith("image/")) { const imageDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(artifact); }); await api.extract(item.id, { transcript: form.originalTranscript, imageDataUrl }); } } await api.redact(item.id, form.originalTranscript, false); onCreated((await api.case(item.id)).case); } finally { setBusy(false); } };
  return <div className="report-page"><header><Logo /><button className="icon-button" onClick={onCancel} aria-label="Close"><Icon name="close" /></button></header><div className="report-shell"><aside><span className="eyebrow"><span /> REPORT AN AI FAILURE</span><h1>Your experience can protect the next person.</h1><p>You don’t need to know how software testing works. Tell us what happened; we’ll help structure it safely.</p><div className="steps">{["What happened", "Impact & expectation", "Privacy & consent"].map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><span>{step > index + 1 ? <Icon name="check" size={14} /> : index + 1}</span><strong>{label}</strong></div>)}</div><div className="privacy-promise"><Icon name="lock" /><p><strong>Private until you approve.</strong><br />Original evidence is separated from the anonymized case.</p></div></aside><section className="report-form card">
    {step === 1 && <><span className="step-label">STEP 1 OF 3</span><h2>What happened?</h2><p>Paste the interaction exactly as you saw it. You can edit extracted text before it is used.</p><label>Your name or alias <small>Removed from shared tests</small><input value={form.reporterName} onChange={(e) => set("reporterName", e.target.value)} placeholder="e.g. Maya Chen" /></label><label>AI product or system<input value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="e.g. City services chatbot" /></label><label>Conversation transcript<textarea rows={7} value={form.originalTranscript} onChange={(e) => set("originalTranscript", e.target.value)} placeholder={'You: What did you ask?\nAI: What did it answer?'} /></label><label className="upload-drop"><Icon name="upload" /><div><strong>{artifact ? artifact.name : "Or attach a screenshot"}</strong><small>{artifact ? `${Math.ceil(artifact.size / 1024)} KB · stored privately` : "PNG, JPG, WebP, PDF, or text · 8 MB max"}</small></div><span>{artifact ? "Replace" : "Choose file"}</span><input className="file-input" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={(event) => setArtifact(event.target.files?.[0] || null)} /></label></>}
    {step === 2 && <><span className="step-label">STEP 2 OF 3</span><h2>Why did this response fail?</h2><p>Describe the effect in your own words. A reviewer will link any external claims to evidence.</p><label>What went wrong?<textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was inaccurate, inaccessible, unsafe, or misleading?" /></label><label>What should have happened? <small>Optional</small><textarea rows={5} value={form.expectedBehavior} onChange={(e) => set("expectedBehavior", e.target.value)} placeholder="Describe the outcome you expected." /></label><div className="tip"><Icon name="sparkle" /><p>GPT-5.6 can propose a structured incident and surface unanswered questions, but a human reviewer approves the expected behavior.</p></div></>}
    {step === 3 && <><span className="step-label">STEP 3 OF 3</span><h2>Choose how this can be shared.</h2><p>Your original submission always stays separate from the anonymized evaluation.</p><div className="consent-options">{["Private to reporter", "Shared with responsible organization", "Anonymized research use", "Anonymized public evaluation use"].map((option) => <label className={form.consent === option ? "selected" : ""} key={option}><input type="radio" name="consent" checked={form.consent === option} onChange={() => set("consent", option)} /><span><strong>{option}</strong><small>{option === "Private to reporter" ? "Only you and assigned reviewers can access it." : "Personal details are removed before sharing."}</small></span></label>)}</div><label className="approval-check"><input type="checkbox" defaultChecked /><span>I understand that I can withdraw this report before public publication.</span></label></>}
    <footer><button className="button quiet" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button><button className="button dark" disabled={busy || (step === 1 && !form.originalTranscript && !artifact)} onClick={step === 3 ? submit : () => setStep(step + 1)}>{busy ? "Creating private case…" : step === 3 ? "Submit report" : "Continue"}<Icon name="arrow" size={16} /></button></footer>
  </section></div></div>;
}

function EmptyState({ title }: { title: string }) { return <div className="empty-state"><Icon name="flask" size={30} /><h3>{title}</h3><p>Complete the previous review step to continue.</p></div>; }

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [cases, setCases] = useState<RedressCase[]>([]);
  const [selected, setSelected] = useState<RedressCase | null>(null);
  const [ai, setAi] = useState(false);
  const [platform, setPlatform] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { const [{ cases }, health, { platform }] = await Promise.all([api.cases(), api.health(), api.platform()]); setCases(cases); setAi(health.ai.configured); setPlatform(platform); setLoading(false); };
  useEffect(() => { load().catch(() => setLoading(false)); }, []);
  const openCase = async (id: string) => { setSelected((await api.case(id)).case); setPage("case"); window.scrollTo(0, 0); };
  const refreshSelected = async () => { if (selected) { const fresh = (await api.case(selected.id)).case; setSelected(fresh); setCases((current) => current.map((item) => item.id === fresh.id ? fresh : item)); } };
  const refreshPlatform = async () => setPlatform((await api.platform()).platform);
  const reset = async () => { const { case: item } = await api.reset(); setCases([item]); setSelected(null); await refreshPlatform(); setPage("dashboard"); };
  if (loading) return <div className="loading-screen"><Logo /><span /></div>;
  if (page === "report") return <ReportPage onCancel={() => setPage("dashboard")} onCreated={(item) => { setCases((current) => [item, ...current]); setSelected(item); setPage("case"); }} />;
  return <Shell page={page} onNavigate={setPage} onReport={() => setPage("report")} ai={ai}>
    {page === "dashboard" && <Dashboard cases={cases} onOpen={openCase} onReport={() => setPage("report")} onReset={reset} />}
    {page === "assurance" && <AssurancePage platform={platform} cases={cases} refresh={refreshPlatform} />}
    {page === "case" && selected && <CaseDetail item={selected} onBack={() => setPage("dashboard")} refresh={refreshSelected} />}
  </Shell>;
}
