import React from 'react';
import { BurnLevel } from '../types';
import {
  BURN_LEVELS,
  MAX_BURN_LEVEL,
  MIN_BURN_LEVEL,
  toBurnLevel,
} from '../utils/burnLevel';

interface BurnLevelSliderProps {
  value: BurnLevel;
  onChange: (value: BurnLevel) => void;
  /** Must be unique per instance — several of these render at once in the log. */
  id: string;
  /** Optional help text under the control. */
  hint?: string;
}

/**
 * Thumb geometry is pinned rather than left to the browser default, because the
 * tick column centres below depend on knowing exactly how far the thumb travels.
 * w-4 = 1rem = 16px, which the track wrapper's padding math assumes.
 */
const THUMB_CLASSES = [
  '[&::-webkit-slider-thumb]:[-webkit-appearance:none]',
  '[&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:w-4',
  '[&::-webkit-slider-thumb]:h-4',
  '[&::-webkit-slider-thumb]:rounded-full',
  '[&::-webkit-slider-thumb]:border-2',
  '[&::-webkit-slider-thumb]:border-white',
  'dark:[&::-webkit-slider-thumb]:border-slate-900',
  '[&::-webkit-slider-thumb]:shadow-md',
  '[&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-moz-range-thumb]:w-4',
  '[&::-moz-range-thumb]:h-4',
  '[&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:border-2',
  '[&::-moz-range-thumb]:border-white',
  'dark:[&::-moz-range-thumb]:border-slate-900',
  '[&::-moz-range-thumb]:shadow-md',
  '[&::-moz-range-thumb]:cursor-pointer',
].join(' ');

/**
 * 0-4 burn severity slider with a labelled tick under each stop.
 */
export const BurnLevelSlider: React.FC<BurnLevelSliderProps> = ({
  value,
  onChange,
  id,
  hint,
}) => {
  const meta = BURN_LEVELS[toBurnLevel(value)];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer"
        >
          Burn Level
        </label>
        <span
          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold flex items-center gap-1.5 ${meta.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      {/*
        The ticks below live in a 5-column grid, so their centres sit at
        10% / 30% / 50% / 70% / 90%. Insetting the track by 10% and then
        widening it by one thumb (-ml-2 + 100%+1rem) makes the thumb's centre
        travel exactly 10% → 90%, so every stop lines up with its tick.
      */}
      <div className="px-[10%]">
        <input
          id={id}
          type="range"
          min={MIN_BURN_LEVEL}
          max={MAX_BURN_LEVEL}
          step={1}
          value={value}
          onChange={(e) => onChange(toBurnLevel(parseInt(e.target.value, 10)))}
          aria-valuetext={`${value} — ${meta.label}`}
          className={`w-[calc(100%+1rem)] -ml-2 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none outline-none ${THUMB_CLASSES} ${meta.thumb}`}
        />
      </div>

      <div className="grid grid-cols-5" aria-hidden="true">
        {BURN_LEVELS.map((lvl) => {
          const isCurrent = lvl.value === value;
          return (
            <div key={lvl.value} className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={`w-px h-1.5 rounded-full ${
                  isCurrent ? lvl.dot : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
              <span
                className={`text-[9px] font-mono leading-none ${
                  isCurrent ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-400'
                }`}
              >
                {lvl.value}
              </span>
              <span
                className={`text-[8px] leading-tight text-center ${
                  isCurrent
                    ? 'font-semibold text-slate-600 dark:text-slate-300'
                    : 'text-slate-400'
                }`}
              >
                {lvl.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        {hint ?? meta.blurb}
      </p>
    </div>
  );
};
