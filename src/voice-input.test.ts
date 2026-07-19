import assert from "node:assert/strict";
import test from "node:test";
import { appendSpeechTranscript, microphoneErrorMessage, speechRecognitionErrorMessage } from "./voice-input";

test("voice transcripts append without erasing previously entered evidence", () => {
  assert.equal(appendSpeechTranscript("You: Hello", " AI: Hi "), "You: Hello\nAI: Hi");
  assert.equal(appendSpeechTranscript("", " Spoken text "), "Spoken text");
  assert.equal(appendSpeechTranscript("Existing", "   "), "Existing");
});

test("voice failures provide actionable permission and device guidance", () => {
  assert.match(speechRecognitionErrorMessage("not-allowed"), /Allow microphone access/);
  assert.match(speechRecognitionErrorMessage("no-speech"), /No speech was detected/);
  assert.match(microphoneErrorMessage({ name: "NotFoundError" }), /No working microphone/);
  assert.match(microphoneErrorMessage({ name: "NotReadableError" }), /microphone is busy/);
});
