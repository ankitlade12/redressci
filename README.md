# RedressCI

> Turn real AI failures into tests that stay fixed.

RedressCI converts a reported AI failure into a privacy-safe, evidence-backed regression test, proves that it fails on the broken system and passes on the corrected one, and exports the test to CI so the same failure cannot silently return.

**OpenAI Build Week track:** Developer Tools

**Status:** runnable all-phase product foundation

**Demo data:** entirely fictional and synthetic

**Hosted demo:** <https://redressci.onrender.com>

## Why this exists

An AI failure usually becomes a support ticket. An eval usually begins with a dataset an engineer already has. The affected person is missing from the engineering loop, and a closed ticket does not prove that a fix works.

RedressCI creates a new bridge—**Remediation CI**:

```text
experience → privacy review → approved evidence → portable test
           → broken/fixed proof → reporter closure → CI protection
```

The central invariant is enforced in application logic: an evaluation cannot become verified unless it **fails on a known-broken response and passes on a corrected response**. Recorded-response proof is labeled separately from deployed-system verification.

## Judge quickstart

Requirements: Node.js 22+ and npm. Tested on macOS and designed to run on Linux and Windows.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). No login, API key, or proprietary target is needed for the synthetic judge path.

1. Select **Explore the verified evaluation**.
2. Inspect the experience, privacy state, approved evidence, and compiled evaluation.
3. Open **Validation** and select **Run validation gate**.
4. See version 1.3 fail and version 1.4 pass for evidence-linked reasons.
5. Open **CI export** to download the portable case and the Redress Receipt.

Use the **View privacy boundary as** selector in the sidebar to compare reporter, reviewer, developer, administrator, and independent-verifier access. The developer view is served without the reporter name or original transcript.

To exercise the full fresh-report lifecycle, select **Report a failure** and use synthetic information. Developers can instead select **Report internal incident** without gaining access to a community reporter's private evidence. Copy-ready examples are in [docs/REPORTING_GUIDE.md](./docs/REPORTING_GUIDE.md).

1. Submit a transcript and optional private artifact.
2. Compare the original with the proposed redaction and explicitly approve the shared version.
3. Add an exact evidence passage, approve expected behavior, and define one forbidden and one required check.
4. Register the reported broken response and a candidate corrected response.
5. Compile the portable test and run the comparative gate.

This path uses the same application rules as the seeded demonstration; evaluation-verified status is not preassigned and does not claim that a deployed system was called.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and Vite development server |
| `npm run build` | Type-check and create the production client bundle |
| `npm start` | Serve the production API and built client on port 8787 |
| `npm test` | Run grading, privacy-gate, compiler, receipt, and API integration tests |
| `npm run test:ci` | Run the supplied portable evaluation against the corrected demo target |

To demonstrate a CI failure locally:

```bash
npx tsx runner/cli.ts evals/cooling-center-accessibility-001.json --target broken
```

The process exits with status `1` and writes a machine-readable result under `results/`. Change the target to `fixed` and it exits `0`.

## GPT-5.6 integration

