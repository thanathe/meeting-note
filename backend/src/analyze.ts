import type { ActionItem, Flag, Meeting } from './types';

/**
 * Analyze layer. Deterministic — runs on the Distiller's output, never on raw text.
 * This is where every behaviour the assignment asks us to unit-test lives. See ADR-0001.
 */

const HONORIFICS = /^(?:คุณ|พี่|น้อง|khun|k\.|mr|mrs|ms|miss|dr)\.?\s*/i;

/** Used ONLY to detect look-alike Owners. Owners are never merged on this basis. */
export function normaliseOwner(owner: string): string {
  return owner.trim().replace(HONORIFICS, '').toLowerCase().replace(/[\s._-]+/g, '');
}

export function allActionItems(meetings: Meeting[]): ActionItem[] {
  return meetings.flatMap((m) => m.topics.flatMap((t) => t.actionItems));
}

/** Requirement 4: a Meeting that reached no Decision at all. */
function flagNoDecision(meetings: Meeting[]): Flag[] {
  return meetings
    .filter((m) => m.topics.every((t) => t.decisions.length === 0))
    .map((m) => ({
      code: 'NO_DECISION' as const,
      meetingId: m.meetingId,
      message: `"${m.title}" discussed ${m.topics.length} topic(s) but reached no decision.`,
    }));
}

/** Requirement 5c: an Action Item nobody is accountable for. */
function flagUnowned(items: ActionItem[]): Flag[] {
  return items
    .filter((item) => item.owner === null)
    .map((item) => ({
      code: 'UNOWNED_ACTION_ITEM' as const,
      meetingId: item.meetingId,
      actionItemId: item.id,
      message: `No owner identified for: "${truncate(item.description)}"`,
    }));
}

/**
 * Requirement 5c: Owners that look like the same person.
 * We flag and let a human decide — we never merge. See CONTEXT.md.
 */
function flagAmbiguousOwners(items: ActionItem[]): Flag[] {
  const byNormalised = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.owner) continue;
    const key = normaliseOwner(item.owner);
    if (!byNormalised.has(key)) byNormalised.set(key, new Set());
    byNormalised.get(key)!.add(item.owner);
  }

  return [...byNormalised.values()]
    .filter((variants) => variants.size > 1)
    .map((variants) => ({
      code: 'AMBIGUOUS_OWNER' as const,
      owners: [...variants],
      message: `These may be the same person: ${[...variants].map((v) => `"${v}"`).join(', ')}. Not merged — confirm manually.`,
    }));
}

/** Requirement 4: a due date that was stated but cannot be pinned to a day. */
function flagUnclearDates(items: ActionItem[]): Flag[] {
  return items
    .filter((item) => item.dueDateRaw !== null && item.dueDate === null)
    .map((item) => ({
      code: 'UNCLEAR_DUE_DATE' as const,
      meetingId: item.meetingId,
      actionItemId: item.id,
      message: `"${item.dueDateRaw}" is not a specific date — cannot tell when "${truncate(item.description)}" is due.`,
    }));
}

/**
 * Requirement 4: an Action Item whose date contradicts the Meeting it came from —
 * either due before the Meeting happened, or due after a milestone it must precede.
 */
function flagConflictingDates(meetings: Meeting[]): Flag[] {
  const flags: Flag[] = [];

  for (const meeting of meetings) {
    const items = meeting.topics.flatMap((t) => t.actionItems).filter((i) => i.dueDate);

    for (const item of items) {
      if (meeting.meetingDate && item.dueDate! < meeting.meetingDate) {
        flags.push({
          code: 'CONFLICTING_DUE_DATE',
          meetingId: meeting.meetingId,
          actionItemId: item.id,
          message: `Due ${item.dueDate} but the meeting was on ${meeting.meetingDate} — the deadline is already past.`,
        });
        continue;
      }
      for (const milestone of meeting.milestones) {
        if (item.dueDate! > milestone.date) {
          flags.push({
            code: 'CONFLICTING_DUE_DATE',
            meetingId: meeting.meetingId,
            actionItemId: item.id,
            message: `Due ${item.dueDate}, after the ${milestone.date} milestone it should precede.`,
          });
          break;
        }
      }
    }
  }
  return flags;
}

export function analyze(meetings: Meeting[]): Flag[] {
  const items = allActionItems(meetings);
  return [
    ...flagNoDecision(meetings),
    ...flagUnowned(items),
    ...flagAmbiguousOwners(items),
    ...flagUnclearDates(items),
    ...flagConflictingDates(meetings),
  ];
}

function truncate(text: string, max = 60): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}
