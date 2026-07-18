# RedressCI — Product and Feature Specification

**Tagline:** Turn real AI failures into tests that stay fixed.

**Track:** Developer Tools  
**Document status:** Initial product specification  
**Primary build target:** OpenAI Build Week MVP  
**Core technologies:** Codex, GPT-5.6, web application, portable evaluation runner, CI integration

---

## 1. Product Summary

RedressCI converts a real-world failure experienced by a user of an AI system into a privacy-safe, evidence-grounded, executable regression test. It connects the affected person, a reviewer, and the responsible development team through a visible remediation lifecycle: report, reproduce, fix, verify, and continuously retest.

The product is not merely an incident database or an AI evaluation dashboard. Its defining feature is the complete transition from lived experience to a validated test that becomes part of software delivery.

### Core product promise

> A valid user-reported AI failure should become permanent protection for every future user.

### Required proof of value

A RedressCI evaluation is considered verified only when it:

1. Reproduces the failure on a known-broken system.
2. Passes on a corrected system.
3. Links its assertions to supporting evidence.
4. Contains no unapproved personal information.
5. Can be rerun after future system changes.

---

## 2. Problem

When AI systems provide inaccurate, inaccessible, discriminatory, unsafe, or misleading responses, affected users often have only weak reporting options:

- Their report becomes an unstructured support ticket.
- Developers receive insufficient information to reproduce the problem.
- Sensitive information may be copied into engineering systems.
- A fix may be made without a regression test.
- The user rarely learns whether the problem was reproduced or corrected.
- Similar users may continue experiencing the same failure.
- Community organizations cannot convert repeated experiences into engineering evidence.

Existing incident databases record what happened, while evaluation tools help development teams test systems. RedressCI connects these workflows and gives affected people a traceable role in remediation.

---

## 3. Product Principles

1. **People before metrics:** Every evaluation begins with a real user experience or an approved synthetic demonstration.
2. **Evidence before assertion:** Generated tests must point to an authoritative source, explicit policy, product requirement, or reviewer-approved expected behavior.
3. **Verification before publication:** A plausible-looking generated test is insufficient; it must distinguish a broken implementation from a corrected one.
4. **Consent before reuse:** Contributors control whether their report stays private, is shared with a specific organization, or is published in anonymized form.
5. **Privacy by default:** Personal information is removed before developers or public users see a case.
6. **Human review at consequential steps:** AI may structure, summarize, redact, and propose tests, but a person approves the evidence and expected behavior.
7. **Portable tests:** Evaluation cases should not be locked to one model provider or observability platform.
8. **Visible closure:** Affected users should be able to see whether their report was received, reproduced, fixed, and verified.

---

## 4. Users and Roles

### 4.1 Reporter

A person who experienced an AI failure or is submitting a report on someone’s behalf.

Capabilities:

- Submit a transcript, screenshot, recording, or written description.
- Attach supporting evidence.
- Review detected personal information.
- Choose a consent and sharing level.
- Approve or reject the anonymized version.
- Track remediation status.
- Add clarifying information.
- Withdraw a report before public publication.

### 4.2 Community advocate

A nonprofit, accessibility specialist, public-interest technologist, researcher, union, teacher, or community worker who helps affected users document recurring problems.

Capabilities:

- Submit reports with contributor permission.
- Manage a private collection of cases.
- Review proposed redactions.
- Combine related reports into a candidate failure pattern.
- Propose expected behavior and supporting sources.
- Monitor recurring failures across products or versions.
- Export anonymized community evaluation packs.

### 4.3 Reviewer

A trusted person who validates a report before it becomes an executable or public evaluation.

Capabilities:

- Confirm that the report describes an observable failure.
- Validate evidence and expected behavior.
- Edit severity and taxonomy.
- Approve privacy redactions.
- Reject unsupported or unsafe cases.
- Request clarification from the reporter.
- Approve the generated evaluation.

### 4.4 Developer

