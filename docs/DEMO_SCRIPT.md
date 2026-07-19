# RedressCI Three-Minute Demo Script

**Target duration:** 2:45–2:55  
**Rule:** show executed proof, not a slideshow of features.

## 0:00–0:22 — Show the complete journey

**Screen:** Landing page. Pause on the four-step judge path and the GPT-5.6 card, then select **Start the guided demo**.

**Narration:**

“RedressCI follows one clear path: report the failure, review the evidence, prove the fix, and prevent the regression in CI. GPT-5.6 helps structure messy reports, discover evidence candidates, and grade semantic behavior. Human reviewers still control privacy, evidence, consent, and verified status.”

## 0:22–0:52 — 1. Report the failure

**Screen:** Select Reporter, open the synthetic case, and show the reported interaction and privacy boundary.

**Narration:**

“This synthetic resident requested a wheelchair-accessible cooling center and received an unsafe stairs-only recommendation. RedressCI keeps the original experience private, separates it from the evaluation, and records the reporter’s consent.”

**Optional two-second proof:** switch to Developer and reopen the case; the server-provided view shows `[REDACTED]` and omits the original transcript.

## 0:52–1:22 — 2. Review the evidence

**Screen:** Show Evidence, then Evaluation. Point to an evidence citation and the GPT-5.6 semantic assertion.

**Narration:**

“GPT-5.6 turns unstructured evidence into review candidates and handles the semantic check that keyword rules cannot. Deterministic requirements stay deterministic, every assertion cites an approved source, and only a human reviewer can approve what correct behavior means.”

## 1:22–1:58 — 3. Prove the fix

**Screen:** Validation tab; select “Run validation gate.”

**Narration:**

“A plausible test is not enough. RedressCI runs the same case against reviewer-approved recorded responses. The recorded version 1.3 response fails because it recommends Central Hall and omits the accessible option. The recorded version 1.4 response passes because it recommends River Library and grounds the answer in the approved facility record. The application labels this as evaluation verification; deployed-fix verification requires a live adapter run.”

## 1:58–2:30 — 4. Prevent regression through CI

**Screen:** Show the receipt briefly, then open CI Export and point to the generated GitHub Actions workflow.

**Narration:**

“The reporter gets a plain-language timeline and a tamper-evident Redress Receipt describing exactly what was proven. The developer exports the privacy-safe case to CI. If the behavior returns after a prompt, model, retrieval, or code change, the runner exits non-zero and the original case can reopen.”

## 2:30–2:52 — Close on the difference

**Screen:** Open Assurance network, then show the signed proof download.

**Narration:**

“Incident databases remember failures. Eval platforms score developer datasets. RedressCI connects the affected person to the engineering fix, tests the test with mutations, and carries signed proof into releases and governed community packs. One person’s experience becomes protection for everyone who comes next.”

## Recording checklist

- Keep the video publicly visible on YouTube.
- Use audio and explicitly state how both Codex and GPT-5.6 were used.
- Do not include copyrighted music, real brands, or real personal information.
- Show the validation button being selected and both results appearing.
- Keep the four-stage language consistent on screen and in narration: Report → Review → Prove → Prevent regression.
- Point to the GPT-5.6 semantic assertion so the model contribution is visible, not merely narrated.
- Show one role-boundary transition; avoid spending time touring every role.
- Keep the final upload below three minutes; judges are not required to watch beyond it.
- Run the Assurance network suite once before recording so its mutation and stability metrics are visible.
- Download the signed proof bundle only after the comparative gate is verified.
