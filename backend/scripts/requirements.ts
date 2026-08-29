/**
 * The requirement catalogue, transcribed from docs/ASSIGNMENT.md and the decisions
 * already recorded in CONTEXT.md and docs/adr/. Single source for the SRS document
 * and for the Requirement Ref column of the generated test-case workbooks.
 */

export interface Requirement {
  id: string;
  title: string;
  statement: string;
  /** Where the behaviour lives. */
  implementation: string;
  /** How we know it works. */
  verification: string;
}

export const FUNCTIONAL: Requirement[] = [
  {
    id: 'FR-1',
    title: 'Upload transcripts',
    statement:
      'A user can upload one or more .txt transcripts in a single action, and can add further files in additional uploads before submitting. Files can be removed or cleared before submission.',
    implementation: 'frontend/src/App.tsx (dropzone, file list), backend/src/server.ts (multer, multipart field "transcripts")',
    verification: 'E2E: upload multiple transcripts at once; allows multiple separate uploads before distilling; remove a file; clear all files',
  },
  {
    id: 'FR-2',
    title: 'Process without crashing',
    statement:
      'On submit, every uploaded transcript is processed in the same Distillation Run. At least three transcript formats are supported, and an unrecognised format must degrade to "unstructured" rather than fail. A transcript is never rejected.',
    implementation: 'backend/src/parse.ts (detectFormat: speaker-colon, timestamped, header-bullet, unstructured), backend/src/pipeline.ts',
    verification: 'Unit: format detection suite, including the empty-transcript and free-form fallback cases',
  },
  {
    id: 'FR-3.1',
    title: 'Extract topics',
    statement: 'Each Meeting is split into one or more Topics. A transcript covering several subjects produces several Topics.',
    implementation: 'backend/src/distill.ts (HeuristicDistiller), backend/src/distill.claude.ts (ClaudeDistiller)',
    verification: 'Unit: splits a transcript into one topic per topic cue. E2E: two topic sections rendered for the sprint-planning sample',
  },
  {
    id: 'FR-3.2',
    title: 'Extract participants',
    statement:
      'Participants are listed per Meeting. Every Speaker is a Participant; a Participant listed in the header who never speaks is still a Participant.',
    implementation: 'backend/src/parse.ts (attendee header + speaker turns)',
    verification: 'Unit: includes a listed attendee who never speaks; never treats a header line as a speaker turn',
  },
  {
    id: 'FR-3.3',
    title: 'Summarise each topic',
    statement: 'Each Topic carries its own summary.',
    implementation: 'backend/src/distill.ts / distill.claude.ts (Topic.summary)',
    verification: 'E2E: topic sections render a summary. Contract covered by the Distiller interface tests',
  },
  {
    id: 'FR-3.4',
    title: 'Extract decisions',
    statement: 'Each Topic carries the Decisions reached about it. A Topic may legitimately have none.',
    implementation: 'backend/src/distill.ts (decision cues, bilingual)',
    verification: 'Unit: analyze suite depends on the decisions array; E2E: messy-notes sample renders "No decision reached."',
  },
  {
    id: 'FR-3.5',
    title: 'Extract action items',
    statement:
      'Each Action Item records who (Owner), what (description) and by when (due date), exactly as stated in the transcript. Any of the three may be missing. The Owner is the verbatim name string; a self-assignment is attributed to the speaker.',
    implementation: 'backend/src/distill.ts (owner cues, self-assignment, dueDate / dueDateRaw)',
    verification: 'Unit: attributes an action item to the named owner; attributes a self-assignment to the speaker; leaves the owner null rather than guessing',
  },
  {
    id: 'FR-4.1',
    title: 'Flag no-decision meetings',
    statement: 'A Meeting in which no Topic reached a Decision is flagged NO_DECISION.',
    implementation: 'backend/src/analyze.ts (flagNoDecision)',
    verification: 'Unit: flags a meeting whose topics reached no decision; does not flag a meeting where any topic reached a decision',
  },
  {
    id: 'FR-4.2',
    title: 'Flag inconsistent action items',
    statement:
      'Action Items that conflict or cannot be acted on are flagged: an unresolvable deadline (UNCLEAR_DUE_DATE), a deadline that falls before the Meeting or after a milestone it must precede (CONFLICTING_DUE_DATE) — e.g. two candidate dates discussed with a go-live and no decision between them — and Owner names that look like the same person (AMBIGUOUS_OWNER).',
    implementation: 'backend/src/analyze.ts (flagUnclearDates, flagConflictingDates, flagAmbiguousOwners)',
    verification: 'Unit: date-problems suite and ownership suite (5 cases)',
  },
  {
    id: 'FR-5.1',
    title: 'Display meeting summaries',
    statement: 'The browser shows, per Meeting: title, date, participants, milestones, and for each Topic its summary, Decisions and Action Items.',
    implementation: 'frontend/src/App.tsx (MeetingCard, TopicSection)',
    verification: 'E2E: upload one transcript and see distillation results; Thai-language transcript distills correctly',
  },
  {
    id: 'FR-5.2',
    title: 'Group action items by owner',
    statement:
      'Action Items are grouped by Owner across every Meeting in the Run, so one person sees everything on their plate in one place. Owners are matched on the exact string and never merged.',
    implementation: 'backend/src/rollup.ts (groupByOwner), frontend/src/App.tsx (OwnerGroups)',
    verification: 'Unit: rollup suite (3 cases). E2E: action items by owner tab',
  },
  {
    id: 'FR-5.3',
    title: 'Surface unowned and unclear items',
    statement:
      'Action Items with no Owner are collected into their own group, listed last, and every Flag is shown with a human-readable message. Flags annotate the result and never block it.',
    implementation: 'backend/src/rollup.ts (null-owner group), backend/src/analyze.ts, frontend/src/App.tsx (FlagsView, FLAG_LABELS)',
    verification: 'Unit: flags an action item with no owner; collects unowned action items into their own group, listed last. E2E: flags tab shows issues from messy notes',
  },
  {
    id: 'FR-6',
    title: 'Download a Word document',
    statement: 'The Meeting summaries of FR-5.1 can be downloaded as a .docx file for the whole Distillation Run.',
    implementation: 'backend/src/docx.ts (buildRunDocument), GET /api/runs/:id/document.docx, frontend download button',
    verification: 'E2E: download docx button triggers file download',
  },
  {
    id: 'FR-7',
    title: 'Unit tests for the extraction edge cases',
    statement:
      'The extraction logic has unit tests covering at least the two edge cases named in the assignment: an Action Item with no Owner, and a Meeting that reached no Decision.',
    implementation: 'backend/tests/ (vitest)',
    verification: 'The generated Unit Test Case workbook; 29 cases, run offline by `npm test`',
  },
];

