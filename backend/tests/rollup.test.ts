import { describe, expect, it } from 'vitest';
import { groupByOwner } from '../src/rollup';
import { actionItem, meeting, topic } from './fixtures';

describe('grouping action items by owner', () => {
  it('rolls one owner up across every meeting in the run', () => {
    const a = meeting({ meetingId: 'm1', topics: [topic({ actionItems: [actionItem({ owner: 'Ploy' })] })] });
    const b = meeting({ meetingId: 'm2', topics: [topic({ actionItems: [actionItem({ id: 'a2', owner: 'Ploy', meetingId: 'm2' })] })] });

    const groups = groupByOwner([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].actionItems.map((i) => i.meetingId)).toEqual(['m1', 'm2']);
  });

  // Owners are matched on the exact string — look-alikes are flagged, never merged.
  it('keeps look-alike owner names in separate groups', () => {
    const m = meeting({
      topics: [topic({ actionItems: [actionItem({ owner: 'Somchai' }), actionItem({ id: 'a2', owner: 'somchai' })] })],
    });
    expect(groupByOwner([m])).toHaveLength(2);
  });

  it('collects unowned action items into their own group, listed last', () => {
    const m = meeting({
      topics: [topic({ actionItems: [actionItem({ owner: null }), actionItem({ id: 'a2', owner: 'Anna' })] })],
    });
    const groups = groupByOwner([m]);
    expect(groups[groups.length - 1].owner).toBeNull();
  });
});
