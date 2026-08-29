# CLAUDE.md — Meeting Notes Distiller

Guidance for Claude Code when working in this repository.

## Quick orientation

| Where | What |
|-------|------|
| `backend/src/` | Express API + three-layer pipeline (parse → distill → analyze) |
| `frontend/src/` | React SPA (upload transcripts, view results, download .docx) |
| `e2e/tests/` | Playwright end-to-end tests |
| `backend/scripts/` | Generators for the documents in `docs/generated/` (SRS, test-case workbooks) |
| `samples/` | Four sample transcripts (English, Thai, messy) |
| `docs/adr/` | Architecture Decision Records |
| `docs/generated/` | Generated deliverables — never hand-edit, run `npm run docs` |
| `CONTEXT.md` | Domain vocabulary — the canonical names for every concept |

## Architecture

The system is a three-layer extraction pipeline. See `docs/adr/0001-three-layer-extraction-pipeline.md` for the full rationale.

1. **Parse** (`parse.ts`) — deterministic. Detects format, extracts turns, participants, title, date. No LLM.
2. **Distill** (`distill.ts` / `distill.claude.ts`) — the only layer that calls an LLM. Isolated behind the `Distiller` interface. `HeuristicDistiller` is the offline fallback / test double; `ClaudeDistiller` calls Anthropic when `ANTHROPIC_API_KEY` is set.
3. **Analyze** (`analyze.ts`) — deterministic. Runs flagging rules on the Distiller's output shape.

After distillation, `rollup.ts` groups action items by owner across the entire run, and `docx.ts` builds the Word document export.

## Tech stack

| Area | Choice |
|------|--------|
| Language | TypeScript 5.6, strict mode, ESM throughout (`"type": "module"`) |
| Runtime | Node.js 20+ (the app runs on 18; Playwright does not) |
| Repo | npm workspaces — `backend`, `frontend`, `e2e`. One lockfile: `package-lock.json` |
| Backend | Express 4, multer (in-memory uploads), `tsx` in dev |
| LLM | `@anthropic-ai/sdk`, optional, only reachable from `distill.claude.ts` |
| Frontend | React 18 + Vite 5, no UI framework, plain CSS in `styles.css` |
| Exports | `docx` for the Word download, `exceljs` for the generated workbooks |
| Unit tests | vitest, offline |
| E2E | Playwright (Chromium) |

Adding a dependency needs a reason that is written down. The pipeline is deliberately
plain — regexes and standard library, no NLP or date-parsing library — because the
extraction rules are the thing under test and an opaque library would hide them.

## Coding style

- **Strict TypeScript, no `any`.** Use `import type` for type-only imports.
- **Named exports.** Default exports only where a tool demands one (`vite.config.ts`, `playwright.config.ts`).
- 2-space indent, single quotes, semicolons, trailing commas, lines up to ~110 columns. Match the surrounding file; there is no formatter in CI.
- **Types live in `types.ts`,** never inline in a module that uses them. `backend/src/types.ts` is canonical.
- **Cue patterns are module-level `SCREAMING_SNAKE` constants** at the top of the file (`TOPIC_CUE`, `ACTION_CUE`, `META_KEYS`). Never inline a regex in a branch — the patterns are the spec, keep them readable together.
- **Each layer is pure functions over the previous layer's output.** No hidden state, no I/O below `server.ts`.
- **Comments say why, not what.** Prefer a line that names the rule or the requirement it protects ("Relative phrasing is deliberately NOT resolved — the Analyze layer flags it") over one that restates the code.
- **Test names read as sentences** — `flags a meeting whose topics reached no decision`, not `test no decision`. They are lifted verbatim into the generated test-case workbooks.

## Running

```bash
# Install all workspaces
npm install

# Run both backend + frontend in dev mode
npm run dev

# Run backend only (port 3001)
npm run dev:backend

# Run frontend only (port 5173, proxies /api → :3001)
npm run dev:frontend

# Unit tests (offline, no API key needed)
npm test

# Type-check
npm run lint

# Build
npm run build

# E2E tests (starts both servers automatically) — needs Node 20+
npm run test:e2e

# Regenerate the SRS + test-case documents in docs/generated/
npm run docs
```

`npm run test:e2e` refuses to start on Node 18. Use Node 20 or newer, and run
`npx playwright install chromium` once before the first E2E run.

## Domain vocabulary

Always use the terms from `CONTEXT.md`. The code types in `backend/src/types.ts` and `frontend/src/types.ts` mirror these definitions. Key terms:

- **Distillation Run** — one submission of one or more transcripts.
- **Meeting** — one real-world gathering, one transcript.
- **Transcript** — the raw uploaded text.
- **Topic** — one subject within a meeting; carries summary, decisions, action items.
- **Decision** — a conclusion reached about a topic.
- **Action Item** — a commitment with an owner, description, and due date (any may be missing).
- **Owner** — exact name string from transcript; never normalised, never merged.
- **Flag** — a machine-detected problem; annotates but never blocks.

## Conventions

- **Never reject a transcript.** If format detection fails, fall through to `unstructured` and let the pipeline degrade.
- **Never merge owners.** "Somchai" and "คุณสมชาย" are two distinct owners. Surface look-alikes as an `AMBIGUOUS_OWNER` flag.
- **Relative dates are not resolved.** "Next Friday" stays in `dueDateRaw` with `dueDate = null`. The Analyze layer flags it as `UNCLEAR_DUE_DATE`.
- **Flags never block.** They annotate the result; the pipeline always completes.
- **The `Distiller` interface is a contract.** Both `HeuristicDistiller` and `ClaudeDistiller` must return the same `DistilledMeeting` shape — the Analyze layer and its tests depend on it.
- **Bilingual support.** Regexes and cue patterns intentionally mix Thai and English. Sample transcripts include both.
- **`npm test` runs offline.** No network, no API key. All testable behaviour lives in Parse or Analyze. The Distill layer has a fixture-backed fake.
- **E2E assertions are about meaning, not incidental counts.** Assert on `.flag-no_decision`, or on the owner names, rather than on how many `.flag` or `.owner-card` elements happen to render. A count-based assertion breaks on every Distill change and tells you nothing about what went wrong.
- **`docs/generated/` is build output.** Never hand-edit a `.docx` or `.xlsx` in there. Change `backend/scripts/requirements.ts` (or the tests themselves) and re-run `npm run docs`.

## File ownership

- `backend/src/types.ts` is the canonical type source. `frontend/src/types.ts` mirrors it (minus backend-only fields like `turns`, `raw`).
- When adding a new flag code, update: `types.ts` (both), `analyze.ts`, `docx.ts` (if it appears in the document), and `frontend/src/App.tsx` (`FLAG_LABELS`).
- When adding a sample transcript, add a corresponding E2E test if it exercises a new path — the `add-transcript-fixture` skill lists every place it has to be wired in.
- When adding or renaming a test, re-run `npm run docs`. The generated workbooks read the `describe`/`it` titles straight out of the test files, and the generator fails if a Playwright test has no entry in `E2E_DETAILS` (`backend/scripts/testcases.ts`).

## Testing strategy

- **Unit tests** (`backend/tests/`): Parse and Analyze layers only. Use the fixture builders in `fixtures.ts`. No network.
- **E2E tests** (`e2e/tests/`): Full pipeline through the browser. Uses `samples/*.txt`. Playwright auto-starts both dev servers.