export const NON_FUNCTIONAL: Requirement[] = [
  {
    id: 'NFR-1',
    title: 'Never reject a transcript',
    statement: 'Format detection has no failure mode. Anything unrecognised falls through to "unstructured" and the pipeline degrades rather than erroring.',
    implementation: 'backend/src/parse.ts',
    verification: 'Unit: falls back to unstructured instead of throwing on free-form notes; does not crash on an empty transcript',
  },
  {
    id: 'NFR-2',
    title: 'Tests run offline',
    statement: '`npm test` requires no network and no ANTHROPIC_API_KEY. Every unit-tested behaviour lives in the Parse or Analyze layer; the Distill layer is exercised through the deterministic HeuristicDistiller.',
    implementation: 'backend/src/distill.ts (Distiller interface + HeuristicDistiller), backend/tests/fixtures.ts',
    verification: 'The whole vitest suite; ADR-0001',
  },
  {
    id: 'NFR-3',
    title: 'Owners are never merged',
    statement: '"Somchai", "somchai" and "คุณสมชาย" are three distinct Owners. Look-alikes are surfaced as an AMBIGUOUS_OWNER flag for a human to resolve; normalisation is used for comparison only.',
    implementation: 'backend/src/analyze.ts (normaliseOwner), backend/src/rollup.ts',
    verification: 'Unit: keeps look-alike owner names in separate groups; strips honorifics and casing only for comparison',
  },
  {
    id: 'NFR-4',
    title: 'Relative dates are not resolved',
    statement: '"Next Friday" is kept verbatim in dueDateRaw with dueDate = null, and flagged UNCLEAR_DUE_DATE. The system never guesses a calendar date.',
    implementation: 'backend/src/distill.ts, backend/src/analyze.ts',
    verification: 'Unit: keeps a vague deadline as raw text and refuses to resolve it to a date',
  },
  {
    id: 'NFR-5',
    title: 'LLM is optional and isolated',
    statement:
      'Distillation is the only layer that may call an LLM, behind the Distiller interface. With ANTHROPIC_API_KEY set, ClaudeDistiller is used and falls back to HeuristicDistiller on any API error; without a key the system runs fully offline.',
    implementation: 'backend/src/distill.claude.ts (createDistiller)',
    verification: 'GET /api/health reports the active distiller; ADR-0001',
  },
  {
    id: 'NFR-6',
    title: 'Bilingual by design',
    statement: 'Cue patterns mix Thai and English throughout Parse, Distill and Analyze. Sample data covers both.',
    implementation: 'backend/src/parse.ts, backend/src/distill.ts, backend/src/analyze.ts (HONORIFICS)',
    verification: 'Unit: handles a Thai transcript. E2E: Thai-language transcript distills correctly',
  },
  {
    id: 'NFR-7',
    title: 'In-memory storage only',
    statement:
      'A Distillation Run is held in memory for the lifetime of the backend process. There is no database — this is a proof of concept, and persistence was deliberately left out of scope.',
    implementation: 'backend/src/server.ts (runs Map)',
    verification: 'Documented limitation; runs are lost on restart',
  },
  {
    id: 'NFR-8',
    title: 'Upload limits',
    statement: 'At most 20 files per Distillation Run, 2 MB per file, text/* or .txt only.',
    implementation: 'backend/src/server.ts (multer limits + fileFilter)',
    verification: 'Configuration; rejected files never reach the pipeline',
  },
];
