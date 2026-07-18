# RedressCI Implementation Status

**Updated:** July 18, 2026

## Working end to end

- Credential-free seeded judge demonstration.
- Fresh reporter-created case workflow.
- Text transcript parsing and private artifact upload.
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

## Enforced invariants

1. Privacy approval is required before evidence review.
2. Approved evidence is required before expected-behavior approval.
3. Expected behavior and assertions require explicit reviewer action.
4. Assertions without approved evidence references cannot compile.
5. Reviewed content containing apparent personal data cannot compile.
6. Both recorded target responses are required before validation.
7. Verified status cannot be set until comparative execution succeeds.
8. A Redress Receipt cannot be issued without stored broken/fixed proof.

## Automated verification

The suite currently covers:

- broken-target failure and corrected-target success;
- validation-gate ordering;
- inconclusive semantic behavior;
- API judge path and receipt issuance;
- privacy and evidence compilation gates;
- personal-data leak blocking;
- expected-behavior approval;
- privacy detection and manual reintroduction detection; and
- a complete fresh-report lifecycle through verified status.

Run:

```bash
npm test
npm run test:ci
npm run build
```

## Intentional MVP boundaries

- Case state is in memory for deterministic demo reset.
- Roles are represented in workflow metadata but not authenticated.
- Original artifacts use a local private directory rather than encrypted object storage.
- Generic HTTP targets are represented by recorded responses; live outbound target execution is not enabled because SSRF allowlisting and secret management need production infrastructure.
- The offline runner does not call a model grader. It keeps semantic checks inconclusive unless locally decidable.
- Public publication and real-world consequential cases remain out of scope.

## Next engineering milestone

Build the design-partner foundation:

1. PostgreSQL schema and migrations for cases, evidence, approvals, targets, runs, receipts, and audit events.
2. Authenticated reporter, reviewer, and developer roles.
3. Encrypted object storage with retention and deletion jobs.
4. Background evaluation queue with idempotency keys.
5. Allowlisted HTTP target adapter with server-side secrets.
6. Evidence-version dependency graph and automatic invalidation.
7. Signed Redress Receipts using a workspace verification key.
