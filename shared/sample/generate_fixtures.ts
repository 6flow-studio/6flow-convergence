/**
 * Generates JSON fixture files for compiler tests from the TypeScript mockups.
 *
 * Usage:  bun shared/sample/generate_fixtures.ts
 *
 * Output: compiler/tests/fixtures/sample_<snake_name>.json  (one per export)
 */

import * as path from 'path';
import * as fs from 'fs';
import * as mockups from './mockup';

const FIXTURES_DIR = path.resolve(__dirname, '../../compiler/tests/fixtures');

/** camelCase → snake_case */
function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function main() {
  // Ensure output directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  let count = 0;
  for (const [name, workflow] of Object.entries(mockups)) {
    // Skip non-workflow exports (type guards, helpers, etc.)
    if (typeof workflow !== 'object' || workflow === null || !('nodes' in workflow)) {
      continue;
    }

    const snakeName = toSnakeCase(name);
    const filename = `sample_${snakeName}.json`;
    const filepath = path.join(FIXTURES_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(workflow, null, 4) + '\n');
    console.log(`  wrote ${filename}`);
    count++;
  }

  console.log(`\nGenerated ${count} fixture(s) in ${FIXTURES_DIR}`);
}

main();
