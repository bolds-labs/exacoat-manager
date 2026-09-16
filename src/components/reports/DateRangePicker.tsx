import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'all' | 'custom';

export interface DateRange {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(value.startDate);
  const [tempEnd, setTempEnd] = useState(value.endDate);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatDateString = (d: Date): string => {
    return d.toISOString().split('T')[0];
  };

  const getPresetRange = (preset: DatePreset): DateRange => {
    const now = new Date();
    const todayStr = formatDateString(now);

    switch (preset) {
      case 'today':
        return { preset, startDate: todayStr, endDate: todayStr, label: 'Today' };

      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = formatDateString(y);
        return { preset, startDate: yStr, endDate: yStr, label: 'Yesterday' };
      }

      case '7d': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return { preset, startDate: formatDateString(d), endDate: todayStr, label: 'Last 7 Days' };
      }

      case '30d': {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        return { preset, startDate: formatDateString(d), endDate: todayStr, label: 'Last 30 Days' };
      }

      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { preset, startDate: formatDateString(start), endDate: todayStr, label: 'This Month' };
      }

      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { preset, startDate: formatDateString(start), endDate: formatDateString(end), label: 'Last Month' };
      }

      case 'all':
      default:
        return { preset: 'all', startDate: '2020-01-01', endDate: todayStr, label: 'All Time' };
    }
  };

  const presets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'all', label: 'All Time' },
  ];

  const handleSelectPreset = (preset: DatePreset) => {
    const range = getPresetRange(preset);
    setTempStart(range.startDate);
    setTempEnd(range.endDate);
    onChange(range);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (!tempStart || !tempEnd) return;
    onChange({
      preset: 'custom',
      startDate: tempStart,
      endDate: tempEnd,
      label: `${tempStart} to ${tempEnd}`,
    });
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className={clsx("relative", isOpen && "z-50")} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'min-h-11 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all border select-none',
          isOpen
            ? 'bg-zinc-100 text-zinc-950 border-zinc-400 ring-1 ring-zinc-200 dark:bg-white/[0.08] dark:text-white dark:border-white/30 dark:ring-white/10'
            : 'bg-white text-zinc-700 hover:text-zinc-950 border-zinc-200 hover:border-zinc-400 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:text-white dark:border-white/[0.08] dark:hover:border-white/[0.14]'
        )}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
        <span className="font-medium">{value.label}</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.1] shadow-2xl p-3 z-50 animate-fade-in space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2">Preset Ranges</p>
            <div className="grid grid-cols-2 gap-1">
              {presets.map(p => {
                const isSelected = value.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={clsx(
                      'min-h-11 flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left',
                      isSelected
                        ? 'bg-zinc-100 text-zinc-950 dark:bg-white/[0.1] dark:text-white font-bold'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.04]'
                    )}
                  >
                    <span>{p.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2">Custom Date Range</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div>
                <label className="text-[9px] text-zinc-500 block mb-0.5">Start</label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={e => setTempStart(e.target.value)}
                  className="w-full min-h-11 px-2 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/[0.12] text-zinc-950 dark:text-white text-[11px] focus:border-[#5e9f24] dark:focus:border-[#f3aa18]"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 block mb-0.5">End</label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={e => setTempEnd(e.target.value)}
                  className="w-full min-h-11 px-2 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/[0.12] text-zinc-950 dark:text-white text-[11px] focus:border-[#5e9f24] dark:focus:border-[#f3aa18]"
                />
              </div>
            </div>

            <button
              onClick={handleApplyCustom}
              className="w-full min-h-11 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold text-xs transition-colors"
            >
              Apply Custom Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
