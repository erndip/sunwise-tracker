import { BurnLevel } from '../types';

export interface BurnLevelMeta {
  value: BurnLevel;
  label: string;
  /** Longer description, used as help text / tooltips. */
  blurb: string;
  /** Pill styling. Written out in full because Tailwind only sees literal class strings. */
  badge: string;
  /** Solid swatch for the leading dot and the active tick mark. */
  dot: string;
  /** Slider thumb fill, so the handle takes on the severity colour. */
  thumb: string;
}

/**
 * The burn scale, deliberately sharing the emerald → amber → orange → rose →
 * violet ramp that getUviColor() uses for the UV index, so a "severe" burn and
 * an "extreme" UV reading look related rather than like two unrelated scales.
 */
export const BURN_LEVELS: readonly BurnLevelMeta[] = [
  {
    value: 0,
    label: 'No burn',
    blurb: 'No redness at all.',
    badge:
      'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    thumb:
      '[&::-webkit-slider-thumb]:bg-emerald-500 [&::-moz-range-thumb]:bg-emerald-500',
  },
  {
    value: 1,
    label: 'Painless',
    blurb: 'Faint colour, no discomfort.',
    badge:
      'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    thumb:
      '[&::-webkit-slider-thumb]:bg-amber-500 [&::-moz-range-thumb]:bg-amber-500',
  },
  {
    value: 2,
    label: 'Mild',
    blurb: 'Pink, slightly tender to the touch.',
    badge:
      'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 text-orange-800 dark:text-orange-300',
    dot: 'bg-orange-500',
    thumb:
      '[&::-webkit-slider-thumb]:bg-orange-500 [&::-moz-range-thumb]:bg-orange-500',
  },
  {
    value: 3,
    label: 'Moderate',
    blurb: 'Clearly red and sore, warm to the touch.',
    badge:
      'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300',
    dot: 'bg-rose-500',
    thumb:
      '[&::-webkit-slider-thumb]:bg-rose-500 [&::-moz-range-thumb]:bg-rose-500',
  },
  {
    value: 4,
    label: 'Severe',
    blurb: 'Painful, possibly blistering or peeling.',
    badge:
      'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/40 text-violet-800 dark:text-violet-300',
    dot: 'bg-violet-500',
    thumb:
      '[&::-webkit-slider-thumb]:bg-violet-500 [&::-moz-range-thumb]:bg-violet-500',
  },
] as const;

export const MIN_BURN_LEVEL = 0;
export const MAX_BURN_LEVEL = 4;

/** Coerces arbitrary numeric input (slider values, stored data) into the 0-4 range. */
export function toBurnLevel(value: number): BurnLevel {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return Math.max(MIN_BURN_LEVEL, Math.min(MAX_BURN_LEVEL, rounded)) as BurnLevel;
}

/**
 * Metadata for a stored burn level, or null when the session predates burn
 * tracking. Note the explicit undefined check — level 0 is falsy but valid.
 */
export function getBurnLevelMeta(level: BurnLevel | undefined): BurnLevelMeta | null {
  if (level === undefined) return null;
  return BURN_LEVELS[toBurnLevel(level)] ?? null;
}
