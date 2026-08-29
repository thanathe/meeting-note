import { describe, expect, it } from 'vitest';
import { detectFormat, parseTranscript } from '../src/parse';

describe('format detection', () => {
  it('recognises a plain speaker-colon transcript', () => {
    expect(detectFormat('Anna: hello there\nPloy: hi back')).toBe('speaker-colon');
  });

  it('recognises a timestamped transcript', () => {
    expect(detectFormat('[09:02] Anna: hello\n[09:03] Ploy: hi')).toBe('timestamped');
  });

  it('recognises a header-and-bullet transcript', () => {
    expect(detectFormat('- Anna — looked at the logs\n- Ploy — still blocked')).toBe('header-bullet');
  });

  // Edge case: requirement 2 says three formats must work and nothing may crash.
  it('falls back to unstructured instead of throwing on free-form notes', () => {
    expect(detectFormat('nobody landed on anything\nwe ran out of time')).toBe('unstructured');
  });

  it('does not crash on an empty transcript', () => {
    expect(() => parseTranscript('empty.txt', '', 'm1')).not.toThrow();
  });
});

describe('participants', () => {
  const raw = [
    'Meeting: Sprint Planning',
    'Date: 2026-08-10',
    'Attendees: Anna, Ploy, Ravi',
    'Anna: shall we start',
    'Ploy: yes',
  ].join('\n');

  it('reads the meeting date and title from the header', () => {
    const parsed = parseTranscript('s.txt', raw, 'm1');
    expect(parsed.title).toBe('Sprint Planning');
    expect(parsed.meetingDate).toBe('2026-08-10');
  });

  it('never treats a header line as a speaker turn', () => {
    const parsed = parseTranscript('s.txt', raw, 'm1');
    expect(parsed.turns.map((t) => t.speaker)).not.toContain('Attendees');
  });

  // The header block used to survive as an unattributed turn, which the Distill
  // layer then bucketed into a phantom Topic ahead of "Topic 1".
  it('drops the header block instead of carrying it into the turns', () => {
    const parsed = parseTranscript('s.txt', raw, 'm1');
    expect(parsed.turns.map((t) => t.text)).not.toContain('Meeting: Sprint Planning');
    expect(parsed.turns[0].text).toBe('shall we start');
  });

  // A Participant need not be a Speaker — see CONTEXT.md.
  it('includes a listed attendee who never speaks', () => {
    const parsed = parseTranscript('s.txt', raw, 'm1');
    expect(parsed.participants).toContain('Ravi');
    expect(parsed.turns.some((t) => t.speaker === 'Ravi')).toBe(false);
  });
});
