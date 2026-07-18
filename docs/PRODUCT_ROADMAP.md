# RedressCI Product Roadmap

## Product goal

Establish Remediation CI as a new developer-tool category: every valid, consented AI failure can become evidence-backed protection that is verified, portable, and visible to the person who reported it.

## Prioritization principles

1. Complete one credible workflow before adding breadth.
2. Prefer executed proof over AI-generated prose.
3. Make privacy, evidence, and human approval product logic—not policy text.
4. Integrate with existing eval and observability tools rather than rebuilding them.
5. Optimize the judge demo for no credentials and one-click repeatability.

## Phase 0 — Hackathon submission

**Objective:** prove the category in under three minutes.

### Must ship

- Guided synthetic report intake.
- Separate original and anonymized representations.
- Multimodal GPT-5.6 extraction path with explicit uncertainty.
- Evidence-backed structured incident.
- Portable declarative evaluation.
- Deterministic checks plus GPT-5.6 semantic-grader interface.
- Enforced broken-fails / fixed-passes validation gate.
- Reporter-safe remediation timeline.
- Standalone runner and GitHub Actions example.
- One-click demo reset with no API key required.
- README covering setup, supported platforms, architecture, Codex collaboration, and GPT-5.6 usage.
- Public repository licensing and a concise submission/video script.

### Demo narrative

1. A wheelchair user receives an inaccessible cooling-center recommendation.
2. RedressCI removes the person’s name and preserves the original privately.
3. A reviewer approves two facility records and the expected behavior.
4. RedressCI compiles four linked checks.
5. Version 1.3 fails; version 1.4 passes.
6. The gate issues verified status and exports the case to CI.

### Success gate

- Fresh clone to working demo in under five minutes.
- Build and critical tests pass.
- No private credentials required for judge path.
- Broken target reliably exits non-zero; corrected target exits zero.

## Phase 1 — Design-partner pilot (0–8 weeks)

**Engineering status:** ✅ executable foundation implemented. Managed infrastructure and real design-partner validation remain external milestones.

**Objective:** validate the workflow with 2–3 organizations and one community partner.

### Build

- Persistent relational data model and private object storage.
- Reporter, reviewer, and developer roles.
- Consent history and withdrawal workflow.
- Evidence dependency graph with source-change invalidation.
- Generic HTTP and OpenAI-compatible target adapters.
- GitHub issue/PR links and status checks.
- Redress Receipt v1 with evaluation and run hashes.
- Import/export adapters for LangSmith, Braintrust, and Langfuse datasets.
- Review calibration dashboard showing deterministic vs. model-judged decisions.

### Learn

- What percentage of reports are reproducible?
- Which evidence types let reviewers approve expected behavior quickly?
- What information do reporters actually find meaningful at closure?
- Where do developers resist or distrust community-originated tests?

### Success gate

- 30 reviewed synthetic or low-risk cases.
- At least 15 verified broken/fixed comparisons.
- Median time to first reproduction under two business days.
- At least 80% reviewer agreement on approved expected behavior.

## Phase 2 — Assurance engine (2–5 months)

**Engineering status:** ✅ executable locally: mutation, calibration, stability/confidence, severity policy, scope guard, trajectories, signed proofs, evidence pins, and chained audit events.

**Objective:** make evaluation quality itself measurable.

### Build

- Evaluation mutation lab.
- Grader disagreement and calibration reports.
- Repeat-run stability and confidence intervals.
- Explicit inconclusive policy by severity.
- Fix-scope guard against neighboring regressions.
- Multi-turn and tool-trajectory case schema.
- Signed proof bundles and an append-only audit trail.
- Evidence version pinning and automatic re-review queues.

### Success gate

- Critical cases must catch at least 90% of approved mutations.
- No verified state can be created without executed comparative evidence.
- Every public assertion resolves to an approved evidence node.
- Grader/version changes automatically invalidate affected assurance claims.

## Phase 3 — Community evaluation packs (5–9 months)

**Engineering status:** ✅ governed pack foundation implemented. Named external stewards, compensation payments, and three independently maintained packs require partner operations.

**Objective:** turn individual cases into governed, reusable protection.

### Build

