import React from 'react';
import { FITZPATRICK_TYPES } from '../utils/uvCalculator';
import { FitzpatrickType } from '../types';

interface FitzpatrickSelectorProps {
  selectedType: number;
  onChange: (typeNum: number) => void;
}

export const FitzpatrickSelector: React.FC<FitzpatrickSelectorProps> = ({
  selectedType,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Your Fitzpatrick Skin Type
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Understanding your skin type lets us calibrate the custom Ultraviolet radiation dose relative to your skin's unique Minimum Erythemal Dose (MED) sunburn threshold.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {FITZPATRICK_TYPES.map((ft: FitzpatrickType) => {
          const isSelected = ft.type === selectedType;
          return (
            <button
              key={ft.type}
              type="button"
              onClick={() => onChange(ft.type)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-250 flex flex-col justify-between h-full group outline-none cursor-pointer ${
                isSelected
                  ? 'border-amber-500 ring-2 ring-amber-500/10 dark:ring-amber-500/30'
                  : 'border-slate-100 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
              }`}
            >
              <div className="space-y-2 w-full">
                {/* Header with Type badge and Skin Color swatch */}
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                      isSelected
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ft.name}
                  </span>
                  
                  {/* Swatch color representation */}
                  <span
                    style={{ backgroundColor: ft.skinColor }}
                    className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shadow-sm shrink-0"
                    title={`Skin tone representation of ${ft.name}`}
                  />
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  {ft.description}
                </p>
              </div>

              {/* MED details footer of the card */}
              <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 w-full flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Sunburn limit (MED):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {ft.medInSed.toFixed(1)} SED
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
