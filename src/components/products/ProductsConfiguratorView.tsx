import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../../types';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { fetchProductsDirect } from '../../lib/wordpressBridge';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import { 
  Layers, 
  Search, 
  RefreshCw, 
  Sliders, 
  Check, 
  Package, 
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';

export const ProductsConfiguratorView: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'mkl' | 'wcpa'>('all');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchProductsDirect({
        search: search.trim() || undefined,
        per_page: 50,
      });

      if (res.success) {
        setProducts(res.products);
      } else {
        showToast('warning', 'Product Sync Warning', res.error || 'Failed loading products');
      }
    } catch (err: any) {
      showToast('error', 'Products Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = products.filter((p) => {
    if (filterType === 'mkl') return p.is_configurable;
    if (filterType === 'wcpa') return p.has_acowebs_wcpa;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeroHeader
        title="Products & Configurator Management"
        subtitle="Manage product layers, Marc Lacroix MKL stacked swatches, and Acowebs WCPA custom addons"
        icon={<Layers className="w-5 h-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadProducts}
            isLoading={isLoading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={isLoading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-[#0d0d11] border border-white/[0.08] rounded-xl self-start">
          {[
            { id: 'all', label: 'All Catalog' },
            { id: 'mkl', label: 'MKL Configurator' },
            { id: 'wcpa', label: 'Acowebs WCPA' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] ' + (
                filterType === tab.id
                  ? 'bg-[#f3aa18] text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search devices, skins, or MacBook..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d0d11] border border-white/[0.08] text-xs text-zinc-200 placeholder-zinc-500 pl-9 pr-3 py-2 rounded-xl focus:border-[#f3aa18] min-h-[44px]"
          />
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#f3aa18] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Loading catalog from store API...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#0d0d11] rounded-2xl border border-white/[0.08]">
          <Package className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-chakra">No Products Found</h3>
          <p className="text-xs text-zinc-400">Try adjusting your search or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const img = product.images?.[0]?.src;
            const layersCount = product.configurator_layers?.length || 0;

            return (
              <GlassCard
                key={product.id}
                hoverEffect
                className="p-5 flex flex-col justify-between space-y-4 cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-14 h-14 rounded-xl bg-black/50 border border-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                      {img ? (
                        <img src={img} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {product.is_configurable && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/30">
                          MKL Configurator
                        </span>
                      )}
                      {product.has_acowebs_wcpa && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          Acowebs Addon
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1 font-chakra">
                      {product.name}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      slug: {product.slug}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="font-bold text-[#f3aa18] text-sm">
                    {formatCurrency(product.price, 'IDR')}
                  </span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>
                      {product.is_configurable
                        ? layersCount + ' skin layer' + (layersCount !== 1 ? 's' : '')
                        : product.has_acowebs_wcpa
                        ? 'Form #' + product.wcpa_form_ids?.[0]
                        : 'Simple item'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Product & Configurator Inspector Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d0d11] border border-white/[0.1] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-[#08080a]">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-[#f3aa18]" />
                  <h2 className="text-lg font-bold text-white font-chakra">
                    {selectedProduct.name}
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  Product ID #{selectedProduct.id} | Base Price: {formatCurrency(selectedProduct.price, 'IDR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* MKL Configurator Layers */}
              {selectedProduct.is_configurable ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-chakra">
                    Configurator Stacked Layers ({selectedProduct.configurator_layers?.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {selectedProduct.configurator_layers?.map((layer: any, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#f3aa18]/20 text-[#f3aa18] flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-white text-sm">{layer.name}</h4>
                            <p className="text-zinc-500 text-[11px]">Layer ID: {layer._id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {layer.required && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20">
                              Required
                            </span>
                          )}
                          {layer.can_deselect && (
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-semibold">
                              Optional
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedProduct.has_acowebs_wcpa ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-chakra">
                    Acowebs Custom Product Addons (WCPA)
                  </h3>
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                    <p className="text-zinc-300">
                      This product (e.g. Titanium+ Skins) utilizes Acowebs Custom Addons with linked Form ID:
                    </p>
                    <div className="font-mono text-blue-400 font-bold text-sm">
                      Form IDs: [{selectedProduct.wcpa_form_ids?.join(', ')}]
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                  <p className="text-zinc-400">
                    This is a standard simple or variable WooCommerce item without configurator layer metadata.
                  </p>
                </div>
              )}

              {/* Raw Meta Inspector */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Storefront Live Link
                </span>
                <a
                  href={'https://exacoat.com/product/' + selectedProduct.slug}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#f3aa18] hover:underline"
                >
                  <span>View on exacoat.com/product/{selectedProduct.slug}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="p-5 border-t border-white/[0.08] flex items-center justify-end bg-[#08080a]">
              <Button variant="outline" size="md" onClick={() => setSelectedProduct(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
