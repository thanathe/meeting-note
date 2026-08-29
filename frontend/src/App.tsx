import { useCallback, useRef, useState } from 'react';
import type { DistillationRun, Flag, Meeting, OwnerGroup, Topic } from './types';

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [run, setRun] = useState<DistillationRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const txts = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith('.txt'));
    setFiles((prev) => [...prev, ...txts]);
    setStatus('idle');
    setError(null);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearFiles = () => {
    setFiles([]);
    setRun(null);
    setStatus('idle');
    setError(null);
  };

  const submit = useCallback(async () => {
    if (files.length === 0) return;
    setStatus('uploading');
    setError(null);

    const formData = new FormData();
    for (const f of files) formData.append('transcripts', f);

    try {
      setStatus('processing');
      const res = await fetch('/api/runs', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const data: DistillationRun = await res.json();
      setRun(data);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }, [files]);

  const downloadDocx = useCallback(async () => {
    if (!run) return;
    // Runs live in the backend's memory, so a restart turns this into a 404.
    // Throwing here would be an unhandled rejection and the click would look ignored.
    try {
      const res = await fetch(`/api/runs/${run.id}/document.docx`);
      if (!res.ok) throw new Error('Could not download the document — try distilling again.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-summary-${run.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the document.');
    }
  }, [run]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meeting Notes Distiller</h1>
        <p>Upload transcript files, distill the key points, and export to Word.</p>
      </header>

      <section className="upload-section">
        <div
          className="dropzone"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            hidden
          />
          <div className="dropzone-text">
            <span className="dropzone-icon">+</span>
            <p>Drop <code>.txt</code> files here, or click to browse</p>
            <p className="hint">Multiple files supported. Multiple uploads allowed.</p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            <div className="file-list-header">
              <h3>{files.length} file(s) ready</h3>
              <button className="btn btn-ghost" onClick={clearFiles}>Clear</button>
            </div>
            <ul>
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span className="file-name">{f.name}</span>
                  <span className="file-size">{(f.size / 1024).toFixed(1)} KB</span>
                  <button className="btn btn-small" onClick={() => removeFile(i)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="actions">
          <button className="btn btn-primary" onClick={submit} disabled={files.length === 0 || status === 'uploading' || status === 'processing'}>
            {status === 'uploading' ? 'Uploading…' : status === 'processing' ? 'Distilling…' : 'Distill'}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
      </section>

      {run && status === 'done' && (
        <ResultsView run={run} onDownload={downloadDocx} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function ResultsView({ run, onDownload }: { run: DistillationRun; onDownload: () => void }) {
  const [tab, setTab] = useState<'meetings' | 'owners' | 'flags'>('meetings');

  return (
    <section className="results">
      <div className="results-header">
        <h2>Distillation Run</h2>
        <div className="results-meta">
          <span>{run.meetings.length} meeting(s)</span>
          <span>{run.flags.length} flag(s)</span>
          <button className="btn btn-primary" onClick={onDownload}>Download .docx</button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'meetings' ? 'tab active' : 'tab'} onClick={() => setTab('meetings')}>
          Meeting Summaries
        </button>
        <button className={tab === 'owners' ? 'tab active' : 'tab'} onClick={() => setTab('owners')}>
          Action Items by Owner
        </button>
        <button className={tab === 'flags' ? 'tab active' : 'tab'} onClick={() => setTab('flags')}>
          Flags & Issues ({run.flags.length})
        </button>
      </div>

      <div className="tab-content">
        {tab === 'meetings' && run.meetings.map((m) => <MeetingCard key={m.meetingId} meeting={m} />)}
        {tab === 'owners' && <OwnerGroups ownerGroups={run.ownerGroups} />}
        {tab === 'flags' && <FlagsView flags={run.flags} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Meeting summary
// ---------------------------------------------------------------------------

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <article className="card meeting-card">
      <div className="meeting-header">
        <h3>{meeting.title}</h3>
        <span className="badge">{meeting.format}</span>
      </div>
      <div className="meeting-meta">
        <span><strong>Date:</strong> {meeting.meetingDate ?? 'not stated'}</span>
        <span><strong>Participants:</strong> {meeting.participants.join(', ') || 'none listed'}</span>
        {meeting.milestones.length > 0 && (
          <span><strong>Milestones:</strong> {meeting.milestones.map((m) => `${m.label} (${m.date})`).join(', ')}</span>
        )}
      </div>

      {meeting.topics.map((topic, i) => (
        <TopicSection key={i} topic={topic} />
      ))}
    </article>
  );
}

function TopicSection({ topic }: { topic: Topic }) {
  return (
    <div className="topic-section">
      <h4>{topic.title}</h4>
      {topic.summary && <p className="topic-summary">{topic.summary}</p>}

      <div className="topic-subsection">
        <h5>Decisions</h5>
        {topic.decisions.length === 0 ? (
          <p className="muted">No decision reached.</p>
        ) : (
          <ul>
            {topic.decisions.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        )}
      </div>

      <div className="topic-subsection">
        <h5>Action Items</h5>
        {topic.actionItems.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="action-list">
            {topic.actionItems.map((item) => (
              <li key={item.id}>
                <span className="action-owner">{item.owner ?? 'UNASSIGNED'}</span>
                <span className="action-desc">{item.description}</span>
                <span className="action-due">
                  {item.dueDate ? `due ${item.dueDate}` : item.dueDateRaw ? `due ${item.dueDateRaw}` : 'no deadline'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner groups
// ---------------------------------------------------------------------------

function OwnerGroups({ ownerGroups }: { ownerGroups: OwnerGroup[] }) {
  return (
    <div className="owner-groups">
      {ownerGroups.map((group, i) => (
        <article key={i} className="card owner-card">
          <h3>{group.owner ?? 'Unowned'}</h3>
          <ul className="action-list">
            {group.actionItems.map((item) => (
              <li key={item.id}>
                <span className="action-desc">{item.description}</span>
                <span className="action-meeting">{item.topicTitle}</span>
                <span className="action-due">
                  {item.dueDate ? `due ${item.dueDate}` : item.dueDateRaw ? `due ${item.dueDateRaw}` : 'no deadline'}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const FLAG_LABELS: Record<string, string> = {
  NO_DECISION: 'No Decision',
  UNOWNED_ACTION_ITEM: 'Unowned Action Item',
  AMBIGUOUS_OWNER: 'Ambiguous Owner',
  UNCLEAR_DUE_DATE: 'Unclear Due Date',
  CONFLICTING_DUE_DATE: 'Conflicting Due Date',
};

function FlagsView({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return <p className="muted">No issues detected.</p>;

  return (
    <div className="flags-list">
      {flags.map((flag, i) => (
        <div key={i} className={`flag flag-${flag.code.toLowerCase()}`}>
          <span className="flag-label">{FLAG_LABELS[flag.code] ?? flag.code}</span>
          <p>{flag.message}</p>
        </div>
      ))}
    </div>
  );
}
