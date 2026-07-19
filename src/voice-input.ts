export function appendSpeechTranscript(current: string, transcript: string) {
  const addition = transcript.trim();
  if (!addition) return current;
  const existing = current.trimEnd();
  return `${existing}${existing ? "\n" : ""}${addition}`;
}

export function speechRecognitionErrorMessage(error: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow microphone access for this site in your browser settings, then try again.";
    case "audio-capture":
      return "No working microphone was found. Check your microphone connection and browser input settings.";
    case "network":
      return "The browser speech service could not connect. Check your connection or type the interaction instead.";
    case "no-speech":
      return "No speech was detected. Try again and speak after the listening indicator appears.";
    case "language-not-supported":
      return "Speech recognition does not support the selected browser language. Change the browser language or type instead.";
    case "aborted":
      return "Voice input stopped. Review any text that was added before continuing.";
    default:
      return "Voice input could not continue. Check microphone permission and try again, or type instead.";
  }
}

export function microphoneErrorMessage(error: unknown) {
  const name = typeof error === "object" && error && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return speechRecognitionErrorMessage("not-allowed");
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return speechRecognitionErrorMessage("audio-capture");
  if (name === "NotReadableError" || name === "TrackStartError") return "The microphone is busy or unavailable. Close other apps using it, then try again.";
  return "RedressCI could not open the microphone. Check browser permission and input settings, then try again.";
}
