// Firebase bootstrap.
//
// The values below are the project's *public* web config. A Firebase web
// "apiKey" is not a secret and is not a credential — it only identifies the
// project so the SDK knows which servers to talk to, and it ships in the
// client bundle no matter what. The actual security of user data rests on:
//   1. Firestore security rules (see firestore.rules) — a user can only ever
//      read/write documents under their own authenticated UID, and
//   2. the project's Authorized Domains list (sign-in only works from
//      localhost and erndip.github.io).
// Each field can still be overridden per-environment via a VITE_FIREBASE_*
// env var (see .env.example) without touching this file.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB12DH9IBTuhPDxhuasICvyD9OWAB2q8Z0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'sunwise-tracker.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'sunwise-tracker',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'sunwise-tracker.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '475050713496',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:475050713496:web:4c7648e4b56e7b3edc8bed',
};

// If a build somehow ships without a project id, degrade gracefully to a
// purely device-local app (no sign-in button, localStorage only) rather than
// crashing on init.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Persistent IndexedDB cache gives us offline reads and queues offline
    // writes until the device reconnects. Fall back to the default in-memory
    // cache if the browser blocks IndexedDB (e.g. some private-mode contexts).
    try {
      db = initializeFirestore(app, {
        // Skip undefined fields (e.g. an absent `notes`) instead of throwing.
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch (cacheErr) {
      console.warn('Firestore persistent cache unavailable; using in-memory cache.', cacheErr);
      db = getFirestore(app);
    }
  } catch (err) {
    console.error('Firebase failed to initialize; running in device-only mode.', err);
    app = null;
    auth = null;
    db = null;
  }
}

export const googleProvider = new GoogleAuthProvider();

export { app, auth, db };
