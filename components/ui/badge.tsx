
import React from "react"
import { cn } from "../../lib/utils"

// Added explicit className property to fix TypeScript errors when extending React.HTMLAttributes
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 border-transparent",
        variant === "default" && "bg-white text-black hover:bg-white/80",
        variant === "secondary" && "bg-zinc-800 text-zinc-100 hover:bg-zinc-800/80",
        variant === "destructive" && "bg-red-500 text-zinc-50 hover:bg-red-500/80",
        variant === "outline" && "text-zinc-50 border-zinc-800",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
