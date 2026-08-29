import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSrsDocument } from './srs';
import { buildE2eWorkbook, buildUnitTestWorkbook } from './testcases';

/**
 * Part 4 of the assignment: the SRS (.docx), the Unit Test Case workbook (.xlsx)
 * and the SIT/UAT Case workbook (.xlsx).
 *
 * Generated, not hand-written, so the documents cannot drift from the requirement
 * catalogue in requirements.ts or from the test suites they describe.
 *
 *   npm run docs
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'docs', 'generated');
const generatedAt = new Date().toISOString().slice(0, 10);

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  const artefacts: [string, Buffer][] = [
    ['SRS-Meeting-Notes-Distiller.docx', await buildSrsDocument(generatedAt)],
    ['Unit-Test-Cases.xlsx', await buildUnitTestWorkbook(root, generatedAt)],
    ['SIT-UAT-Test-Cases.xlsx', await buildE2eWorkbook(root, generatedAt)],
  ];

  for (const [filename, buffer] of artefacts) {
    writeFileSync(path.join(outDir, filename), buffer);
    console.log(`wrote docs/generated/${filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
