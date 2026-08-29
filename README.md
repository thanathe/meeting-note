# Meeting Notes Distiller

Turns raw meeting transcripts into structured, reviewable summaries — and surfaces the places where a meeting failed to produce a clear outcome.

Upload one or more `.txt` transcripts, distil them through a three-layer pipeline, view the results in a browser, and export to Word.

## Quick start

```bash
npm install          # install all workspaces (backend, frontend, e2e)
npm run dev          # start backend (:3001) and frontend (:5173)
```

Open http://localhost:5173, drop `.txt` files onto the upload zone, click **Distill**, view results, download `.docx`.

### LLM distillation (optional)

By default the system runs with a deterministic heuristic distiller — no API key needed. To use Claude for higher-quality summaries:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

When the key is set, `ClaudeDistiller` is used; it falls back to the heuristic distiller on any API error, so the pipeline never fails due to the LLM being unavailable.

## What it does

1. **Upload** one or more `.txt` meeting transcripts (multiple files, multiple uploads).
2. **Parse** — detects format (speaker-colon, timestamped, header-bullet, unstructured), extracts speaker turns, participants, title, date. Never rejects a transcript.
3. **Distill** — produces per-topic summaries, decisions, action items (with owner + due date), and milestones.
4. **Analyze** — flags problems: no-decision meetings, unowned action items, ambiguous owners, unclear due dates, conflicting dates.
5. **Rollup** — groups all action items by owner across the entire run, so each person sees everything on their plate.
6. **Export** — download the meeting summaries as a `.docx` Word document.

## Design decisions

### Three-layer pipeline with the LLM isolated behind one interface

The system needs both LLM-quality distillation and unit-testable extraction logic. Pure-LLM extraction makes `npm test` non-deterministic and API-key-dependent; pure rule-based extraction cannot produce grounded per-topic summaries.

The solution splits extraction into three layers:

| Layer | LLM? | Testable? | What it does |
|-------|------|-----------|---------------|
| **Parse** | No | Yes, fully | Format detection, speaker turns, participants, dates |
| **Distill** | Yes (isolated) | Via fake | Topics, summaries, decisions, action items |
| **Analyze** | No | Yes, fully | Flagging rules |

The `Distiller` interface has two implementations: `HeuristicDistiller` (deterministic, offline — the test double and fallback) and `ClaudeDistiller` (calls Anthropic, falls back to heuristic on error). Every testable behaviour lives in Parse or Analyze, so the full test suite runs offline with no API key. See [ADR-0001](docs/adr/0001-three-layer-extraction-pipeline.md).

### Owners are never merged

"Somchai", "somchai", and "คุณสมชาย" are three distinct owners. The system surfaces look-alikes as an `AMBIGUOUS_OWNER` flag, but a human decides whether to merge. Guessing wrong means work silently lands on the wrong person's list and nobody notices until the deadline passes. See [CONTEXT.md](CONTEXT.md).

### Relative dates are not resolved

"Next Friday" stays in `dueDateRaw` with `dueDate = null`. The system does not guess what "next Friday" means — it flags it as `UNCLEAR_DUE_DATE` and lets a human pin it down.

### Flags never block

Flags annotate the result; they never alter or block the pipeline. A meeting with no decisions, an unowned action item, and a conflicting due date still produces a summary — it just comes with flags attached.

### Documentation that cannot drift

The SRS and both test-case workbooks are generated from a requirement catalogue and from
the test files themselves (`npm run docs`). Requirement text has one home
(`backend/scripts/requirements.ts`), and no test case can appear in a workbook without
existing in the suite — or exist in the suite without appearing in the workbook.

### Bilingual by design

Regex patterns and cue phrases intentionally mix Thai and English. Sample transcripts include both languages. The system handles `"ภายในสองวัน"` and `"by end of week"` with the same machinery.

## Project structure

