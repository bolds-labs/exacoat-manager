import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

const accent = "bg-accent text-accent-on border-transparent font-semibold hover:opacity-90"
const quiet = "bg-field text-fg border-field-border font-[450] hover:bg-chip"
const danger = "bg-st-stop-bg text-st-stop-fg border-st-stop-border font-[450] hover:opacity-90"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center border font-sans whitespace-nowrap transition-colors outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 rounded-[9px]",
  {
    variants: {
      variant: {
        default: accent,
        primary: accent,
        lime: accent,
        light: quiet,
        bright: quiet,
        dark: quiet,
        destructive: danger,
        danger: danger,
        outline: "bg-transparent text-fg border-field-border font-[450] hover:bg-chip",
        secondary: quiet,
        ghost: "bg-transparent text-fg border-transparent font-[450] hover:bg-chip",
        glass: quiet,
        link: "text-accent-fg underline-offset-4 hover:underline border-transparent p-0 h-auto normal-case tracking-normal font-normal",
        success: "bg-st-done-bg text-st-done-fg border-st-done-border font-[450] hover:opacity-90",
      },
      size: {
        default: "h-9 px-[13px] text-[13px] rounded-[9px] gap-2",
        sm: "h-[30px] rounded-[8px] px-2.5 text-[12.5px] gap-1.5",
        md: "h-9 rounded-[9px] px-[13px] text-[13px] gap-2",
        lg: "h-10 rounded-[9px] px-5 text-sm gap-2.5",
        xs: "h-7 rounded-[8px] px-2 text-[12px] gap-1",
        icon: "h-9 w-9 rounded-[9px] p-0",
        "icon-sm": "h-[30px] w-[30px] rounded-[8px] p-0",
        "icon-lg": "h-10 w-10 rounded-[9px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
