// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../ds/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../lib/wordpressBridge', () => ({ updateReviewStatusDirect: vi.fn() }));
vi.mock('../../lib/staffDashboardApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/staffDashboardApi')>('../../lib/staffDashboardApi');
  return {
    NOTE_MISSING: actual.NOTE_MISSING,
    NOTES_BUSY: actual.NOTES_BUSY,
    fetchStaffNotesDirect: vi.fn(),
    createStaffNoteDirect: vi.fn(),
    updateStaffNoteDirect: vi.fn(),
    deleteStaffNoteDirect: vi.fn(),
  };
});

import * as api from '../../lib/staffDashboardApi';
import { toast } from '../ds/toast';
import { TeamNotesCard } from './TeamNotesCard';
import { PendingReviewsCard } from './PendingReviewsCard';
import type { OrderReview } from '../../types';

const note = {
  id: 'n1',
  text: 'Restock matte black',
  author_id: 7,
  author_name: 'Rina',
  created_at: '2026-11-10T08:00:00Z',
  updated_at: '2026-11-10T08:00:00Z',
  pinned: false,
  done: false,
};

beforeEach(() => {
  vi.mocked(api.fetchStaffNotesDirect).mockResolvedValue({ ok: true, data: { notes: [note], currentUserId: 7, canModerate: false } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TeamNotesCard', () => {
  it('removes a note that someone else deleted when an update comes back missing', async () => {
    vi.mocked(api.updateStaffNoteDirect).mockResolvedValue({ ok: false, missing: false, error: 'This note no longer exists.', code: api.NOTE_MISSING });
    render(<TeamNotesCard reloadKey={0} />);
    await screen.findByText('Restock matte black');
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(screen.queryByText('Restock matte black')).toBeNull());
    expect(toast.error).toHaveBeenCalledWith('Note removed', expect.any(String));
  });

  it('keeps the typed text and shows the error when notes are busy', async () => {
    vi.mocked(api.createStaffNoteDirect).mockResolvedValue({ ok: false, missing: false, error: 'Notes are busy, try again.', code: api.NOTES_BUSY });
    render(<TeamNotesCard reloadKey={0} />);
    const field = await screen.findByLabelText('New team note');
    fireEvent.change(field, { target: { value: 'Call the courier' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not add the note', 'Notes are busy, try again.'));
    expect((field as HTMLInputElement).value).toBe('Call the courier');
  });

  it('locks Cancel and Escape while a delete is running', async () => {
    let finish: (v: Awaited<ReturnType<typeof api.deleteStaffNoteDirect>>) => void = () => {};
    vi.mocked(api.deleteStaffNoteDirect).mockReturnValue(new Promise((r) => (finish = r)));
    render(<TeamNotesCard reloadKey={0} />);
    await screen.findByText('Restock matte black');
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete note' }).find((b) => dialog.contains(b))!);
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveProperty('disabled', true));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
    await act(async () => finish({ ok: true, data: { id: 'n1' } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Restock matte black')).toBeNull();
  });
});

describe('PendingReviewsCard', () => {
  it('shows a video tile, not a broken image, for videos without a poster', () => {
    const review = {
      id: 5,
      order_id: 1,
      customer_name: 'Ana',
      customer_email: '',
      rating: 5,
      content: 'Great',
      media: [{ type: 'video', url: 'https://cms.test/v.mp4' }],
      status: 'pending',
      verified_purchase: true,
      created_at: '2026-11-10 10:00:00',
    } as OrderReview;
    const { container } = render(
      <PendingReviewsCard state={{ status: 'ready', data: { reviews: [review], pending: 1 } }} onRetry={() => {}} onChanged={() => {}} onViewAll={() => {}} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open review video' })).toBeTruthy();
  });
});
