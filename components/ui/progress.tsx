import React from "react"
import { cn } from "../../lib/utils"

interface ProgressProps {
  value: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, className }) => {
  return (
    <div className={cn("relative h-4 w-full overflow-hidden rounded-full bg-zinc-800", className)}>
      <div
        className="h-full w-full flex-1 bg-white transition-all duration-500 ease-in-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  )
}