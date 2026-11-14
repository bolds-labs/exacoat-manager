import { Lock, Trash2, XCircle } from 'lucide-react';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { Pill } from './cardParts';

export interface AdminActionsCardProps {
  /** Only administrators see this card; the card renders nothing otherwise. */
  isAdmin: boolean;
  isCancelled: boolean;
  isCancelling: boolean;
  isTrashing: boolean;
  onCancel: () => void;
  onTrash: () => void;
}

export function AdminActionsCard({ isAdmin, isCancelled, isCancelling, isTrashing, onCancel, onTrash }: AdminActionsCardProps) {
  if (!isAdmin) return null;
  const busy = isCancelling || isTrashing;
  return (
    <Card icon={Lock} title="Administrator actions" actions={<Pill tone="act">Admin only</Pill>}>
      <p className="m-0 text-[13px] text-muted">Cancel this order or move it to trash. Moving to trash removes it from active fulfillment.</p>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Button variant="danger" icon={XCircle} disabled={busy || isCancelled} onClick={onCancel}>
          {isCancelled ? 'Order cancelled' : isCancelling ? 'Cancelling...' : 'Cancel order'}
        </Button>
        <Button variant="danger" icon={Trash2} disabled={busy} onClick={onTrash}>
          {isTrashing ? 'Trashing...' : 'Move to trash'}
        </Button>
      </div>
    </Card>
  );
}
