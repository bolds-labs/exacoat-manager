import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronRight, Pin, PinOff, RotateCcw, StickyNote, Trash2 } from 'lucide-react';
import { Card } from '../ds/Card';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { TextField } from '../ds/TextField';
import { Modal } from '../ds/Modal';
import { toast } from '../ds/toast';
import { formatTimeAgo } from '../../lib/formatters';
import { canDeleteNote, notesReducer, splitNotes, type StaffNote } from '../../lib/staffDashboard';
import {
  createStaffNoteDirect,
  deleteStaffNoteDirect,
  fetchStaffNotesDirect,
  NOTE_MISSING,
  updateStaffNoteDirect,
} from '../../lib/staffDashboardApi';
import { CardEmpty, CardError, CardLoading, PluginMissingNote } from './StaffCardStates';

const MAX_CHARS = 2000;

interface Props {
  /** Changes when the page or header Refresh asks every card to reload. */
  reloadKey: number;
}

export function TeamNotesCard({ reloadKey }: Props) {
  const [notes, dispatch] = useReducer(notesReducer, []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [me, setMe] = useState({ id: 0, canModerate: false });
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async (quiet: boolean) => {
    const seq = ++loadSeq.current;
    if (!quiet) setStatus('loading');
    const res = await fetchStaffNotesDirect();
    if (seq !== loadSeq.current) return;
    if (res.ok) {
      dispatch({ type: 'loaded', notes: res.data.notes });
      setMe({ id: res.data.currentUserId, canModerate: res.data.canModerate });
      setStatus('ready');
    } else if (res.missing) {
      setStatus('missing');
    } else {
      setError(res.error);
      setStatus('error');
    }
  }, []);

  const firstLoad = useRef(true);
  useEffect(() => {
    void load(!firstLoad.current);
    firstLoad.current = false;
  }, [load, reloadKey]);

  const { open, done } = useMemo(() => splitNotes(notes), [notes]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    const res = await createStaffNoteDirect(text);
    setSaving(false);
    if (res.ok) {
      dispatch({ type: 'upsert', note: res.data });
      setDraft('');
    } else if (res.missing) {
      setStatus('missing');
    } else {
      // The draft stays in the field so nothing typed is lost (for example when notes are busy).
      toast.error('Could not add the note', res.error);
    }
  };

  const change = async (note: StaffNote, patch: { pinned?: boolean; done?: boolean }) => {
    setBusyId(note.id);
    dispatch({ type: 'patch', id: note.id, patch });
    const res = await updateStaffNoteDirect(note.id, patch);
    setBusyId(null);
    if (res.ok) {
      dispatch({ type: 'upsert', note: res.data });
    } else if (res.code === NOTE_MISSING) {
      dispatch({ type: 'removed', id: note.id });
      toast.error('Note removed', 'Someone else deleted this note.');
    } else {
      dispatch({ type: 'upsert', note });
      toast.error('Could not update the note', res.error);
    }
  };

  const remove = async () => {
    const note = confirmDelete;
    if (!note) return;
    setBusyId(note.id);
    setDeleting(true);
    const res = await deleteStaffNoteDirect(note.id);
    setDeleting(false);
    setBusyId(null);
    setConfirmDelete(null);
    if (res.ok || res.code === NOTE_MISSING) {
      dispatch({ type: 'removed', id: note.id });
    } else {
      toast.error('Could not delete the note', res.error);
    }
  };

  const row = (n: StaffNote) => (
    <li key={n.id} className="group flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <span className={`mt-[3px] grid h-6 w-6 flex-none place-items-center rounded-[7px] ${n.pinned && !n.done ? 'bg-accent-soft text-accent-fg' : 'bg-chip text-faint'}`}>
        {n.pinned && !n.done ? <Pin className="h-3.5 w-3.5" strokeWidth={1.8} aria-label="Pinned" /> : <StickyNote className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`whitespace-pre-wrap break-words text-[13.5px] ${n.done ? 'text-muted line-through' : 'text-fg'}`}>{n.text}</p>
        <p className="mt-0.5 text-[12px] text-faint">
          {n.author_name || 'Staff'}, {formatTimeAgo(n.created_at)}
        </p>
      </div>
      <div className="flex flex-none items-center gap-0.5">
        {!n.done && (
          <IconButton
            icon={n.pinned ? PinOff : Pin}
            label={n.pinned ? 'Unpin' : 'Pin to top'}
            variant="ghost"
            size="sm"
            disabled={busyId === n.id}
            onClick={() => void change(n, { pinned: !n.pinned })}
          />
        )}
        <IconButton
          icon={n.done ? RotateCcw : Check}
          label={n.done ? 'Mark not done' : 'Mark done'}
          variant="ghost"
          size="sm"
          disabled={busyId === n.id}
          onClick={() => void change(n, { done: !n.done })}
        />
        {canDeleteNote(n, me.id, me.canModerate) && (
          <IconButton icon={Trash2} label="Delete note" variant="ghost" size="sm" disabled={busyId === n.id} onClick={() => setConfirmDelete(n)} />
        )}
      </div>
    </li>
  );

  return (
    <Card icon={StickyNote} title="Team notes" count={status === 'ready' ? open.length : undefined}>
      {status === 'missing' && <PluginMissingNote what="Team notes" />}
      {status === 'loading' && <CardLoading label="Loading notes..." />}
      {status === 'error' && <CardError message={`Could not load team notes: ${error}`} onRetry={() => void load(false)} />}
      {status === 'ready' && (
        <div className="flex flex-col gap-3">
          <form onSubmit={add} className="flex items-center gap-2">
            <TextField
              aria-label="New team note"
              placeholder="Write a note for the team..."
              value={draft}
              maxLength={MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="primary" disabled={!draft.trim() || saving}>
              {saving ? 'Adding...' : 'Add'}
            </Button>
          </form>
          {open.length === 0 ? (
            <CardEmpty>No open notes. Anything the team should know today goes here.</CardEmpty>
          ) : (
            <ul className="flex flex-col divide-y divide-line">{open.map(row)}</ul>
          )}
          {done.length > 0 && (
            <div className="border-t border-line pt-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex items-center gap-1.5 rounded-[7px] px-1 py-1 text-[12.5px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {showDone ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />}
                Done notes ({done.length})
              </button>
              {showDone && <ul className="mt-2 flex flex-col divide-y divide-line">{done.map(row)}</ul>}
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o && !deleting) setConfirmDelete(null);
        }}
        title="Delete this note?"
        description="It is removed for the whole team. This cannot be undone."
        width={440}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => void remove()} disabled={deleting || busyId !== null}>
              {deleting ? 'Deleting...' : 'Delete note'}
            </Button>
          </>
        }
      >
        <p className="whitespace-pre-wrap break-words rounded-[10px] border border-line bg-chip px-3.5 py-2.5 text-[13px] text-fg">{confirmDelete?.text}</p>
      </Modal>
    </Card>
  );
}
