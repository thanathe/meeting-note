import { describe, expect, it } from 'vitest';
import { analyze, normaliseOwner } from '../src/analyze';
import { actionItem, meeting, topic } from './fixtures';

const codes = (flags: ReturnType<typeof analyze>) => flags.map((f) => f.code);

describe('no-decision detection', () => {
  // Edge case named in the assignment: a meeting that decided nothing.
  it('flags a meeting whose topics reached no decision', () => {
    const m = meeting({ topics: [topic({ decisions: [] }), topic({ decisions: [] })] });
    expect(codes(analyze([m]))).toContain('NO_DECISION');
  });

  it('does not flag a meeting where any topic reached a decision', () => {
    const m = meeting({ topics: [topic({ decisions: [] }), topic({ decisions: ['ship it'] })] });
    expect(codes(analyze([m]))).not.toContain('NO_DECISION');
  });
});

describe('ownership', () => {
  // Edge case named in the assignment: an action item with no owner.
  it('flags an action item with no owner', () => {
    const m = meeting({ topics: [topic({ actionItems: [actionItem({ owner: null })] })] });
    const flag = analyze([m]).find((f) => f.code === 'UNOWNED_ACTION_ITEM');
    expect(flag?.actionItemId).toBe('a1');
  });

  it('flags look-alike owner names across different meetings', () => {
    const a = meeting({ meetingId: 'm1', topics: [topic({ actionItems: [actionItem({ owner: 'Somchai' })] })] });
    const b = meeting({ meetingId: 'm2', topics: [topic({ actionItems: [actionItem({ owner: 'K. Somchai' })] })] });
    const flag = analyze([a, b]).find((f) => f.code === 'AMBIGUOUS_OWNER');
    expect(flag?.owners).toEqual(expect.arrayContaining(['Somchai', 'K. Somchai']));
  });

  it('does not flag two genuinely different owners', () => {
    const m = meeting({
      topics: [topic({ actionItems: [actionItem({ owner: 'Ploy' }), actionItem({ id: 'a2', owner: 'Anna' })] })],
    });
    expect(codes(analyze([m]))).not.toContain('AMBIGUOUS_OWNER');
  });

  it('strips honorifics and casing only for comparison', () => {
    expect(normaliseOwner('คุณสมชาย')).toBe(normaliseOwner('สมชาย'));
    expect(normaliseOwner('K. Somchai')).toBe(normaliseOwner('somchai'));
  });
});

describe('date problems', () => {
  it('flags a deadline that was stated but is not a specific day', () => {
    const m = meeting({
      topics: [topic({ actionItems: [actionItem({ dueDateRaw: 'next Friday', dueDate: null })] })],
    });
    expect(codes(analyze([m]))).toContain('UNCLEAR_DUE_DATE');
  });

  it('does not flag an action item that mentioned no deadline at all', () => {
    const m = meeting({ topics: [topic({ actionItems: [actionItem()] })] });
    expect(codes(analyze([m]))).not.toContain('UNCLEAR_DUE_DATE');
  });

  // Requirement 4: the action item is due after the go-live it is supposed to precede.
  it('flags an action item due after a milestone it should precede', () => {
    const m = meeting({
      milestones: [{ label: 'go-live', date: '2026-08-18' }],
      topics: [topic({ actionItems: [actionItem({ dueDate: '2026-08-25' })] })],
    });
    const flag = analyze([m]).find((f) => f.code === 'CONFLICTING_DUE_DATE');
    expect(flag?.message).toContain('2026-08-18');
  });

  it('flags a deadline that falls before the meeting itself', () => {
    const m = meeting({
      meetingDate: '2026-08-10',
      topics: [topic({ actionItems: [actionItem({ dueDate: '2026-08-01' })] })],
    });
    expect(codes(analyze([m]))).toContain('CONFLICTING_DUE_DATE');
  });

  it('leaves a deadline comfortably before the milestone alone', () => {
    const m = meeting({
      milestones: [{ label: 'go-live', date: '2026-08-18' }],
      topics: [topic({ actionItems: [actionItem({ dueDate: '2026-08-14' })] })],
    });
    expect(codes(analyze([m]))).not.toContain('CONFLICTING_DUE_DATE');
  });
});