- Privacy-preserving failure fingerprints.
- Reviewer-approved counterfactual generation.
- Pack versioning, changelogs, and dependency locks.
- Community maintainer roles, conflict disclosures, and compensation tracking.
- Sealed evaluation escrow for independent verification.
- Multilingual reporter workflow and accessibility conformance testing.
- OECD-compatible incident export and public anonymized case pages.

### Initial packs

1. Public information accessibility.
2. University and education support.
3. Customer-service action/confirmation failures.

### Success gate

- Three maintained packs with named domain stewards.
- At least 25% of verified cases contribute an approved reusable variation.
- Public releases contain no unapproved personal data.
- Community reviewers are compensated under a published policy.

## Phase 4 — Remediation network (9–18 months)

**Engineering status:** ✅ network and policy foundation implemented, including the SDK and integration contracts. Real SSO, regional cloud resources, third-party app credentials, and independent verification partners require deployment accounts and agreements.

**Objective:** become the neutral interoperability layer between reports and software delivery.

### Build

- Organization workspaces, retention policy, regional storage, and SSO.
- Cross-vendor proof bundle standard and SDK.
- GitHub/GitLab apps, Jira/Linear links, Slack/Teams notifications, and webhooks.
- Remediation SLOs, recurrence ledger, and release-blocking policies.
- Aggregated pattern reports with re-identification thresholds.
- Independent verification partner portal.
- Optional regulatory reporting mappings without presenting legal conclusions.

### Business model

- Free: public schema, runner, synthetic demos, and approved public packs.
- Paid: private intake, role controls, audit trail, evidence graph, integrations, SLO analytics, and private packs.
- Partner program: compensated community review and independent verification.

## Feature priority matrix

| Priority | Feature | Impact | Effort | Rationale |
| --- | --- | --- | --- | --- |
| P0 | Broken-versus-fixed enforcement | Very high | Medium | Core proof and clearest differentiation |
| P0 | Evidence-to-assertion links | Very high | Medium | Prevents generated tests from encoding unsupported expectations |
| P0 | Privacy/consent gate | Very high | Medium | Necessary for community-originated cases |
| P0 | Portable runner and CI export | Very high | Medium | Converts a report into lasting engineering protection |
| P1 | Redress Receipt | High | Low | Makes closure tangible and memorable |
| P1 | Evidence dependency graph | High | Medium | Prevents stale truth and creates durable product value |
| P1 | Mutation lab | High | Medium | Measures whether the evaluation is trustworthy |
| P1 | Generic adapters and eval-platform export | High | Medium | Accelerates adoption without competing with incumbents |
| P2 | Failure fingerprinting | High | High | Unlocks patterns but needs careful privacy design |
| P2 | Community packs and counterfactuals | High | High | Strong network effect after governance is ready |
| P2 | Sealed evaluation escrow | Medium-high | High | Valuable for independent assurance and anti-gaming |
| P3 | Enterprise analytics and regulatory mappings | Medium | High | Monetizable after core workflow is validated |

## Immediate execution plan

1. ✅ Finish the judge-ready vertical slice and standalone runner.
2. ✅ Add automated tests for grading, privacy gates, a full fresh-report lifecycle, comparative verification, and verified-status blocking.
3. ✅ Add the Redress Receipt as the signature novelty feature.
4. ✅ Make human approval of privacy, evidence, expected behavior, assertions, and target pairs executable product gates.
5. ✅ Document competitive positioning and the “Remediation CI” category.
6. ✅ Add durable state, PostgreSQL schema, authenticated role boundaries, encrypted artifact storage, jobs, adapters, and evidence invalidation.
7. ✅ Implement the assurance, community-pack, and remediation-network foundations as executable product surfaces.
8. Next: deploy the judge build and record the three-minute narration centered on proof.
9. Next: use pilot conversations to validate evidence review, reporter closure, governance, and SLO assumptions with real participants.
10. ✅ Add the Live Remediation Loop, private reporter closure links, reviewed evidence discovery, deployed-target GitHub checks, privacy-safe radar, and accessible voice intake.

## Completion semantics

“Implemented” means the capability has a typed domain object, server-side invariant, API or SDK surface, product visibility where appropriate, and automated coverage. It does not claim that external adoption targets have occurred. Success gates involving 30 cases, multiple organizations, compensated community members, cloud regions, or independent legal/regulatory determinations can only be completed through real operations.