A person responsible for reproducing and fixing the affected AI system.

Capabilities:

- Connect an evaluation target.
- Run a case against a model, agent, API, prompt, or application version.
- Inspect evidence, assertions, grader output, and run logs.
- Link a fix, commit, pull request, or release.
- Compare broken and corrected runs.
- Add the case to CI.
- Mark a case ready for independent verification.

### 4.5 Organization administrator

Capabilities:

- Manage users, teams, projects, and permissions.
- Configure retention and privacy policies.
- Define approved evidence sources.
- Configure model endpoints and secrets.
- Require specific review workflows.
- View organizational remediation metrics.
- Manage private evaluation packs.

### 4.6 Public visitor

Capabilities:

- Browse approved anonymized cases.
- See the evidence, test definition, and remediation state.
- Download portable public evaluation packs.
- View aggregate patterns without accessing personal information.

---

## 5. Primary Workflow

### Phase A — Report

1. Reporter describes the failure.
2. Reporter uploads supporting artifacts.
3. RedressCI extracts the relevant interaction.
4. RedressCI detects possible personal and sensitive information.
5. Reporter reviews the proposed redaction.
6. Reporter chooses the consent level.

### Phase B — Structure

1. GPT-5.6 creates a structured incident draft.
2. The draft identifies the input, system response, failure type, affected capability, context, severity, and expected behavior.
3. Claims are linked to evidence.
4. Unclear assumptions are surfaced as reviewer questions rather than silently inferred.

### Phase C — Compile

1. GPT-5.6 proposes evaluation assertions and grading criteria.
2. Codex generates the portable test fixture, target adapter, and runner configuration.
3. RedressCI creates deterministic checks where possible.
4. Semantic grading is used only where deterministic checks are insufficient.

### Phase D — Validate

1. Run the generated evaluation against a known-broken target.
2. Confirm that the evaluation fails for the intended reason.
3. Run it against a corrected or reference target.
4. Confirm that the evaluation passes.
5. Reject or revise tests that fail to distinguish the versions.
6. Human reviewer approves the validated case.

### Phase E — Remediate

1. Developer receives a reproducible failure package.
2. Developer implements a fix.
3. RedressCI reruns the evaluation.
4. Developer links the fix to a commit, pull request, or release.
5. Reviewer confirms that the case is resolved.

### Phase F — Prevent regression

1. Export the evaluation to CI.
2. Run it on relevant future changes.
3. Reopen the case automatically when the evaluation fails.
4. Notify the reporter or advocate according to their consent settings.

---

## 6. Hackathon MVP Features

The MVP must demonstrate a complete vertical slice. Features marked **Required** should be finished before optional additions.

### 6.1 Report intake — Required

- Simple guided report form.
- Text transcript input.
- Screenshot or document upload.
- Supporting source or evidence input.
- Optional description of the impact.
- Reporter sharing and consent selection.
- Demo mode with preloaded synthetic cases.

Acceptance criteria:

- A reporter can create a case without understanding software testing.
- The system stores the original artifact separately from the anonymized case.
- The demonstration can be completed using only synthetic data.

### 6.2 Multimodal extraction — Required

- Extract visible conversation text from an uploaded screenshot.
- Identify user input and AI response.
- Preserve uncertain OCR or extraction results for human correction.
- Retain artifact provenance.

Acceptance criteria:

- Reviewer can compare extracted text with the original artifact.
- The product never presents low-confidence extracted text as confirmed evidence.

### 6.3 Privacy and redaction review — Required

- Detect names, email addresses, phone numbers, account identifiers, addresses, and other likely personal information.
- Produce an anonymized version.
- Show a before-and-after comparison.
- Allow manual additions and reversals.
- Require approval before sharing beyond the reporter workspace.

Acceptance criteria:

- Original personal information is not included in the generated public test fixture.
- Reporter or reviewer explicitly approves the anonymized version.

### 6.4 Structured incident extraction — Required

Create a structured case containing:

