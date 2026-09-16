import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, leftIcon, rightElement, ...props }, ref) => {
    if (label || error || helperText || leftIcon || rightElement) {
      return (
        <div className="w-full space-y-1.5 font-sans">
          {label && (
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {label}
            </label>
          )}
          <div className="relative flex items-center">
            {leftIcon && (
              <div className="absolute left-3 text-zinc-500 pointer-events-none flex items-center">
                {leftIcon}
              </div>
            )}
            <input
              type={type}
              className={cn(
                "flex h-10 w-full rounded-xl border border-zinc-200 dark:border-white/[0.09] bg-white/90 dark:bg-black/25 px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]/70 focus:ring-2 focus:ring-[#f3aa18]/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-sans shadow-sm",
                leftIcon && "pl-10",
                rightElement && "pr-10",
                error && "border-rose-500/80 focus:border-rose-500",
                className
              )}
              ref={ref}
              {...props}
            />
            {rightElement && (
              <div className="absolute right-3 flex items-center">{rightElement}</div>
            )}
          </div>
          {error && <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
          {helperText && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{helperText}</p>}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-zinc-200 dark:border-white/[0.09] bg-white/90 dark:bg-black/25 px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]/70 focus:ring-2 focus:ring-[#f3aa18]/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-sans shadow-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
