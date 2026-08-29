---
name: transcript-distill
description: Distil raw meeting transcripts into structured summaries with action items, decisions, and flags using the three-layer pipeline.
---

# Skill: transcript-distill

Use this skill when the user asks to process, distil, or summarise meeting transcripts — either through the web UI, the backend API, or programmatically.

## What this skill does

Runs meeting transcript(s) through the three-layer extraction pipeline:
1. **Parse** — format detection, speaker turns, participants, date
2. **Distill** — topics, summaries, decisions, action items (LLM or heuristic)
3. **Analyze** — flagging rules for ambiguous owners, missing decisions, unclear dates

## How to run

### Option A: Web UI

```bash
npm run dev
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Drag `.txt` files onto the dropzone, click "Distill", view results, download .docx

### Option B: API directly

```bash
curl -X POST http://localhost:3001/api/runs \
  -F "transcripts=@samples/01-sprint-planning.txt" \
  -F "transcripts=@samples/02-design-review.txt"
```

Response: a `DistillationRun` JSON object with `meetings`, `ownerGroups`, and `flags`.

Download the Word document:
```bash
curl -o summary.docx http://localhost:3001/api/runs/<run-id>/document.docx
```

### Option C: Programmatic (for testing)

```typescript
import { parseTranscript } from './parse';
import { HeuristicDistiller } from './distill';
import { distillRun } from './pipeline';

const run = await distillRun(
  [{ filename: 'meeting.txt', content: transcriptText }],
  new HeuristicDistiller(),  // offline, no API key
);
```

## When to use the LLM vs heuristic

- **`ANTHROPIC_API_KEY` set**: `ClaudeDistiller` is used. Better summaries, better topic detection. Falls back to heuristic on API error.
- **No key**: `HeuristicDistiller` runs. Deterministic, offline. Good for development and CI.

## Reading the results

- **Meetings tab**: Per-meeting summaries with topics, decisions, and action items.
- **Action Items by Owner tab**: All action items grouped by owner across the entire run.
- **Flags tab**: Issues that need human review. Flags never block the pipeline.

## Domain vocabulary

See `CONTEXT.md` for the canonical definitions of Distillation Run, Meeting, Transcript, Topic, Decision, Action Item, Owner, Flag, etc. Always use these terms — not "task", "todo", "batch", etc.

## Sample transcripts

| File | Format | Language | Notes |
|------|--------|----------|-------|
| `samples/01-sprint-planning.txt` | speaker-colon | English | Clean, two topics, clear owners |
| `samples/02-design-review.txt` | timestamped | English | Timestamps, honorifics, milestone |
| `samples/03-standup-th.txt` | header-bullet | Thai | Thai standup, relative dates |
| `samples/04-messy-notes.txt` | unstructured | English | No decisions, unowned action item |