- Case title.
- Concise failure description.
- Product or system under test.
- User input.
- Observed response or action.
- Expected behavior.
- Failure category.
- Severity.
- Affected audience or capability.
- Environmental context.
- Supporting evidence.
- Uncertainties and unanswered questions.
- Consent level.

Acceptance criteria:

- Every expected behavior is linked to evidence or explicitly marked as reviewer judgment.
- Unsupported assumptions appear as questions.

### 6.5 Evidence management — Required

- Attach an authoritative document, policy excerpt, dataset record, product specification, or reviewer-approved requirement.
- Identify the precise relevant passage or field.
- Preserve the source title and retrieval date.
- Distinguish authoritative evidence from reporter description.

Acceptance criteria:

- The generated grader can show which evidence supports each assertion.
- A reviewer can replace or reject a source.

### 6.6 Evaluation compiler — Required

- Convert a reviewed incident into a portable JSON or YAML evaluation case.
- Generate the test input and context.
- Generate required and prohibited behaviors.
- Generate deterministic checks where possible.
- Generate a semantic grading rubric when necessary.
- Generate a target adapter template.
- Generate a human-readable explanation of the evaluation.

Example:

```yaml
id: cooling-center-accessibility-001
title: Do not recommend an inaccessible facility
input:
  message: "Which nearby cooling center can I enter using a wheelchair?"
context:
  mobility_requirement: wheelchair_accessible
evidence:
  - source: fixtures/facilities.json
    locator: central-hall.accessibility
    value: "stairs_only"
assertions:
  - type: forbidden_entity
    value: central-hall
  - type: evidence_citation_required
severity: high
```

Acceptance criteria:

- A generated case can be exported and run without the RedressCI interface.
- The generated case contains no secrets or personal information.

### 6.7 Hybrid grader — Required

- Deterministic exact-match and forbidden-content checks.
- Structured field validation.
- Evidence citation validation.
- GPT-5.6 semantic evaluation for nuanced behavior.
- Grader explanation with cited evidence.
- Configurable pass threshold.
- Explicit inconclusive result when evidence is insufficient.

Acceptance criteria:

- The interface distinguishes deterministic results from model-judged results.
- A grader cannot silently convert an inconclusive result into a pass.

### 6.8 Broken-versus-fixed validation gate — Required

- Register a known-broken target.
- Register a corrected or reference target.
- Run the same case against both.
- Verify that the broken target fails.
- Verify that the corrected target passes.
- Display why each result occurred.
- Block publication when the evaluation does not distinguish the targets.

Acceptance criteria:

- This gate is enforced by application logic, not merely described in documentation.
- A case cannot receive `verified` status without comparative evidence.

### 6.9 Evaluation runner — Required

- Run a case against a configured HTTP endpoint or included demo chatbot.
- Capture target version, prompt version, model, date, response, latency, and grader result.
- Support repeat runs.
- Display side-by-side comparison.
- Store a compact run history.

Acceptance criteria:

- Judges can run the supplied sample case without configuring a proprietary system.
- Results are reproducible enough to demonstrate the intended distinction.

### 6.10 Remediation status page — Required

Statuses:

- Draft.
- Awaiting privacy review.
- Awaiting evidence review.
- Test generated.
- Reproduced.
- Fix in progress.
- Ready for verification.
- Verified fixed.
- Regression detected.
- Rejected.
- Withdrawn.

Features:

- Human-readable progress timeline.
- Reporter-safe explanations.
- Developer evidence and run details.
- Linked fix or version.
- Clear distinction between “developer says fixed” and “evaluation verified fixed.”

Acceptance criteria:

- A reporter can understand the status without developer terminology.

### 6.11 CI export — Required

- Download evaluation package.
- Generate a sample GitHub Actions workflow.
- Return non-zero exit status on failed evaluation.
- Produce a machine-readable result artifact.
- Include setup instructions.

Acceptance criteria:

- The exported sample can run from the repository README instructions.
- A failing case visibly fails the sample CI job.

