# RedressCI Implementation Status

**Updated:** July 18, 2026

## Working end to end

- Credential-free seeded judge demonstration.
- Fresh reporter-created case workflow.
- Separate developer-owned internal incident workflow without access to community originals.
- Text transcript parsing and private artifact upload.
- Case-linked encrypted artifact metadata, server-side text/image extraction, and explicit PDF behavior.
- Optional GPT-5.6 image/text extraction using strict structured output.
- Proposed redaction for names, email, phone, and account identifiers.
- Side-by-side human privacy approval with leak rechecking.
- Proposed and reviewer-approved evidence.
- Explicit approval of expected behavior.
- Reviewer-authored deterministic and semantic assertions.
- Enforcement that every assertion cites approved evidence.
- Compilation-time privacy scanning of evidence and assertions.
- Recorded broken and corrected targets with version metadata.
- Hybrid grading: deterministic checks locally and GPT-5.6 semantic grading when configured.
- Enforced comparative gate: broken must fail and corrected must pass.
- Reporter-safe timeline, portable case export, CI runner, and Redress Receipt.
- Assurance Network dashboard spanning roadmap phases 1–4.
- Ed25519-signed receipts and portable proof bundles with built-in verification.
- Live deployed-target verification with a separate signed deployment proof and truthful `Verified fixed` transition.
- Expiring, revocable private reporter status links with notification preferences and consent withdrawal.
- GPT-5.6 public evidence discovery that stores unapproved candidates and never bypasses reviewer approval.
- Generated deployed-target GitHub Actions checks plus optional GitHub Checks API publication.
- Privacy-thresholded failure radar with mechanism/capability summaries and small-group suppression.
- Accessible browser voice input that remains editable and stores only submitted text in RedressCI.

## All-phase engineering foundation

### Phase 1 — Design-partner pilot

- HMAC-signed bearer identities and enforced reporter/reviewer/developer/admin/partner roles.
- Owner checks for original artifact upload, download, extraction, and privacy approval.
- Append-only consent history with explicit withdrawal.
- AES-256-GCM private artifact storage and region metadata.
- Optional durable local state with atomic writes plus a complete PostgreSQL migration under `db/migrations/`.
- Evidence versions, exact assertion/evaluation dependencies, invalidation, and re-review queue.
- Idempotent evaluation jobs.
- Recorded, allowlisted HTTPS, and OpenAI-compatible adapter definitions with server-side secret references.
- LangSmith, Braintrust, Langfuse, and OECD-compatible exports.

### Phase 2 — Assurance engine

- Mutation lab with detection rate and severity-aware success policy.
- Deterministic/model decision calibration and inconclusive-rate reporting.
- Repeat-run stability with a Wilson 95% confidence interval.
- Severity-specific inconclusive and repeat-run policies.
- Neighboring privacy/fix-scope guard.
- Multi-turn/tool-trajectory schema and deterministic tool assertions.
- Evidence pins, Ed25519 proof bundles, and a hash-chained audit log.

### Phase 3 — Community evaluation packs

- Privacy-preserving mechanism fingerprints that exclude raw report text.
- Reviewer-controlled phrasing, language, location, and assistive-need variations.
- Semantic-versioned packs with changelogs, dependency locks, locales, WCAG target, maintainers, conflict disclosures, and compensation records.
- AES-256-GCM sealed evaluation escrow for an independent partner.
- OECD-compatible incident export and consent-gated anonymized public case responses.

### Phase 4 — Remediation network

- Workspace retention, region, SSO requirement, severity, and release-blocking policies.
- TypeScript interoperability SDK.
- GitHub, GitLab, Jira, Linear, Slack, Teams, and webhook integration model with audited deliveries.
- Remediation SLO calculation, recurrence ledger, and release-blocking event metadata.
- Pattern reports with minimum-group suppression to reduce re-identification risk.
- Independent verifier role and operational regulatory crosswalks with explicit non-legal notices.

## Enforced invariants

1. Privacy approval is required before evidence review.
2. Approved evidence is required before expected-behavior approval.
3. Expected behavior and assertions require explicit reviewer action.
4. Assertions without approved evidence references cannot compile.
5. Reviewed content containing apparent personal data cannot compile.
6. Both recorded target responses are required before validation.
7. Evaluation-verified status cannot be set until comparative recorded-response execution succeeds; deployed-fix status requires live-system proof.
8. A Redress Receipt cannot be issued without stored broken/fixed proof.
9. Developer incident reporting never grants access to another reporter's original narrative or artifacts.
10. Privileged case state cannot be injected through public intake fields.

## Automated verification

The suite currently covers 37 checks, including:

- broken-target failure and corrected-target success;
- validation-gate ordering;
- inconclusive semantic behavior;
- API judge path and receipt issuance;
- privacy and evidence compilation gates;
- personal-data leak blocking;
- expected-behavior approval;
- privacy detection and manual reintroduction detection; and
- a complete fresh-report lifecycle through evaluation-verified status, including rejection of unsupported deployed-fix claims;
- shared hash-derived grader-policy provenance across comparative targets;
- word-safe generated case titles and non-duplicated reporter impact rendering;
- signed-role token tamper resistance;
- evidence dependency invalidation and review queueing;
- mutation, stability, calibration, and scope assurance;
- signed proof verification and tamper detection;
- counterfactual review, sealed escrow, interoperability exports, and privacy thresholding; and
- all-phase API surfaces and role denial.
- canonical product URLs and safe route fallback behavior.
- reporter-link token hashing, scoped preferences, and invalid-token rejection;
- signed deployed-verification proof separation; and
- live-target GitHub workflow generation plus privacy-thresholded radar disclosure.

Run:

```bash
npm test
npm run test:ci
npm run build
```

## Runtime modes and remaining external milestones

- The hosted judge demo is live at <https://redressci.onrender.com>; browser history, direct routes, role-boundary previews, search/filter controls, truthful metrics, and stricter reporter consent are implemented.
- Default judge mode is resettable and credential-free. `REDRESSCI_PERSIST=1` enables atomic durable snapshots.
- The PostgreSQL schema is production-ready, but a managed database must be provisioned before replacing the local adapter in a hosted environment.
- Artifacts are encrypted locally; a production deployment should connect the same metadata boundary to a managed regional object store and KMS.
- Live HTTP execution is disabled until operators provide an HTTPS hostname allowlist and server-side secret environment variable.
- The offline runner does not call a model grader. It keeps semantic checks inconclusive unless locally decidable.
- SSO policy is modeled and enforced as workspace configuration; connecting an actual identity provider requires organization credentials.
- Public publication, independent partner identity, reviewer compensation, and real design-partner cases require external people and cannot be manufactured in code.
- The hosted demo URL and narrated video require deployment and recording accounts.

## Next operational milestone

1. Provision managed PostgreSQL, object storage, KMS, and an identity provider before accepting sensitive pilot reports.
2. Enable the hosted GPT-5.6 secret only with an explicit deployment-secret decision; the public judge path remains deterministic without it.
3. Complete role-by-role deployed-browser and accessibility acceptance tests.
4. Record the narrated demonstration and submit it with the hosted URL.
5. Recruit real design partners and stewards; measure the roadmap success gates with real cases rather than synthetic counters.

See [PRODUCT_READINESS_AUDIT.md](./PRODUCT_READINESS_AUDIT.md) for the adoption, trust, and production-gap assessment.
