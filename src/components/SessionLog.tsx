import React, { useState } from 'react';
import { TanningSession } from '../types';
import { parseLocalDate } from '../utils/uvCalculator';
import {
  Trash2,
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface SessionCardProps {
  sess: TanningSession;
  onDelete: (id: string) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ sess, onDelete, onUpdateNotes }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [noteValue, setNoteValue] = useState(sess.notes || '');

  const dateObj = parseLocalDate(sess.date);
  const formattedDate = isNaN(dateObj.getTime())
    ? sess.date
    : dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  const riskColors = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-400 dark:border-emerald-900/50',
    Moderate: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/35 dark:text-amber-400 dark:border-amber-900/50',
    High: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/35 dark:text-orange-400 dark:border-orange-900/50',
    Extreme: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/35 dark:text-rose-400 dark:border-rose-900/50',
  };

  const handleSave = () => {
    if (onUpdateNotes) {
      onUpdateNotes(sess.id, noteValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNoteValue(sess.notes || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-200">
      
      {/* Top Section: Location, Date & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left column: Location, date/time timestamps */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm">{sess.location}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center space-x-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400 inline" />
              <span>{formattedDate}</span>
            </span>
            <span className="flex items-center space-x-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400 inline" />
              <span>
                {sess.startTime} - {sess.endTime}
              </span>
            </span>
          </div>
        </div>

        {/* Right column: Dose calculation and hazard rating badges */}
        <div className="flex flex-wrap items-center gap-2">
          
          <div className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-350">
            Type {sess.skinType} Skin
          </div>

          <div className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-[10px] font-mono text-amber-800 dark:text-amber-300 flex items-center space-x-1">
            <span className="font-bold">{sess.uviIntegral.toFixed(2)}</span>
            <span className="opacity-70">UVI-h</span>
          </div>

          <div className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-[10px] font-mono text-rose-800 dark:text-rose-300 flex items-center space-x-1">
            <span className="font-bold">{sess.sedDose.toFixed(1)}</span>
            <span className="opacity-70">SED</span>
          </div>

          <div className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 text-[10px] font-mono text-violet-800 dark:text-violet-300 flex items-center space-x-1">
            <span className="font-bold">{sess.medRatio.toFixed(2)}</span>
            <span className="opacity-70">MED</span>
          </div>

          <div className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${riskColors[sess.burnRisk]}`}>
            Risk: {sess.burnRisk}
          </div>

          <button
            type="button"
            onClick={() => onDelete(sess.id)}
            className="p-1 px-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200/40 dark:border-slate-800 rounded-md cursor-pointer transition-colors shrink-0"
            title="Delete session log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable/Editable Comments/Notes block at bottom */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1 bg-slate-50/20 dark:bg-slate-950/10 p-3 rounded-xl border border-slate-100/60 dark:border-slate-850">
        {isEditing ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Edit Exposure Notes
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCancel}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 border-0 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  title="Cancel Edit"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSave}
                  className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md cursor-pointer transition-colors inline-flex items-center justify-center"
                  title="Save Note"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Provide comments (e.g., SPF 15 sunscreen applied, flipped every 15 minutes, sunny morning, slight breeze...)"
              rows={2}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block mb-1">
                Session Notes
              </span>
              {sess.notes ? (
                <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                  &ldquo;{sess.notes}&rdquo;
                </p>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500 italic font-mono">
                  No notes recorded. Click write to describe your exposure.
                </span>
              )}
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 text-[11px] font-medium rounded-lg border border-slate-200/60 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-850 bg-white/60 dark:bg-slate-900/60 transition-all cursor-pointer shadow-xs"
            >
              <Pencil className="w-3 h-3" />
              <span>{sess.notes ? 'Edit Note' : 'Add Note'}</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

interface SessionLogProps {
  sessions: TanningSession[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onUpdateNotes?: (id: string, notes: string) => void;
}

export const SessionLog: React.FC<SessionLogProps> = ({
  sessions,
  onDelete,
  onClearAll,
  onUpdateNotes,
}) => {
  const totalSessions = sessions.length;
  const totalSed = sessions.reduce((acc, s) => acc + s.sedDose, 0);
  const avgUviHours =
    totalSessions > 0
      ? sessions.reduce((acc, s) => acc + s.uviIntegral, 0) / totalSessions
      : 0;
  const highRiskCount = sessions.filter(
    (s) => s.burnRisk === 'High' || s.burnRisk === 'Extreme'
  ).length;

  return (
    <div className="space-y-6">
      {/* Statistics Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center space-x-3.5 shadow-sm">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Logs</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {totalSessions}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center space-x-3.5 shadow-sm">
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Dose Received</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {totalSed.toFixed(1)} <span className="text-xs font-normal text-slate-400">SED</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center space-x-3.5 shadow-sm">
          <div className="p-2.5 bg-violet-500/10 text-violet-500 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg Exposure</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {avgUviHours.toFixed(2)} <span className="text-xs font-normal text-slate-400">UVI-h</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center space-x-3.5 shadow-sm">
          <div
            className={`p-2.5 rounded-xl ${
              highRiskCount > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            {highRiskCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Oversunned Alerts</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {highRiskCount} <span className="text-xs font-normal text-slate-400">burns</span>
            </div>
          </div>
        </div>
      </div>

      {/* Log Header and actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Historical Exposures</h3>
        {sessions.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-rose-500 hover:text-rose-600 font-medium hover:underline bg-transparent border-0 cursor-pointer"
          >
            Clear Entire Log
          </button>
        )}
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center bg-slate-50/20 dark:bg-slate-950/20">
          <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto stroke-[1.5]" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2.5">
            No tanning sessions logged yet. Check your current locations, calculate your exposure dosage, and log.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sessions.map((sess) => (
            <SessionCard
              key={sess.id}
              sess={sess}
              onDelete={onDelete}
              onUpdateNotes={onUpdateNotes}
            />
          ))}
        </div>
      )}
    </div>
  );
};
