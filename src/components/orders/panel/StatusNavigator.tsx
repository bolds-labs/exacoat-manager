import { ArrowLeft, ArrowRight, ChevronDown, type LucideIcon } from 'lucide-react';
import type { Order } from '../../../types';
import { getCurrentStepIndex, getOrderStatusMeta, getStatusSteps, type StatusStep } from '../../../lib/orderStatus';
import { Button, Menu } from '../../ds';
import { familyChipClass } from '../../ds/StatusChip';

export interface StatusNavigatorProps {
  order: Partial<Order>;
  onChangeStatus: (status: string) => void;
  disabled?: boolean;
  /** A status update is running (sets aria-busy). */
  busy?: boolean;
}

function StepTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-chip text-faint">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
    </span>
  );
}

function SideStep({
  direction,
  step,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  step: StatusStep | undefined;
  disabled: boolean;
  onClick: () => void;
}) {
  const isNext = direction === 'next';
  const caption = isNext ? 'Next step' : 'Previous';
  const Arrow = isNext ? ArrowRight : ArrowLeft;
  const text = (
    <span className={`hidden min-w-0 flex-col leading-[1.3] md:flex ${isNext ? 'items-end text-right' : ''}`}>
      <span className="text-[12px] text-faint">{caption}</span>
      <span className={`truncate text-[13px] ${isNext ? 'text-fg' : 'text-muted'}`}>{step ? step.label : 'None'}</span>
    </span>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={step ? `${caption}: ${step.label}` : caption}
      className={`flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[10px] border border-field-border bg-field px-3 transition-colors hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-45 md:w-[210px] md:flex-none md:px-3.5 ${
        isNext ? 'md:justify-end' : 'md:justify-start'
      }`}
    >
      {!isNext && <Arrow className="h-[15px] w-[15px] flex-none text-faint" strokeWidth={1.8} aria-hidden />}
      {!isNext && step && <StepTile icon={step.icon} />}
      {text}
      {isNext && step && <StepTile icon={step.icon} />}
      {isNext && <Arrow className="h-[15px] w-[15px] flex-none text-faint" strokeWidth={1.8} aria-hidden />}
    </button>
  );
}

/**
 * Previous / current / next status blocks plus an "All steps" menu. Every move goes through
 * onChangeStatus so the caller keeps today's confirmations and side effects.
 */
export function StatusNavigator({ order, onChangeStatus, disabled = false, busy = false }: StatusNavigatorProps) {
  const steps = getStatusSteps(order);
  const index = getCurrentStepIndex(order, steps);
  const inFlow = index >= 0;
  const meta = getOrderStatusMeta({ status: '', ...order });
  const prev = inFlow && index > 0 ? steps[index - 1] : undefined;
  const next = inFlow && index < steps.length - 1 ? steps[index + 1] : undefined;
  // Real status label (e.g. Delivered); the step it maps onto goes in the caption when it differs.
  const currentLabel = meta.label;
  const stepLabel = inFlow ? steps[index].label : '';
  const caption = inFlow
    ? `Step ${index + 1} of ${steps.length}${stepLabel && stepLabel !== currentLabel ? ` (${stepLabel})` : ''}`
    : 'Outside the order flow';
  const CurrentIcon = meta.icon;

  return (
    <div aria-busy={busy || undefined} className="flex flex-wrap items-stretch gap-2 md:flex-nowrap md:gap-3">
      <SideStep direction="prev" step={prev} disabled={disabled || !prev} onClick={() => prev && onChangeStatus(prev.status)} />

      <div
        data-testid="status-current"
        className={`order-first flex h-[52px] w-full min-w-0 items-center gap-3 rounded-[10px] border px-4 md:order-none md:w-auto md:flex-1 ${
          inFlow ? 'border-accent-border bg-accent-soft' : 'border-card-border bg-card'
        }`}
      >
        <span className={`grid h-8 w-8 flex-none place-items-center rounded-[9px] ${familyChipClass[meta.family]}`}>
          <CurrentIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col leading-[1.3]">
          <span className="truncate text-[14.5px] font-medium text-fg">{currentLabel}</span>
          <span className="text-[12px] text-faint">
            {caption}
          </span>
        </span>
        <span
          data-testid="status-track"
          aria-hidden
          className="ml-auto hidden w-[180px] flex-none gap-1 sm:grid"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, i) => {
            const state = !inFlow || i > index ? 'todo' : i === index ? 'current' : 'done';
            const tone = state === 'done' ? 'bg-st-done-fg' : state === 'current' ? 'bg-accent' : 'bg-chip';
            return <i key={step.status} data-state={state} className={`block h-1 rounded ${tone}`} />;
          })}
        </span>
      </div>

      <SideStep direction="next" step={next} disabled={disabled || !next} onClick={() => next && onChangeStatus(next.status)} />

      <Menu
        trigger={
          <Button
            trailingIcon={ChevronDown}
            disabled={disabled}
            aria-label="All steps"
            className="h-[52px] flex-1 rounded-[10px] md:flex-none"
          >
            All steps
          </Button>
        }
        items={steps.map((step, i) => ({
          icon: step.icon,
          title: step.label,
          description: i === index ? 'Current step' : undefined,
          selected: i === index,
          // The current step stays selectable, as in the old stage grid: aliased statuses (delivered,
          // smb-picked, pending, in-production, awaiting-pickup) can then be set to the canonical one,
          // and re-sending processing retries the tracking pool assignment.
          onSelect: () => onChangeStatus(step.status),
        }))}
      />
    </div>
  );
}
