import React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 md:h-12 w-full rounded-2xl border border-moonlight/10 bg-midnight/60 px-4 py-2 text-xs md:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-moonlight/25 focus-visible:outline-none focus-visible:border-eclipse focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 text-moonlight transition-colors duration-200",
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