# Meeting Notes Distiller

Turns raw meeting transcripts into structured, reviewable summaries — and surfaces the places where a
meeting failed to produce a clear outcome.

## Language

### The processing hierarchy

**Distillation Run**:
One submission of one or more Transcripts, processed together. The unit a user sees results for and
exports.
_Avoid_: batch, job, upload, session

**Meeting**:
One real-world gathering, represented by exactly one Transcript. A Distillation Run contains one or
more Meetings.
_Avoid_: note, document, file, minutes

**Transcript**:
The raw uploaded text of what was said at a Meeting, in whatever format it arrived.
_Avoid_: meeting note, raw note, input file

**Topic**:
One subject discussed within a Meeting. A Meeting has one or more Topics; each Topic carries its own
summary, Decisions, and Action Items.
_Avoid_: section, agenda item, subject

### What we extract

**Decision**:
A conclusion the Meeting reached about a Topic. Belongs to exactly one Topic.
_Avoid_: outcome, resolution, conclusion

**Action Item**:
A commitment that someone will do something after the Meeting. Belongs to exactly one Topic, and
carries an Owner, a description, and a due date — any of which may be missing or unclear.
_Avoid_: task, todo, follow-up, AI (ambiguous with the other AI)

**Owner**:
The single person accountable for an Action Item. Identified by the exact name string as it appears in
the Transcript — no normalisation, no fuzzy merging. An Action Item may have no Owner.
_Avoid_: assignee, responsible party, DRI

**Speaker**:
Someone who has at least one attributed turn in the Transcript.

**Participant**:
Someone present at the Meeting. Every Speaker is a Participant, but a Participant may never speak, and
an Owner is not necessarily a Participant — work can be assigned to an absent person.
_Avoid_: attendee, member, person

### What we surface

**Flag**:
A machine-detected problem with a Meeting or an Action Item that a human should look at. Flags never
block or alter the extracted result — they annotate it.
_Avoid_: warning, error, issue, alert

## Flagged ambiguities

**Topic vs Decision boundary** — unresolved. When a Meeting spends its entire time deciding one thing,
is that one Topic with one Decision, or does the Topic collapse into the Decision? Needs a rule.

**Owner identity across Meetings** — deliberately unresolved by the system. "Somchai", "somchai", and
"คุณสมชาย" are three distinct Owners as far as the model is concerned; the system raises a Flag
suggesting they may be the same person, and a human decides. We never merge them automatically.

## Example dialogue

> **Dev**: If the same person appears in three Meetings in one Run, do they show up once or three times?
>
> **Domain expert**: Once — that's the whole point of grouping by Owner. You want to open the Run and
> see everything on your plate this week, not flip between Meetings.
>
> **Dev**: And if one Meeting writes "Somchai" and another writes "คุณสมชาย"?
>
> **Domain expert**: Two Owners. We raise a Flag saying they look like the same person, but we don't
> merge them. Guessing wrong means work silently lands on the wrong person's list, and nobody notices
> until the deadline passes.
>
> **Dev**: What if someone is given an Action Item but wasn't in the room?
>
> **Domain expert**: Still a valid Owner. They're just not a Participant. Happens constantly — "let's
> get Ploy to handle the migration" and Ploy is on leave.
