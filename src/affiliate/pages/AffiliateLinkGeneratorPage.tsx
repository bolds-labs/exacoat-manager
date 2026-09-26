import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Link2, 
  Sparkles, 
  ShoppingBag, 
  Loader2, 
  ArrowRight,
  ShieldCheck 
} from 'lucide-react';
import { AffiliateProfile } from '../../types';
import { searchAffiliateProducts } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { clsx } from 'clsx';

interface AffiliateLinkGeneratorPageProps {
  profile: AffiliateProfile;
}

interface CatalogProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  permalink: string;
  image_url: string;
}

export const AffiliateLinkGeneratorPage: React.FC<AffiliateLinkGeneratorPageProps> = ({ profile }) => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [generatedCustomUrl, setGeneratedCustomUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const slug = profile.slug;

  const buildAffiliateUrl = (rawUrl: string): string => {
    try {
      const url = new URL(rawUrl.trim(), 'https://exacoat.com');
      url.searchParams.set('ref', slug);
      return url.toString();
    } catch {
      const clean = rawUrl.trim().replace(/\?ref=.*$/, '');
      const separator = clean.includes('?') ? '&' : '?';
      return `${clean}${separator}ref=${encodeURIComponent(slug)}`;
    }
  };

  // Perform product search
  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      setIsLoading(true);
      try {
        const results = await searchAffiliateProducts(searchQuery);
        if (active) {
          setProducts(results);
        }
      } catch (err: any) {
        if (active) {
          console.warn('Could not load products:', err.message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchCatalog, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleCopyProductLink = async (prod: CatalogProduct) => {
    const affiliateUrl = buildAffiliateUrl(prod.permalink);
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopiedKey(String(prod.id));
      showToast('success', 'Product Link Copied', prod.name);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      showToast('error', 'Copy Failed', 'Unable to access clipboard.');
    }
  };

  const handleGenerateCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;

    let target = customUrlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    const output = buildAffiliateUrl(target);
    setGeneratedCustomUrl(output);
  };

  const handleCopyCustomUrl = async () => {
    if (!generatedCustomUrl) return;
    try {
      await navigator.clipboard.writeText(generatedCustomUrl);
      setCopiedKey('custom');
      showToast('success', 'Custom Link Copied', generatedCustomUrl);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      showToast('error', 'Copy Failed', 'Unable to access clipboard.');
    }
  };

  const formatIDR = (val: number): string => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Product Links and Deep Link Generator</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Generate direct product referral links that credit your account with 20% commission on every order.
        </p>
      </div>

      {/* Custom URL Converter Card */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Paste Any Exacoat Store URL</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Already browsing an item on exacoat.com? Paste the page link below to append your permanent affiliate tag.
        </p>

        <form onSubmit={handleGenerateCustomUrl} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="https://exacoat.com/products/iphone-16-pro-max-skins"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
          >
            Generate Link
          </button>
        </form>

        {generatedCustomUrl && (
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-mono text-zinc-300 break-all select-all">
              {generatedCustomUrl}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyCustomUrl}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  copiedKey === 'custom'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                )}
              >
                {copiedKey === 'custom' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'custom' ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={generatedCustomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Product Catalog Finder */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Find Products in Catalog</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Search popular device skins, screen protectors, and accessories.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search iPhone, MacBook, iPad..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        </div>

        {/* Results Container */}
        {isLoading ? (
          <div className="py-16 text-center text-zinc-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span className="text-xs">Searching store catalog...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-2">
            <ShoppingBag className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No products match your query</h3>
            <p className="text-xs text-zinc-400">
              Try searching for specific devices like iPhone, Galaxy, iPad, or MacBook.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((prod) => {
              const isCopied = copiedKey === String(prod.id);
              return (
                <div
                  key={prod.id}
                  className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 transition-colors flex flex-col justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        className="w-12 h-12 rounded-lg object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-semibold text-zinc-200 truncate leading-snug" title={prod.name}>
                        {prod.name}
                      </h3>
                      {prod.price > 0 && (
                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          {formatIDR(prod.price)}
                        </p>
                      )}
                      <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                        Earn 20% commission ({formatIDR(prod.price * 0.20)})
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <a
                      href={prod.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyProductLink(prod)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
                      )}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Attribution Info Card */}
      <section className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center gap-3 text-xs text-zinc-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <p>
          Every link generated here automatically encodes your unique referral slug. When your followers click, a 30-day tracking cookie is stored on their browser. If they purchase within 30 days, 20% of their product total is credited to your unpaid balance.
        </p>
      </section>
    </div>
  );
};
