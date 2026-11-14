import { Package } from 'lucide-react';
import type { Product } from '../../lib/wordpressBridge';
import { formatIdr, productPriceView, wpStatusMeta } from '../../lib/productList';
import { familyChipClass } from '../ds/StatusChip';

export function Thumb({ src, alt }: { src?: string; alt: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" className="h-10 w-10 flex-none rounded-lg border border-line bg-chip object-cover" />
  ) : (
    <span className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-line bg-chip" aria-hidden>
      <Package className="h-4 w-4 text-faint" strokeWidth={1.6} />
    </span>
  );
}

export function PriceCell({ product }: { product: Product }) {
  const view = productPriceView(product);
  if (view.current === null) return <span className="text-[13px] text-faint">No price</span>;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-mono text-[13px] font-medium tabular-nums text-fg">{formatIdr(view.current)}</span>
      {view.onSale && view.regular !== null && (
        <span className="font-mono text-[11.5px] tabular-nums text-faint line-through">{formatIdr(view.regular)}</span>
      )}
    </span>
  );
}

export function WpStatusChip({ status }: { status: string }) {
  const meta = wpStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-[2px] text-[12px] font-medium ${familyChipClass[meta.family]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {meta.label}
    </span>
  );
}
