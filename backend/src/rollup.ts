import type { Meeting, OwnerGroup } from './types';
import { allActionItems } from './analyze';

/**
 * Requirement 5b: Action Items grouped by Owner across the whole Distillation Run,
 * so a person sees everything on their plate in one place.
 *
 * Grouping is by EXACT owner string. Look-alike names are surfaced as an
 * AMBIGUOUS_OWNER flag instead of being silently merged. See CONTEXT.md.
 */
export function groupByOwner(meetings: Meeting[]): OwnerGroup[] {
  const groups = new Map<string | null, OwnerGroup>();

  for (const item of allActionItems(meetings)) {
    const key = item.owner;
    if (!groups.has(key)) groups.set(key, { owner: key, actionItems: [] });
    groups.get(key)!.actionItems.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.owner === null) return 1; // unowned items sink to the bottom
    if (b.owner === null) return -1;
    return a.owner.localeCompare(b.owner);
  });
}
