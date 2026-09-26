import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  avatarUrl?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  direction?: 'down' | 'up';
  allowCustom?: boolean;
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  label,
  error,
  className,
  disabled = false,
  direction = 'down',
  allowCustom = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  return (
    <div className={clsx('w-full space-y-1.5 font-sans relative', isOpen && 'z-50', className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-zinc-400 font-sans">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all text-left select-none',
          isOpen
            ? 'border-zinc-400 dark:border-white/30 ring-1 ring-zinc-200 dark:ring-white/10 bg-white dark:bg-zinc-950'
            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 hover:border-zinc-300 dark:hover:border-zinc-700',
          error && 'border-rose-500 ring-1 ring-rose-500/30',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {selectedOption ? (
            <>
              {selectedOption.avatarUrl && (
                <img
                  src={selectedOption.avatarUrl}
                  alt={selectedOption.label}
                  className="w-5 h-5 rounded-full object-cover shrink-0 border border-zinc-700"
                />
              )}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#f3aa18]/10 text-lime-700 dark:text-[#f3aa18] border border-lime-500/30 shrink-0 font-bold">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </div>

        <ChevronDown className={clsx('w-4 h-4 text-zinc-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Popover (direction: down or up) */}
      {isOpen && (
        <div 
          className={clsx(
            'absolute left-0 right-0 p-2 rounded-2xl bg-white dark:bg-[#181818] border border-zinc-200 dark:border-white/[0.12] shadow-2xl z-50 animate-fade-in space-y-1.5 min-w-[220px]',
            direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30"
            />
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 pt-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-mono transition-colors text-left group',
                      isSelected
                        ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-950 dark:text-white font-bold border border-zinc-200 dark:border-white/10'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      {opt.avatarUrl && (
                        <img
                          src={opt.avatarUrl}
                          alt={opt.label}
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                        />
                      )}
                      <div className="truncate">
                        <p className="truncate text-xs font-medium">{opt.label}</p>
                        {opt.sublabel && (
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{opt.sublabel}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08] font-bold">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
                    </div>
                  </button>
                );
              })
            ) : allowCustom && searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => {
                  onChange(searchQuery.trim());
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-mono bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-bold hover:bg-zinc-200 dark:hover:bg-white/[0.14] border border-zinc-200 dark:border-white/10 text-left"
              >
                <span>➕ Use &ldquo;{searchQuery.trim()}&rdquo; (Custom)</span>
              </button>
            ) : (
              <p className="text-center py-3 text-xs text-zinc-400 font-mono">No options found</p>
            )}

            {allowCustom && searchQuery.trim() && filteredOptions.length > 0 && !options.some(o => o.value.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => {
                  onChange(searchQuery.trim());
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl text-xs font-mono bg-zinc-100 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-lime-500/15 hover:text-lime-700 dark:hover:text-[#f3aa18] text-left border-t border-zinc-200 dark:border-white/5"
              >
                <span>➕ Use &ldquo;{searchQuery.trim()}&rdquo;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
