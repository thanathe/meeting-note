# Extraction is a three-layer pipeline with the LLM isolated behind one interface

The assignment requires both LLM-quality distillation (multi-format, multi-language transcripts) and
unit-testable extraction logic. Pure-LLM extraction would make `npm test` non-deterministic and
dependent on an API key; pure rule-based extraction cannot produce grounded per-topic summaries.

We therefore split extraction into three layers: **Parse** (deterministic — format detection, speaker
turns, participants), **Distill** (semantic — topics, summaries, decisions, action items; the only
layer that calls an LLM), and **Analyze** (deterministic — the flagging rules for no-decision meetings,
ownerless action items, and conflicting dates).

The LLM sits behind a single `Distiller` interface with a fixture-backed fake implementation. Every
behaviour the assignment asks us to unit-test lives in Parse or Analyze, so the full test suite runs
offline with no API key.

## Consequences

- A fixture set of recorded `Distiller` outputs must be maintained alongside the sample transcripts.
- Flagging rules operate on the Distiller's *output shape*, not on raw text, so that shape is a
  contract that the fake and the real implementation must both honour.
