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
  ShieldCheck 
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
    <div className="space-y-6">
      {/* Top Banner */}
      <PageHeroHeader
        title="Product Link Generator"
        subtitle="Generate direct tracking links for any Exacoat skin, device, or collection to earn 20% on every verified purchase."
      />

      {/* Custom URL Converter Card */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Convert Any Exacoat Store URL</h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              Paste any exacoat.com product, collection, or landing page link to attach your tracking slug.
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerateCustomUrl} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="https://exacoat.com/products/iphone-16-pro-max-skins"
            className="h-11 flex-1 px-4 rounded-xl border border-white/[0.09] bg-white/[0.035] font-mono text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/[0.16] focus:border-[#f3aa18]/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#f3aa18]/[0.08]"
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

      {/* Product Catalog Finder */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Search Store Catalog</h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              Instant 1-click tracking links for device skins, screen protectors, and accessories.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search iPhone, MacBook, iPad..."
              className="h-11 w-full pl-10 pr-4 rounded-xl border border-white/[0.09] bg-white/[0.035] font-sans text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/[0.16] focus:border-[#f3aa18]/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#f3aa18]/[0.08]"
            />
          </div>
        </div>

        {/* Results Container */}
        {isLoading ? (
          <div className="py-16 text-center text-zinc-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#f3aa18]" />
            <span className="text-xs font-mono">Searching store catalog...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-2">
            <ShoppingBag className="w-8 h-8 text-zinc-500 mx-auto" />
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
                <GlassCard
                  key={prod.id}
                  hoverEffect={true}
                  className="p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        className="w-12 h-12 rounded-xl object-cover bg-black border border-white/[0.08] shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-black border border-white/[0.08] flex items-center justify-center text-zinc-500 shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-semibold text-zinc-100 truncate leading-snug" title={prod.name}>
                        {prod.name}
                      </h3>
                      {prod.price > 0 && (
                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          {formatIDR(prod.price)}
                        </p>
                      )}
                      <p className="text-[10px] text-emerald-400 font-medium mt-0.5 font-mono">
                        Earn 20% ({formatIDR(prod.price * 0.20)})
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <a
                      href={prod.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <Button
                      type="button"
                      variant={isCopied ? 'success' : 'secondary'}
                      size="sm"
                      onClick={() => handleCopyProductLink(prod)}
                      leftIcon={isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {isCopied ? 'Copied' : 'Copy Link'}
                    </Button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Attribution Info Card */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3 text-xs text-zinc-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="leading-relaxed">
          Every link generated here automatically encodes your unique referral slug. When your followers click, a 30-day tracking cookie is stored on their browser. If they purchase within 30 days, 20% of their net product total is credited to your unpaid balance.
        </p>
      </div>
    </div>
  );
};
