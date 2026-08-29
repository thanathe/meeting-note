/** Mirrors backend/src/types.ts — the Distillation Run as the browser receives it. */
export interface ActionItem {
  id: string;
  description: string;
  owner: string | null;
  dueDate: string | null;
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
export interface Milestone {
  label: string;
  date: string;
}
export interface Meeting {
  meetingId: string;
  sourceFilename: string;
  format: string;
  title: string | null;
  meetingDate: string | null;
  participants: string[];
  topics: Topic[];
  milestones: Milestone[];
}
export interface Flag {
  code: string;
  message: string;
  meetingId?: string;
  actionItemId?: string;
  owners?: string[];
}
export interface OwnerGroup {
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