### 6.12 Case dashboard — Required

- List cases by status, severity, and category.
- Show verified and unverified evaluations separately.
- Display latest run result.
- Provide direct access to report, evidence, test, runs, and remediation timeline.

### 6.13 Sample demonstration fixtures — Required

Include:

- A fictional public-service chatbot.
- A synthetic facility accessibility dataset.
- A known-broken chatbot configuration.
- A corrected chatbot configuration.
- A sample user report and screenshot.
- An authoritative synthetic facility record.
- A generated evaluation and run history.

---

## 7. Post-Hackathon Product Features

### 7.1 Organization workspaces

- Multiple projects and teams.
- Private and public cases.
- Workspace-level retention policies.
- Custom taxonomies and severity rules.
- Approved evidence-source lists.
- Organization branding.
- Regional data residency options.

### 7.2 Role-based access control

- Reporter, advocate, reviewer, developer, administrator, and auditor roles.
- Case-level permissions.
- Evidence-level sensitivity restrictions.
- Separation between original and anonymized artifacts.
- Time-limited reviewer access.

### 7.3 Consent management

Consent levels:

- Private to reporter.
- Shared with named advocate.
- Shared with responsible organization.
- Anonymized research use.
- Anonymized public evaluation use.

Features:

- Consent history.
- Withdrawal workflow.
- Re-consent after material changes.
- Plain-language explanation of each sharing level.
- Guardian or representative workflow where legally appropriate.

### 7.4 Community review panels

- Invite domain and lived-experience reviewers.
- Conflict-of-interest disclosure.
- Independent review votes.
- Reviewer notes and suggested assertions.
- Escalation for disputed expected behavior.
- Compensation tracking for community reviewers.

### 7.5 Duplicate and pattern detection

- Find semantically similar reports.
- Suggest case grouping without exposing private content.
- Distinguish repeated incidents from copied submissions.
- Create a parent failure pattern with multiple supporting cases.
- Track recurrence by system version, language, geography, or user context.

### 7.6 Evaluation packs

- Group approved cases by domain or community.
- Version evaluation packs.
- Publish changelogs.
- Pin tests to evidence versions.
- Export vendor-neutral packages.
- Offer public, partner, and private packs.

Potential packs:

- Accessibility and assistive technology.
- Public benefits information.
- Multilingual public services.
- Education and student support.
- Employment and hiring assistants.
- Customer-support agents.
- Healthcare navigation, subject to appropriate expert governance.

### 7.7 Target adapters

- OpenAI API-compatible endpoint.
- Generic HTTP API.
- Web chatbot browser adapter.
- Agent framework adapter.
- Recorded response adapter.
- Local model adapter.
- Batch file adapter.
- Custom SDK.

### 7.8 Advanced graders

- Citation correctness.
- Policy grounding.
- Refusal appropriateness.
- Tool selection correctness.
- Action completion correctness.
- Multilingual semantic consistency.
- Accessibility-oriented response checks.
- Tone and dignity criteria.
- Consistency across demographic or contextual variants.
- Human scoring calibration.

### 7.9 Counterfactual test generation

- Generate privacy-safe variations around an approved case.
- Preserve the tested failure mechanism.
- Vary language, location, phrasing, assistive need, or relevant context.
- Require reviewer approval before expanding sensitive demographic dimensions.
- Track the original case that motivated every synthetic variation.

### 7.10 Mutation testing for evaluations

- Deliberately alter target behavior to test whether the grader detects failure.
- Measure false-pass and false-fail tendencies.
- Identify overly broad or overly narrow assertions.
- Assign an evaluation confidence score.

### 7.11 Continuous regression monitoring

- Scheduled evaluation runs.
- Run on model, prompt, retrieval, policy, or tool changes.
- Alert on reintroduced failures.
- Compare results across releases.
- Support release-blocking policies for critical cases.

### 7.12 Developer integrations

