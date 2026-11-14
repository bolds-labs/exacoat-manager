import type { ReactNode } from 'react';
import { AlertTriangle, PlugZap } from 'lucide-react';
import { Button } from '../ds/Button';

/** Shown in a card when the store runs an older exacoat-core without the staff routes. */
export function PluginMissingNote({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-st-wait-border bg-st-wait-bg px-3.5 py-3 text-[13px] text-st-wait-fg" role="status">
      <PlugZap className="mt-px h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
      <span>
        <span className="font-medium">Install the latest plugin.</span> {what} needs exacoat-core 0.1.228 or newer on the store.
      </span>
    </div>
  );
}

export function CardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-st-stop-border bg-st-stop-bg px-3.5 py-2.5 text-[13px] text-st-stop-fg" role="alert">
      <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function CardLoading({ label, height = 120 }: { label: string; height?: number }) {
  return (
    <div className="grid place-items-center text-[13px] text-muted" style={{ height }}>
      {label}
    </div>
  );
}

export function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] border border-dashed border-line px-3.5 py-5 text-center text-[13px] text-muted">{children}</p>;
}
