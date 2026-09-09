import React, { useState } from 'react';
import { BurnLevel, SessionEdit, TanningSession } from '../types';
import { parseLocalDate } from '../utils/uvCalculator';
import { getBurnLevelMeta, toBurnLevel } from '../utils/burnLevel';
import { BurnLevelSlider } from './BurnLevelSlider';
import { Trash2, Calendar, MapPin, Clock, Zap, Flame, Pencil, Check, X } from 'lucide-react';

interface SessionCardProps {
  sess: TanningSession;
  onDelete: (id: string) => void;
  onUpdateSession?: (id: string, edit: SessionEdit) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ sess, onDelete, onUpdateSession }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [noteValue, setNoteValue] = useState(sess.notes || '');
  // Sessions logged before burn tracking existed have no level; the editor
  // starts them at 0 while the read view still shows "Not recorded".
  const [burnValue, setBurnValue] = useState<BurnLevel>(sess.burnLevel ?? 0);

  const burnMeta = getBurnLevelMeta(sess.burnLevel);

  const dateObj = parseLocalDate(sess.date);
  const formattedDate = isNaN(dateObj.getTime())
    ? sess.date
    : dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  const handleSave = () => {
    if (onUpdateSession) {
      onUpdateSession(sess.id, { notes: noteValue, burnLevel: burnValue });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNoteValue(sess.notes || '');
    setBurnValue(sess.burnLevel ?? 0);
    setIsEditing(false);
  };

  // Seed from the current props each time rather than trusting mount-time
  // state: a card can be edited on another device and arrive via a Firestore
  // snapshot while this one sits open in the list.
  const handleStartEditing = () => {
    setNoteValue(sess.notes || '');
    setBurnValue(sess.burnLevel ?? 0);
    setIsEditing(true);
  };

  return (
    <div className="relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-200">

      {/* Pinned to the card corner so it sits in the same place on every card,
          rather than trailing the badge row and wrapping below it on mobile. */}
      <button
        type="button"
        onClick={() => onDelete(sess.id)}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 px-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200/40 dark:border-slate-800 rounded-md cursor-pointer transition-colors"
        title="Delete session log"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Top Section: Location, Date & Badges. Right padding keeps the badges
          clear of the absolutely positioned delete button above. */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pr-10">
        
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

        {/* Right column: Dose calculation badges */}
        <div className="flex flex-wrap items-center gap-2">

          <div className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-[10px] font-mono text-amber-800 dark:text-amber-300 flex items-center space-x-1">
            <span className="font-bold">{sess.uviIntegral.toFixed(2)}</span>
            <span className="opacity-70">UVI-h</span>
          </div>

          <div className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-[10px] font-mono text-rose-800 dark:text-rose-300 flex items-center space-x-1">
            <span className="font-bold">{sess.sedDose.toFixed(1)}</span>
            <span className="opacity-70">SED</span>
          </div>

          <div className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 text-[10px] font-mono text-violet-800 dark:text-violet-300 flex items-center space-x-1">
            <span className="font-bold">{Math.round(sess.jm2Dose)}</span>
            <span className="opacity-70">J/m²</span>
          </div>
        </div>
      </div>

      {/* Editable outcome block: burn level and notes are the two fields the
          user can revise after the fact, so they share one Edit control. */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1 bg-slate-50/20 dark:bg-slate-950/10 p-3 rounded-xl border border-slate-100/60 dark:border-slate-850">
        {isEditing ? (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Edit Session
              </span>
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
                  title="Save Changes"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-start">
              <BurnLevelSlider
                id={`burn-${sess.id}`}
                value={burnValue}
                onChange={setBurnValue}
              />
              <div className="space-y-2">
                <label
                  htmlFor={`notes-${sess.id}`}
                  className="text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer block"
                >
                  Session Notes
                </label>
                <textarea
                  id={`notes-${sess.id}`}
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Provide comments (e.g., SPF 15 sunscreen applied, flipped every 15 minutes, sunny morning, slight breeze...)"
                  rows={3}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-slate-800 dark:text-slate-100 resize-y"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2.5 min-w-0">

              {/* Burn outcome */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block mb-1">
                  Burn Level
                </span>
                {burnMeta ? (
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold inline-flex items-center gap-1.5 ${burnMeta.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${burnMeta.dot}`} />
                    {burnMeta.label}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic font-mono">
                    Not recorded. Use Edit to add it.
                  </span>
                )}
              </div>

              {/* Notes */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block mb-1">
                  Session Notes
                </span>
                {sess.notes ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                    &ldquo;{sess.notes}&rdquo;
                  </p>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic font-mono">
                    No notes recorded.
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleStartEditing}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 text-[11px] font-medium rounded-lg border border-slate-200/60 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-850 bg-white/60 dark:bg-slate-900/60 transition-all cursor-pointer shadow-xs"
              title="Edit burn level and notes"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
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
  onUpdateSession?: (id: string, edit: SessionEdit) => void;
}

export const SessionLog: React.FC<SessionLogProps> = ({
  sessions,
  onDelete,
  onClearAll,
  onUpdateSession,
}) => {
  const totalSessions = sessions.length;
  const totalSed = sessions.reduce((acc, s) => acc + s.sedDose, 0);
  const avgUviHours =
    totalSessions > 0
      ? sessions.reduce((acc, s) => acc + s.uviIntegral, 0) / totalSessions
      : 0;
  // Anything above "no burn" counts; sessions predating burn tracking are
  // undefined and are excluded rather than assumed clean.
  const burnCount = sessions.filter((s) => (s.burnLevel ?? 0) > 0).length;
  const worstBurn = toBurnLevel(
    sessions.reduce<number>((acc, s) => Math.max(acc, s.burnLevel ?? 0), 0),
  );

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

        {/* Burn outcomes, so dose and consequence can be read side by side */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center space-x-3.5 shadow-sm">
          <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl">
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sessions With Burn</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {burnCount}
              {burnCount > 0 && (
                <span className="text-xs font-normal text-slate-400">
                  {' '}· worst {getBurnLevelMeta(worstBurn)?.label}
                </span>
              )}
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
              onUpdateSession={onUpdateSession}
            />
          ))}
        </div>
      )}
    </div>
  );
};
