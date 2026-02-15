import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, "..", "shared", "sample", "codegenOutput");
const rootDir = __dirname;
const workflowDir = join(__dirname, "cre-testing-workflow");

// Files that go into cre-testing-workflow/
const workflowFiles = new Set([
  "main.ts",
  "tsconfig.json",
  "package.json",
  "workflow.yaml",
  "config.staging.json",
  "config.production.json",
]);

const flagIndex = process.argv.indexOf("--filename");
let filename;

if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
  filename = process.argv[flagIndex + 1];
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  const files = readdirSync(samplesDir).filter((f) => f.endsWith(".json"));
  console.log("Available codegen outputs:");
  files.forEach((f) => console.log(`  - ${f}`));
  console.log();

  filename = await ask("Enter filename (e.g. simple-cron-http.json): ");
  rl.close();
}

const jsonPath = join(samplesDir, filename);
const data = JSON.parse(readFileSync(jsonPath, "utf-8"));

if (data.status !== "success") {
  console.error(`Error: codegen status is '${data.status}', not 'success'`);
  process.exit(1);
}

console.log(`\nWriting ${data.files.length} files ...`);

for (const file of data.files) {
  const destDir = workflowFiles.has(file.path) ? workflowDir : rootDir;
  const target = join(destDir, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content);
  const rel = workflowFiles.has(file.path) ? `cre-testing-workflow/${file.path}` : file.path;
  console.log(`  ✓ ${rel}`);
}

if (data.warnings.length > 0) {
  console.log("\nWarnings:");
  data.warnings.forEach((w) => console.log(`  - ${w}`));
}

console.log("\nDone!");
