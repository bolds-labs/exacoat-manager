import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full resize-y rounded-xl border border-zinc-200 dark:border-white/[0.09] bg-white/90 dark:bg-black/25 px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]/70 focus:ring-2 focus:ring-[#f3aa18]/10 disabled:cursor-not-allowed disabled:opacity-50 font-sans text-zinc-900 dark:text-zinc-100 shadow-sm transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
