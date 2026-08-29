import ExcelJS from 'exceljs';
import { extractTestCases, type TestCase } from './parse-tests';

/**
 * Part 4.2 and 4.3 of the assignment: the Unit Test Case and SIT/UAT Case workbooks.
 * Both are generated from the test files themselves, so a case can never appear in
 * the document without existing in the suite — or the other way round.
 */

const HEADER_FILL = 'FF1F3864';

interface SheetSpec {
  name: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, string>[];
}

function addSheet(workbook: ExcelJS.Workbook, spec: SheetSpec): void {
  const sheet = workbook.addWorksheet(spec.name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = spec.columns;

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 28;

  for (const row of spec.rows) sheet.addRow(row);

  sheet.eachRow({ includeEmpty: false }, (row, index) => {
    if (index === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } };
}

function sentence(title: string): string {
  return `The system ${title}.`;
}

// ---------------------------------------------------------------------------
// Unit test cases
// ---------------------------------------------------------------------------

/** Which layer each test file exercises. */
const UNIT_MODULES: Record<string, string> = {
  'backend/tests/parse.test.ts': 'Parse (backend/src/parse.ts)',
  'backend/tests/distill.test.ts': 'Distill (backend/src/distill.ts)',
  'backend/tests/analyze.test.ts': 'Analyze (backend/src/analyze.ts)',
  'backend/tests/rollup.test.ts': 'Rollup (backend/src/rollup.ts)',
};

/** Which requirement each suite verifies. Keyed by the `describe` title. */
const UNIT_REQUIREMENTS: Record<string, string> = {
  'format detection': 'FR-2, NFR-1',
  participants: 'FR-3.2',
  'heuristic distiller': 'FR-3.1, FR-3.5, NFR-4, NFR-6',
  'no-decision detection': 'FR-4.1',
  ownership: 'FR-4.2, FR-5.3, NFR-3',
  'date problems': 'FR-4.2, NFR-4',
  'grouping action items by owner': 'FR-5.2, FR-5.3',
};

function unitRows(cases: TestCase[]): Record<string, string>[] {
  return cases.map((testCase, index) => {
    const requirement = UNIT_REQUIREMENTS[testCase.suite];
    if (!requirement) {
      throw new Error(
        `Suite "${testCase.suite}" has no requirement mapping. Add it to UNIT_REQUIREMENTS in backend/scripts/testcases.ts.`,
      );
    }
    return {
      id: `UT-${String(index + 1).padStart(3, '0')}`,
      module: UNIT_MODULES[testCase.file] ?? testCase.file,
      suite: testCase.suite,
      scenario: testCase.title,
      expected: sentence(testCase.title),
      requirement,
      edgeCase: /edge case/i.test(testCase.note ?? '') ? 'Yes' : 'No',
      note: testCase.note ?? '',
      source: `${testCase.file}:${testCase.line}`,
    };
  });
}

export async function buildUnitTestWorkbook(root: string, generatedAt: string): Promise<Buffer> {
  const files = Object.keys(UNIT_MODULES);
  const cases = files.flatMap((file) => extractTestCases(`${root}/${file}`, file));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Meeting Notes Distiller — npm run docs';
  workbook.created = new Date(generatedAt);

  addSheet(workbook, {
    name: 'Unit Test Cases',
    columns: [
      { header: 'Test Case ID', key: 'id', width: 14 },
      { header: 'Module under test', key: 'module', width: 32 },
      { header: 'Suite', key: 'suite', width: 26 },
      { header: 'Scenario', key: 'scenario', width: 52 },
      { header: 'Expected result', key: 'expected', width: 58 },
      { header: 'Requirement', key: 'requirement', width: 22 },
      { header: 'Edge case', key: 'edgeCase', width: 11 },
      { header: 'Notes', key: 'note', width: 46 },
      { header: 'Source', key: 'source', width: 34 },
    ],
    rows: unitRows(cases),
  });

  addSheet(workbook, {
    name: 'How to run',
    columns: [
      { header: 'Item', key: 'item', width: 26 },
      { header: 'Value', key: 'value', width: 90 },
    ],
    rows: [
      { item: 'Command', value: 'npm test  (runs vitest in the backend workspace)' },
      { item: 'Preconditions', value: 'npm install has been run. No network access and no ANTHROPIC_API_KEY are required — see NFR-2.' },
      { item: 'Test data', value: 'Inline transcript strings and the fixture builders in backend/tests/fixtures.ts. No sample files are read.' },
      { item: 'Total cases', value: String(cases.length) },
      { item: 'Pass criteria', value: 'All cases pass; vitest exits with code 0.' },
      { item: 'Generated', value: generatedAt },
      { item: 'Generator', value: 'npm run docs — reads the describe/it titles directly out of backend/tests/' },
    ],
  });

  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// SIT / UAT cases (from the E2E suite)
// ---------------------------------------------------------------------------

interface E2eDetail {
  feature: string;
  requirement: string;
  data: string;
  steps: string[];
  expected: string[];
}

/**
 * Keyed by the Playwright test title. generate-docs.ts fails loudly when a test
 * exists with no entry here, so the workbook cannot silently fall behind the suite.
 */
const E2E_DETAILS: Record<string, E2eDetail> = {
  'upload one transcript and see distillation results': {
    feature: 'Upload and distil',
    requirement: 'FR-1, FR-2, FR-3.1, FR-3.5, FR-5.1',
    data: 'samples/01-sprint-planning.txt (speaker-colon, English, 2 topics)',
    steps: ['Open http://localhost:5173.', 'Select 01-sprint-planning.txt.', 'Click Distill.'],
    expected: [
      'A meeting card appears titled "Sprint 24 Planning".',
      'Exactly 2 topic sections are rendered — the header block does not become a topic.',
      '4 action items are listed in total.',
    ],
  },
  'upload multiple transcripts at once': {
    feature: 'Upload',
    requirement: 'FR-1, FR-2',
    data: 'samples/01-sprint-planning.txt + samples/02-design-review.txt',
    steps: ['Open the app.', 'Select both files in one action.', 'Click Distill.'],
    expected: ['Both transcripts are processed in one Distillation Run.', 'Two meeting cards are rendered.'],
  },
  'allows multiple separate uploads before distilling': {
    feature: 'Upload',
    requirement: 'FR-1',
    data: 'samples/01-sprint-planning.txt, then samples/02-design-review.txt',
    steps: ['Open the app.', 'Upload the first file.', 'Upload the second file in a separate action.', 'Click Distill.'],
    expected: ['The file list accumulates to 2 files.', 'Both meetings appear in the same Run.'],
  },
  'remove a file before distilling': {
    feature: 'Upload',
    requirement: 'FR-1',
    data: 'Two sample transcripts',
    steps: ['Upload two files.', 'Click Remove on the first entry.'],
    expected: ['One file remains queued; the removed file is gone from the list.'],
  },
  'clear all files': {
    feature: 'Upload',
    requirement: 'FR-1',
    data: 'samples/01-sprint-planning.txt',
    steps: ['Upload one file.', 'Click Clear.'],
    expected: ['The file list is hidden and nothing is queued.'],
  },
  'action items by owner tab': {
    feature: 'Action items by owner',
    requirement: 'FR-5.2, FR-5.3, NFR-3',
    data: 'samples/01-sprint-planning.txt',
    steps: ['Distil the sprint-planning transcript.', 'Open the "Action Items by Owner" tab.'],
    expected: [
      'One group per distinct owner: Anna, Ploy, Somchai.',
      'The unowned group is present and listed last.',
    ],
  },
  'flags tab shows issues from messy notes': {
    feature: 'Flags',
    requirement: 'FR-4.1, FR-4.2, FR-5.3',
    data: 'samples/04-messy-notes.txt (unstructured, no decisions, unowned item)',
    steps: ['Distil the messy notes.', 'Open the "Flags & Issues" tab.'],
    expected: [
      'A NO_DECISION flag is shown for the meeting.',
      'An UNOWNED_ACTION_ITEM flag is shown for "somebody should probably follow up with legal".',
      'The summary still renders — flags never block.',
    ],
  },
  'download docx button triggers file download': {
    feature: 'Word export',
    requirement: 'FR-6',
    data: 'samples/01-sprint-planning.txt',
    steps: ['Distil a transcript.', 'Click "Download .docx".'],
    expected: ['A file download starts with a .docx filename.'],
  },
  'drag and drop file onto dropzone': {
    feature: 'Upload',
    requirement: 'FR-1',
    data: 'samples/03-standup-th.txt',
    steps: ['Place a .txt file on the dropzone (driven through the file input, which is the same code path).'],
    expected: ['The file is queued and its name is shown in the file list.'],
  },
  'Thai-language transcript distills correctly': {
    feature: 'Bilingual distillation',
    requirement: 'FR-2, FR-3.1, NFR-6',
    data: 'samples/03-standup-th.txt (header-bullet, Thai)',
    steps: ['Upload the Thai standup transcript.', 'Click Distill.'],
    expected: ['A meeting card is rendered.', 'One topic section is produced from the Thai transcript without error.'],
  },
};

export async function buildE2eWorkbook(root: string, generatedAt: string): Promise<Buffer> {
  const file = 'e2e/tests/distill.spec.ts';
  const cases = extractTestCases(`${root}/${file}`, file);

  const rows = cases.map((testCase, index) => {
    const detail = E2E_DETAILS[testCase.title];
    if (!detail) {
      throw new Error(
        `E2E test "${testCase.title}" has no entry in E2E_DETAILS (backend/scripts/testcases.ts). Add its steps before regenerating.`,
      );
    }
    return {
      id: `SIT-${String(index + 1).padStart(3, '0')}`,
      feature: detail.feature,
      scenario: testCase.title,
      precondition: 'Backend on :3001 and frontend on :5173 are running (Playwright starts both). No API key required.',
      data: detail.data,
      steps: detail.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
      expected: detail.expected.map((line) => `• ${line}`).join('\n'),
      requirement: detail.requirement,
      automated: 'Yes (Playwright)',
      source: `${testCase.file}:${testCase.line}`,
    };
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Meeting Notes Distiller — npm run docs';
  workbook.created = new Date(generatedAt);

  addSheet(workbook, {
    name: 'SIT-UAT Cases',
    columns: [
      { header: 'Case ID', key: 'id', width: 12 },
      { header: 'Feature', key: 'feature', width: 24 },
      { header: 'Scenario', key: 'scenario', width: 46 },
      { header: 'Preconditions', key: 'precondition', width: 44 },
      { header: 'Test data', key: 'data', width: 46 },
      { header: 'Steps', key: 'steps', width: 62 },
      { header: 'Expected result', key: 'expected', width: 66 },
      { header: 'Requirement', key: 'requirement', width: 24 },
      { header: 'Automated', key: 'automated', width: 16 },
      { header: 'Source', key: 'source', width: 34 },
    ],
    rows,
  });

  addSheet(workbook, {
    name: 'How to run',
    columns: [
      { header: 'Item', key: 'item', width: 26 },
      { header: 'Value', key: 'value', width: 90 },
    ],
    rows: [
      { item: 'Command', value: 'npm run test:e2e  (Playwright starts the backend and frontend automatically)' },
      { item: 'Runtime', value: 'Node.js 20 or newer — Playwright refuses to start on Node 18.' },
      { item: 'First run', value: 'npx playwright install chromium' },
      { item: 'Test data', value: 'The four transcripts in samples/ — one per supported format.' },
      { item: 'Total cases', value: String(rows.length) },
      { item: 'Pass criteria', value: 'All cases pass; Playwright exits with code 0.' },
      { item: 'Generated', value: generatedAt },
    ],
  });

  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}
