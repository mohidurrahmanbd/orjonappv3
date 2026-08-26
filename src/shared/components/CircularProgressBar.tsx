import React from 'react';

interface CircularProgressBarProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  textSizeClass?: string;
  className?: string;
  isBengaliText?: boolean;
  title?: string;
}

const toBengaliDigits = (num: number | string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (d) => bengaliDigits[parseInt(d, 10)]);
};

export default function CircularProgressBar({
  percentage = 0,
  size = 32,
  strokeWidth = 3,
  showText = true,
  textSizeClass,
  className = '',
  isBengaliText = true,
  title
}: CircularProgressBarProps) {
  const safePercentage = Math.min(100, Math.max(0, Math.round(percentage || 0)));
  const radius = Math.max(1, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  const isComplete = safePercentage >= 100;
  const strokeColor = isComplete
    ? '#10b981' // emerald-500
    : safePercentage > 0
      ? '#4f46e5' // indigo-600
      : '#cbd5e1'; // slate-300

  const textColor = isComplete
    ? 'text-emerald-700'
    : safePercentage > 0
      ? 'text-indigo-700'
      : 'text-slate-500';

  const defaultTextSize = size <= 24 
    ? 'text-[7.5px]' 
    : size <= 32 
      ? 'text-[8.5px]' 
      : size <= 40 
        ? 'text-[10.5px]' 
        : 'text-xs';

  const displayText = isBengaliText ? `${toBengaliDigits(safePercentage)}%` : `${safePercentage}%`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      title={title || `MCQ পড়ার অগ্রগতি: ${toBengaliDigits(safePercentage)}% সম্পন্ন`}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 block"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={safePercentage > 0 ? '#e0e7ff' : '#f1f5f9'}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Percentage Text Inside the Circle */}
      {showText && (
        <span
          className={`absolute inset-0 flex items-center justify-center font-black leading-none tracking-tighter ${textSizeClass || defaultTextSize} ${textColor}`}
        >
          {displayText}
        </span>
      )}
    </div>
  );
}