- GitHub App.
- GitLab integration.
- Pull-request status checks.
- Jira and Linear issue linking.
- Slack and Teams notifications.
- Webhooks.
- CLI.
- REST API.
- MCP server for agent access.

### 7.13 Remediation assistance

- Explain likely failure mechanism.
- Identify prompt, retrieval, policy, tool, or application layer involved.
- Suggest a minimal fix plan.
- Use Codex to propose code or configuration changes.
- Require developer review before applying changes.
- Rerun the originating case and relevant evaluation pack after a fix.

### 7.14 Reporter communication

- Plain-language status updates.
- Optional email or in-app notifications.
- Requests for clarification.
- Notification when a fix is released.
- Explanation of what was tested.
- Clear statement when a report cannot be reproduced or accepted.
- Feedback on whether the remediation addresses the original experience.

### 7.15 Transparency and public accountability

- Public anonymized case pages.
- System and version history where permission exists.
- Evidence and grader methodology.
- Verified remediation badge.
- Recurrence count.
- Aggregate reports by domain and failure type.
- Exportable public data with privacy thresholds.

### 7.16 Audit trail

- Immutable event history for important state transitions.
- Record who changed evidence, assertions, severity, consent, and status.
- Preserve evaluation and grader versions.
- Link tests to commits and releases.
- Export audit reports.

### 7.17 Quality and abuse controls

- Submission rate limits.
- Duplicate detection.
- Unsupported-claim detection.
- Evidence-quality warnings.
- Malicious file scanning.
- Prompt-injection isolation for uploaded artifacts.
- Reviewer queues based on risk.
- Appeals process for rejected reports.
- Clear separation between allegation, reproduced failure, and verified finding.

### 7.18 Analytics

Organization metrics:

- Reports received.
- Time to first review.
- Reproduction rate.
- Time to verified remediation.
- Regression recurrence rate.
- Percentage of cases with user-visible closure.
- Evaluation coverage by product area.
- Failure distribution by mechanism and severity.

Community metrics:

- Number of public verified cases.
- Cases contributed by partner organizations.
- Evaluation packs downloaded or run.
- Repeat failures prevented.
- Reviewer participation and compensation.

Metrics must not expose small groups or allow re-identification.

---

## 8. Failure Taxonomy

Initial categories:

- Factual inaccuracy.
- Unsupported claim.
- Incorrect policy or eligibility guidance.
- Accessibility failure.
- Multilingual inconsistency.
- Harmful stereotype or discriminatory behavior.
- Unsafe recommendation.
- Inappropriate refusal.
- Failure to refuse.
- Privacy disclosure.
- Incorrect tool selection.
- Unauthorized action.
- Incomplete action presented as complete.
- Hallucinated action or confirmation.
- Retrieval failure.
- Citation failure.
- Context loss.
- Inconsistent response across equivalent inputs.
- Other reviewer-defined failure.

Every case may have multiple categories, but must identify one primary failure mechanism.

---

## 9. Evidence Model

Evidence types:

- Official policy or regulation.
- Product specification.
- Public dataset record.
- Organization-approved knowledge base.
- Accessibility requirement.
- Expert-reviewed standard.
- User-provided artifact.
- Recorded system behavior.
- Reviewer-approved normative requirement.

Required evidence metadata:

- Title.
- Source type.
- Source location or file reference.
- Relevant excerpt or structured field.
- Retrieval or upload date.
- Reviewer.
- Evidence status: proposed, approved, superseded, or rejected.
- Sensitivity level.

Rules:

- User testimony is valid evidence of the experienced interaction but may not alone establish an external policy fact.
- Generated summaries never replace the underlying evidence.
- When evidence changes, affected evaluations must be flagged for review.

---

## 10. Evaluation Case Schema

Suggested top-level fields:

