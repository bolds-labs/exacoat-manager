import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { resolveFinishStatus, type GlobalFinish } from '../../lib/wordpressBridge';
import { formatIDR } from '../../lib/formatters';
import type { FinishStatus } from '../../lib/finishesEditor';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { Select } from '../ds/Select';
import { Switch } from '../ds/Switch';
import { familyChipClass } from '../ds/StatusChip';
import { STOCK_OPTIONS } from './FinishEditPanel';

export interface FinishRowProps {
  finish: GlobalFinish;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  reorderDisabled: boolean;
  /** Writes are off (the list is a fallback copy). */
  readOnly?: boolean;
  onStock(status: FinishStatus): void;
  onActive(active: boolean): void;
  onMove(direction: 'up' | 'down'): void;
  onEdit(): void;
}

const chip = 'rounded-[7px] px-2 py-[2px] text-[12px] font-medium';

export function FinishRow({ finish, position, isFirst, isLast, busy, reorderDisabled, readOnly = false, onStock, onActive, onMove, onEdit }: FinishRowProps) {
  const status = resolveFinishStatus(finish);
  const active = finish.is_active !== false;
  const extra = Number(finish.extra_price) || 0;
  const accent = Number(finish.accent_extra_price) || 0;
  const usesSwatch = !finish.texture_url || finish.texture_url === finish.thumbnail;
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => setThumbFailed(false), [finish.thumbnail]);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3">
      <div className={`flex min-w-[220px] flex-1 items-center gap-3 ${active ? '' : 'opacity-60'}`}>
        <span className="w-6 flex-none text-right font-mono text-[12px] text-faint" aria-label={`Position ${position}`}>
          {position}
        </span>
        <span
          className="h-10 w-10 flex-none overflow-hidden rounded-[9px] border border-card-border bg-chip"
          style={finish.color_hex && !finish.thumbnail ? { backgroundColor: finish.color_hex } : undefined}
        >
          {finish.thumbnail && !thumbFailed && (
            <img
              src={finish.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              ref={(el) => {
                // An image that already failed before React attached onError never fires it again.
                if (el && el.complete && el.naturalWidth === 0) setThumbFailed(true);
              }}
              onError={() => setThumbFailed(true)}
            />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-fg">{finish.name}</span>
            {finish.badge_text?.trim() && (
              <span
                className="rounded-full px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-black"
                style={{ backgroundColor: finish.badge_color || '#f3aa18' }}
              >
                {finish.badge_text.trim()}
              </span>
            )}
            {!active && <span className={`${chip} ${familyChipClass.neutral}`}>Inactive</span>}
            {status === 'out_of_stock' && <span className={`${chip} ${familyChipClass.stop}`}>Out of stock</span>}
            {status === 'coming_soon' && <span className={`${chip} ${familyChipClass.wait}`}>Coming soon</span>}
            {finish.is_custom_per_device && <span className={`${chip} ${familyChipClass.prog}`}>Per device</span>}
          </div>
          <div className="truncate font-mono text-[12px] text-faint">
            {finish.slug}
            {usesSwatch && <span className="font-sans"> · swatch used as texture</span>}
          </div>
        </div>
      </div>

      <div className="w-[150px] flex-none text-[13px]">
        <div className="font-mono text-fg">{extra > 0 ? `+${formatIDR(extra)}` : 'No extra'}</div>
        <div className="text-[12px] text-faint">{accent > 0 ? `Accent +${formatIDR(accent)}` : extra > 0 ? 'Accent by tiers' : ' '}</div>
      </div>

      <Select
        aria-label={`Stock for ${finish.name}`}
        className="w-[150px] flex-none"
        value={status}
        options={STOCK_OPTIONS}
        disabled={busy || readOnly}
        onChange={(v) => {
          if (v !== status) onStock(v as FinishStatus);
        }}
      />

      <Switch
        label="Active"
        aria-label={`Show ${finish.name} on the storefront`}
        checked={active}
        disabled={busy || readOnly}
        onCheckedChange={onActive}
        className="w-[86px] flex-none disabled:opacity-50"
      />

      <div className="flex flex-none items-center gap-1">
        <IconButton size="sm" variant="ghost" icon={ChevronUp} label={`Move ${finish.name} up`} disabled={readOnly || reorderDisabled || isFirst} onClick={() => onMove('up')} />
        <IconButton size="sm" variant="ghost" icon={ChevronDown} label={`Move ${finish.name} down`} disabled={readOnly || reorderDisabled || isLast} onClick={() => onMove('down')} />
        <Button size="sm" icon={Pencil} onClick={onEdit} disabled={readOnly} className="ml-1">
          Edit
        </Button>
      </div>
    </li>
  );
}
