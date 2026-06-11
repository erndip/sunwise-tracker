import React, { useState } from 'react';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Errors that just mean the user dismissed the popup — not worth logging.
const BENIGN_SIGN_IN_ERRORS = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

export const AuthButton: React.FC = () => {
  const { user, loading, isConfigured, signIn, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isConfigured) return null;
  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (err: any) {
      if (!BENIGN_SIGN_IN_ERRORS.has(err?.code)) {
        console.error('Sign-in failed', err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign-out failed', err);
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
          />
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          title={user.email ? `Signed in as ${user.email}` : 'Sign out'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-amber-500 text-white hover:bg-slate-800 dark:hover:bg-amber-600 disabled:opacity-50 transition-colors cursor-pointer shadow-sm shrink-0"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
      <span>Sign in</span>
    </button>
  );
};
