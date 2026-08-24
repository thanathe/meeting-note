import express from 'express';
import cors from 'cors';
import multer from 'multer';
import type { DistillationRun } from './types';
import { createDistiller } from './distill.claude';
import { distillRun } from './pipeline';
import { buildRunDocument } from './docx';

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) =>
    cb(null, file.mimetype.startsWith('text/') || file.originalname.toLowerCase().endsWith('.txt')),
});

/** In-memory only — this is a PoC, there is no database. */
const runs = new Map<string, DistillationRun>();
const distiller = createDistiller();

app.get('/api/health', (_req, res) => res.json({ ok: true, distiller: distiller.name }));

app.post('/api/runs', upload.array('transcripts'), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ error: 'Upload at least one .txt transcript.' });

  try {
    const run = await distillRun(
      files.map((f) => ({ filename: f.originalname, content: f.buffer.toString('utf8') })),
      distiller,
    );
    runs.set(run.id, run);
    res.json(run);
  } catch (error) {
    console.error('[runs] failed:', error);
    res.status(500).json({ error: 'Could not distil these transcripts.' });
  }
});

app.get('/api/runs/:id', (req, res) => {
  const run = runs.get(req.params.id);
  return run ? res.json(run) : res.status(404).json({ error: 'Run not found.' });
});

app.get('/api/runs/:id/document.docx', async (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found.' });

  const buffer = await buildRunDocument(run);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="meeting-summary-${run.id}.docx"`);
  res.send(buffer);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`backend on http://localhost:${port} (distiller: ${distiller.name})`));
