import React from 'react';
import { parseTimeToDecimal } from '../utils/uvCalculator';

interface UvChartProps {
  forecastUvi: number[];
  startTime: string;
  endTime: string;
  locationName: string;
}

export const UvChart: React.FC<UvChartProps> = ({
  forecastUvi,
  startTime,
  endTime,
  locationName,
}) => {
  const startHour = parseTimeToDecimal(startTime);
  const endHour = parseTimeToDecimal(endTime);

  // SVG Size Definitions
  const width = 600;
  const height = 240;
  const paddingXLeft = 40;
  const paddingXRight = 40;
  const paddingYTop = 30;
  const paddingYBottom = 30;

  const chartWidth = width - paddingXLeft - paddingXRight;
  const chartHeight = height - paddingYTop - paddingYBottom;

  const maxUvi = Math.max(12, ...forecastUvi);

  // Coordinate Mapping Helpers
  const getX = (hour: number) => {
    return paddingXLeft + (hour / 24) * chartWidth;
  };

  const getY = (uvi: number) => {
    const val = isNaN(uvi) ? 0 : uvi;
    return paddingYBottom + chartHeight - (val / maxUvi) * chartHeight;
  };

  const getUviAt = (t: number): number => {
    if (t <= 0) return forecastUvi[0] || 0;
    if (t >= 24) return 0;
    const h0 = Math.floor(t);
    const h1 = h0 + 1;
    const val0 = forecastUvi[h0] || 0;
    const val1 = h1 >= 24 ? 0 : forecastUvi[h1] || 0;
    const frac = t - h0;
    return val0 * (1 - frac) + val1 * frac;
  };

  // 1. Compute Full Curve Path
  let uviCurveD = `M ${getX(0)} ${getY(forecastUvi[0] || 0)}`;
  for (let h = 1; h <= 24; h++) {
    const uviVal = h === 24 ? 0 : forecastUvi[h] || 0;
    uviCurveD += ` L ${getX(h)} ${getY(uviVal)}`;
  }

  // 2. Compute Integrated Highlight Polyline/Polygon Points
  const highlightPoints: { x: number; y: number }[] = [];

  if (startHour < endHour && forecastUvi.length > 0) {
    // Start on the floor (Y-bottom) at startHour
    highlightPoints.push({ x: getX(startHour), y: getY(0) });
    // Point on the UV curve at startHour
    highlightPoints.push({ x: getX(startHour), y: getY(getUviAt(startHour)) });

    // Node hours nested between start and end hours
    const firstIntHour = Math.ceil(startHour);
    const lastIntHour = Math.floor(endHour);

    for (let h = firstIntHour; h <= lastIntHour; h++) {
      if (h > startHour && h < endHour) {
        const uviAtInt = h === 24 ? 0 : forecastUvi[h] || 0;
        highlightPoints.push({ x: getX(h), y: getY(uviAtInt) });
      }
    }

    // Point on curve at endHour
    highlightPoints.push({ x: getX(endHour), y: getY(getUviAt(endHour)) });
    // End on the floor (Y-bottom) at endHour
    highlightPoints.push({ x: getX(endHour), y: getY(0) });
  }

  // Convert highlight points to polygon points string
  const highlightPointsStr = highlightPoints
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  // Standard UV Gridlines levels: 3, 6, 8, 11
  const gridLevels = [3, 6, 8, 11];

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
      <div className="flex flex-wrap items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            UV Index Curve & Integration Region
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Hourly profile for <span className="text-amber-400 font-medium">{locationName}</span>. Integrates time interval {startTime} - {endTime}.
          </p>
        </div>
        <div className="flex items-center space-x-4 text-xs mt-2 sm:mt-0">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 bg-gradient-to-t from-amber-500/10 to-amber-500/40 border border-amber-400 rounded-sm inline-block"></span>
            <span className="text-slate-300">Exposure Window</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block"></span>
            <span className="text-slate-300">UV Index Curve</span>
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full overflow-x-auto min-w-[500px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto text-slate-400 select-none overflow-visible"
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="uvHighlightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {gridLevels.map((lvl) => {
            if (lvl > maxUvi) return null;
            const uvY = getY(lvl);
            return (
              <g key={lvl} className="opacity-40">
                <line
                  x1={paddingXLeft}
                  y1={uvY}
                  x2={width - paddingXRight}
                  y2={uvY}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingXLeft - 8}
                  y={uvY + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {lvl}
                </text>
              </g>
            );
          })}

          {/* Baseline Y-0 */}
          <line
            x1={paddingXLeft}
            y1={getY(0)}
            x2={width - paddingXRight}
            y2={getY(0)}
            stroke="#1e293b"
            strokeWidth="2"
          />

          {/* Hour Tick Markers & Labels */}
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
            const hX = getX(h);
            const label =
              h === 0
                ? '12am'
                : h === 12
                ? '12pm'
                : h === 24
                ? '12am'
                : h > 12
                ? `${h - 12}pm`
                : `${h}am`;
            return (
              <g key={h} className="opacity-90">
                <line
                  x1={hX}
                  y1={getY(0)}
                  x2={hX}
                  y2={getY(0) + 4}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={hX}
                  y={getY(0) + 16}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Shaded Area under Curve (INTEGRAL) */}
          {highlightPoints.length > 0 && (
            <polygon
              points={highlightPointsStr}
              fill="url(#uvHighlightGradient)"
              stroke="#f59e0b"
              strokeWidth="1.5"
              className="transition-all duration-300"
            />
          )}

          {/* UV Curve Line */}
          <path
            d={uviCurveD}
            fill="none"
            stroke="url(#curveGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_2px_8px_rgba(239,68,68,0.3)]"
          />

          {/* Interactive or Marker Lines for Start & End Hours */}
          {startHour < endHour && (
            <>
              {/* Start Time Marker */}
              <g className="cursor-default">
                <line
                  x1={getX(startHour)}
                  y1={getY(0)}
                  x2={getX(startHour)}
                  y2={getY(getUviAt(startHour)) - 8}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={getX(startHour)}
                  cy={getY(getUviAt(startHour))}
                  r="4"
                  fill="#fbbf24"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                <rect
                  x={getX(startHour) - 25}
                  y={getY(getUviAt(startHour)) - 25}
                  width="50"
                  height="14"
                  rx="3"
                  fill="#1e293b"
                  stroke="#fbbf24"
                  strokeWidth="1"
                />
                <text
                  x={getX(startHour)}
                  y={getY(getUviAt(startHour)) - 15}
                  textAnchor="middle"
                  className="fill-amber-400 text-[8px] font-mono font-bold"
                >
                  Start: {startTime}
                </text>
              </g>

              {/* End Time Marker */}
              <g className="cursor-default">
                <line
                  x1={getX(endHour)}
                  y1={getY(0)}
                  x2={getX(endHour)}
                  y2={getY(getUviAt(endHour)) - 8}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={getX(endHour)}
                  cy={getY(getUviAt(endHour))}
                  r="4"
                  fill="#fbbf24"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                <rect
                  x={getX(endHour) - 25}
                  y={getY(getUviAt(endHour)) - 25}
                  width="50"
                  height="14"
                  rx="3"
                  fill="#1e293b"
                  stroke="#fbbf24"
                  strokeWidth="1"
                />
                <text
                  x={getX(endHour)}
                  y={getY(getUviAt(endHour)) - 15}
                  textAnchor="middle"
                  className="fill-amber-400 text-[8px] font-mono font-bold"
                >
                  End: {endTime}
                </text>
              </g>
            </>
          )}
        </svg>
      </div>

      {/* Threshold indicator keys */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 border-t border-slate-800/60 pt-3 text-[10px] text-slate-400">
        <span className="font-medium text-slate-500 uppercase tracking-wider mr-1">Risk Levels:</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 0-2 Low
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 3-5 Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 6-7 High
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> 8-10 Very High
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> 11+ Extreme
        </span>
      </div>
    </div>
  );
};
