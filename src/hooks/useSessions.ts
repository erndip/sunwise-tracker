import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { SessionEdit, TanningSession } from '../types';

const LS_KEY = 'sunwise_sessions';

export type SyncState = 'local' | 'syncing' | 'synced';

function loadLocal(): TanningSession[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as TanningSession[]) : [];
  } catch (err) {
    console.error('Failed to parse saved sessions', err);
    return [];
  }
}

function saveLocal(sessions: TanningSession[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to persist sessions locally', err);
  }
}

// Newest-logged first; entries without createdAt (older local logs) fall to the end.
function sortSessions(sessions: TanningSession[]): TanningSession[] {
  return [...sessions].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

// Firestore rejects `undefined` values, so drop those keys entirely (an absent
// `notes` or `burnLevel` reads back as undefined anyway). Tested against
// undefined rather than falsiness on purpose: burnLevel 0 ("No burn") is a real
// value that a truthiness check would silently discard.
function toFirestore(session: TanningSession): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(session).filter(([, value]) => value !== undefined),
  );
}

interface UseSessions {
  sessions: TanningSession[];
  syncState: SyncState;
  addSession: (session: TanningSession) => void;
  updateSession: (id: string, edit: SessionEdit) => void;
  deleteSession: (id: string) => void;
  clearAll: () => void;
}

/**
 * Single source of truth for tanning-session persistence.
 *
 * Offline-first: localStorage is always the immediate cache. When Firebase is
 * configured AND a user is signed in, Firestore (collection
 * `users/{uid}/sessions`) becomes the synced source of truth and is mirrored
 * back into localStorage, so logs survive sign-out and offline use.
 */
export function useSessions(): UseSessions {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TanningSession[]>(() => sortSessions(loadLocal()));
  const [syncState, setSyncState] = useState<SyncState>('local');

  // Keep latest sessions accessible inside callbacks without re-creating them.
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Tracks the currently-synced uid so we can tell "just signed out" (clear
  // the cloud mirror below) apart from "never signed in" (leave local alone).
  const syncedUidRef = useRef<string | null>(null);

  const syncing = Boolean(db && user);

  useEffect(() => {
    if (!db || !user) {
      // localStorage mirrors whichever account was last synced (see the
      // onSnapshot handler below), so a real sign-out must wipe it — otherwise
      // the previous user's sessions reappear as if they were local/guest data.
      if (syncedUidRef.current) {
        syncedUidRef.current = null;
        saveLocal([]);
      }
      // Signed out / Firebase unavailable: localStorage is the source of truth.
      setSyncState('local');
      setSessions(sortSessions(loadLocal()));
      return;
    }

    syncedUidRef.current = user.uid;
    setSyncState('syncing');
    const colRef = collection(db, 'users', user.uid, 'sessions');
    let mergedLocalOnly = false;

    const unsubscribe = onSnapshot(
      colRef,
      async (snap) => {
        const cloud = snap.docs.map((d) => d.data() as TanningSession);

        // On the first snapshot, push any sessions that exist only on this
        // device up to the cloud (without clobbering newer cloud edits). The
        // resulting write triggers another snapshot we render from below.
        if (!mergedLocalOnly) {
          mergedLocalOnly = true;
          const cloudIds = new Set(cloud.map((s) => s.id));
          const localOnly = loadLocal().filter((s) => !cloudIds.has(s.id));
          if (localOnly.length > 0) {
            try {
              await Promise.all(
                localOnly.map((s) =>
                  setDoc(doc(colRef, s.id), toFirestore({ ...s, createdAt: s.createdAt ?? Date.now() })),
                ),
              );
            } catch (err) {
              console.error('Failed to upload local sessions on sign-in', err);
            }
            return; // wait for the snapshot that includes the merged docs
          }
        }

        const sorted = sortSessions(cloud);
        setSessions(sorted);
        saveLocal(sorted);
        setSyncState('synced');
      },
      (err) => {
        // Lost the cloud connection (rules, network): fall back to local cache.
        console.error('Firestore subscription error', err);
        setSessions(sortSessions(loadLocal()));
        setSyncState('local');
      },
    );

    return unsubscribe;
  }, [user]);

  const addSession = useCallback(
    (session: TanningSession) => {
      const stamped: TanningSession = { ...session, createdAt: session.createdAt ?? Date.now() };
      const next = sortSessions([stamped, ...sessionsRef.current]);
      setSessions(next); // optimistic

      if (syncing && db && user) {
        setDoc(doc(db, 'users', user.uid, 'sessions', stamped.id), toFirestore(stamped)).catch((err) =>
          console.error('Failed to save session to cloud', err),
        );
      } else {
        saveLocal(next);
      }
    },
    [syncing, user],
  );

  const updateSession = useCallback(
    (id: string, edit: SessionEdit) => {
      const notes = edit.notes.trim() ? edit.notes.trim() : undefined;
      const burnLevel = edit.burnLevel;
      const next = sessionsRef.current.map((s) =>
        s.id === id ? { ...s, notes, burnLevel } : s,
      );
      setSessions(next); // optimistic

      if (syncing && db && user) {
        // Also backfills burnLevel onto sessions logged before it existed.
        updateDoc(doc(db, 'users', user.uid, 'sessions', id), {
          notes: notes ?? deleteField(),
          burnLevel,
        }).catch((err) => console.error('Failed to update session in cloud', err));
      } else {
        saveLocal(next);
      }
    },
    [syncing, user],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const next = sessionsRef.current.filter((s) => s.id !== id);
      setSessions(next); // optimistic

      if (syncing && db && user) {
        deleteDoc(doc(db, 'users', user.uid, 'sessions', id)).catch((err) =>
          console.error('Failed to delete session from cloud', err),
        );
      } else {
        saveLocal(next);
      }
    },
    [syncing, user],
  );

  const clearAll = useCallback(() => {
    setSessions([]); // optimistic

    if (syncing && db && user) {
      const colRef = collection(db, 'users', user.uid, 'sessions');
      const firestore = db;
      getDocs(colRef)
        .then((snap) => {
          const batch = writeBatch(firestore);
          snap.forEach((d) => batch.delete(d.ref));
          return batch.commit();
        })
        .catch((err) => console.error('Failed to clear sessions in cloud', err));
    } else {
      saveLocal([]);
    }
  }, [syncing, user]);

  return { sessions, syncState, addSession, updateSession, deleteSession, clearAll };
}
