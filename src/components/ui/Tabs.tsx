import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "../../lib/utils"

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface TabsProps {
  tabs?: TabItem[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  variant?: 'pills' | 'underline' | 'buttons';
  children?: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadixTabs = TabsPrimitive.Root
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-black/35 p-1 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08] font-sans",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3aa18]/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-zinc-950 dark:data-[state=active]:text-white data-[state=active]:shadow-sm cursor-pointer",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  children,
  defaultValue,
  value,
  onValueChange,
  ...props
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = React.useState<{
    canScrollLeft: boolean;
    canScrollRight: boolean;
  }>({ canScrollLeft: false, canScrollRight: false });

  const updateScrollState = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Only scrollable when content overflows width by more than 2px (e.g. mobile/small viewport)
    const isOverflowing = scrollWidth - clientWidth > 2;
    const canScrollLeft = isOverflowing && scrollLeft > 4;
    const canScrollRight = isOverflowing && (scrollWidth - clientWidth - scrollLeft) > 4;

    setScrollState(prev => {
      if (prev.canScrollLeft === canScrollLeft && prev.canScrollRight === canScrollRight) {
        return prev;
      }
      return { canScrollLeft, canScrollRight };
    });
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollState);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      ro?.disconnect();
    };
  }, [updateScrollState, tabs]);

  // Mask style: No gradient at all unless scrollable (e.g. mobile overflow)
  const maskStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!scrollState.canScrollLeft && !scrollState.canScrollRight) {
      return undefined; // Desktop / non-scrollable: completely crisp, zero gradient
    }
    if (scrollState.canScrollLeft && scrollState.canScrollRight) {
      return {
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 20px), transparent)',
        maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 20px), transparent)',
      };
    }
    if (scrollState.canScrollRight) {
      // Scrolled to start: left edge has NO gradient, right edge gently fades to hint scrollability
      return {
        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
        maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
      };
    }
    if (scrollState.canScrollLeft) {
      // Scrolled to end: left edge fades, right edge has NO gradient
      return {
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px)',
        maskImage: 'linear-gradient(to right, transparent, black 20px)',
      };
    }
    return undefined;
  }, [scrollState.canScrollLeft, scrollState.canScrollRight]);

  // If used as declarative Radix Tabs with children
  if (children) {
    return (
      <RadixTabs
        defaultValue={defaultValue}
        value={value || activeTab}
        onValueChange={onValueChange || onChange}
        className={className}
        {...props}
      >
        {children}
      </RadixTabs>
    );
  }

  // If used with tabs array
  if (tabs) {
    return (
      <div
        ref={containerRef}
        style={maskStyle}
        className={cn(
          "flex items-center gap-1 p-1 bg-zinc-100 dark:bg-black/35 border border-zinc-200 dark:border-white/[0.08] rounded-xl overflow-x-auto select-none no-scrollbar",
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange?.(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium font-sans transition-all cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-white dark:bg-white/15 text-zinc-950 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]"
              )}
            >
              {Icon && <Icon className={cn("w-3.5 h-3.5", isActive ? "text-zinc-950 dark:text-white" : "text-zinc-500")} />}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium",
                    isActive
                      ? "bg-zinc-900/10 dark:bg-white/20 text-zinc-950 dark:text-white font-semibold"
                      : "bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};

export { TabsList, TabsTrigger, TabsContent }
