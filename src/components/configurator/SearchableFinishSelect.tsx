import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Ban } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { GlobalFinish } from '../../lib/wordpressBridge';
import { cn } from '../../lib/utils';

interface SearchableFinishSelectProps {
  value: string;
  onChange: (val: string) => void;
  finishes: GlobalFinish[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableFinishSelect: React.FC<SearchableFinishSelectProps> = ({
  value,
  onChange,
  finishes,
  placeholder = 'Select finish...',
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setSelectedGroup('all');
    }
  }, [isOpen]);

  // Find currently selected finish
  const selectedFinish = useMemo(() => {
    if (!value) return null;
    return finishes.find(
      (f) =>
        f.slug === value ||
        f.id === value ||
        (f.slug && f.slug.toLowerCase() === value.toLowerCase()) ||
        f.name.toLowerCase() === value.toLowerCase()
    );
  }, [finishes, value]);

  // Extract unique sorted groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    finishes.forEach((f) => {
      if (f.group && f.group.trim()) {
        set.add(f.group.trim());
      }
    });
    return Array.from(set).sort();
  }, [finishes]);

  // Filtered finishes
  const filteredFinishes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return finishes.filter((f) => {
      // Group filter
      if (selectedGroup !== 'all' && (f.group || '').trim().toLowerCase() !== selectedGroup.toLowerCase()) {
        return false;
      }
      // Text query
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.slug && f.slug.toLowerCase().includes(q)) ||
        (f.group && f.group.toLowerCase().includes(q))
      );
    });
  }, [finishes, searchQuery, selectedGroup]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-sans transition-all text-left select-none outline-none cursor-pointer',
            isOpen
              ? 'border-[#f3aa18] bg-zinc-900 ring-1 ring-[#f3aa18]/30 shadow-md'
              : 'border-white/10 bg-zinc-900/80 hover:bg-zinc-850 hover:border-white/20',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate min-w-0 pr-1">
            {selectedFinish ? (
              <>
                {/* Finish swatch / thumbnail */}
                {selectedFinish.thumbnail || selectedFinish.texture_url ? (
                  <img
                    src={selectedFinish.thumbnail || selectedFinish.texture_url}
                    alt={selectedFinish.name}
                    className="w-5 h-5 rounded-md object-cover shrink-0 border border-white/15 bg-zinc-800"
                    onError={(e) => {
                      // Fallback if image fails
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : selectedFinish.color_hex ? (
                  <div
                    className="w-5 h-5 rounded-md shrink-0 border border-white/15"
                    style={{ backgroundColor: selectedFinish.color_hex }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-[9px] font-bold text-zinc-400 shrink-0">
                    {selectedFinish.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-white truncate text-xs">
                  {selectedFinish.name}
                </span>
                {selectedFinish.group && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 font-mono shrink-0 hidden sm:inline-block">
                    {selectedFinish.group}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-md bg-zinc-800/80 border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
                  <Ban className="w-3 h-3" />
                </div>
                <span className="text-zinc-400 italic text-xs">
                  {placeholder || '(None / unassigned)'}
                </span>
              </>
            )}
          </div>

          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-zinc-400 transition-transform shrink-0',
              isOpen && 'rotate-180 text-white'
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="z-[260] w-[320px] sm:w-[350px] p-2.5 rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl backdrop-blur-2xl text-white space-y-2.5 font-sans"
      >
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search finishes or groups..."
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Group category chips */}
        {groups.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={cn(
                'px-2 py-0.5 rounded-full font-medium transition-colors shrink-0 cursor-pointer',
                selectedGroup === 'all'
                  ? 'bg-[#f3aa18] text-black font-bold'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
            >
              All ({finishes.length})
            </button>
            {groups.map((grp) => {
              const count = finishes.filter(
                (f) => (f.group || '').trim().toLowerCase() === grp.toLowerCase()
              ).length;
              const isAct = selectedGroup.toLowerCase() === grp.toLowerCase();
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={cn(
                    'px-2 py-0.5 rounded-full font-medium transition-colors shrink-0 cursor-pointer',
                    isAct
                      ? 'bg-[#f3aa18] text-black font-bold'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {grp} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Options List */}
        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 divide-y divide-white/5">
          {/* None / Unassigned Option */}
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors text-left group cursor-pointer',
              !value
                ? 'bg-[#f3aa18]/15 text-[#f3aa18] font-semibold border border-[#f3aa18]/30'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <div className="w-5 h-5 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
                <Ban className="w-3 h-3" />
              </div>
              <span className="italic text-xs">(None / unassigned)</span>
            </div>
            {!value && <Check className="w-3.5 h-3.5 text-[#f3aa18] shrink-0" />}
          </button>

          {/* Finishes List */}
          <div className="pt-1 space-y-0.5">
            {filteredFinishes.length > 0 ? (
              filteredFinishes.map((f) => {
                const fVal = f.slug || f.id;
                const isSelected =
                  value === fVal ||
                  value === f.id ||
                  (f.slug && value.toLowerCase() === f.slug.toLowerCase());

                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onChange(fVal);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors text-left group cursor-pointer',
                      isSelected
                        ? 'bg-[#f3aa18]/15 text-[#f3aa18] font-semibold border border-[#f3aa18]/30'
                        : 'text-zinc-200 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                      {f.thumbnail || f.texture_url ? (
                        <img
                          src={f.thumbnail || f.texture_url}
                          alt={f.name}
                          className="w-5 h-5 rounded-md object-cover shrink-0 border border-white/15 bg-zinc-800"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : f.color_hex ? (
                        <div
                          className="w-5 h-5 rounded-md shrink-0 border border-white/15"
                          style={{ backgroundColor: f.color_hex }}
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-[9px] font-bold text-zinc-400 shrink-0">
                          {f.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="truncate">
                        <span className="font-medium text-xs block truncate text-white group-hover:text-white">
                          {f.name}
                        </span>
                        {f.group && (
                          <span className="text-[10px] text-zinc-400 font-mono block truncate">
                            {f.group}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {f.badge_text && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 font-mono font-medium">
                          {f.badge_text}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#f3aa18]" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center space-y-1">
                <p className="text-xs text-zinc-400">No finishes found</p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedGroup('all');
                    }}
                    className="text-[11px] text-[#f3aa18] hover:underline"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
