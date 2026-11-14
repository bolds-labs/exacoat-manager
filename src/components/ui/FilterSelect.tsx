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
    <div className={clsx('relative inline-block font-sans text-[12.5px]', className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={clsx(
          'h-[30px] px-2.5 rounded-[8px] text-[12.5px] flex items-center gap-1.5 transition-colors select-none cursor-pointer border font-sans',
          'bg-field hover:bg-chip text-fg border-field-border',
          isOpen && 'border-accent',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {label && (
          <span className="text-[12px] text-faint whitespace-nowrap">
            {label}:
          </span>
        )}
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
        
        <span className="font-[450] truncate max-w-[150px]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {selectedOption?.count !== undefined && (
          <span className="text-[11.5px] px-1.5 py-px rounded-full bg-chip text-muted font-medium tabular-nums">
            {selectedOption.count}
          </span>
        )}

        <ChevronDown
          className={clsx(
            'w-3.5 h-3.5 text-faint transition-transform duration-150 shrink-0 ml-0.5',
            isOpen && 'rotate-180 text-fg'
          )}
        />
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 min-w-[200px] max-w-[320px] max-h-80 overflow-y-auto rounded-[10px] p-1',
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            align === 'right' ? 'right-0' : 'left-0',
            'bg-card border border-card-border shadow-[0_12px_30px_rgba(0,0,0,0.3)]',
            'animate-in fade-in zoom-in-95 duration-100 select-none',
            dropdownClassName
          )}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-center text-[12px] text-faint">
              No options available
            </div>
          ) : (
            options.map((opt, idx) => {
              if (opt.isHeader) {
                return (
                  <div
                    key={`header-${idx}-${String(opt.value)}`}
                    className="px-2.5 pt-2 pb-1 text-[12px] text-faint border-t border-line first:border-0 first:pt-1 select-none"
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
                    'w-full px-2.5 py-1.5 rounded-[7px] text-[13px] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer',
                    opt.indent && 'pl-5',
                    isSelected
                      ? 'bg-accent-soft text-accent-fg font-medium'
                      : 'text-fg hover:bg-chip'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className={clsx('truncate', opt.indent && 'text-[12.5px] text-muted')}>{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className={clsx(
                        'text-[11px] px-1.5 py-px rounded-[6px] font-medium border',
                        opt.badgeVariant === 'emerald' && 'bg-st-done-bg text-st-done-fg border-st-done-border',
                        opt.badgeVariant === 'amber' && 'bg-st-wait-bg text-st-wait-fg border-st-wait-border',
                        opt.badgeVariant === 'sky' && 'bg-st-prog-bg text-st-prog-fg border-st-prog-border',
                        opt.badgeVariant === 'orange' && 'bg-accent-soft text-accent-fg border-accent-border',
                        opt.badgeVariant === 'rose' && 'bg-st-stop-bg text-st-stop-fg border-st-stop-border',
                        (!opt.badgeVariant || opt.badgeVariant === 'zinc') && 'bg-chip text-muted border-card-border'
                      )}>
                        {opt.badge}
                      </span>
                    )}
                    {opt.count !== undefined && (
                      <span className="text-[11.5px] px-1.5 py-px rounded-full bg-chip text-muted font-medium tabular-nums">
                        {opt.count}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-accent-fg shrink-0" />
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
