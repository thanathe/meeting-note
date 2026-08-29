import type { ParsedTranscript, TranscriptFormat, Turn } from './types';

/**
 * Parse layer. Deterministic — no LLM, no network. Everything here is unit-tested.
 *
 * We never reject a Transcript. Unrecognised input falls through to 'unstructured'
 * so the pipeline degrades instead of crashing (assignment requirement 2).
 */

const TIMESTAMPED = /^\s*[\[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?\s*[-–]?\s*([^:]{1,60}?)\s*:\s*(.*)$/;
const SPEAKER_COLON = /^\s*([^:]{1,60}?)\s*:\s*(.*)$/;
const HEADER_BULLET = /^\s*[-*•]\s*([^—:-]{1,60}?)\s*[—:-]\s+(.*)$/;

/** Structural lines like "Topic 1: Checkout" — they open a Topic, they are not a turn. */
const TOPIC_LINE = /^\s*(?:topic|agenda|section|หัวข้อ|เรื่อง)\s*\d*\s*[:\-\u2013]\s*\S/i;

/** Header lines like "Attendees: A, B" that must not be read as speaker turns. */
const META_KEYS = /^(meeting|title|topic|date|time|attendees|participants|present|หัวข้อ|วันที่|ผู้เข้าร่วม|ผู้เข้าประชุม)$/i;

/** readMeta only reads the head of a Transcript; extractTurns skips the same window. */
const META_WINDOW = 12;

function isMetaLine(line: string): boolean {
  const m = SPEAKER_COLON.exec(line);
  return !!m && META_KEYS.test(m[1].trim());
}

function nonEmptyLines(raw: string): string[] {
  return raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

function ratio(lines: string[], re: RegExp): number {
  if (lines.length === 0) return 0;
  const hits = lines.filter((l) => {
    const m = re.exec(l);
    if (!m) return false;
    // A meta line ("Attendees: ...") matches SPEAKER_COLON but is not a turn.
    return !META_KEYS.test(m[1].trim());
  }).length;
  return hits / lines.length;
}

export function detectFormat(raw: string): TranscriptFormat {
  const lines = nonEmptyLines(raw);
  const scores: [TranscriptFormat, number][] = [
    ['timestamped', ratio(lines, TIMESTAMPED)],
    ['header-bullet', ratio(lines, HEADER_BULLET)],
    ['speaker-colon', ratio(lines, SPEAKER_COLON)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [format, score] = scores[0];
  return score >= 0.3 ? format : 'unstructured';
}

function readMeta(lines: string[]): { title: string | null; date: string | null; listed: string[] } {
  let title: string | null = null;
  let date: string | null = null;
  const listed: string[] = [];

  for (const line of lines.slice(0, META_WINDOW)) {
    const m = SPEAKER_COLON.exec(line);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (!META_KEYS.test(key) || !value) continue;

    if (/^(meeting|title|topic|หัวข้อ)$/i.test(key)) title ??= value;
    else if (/^(date|วันที่)$/i.test(key)) date ??= toIsoDate(value);
    else listed.push(...value.split(/[,、และ]|\band\b/).map((n) => n.trim()).filter(Boolean));
  }
  return { title, date, listed };
}

export function toIsoDate(value: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return iso[0];
  const dmy = /(\d{1,2})[/](\d{1,2})[/](\d{4})/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

function extractTurns(lines: string[], format: TranscriptFormat): Turn[] {
  const turns: Turn[] = [];

  lines.forEach((line, index) => {
    // Topic markers are handed to the Distill layer intact, unattributed.
    if (TOPIC_LINE.test(line)) { turns.push({ time: null, speaker: null, text: line.trim() }); return; }

    // Header lines ("Meeting:", "Date:", "Attendees:") are consumed by readMeta.
    // Dropping them here stops the header block becoming a phantom Topic downstream.
    if (index < META_WINDOW && isMetaLine(line)) return;

    if (format === 'timestamped') {
      const m = TIMESTAMPED.exec(line);
      if (m) { turns.push({ time: m[1], speaker: m[2].trim(), text: m[3].trim() }); return; }
    }
    if (format === 'header-bullet') {
      const m = HEADER_BULLET.exec(line);
      if (m) { turns.push({ time: null, speaker: m[1].trim(), text: m[2].trim() }); return; }
    }
    if (format === 'speaker-colon' || format === 'timestamped') {
      const m = SPEAKER_COLON.exec(line);
      if (m && !META_KEYS.test(m[1].trim())) {
        turns.push({ time: null, speaker: m[1].trim(), text: m[2].trim() });
        return;
      }
    }
    // Unattributed line: append to the previous turn, or stand alone with no Speaker.
    const text = line.trim();
    const prev = turns[turns.length - 1];
    if (prev && format !== 'unstructured') prev.text += ' ' + text;
    else turns.push({ time: null, speaker: null, text });
  });
  return turns;
}

export function parseTranscript(sourceFilename: string, raw: string, meetingId: string): ParsedTranscript {
  const lines = nonEmptyLines(raw);
  const format = detectFormat(raw);
  const { title, date, listed } = readMeta(lines);
  const turns = extractTurns(lines, format);

  // Participants = everyone listed in the header, plus everyone who actually speaks.
  // A Speaker is always a Participant; a Participant need not speak. (see CONTEXT.md)
  const speakers = turns.map((t) => t.speaker).filter((s): s is string => !!s);
  const participants = [...new Set([...listed, ...speakers])];

  return {
    meetingId,
    sourceFilename,
    format,
    title: title ?? sourceFilename.replace(/\.txt$/i, ''),
    meetingDate: date,
    participants,
    turns,
    raw,
  };
}