```
ai-meetingnote/
├── backend/
│   ├── src/
│   │   ├── types.ts          # Domain types (canonical)
│   │   ├── parse.ts          # Layer 1: deterministic parse
│   │   ├── distill.ts        # Layer 2: Distiller interface + HeuristicDistiller
│   │   ├── distill.claude.ts # Layer 2: ClaudeDistiller (LLM)
│   │   ├── analyze.ts        # Layer 3: flagging rules
│   │   ├── pipeline.ts       # Orchestrates parse → distill → analyze
│   │   ├── rollup.ts         # Group action items by owner
│   │   ├── docx.ts           # Word document export
│   │   └── server.ts         # Express API
│   ├── scripts/
│   │   ├── generate-docs.ts  # `npm run docs` entry point
│   │   ├── requirements.ts   # Requirement catalogue (source for the SRS)
│   │   ├── srs.ts            # Builds the SRS .docx
│   │   ├── testcases.ts      # Builds the two .xlsx workbooks
│   │   └── parse-tests.ts    # Reads describe/it titles out of the test files
│   └── tests/
│       ├── fixtures.ts       # Test builders
│       ├── parse.test.ts
│       ├── distill.test.ts
│       ├── analyze.test.ts
│       └── rollup.test.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Upload, results, download
│   │   ├── main.tsx
│   │   ├── types.ts          # Mirrors backend types
│   │   └── styles.css
│   ├── index.html
│   └── vite.config.ts        # Proxies /api → :3001
├── e2e/
│   ├── tests/
│   │   └── distill.spec.ts   # Playwright E2E tests
│   └── playwright.config.ts
├── samples/
│   ├── 01-sprint-planning.txt
│   ├── 02-design-review.txt
│   ├── 03-standup-th.txt
│   └── 04-messy-notes.txt
├── docs/
│   ├── adr/
│   │   └── 0001-three-layer-extraction-pipeline.md
│   ├── generated/           # Built by `npm run docs` — do not hand-edit
│   │   ├── SRS-Meeting-Notes-Distiller.docx
│   │   ├── Unit-Test-Cases.xlsx
│   │   └── SIT-UAT-Test-Cases.xlsx
│   └── ASSIGNMENT.md
├── .claude/skills/
│   ├── transcript-distill/SKILL.md
│   └── add-transcript-fixture/SKILL.md
├── CONTEXT.md               # Domain vocabulary
├── CLAUDE.md                # Conventions for Claude Code
└── package.json             # Root workspace
```

## Claude Code skills (Part 3)

Two skills live in `.claude/skills/`. Both were extracted from work that actually
repeated while building this project — not invented to fill the requirement.

### `transcript-distill`

**What it does.** Runs one or more transcripts through the pipeline and explains how to
read the result: the three entry points (web UI, `POST /api/runs`, or calling
`distillRun` directly), when the LLM distiller is active versus the heuristic one, and
what each of the three result tabs means.

**Why it exists.** "Distil these transcripts and tell me what came out" was the single
most repeated instruction in this project, and it kept being answered inconsistently —
sometimes through the UI, sometimes by curl, sometimes by a throwaway script, each with
a different idea of what "the answer" looked like. The skill pins down one workflow and
one vocabulary, so the same question gets the same shape of answer every time.

### `add-transcript-fixture`

**What it does.** Walks through adding a new sample transcript: check it exercises a
genuinely new shape, run it through the pipeline and *read the output before writing an
expectation*, add the unit test with an inline transcript string, add the E2E test and
its `E2E_DETAILS` entry, then regenerate `docs/generated/`.

