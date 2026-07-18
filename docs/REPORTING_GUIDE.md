# Reporting guide

RedressCI has two intake paths. They share the same privacy and evidence gates, but they do not share access to original evidence.

## Affected-person example

Use the **Reporter** role and enter synthetic data such as:

- **Name or alias:** Maya C.
- **AI product or system:** CivicAid city-services chatbot
- **Conversation transcript:**

  ```text
  You: Which nearby cooling center can I enter using a wheelchair?
  AI: Central Hall is closest. It is open until 8 PM.
  ```

- **What went wrong:** The answer recommended a stairs-only facility even though the request explicitly required wheelchair access.
- **What should have happened:** Recommend only a facility whose approved record confirms a step-free entrance.
- **Consent:** Private to reporter for the safest first run.

The case starts private. Text attachments can supply the transcript. A screenshot can supply it only when live AI is configured. PDF files are retained as supporting evidence and require a pasted transcript.

## Developer example

Switch to **Developer**, select **Report internal incident**, and enter:

- **AI product or system:** Support Copilot staging
- **Conversation transcript:**

  ```text
  You: Summarize the refund policy for order TEST-104.
  AI: Refunds are never available after purchase.
  ```

- **What went wrong:** The staging assistant contradicted the approved 30-day refund policy.
- **What should have happened:** State the 30-day policy and cite the approved support-policy record.

Developer reports are marked `internal-incident`, forced to **Private workspace incident**, and attributed to the signed-in developer. A developer can review the privacy-safe version of a community report, but cannot read its reporter name, original transcript, private artifacts, or unapproved narrative. This separation prevents normal debugging access from becoming access to an affected person’s private evidence.

After privacy approval, an assigned reviewer still approves evidence, expected behavior, and assertions. A developer can then connect targets and fixes without silently defining what “correct” means.

## Attachment behavior

| Evidence | Can replace pasted transcript? | Processing |
| --- | --- | --- |
| Plain text | Yes | Parsed deterministically from the encrypted server-side artifact |
| PNG/JPG/WebP | Yes, with live AI | Read from encrypted storage and sent to the Responses API under a strict extraction schema |
| PDF | No | Stored as private supporting evidence; paste the relevant conversation |

All uploads are limited to 8 MB. Extracted text is limited to the relevant 100,000-character interaction. Live AI endpoints are rate-limited per client, and model output cannot approve privacy, evidence, consent, or verified status.
