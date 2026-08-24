import type { ActionItem, Meeting, Topic } from '../src/types';

/** Builders so each test states only the thing it is actually about. */

export function actionItem(over: Partial<ActionItem> = {}): ActionItem {
  return {
    id: 'a1',
    description: 'do the thing',
    owner: 'Ploy',
    dueDate: null,
    dueDateRaw: null,
    meetingId: 'm1',
    topicTitle: 'Topic',
    ...over,
  };
}

export function topic(over: Partial<Topic> = {}): Topic {
  return { title: 'Topic', summary: 'summary', decisions: ['we agreed'], actionItems: [], ...over };
}

export function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    meetingId: 'm1',
    sourceFilename: 'm1.txt',
    format: 'speaker-colon',
    title: 'Meeting',
    meetingDate: '2026-08-10',
    participants: ['Ploy'],
    turns: [],
    raw: '',
    topics: [topic()],
    milestones: [],
    ...over,
  };
}
