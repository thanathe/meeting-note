import type { DistillationRun, Meeting } from './types';
import type { Distiller } from './distill';
import { parseTranscript } from './parse';
import { analyze } from './analyze';
import { groupByOwner } from './rollup';

export interface UploadedTranscript {
  filename: string;
  content: string;
}

let runCounter = 0;

/** Parse → Distill → Analyze, for one Distillation Run. See ADR-0001. */
export async function distillRun(
  uploads: UploadedTranscript[],
  distiller: Distiller,
): Promise<DistillationRun> {
  const runId = `run-${++runCounter}`;

  const meetings: Meeting[] = await Promise.all(
    uploads.map(async (upload, index) => {
      const parsed = parseTranscript(upload.filename, upload.content, `${runId}-m${index}`);
      const distilled = await distiller.distill(parsed);
      return { ...parsed, ...distilled };
    }),
  );

  return {
    id: runId,
    createdAt: new Date().toISOString(),
    meetings,
    ownerGroups: groupByOwner(meetings),
    flags: analyze(meetings),
  };
}
