import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { duplicateProductDirect, type Product } from '../../lib/wordpressBridge';
import { formatIdr, parsePriceInput } from '../../lib/productList';
import { slugify } from '../../lib/finishesEditor';
import { Modal } from '../ds/Modal';
import { Button } from '../ds/Button';
import { TextField } from '../ds/TextField';
import { Switch } from '../ds/Switch';
import { toast } from '../ds/toast';

export interface DuplicateSource {
  id: number;
  name: string;
  slug: string;
  /** Regular price of the source, used as the starting price of the copy. */
  price: number;
  categoryName?: string;
}

export const duplicateSourceOf = (p: Product): DuplicateSource => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  price: Number(p.regular_price || p.price) || 0,
  categoryName: p.categories?.[0]?.name,
});

export interface DuplicateProductModalProps {
  source: DuplicateSource | null;
  onClose(): void;
  /** Products offers AI SEO for the copy; Studio did not. */
  offerAutoSeo?: boolean;
  /** Studio does not edit prices: the copy keeps the source's regular price, changed later in Products. */
  allowPrice?: boolean;
  onDuplicated(productId: number): void;
}

/** One Duplicate pop-up for Products and Studio. The copy is created as a draft. */
export function DuplicateProductModal({ source, onClose, offerAutoSeo = false, allowPrice = true, onDuplicated }: DuplicateProductModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [price, setPrice] = useState('');
  const [copyConfig, setCopyConfig] = useState(true);
  const [autoSeo, setAutoSeo] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!source) return;
    setName(`${source.name} (Copy)`);
    setSlug(`${slugify(source.slug || source.name)}-copy`);
    setPrice(source.price > 0 ? String(source.price) : '');
    setCopyConfig(true);
    setAutoSeo(true);
  }, [source]);

  const parsedPrice = allowPrice ? parsePriceInput(price) : source && source.price > 0 ? source.price : null;
  const error =
    !name.trim() ? 'Enter a name for the copy.' : parsedPrice === 'invalid' ? 'Price must be a whole number of rupiah.' : null;

  const run = async () => {
    if (!source || error) return;
    setBusy(true);
    try {
      const res = await duplicateProductDirect({
        source_product_id: source.id,
        new_name: name.trim(),
        new_slug: slugify(slug) || undefined,
        new_price: typeof parsedPrice === 'number' ? parsedPrice : undefined,
        copy_configurator: copyConfig,
        auto_generate_seo: offerAutoSeo ? autoSeo : undefined,
        category_name: source.categoryName,
      });
      if (!res.success || !res.productId) throw new Error(res.error || 'The store did not create the copy.');
      toast.success('Product duplicated', `${res.name || name.trim()} (#${res.productId}) was created as a draft.`);
      onDuplicated(res.productId);
      onClose();
    } catch (err) {
      toast.error('Not duplicated', err instanceof Error ? err.message : 'Could not reach the store.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={source !== null}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
      title="Duplicate product"
      reference={source ? `#${source.id}` : undefined}
      description="The copy is created as a draft, so it stays off the webstore until you publish it."
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" icon={Copy} onClick={() => void run()} disabled={busy || Boolean(error)}>
            {busy ? 'Duplicating...' : 'Duplicate'}
          </Button>
        </>
      }
    >
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Slug" mono value={slug} onChange={(e) => setSlug(e.target.value)} />
      {allowPrice ? (
        <TextField
          label="Regular price (Rp)"
          inputMode="numeric"
          mono
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Same as the source"
        />
      ) : (
        <p className="text-[13px] text-muted">
          The copy keeps the source's regular price{source && source.price > 0 ? ` (${formatIdr(source.price)})` : ''}. Change it in Products after duplicating.
        </p>
      )}
      <Switch label="Copy the configurator setup" checked={copyConfig} onCheckedChange={setCopyConfig} />
      {offerAutoSeo && <Switch label="Write SEO title and description with AI" checked={autoSeo} onCheckedChange={setAutoSeo} />}
      {error && <p className="text-[12.5px] text-st-stop-fg">{error}</p>}
    </Modal>
  );
}
