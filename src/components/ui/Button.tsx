import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "group/button relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden border font-sans font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ease-out outline-none select-none cursor-pointer active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-[#f3aa18]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080808] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 rounded-xl",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,#f6b328_0%,#ea9c0f_100%)] text-[#08090b] font-bold border-[#d97706]/40 hover:bg-[linear-gradient(180deg,#f8ba3a_0%,#efa518_100%)] shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.12),0_3px_8px_rgba(243,170,24,0.22)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-16 before:h-[2px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-[#ffedd5]/80 before:to-transparent before:opacity-85 before:transition-all before:duration-300 before:ease-out hover:before:w-28 hover:before:via-[#fff7ed] hover:before:opacity-100",
        primary:
          "bg-[linear-gradient(180deg,#f6b328_0%,#ea9c0f_100%)] text-[#08090b] font-bold border-[#d97706]/40 hover:bg-[linear-gradient(180deg,#f8ba3a_0%,#efa518_100%)] shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.12),0_3px_8px_rgba(243,170,24,0.22)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-16 before:h-[2px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-[#ffedd5]/80 before:to-transparent before:opacity-85 before:transition-all before:duration-300 before:ease-out hover:before:w-28 hover:before:via-[#fff7ed] hover:before:opacity-100",
        lime:
          "bg-[linear-gradient(180deg,#f6b328_0%,#ea9c0f_100%)] text-[#08090b] font-bold border-[#d97706]/40 hover:bg-[linear-gradient(180deg,#f8ba3a_0%,#efa518_100%)] shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.12),0_3px_8px_rgba(243,170,24,0.22)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-16 before:h-[2px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-[#ffedd5]/80 before:to-transparent before:opacity-85 before:transition-all before:duration-300 before:ease-out hover:before:w-28 hover:before:via-[#fff7ed] hover:before:opacity-100",
        light:
          "bg-[linear-gradient(180deg,#ffffff_0%,#f4f4f5_100%)] text-[#08090b] font-semibold border-zinc-200 hover:bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.08)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-16 before:h-[2px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent before:opacity-90 before:transition-all before:duration-300 before:ease-out hover:before:w-28 hover:before:opacity-100",
        bright:
          "bg-[linear-gradient(180deg,#ffffff_0%,#f4f4f5_100%)] text-[#08090b] font-semibold border-zinc-200 hover:bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.08)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-16 before:h-[2px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent before:opacity-90 before:transition-all before:duration-300 before:ease-out hover:before:w-28 hover:before:opacity-100",
        dark:
          "bg-[#131417] text-white font-semibold border-white/10 hover:bg-[#1a1c21] hover:border-white/20 shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.3)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-14 before:h-[1.5px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:opacity-80 before:transition-all before:duration-300 before:ease-out hover:before:w-24 hover:before:via-white/40 hover:before:opacity-100",
        destructive:
          "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25 shadow-none font-semibold",
        danger:
          "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25 shadow-none font-semibold",
        outline:
          "border border-zinc-200 dark:border-white/[0.1] bg-transparent hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-zinc-900 dark:text-zinc-100 font-semibold",
        secondary:
          "bg-[#18181c] text-zinc-200 border-white/10 hover:bg-[#222228] hover:border-white/20 hover:text-white shadow-none font-semibold",
        ghost: "hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-semibold",
        glass: "bg-white/80 dark:bg-white/[0.055] hover:bg-white dark:hover:bg-white/[0.1] text-zinc-900 dark:text-white backdrop-blur-xl border border-zinc-200 dark:border-white/[0.1] shadow-sm font-semibold",
        link: "text-[#f3aa18] underline-offset-4 hover:underline border-transparent p-0 h-auto normal-case tracking-normal font-normal",
        success: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30 shadow-none font-semibold",
      },
      size: {
        default: "h-9 px-4 py-2 text-xs rounded-xl gap-2",
        sm: "h-8 rounded-lg px-3 text-[11px] gap-1.5",
        md: "h-9 rounded-xl px-3.5 text-xs gap-2",
        lg: "h-11 rounded-xl px-6 text-xs sm:text-sm gap-2.5",
        xs: "h-7 rounded-lg px-2.5 text-[10px] gap-1",
        icon: "h-9 w-9 rounded-xl p-0 normal-case tracking-normal",
        "icon-sm": "h-8 w-8 rounded-lg p-0 normal-case tracking-normal",
        "icon-lg": "h-11 w-11 rounded-xl p-0 normal-case tracking-normal",
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