**Why it exists.** Adding a sample touches five places, and the failure mode is silent —
the repository looks finished while a new format has no test, or an expectation is
hard-coded to a count nobody has checked. Both happened here. `.flag` was asserted to be
`toHaveCount(1)` on a sample that raises two flags, and `.owner-card` was asserted
`toBeVisible()` against a locator matching four cards; neither failure said anything
about the behaviour it existed to protect. Separately, `.topic-section` was asserted to
be 2 and the parser was producing 3 — that one was a genuine bug (the header block became
a phantom Topic) and was fixed in `parse.ts`. The skill encodes the resulting checklist:
read the pipeline output *before* writing the expectation, and assert on meaning.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run dev:backend` | Start backend only (port 3001) |
| `npm run dev:frontend` | Start frontend only (port 5173) |
| `npm test` | Run unit tests (offline, no API key) |
| `npm run test:e2e` | Run Playwright E2E tests (auto-starts servers) |
| `npm run lint` | Type-check backend + frontend |
| `npm run build` | Build backend + frontend |
| `npm run docs` | Regenerate the SRS and test-case documents in `docs/generated/` |

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check + active distiller name |
| `POST` | `/api/runs` | Upload transcripts (multipart `transcripts[]`), returns `DistillationRun` |
| `GET` | `/api/runs/:id` | Retrieve a stored run |
| `GET` | `/api/runs/:id/document.docx` | Download the Word document |

## Sample transcripts

| File | Format | Language | What it exercises |
|------|--------|----------|-------------------|
| `01-sprint-planning.txt` | speaker-colon | English | Clean two-topic meeting, clear owners, absolute dates |
| `02-design-review.txt` | timestamped | English | Timestamps, honorifics (`K. Somchai`), milestone, relative date |
| `03-standup-th.txt` | header-bullet | Thai | Thai standup, relative date (`ภายในสัปดาห์นี้`) |
| `04-messy-notes.txt` | unstructured | English | No decisions, unowned action item, should produce flags |

## Generated documents (Part 4)

Three deliverables live in `docs/generated/` and are rebuilt with `npm run docs`:

| File | What it is |
|------|-----------|
| `SRS-Meeting-Notes-Distiller.docx` | Software Requirement Specification — scope, vocabulary, 14 functional and 8 non-functional requirements, the API and flag catalogues, and a traceability matrix from every requirement to the code and the tests that verify it. |
| `Unit-Test-Cases.xlsx` | One row per unit test (31), with module, suite, scenario, expected result, requirement reference, edge-case marker, and `file:line`. |
| `SIT-UAT-Test-Cases.xlsx` | One row per E2E test (10), with preconditions, test data, numbered steps, expected results, and requirement references. |

**They are generated, not hand-written.** The requirement catalogue lives in
`backend/scripts/requirements.ts`; the test-case rows are read directly out of
`backend/tests/` and `e2e/tests/` by a scanner that pulls the `describe`/`it` titles and
the `//` comment above each test. A hand-maintained test-case spreadsheet drifts from the
suite within a week — this one cannot, because a test that exists in the code appears in
the workbook automatically, and `npm run docs` **fails** if a Playwright test has no
steps entry in `E2E_DETAILS`.

The trade-off: the documents are only as good as what the code says about itself, so
test names have to read as sentences ("flags a meeting whose topics reached no
decision") rather than as labels ("test 4"). That is a constraint worth having anyway.

## CLAUDE.md revision log (Part 2)

The assignment asks that every change to `CLAUDE.md` be explained here.

| Change | Why |
|--------|-----|
| Added `backend/scripts/` and `docs/generated/` to the orientation table, and `npm run docs` to the command list | Part 4 introduced a build step that produces `.docx`/`.xlsx` deliverables. Without this, the next session would not know the documents are generated and would edit the binaries by hand. |
| Added "`docs/generated/` is build output — never hand-edit" to the rules | A `.docx` looks like a document, not like build output. The rule states plainly that the fix goes into `requirements.ts` or the tests, then `npm run docs`. |
| Added "E2E assertions are about meaning, not incidental counts" to the rules | Two E2E assertions were wrong in a way a count hides: `toHaveCount(1)` on `.flag` when the messy-notes sample legitimately raises two flags, and `toBeVisible()` on `.owner-card`, which matches four elements and fails Playwright's strict mode. Neither failure named the behaviour it was supposed to protect. They are now assertions on flag codes and on owner names. |
| Added "re-run `npm run docs` when adding or renaming a test" to file ownership | The generated workbooks read test titles out of the source. If they are not regenerated, the submitted documents describe a suite that no longer exists. |
| Noted that `npm run test:e2e` needs Node 20+ and a one-off `npx playwright install chromium` | The E2E suite failed on this machine's default Node 18 with an error that reads as a Playwright bug rather than a version requirement. Two lines in `CLAUDE.md` remove that dead end. |
| Added a **Tech stack** table and a **Coding style** section | Part 2 asks for both by name and neither existed. The stack was only inferable from `package.json`, and the style rules that actually matter here were unwritten — cue patterns as module-level constants rather than inline regexes, comments that name the rule they protect, and test names written as sentences because the generated workbooks lift them verbatim. |
| Pointed the "adding a sample transcript" bullet at the `add-transcript-fixture` skill | The bullet said "add a corresponding E2E test" and stopped there, which is about a third of the actual job. The skill holds the full checklist; `CLAUDE.md` now routes to it instead of duplicating it. |

## Requirements

- Node.js 20+ — the app itself runs on 18, but Playwright refuses to start below 20,
  so `npm run test:e2e` needs 20 or newer.
- `npx playwright install chromium`, once, before the first E2E run.
- `ANTHROPIC_API_KEY` (optional — only for LLM distillation).
