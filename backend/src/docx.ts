import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { DistillationRun } from './types';

/**
 * Requirement 6: the Meeting summaries from requirement 5a, as a downloadable .docx.
 * One document per Distillation Run.
 */
export async function buildRunDocument(run: DistillationRun): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: 'Meeting Notes Distiller', heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${run.createdAt} · ${run.meetings.length} meeting(s)`, italics: true })],
    }),
  ];

  for (const meeting of run.meetings) {
    children.push(new Paragraph({ text: meeting.title ?? meeting.sourceFilename, heading: HeadingLevel.HEADING_1 }));
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Date: ', bold: true }),
          new TextRun(meeting.meetingDate ?? 'not stated'),
          new TextRun({ text: '   Participants: ', bold: true }),
          new TextRun(meeting.participants.join(', ') || 'not stated'),
        ],
      }),
    );

    for (const topic of meeting.topics) {
      children.push(new Paragraph({ text: topic.title, heading: HeadingLevel.HEADING_2 }));
      if (topic.summary) children.push(new Paragraph(topic.summary));

      children.push(new Paragraph({ text: 'Decisions', heading: HeadingLevel.HEADING_3 }));
      if (topic.decisions.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No decision reached.', italics: true })] }));
      } else {
        for (const decision of topic.decisions) children.push(new Paragraph({ text: decision, bullet: { level: 0 } }));
      }

      children.push(new Paragraph({ text: 'Action items', heading: HeadingLevel.HEADING_3 }));
      if (topic.actionItems.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'None.', italics: true })] }));
      } else {
        for (const item of topic.actionItems) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [
                new TextRun({ text: `${item.owner ?? 'UNASSIGNED'}: `, bold: true }),
                new TextRun(item.description),
                new TextRun({ text: ` (due ${item.dueDate ?? item.dueDateRaw ?? 'unspecified'})`, italics: true }),
              ],
            }),
          );
        }
      }
    }
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
