import { describe, expect, it } from 'vitest';
import { HeuristicDistiller } from '../src/distill';
import { parseTranscript } from '../src/parse';

const distiller = new HeuristicDistiller();

async function distil(raw: string) {
  return distiller.distill(parseTranscript('t.txt', raw, 'm1'));
}

describe('heuristic distiller', () => {
  it('splits a transcript into one topic per topic cue', async () => {
    const result = await distil(
      'Topic 1: Checkout\nAnna: we agreed to rewrite it\nTopic 2: Billing\nPloy: we agreed to wait',
    );
    expect(result.topics.map((t) => t.title)).toEqual(['Checkout', 'Billing']);
  });

  it('attributes an action item to the named owner', async () => {
    const result = await distil('Anna: Somchai will draft the migration plan by 2026-08-14.');
    const [item] = result.topics[0].actionItems;
    expect(item.owner).toBe('Somchai');
    expect(item.dueDate).toBe('2026-08-14');
  });

  it('attributes a self-assignment to the speaker', async () => {
    const result = await distil("Ploy: I'll take the API contract review.");
    expect(result.topics[0].actionItems[0].owner).toBe('Ploy');
  });

  // Edge case named in the assignment: an action item with no owner.
  it('leaves the owner null rather than guessing', async () => {
    const result = await distil('Ravi: Someone needs to update the staging seed data.');
    expect(result.topics[0].actionItems[0].owner).toBeNull();
  });

  it('keeps a vague deadline as raw text and refuses to resolve it to a date', async () => {
    const result = await distil('Anna: please rewrite the error copy next Friday.');
    const [item] = result.topics[0].actionItems;
    expect(item.dueDateRaw).toMatch(/next Friday/i);
    expect(item.dueDate).toBeNull();
  });

  it('records a go-live as a milestone', async () => {
    const result = await distil('Anna: Go-live is locked for 2026-08-18.');
    expect(result.milestones[0].date).toBe('2026-08-18');
  });

  it('handles a Thai transcript', async () => {
    const result = await distil('- พลอย — ฝาก อรรถพล ช่วยเช็ค config ภายในสัปดาห์นี้');
    expect(result.topics[0].actionItems.length).toBeGreaterThan(0);
  });
});
