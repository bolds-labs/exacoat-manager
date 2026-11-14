import * as Tooltip from '@radix-ui/react-tooltip';
import { AlertTriangle, CircleCheck, CircleDashed, CircleOff, MinusCircle, type LucideIcon } from 'lucide-react';
import type { ConfiguratorProfileSummary } from '../../types';
import { configuratorStatus, type ConfiguratorState } from '../../lib/productList';
import { familyChipClass } from '../ds/StatusChip';

const ICONS: Record<ConfiguratorState, LucideIcon> = {
  clean: CircleCheck,
  issues: AlertTriangle,
  unaudited: CircleDashed,
  excluded: MinusCircle,
  none: CircleOff,
};

export interface ConfiguratorChipProps {
  summary?: ConfiguratorProfileSummary | null;
  /** Summaries did not load: show that the status is unknown rather than "No configurator". */
  unknown?: boolean;
  loading?: boolean;
  /** Studio: clicking the issues chip opens the asset check for that device. */
  onIssuesClick?: () => void;
}

const chipBase = 'inline-flex items-center gap-1 rounded-[7px] px-2 py-[2px] text-[12px] font-medium whitespace-nowrap';

/** Configurator column: Clean, N issues (with the issue list on hover), Unaudited, Excluded or No configurator. */
export function ConfiguratorChip({ summary, unknown = false, loading = false, onIssuesClick }: ConfiguratorChipProps) {
  if (loading) return <span className="text-[12.5px] text-faint">Loading...</span>;
  if (unknown) return <span className="text-[12.5px] text-faint">Not loaded</span>;
  const status = configuratorStatus(summary);
  const Icon = ICONS[status.state];
  const chip = `${chipBase} ${familyChipClass[status.family]}`;
  const content = (
    <>
      <Icon className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
      {status.label}
    </>
  );

  if (status.state !== 'issues') {
    const title =
      status.state === 'clean' && summary?.last_audited_at
        ? `Checked ${new Date(summary.last_audited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : undefined;
    return (
      <span className={chip} title={title}>
        {content}
      </span>
    );
  }

  const details = summary?.audit_details || [];
  const trigger = onIssuesClick ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onIssuesClick();
      }}
      className={`${chip} cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      aria-label={`${status.label}: open the asset check`}
    >
      {content}
    </button>
  ) : (
    <span className={chip} tabIndex={0}>
      {content}
    </span>
  );

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-[300] w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-card-border bg-pop p-3 text-[12.5px] text-fg shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          >
            <p className="mb-1.5 font-medium">{status.label}</p>
            {details.length > 0 ? (
              <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-4 text-muted [overflow-wrap:anywhere]">
                {details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No details were saved with the last check.</p>
            )}
            {onIssuesClick && <p className="mt-2 text-faint">Click to open the asset check.</p>}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