The complete synthetic demo is deterministic so judges can test it without credentials. Adding a key enables the live AI path:

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env, then restart the app.
```

The server defaults to `gpt-5.6`, the alias for GPT-5.6 Sol. Current OpenAI model documentation confirms GPT-5.6 supports text/image input and structured outputs through the Responses API: [OpenAI model guidance](https://developers.openai.com/api/docs/models) and [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

GPT-5.6 is used for:

- extracting a user/assistant interaction from text or an image while preserving uncertain text;
- generating a structured incident draft and reviewer questions;
- proposing nuanced semantic grading results grounded only in approved evidence; and
- returning strict JSON-schema outputs that the application can validate.

AI output never approves privacy, consent, evidence, expected behavior, or verified status. Uploaded content is explicitly treated as untrusted data, not model instructions.

Private attachments are read from encrypted server-side storage. Plain-text files can supply a transcript deterministically; images can supply one when live AI is configured; PDFs remain supporting evidence and require pasted conversation text. Live AI routes are capped by `REDRESSCI_AI_RATE_LIMIT_PER_HOUR` (default `20` per client per hour), and response sizes are bounded.

## Product capabilities

- Guided, non-technical reporter intake.
- A distinct internal-incident intake for developers with server-enforced ownership and privacy boundaries.
- Original/artifact separation from anonymized case data.
- Name, email, phone, and identifier redaction with explicit approval.
- Multimodal GPT-5.6 extraction interface with uncertainty.
- Structured incidents with questions instead of hidden assumptions.
- Versioned evidence and assertion-level citations.
- Explicit reviewer approval for evidence, expected behavior, assertions, and recorded targets.
- Declarative, provider-neutral evaluation JSON.
- Deterministic and semantic assertion types.
- Live GPT-5.6 semantic grading when configured, with an explicit offline/inconclusive path.
- Repeatable demo targets and compact run history.
- Enforced broken-versus-fixed comparative gate.
- Reporter-safe remediation timeline.
- CI runner, sample GitHub Actions workflow, and JSON result artifact.
- Ed25519-signed Redress Receipt with evaluation and proof hashes.
- One-click synthetic workspace reset.
- A live remediation loop that calls an allowlisted deployed endpoint, evaluates the real response, and issues a separate signed deployment proof.
- Private reporter status links with a simplified timeline, update preferences, receipt access, and consent withdrawal.
- GPT-5.6 evidence-source discovery over privacy-approved case text; every result remains a proposed candidate until human review.
- A downloadable deployed-target GitHub Actions check and optional GitHub Checks API publishing.
- A privacy-safe recurring-failure radar with minimum-group suppression.
- Permission-aware browser voice input for the interaction and impact fields, with editable text, actionable fallbacks, and no stored audio.

### Design-partner foundation

- Signed role tokens for reporter, reviewer, developer, administrator, and independent partner boundaries.
- Append-only consent changes and withdrawal.
- AES-256-GCM private artifact encryption and configurable regional metadata.
- Evidence version graph with exact dependency invalidation and automatic re-review queue.
- Idempotent background evaluation jobs.
- Recorded, HTTPS-allowlisted HTTP, and OpenAI-compatible adapters with server-side secret references.
- LangSmith, Braintrust, Langfuse, and OECD-compatible exports.

### Assurance and community network

- Mutation detection, grader calibration, repeat-run stability with 95% confidence intervals, severity policy, and a neighboring fix-scope guard.
- Multi-turn/tool trajectory schema and deterministic tool-call assertions.
- Ed25519 proof bundles, evidence pins, and a verifiable hash-chained audit log.
- Privacy-safe failure fingerprints and minimum-group suppression for aggregate patterns.
- Reviewer-controlled counterfactuals and semantic-versioned community packs.
- Maintainer conflict disclosure, compensation records, locale support, and WCAG 2.2 AA tracking.
- Encrypted independent-verification escrow.
- Workspace retention/region/SSO policy, remediation SLOs, recurrence, release blocking, integration delivery records, and non-legal regulatory crosswalks.

## Architecture

```text
React + TypeScript client
        │
        ▼
Express API ──────► encrypted private artifact boundary (data/encrypted)
   │
   ├── privacy + incident workflow
   ├── evidence-linked compiler
   ├── deterministic grader
   ├── optional GPT-5.6 Responses API service
   ├── comparative validation gate
   ├── assurance + governed pack engine
   ├── role, consent, evidence graph, jobs, SLO + recurrence policy
   └── signed proof/receipt + interoperability exporters
        │
        ▼
portable JSON case ──► standalone Node runner ──► CI result
        │
        └────────────► TypeScript SDK / third-party dataset exports
