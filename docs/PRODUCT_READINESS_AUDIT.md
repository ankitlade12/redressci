# RedressCI Product Readiness Audit

**Updated:** July 20, 2026

**Scope:** hosted demo realism, activation, trust, differentiation, and the gap between a hackathon product and a real design-partner pilot.

## Executive assessment

RedressCI has a credible core product rather than a thin AI wrapper. Its strongest loop is:

> affected-person report → privacy approval → evidence-backed expectation → executable evaluation → broken/fixed proof → portable receipt and CI protection

That loop is both demonstrable and technically enforced. The main adoption risk is not a missing assurance algorithm. It is whether a new reporter, reviewer, or developer immediately understands their role, trusts the privacy boundary, and can complete the workflow without encountering controls that feel staged.

The product should therefore lead with **verified remediation**, not generic AI evaluation. Current evaluation platforms already support production-feedback ingestion, annotation queues, expected outputs, datasets, automated scorers, experiments, and CI. Braintrust documents human review and production feedback feeding datasets; LangSmith and Langfuse both provide structured annotation queues. RedressCI remains distinct when it owns the governed handoff from an affected person to comparative proof and visible closure—not when it claims ordinary dataset or review features as novel.

Sources:

- [Braintrust human review](https://www.braintrust.dev/docs/annotate/human-review)
- [Braintrust systematic evaluation and CI](https://www.braintrust.dev/docs/evaluate)
- [LangSmith annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Langfuse annotation queues](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues)
- [AI Incident Database submission and discovery apps](https://incidentdatabase.ai/about_apps/)
- [AI Incident Database incident-response definition](https://incidentdatabase.ai/research/5-response/)
- [OECD AI incident interoperability work](https://oecd.ai/en/site/incidents/)

## What is already compelling

1. **The verification gate is real.** A fixed target cannot receive verified status unless the known-broken target fails for the intended reason and the corrected target passes.
2. **Evidence is executable provenance.** Assertions must cite reviewed evidence and stale evidence can invalidate dependents.
3. **Privacy is a workflow gate.** Original material is kept separate, proposed redactions are reviewable, and personal-data leaks block compilation.
4. **Closure is tangible.** The timeline, Redress Receipt, signed proof bundle, and CI export make remediation visible to different stakeholders.
5. **The format is portable.** RedressCI can complement existing observability and evaluation platforms instead of demanding replacement.

## Demo realism fixes completed in this pass

- Browser Back/Forward and direct product URLs now behave like a real application.
- Reporter, reviewer, developer, administrator, and verifier views can be exercised from the demo workspace; server-enforced redaction remains visible when switching roles.
- Search and status filters work and include honest empty states.
- Dashboard metrics are calculated from stored cases, timelines, runs, and assertion results instead of hard-coded values.
- The dashboard explains the four-stage workflow before asking a visitor to explore details.
- Report intake requires a product/system, an interaction or artifact, an impact description, and explicit consent acknowledgement.
- Attachment size errors and submission failures are visible to the reporter.
- Copy actions provide completion feedback.
- A four-stage judge path now guides visitors through Report → Review → Prove → Prevent regression.
- The landing page identifies where GPT-5.6 adds value and where human approval remains mandatory.
- Reporters have a private status link with notification preferences, receipt access, and consent withdrawal.
- Evidence discovery produces review-only candidates from privacy-approved content.
- The CI handoff includes a deployed-target GitHub Actions workflow and optional Checks API publication.
- Browser voice intake, deployed verification, and privacy-thresholded failure radar are implemented.

## Highest-priority gaps before a real pilot

### P0 — Trust and safety boundary

- Replace demo-token authentication with an actual identity provider, invitation flow, session revocation, and account recovery.
- Remove the credential-free administrator fallback outside an explicitly isolated demo environment.
- Add rate limits, abuse controls, bot protection, malware scanning, and content-safety escalation for uploads.
- Publish a privacy notice, retention/deletion behavior, acceptable-use policy, and an emergency escalation boundary.
- Connect encrypted artifacts to managed object storage and KMS; the hosted demo currently uses local encrypted files.

### P0 — Durable operations

- Move case state from local snapshots to the included PostgreSQL schema and migration process.
- Add backups, restore drills, job retry/dead-letter handling, health telemetry, and error monitoring.
- Separate demo, staging, and production workspaces and secrets.
- Add deployment acceptance tests for each supported role and direct URL.

### P1 — Adoption loop

- Add reviewer assignment, due dates, conflict disclosure, evidence-source previews, and structured rejection reasons.
- Add a developer handoff with owner, linked issue/PR, target configuration status, and next action.
- Add real notification delivery and track activation metrics such as report completion, time to privacy approval, validation success, receipt views, and CI installation.
- Add a lightweight organization onboarding checklist and a guided production-integration setup.

### P1 — Credibility and accessibility

- Run keyboard-only, screen-reader, contrast, zoom, and mobile acceptance tests against the reporter journey.
- Replace broad “operational” phase language with precise labels such as local foundation, configured integration, or externally validated.
- Recruit at least one accessibility/domain reviewer to evaluate the wording and approval burden.
- Record a real low-risk pilot case after the production trust boundary is ready; all current seeded cases are explicitly synthetic.

## Demo narrative recommendation

Use one case and four visible stages rather than touring every feature:

1. **Report:** open the private experience and show the consent boundary.
2. **Review:** show approved evidence and explain that GPT-5.6 can propose but cannot approve.
3. **Prove:** run the broken-versus-fixed gate and show the immutable grader policy.
4. **Prevent regression:** download the receipt and show the GitHub CI protection.

Finish on the Assurance Network for ten to fifteen seconds only. The memorable claim should be: **“RedressCI does not merely record that an AI failed; it proves the fix and keeps testing it.”**

## Go/no-go criteria

### Hackathon demo: go

- Credential-free happy path works.
- Hosted URL and direct routes work.
- CI, tests, build, validation gate, receipt, and proof export work.
- Synthetic status is explicit.

### Real external pilot: not yet

Do not accept sensitive real-world reports until managed identity, durable storage, object storage/KMS, abuse controls, privacy/legal notices, monitoring, deletion operations, and a named response process are in place.
