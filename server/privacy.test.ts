import assert from "node:assert/strict";
import test from "node:test";
import { findUnredactedPersonalData, proposeRedaction } from "./privacy.js";

test("privacy proposal removes names, email, phone, and account identifiers", () => {
  const source = "Maya Chen: email maya@example.com or call 312-555-0188 about account AB123456.";
  const result = proposeRedaction(source, "Maya Chen");
  assert.equal(result.redacted.includes("Maya"), false);
  assert.equal(result.redacted.includes("maya@example.com"), false);
  assert.equal(result.redacted.includes("312-555-0188"), false);
  assert.match(result.redacted, /\[PERSON\]/);
  assert.match(result.redacted, /\[EMAIL\]/);
  assert.match(result.redacted, /\[PHONE\]/);
});

test("privacy approval detects manually reintroduced personal data", () => {
  const result = proposeRedaction("Maya Chen: hello", "Maya Chen");
  assert.deepEqual(findUnredactedPersonalData("Maya Chen: hello", result.redactions), ["Person name"]);
});
