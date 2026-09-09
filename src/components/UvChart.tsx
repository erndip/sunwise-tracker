import React, { useRef, useState } from 'react';
import { parseTimeToDecimal, getUviColor, timeToMinutes, minutesToTime } from '../utils/uvCalculator';

interface UvChartProps {
  forecastUvi: number[];
  startTime: string;
  endTime: string;
  locationName: string;
  /** Omit to render a static, non-interactive chart. */
  onWindowChange?: (startTime: string, endTime: string) => void;
}

/** Which part of the exposure window a pointer/keyboard gesture is moving. */
type DragMode = 'start' | 'end' | 'band';

// Drag quantisation. Dragging lands on 5-minute steps; the time inputs beneath
// the chart stay free to name any minute of the day.
const SNAP_MIN = 5;
const MIN_WINDOW_MIN = 5;
const MAX_MIN = 1435; // 23:55, same ceiling minutesToTime() enforces

const snapMinutes = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN;
const clamp = (m: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, m));

export const UvChart: React.FC<UvChartProps> = ({
  forecastUvi,
  startTime,
  endTime,
  locationName,
  onWindowChange,
}) => {
  const startHour = parseTimeToDecimal(startTime);
  const endHour = parseTimeToDecimal(endTime);

  const svgRef = useRef<SVGSVGElement>(null);
  // Live gesture bookkeeping. The offset keeps the grabbed edge under the cursor
  // instead of snapping its centre to the pointer on mousedown.
  const dragRef = useRef<{ mode: DragMode; grabOffsetMin: number } | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragMode | null>(null);

  const interactive = Boolean(onWindowChange);

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

  // Marker label geometry. The box has to fit "Start: 00:00" at the font size used
  // below: a mono glyph advances ~0.6em, so 12 chars need ~79px at 11px — the width
  // here leaves a few px of padding inside the border rather than clipping the text.
  const labelWidth = 88;
  const labelHeight = 20;
  const labelGap = 11; // clearance between the marker dot and the label's lower edge

  // When the Start/End markers sit close together horizontally, their labels
  // can still collide vertically — but only if their UV indices put the two
  // dots close together too. The marker at the higher UV index already sits
  // nearer the top of the chart, so it's the one that gets lifted clear; how
  // far depends on how much of a vertical gap the dots already give for free —
  // a 4px buffer at the same UV index, shrinking to 0 once the dots' own
  // separation is enough on its own to keep the label boxes apart.
  const labelsClose = startHour < endHour && getX(endHour) - getX(startHour) < labelWidth;
  const startDotY = getY(getUviAt(startHour));
  const endDotY = getY(getUviAt(endHour));
  const maxLabelLift = labelsClose
    ? Math.max(0, labelHeight + 4 - Math.abs(startDotY - endDotY))
    : 0;
  const startHigher = startDotY <= endDotY; // smaller y = higher UV = higher on the chart
  const startLabelLift = startHigher ? maxLabelLift : 0;
  const endLabelLift = startHigher ? 0 : maxLabelLift;

  // --- Drag plumbing -------------------------------------------------------

  /**
   * Maps a client-space pointer position to minutes of the day.
   * Goes through the screen CTM rather than assuming a pixel ratio, so it stays
   * correct however the responsive viewBox happens to be scaled. Inverse of getX().
   */
  const clientToMinutes = (clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return ((pt.x - paddingXLeft) / chartWidth) * 24 * 60;
  };

  /**
   * Applies a proposed raw minute value for the given edge, snapping it and
   * clamping so the window can never invert or run off the day. Edges clamp
   * against each other rather than swapping, which keeps overshoot predictable.
   */
  const commitDrag = (mode: DragMode, rawMinutes: number) => {
    if (!onWindowChange) return;

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    const snapped = snapMinutes(rawMinutes);

    if (mode === 'start') {
      const next = clamp(snapped, 0, endMin - MIN_WINDOW_MIN);
      if (next !== startMin) onWindowChange(minutesToTime(next), endTime);
      return;
    }

    if (mode === 'end') {
      const next = clamp(snapped, startMin + MIN_WINDOW_MIN, MAX_MIN);
      if (next !== endMin) onWindowChange(startTime, minutesToTime(next));
      return;
    }

    // Band: slide the whole window, preserving its duration.
    const duration = endMin - startMin;
    const nextStart = clamp(snapped, 0, MAX_MIN - duration);
    if (nextStart !== startMin) {
      onWindowChange(minutesToTime(nextStart), minutesToTime(nextStart + duration));
    }
  };

  const handlePointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!interactive) return;
    const pointerMin = clientToMinutes(e.clientX, e.clientY);
    if (pointerMin === null) return;

    e.preventDefault();
    const anchorMin =
      mode === 'end' ? timeToMinutes(endTime) : timeToMinutes(startTime);

    dragRef.current = { mode, grabOffsetMin: pointerMin - anchorMin };
    setActiveDrag(mode);
    // preventDefault above suppresses the implicit focus, so move it explicitly:
    // clicking a marker should leave it arrow-key adjustable.
    if (mode !== 'band') {
      (e.currentTarget as SVGGElement).focus?.({ preventScroll: true });
    }
    // Capture on the SVG root, not the handle: the handle slides out from under
    // the cursor mid-drag, and capture here also keeps the gesture alive when
    // the pointer leaves the chart entirely.
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pointerMin = clientToMinutes(e.clientX, e.clientY);
    if (pointerMin === null) return;
    commitDrag(drag.mode, pointerMin - drag.grabOffsetMin);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setActiveDrag(null);
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
  };

  /** Arrow keys nudge by one snap step, Shift by an hour, Home/End to the bounds. */
  const handleKeyDown = (mode: DragMode) => (e: React.KeyboardEvent) => {
    if (!onWindowChange) return;

    const current = mode === 'end' ? timeToMinutes(endTime) : timeToMinutes(startTime);
    const step = e.shiftKey ? 60 : SNAP_MIN;
    let next: number | null = null;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = MAX_MIN;
        break;
      default:
        return;
    }

    e.preventDefault();
    commitDrag(mode, next);
  };

  // Standard UV Gridlines levels: 3, 6, 8, 11
  const gridLevels = [3, 6, 8, 11];

  // Geometry shared by both draggable edges.
  const grabWidth = 24;
  const markers: {
    mode: 'start' | 'end';
    hour: number;
    label: string;
    time: string;
    lift: number;
  }[] = [
    { mode: 'start', hour: startHour, label: 'Start', time: startTime, lift: startLabelLift },
    { mode: 'end', hour: endHour, label: 'End', time: endTime, lift: endLabelLift },
  ];

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-inner">
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

      {interactive && (
        <p className="text-[10px] text-slate-500 mb-2 sm:mb-1">
          Drag the <span className="text-amber-400 font-medium">Start</span> and{' '}
          <span className="text-amber-400 font-medium">End</span> markers to reshape the window, or drag the shaded region to shift it.
        </p>
      )}

      {/* SVG Container — scales down to fit narrow screens via the viewBox */}
      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto text-slate-400 select-none overflow-visible"
          // pan-y lets the page still scroll vertically over the chart while
          // reserving horizontal gestures for dragging. The markers below
          // narrow this to `none`; effective touch-action is the intersection
          // down the ancestor chain, so this also acts as the fallback for
          // engines that ignore touch-action on inner SVG elements.
          style={interactive ? { touchAction: 'pan-y' } : undefined}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
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

          {/* Shaded Area under Curve (INTEGRAL) — also the grab target that
              slides the whole window. The ease is dropped mid-drag so the shape
              tracks the pointer instead of lagging 300ms behind it. */}
          {highlightPoints.length > 0 && (
            <polygon
              points={highlightPointsStr}
              fill="url(#uvHighlightGradient)"
              stroke="#f59e0b"
              strokeWidth="1.5"
              className={`${activeDrag ? '' : 'transition-all duration-300'} ${
                interactive
                  ? activeDrag === 'band'
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : ''
              }`}
              onPointerDown={interactive ? handlePointerDown('band') : undefined}
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
            className="drop-shadow-[0_2px_8px_rgba(239,68,68,0.3)] pointer-events-none"
          />

          {/* Start & End markers. Rendered after the band so their grab targets
              win wherever the two overlap. Kept mounted even when the window is
              inverted (start >= end) so a bad value typed in the panel can still
              be dragged back into range. */}
          {(interactive || startHour < endHour) &&
            markers.map(({ mode, hour, label, time, lift }) => {
              const uviHere = getUviAt(hour);
              const x = getX(hour);
              const y = getY(uviHere);
              const isActive = activeDrag === mode;
              const minutes = timeToMinutes(time);
              // Advertise the range this edge can actually reach, not the whole day.
              const ariaMin =
                mode === 'end' ? timeToMinutes(startTime) + MIN_WINDOW_MIN : 0;
              const ariaMax =
                mode === 'end' ? MAX_MIN : timeToMinutes(endTime) - MIN_WINDOW_MIN;
              // Keep the label inside the chart when the marker rides the top of the
              // curve. The un-lifted label reserves the active lift as headroom, so
              // the two stay that far apart even once both have been clamped.
              const labelTop = Math.max(
                2 + maxLabelLift - lift,
                y - labelGap - labelHeight - lift
              );

              return (
                <g
                  key={mode}
                  className={interactive ? 'cursor-ew-resize focus:outline-none' : 'cursor-default'}
                  style={interactive ? { touchAction: 'none' } : undefined}
                  onPointerDown={interactive ? handlePointerDown(mode) : undefined}
                  onKeyDown={interactive ? handleKeyDown(mode) : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? 'slider' : undefined}
                  aria-label={interactive ? `${label} time` : undefined}
                  aria-valuemin={interactive ? ariaMin : undefined}
                  aria-valuemax={interactive ? ariaMax : undefined}
                  aria-valuenow={interactive ? minutes : undefined}
                  aria-valuetext={interactive ? time : undefined}
                >
                  <line
                    x1={x}
                    y1={getY(0)}
                    x2={x}
                    y2={y - 8}
                    stroke="#fbbf24"
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeDasharray="2 2"
                    className="pointer-events-none"
                  />
                  {/* Halo ring while dragging, for a clear "you have this" cue */}
                  {isActive && (
                    <circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                      opacity="0.5"
                      className="pointer-events-none"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 6 : 4}
                    fill={getUviColor(uviHere)}
                    stroke={isActive ? '#fbbf24' : '#1e293b'}
                    strokeWidth="1.5"
                    className="pointer-events-none"
                  />
                  <rect
                    x={x - labelWidth / 2}
                    y={labelTop}
                    width={labelWidth}
                    height={labelHeight}
                    rx="4"
                    fill="#1e293b"
                    stroke="#fbbf24"
                    strokeWidth="1"
                    className="pointer-events-none"
                  />
                  <text
                    x={x}
                    y={labelTop + 14}
                    textAnchor="middle"
                    className="fill-amber-400 text-[11px] font-mono font-bold pointer-events-none"
                  >
                    {label}: {time}
                  </text>
                  {/* Invisible grab target spanning the dashed line and its label, so
                      the whole marker is draggable rather than just the 4px dot. */}
                  {interactive && (
                    <rect
                      x={x - grabWidth / 2}
                      y={Math.min(y, getY(0) - 1, labelTop - 1)}
                      width={grabWidth}
                      height={Math.max(y, getY(0)) - Math.min(y, getY(0) - 1, labelTop - 1)}
                      fill="transparent"
                      pointerEvents="all"
                    />
                  )}
                </g>
              );
            })}
        </svg>
      </div>

      {/* UV index scale keys */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 border-t border-slate-800/60 pt-3 text-[10px] text-slate-400">
        <span className="font-medium text-slate-500 uppercase tracking-wider mr-1">UV Index Scale:</span>
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
