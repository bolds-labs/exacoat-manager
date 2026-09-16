import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { HelpCircle } from "lucide-react"
import { cn } from "../../lib/utils"

export type TooltipPosition = 
  | 'top' 
  | 'top-start' 
  | 'top-end' 
  | 'bottom' 
  | 'bottom-start' 
  | 'bottom-end' 
  | 'left' 
  | 'right';

export interface TooltipProps {
  content?: React.ReactNode;
  children?: React.ReactNode;
  position?: TooltipPosition | string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  panelClassName?: string;
  arrow?: boolean;
  delay?: number;
  interactive?: boolean;
}

const TooltipProvider = TooltipPrimitive.Provider
const RadixTooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-50 shadow-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 font-sans max-w-xs leading-relaxed",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  align = 'center',
  className,
  panelClassName,
  delay = 150,
}) => {
  let side: 'top' | 'bottom' | 'left' | 'right' = 'top';
  let sideAlign: 'start' | 'center' | 'end' = align;

  if (typeof position === 'string') {
    if (position.startsWith('bottom')) side = 'bottom';
    else if (position.startsWith('left')) side = 'left';
    else if (position.startsWith('right')) side = 'right';
    else side = 'top';

    if (position.endsWith('start')) sideAlign = 'start';
    else if (position.endsWith('end')) sideAlign = 'end';
  }

  if (!content) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={delay}>
      <RadixTooltip>
        <TooltipTrigger asChild>
          {children ? (
            <span className={cn("inline-flex items-center cursor-help", className)}>
              {children}
            </span>
          ) : (
            <button
              type="button"
              className={cn("text-zinc-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer", className)}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side={side} align={sideAlign} className={panelClassName}>
          {content}
        </TooltipContent>
      </RadixTooltip>
    </TooltipProvider>
  );
};

export { TooltipProvider, TooltipTrigger, TooltipContent }
