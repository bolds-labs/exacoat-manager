import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  category?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'lime' | 'amber' | 'rose' | 'zinc';
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  label,
  searchable = false,
  className,
  dropdownClassName,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || (value ? { value, label: value, subtitle: 'Active selection' } : undefined);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  // Filter options by search query
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.subtitle && opt.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (opt.category && opt.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group options by category
  const groupedOptions: Record<string, SelectOption[]> = {};
  filteredOptions.forEach(opt => {
    const cat = opt.category || 'Standard Options';
    if (!groupedOptions[cat]) groupedOptions[cat] = [];
    groupedOptions[cat].push(opt);
  });

  const hasCategories = Object.keys(groupedOptions).length > 1 || !groupedOptions['Standard Options'];

  return (
    <div className={clsx('relative space-y-1.5 font-sans', className)} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block font-mono">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={clsx(
          'w-full p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 text-left transition-all',
          'bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10',
          'hover:border-zinc-300 dark:hover:border-white/20 shadow-xs',
          isOpen && 'border-zinc-400 dark:border-white/30 ring-2 ring-zinc-200 dark:ring-white/10',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0">
          {selectedOption?.icon && (
            <span className="shrink-0 flex items-center justify-center text-[#f3aa18]">
              {selectedOption.icon}
            </span>
          )}
          <div className="truncate">
            <span className={clsx('font-bold', selectedOption ? 'text-zinc-900 dark:text-white' : 'text-zinc-400')}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.subtitle && (
              <span className="text-[10px] text-zinc-500 block truncate font-mono">
                {selectedOption.subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption?.badge && (
            <span className={clsx(
              'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase',
              selectedOption.badgeVariant === 'lime' && 'bg-lime-500/15 text-[#f3aa18] border border-lime-500/30',
              selectedOption.badgeVariant === 'amber' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
              selectedOption.badgeVariant === 'rose' && 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
              (!selectedOption.badgeVariant || selectedOption.badgeVariant === 'zinc') && 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            )}>
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown className={clsx('w-4 h-4 text-zinc-400 transition-transform duration-200', isOpen && 'rotate-180 text-zinc-900 dark:text-white')} />
        </div>
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          className={clsx(
            'absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden shadow-2xl',
            'bg-[#ffffff] dark:bg-[#121215] border border-zinc-200 dark:border-white/10 backdrop-blur-xl',
            'animate-in fade-in zoom-in-95 duration-150',
            dropdownClassName
          )}
        >
          {/* Optional Search Box */}
          {searchable && (
            <div className="p-2 border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-black/40">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search options..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-hidden focus:border-zinc-400 dark:focus:border-white/30"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {searchable && searchQuery.trim() && !options.some(o => o.value.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <div className="p-1 pb-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onChange(searchQuery.trim());
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between text-left bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-zinc-900 dark:text-white font-mono border border-zinc-200 dark:border-white/10 transition-all"
                >
                  <span className="truncate">Use custom: <strong>"{searchQuery.trim()}"</strong></span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-white/20 text-zinc-800 dark:text-white">Custom</span>
                </button>
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 font-mono">
                No matching options found
              </div>
            ) : hasCategories ? (
              Object.entries(groupedOptions).map(([category, items]) => (
                <div key={category} className="pt-1.5 first:pt-0 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {category}
                  </div>
                  {items.map(opt => {
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
                          'w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-all',
                          isSelected
                            ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-950 dark:text-white font-bold border border-zinc-200 dark:border-white/10'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white'
                        )}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {opt.icon && (
                            <span className={clsx('shrink-0 flex items-center justify-center', isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-400')}>
                              {opt.icon}
                            </span>
                          )}
                          <div className="truncate">
                            <span className="block truncate">{opt.label}</span>
                            {opt.subtitle && (
                              <span className="text-[10px] text-zinc-400 font-mono block truncate">
                                {opt.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {opt.badge && (
                            <span className={clsx(
                              'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase',
                              opt.badgeVariant === 'lime' && 'bg-lime-500/15 text-[#f3aa18]',
                              opt.badgeVariant === 'amber' && 'bg-amber-500/15 text-amber-400',
                              opt.badgeVariant === 'rose' && 'bg-rose-500/15 text-rose-400',
                              (!opt.badgeVariant || opt.badgeVariant === 'zinc') && 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            )}>
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="w-4 h-4 text-zinc-900 dark:text-white shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
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
                      'w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-all',
                      isSelected
                        ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-950 dark:text-white font-bold border border-zinc-200 dark:border-white/10'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {opt.icon && (
                        <span className={clsx('shrink-0 flex items-center justify-center', isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-400')}>
                          {opt.icon}
                        </span>
                      )}
                      <div className="truncate">
                        <span className="block truncate">{opt.label}</span>
                        {opt.subtitle && (
                          <span className="text-[10px] text-zinc-400 font-mono block truncate">
                            {opt.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {opt.badge && (
                        <span className={clsx(
                          'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase',
                          opt.badgeVariant === 'lime' && 'bg-lime-500/15 text-[#f3aa18]',
                          opt.badgeVariant === 'amber' && 'bg-amber-500/15 text-amber-400',
                          opt.badgeVariant === 'rose' && 'bg-rose-500/15 text-rose-400',
                          (!opt.badgeVariant || opt.badgeVariant === 'zinc') && 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        )}>
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-zinc-900 dark:text-white shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