```json
{
  "id": "string",
  "version": 1,
  "title": "string",
  "summary": "string",
  "status": "verified",
  "severity": "low|medium|high|critical",
  "taxonomy": ["string"],
  "input": {},
  "context": {},
  "evidence": [],
  "assertions": [],
  "grader": {},
  "privacy": {},
  "provenance": {},
  "validation": {
    "broken_run_id": "string",
    "corrected_run_id": "string"
  }
}
```

Assertion types for the MVP:

- Required phrase or concept.
- Forbidden phrase, entity, recommendation, or action.
- Required citation.
- Structured output equality.
- Allowed entity set.
- Required uncertainty disclosure.
- Semantic rubric.

---

## 11. AI Responsibilities and Boundaries

### GPT-5.6 may

- Extract structured information from approved inputs.
- Propose redactions.
- Identify missing information.
- Draft evaluation assertions.
- Generate semantic grading rubrics.
- Compare outputs with evidence.
- Explain results in plain language.

### Codex may

- Generate evaluation fixtures and adapters.
- Build test runners and CI workflows.
- Propose remediation patches.
- Add or update regression tests.
- Document generated artifacts.

### AI must not independently

- Determine that a person’s allegation is legally proven.
- Publish personal information.
- Change consent.
- Approve consequential expected behavior without human review.
- Mark a case verified without executed comparison results.
- Contact or publicly identify an accused organization.
- Apply a remediation patch to production without authorization.

---

## 12. Security, Privacy, and Safety Requirements

### Data handling

- Encrypt data in transit and at rest in a production system.
- Separate original artifacts from redacted evaluation data.
- Never place secrets in generated fixtures.
- Apply configurable retention periods.
- Support deletion and withdrawal workflows.

### Uploaded content

- Treat all uploaded text and files as untrusted.
- Do not execute uploaded code.
- Isolate prompt instructions contained inside artifacts.
- Scan supported file types.
- Enforce size and format limits.

### Model and endpoint secrets

- Store credentials using secure server-side secret management.
- Never return secrets to the client.
- Mask credentials in logs.
- Restrict target adapters to approved destinations.

### Evaluation safety

- Run generated code only in an isolated environment.
- Prefer declarative JSON/YAML cases over arbitrary code.
- Restrict network access during test generation and validation.
- Require manual approval for consequential domains.

### Public disclosure

- Do not publicly name organizations or products in the MVP.
- Public cases require explicit consent and reviewer approval.
- Clearly label synthetic cases.
- Distinguish reports from verified reproductions.

---

## 13. UX Screens

### MVP screens

1. Landing page.
2. Report an AI failure.
3. Upload and extracted interaction review.
4. Privacy redaction review.
5. Structured incident and evidence review.
6. Generated evaluation review.
7. Broken-versus-fixed validation run.
8. Case detail and remediation timeline.
9. Case dashboard.
10. CI export and setup instructions.

### Key UX requirements

- Reporter language must be non-technical.
- Developer details must remain available without overwhelming the reporter.
- Every automated inference must be editable.
- Evidence must be visible beside the assertion it supports.
- A verified badge must mean the comparison gate actually passed.
- Synthetic demo data must be clearly labeled.

---

## 14. Suggested Technical Architecture

### Web application

- Responsive frontend.
- Server-side API.
- Relational database for cases, evidence, runs, and status history.
- Object storage for private original artifacts.
- Background job or task runner for evaluations.

### AI services

- GPT-5.6 for structured extraction, proposed redaction, rubric generation, and semantic grading.
- Codex for building the application, evaluation fixtures, CI integration, and remediation demonstrations.

### Evaluation engine

- Declarative case schema.
- Target adapter interface.
- Deterministic assertion engine.
- Semantic grader interface.
- Comparative validation service.
- Machine-readable run artifacts.

### Demo deployment

- Hosted demo instance.
- Preloaded synthetic case.
- No login required for the judge demo path.
- One-click reset of demonstration data.
- Public repository with setup instructions.

---

## 15. API Outline

Suggested endpoints:

