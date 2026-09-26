import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Link2, 
  ShoppingBag, 
  Loader2, 
  ShieldCheck,
  Percent,
  X
} from 'lucide-react';
import { AffiliateProfile } from '../../types';
import { searchAffiliateProducts } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { PageHeroHeader } from '../../components/ui/PageHeroHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
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

const QUICK_SUGGESTIONS = [
  'iPhone 16 Pro',
  'iPhone 16 Pro Max',
  'Samsung S25 Ultra',
  'MacBook Pro',
  'iPad Pro',
  'PlayStation 5',
];

export const AffiliateLinkGeneratorPage: React.FC<AffiliateLinkGeneratorPageProps> = ({ profile }) => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [generatedCustomUrl, setGeneratedCustomUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const slug = profile.slug;
  const commissionRate = Number(profile.commission_rate) || 15;
  const discountRate = Number(profile.discount_rate) || 10;

  const buildAffiliateUrl = (rawUrl: string): string => {
    try {
      const url = new URL(rawUrl.trim(), 'https://exacoat.com');
      url.searchParams.delete('ref');
      url.searchParams.delete('aff');
      url.searchParams.delete('sla');
      url.searchParams.set('x', slug);
      return url.toString();
    } catch {
      const clean = rawUrl.trim().replace(/[?&](?:x|ref|aff|sla)=[^&]*/g, '');
      const separator = clean.includes('?') ? '&' : '?';
      return `${clean}${separator}x=${encodeURIComponent(slug)}`;
    }
  };

  // Perform product search only when query is non-empty
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setProducts([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    let active = true;
    const fetchCatalog = async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const results = await searchAffiliateProducts(trimmed);
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
      showToast('success', 'Link Copied', prod.name);
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
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <PageHeroHeader
        title="Product Link Generator"
        subtitle="Search device models to generate direct tracking links with customer discount attached."
        badge={{ label: 'LINK TOOLS', variant: 'amber' }}
      />

      {/* Direct Creator Discount Status */}
      <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Direct Customer Discount:</span>
              <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                {discountRate}% OFF
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Shoppers who click your links automatically receive {discountRate}% off without typing a promo code.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-zinc-400">
          Your Commission: <strong className="text-[#f3aa18]">{commissionRate}%</strong>
        </div>
      </div>

      {/* Elegant Search Hero Section */}
      <div className="p-8 sm:p-10 rounded-[28px] border border-white/[0.08] bg-[#09090b] shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-6">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Search Exacoat Catalog
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Type any phone, laptop, tablet, or gaming console to generate high-converting product cards.
          </p>
        </div>

        {/* Search Field */}
        <div className="max-w-2xl mx-auto relative">
          <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type device name, e.g. iPhone 16 Pro, Galaxy S25, MacBook..."
            className="w-full h-13 pl-12 pr-12 rounded-2xl border border-white/[0.12] bg-[#050506] text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/20 focus:border-[#f3aa18]/80 focus:ring-4 focus:ring-[#f3aa18]/10"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="text-[11px] text-zinc-500 font-mono">Popular:</span>
          {QUICK_SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSearchQuery(item)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-mono border transition-all cursor-pointer',
                searchQuery.toLowerCase() === item.toLowerCase()
                  ? 'bg-white/[0.12] text-white border-white/30 shadow-xs'
                  : 'bg-white/[0.03] text-zinc-400 border-white/[0.07] hover:bg-white/[0.07] hover:text-white hover:border-white/20'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Search Results Section */}
      {isLoading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#f3aa18]" />
          <span className="text-xs font-mono text-zinc-400">Searching catalog for matching devices...</span>
        </div>
      ) : hasSearched && products.length === 0 ? (
        <div className="py-16 text-center rounded-[28px] bg-white/[0.02] border border-white/[0.06] p-8 space-y-3">
          <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">No products found for &ldquo;{searchQuery}&rdquo;</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Try searching for broader keywords like iPhone, Galaxy, iPad, MacBook, or PlayStation.
          </p>
        </div>
      ) : products.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1 font-mono">
            <span>Found {products.length} product{products.length === 1 ? '' : 's'}</span>
            <span>Earn {commissionRate}% commission per sale</span>
          </div>

          {/* Big 3 Cards Column Layout matching exacoat-web /shop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {products.map((prod) => {
              const isCopied = copiedKey === String(prod.id);
              const estEarnings = prod.price > 0 ? Math.round(prod.price * (commissionRate / 100)) : 0;

              return (
                <div
                  key={prod.id}
                  className="group relative flex flex-col justify-between aspect-[3/4] w-full overflow-hidden rounded-[28px] sm:rounded-[32px] border border-white/[0.08] bg-[#080808] shadow-[0_16px_40px_-15px_rgba(0,0,0,0.7)] transition-all duration-500 hover:border-white/20 hover:shadow-[0_28px_60px_-15px_rgba(0,0,0,0.9)] select-none"
                >
                  {/* Subtle warm ambient halo behind device */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(243,170,24,0.06)_0%,_rgba(255,255,255,0.02)_40%,_transparent_70%)] pointer-events-none" />

                  {/* Device Hardware Image */}
                  <div className="absolute inset-0 flex items-center justify-center pt-4 pb-24 px-6 pointer-events-none z-0">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        loading="lazy"
                        draggable={false}
                        className="max-h-[82%] max-w-[88%] object-contain drop-shadow-[0_24px_45px_rgba(0,0,0,0.95)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 will-change-transform"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-600">
                        <ShoppingBag className="w-10 h-10" />
                      </div>
                    )}
                  </div>

                  {/* Scrim Gradient for text contrast */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#080808] via-[#080808]/75 via-45% to-transparent z-[5]" />

                  {/* Top Bar: View In Store link */}
                  <div className="relative z-10 p-5 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 rounded-full backdrop-blur-md">
                      {discountRate}% Off Applied
                    </span>
                    <a
                      href={prod.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-zinc-400 hover:text-white bg-black/60 hover:bg-white/[0.1] border border-white/[0.08] backdrop-blur-md transition-colors"
                      title="View product on exacoat.com"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Bottom Content: Device Name, Price, and 1-Click Copy Link */}
                  <div className="relative z-10 p-5 sm:p-6 space-y-3">
                    <div className="space-y-1">
                      <h3 className="font-heading text-lg sm:text-xl font-medium text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]" title={prod.name}>
                        {prod.name}
                      </h3>
                      <div className="flex items-center justify-between text-xs font-mono">
                        {prod.price > 0 ? (
                          <span className="text-zinc-300 font-semibold">{formatIDR(prod.price)}</span>
                        ) : (
                          <span className="text-zinc-400">Custom Skin</span>
                        )}
                        {estEarnings > 0 && (
                          <span className="text-emerald-400 font-bold">
                            Earn {formatIDR(estEarnings)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button: 1-Click Copy Link */}
                    <button
                      type="button"
                      onClick={() => handleCopyProductLink(prod)}
                      className={clsx(
                        'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer',
                        isCopied
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-[#f3aa18] hover:bg-[#e09b15] text-[#080808] hover:shadow-lg hover:shadow-[#f3aa18]/20'
                      )}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Affiliate Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Custom Store URL Converter Card */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">Convert Any Store URL</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Paste any custom exacoat.com product, collection, or landing page link to attach your tracking slug.
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerateCustomUrl} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="https://exacoat.com/products/iphone-16-pro-max-skins"
            className="h-11 flex-1 px-4 rounded-xl border border-white/[0.1] bg-[#050506] font-mono text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/20 focus:border-[#f3aa18]/70 focus:ring-4 focus:ring-[#f3aa18]/10"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
          >
            Generate Link
          </Button>
        </form>

        {generatedCustomUrl && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <span className="text-xs font-mono text-[#f3aa18] break-all select-all pl-1">
              {generatedCustomUrl}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant={copiedKey === 'custom' ? 'success' : 'primary'}
                size="sm"
                onClick={handleCopyCustomUrl}
                leftIcon={copiedKey === 'custom' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedKey === 'custom' ? 'Copied' : 'Copy Link'}
              </Button>
              <a
                href={generatedCustomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl text-zinc-400 hover:text-white bg-[#141414] hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
                title="Test referral link in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Attribution Info Card */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3 text-xs text-zinc-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="leading-relaxed">
          Every link generated here automatically encodes your unique referral slug. When your audience clicks, a 30-day tracking cookie is stored on their browser. If they purchase within 30 days, your {commissionRate}% creator commission is credited to your balance.
        </p>
      </div>
    </div>
  );
};
