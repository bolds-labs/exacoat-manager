import React from "react";
import { cn } from "../../lib/utils";

export interface SectionPillProps {
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  dotColor?: string;
  surface?: "dark" | "light" | "auto";
}

export function SectionPill({
  children,
  dot = false,
  className = "",
  dotColor,
  surface = "auto",
}: SectionPillProps) {
  return (
    <div
      className={cn(
        "inline-flex h-6 select-none items-center justify-center gap-2 rounded-full border px-3 font-sans text-[10px] font-medium tracking-wider uppercase shadow-xs transition-colors",
        surface === "light"
          ? "border-black/10 bg-white/80 text-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          : surface === "dark"
          ? "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]"
          : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300",
        className
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor ?? "bg-zinc-400 dark:bg-zinc-500")}
          aria-hidden="true"
        />
      )}
      <span className="inline-flex h-full items-center leading-none">{children}</span>
    </div>
  );
}

export default SectionPill;
