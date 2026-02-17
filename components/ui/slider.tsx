import React from "react"
import { cn } from "../../lib/utils"

interface SliderProps {
  value: number[];
  onValueChange: (val: number[]) => void;
  max?: number;
  step?: number;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({ 
  value, 
  onValueChange, 
  max = 100, 
  step = 1,
  className 
}) => {
  const val = value[0] || 0;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([parseFloat(e.target.value)]);
  };

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
      <input 
        type="range" 
        min={0} 
        max={max} 
        step={step}
        value={val} 
        onChange={handleChange}
        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
      />
    </div>
  )
}