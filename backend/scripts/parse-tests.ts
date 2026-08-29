import { readFileSync } from 'node:fs';

/**
 * Reads `describe` / `it` titles straight out of the test files so the generated
 * test-case documents can never drift from the suite they claim to describe.
 * Deliberately a line scanner, not a TypeScript parser: the tests keep every
 * title on the same line as its `it(`, and a scanner has no build step.
 */
export interface TestCase {
  file: string;
  suite: string;
  title: string;
  line: number;
  /** Contiguous `//` comment lines directly above the test, joined. */
  note: string | null;
}

const DESCRIBE = /^\s*(?:test\.)?describe\(\s*(['"`])(.*?)\1/;
const IT = /^\s*(?:it|test)\(\s*(['"`])(.*?)\1/;
const COMMENT = /^\s*\/\/\s?(.*)$/;

export function extractTestCases(absPath: string, displayName: string): TestCase[] {
  const lines = readFileSync(absPath, 'utf8').split('\n');
  const cases: TestCase[] = [];
  let suite = '(top level)';
  let comment: string[] = [];

  lines.forEach((line, index) => {
    const commentMatch = COMMENT.exec(line);
    if (commentMatch) {
      comment.push(commentMatch[1].trim());
      return;
    }

    const describeMatch = DESCRIBE.exec(line);
    if (describeMatch) {
      suite = describeMatch[2];
      comment = [];
      return;
    }

    const itMatch = IT.exec(line);
    if (itMatch) {
      cases.push({
        file: displayName,
        suite,
        title: itMatch[2],
        line: index + 1,
        note: comment.length > 0 ? comment.join(' ') : null,
      });
      comment = [];
      return;
    }

    if (line.trim() !== '') comment = [];
  });

  if (cases.length === 0) throw new Error(`No test cases found in ${displayName} — the scanner is out of date.`);
  return cases;
}
