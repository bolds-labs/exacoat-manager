import { useState, type FormEvent, type ReactNode } from 'react';
import { Activity, MessageSquare, Plus, User } from 'lucide-react';
import type { OrderNote } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { Checkbox } from '../../ds/Checkbox';
import { formatDateTime } from '../../../lib/formatters';
import { EmptyText, Pill } from './cardParts';

export interface ActivityCardProps {
  notes: OrderNote[];
  isLoading: boolean;
  newNote: string;
  onNewNoteChange: (v: string) => void;
  isCustomerNote: boolean;
  onCustomerNoteChange: (v: boolean) => void;
  isAdding: boolean;
  onAddNote: (e: FormEvent) => void;
  renderContent: (content: string) => ReactNode;
}

type Filter = 'all' | 'customer';

export function filterNotes(notes: OrderNote[], filter: Filter): OrderNote[] {
  return filter === 'customer' ? notes.filter((n) => n.customer_note) : notes;
}

/** Who wrote the note: the staff member's name when known, otherwise "System". */
export function noteAuthor(note: OrderNote): string {
  const name = String(note.author_name || note.added_by || '').trim();
  return !name || name.toLowerCase() === 'system' ? 'System' : name;
}

/** Role badge beside the author, omitted when it would only repeat the name (System notes). */
export function noteRoleBadge(note: OrderNote): string | null {
  const role = String(note.author_role || '').trim();
  if (!role || role.toLowerCase() === 'system' || role.toLowerCase() === noteAuthor(note).toLowerCase()) return null;
  return role;
}

function roleTone(role: string) {
  if (role === 'Operations Manager' || role === 'Manager') return 'act' as const;
  if (role === 'Administrator' || role === 'Shop Manager') return 'wait' as const;
  return 'neutral' as const;
}

export function ActivityCard({
  notes,
  isLoading,
  newNote,
  onNewNoteChange,
  isCustomerNote,
  onCustomerNoteChange,
  isAdding,
  onAddNote,
  renderContent,
}: ActivityCardProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const shown = filterNotes(notes, filter);

  const segBtn = (key: Filter, label: string) => (
    <button
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      className={`grid place-items-center rounded-md px-2.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        filter === key ? 'bg-card text-fg shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-muted hover:text-fg'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card
      icon={Activity}
      title="Activity & notes"
      count={notes.length}
      actions={
        <>
          <div role="group" aria-label="Filter notes" className="inline-flex h-[30px] gap-0.5 rounded-[8px] bg-chip p-0.5">
            {segBtn('all', 'All')}
            {segBtn('customer', 'Customer notes')}
          </div>
          <Button size="sm" icon={Plus} onClick={() => setComposerOpen((v) => !v)} aria-expanded={composerOpen}>
            Add note
          </Button>
        </>
      }
    >
      {composerOpen && (
        <form
          onSubmit={(e) => {
            onAddNote(e);
          }}
          className="mb-4 flex flex-col gap-2.5 rounded-[10px] border border-line p-3"
        >
          <label htmlFor="order-note-composer" className="sr-only">
            Note
          </label>
          <textarea
            id="order-note-composer"
            data-ds=""
            value={newNote}
            onChange={(e) => onNewNoteChange(e.target.value)}
            placeholder="Add an internal staff note or a note to the customer..."
            rows={3}
            autoFocus
            className="w-full resize-y rounded-[9px] border border-field-border bg-field px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-faint focus:border-accent"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Checkbox label="Customer note" checked={isCustomerNote} onChange={(e) => onCustomerNoteChange(e.target.checked)} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setComposerOpen(false)}>
                Close
              </Button>
              <Button type="submit" variant="primary" disabled={isAdding || !newNote.trim()}>
                {isAdding ? 'Adding...' : 'Add note'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <EmptyText>Loading history...</EmptyText>
      ) : shown.length === 0 ? (
        <EmptyText>{filter === 'customer' ? 'No customer notes yet.' : 'No order notes yet.'}</EmptyText>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {shown.map((note) => (
            <li key={note.id} className="flex gap-2.5">
              <span
                className={`grid h-[26px] w-[26px] flex-none place-items-center overflow-hidden rounded-[7px] ${
                  note.customer_note ? 'bg-st-act-bg text-st-act-fg' : 'bg-chip text-muted'
                }`}
              >
                {note.author_avatar ? (
                  <img src={note.author_avatar} alt="" className="h-full w-full object-cover" />
                ) : note.customer_note ? (
                  <MessageSquare className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
                ) : (
                  <User className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-fg [&_a]:text-accent-fg [&_a]:underline">
                  {renderContent(note.content)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-faint">
                  <span className="text-muted">{noteAuthor(note)}</span>
                  {noteRoleBadge(note) && <Pill tone={roleTone(noteRoleBadge(note)!)}>{noteRoleBadge(note)}</Pill>}
                  <span aria-hidden>·</span>
                  <span>{note.date_created ? formatDateTime(note.date_created) : '-'}</span>
                  {note.customer_note && <Pill tone="act">Customer</Pill>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
