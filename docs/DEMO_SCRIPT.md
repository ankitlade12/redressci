# RedressCI Three-Minute Demo Script

**Target duration:** 2:45–2:55  
**Rule:** show executed proof, not a slideshow of features.

## 0:00–0:18 — The failure

**Screen:** Landing page, then open the verified evaluation.

**Narration:**

“When an AI system gives a harmful or inaccessible answer, the experience usually becomes a support ticket. Even if someone fixes it, the affected person rarely sees proof, and nothing guarantees the failure will stay fixed. RedressCI turns that experience into permanent regression protection.”

## 0:18–0:52 — Person, privacy, evidence

**Screen:** Briefly select Reporter in the role switcher, open the case, then show Overview and Evidence.

**Narration:**

“This synthetic resident asked for a wheelchair-accessible cooling center and was directed to Central Hall, which has stairs and no lift. RedressCI keeps the original report private, removes the person’s name, and records their consent. A human reviewer approves the source records and expected behavior. Every generated assertion points back to exact evidence.”

**Optional two-second proof:** switch to Developer and reopen the case; the server-provided view shows `[REDACTED]` and omits the original transcript.

## 0:52–1:20 — Compile the evaluation

**Screen:** Evaluation tab; scroll through assertions and JSON.

**Narration:**

“GPT-5.6 structures the incident, surfaces uncertainty, and helps propose nuanced grading criteria. Deterministic checks remain deterministic. Codex helped build the portable compiler, target adapters, runner, CI workflow, and this complete product experience. AI can propose, but it cannot approve privacy, evidence, consent, or verified status.”

## 1:20–1:58 — Comparative proof

**Screen:** Validation tab; select “Run validation gate.”

**Narration:**

“A plausible test is not enough. RedressCI runs the same case against reviewer-approved recorded responses. The recorded version 1.3 response fails because it recommends Central Hall and omits the accessible option. The recorded version 1.4 response passes because it recommends River Library and grounds the answer in the approved facility record. The application labels this as evaluation verification; deployed-fix verification requires a live adapter run.”

## 1:58–2:27 — Closure and CI

**Screen:** Timeline, then CI Export.

**Narration:**

“The reporter gets a plain-language timeline and a tamper-evident Redress Receipt describing exactly what was proven. The developer exports the privacy-safe case to CI. If the behavior returns after a prompt, model, retrieval, or code change, the runner exits non-zero and the original case can reopen.”

## 2:27–2:52 — Vision and differentiation

**Screen:** Open Assurance network, then show the signed proof download.

**Narration:**

“Incident databases remember failures. Eval platforms score developer datasets. RedressCI connects the affected person to the engineering fix, tests the test with mutations, and carries signed proof into releases and governed community packs. One person’s experience becomes protection for everyone who comes next.”

## Recording checklist

- Keep the video publicly visible on YouTube.
- Use audio and explicitly state how both Codex and GPT-5.6 were used.
- Do not include copyrighted music, real brands, or real personal information.
- Show the validation button being selected and both results appearing.
- Show one role-boundary transition; avoid spending time touring every role.
- Keep the final upload below three minutes; judges are not required to watch beyond it.
- Run the Assurance network suite once before recording so its mutation and stability metrics are visible.
- Download the signed proof bundle only after the comparative gate is verified.
