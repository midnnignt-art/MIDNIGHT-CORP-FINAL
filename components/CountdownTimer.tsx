import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date();
      let timeLeft = {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };

      if (difference > 0) {
        timeLeft = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        };
      }

      return timeLeft;
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="flex gap-4 md:gap-8 justify-center items-center">
      <TimeUnit value={formatNumber(timeLeft.days)} label="DAYS" />
      <span className="text-2xl md:text-4xl font-black text-moonlight/30 mb-6">:</span>
      <TimeUnit value={formatNumber(timeLeft.hours)} label="HOURS" />
      <span className="text-2xl md:text-4xl font-black text-moonlight/30 mb-6">:</span>
      <TimeUnit value={formatNumber(timeLeft.minutes)} label="MINS" />
      <span className="text-2xl md:text-4xl font-black text-moonlight/30 mb-6">:</span>
      <TimeUnit value={formatNumber(timeLeft.seconds)} label="SECS" />
    </div>
  );
};

const TimeUnit: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <span className="text-4xl md:text-7xl font-black tracking-tighter text-moonlight tabular-nums">
      {value}
    </span>
    <span className="text-[8px] md:text-[10px] font-light tracking-[0.3em] text-moonlight/50 mt-2">
      {label}
    </span>
  </div>
);