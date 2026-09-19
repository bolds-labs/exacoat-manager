import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export interface FilterSelectOption<T = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky' | 'orange';
  isHeader?: boolean;
  indent?: boolean;
}

export interface FilterSelectProps<T = string> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: FilterSelectOption<T>[];
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  dropUp?: boolean;
  align?: 'left' | 'right';
}

export function FilterSelect<T extends string | number = string>({
  label,
  value,
  onChange,
  options,
  icon,
  placeholder = 'Select...',
  className,
  dropdownClassName,
  disabled = false,
  dropUp = false,
  align = 'left',
}: FilterSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value && !opt.isHeader);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={clsx('relative inline-block font-sans text-xs', className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={clsx(
          'h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all select-none cursor-pointer border font-sans',
          'bg-zinc-100 hover:bg-zinc-200/80 dark:bg-[#141414] dark:hover:bg-zinc-800/80',
          'text-zinc-900 dark:text-zinc-100 border-zinc-200/80 dark:border-white/10 shadow-2xs',
          isOpen && 'border-[#f3aa18] dark:border-[#f3aa18] ring-2 ring-[#f3aa18]/20',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {label && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
            {label}:
          </span>
        )}
        {icon && <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>}
        {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
        
        <span className="font-semibold truncate max-w-[150px]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {selectedOption?.count !== undefined && (
          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 font-bold">
            {selectedOption.count}
          </span>
        )}

        <ChevronDown
          className={clsx(
            'w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 shrink-0 ml-0.5',
            isOpen && 'rotate-180 text-zinc-900 dark:text-white'
          )}
        />
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 min-w-[200px] max-w-[320px] max-h-80 overflow-y-auto rounded-xl p-1',
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            align === 'right' ? 'right-0' : 'left-0',
            'bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/15 shadow-2xl backdrop-blur-xl',
            'animate-in fade-in zoom-in-95 duration-100 select-none',
            dropdownClassName
          )}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-center text-[11px] text-zinc-400">
              No options available
            </div>
          ) : (
            options.map((opt, idx) => {
              if (opt.isHeader) {
                return (
                  <div
                    key={`header-${idx}-${String(opt.value)}`}
                    className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-t border-zinc-200/50 dark:border-white/5 first:border-0 first:pt-1 select-none"
                  >
                    {opt.label}
                  </div>
                );
              }

              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 text-left transition-colors cursor-pointer',
                    opt.indent && 'pl-5',
                    isSelected
                      ? 'bg-[#f3aa18]/15 text-[#f3aa18] font-bold dark:bg-[#f3aa18]/20 dark:text-[#f3aa18]'
                      : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className={clsx('truncate', opt.indent && 'text-[11px] text-neutral-300')}>{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className={clsx(
                        'text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase',
                        opt.badgeVariant === 'emerald' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
                        opt.badgeVariant === 'amber' && 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30',
                        opt.badgeVariant === 'sky' && 'bg-sky-500/15 text-sky-500 dark:text-sky-400 border border-sky-500/30',
                        opt.badgeVariant === 'orange' && 'bg-orange-500/15 text-orange-500 dark:text-orange-400 border border-orange-500/30',
                        opt.badgeVariant === 'rose' && 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30',
                        (!opt.badgeVariant || opt.badgeVariant === 'zinc') && 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                      )}>
                        {opt.badge}
                      </span>
                    )}
                    {opt.count !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 font-semibold">
                        {opt.count}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#f3aa18] shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
