import Anthropic from '@anthropic-ai/sdk';
import type { DistilledMeeting, ParsedTranscript } from './types';
import { type Distiller, HeuristicDistiller } from './distill';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

const SYSTEM = `You distil meeting transcripts into structured JSON.

Rules:
- Ground everything in the transcript. Never invent an owner, a date, or a decision.
- If an action item has no clearly stated owner, set "owner" to null. Do not guess.
- Put the owner's name EXACTLY as the transcript writes it. Do not translate or normalise it.
- "dueDateRaw" is the literal phrase used ("next Friday", "ภายในสองวัน"). "dueDate" is an ISO
  date ONLY when the transcript states an absolute one; otherwise null.
- A meeting with no decisions is normal. Return an empty array rather than inventing one.
- Reply with JSON only. No prose, no code fences.

Shape:
{"topics":[{"title":string,"summary":string,"decisions":string[],
  "actionItems":[{"description":string,"owner":string|null,"dueDate":string|null,"dueDateRaw":string|null}]}],
 "milestones":[{"label":string,"date":string}]}`;

/**
 * LLM-backed Distiller. Isolated behind the Distiller interface so no other layer —
 * and no unit test — depends on the network. See ADR-0001.
 */
export class ClaudeDistiller implements Distiller {
  readonly name = 'claude';
  private client: Anthropic;
  private fallback = new HeuristicDistiller();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async distill(parsed: ParsedTranscript): Promise<DistilledMeeting> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Transcript of "${parsed.title}":\n\n${parsed.raw}` }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return hydrate(JSON.parse(stripFences(text)), parsed);
    } catch (error) {
      // Never fail the Run because the LLM was unavailable or returned junk.
      console.warn(`[distill] Claude failed for ${parsed.sourceFilename}, falling back:`, error);
      return this.fallback.distill(parsed);
    }
  }
}

function stripFences(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

/** Re-attach the ids the rest of the pipeline relies on, and reject anything malformed. */
function hydrate(raw: any, parsed: ParsedTranscript): DistilledMeeting {
  const topics = (Array.isArray(raw?.topics) ? raw.topics : []).map((topic: any, ti: number) => ({
    title: String(topic?.title ?? 'Untitled topic'),
    summary: String(topic?.summary ?? ''),
    decisions: (Array.isArray(topic?.decisions) ? topic.decisions : []).map(String),
    actionItems: (Array.isArray(topic?.actionItems) ? topic.actionItems : []).map((item: any, ai: number) => ({
      id: `${parsed.meetingId}-t${ti}-a${ai}`,
      description: String(item?.description ?? ''),
      owner: item?.owner ? String(item.owner) : null,
      dueDate: item?.dueDate ? String(item.dueDate) : null,
      dueDateRaw: item?.dueDateRaw ? String(item.dueDateRaw) : null,
      meetingId: parsed.meetingId,
      topicTitle: String(topic?.title ?? 'Untitled topic'),
    })),
  }));

  const milestones = (Array.isArray(raw?.milestones) ? raw.milestones : [])
    .filter((m: any) => m?.date)
    .map((m: any) => ({ label: String(m.label ?? ''), date: String(m.date) }));

  return { topics, milestones };
}

export function createDistiller(): Distiller {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new ClaudeDistiller(key) : new HeuristicDistiller();
}