```text
POST   /api/cases
GET    /api/cases
GET    /api/cases/:id
POST   /api/cases/:id/artifacts
POST   /api/cases/:id/extract
POST   /api/cases/:id/redact
POST   /api/cases/:id/evidence
POST   /api/cases/:id/compile
POST   /api/cases/:id/runs
GET    /api/cases/:id/runs
POST   /api/cases/:id/validate
POST   /api/cases/:id/status
GET    /api/cases/:id/export
```

Target adapter interface:

```text
execute(input, context, target_config) -> target_response
```

Grader interface:

```text
grade(case, target_response, evidence) -> pass | fail | inconclusive
```

---

## 16. Demo Scenario

### Synthetic case: inaccessible cooling-center recommendation

The fictional city chatbot recommends Central Hall to a wheelchair user. The synthetic official facility dataset marks Central Hall as stairs-only and identifies River Library as wheelchair accessible.

Demonstration sequence:

1. Upload the user-chat screenshot and facility record.
2. Review extracted interaction.
3. Approve removal of the fictional user’s name.
4. Generate the structured incident.
5. Confirm the evidence-backed expected behavior.
6. Compile the evaluation.
7. Run against the broken chatbot; it fails.
8. Show the Codex-assisted correction.
9. Run against the corrected chatbot; it passes.
10. Mark the case verified fixed.
11. Export the regression test to CI.

---

## 17. Three-Minute Video Structure

### 0:00–0:20 — Problem

Show the harmful recommendation and explain that a support ticket does not prevent recurrence.

### 0:20–1:05 — Report and compile

Upload the interaction and evidence, review redaction, and generate the test.

### 1:05–1:45 — Reproduce

Run the test against the broken chatbot and show the evidence-grounded failure.

### 1:45–2:20 — Fix and verify

Show the Codex-assisted fix and the corrected version passing.

### 2:20–2:45 — Prevent recurrence

Export the test into CI and show the remediation timeline.

### 2:45–3:00 — Vision

Explain that one person’s experience can become protection for every future user.

---

## 18. MVP Delivery Plan

### Day 1 — Complete vertical data flow

- Repository and application scaffold.
- Case schema and synthetic fixtures.
- Report form.
- Artifact extraction.
- Redaction review.
- Structured incident generation.

### Day 2 — Evaluation and verification

- Evaluation compiler.
- Deterministic and semantic graders.
- Broken and corrected demo targets.
- Comparative validation gate.
- Run results interface.

### Day 3 — Product completion

- Remediation timeline.
- CI export.
- Dashboard polish.
- Hosted judge path.
- Tests and failure handling.
- README and architecture documentation.
- Demo video and submission assets.

---

## 19. Explicit MVP Non-Goals

- No real government deployment.
- No real legal, medical, employment, credit, or insurance decisions.
- No automatic public accusations.
- No universal evaluation language.
- No arbitrary generated-code execution.
- No complete community moderation platform.
- No enterprise single sign-on.
- No billing.
- No production-grade multi-region infrastructure.
- No guarantee that one evaluation proves an entire system is safe.

---

## 20. Success Metrics

### Hackathon success

- A judge can understand the value within 20 seconds.
- A synthetic report becomes a portable evaluation.
- The case fails the known-broken implementation.
- The same case passes the corrected implementation.
- Every assertion links to evidence.
- The CI export works.
- The demo instance requires no complicated setup.

### Early product validation

- Percentage of reports that become reproducible cases.
- Time from report to first reproduction.
- Percentage of fixes with verified regression tests.
- Percentage of reporters who receive closure.
- Regression recurrence rate.
- Reviewer time per accepted case.
- False-pass and false-fail rates of generated graders.

---

## 21. Business Model

### Free public commons

- Public anonymized verified cases.
- Open evaluation schema and runner.
- Community evaluation packs.
- Open-source integrations.

### Paid organizational product

- Private incident intake.
- Advanced consent and retention controls.
- Private evaluation packs.
- CI and issue-tracker integrations.
- Audit trails and reports.
- Custom taxonomies and workflows.
- Dedicated community-review programs.
- Enterprise security and deployment options.

