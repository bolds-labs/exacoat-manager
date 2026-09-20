import React, { useEffect, useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { fetchWordPressMedia, WpMediaItem } from '../../lib/wordpressBridge';
import { Search, X, RefreshCw, Image as ImageIcon, Check, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { clsx } from 'clsx';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string, item: WpMediaItem) => void;
  title?: string;
  recommendedDimensions?: string;
  currentUrl?: string;
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  title = 'Select Media Asset',
  recommendedDimensions = '1000x1000 PNG',
  currentUrl = '',
}) => {
  const [items, setItems] = useState<WpMediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [filter1000Only, setFilter1000Only] = useState<boolean>(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load media when modal opens or query changes
  const loadMedia = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWordPressMedia({
        search: debouncedSearch,
        page,
        per_page: 24,
      });

      if (res.success) {
        setItems(res.items);
        setTotalPages(res.total_pages);
        setTotalItems(res.total);
      } else {
        setError(res.error || 'Failed to load media library items');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to WordPress media library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, page, debouncedSearch]);

  // Client-side 1000x1000 filter if active
  const displayedItems = useMemo(() => {
    if (!filter1000Only) return items;
    return items.filter((item) => item.width === 1000 && item.height === 1000);
  }, [items, filter1000Only]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      zIndex="z-[200]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-[11px] text-zinc-400 font-normal mt-0.5">
              WordPress Media Library: {recommendedDimensions ? `Recommended: ${recommendedDimensions}` : 'Select an image'}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search uploaded files (e.g. iPhone 17, Mask, Cosmic)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs font-sans rounded-xl bg-zinc-900/80 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter1000Only(!filter1000Only)}
              className={clsx(
                'px-3 py-2 rounded-xl text-xs font-sans font-medium transition-all flex items-center gap-1.5 border cursor-pointer',
                filter1000Only
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              )}
              title="Filter to 1000x1000 canvas assets only"
            >
              <Filter className="w-3 h-3" />
              <span>1000x1000 Only</span>
            </button>

            <button
              type="button"
              onClick={loadMedia}
              disabled={loading}
              className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh media list"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin text-[#f3aa18]')} />
            </button>
          </div>
        </div>

        {/* Media Grid Container */}
        <div className="min-h-[380px] max-h-[520px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
              <RefreshCw className="w-7 h-7 animate-spin text-[#f3aa18] mb-3" />
              <p className="text-xs font-sans">Connecting to WordPress media library...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <p className="text-xs text-rose-400 font-sans mb-3">{error}</p>
              <button
                type="button"
                onClick={loadMedia}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-sans cursor-pointer hover:bg-rose-500/30"
              >
                Try Again
              </button>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-center p-6 border-2 border-dashed border-white/5 rounded-2xl">
              <ImageIcon className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-xs font-sans text-zinc-400">No media assets found</p>
              <p className="text-[11px] text-zinc-500 mt-1">Try a different search keyword or upload files via WordPress WP-Admin</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {displayedItems.map((item) => {
                const isSelected = currentUrl === item.url;
                const isExactCanvas = item.width === 1000 && item.height === 1000;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectImage(item.url, item);
                      onClose();
                    }}
                    className={clsx(
                      'group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all p-2 cursor-pointer bg-zinc-900/60 hover:bg-zinc-800/80',
                      isSelected
                        ? 'border-[#f3aa18] ring-2 ring-[#f3aa18]/30 shadow-lg'
                        : 'border-white/10 hover:border-white/25'
                    )}
                  >
                    {/* Thumbnail Box with Checkered Transparency Background */}
                    <div
                      className="relative w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                      style={{
                        backgroundColor: '#141416',
                        backgroundImage:
                          'linear-gradient(45deg, #1d1d20 25%, transparent 25%), linear-gradient(-45deg, #1d1d20 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1d1d20 75%), linear-gradient(-45deg, transparent 75%, #1d1d20 75%)',
                        backgroundSize: '12px 12px',
                        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                      }}
                    >
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-contain pointer-events-none transition-transform group-hover:scale-105"
                      />

                      {/* Selected checkmark badge */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#f3aa18] text-black flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}

                      {/* Dimension Badge */}
                      {item.width && item.height ? (
                        <div
                          className={clsx(
                            'absolute bottom-1 right-1 text-[9px] font-mono px-1.5 py-0.5 rounded-md shadow-xs backdrop-blur-md',
                            isExactCanvas
                              ? 'bg-emerald-500/90 text-white font-bold'
                              : 'bg-black/70 text-zinc-300 border border-white/10'
                          )}
                        >
                          {item.width}x{item.height}
                        </div>
                      ) : null}
                    </div>

                    {/* File Title & Info */}
                    <div className="mt-2 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate font-sans group-hover:text-[#f3aa18] transition-colors" title={item.filename}>
                        {item.filename || item.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate font-mono mt-0.5">
                        {item.date ? new Date(item.date).toLocaleDateString() : 'WordPress'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Pagination & Counts */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <div className="font-sans">
            Showing <span className="text-white font-mono">{displayedItems.length}</span> of{' '}
            <span className="text-white font-mono">{totalItems}</span> items
            {filter1000Only && ' (1000x1000 filtered)'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-zinc-300">
              Page {page} of {totalPages || 1}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