```

Important directories:

- `src/` — product interface and shared types.
- `server/` — API, OpenAI integration, compiler, grader, validation gate, and receipts.
- `runner/` — portable command-line evaluation runner.
- `sdk/` — small vendor-neutral TypeScript client for proof and recurrence workflows.
- `db/migrations/` — PostgreSQL production schema spanning all roadmap phases.
- `evals/` — generated, privacy-safe evaluation fixtures.
- `fixtures/` — fictional source data and demo targets.
- `docs/` — competitive research, roadmap, architecture decisions, and demo assets.
- `.github/workflows/` — runnable sample CI integration.

Judge mode uses resettable process state for reliability. Setting `REDRESSCI_PERSIST=1` enables durable atomic local snapshots. The repository also includes a complete PostgreSQL schema for managed production deployments; encrypted local artifacts, signed identities, idempotent jobs, evidence invalidation, and asynchronous job state are implemented now.

## Assurance Network demo

Open **Assurance network** in the sidebar, then select **Run full assurance suite**. RedressCI will:

1. mutate the known-fixed answer to confirm the evaluation catches approved failure modes;
2. calculate rule/model agreement and inconclusive rates;
3. repeat the fixed run according to severity and record a 95% confidence interval;
4. execute the neighboring privacy/fix-scope guard;
5. propose governed multilingual and accessibility variations; and
6. seal hidden evaluation material for the synthetic independent partner.

The page then exposes a signed proof bundle and OECD-compatible record without including reporter originals.

## API

The main implemented endpoints are:

```text
GET    /api/health
GET    /api/cases
GET    /api/cases/:id
POST   /api/cases
POST   /api/cases/:id/artifacts
POST   /api/cases/:id/extract
POST   /api/cases/:id/redact
POST   /api/cases/:id/structure
POST   /api/cases/:id/evidence
POST   /api/cases/:id/evidence/:evidenceId/review
POST   /api/cases/:id/review-expected-behavior
PUT    /api/cases/:id/assertions
PUT    /api/cases/:id/targets
POST   /api/cases/:id/compile
POST   /api/cases/:id/runs
POST   /api/cases/:id/validate
POST   /api/cases/:id/live-verify
GET    /api/cases/:id/deployment-proof
POST   /api/cases/:id/status
POST   /api/cases/:id/reporter-link
POST   /api/cases/:id/evidence/discover
GET    /api/cases/:id/github-check
GET    /api/cases/:id/github-workflow
POST   /api/cases/:id/github-check
GET    /api/cases/:id/export
GET    /api/cases/:id/receipt
POST   /api/reset

GET    /api/platform
GET    /api/platform/readiness
GET    /api/platform/audit
POST   /api/cases/:id/consent
PUT    /api/cases/:id/evidence/:evidenceId/version
POST   /api/cases/:id/jobs
POST   /api/cases/:id/assurance
GET    /api/cases/:id/proof
POST   /api/platform/proofs/verify
POST   /api/cases/:id/counterfactuals
POST   /api/cases/:id/escrow
GET    /api/cases/:id/export/:provider
GET    /api/cases/:id/oecd
GET    /api/cases/:id/slo
POST   /api/cases/:id/recurrences
GET    /api/platform/patterns
PUT    /api/platform/workspace/policy
POST   /api/platform/integrations/:id/deliver