Potential customers:

- AI application companies.
- Government digital-service teams.
- Universities and education-technology providers.
- Nonprofits and advocacy organizations.
- Accessibility and compliance teams.
- Customer-support and agent-platform vendors.

---

## 22. Competitive Positioning

RedressCI should not position itself as a replacement for incident databases, observability platforms, evaluation tools, or community benchmark initiatives. It connects them.

### Positioning statement

> Incident databases show what went wrong. Evaluation platforms show whether a system passes a test. RedressCI lets an affected person turn what went wrong into the test and track it until the fix is verified.

### Defensible assets

- Trusted community and advocacy partnerships.
- Corpus of consented, evidence-grounded, verified cases.
- Broken-versus-fixed validation methodology.
- Portable evaluation format.
- Reporter-to-developer remediation history.
- Domain-specific review and grading expertise.

---

## 23. Major Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Generated test encodes the wrong expected behavior | Require evidence and human review |
| Sensitive data leaks into public cases | Separate originals, redact by default, require approval |
| False or malicious reports overwhelm reviewers | Rate limits, evidence checks, duplicate detection, staged status labels |
| Model grader produces inconsistent results | Prefer deterministic checks, calibrate graders, support inconclusive results |
| Test passes without proving remediation | Require failure on broken target and pass on corrected target |
| Public case unfairly identifies an organization | Keep MVP synthetic and require disclosure review for future public cases |
| Evaluation becomes stale when evidence changes | Version evidence and flag dependent tests |
| Community members provide unpaid expert labor | Plan compensated review programs and transparent governance |
| Product overclaims system safety | Clearly state that cases verify specific behaviors, not total safety |

---

## 24. Open Questions After the Hackathon

- Which first community should co-design the product?
- Who is qualified to approve expected behavior in each domain?
- What consent model best supports public regression tests?
- How should organizations respond to disputed cases?
- Should public cases name systems only after independent reproduction?
- Which evaluation format should become the portable standard?
- How can community reviewers be compensated sustainably?
- Which domains should be excluded until expert governance exists?
- How should RedressCI handle changing policies and evidence?
- What minimum reproduction evidence is required for a public verified badge?

---

## 25. Submission Description

**Developer Tools:** RedressCI transforms user-reported AI failures into privacy-safe, evidence-grounded regression tests. Using GPT-5.6 and Codex, it redacts sensitive information, compiles the report into an executable evaluation, verifies that the test fails the broken system and passes the corrected version, and exports it into CI so the same failure cannot silently return. The goal is to give affected communities a direct, traceable path from reporting an AI problem to seeing it permanently fixed.

---

## 26. Definition of Done for the Hackathon

The MVP is complete when:

- [ ] The synthetic case can be submitted through the reporter interface.
- [ ] Screenshot or transcript extraction works.
- [ ] Redaction is displayed and approved.
- [ ] The structured incident includes evidence and uncertainty.
- [ ] The evaluation compiler produces a portable case file.
- [ ] The known-broken target fails.
- [ ] The corrected target passes.
- [ ] The application enforces the comparative validation gate.
- [ ] The remediation timeline updates to verified fixed.
- [ ] The evaluation can be exported to a sample CI workflow.
- [ ] The hosted judge path works without private credentials.
- [ ] The README explains setup, architecture, Codex collaboration, and GPT-5.6 usage.
- [ ] Automated tests cover the critical workflow.
- [ ] The public demonstration uses only synthetic data.
- [ ] The demo video is under three minutes.

---

## 27. Reference Landscape

- [OpenAI Build Week](https://openai.devpost.com/)
- [AI Incident Database](https://incidentdatabase.ai/)
- [MIT AI Incident Tracker](https://airisk.mit.edu/ai-incident-tracker)
- [MLCommons AI Risk & Reliability](https://mlcommons.org/working-groups/ai-risk-reliability/ai-risk-reliability/)
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

