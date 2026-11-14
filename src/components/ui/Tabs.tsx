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
      "inline-flex h-9 items-center justify-center gap-1 rounded-[10px] bg-field p-[3px] text-muted border border-field-border font-sans",
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
      "inline-flex items-center justify-center whitespace-nowrap rounded-[8px] border border-transparent px-[11px] py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 hover:text-fg data-[state=active]:bg-chip data-[state=active]:border-card-border data-[state=active]:text-fg cursor-pointer",
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
          "flex items-center gap-1 p-[3px] bg-field border border-field-border rounded-[10px] overflow-x-auto select-none no-scrollbar",
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
                "flex items-center gap-1.5 px-[11px] py-1.5 rounded-[8px] border text-[13px] font-sans transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isActive
                  ? "border-card-border bg-chip text-fg"
                  : "border-transparent text-muted hover:text-fg"
              )}
            >
              {Icon && <Icon className={cn("w-3.5 h-3.5", isActive ? "text-fg" : "text-faint")} />}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "px-1.5 py-px rounded-full text-[11.5px] font-medium tabular-nums",
                    isActive
                      ? "bg-card text-fg"
                      : "bg-chip text-muted"
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
