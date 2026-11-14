import { Minus, Plus } from 'lucide-react';
import { TextField } from '../../ds/TextField';
import { Button } from '../../ds/Button';
import { IconButton } from '../../ds/IconButton';
import { formatCurrency } from '../../../lib/formatters';

export interface PriceBoxProps {
  currency: string;
  /** Webstore breakdown; absent when the webstore data is not loaded. */
  breakdown: { total: number; lines: { label: string; amount: number }[] } | null;
  unitPrice: number;
  onUnitPriceChange(v: number): void;
  quantity: number;
  onQuantityChange(v: number): void;
  /** Warranty, redeem and marketplace items keep their own price. */
  keepsOwnPrice: boolean;
  /** True while the unit price follows the webstore total. */
  follows: boolean;
  onUseWebstorePrice(): void;
}

export function PriceBox({
  currency,
  breakdown,
  unitPrice,
  onUnitPriceChange,
  quantity,
  onQuantityChange,
  keepsOwnPrice,
  follows,
  onUseWebstorePrice,
}: PriceBoxProps) {
  const differs = breakdown !== null && Math.round(breakdown.total) !== Math.round(unitPrice);
  return (
    <div className="rounded-xl border border-card-border bg-card p-3.5" aria-label="Price">
      {breakdown && (
        <dl className="mb-3 flex flex-col gap-1 text-[12.5px]" data-testid="price-breakdown">
          {breakdown.lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-3">
              <dt className="min-w-0 truncate text-muted">{l.label}</dt>
              <dd className="font-mono text-fg">{formatCurrency(l.amount, currency)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t border-line pt-1.5 text-[13px] font-semibold">
            <dt className="text-fg">Webstore price</dt>
            <dd className="font-mono text-fg" data-testid="webstore-total">{formatCurrency(breakdown.total, currency)}</dd>
          </div>
        </dl>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
        <div>
          <span className="mb-1.5 block text-[12px] text-faint">Quantity</span>
          <div className="flex items-center gap-1">
            <IconButton icon={Minus} label="Decrease quantity" size="sm" onClick={() => onQuantityChange(Math.max(1, quantity - 1))} />
            <span className="w-8 text-center font-mono text-[13.5px] text-fg" aria-live="polite">{quantity}</span>
            <IconButton icon={Plus} label="Increase quantity" size="sm" onClick={() => onQuantityChange(quantity + 1)} />
          </div>
        </div>
        <TextField
          label="Unit price"
          type="number"
          inputMode="numeric"
          min={0}
          mono
          value={Number.isFinite(unitPrice) ? String(unitPrice) : '0'}
          onChange={(e) => onUnitPriceChange(Math.max(0, parseFloat(e.target.value || '0') || 0))}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <span className="text-muted">
          Line total <b className="ml-1 font-mono font-semibold text-fg">{formatCurrency(Math.round(unitPrice * quantity), currency)}</b>
        </span>
        {breakdown && differs && (
          <Button size="sm" variant={keepsOwnPrice ? 'secondary' : 'ghost'} onClick={onUseWebstorePrice}>
            {keepsOwnPrice ? 'Use webstore price' : 'Reset to webstore price'}
          </Button>
        )}
      </div>
      {breakdown && keepsOwnPrice && !follows && (
        <p className="mt-1.5 text-[12px] text-faint">Warranty, redeem and marketplace items keep their price unless you use the webstore price.</p>
      )}
    </div>
  );
}
