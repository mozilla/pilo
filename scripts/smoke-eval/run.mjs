#!/usr/bin/env node
// Smoke-eval runner: executes pilo-cli against a single trivial task and
// asserts the agent's final answer contains an expected substring.
//
// Intended to exercise the Pilo stack end-to-end (CLI -> agent -> Playwright
// -> LLM) on every PR / merge to main. Not a quality benchmark.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");

const TASKS_FILE = process.env.SMOKE_EVAL_TASKS_FILE
  ? resolve(process.env.SMOKE_EVAL_TASKS_FILE)
  : resolve(SCRIPT_DIR, "test.jsonl");
const CLI_ENTRY = resolve(REPO_ROOT, "packages/cli/dist/cli/src/cli.js");
const PROVIDER = process.env.SMOKE_EVAL_PROVIDER ?? "vertex";
const MODEL = process.env.SMOKE_EVAL_MODEL ?? "gemini-2.5-flash";
const TIMEOUT_MS = Number.parseInt(process.env.SMOKE_EVAL_TIMEOUT_MS ?? "180000", 10);
const LOG_DIR = resolve(REPO_ROOT, ".smoke-eval-output");

function fail(message, exitCode = 1) {
  process.stderr.write(`❌ ${message}\n`);
  process.exit(exitCode);
}

function readFirstTask(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    fail(`Tasks file not found: ${path} (${err.message})`, 2);
  }
  const line = raw.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) fail(`Tasks file is empty: ${path}`, 2);
  try {
    return JSON.parse(line);
  } catch (err) {
    fail(`Tasks file first line is not valid JSON: ${err.message}`, 2);
  }
}

function ensureCliBuilt() {
  try {
    readFileSync(CLI_ENTRY);
  } catch {
    fail(
      `pilo-cli is not built. Run: pnpm --filter pilo-cli build\n   (expected at ${CLI_ENTRY})`,
      2,
    );
  }
}

function runAgent({ question, url }) {
  return new Promise((resolvePromise) => {
    const args = [
      CLI_ENTRY,
      "run",
      question,
      "--url",
      url,
      "--browser",
      "chromium",
      "--headless",
      "--logger",
      "json",
      "--provider",
      PROVIDER,
      "--model",
      MODEL,
    ];
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutBuf += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrBuf += text;
      process.stderr.write(text);
    });

    const timer = setTimeout(() => {
      process.stderr.write(`⏱️  Killing agent after ${TIMEOUT_MS}ms timeout\n`);
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal, stdout: stdoutBuf, stderr: stderrBuf });
    });
  });
}

function extractFinalAnswer(ndjson) {
  let finalAnswer = null;
  let abortReason = null;
  for (const line of ndjson.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.event === "task:completed" && evt.data && typeof evt.data.finalAnswer === "string") {
      finalAnswer = evt.data.finalAnswer;
    }
    if (evt.event === "task:aborted" && evt.data && typeof evt.data.reason === "string") {
      abortReason = evt.data.reason;
    }
  }
  return { finalAnswer, abortReason };
}

async function main() {
  ensureCliBuilt();
  const task = readFirstTask(TASKS_FILE);
  for (const field of ["id", "url", "question", "answer"]) {
    if (typeof task[field] !== "string" || !task[field]) {
      fail(`Task is missing required field "${field}"`, 2);
    }
  }

  mkdirSync(LOG_DIR, { recursive: true });
  const logFile = resolve(LOG_DIR, `${task.id}.ndjson.log`);

  process.stdout.write(
    [
      `🚀 Smoke eval: ${task.id}`,
      `   URL:      ${task.url}`,
      `   Question: ${task.question}`,
      `   Expected: ${task.answer}`,
      `   Provider: ${PROVIDER} (${MODEL})`,
      `   Timeout:  ${TIMEOUT_MS}ms`,
      `   Log:      ${logFile}`,
      "",
    ].join("\n"),
  );

  const { code, signal, stdout } = await runAgent(task);
  writeFileSync(logFile, stdout);

  if (signal === "SIGKILL") {
    fail(`Agent killed by smoke-eval timeout (${TIMEOUT_MS}ms)`);
  }
  if (code !== 0) {
    fail(`Agent exited with status ${code}`);
  }

  const { finalAnswer, abortReason } = extractFinalAnswer(stdout);
  if (abortReason && finalAnswer === null) {
    fail(`Agent aborted: ${abortReason}`);
  }
  if (finalAnswer === null) {
    fail("No task:completed event with finalAnswer found in agent output");
  }

  process.stdout.write(`\nAgent answer: ${finalAnswer}\n`);

  const ok = finalAnswer.toLowerCase().includes(task.answer.toLowerCase());
  if (!ok) {
    fail(`Smoke eval failed: expected answer to contain "${task.answer}"`);
  }

  process.stdout.write(`✅ Smoke eval passed (answer contains "${task.answer}")\n`);
}

main().catch((err) => {
  fail(`Unexpected error: ${err.stack ?? err.message ?? String(err)}`);
});
