# RedressCI

> Turn real AI failures into tests that stay fixed.

RedressCI converts a reported AI failure into a privacy-safe, evidence-backed regression test, proves that it fails on the broken system and passes on the corrected one, and exports the test to CI so the same failure cannot silently return.

**OpenAI Build Week track:** Developer Tools  
**Status:** runnable hackathon MVP  
**Demo data:** entirely fictional and synthetic

## Why this exists

An AI failure usually becomes a support ticket. An eval usually begins with a dataset an engineer already has. The affected person is missing from the engineering loop, and a closed ticket does not prove that a fix works.

RedressCI creates a new bridge—**Remediation CI**:

```text
experience → privacy review → approved evidence → portable test
           → broken/fixed proof → reporter closure → CI protection
```

The central invariant is enforced in application logic: a case cannot become verified unless the same evaluation **fails on a known-broken target and passes on a corrected target**.

## Judge quickstart

Requirements: Node.js 20+ and npm. Tested on macOS and designed to run on Linux and Windows.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). No login, API key, or proprietary target is needed for the synthetic judge path.

1. Select **Explore the verified demo**.
2. Inspect the experience, privacy state, approved evidence, and compiled evaluation.
3. Open **Validation** and select **Run validation gate**.
4. See version 1.3 fail and version 1.4 pass for evidence-linked reasons.
5. Open **CI export** to download the portable case and the Redress Receipt.

To exercise the full fresh-report lifecycle, select **Report a failure** and use synthetic information:

1. Submit a transcript and optional private artifact.
2. Compare the original with the proposed redaction and explicitly approve the shared version.
3. Add an exact evidence passage, approve expected behavior, and define one forbidden and one required check.
4. Register the reported broken response and a candidate corrected response.
5. Compile the portable test and run the comparative gate.

This path uses the same application rules as the seeded demonstration; verified status is not preassigned.

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

## Product capabilities

- Guided, non-technical reporter intake.
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
- Tamper-evident Redress Receipt with evaluation and proof hashes.
- One-click synthetic workspace reset.

## Architecture

```text
React + TypeScript client
        │
        ▼
Express API ──────► private artifact boundary (data/originals)
   │
   ├── privacy + incident workflow
   ├── evidence-linked compiler
   ├── deterministic grader
   ├── optional GPT-5.6 Responses API service
   ├── comparative validation gate
   └── proof/receipt exporter
        │
        ▼
portable JSON case ──► standalone Node runner ──► CI result
```

Important directories:

- `src/` — product interface and shared types.
- `server/` — API, OpenAI integration, compiler, grader, validation gate, and receipts.
- `runner/` — portable command-line evaluation runner.
- `evals/` — generated, privacy-safe evaluation fixtures.
- `fixtures/` — fictional source data and demo targets.
- `docs/` — competitive research, roadmap, architecture decisions, and demo assets.
- `.github/workflows/` — runnable sample CI integration.

The MVP uses an in-memory case store for instant reset and judge reliability. The production roadmap replaces this with a relational database, encrypted object storage, authenticated workspaces, and asynchronous evaluation jobs.

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
POST   /api/cases/:id/status
GET    /api/cases/:id/export
GET    /api/cases/:id/receipt
POST   /api/reset
```

## Safety and privacy boundaries

- The public test fixture contains no original reporter identity.
- Originals are written only under the private artifact boundary and are excluded from Git.
- Uploaded formats and size are restricted; uploaded code is never executed.
- Credentials stay server-side and are never included in generated tests.
- Model output cannot directly change consent or verification state.
- Compilation is blocked when reviewed evidence or assertions still appear to contain personal data.
- Assertions cannot compile unless they cite approved evidence.
- Inconclusive grading remains explicit and cannot silently become a pass.
- “Verified” means one scoped behavior passed comparative validation; it is not a system-wide safety certification.
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
