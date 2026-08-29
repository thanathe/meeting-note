import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { FUNCTIONAL, NON_FUNCTIONAL, type Requirement } from './requirements';

/**
 * Part 4.1 of the assignment: the Software Requirement Specification, as .docx.
 * Generated rather than hand-written so it stays in step with requirements.ts.
 */

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level });
}

function body(text: string): Paragraph {
  return new Paragraph({ text, spacing: { after: 120 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 } });
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold ?? false, size: 20 })] })],
  });
}

function table(headers: string[], rows: string[][], widths: number[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, { bold: true, width: widths[i] })),
      }),
      ...rows.map((row) => new TableRow({ children: row.map((value, i) => cell(value, { width: widths[i] })) })),
    ],
  });
}

function requirementBlock(requirement: Requirement): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [new TextRun({ text: `${requirement.id} — ${requirement.title}`, bold: true })],
    }),
    body(requirement.statement),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Implementation: ', bold: true, size: 20 }),
        new TextRun({ text: requirement.implementation, size: 20 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Verification: ', bold: true, size: 20 }),
        new TextRun({ text: requirement.verification, size: 20 }),
      ],
    }),
  ];
}

export async function buildSrsDocument(generatedAt: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: 'Software Requirement Specification', bold: true, size: 48 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'Meeting Notes Distiller Web', size: 32 })],
    }),
    table(
      ['Field', 'Value'],
      [
        ['Document', 'Software Requirement Specification (SRS)'],
        ['Product', 'Meeting Notes Distiller Web'],
        ['Version', '1.0'],
        ['Status', 'Baselined for the proof of concept'],
        ['Generated', generatedAt],
        ['Source of truth', 'docs/ASSIGNMENT.md, CONTEXT.md, docs/adr/0001-three-layer-extraction-pipeline.md'],
        ['Generator', 'npm run docs (backend/scripts/generate-docs.ts)'],
      ],
      [25, 75],
    ),

    heading('1. Introduction', HeadingLevel.HEADING_1),
    heading('1.1 Purpose', HeadingLevel.HEADING_2),
    body(
      'This document specifies the requirements for Meeting Notes Distiller Web — a web application that turns raw meeting transcripts into structured, reviewable summaries and surfaces the places where a meeting failed to produce a clear outcome. It is the requirement baseline for the implementation in this repository.',
    ),
    heading('1.2 Scope', HeadingLevel.HEADING_2),
    body(
      'In scope: uploading .txt transcripts, extracting topics, participants, per-topic summaries, decisions and action items, flagging problems, displaying the result in a browser, and exporting the meeting summaries to Microsoft Word.',
    ),
    body(
      'Out of scope, deliberately: persistence (runs are held in memory only), authentication and multi-user accounts, audio or video transcription, editing the distilled result in the browser, and resolving relative dates to calendar dates.',
    ),
    heading('1.3 Definitions', HeadingLevel.HEADING_2),
    body('The canonical vocabulary lives in CONTEXT.md. The terms used throughout this document are:'),
    table(
      ['Term', 'Definition'],
      [
        ['Distillation Run', 'One submission of one or more Transcripts, processed together. The unit a user sees results for and exports.'],
        ['Meeting', 'One real-world gathering, represented by exactly one Transcript.'],
        ['Transcript', 'The raw uploaded text of what was said at a Meeting, in whatever format it arrived.'],
        ['Topic', 'One subject discussed within a Meeting. Carries its own summary, Decisions and Action Items.'],
        ['Decision', 'A conclusion the Meeting reached about a Topic.'],
        ['Action Item', 'A commitment that someone will do something after the Meeting. Carries an Owner, a description and a due date — any of which may be missing.'],
        ['Owner', 'The single person accountable for an Action Item, identified by the exact name string as it appeared. Never normalised, never merged.'],
        ['Participant', 'Someone present at the Meeting. Every Speaker is a Participant; a Participant need not speak.'],
        ['Flag', 'A machine-detected problem a human should look at. Flags annotate the result; they never block it.'],
      ],
      [22, 78],
    ),

    heading('2. Overall description', HeadingLevel.HEADING_1),
    heading('2.1 Product perspective', HeadingLevel.HEADING_2),
    body(
      'The system is a two-tier web application: a React single-page frontend and an Express backend that owns the extraction pipeline. Extraction is split into three layers so that the LLM-dependent part is isolated behind one interface and every other behaviour stays deterministic and unit-testable. See ADR-0001.',
    ),
    table(
      ['Layer', 'Uses an LLM?', 'Responsibility'],
      [
        ['Parse (parse.ts)', 'No', 'Format detection, speaker turns, participants, meeting title and date.'],
        ['Distill (distill.ts / distill.claude.ts)', 'Yes, isolated', 'Topics, per-topic summaries, Decisions, Action Items, milestones.'],
        ['Analyze (analyze.ts)', 'No', 'Flagging rules, run against the Distiller output shape.'],
        ['Rollup (rollup.ts)', 'No', 'Groups Action Items by Owner across the whole Run.'],
        ['Export (docx.ts)', 'No', 'Builds the Word document for a Run.'],
      ],
      [30, 16, 54],
    ),
    heading('2.2 Users', HeadingLevel.HEADING_2),
    bullet('Meeting participant — uploads the transcript and reads back what was decided and who owes what.'),
    bullet('Team lead / project manager — reads the by-owner rollup and the flags to see what is unassigned, unclear or contradictory.'),
    heading('2.3 Assumptions and constraints', HeadingLevel.HEADING_2),
    bullet('Transcripts arrive as UTF-8 plain text (.txt). Audio is out of scope.'),
    bullet('Transcripts may be in Thai, English, or a mix of the two.'),
    bullet('The system runs on a local machine; a Distillation Run lives in the backend process memory.'),
    bullet('The LLM is optional. With no ANTHROPIC_API_KEY the system runs fully offline on the heuristic distiller.'),

    heading('3. Functional requirements', HeadingLevel.HEADING_1),
    ...FUNCTIONAL.flatMap(requirementBlock),

    heading('4. Non-functional requirements and standing rules', HeadingLevel.HEADING_1),
    ...NON_FUNCTIONAL.flatMap(requirementBlock),

    heading('5. External interfaces', HeadingLevel.HEADING_1),
    heading('5.1 HTTP API', HeadingLevel.HEADING_2),
    table(
      ['Method', 'Path', 'Description'],
      [
        ['GET', '/api/health', 'Liveness check. Reports which Distiller is active.'],
        ['POST', '/api/runs', 'Upload transcripts as multipart field "transcripts". Returns the DistillationRun.'],
        ['GET', '/api/runs/:id', 'Retrieve a stored Distillation Run. 404 once the process restarts.'],
        ['GET', '/api/runs/:id/document.docx', 'Download the Word document for the Run.'],
      ],
      [12, 33, 55],
    ),
    heading('5.2 Flag catalogue', HeadingLevel.HEADING_2),
    table(
      ['Code', 'Raised when', 'Requirement'],
      [
        ['NO_DECISION', 'No Topic in the Meeting reached a Decision.', 'FR-4.1'],
        ['UNOWNED_ACTION_ITEM', 'An Action Item has no Owner.', 'FR-4.2, FR-5.3'],
        ['AMBIGUOUS_OWNER', 'Two Owner strings normalise to the same person. Never merged automatically.', 'FR-4.2, NFR-3'],
        ['UNCLEAR_DUE_DATE', 'A deadline was stated but cannot be pinned to a calendar day.', 'FR-4.2, NFR-4'],
        ['CONFLICTING_DUE_DATE', 'A deadline falls before the Meeting, or after a milestone it must precede.', 'FR-4.2'],
      ],
      [24, 55, 21],
    ),

    heading('6. Traceability matrix', HeadingLevel.HEADING_1),
    body('Every requirement maps to the code that implements it and the tests that verify it.'),
    table(
      ['ID', 'Requirement', 'Implementation', 'Verification'],
      [...FUNCTIONAL, ...NON_FUNCTIONAL].map((r) => [r.id, r.title, r.implementation, r.verification]),
      [8, 20, 34, 38],
    ),

    heading('7. Design decisions', HeadingLevel.HEADING_1),
    body('The decisions below are load-bearing: changing one changes the behaviour a user sees.'),
    bullet('Three-layer pipeline with the LLM isolated behind the Distiller interface, so the whole test suite runs offline and deterministically (ADR-0001).'),
    bullet('Owners are never merged. Look-alikes are flagged for a human, because guessing wrong silently lands work on the wrong person.'),
    bullet('Relative dates are never resolved. "Next Friday" is kept verbatim and flagged rather than guessed at.'),
    bullet('Flags annotate, never block. A meeting with no decisions still produces a full summary.'),
    bullet('A transcript is never rejected. Unrecognised formats degrade to "unstructured".'),
    bullet('Bilingual cue patterns throughout, rather than a language-detection step.'),
  ];

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
