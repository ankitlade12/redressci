#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EvaluationCase } from "../src/types.js";
import { runEvaluation } from "../server/evaluation.js";

function usage() {
  console.error("Usage: tsx runner/cli.ts <evaluation.json> --target <broken|fixed> [--response <text>]");
  process.exit(2);
}

const args = process.argv.slice(2);
if (!args[0]) usage();
const targetIndex = args.indexOf("--target");
const target = args[targetIndex + 1];
if (target !== "broken" && target !== "fixed") usage();
const selectedTarget = target as "broken" | "fixed";
const responseIndex = args.indexOf("--response");
const targetResponse = responseIndex >= 0 ? args[responseIndex + 1] : undefined;
const file = path.resolve(args[0]);
const evaluation = JSON.parse(readFileSync(file, "utf8")) as EvaluationCase;
const result = runEvaluation(evaluation, selectedTarget, targetResponse);

mkdirSync(path.resolve("results"), { recursive: true });
const output = path.resolve("results", `${evaluation.id}-${selectedTarget}.json`);
writeFileSync(output, JSON.stringify(result, null, 2));

const symbol = result.state === "pass" ? "✓" : result.state === "fail" ? "✗" : "?";
console.log(`${symbol} ${evaluation.title}: ${result.state.toUpperCase()} (${Math.round(result.score * 100)}%)`);
for (const assertion of result.assertionResults) console.log(`  ${assertion.state === "pass" ? "✓" : assertion.state === "fail" ? "✗" : "?"} ${assertion.label} — ${assertion.explanation}`);
console.log(`Machine-readable result: ${output}`);
process.exitCode = result.state === "pass" ? 0 : 1;
