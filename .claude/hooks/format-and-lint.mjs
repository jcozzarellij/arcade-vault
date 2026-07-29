#!/usr/bin/env node
// PostToolUse hook (Write|Edit): runs Prettier, then ESLint --fix, on the
// file that was just written/edited. Never fails the tool call — worst case
// it reports remaining ESLint issues back into context.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const LINTABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
]);

const EXCLUDED_DIR_SEGMENTS = new Set([
  "node_modules",
  ".next",
  "out",
  "build",
  "references",
]);

async function main() {
  let raw = "";
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString("utf8");
  } catch {
    process.exit(0);
  }

  if (!raw.trim()) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const filePath =
    payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;

  if (!filePath || typeof filePath !== "string") process.exit(0);

  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(PROJECT_ROOT, filePath);

  if (!absPath.startsWith(PROJECT_ROOT)) process.exit(0);
  if (!existsSync(absPath)) process.exit(0);

  const relPath = path.relative(PROJECT_ROOT, absPath);
  const segments = relPath.split(path.sep);
  if (segments.some((seg) => EXCLUDED_DIR_SEGMENTS.has(seg))) process.exit(0);

  // Prettier: safe to run on anything, --ignore-unknown skips filetypes it
  // doesn't format (and anything matched by .prettierignore).
  const prettierBin = path.join(
    PROJECT_ROOT,
    "node_modules",
    "prettier",
    "bin",
    "prettier.cjs"
  );
  if (existsSync(prettierBin)) {
    spawnSync(process.execPath, [prettierBin, "--write", "--ignore-unknown", absPath], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
    });
  }

  const ext = path.extname(absPath).toLowerCase();
  if (!LINTABLE_EXTENSIONS.has(ext)) process.exit(0);

  const eslintBin = path.join(
    PROJECT_ROOT,
    "node_modules",
    "eslint",
    "bin",
    "eslint.js"
  );
  if (!existsSync(eslintBin)) process.exit(0);

  const result = spawnSync(
    process.execPath,
    [eslintBin, "--fix", "--no-warn-ignored", absPath],
    { cwd: PROJECT_ROOT, encoding: "utf8" }
  );

  if (result.status && result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    console.log(
      JSON.stringify({
        systemMessage: `ESLint: problemas sin resolver en ${relPath}`,
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `ESLint issues remain in ${relPath}:\n${output}`,
        },
      })
    );
  }

  process.exit(0);
}

main();
