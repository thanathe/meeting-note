/** Domain vocabulary is defined in /CONTEXT.md — keep these names in sync with it. */

export type TranscriptFormat =
  | 'speaker-colon'
  | 'timestamped'
  | 'header-bullet'
  | 'unstructured';

/** One attributed thing said at a Meeting. */
export interface Turn {
  speaker: string | null;
  text: string;
  /** "09:12" when the format carries one. */
  time: string | null;
}

/** Output of the Parse layer: deterministic, no LLM involved. */
export interface ParsedTranscript {
  meetingId: string;
  sourceFilename: string;
  format: TranscriptFormat;
  title: string | null;
  /** ISO date of the Meeting itself, when the Transcript states one. */
  meetingDate: string | null;
  participants: string[];
  turns: Turn[];
  raw: string;
}

export interface ActionItem {
  id: string;
  description: string;
  /** Exact name string as it appeared. Never normalised, never merged. */
  owner: string | null;
  /** ISO date, when we could resolve one. */
  dueDate: string | null;
  /** What the Transcript actually said, e.g. "next Friday", "ภายในสองวัน". */
  dueDateRaw: string | null;
  meetingId: string;
  topicTitle: string;
}

export interface Topic {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: ActionItem[];
}

/** Output of the Distill layer — the contract every Distiller must honour. */
export interface DistilledMeeting {
  topics: Topic[];
  /** Dates the Meeting treated as fixed milestones, e.g. a go-live. */
  milestones: { label: string; date: string }[];
}

export interface Meeting extends ParsedTranscript, DistilledMeeting {}

export type FlagCode =
  | 'NO_DECISION'
  | 'UNOWNED_ACTION_ITEM'
  | 'AMBIGUOUS_OWNER'
  | 'UNCLEAR_DUE_DATE'
  | 'CONFLICTING_DUE_DATE';

export interface Flag {
  code: FlagCode;
  message: string;
  meetingId?: string;
  actionItemId?: string;
  owners?: string[];
}

export interface OwnerGroup {
  /** null means "no Owner could be identified". */
  owner: string | null;
  actionItems: ActionItem[];
}

export interface DistillationRun {
  id: string;
  createdAt: string;
  meetings: Meeting[];
  ownerGroups: OwnerGroup[];
  flags: Flag[];
}
