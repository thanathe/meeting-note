import type { DistilledMeeting, ParsedTranscript, ActionItem, Topic, Turn } from './types';
import { toIsoDate } from './parse';

/**
 * Distill layer. The ONLY layer allowed to call an LLM.
 *
 * Every implementation must honour the DistilledMeeting shape, because the Analyze layer
 * (and its unit tests) run against that shape rather than against raw text. See ADR-0001.
 */
export interface Distiller {
  readonly name: string;
  distill(parsed: ParsedTranscript): Promise<DistilledMeeting>;
}

// ---------------------------------------------------------------------------
// Cues. Bilingual on purpose — sample Transcripts mix Thai and English.
// ---------------------------------------------------------------------------

const TOPIC_CUE = /^(?:topic|agenda|section|หัวข้อ|เรื่อง)\s*\d*\s*[:\-–]\s*(.+)$/i;
const DECISION_CUE = /\b(?:we (?:have )?decided|decision|agreed|we'll go with|approved|conclusion)\b|สรุปว่า|ตกลง(?:ว่า|กัน)|มติ|เคาะ(?:ว่า|แล้ว)/i;
const ACTION_CUE = /\b(?:action item|will|shall|needs? to|to-?do|follow up|please|by end of|deliver)\b|\bi'?ll\b|\blet me\b|\bi can take\b|จะ(?!ก)|ฝาก|ช่วย|ต้อง|มอบหมาย|รับไป/i;

/** Indefinite subjects are not people. "Someone will fix it" has no Owner. */
const NOT_A_PERSON = /^(?:someone|somebody|anyone|anybody|everyone|everybody|nobody|we|they|you|it|this|that|the team|ใคร|ทุกคน)$/i;
const MILESTONE_CUE = /\b(?:go-?live|launch|release|deadline|ship)\b|ขึ้น(?:ระบบ|จริง)|เดดไลน์|กำหนดส่ง/i;

const ABSOLUTE_DATE = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?/i;
const RELATIVE_DATE = /\b(?:next|this|end of)\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|sprint)\b|\bin\s+\d+\s+(?:day|week)s?\b|\basap\b|ภายใน\s*\S+|สัปดาห์หน้า|อาทิตย์หน้า|สิ้นเดือน|โดยเร็ว/i;

const OWNER_PATTERNS: RegExp[] = [
  /@([A-Za-z฀-๿][\w฀-๿.'-]*(?:\s[A-Z][\w.'-]*)?)/,
  /\b(?:assigned? to|owner is|owned by)\s+([A-Za-z฀-๿][\w฀-๿.'-]*(?:\s[A-Z][\w.'-]*)?)/i,
  /(?:มอบหมายให้|ฝาก|ให้)\s*(คุณ?\s?[฀-๿A-Za-z][\w฀-๿.'-]*)/,
  /\b([A-Z][a-z][\w.'-]*(?:\s[A-Z][\w.'-]*)?)\s+(?:will|shall|is going to|needs? to)\b/,
];

function findOwner(text: string, fallbackSpeaker: string | null): string | null {
  for (const re of OWNER_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const candidate = m[1].trim();
    if (!NOT_A_PERSON.test(candidate)) return candidate;
  }
  // "I'll take that" — the Speaker owns it.
  if (/\b(?:i(?:'| wi)ll|i can take|let me)\b|เดี๋ยวผม|เดี๋ยวเรา|ผมรับ|เรารับ/i.test(text)) return fallbackSpeaker;
  return null;
}

function findDue(text: string): { dueDate: string | null; dueDateRaw: string | null } {
  const abs = ABSOLUTE_DATE.exec(text);
  if (abs) return { dueDate: toIsoDate(abs[0]), dueDateRaw: abs[0] };
  const rel = RELATIVE_DATE.exec(text);
  // Relative phrasing is deliberately NOT resolved — the Analyze layer flags it as unclear.
  if (rel) return { dueDate: null, dueDateRaw: rel[0].trim() };
  return { dueDate: null, dueDateRaw: null };
}

function summarise(turns: Turn[]): string {
  const sentences = turns.map((t) => t.text).join(' ').split(/(?<=[.!?。])\s+|(?<=ครับ|ค่ะ)\s+/);
  return sentences.slice(0, 3).join(' ').slice(0, 400).trim();
}

/**
 * Deterministic, offline Distiller.
 *
 * Serves two roles: the fallback when no ANTHROPIC_API_KEY is present, and the test double
 * that lets the whole suite run without network access.
 */
export class HeuristicDistiller implements Distiller {
  readonly name = 'heuristic';

  async distill(parsed: ParsedTranscript): Promise<DistilledMeeting> {
    const buckets: { title: string; turns: Turn[] }[] = [];

    for (const turn of parsed.turns) {
      const cue = TOPIC_CUE.exec(turn.text);
      if (cue) { buckets.push({ title: cue[1].trim(), turns: [] }); continue; }
      if (buckets.length === 0) buckets.push({ title: parsed.title ?? 'General discussion', turns: [] });
      buckets[buckets.length - 1].turns.push(turn);
    }
    if (buckets.length === 0) buckets.push({ title: parsed.title ?? 'General discussion', turns: [] });

    const topics: Topic[] = buckets.map((bucket, ti) => {
      const actionItems: ActionItem[] = [];
      const decisions: string[] = [];

      bucket.turns.forEach((turn, i) => {
        if (DECISION_CUE.test(turn.text)) decisions.push(turn.text);
        if (ACTION_CUE.test(turn.text)) {
          actionItems.push({
            id: `${parsed.meetingId}-t${ti}-a${i}`,
            description: turn.text,
            owner: findOwner(turn.text, turn.speaker),
            ...findDue(turn.text),
            meetingId: parsed.meetingId,
            topicTitle: bucket.title,
          });
        }
      });

      return { title: bucket.title, summary: summarise(bucket.turns), decisions, actionItems };
    });

    const milestones = parsed.turns
      .filter((t) => MILESTONE_CUE.test(t.text) && ABSOLUTE_DATE.test(t.text))
      .map((t) => ({ label: t.text.slice(0, 120), date: toIsoDate(ABSOLUTE_DATE.exec(t.text)![0])! }))
      .filter((m) => !!m.date);

    return { topics, milestones };
  }
}
