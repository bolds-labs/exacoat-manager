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
            <label className="block text-[12px] text-faint">
              {label}
            </label>
          )}
          <div className="relative flex items-center">
            {leftIcon && (
              <div className="absolute left-3 text-faint pointer-events-none flex items-center">
                {leftIcon}
              </div>
            )}
            <input
              type={type}
              className={cn(
                "flex h-9 w-full rounded-[9px] border border-field-border bg-field px-3 py-2 text-[13.5px] text-fg placeholder:text-faint focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors font-sans",
                leftIcon && "pl-10",
                rightElement && "pr-10",
                error && "border-st-stop-fg focus:border-st-stop-fg",
                className
              )}
              ref={ref}
              {...props}
            />
            {rightElement && (
              <div className="absolute right-3 flex items-center">{rightElement}</div>
            )}
          </div>
          {error && <p className="text-xs text-st-stop-fg">{error}</p>}
          {helperText && !error && <p className="text-xs text-faint leading-relaxed">{helperText}</p>}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[9px] border border-field-border bg-field px-3 py-2 text-[13.5px] text-fg placeholder:text-faint focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors font-sans",
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