GET    /api/public/status/:token
PUT    /api/public/status/:token/preferences
GET    /api/public/status/:token/receipt
POST   /api/public/status/:token/withdraw
```

## Production configuration and deployment

Copy `.env.example` and set secrets through the deployment platform rather than committing them. Important controls are:

```text
REDRESSCI_PERSIST=1
REDRESSCI_AUTH_SECRET=<random secret>
REDRESSCI_AUTH_REQUIRED=1
REDRESSCI_STORAGE_KEY=<random encryption secret>
REDRESSCI_ESCROW_KEY=<separate random encryption secret>
REDRESSCI_SIGNING_PRIVATE_KEY=<stable Ed25519 PEM private key>
REDRESSCI_STORAGE_REGION=us
REDRESSCI_TARGET_ALLOWLIST=api.example.org
REDRESSCI_TARGET_TOKEN=<server-side deployed-target token>
REDRESSCI_GITHUB_REPOSITORY=owner/repository
REDRESSCI_GITHUB_TOKEN=<GitHub App installation token>
```

Live adapters require HTTPS and a hostname in `REDRESSCI_TARGET_ALLOWLIST`; the hostname is rechecked immediately before every request. Credentials are looked up only from named server environment variables. The included `Dockerfile` and `render.yaml` provide a judge-ready deployment definition.

`Verified fixed` is reserved for an actual pass from `POST /api/cases/:id/live-verify`. The earlier recorded-response comparison remains labeled `Evaluation verified`. GitHub workflow generation needs no GitHub credential; posting a check run additionally requires `REDRESSCI_GITHUB_REPOSITORY` and a short-lived GitHub App installation token in `REDRESSCI_GITHUB_TOKEN`.

When `REDRESSCI_AUTH_REQUIRED=1`, anonymous and invalid-token requests cannot inherit demo access. Provision initial short-lived bearer tokens server-side with:

```bash
npm run auth:token -- admin member-admin "Workspace administrator"
```

The command signs the role and workspace claims with `REDRESSCI_AUTH_SECRET`; do not run it in a client or expose that secret to the browser.

For a managed production environment, apply [the PostgreSQL migration](db/migrations/001_all_phases.sql), replace the local state adapter with PostgreSQL transactions, and map the encrypted artifact boundary to a regional object store/KMS. SSO and third-party integration delivery require the organization’s identity-provider and app credentials.

## Safety and privacy boundaries

- The public test fixture contains no original reporter identity.
- Originals are written only under the private artifact boundary and are excluded from Git.
- Uploaded formats and size are restricted; uploaded code is never executed.
- Private uploads are encrypted with AES-256-GCM before being written to disk.
- Credentials stay server-side and are never included in generated tests.
- Model output cannot directly change consent or verification state.
- Compilation is blocked when reviewed evidence or assertions still appear to contain personal data.
- Assertions cannot compile unless they cite approved evidence.
- Inconclusive grading remains explicit and cannot silently become a pass.
- Evidence changes invalidate dependent assertions, evaluations, packs, and receipts instead of silently preserving stale assurance.
- Signed proof and receipt verification fails after payload tampering.
- Aggregate fingerprint groups below the workspace privacy threshold are suppressed.
- “Evaluation verified” means one scoped test distinguished approved recorded responses; it does not prove a deployed fix or provide a system-wide safety certification.
- The MVP never names a real organization or uses a real high-consequence case.

## How Codex shaped the project

The majority of this product was built with Codex during OpenAI Build Week. Codex helped:

- translate the product specification into a complete vertical architecture;
- research the official challenge requirements and adjacent product landscape;
- implement the React interface, API, evaluation compiler, portable runner, and tests;
- identify and enforce the highest-risk invariants in code;
- create the synthetic fixture, CI workflow, competitive analysis, and roadmap; and
- type-check, test, and iterate on failures discovered during verification.

Human product decisions remained explicit: choosing the affected person as the start of the workflow, requiring evidence before assertions, making privacy approval a hard gate, requiring comparative proof before verification, and positioning RedressCI as integration infrastructure rather than a replacement for observability tools.

For the Devpost submission, add the `/feedback` Codex Session ID from the project thread to the submission form.

## Research and roadmap

- [Competitive research and novelty strategy](docs/COMPETITIVE_RESEARCH.md)
- [Prioritized product roadmap](docs/PRODUCT_ROADMAP.md)
- [Current implementation status and enforced invariants](docs/IMPLEMENTATION_STATUS.md)
- [Product readiness and adoption audit](docs/PRODUCT_READINESS_AUDIT.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Original product specification](RedressCI_Feature_Specification.md)

## Hackathon compliance

- Category: Developer Tools.
- Built with Codex and GPT-5.6.
- Working, installable project with a credential-free judge path.
- Public repository may be submitted under the included MIT license.
- README includes setup, sample data, supported platforms, architecture, and AI collaboration.
- Video script is under three minutes and explicitly explains Codex and GPT-5.6 usage.

The official deadline is July 21, 2026 at 5:00 PM Pacific. Review the [challenge page](https://openai.devpost.com/) and [official rules](https://openai.devpost.com/rules) before submission.

## License

MIT. See [LICENSE](LICENSE).
