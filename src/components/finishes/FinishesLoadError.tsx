import { RefreshCw } from 'lucide-react';
import { Button } from '../ds/Button';

/** Shown wherever finishes failed to load: there is no built-in list to fall back on. */
export function FinishesLoadError({ message, onRetry, className = '' }: { message?: string | null; onRetry(): void; className?: string }) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-3 rounded-[12px] border border-st-stop-border bg-st-stop-bg px-4 py-3 ${className}`}>
      <p className="min-w-0 flex-1 text-[13px] text-st-stop-fg">
        Finishes did not load from WordPress, so no finish can be picked yet.{message ? ` ${message}` : ''}
      </p>
      <Button size="sm" icon={RefreshCw} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
