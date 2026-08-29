---
name: add-transcript-fixture
description: Add a new sample transcript to samples/ and wire it through the parse fixtures, the unit suite, and the E2E suite so a new input shape is covered end to end.
---

# Skill: add-transcript-fixture

Use this skill whenever a new transcript **shape** turns up — a new format, a new
language, or a new failure mode (a meeting that decided nothing, an action item with
two candidate dates). Adding one file to `samples/` is never the whole job, and the
steps below are the ones that get forgotten.

## Why this skill exists

Every new sample transcript touches four places. Skipping any one of them leaves the
repository in a state that looks finished and is not:

- a sample nobody parses is dead weight,
- a parse change with no unit test regresses silently,
- an E2E expectation hard-coded to a count says nothing useful when it fails, and
  `toBeVisible()` on a locator that matches several elements fails strict mode outright,
- and `docs/generated/` still describes the previous suite until it is regenerated.

That is a repeated, error-prone workflow, which is exactly what a skill is for.

## Steps

### 1. Add the transcript

`samples/NN-short-name.txt`, numbered after the last one. Keep it short — a dozen
lines is enough to exercise a shape — and make it realistic rather than synthetic.

Say in one line what shape it exercises, then check it is genuinely new:

| Existing | Format | Language | Shape |
|---|---|---|---|
| `01-sprint-planning.txt` | speaker-colon | English | Clean, two topics, absolute dates |
| `02-design-review.txt` | timestamped | English | Honorifics, milestone, relative date |
| `03-standup-th.txt` | header-bullet | Thai | Thai cues, relative date |
| `04-messy-notes.txt` | unstructured | English | No decisions, unowned action item |

If the new file duplicates a row above, it is not worth adding.

### 2. Check what the pipeline actually does with it

```bash
npm run dev:backend
curl -s -X POST http://localhost:3001/api/runs \
  -F "transcripts=@samples/NN-short-name.txt" | jq '.meetings[0].topics[].title, .flags'
```

Read the output before writing any expectation. If the format was misdetected or the
header block leaked into a Topic, that is a Parse or Distill bug — fix it there, not
in the test.

### 3. Add the unit test

`backend/tests/parse.test.ts` for a new format or header shape,
`backend/tests/distill.test.ts` for a new cue, `backend/tests/analyze.test.ts` for a
new flag. Use an **inline transcript string**, not the sample file — the unit suite
must stay offline and independent of `samples/`.

Add a `//` comment above the test saying which edge case it pins down. The comment is
lifted verbatim into the generated Unit Test Case workbook.

### 4. Add the E2E test

`e2e/tests/distill.spec.ts`, only if the sample exercises a path the suite does not
already cover. Assert on **meaning**, not on incidental counts — prefer
`.flag-no_decision` over `.flag` with a hard count, and prefer the owner names over
the number of owner cards.

Then add the matching entry to `E2E_DETAILS` in `backend/scripts/testcases.ts`.
`npm run docs` fails loudly if a Playwright test has no entry there.

### 5. Regenerate and verify

```bash
npm test          # offline unit suite
npm run lint      # type-check backend + frontend + scripts
npm run test:e2e  # needs Node 20+ and `npx playwright install chromium`
npm run docs      # refresh docs/generated/
```

Commit the sample, the tests, and the regenerated documents together.

## Rules that apply while doing this

- **Never reject a transcript.** A new format that is not detected must fall through
  to `unstructured`, not throw. See `CLAUDE.md`.
- **Never merge Owners.** A new sample with `Somchai` and `คุณสมชาย` must produce two
  Owner groups and an `AMBIGUOUS_OWNER` flag — not one group.
- **Never resolve a relative date.** Keep it in `dueDateRaw` and let Analyze flag it.
- Use the vocabulary in `CONTEXT.md` in the test names: Topic, Decision, Action Item,
  Owner, Flag — not "section", "task" or "assignee".
