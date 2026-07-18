export interface RedactionFinding {
  value: string;
  replacement: string;
  type: string;
}

const patterns = [
  { type: "Email address", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL]" },
  { type: "Phone number", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, replacement: "[PHONE]" },
  { type: "Account identifier", regex: /\b(?:account|member|case)[-\s#:]*(?:id[-\s:]*)?[A-Z0-9]{6,}\b/gi, replacement: "[ACCOUNT_ID]" },
];

export function proposeRedaction(source: string, reporterName?: string) {
  let redacted = source;
  const redactions: RedactionFinding[] = [];
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern.regex, (value: string) => {
      redactions.push({ value, replacement: pattern.replacement, type: pattern.type });
      return pattern.replacement;
    });
  }
  if (reporterName && reporterName !== "Reporter") {
    for (const name of [reporterName, reporterName.split(" ")[0]].filter((value) => value.length > 1)) {
      const matcher = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      if (matcher.test(redacted)) {
        redactions.push({ value: name, replacement: "[PERSON]", type: "Person name" });
        redacted = redacted.replace(matcher, "[PERSON]");
      }
    }
  }
  return { redacted, redactions };
}

export function findUnredactedPersonalData(candidate: string, findings: RedactionFinding[]) {
  const leaks = new Set<string>();
  for (const finding of findings) {
    if (candidate.toLocaleLowerCase().includes(finding.value.toLocaleLowerCase())) leaks.add(finding.type);
  }
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(candidate)) leaks.add(pattern.type);
  }
  return [...leaks];
}
