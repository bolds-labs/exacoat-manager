import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  RotateCcw, 
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import { clsx } from 'clsx';

export type DatePreset = 
  | '30d' 
  | 'today' 
  | '7d' 
  | 'this_month' 
  | 'last_month' 
  | '90d' 
  | 'year' 
  | 'all' 
  | 'custom';

interface DateRangePickerProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (start: string, end: string) => void;
  label: string;
  commissionCount?: number;
  payoutCount?: number;
  subtitle?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomChange,
  label,
  commissionCount,
  payoutCount,
  subtitle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active Month View for custom calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return customEnd ? new Date(customEnd) : new Date();
  });

  // Selected range state inside picker
  const [rangeStart, setRangeStart] = useState<Date | null>(() => {
    return customStart ? new Date(customStart) : null;
  });
  const [rangeEnd, setRangeEnd] = useState<Date | null>(() => {
    return customEnd ? new Date(customEnd) : null;
  });
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  useEffect(() => {
    if (customStart) setRangeStart(new Date(customStart));
    if (customEnd) setRangeEnd(new Date(customEnd));
  }, [customStart, customEnd]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date: d, isCurrentMonth: false, key: `prev-${daysInPrevMonth - i}` });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
    }

    // Next month padding days to make full grid of 35 or 42 cells
    const remaining = 35 - days.length > 0 ? 35 - days.length : (42 - days.length >= 0 ? 42 - days.length : 0);
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }

    return days;
  }, [currentMonth]);

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isDayInRange = (date: Date) => {
    if (rangeStart && rangeEnd) {
      const t = date.getTime();
      const s = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
      const e = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime();
      return t > s && t < e;
    }
    if (rangeStart && !rangeEnd && hoverDate) {
      const t = date.getTime();
      const s = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
      const h = new Date(hoverDate.getFullYear(), hoverDate.getMonth(), hoverDate.getDate()).getTime();
      if (h > s) return t > s && t < h;
    }
    return false;
  };

  const handleDateClick = (date: Date) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
    } else {
      if (date.getTime() < rangeStart.getTime()) {
        setRangeStart(date);
        setRangeEnd(null);
      } else {
        setRangeEnd(date);
      }
    }
  };

  const handleApply = () => {
    if (rangeStart) {
      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd ? rangeEnd.toISOString().split('T')[0] : startStr;
      onCustomChange(startStr, endStr);
      onPresetChange('custom');
      setIsOpen(false);
    }
  };

  const handleQuickPreset = (presetKey: DatePreset, daysAgo?: number) => {
    if (presetKey === 'custom' && daysAgo) {
      const now = new Date();
      const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      setRangeStart(start);
      setRangeEnd(now);
      const startStr = start.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];
      onCustomChange(startStr, endStr);
      onPresetChange('custom');
      setIsOpen(false);
      return;
    }

    onPresetChange(presetKey);
    setIsOpen(false);
  };

  const today = new Date();

  return (
    <div className={clsx("relative", isOpen && "z-40")} ref={containerRef}>
      {/* Main Filter Bar Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0d0d0d] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-xl transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Active Horizon Details */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 shadow-xs">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">Date Horizon</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08]">
                {label}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              {subtitle || `Analyzing ${commissionCount ?? 0} order commissions & ${payoutCount ?? 0} payout events`}
            </p>
          </div>
        </div>

        {/* Right: Quick Preset Segmented Toolbar + Custom Popover Trigger */}
        <div className="flex items-center flex-wrap gap-1.5 p-1 bg-zinc-100 dark:bg-black/40 rounded-xl border border-zinc-200/80 dark:border-white/[0.06] font-mono text-xs">
          {[
            { id: '30d', label: '30D' },
            { id: 'today', label: 'Today' },
            { id: '7d', label: '7D' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: '90d', label: '90D' },
            { id: 'year', label: 'This Year' },
            { id: 'all', label: 'All Time' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => {
                onPresetChange(p.id as DatePreset);
                if (preset === 'custom') setIsOpen(false);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                preset === p.id && !isOpen
                  ? 'bg-white dark:bg-white/15 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.05]'
              )}
            >
              {p.label}
            </button>
          ))}

          {/* Custom Date Range Trigger Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
              preset === 'custom' || isOpen
                ? 'bg-white dark:bg-white/15 text-zinc-950 dark:text-white shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.05]'
            )}
          >
            <span>Custom</span>
            <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Floating Tailored Exacoat Interactive Calendar Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 z-50 p-5 rounded-3xl bg-white dark:bg-[#121212] border border-zinc-200 dark:border-white/[0.12] shadow-2xl animate-fade-in font-sans flex flex-col md:flex-row gap-6 w-[95vw] max-w-2xl">
          
          {/* Left Column: Quick Range Shortcuts */}
          <div className="w-full md:w-44 space-y-2 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-white/[0.08] pb-4 md:pb-0 md:pr-4 font-mono text-xs shrink-0">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-2 tracking-wider">
              Quick Ranges
            </span>
            {[
              { label: 'Today', action: () => handleQuickPreset('today') },
              { label: 'Past 7 Days', action: () => handleQuickPreset('7d') },
              { label: 'Past 14 Days', action: () => handleQuickPreset('custom', 14) },
              { label: 'Past 30 Days', action: () => handleQuickPreset('30d') },
              { label: 'This Month', action: () => handleQuickPreset('this_month') },
              { label: 'Last Month', action: () => handleQuickPreset('last_month') },
              { label: 'Past 90 Days', action: () => handleQuickPreset('90d') },
              { label: 'Past 180 Days', action: () => handleQuickPreset('custom', 180) },
              { label: 'This Year (YTD)', action: () => handleQuickPreset('year') },
              { label: 'All Time (Lifetime)', action: () => handleQuickPreset('all') },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 text-xs transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right Column: Interactive Tailored Calendar Grid */}
          <div className="flex-1 space-y-4">
            {/* Month & Year Navigation Bar */}
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-900 dark:text-white">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-zinc-400">
              {daysOfWeek.map(d => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Interactive Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 font-mono text-xs select-none">
              {calendarDays.map(item => {
                const isSelectedStart = isSameDay(item.date, rangeStart);
                const isSelectedEnd = isSameDay(item.date, rangeEnd);
                const isInRange = isDayInRange(item.date);
                const isCurrentDay = isSameDay(item.date, today);

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleDateClick(item.date)}
                    onMouseEnter={() => setHoverDate(item.date)}
                    className={clsx(
                      'h-9 rounded-xl flex items-center justify-center text-xs font-medium transition-all relative',
                      !item.isCurrentMonth && 'opacity-30',
                      isSelectedStart || isSelectedEnd
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md z-10'
                        : isInRange
                        ? 'bg-zinc-200/70 dark:bg-white/10 text-zinc-900 dark:text-white font-medium rounded-none'
                        : item.isCurrentMonth
                        ? 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
                        : 'text-zinc-400'
                    )}
                  >
                    <span>{item.date.getDate()}</span>
                    {isCurrentDay && !isSelectedStart && !isSelectedEnd && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-zinc-500 dark:bg-zinc-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Range Display Status */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#181818] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                <span className="font-bold text-zinc-900 dark:text-white">
                  {rangeStart ? rangeStart.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Start Date'}
                </span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
                <span className="font-bold text-zinc-900 dark:text-white">
                  {rangeEnd ? rangeEnd.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : (rangeStart ? 'Select End Date' : 'End Date')}
                </span>
              </div>

              {rangeStart && rangeEnd && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                  {Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))} Days
                </span>
              )}
            </div>

            {/* Action Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-white/[0.08] font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  onPresetChange('30d');
                  setIsOpen(false);
                }}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset (30D)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!rangeStart}
                  className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-zinc-950 font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Range</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
