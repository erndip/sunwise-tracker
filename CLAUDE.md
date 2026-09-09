# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run dev        # Vite dev server on port 3000 (0.0.0.0)
npm run build       # production build to dist/ - There is no need to run npm run build after edits unless specifically asked.
npm run preview      # preview the production build
npm run lint        # tsc --noEmit — this is the project's only "lint" step
```

There is no test framework in this repo — `npm run lint` (a TypeScript typecheck) is the only automated check. Verify behavioral changes by running `npm run dev` and exercising the app manually.

Deployment is automatic: pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs `npm run build` and publishes `dist/` to GitHub Pages.

## Architecture

This is a single-page React 19 + TypeScript app (Vite, Tailwind v4 via `@tailwindcss/vite`) with no backend of its own. All app logic lives under `src/`; `App.tsx` is the top-level component and owns nearly all shared state (selected location, date, exposure start/end time, session notes, burn level) — child components are largely presentational and push changes back up via callback props rather than holding their own copies of shared state.

### Data flow: UV forecast → integral → dose

- **Weather source**: Open-Meteo (`api.open-meteo.com` for hourly UV forecast, `geocoding-api.open-meteo.com` for location search) — no API key required. Fetched in an effect in `App.tsx` keyed on `[selectedLocation, currentDate]`; on any failure it falls back to a synthetic Gaussian UV curve so the UI is never left without data to render.
- **Integration math** lives in [src/utils/uvCalculator.ts](src/utils/uvCalculator.ts): `integrateUvi` does trapezoidal integration over the hourly UV curve between two decimal-hour bounds; `calculateDoseMetrics` converts the resulting UVI-hours into J/m² and SED. This module also holds the shared time helpers (`parseTimeToDecimal`, `timeToMinutes`, `minutesToTime`, `parseLocalDate`, `getLocalDateISO`) and `getUviColor`, the UV-index → color-scale mapping reused across the chart and legends.
- **UvChart** ([src/components/UvChart.tsx](src/components/UvChart.tsx)) renders the SVG curve and the shaded exposure region, and supports direct manipulation: dragging the start/end markers or the shaded band (Pointer Events, snapped to 5-minute steps) calls `onWindowChange(startTime, endTime)`. The chart holds no local copy of the window — `App.tsx`'s `startTime`/`endTime` state is the single source of truth, so the chart, the time inputs, and the dose calculations all stay in sync automatically. Passing no `onWindowChange` renders a static, non-interactive chart.

### Session persistence

[src/hooks/useSessions.ts](src/hooks/useSessions.ts) is the single source of truth for logged sessions and is offline-first:
- `localStorage` (`sunwise_sessions`) is always the immediate cache and the fallback source of truth when signed out or when Firebase isn't configured.
- When Firebase is configured *and* a user is signed in, Firestore (`users/{uid}/sessions/{sessionId}`) becomes the synced source of truth via `onSnapshot`, mirrored back into `localStorage`. On first sign-in, any local-only sessions are pushed up without clobbering newer cloud data.
- All mutations (`addSession`, `updateSession`, `deleteSession`, `clearAll`) apply optimistically to local state first, then write through to Firestore or `localStorage` depending on `syncing`.
- `updateSession` takes a `SessionEdit` (`{ notes, burnLevel }`, defined in [src/types.ts](src/types.ts)) — notes and burn level are edited together as one action from the log, since the log's UI intentionally combines them under a single Edit control.

### Auth & Firebase

[src/lib/firebase.ts](src/lib/firebase.ts) initializes Firebase; [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) wraps Google sign-in (popup, not redirect — redirect sign-in is unreliable on `*.github.io`) and exposes `useAuth()`. The Firebase web config is intentionally checked into `firebase.ts` — a Firebase web `apiKey` is not a secret. The actual trust boundary is [firestore.rules](firestore.rules) (a user can only read/write documents under their own authenticated UID) plus the project's Authorized Domains list. `VITE_FIREBASE_*` env vars (see [.env.example](.env.example)) exist only to point a local/dev build at a *different* Firebase project.

Both `firebase.ts` and `AuthContext.tsx` degrade gracefully to a device-local, sign-in-less mode if Firebase fails to initialize — check `isFirebaseConfigured` / `isConfigured` before assuming `auth`/`db` are non-null.

### Burn level

[src/utils/burnLevel.ts](src/utils/burnLevel.ts) defines the 0–4 burn severity scale (`BurnLevel` type in `types.ts`) and its shared metadata (labels, badge/dot/accent Tailwind classes) — deliberately reusing the same emerald→amber→orange→rose→violet ramp as `getUviColor`. `BurnLevelSlider` ([src/components/BurnLevelSlider.tsx](src/components/BurnLevelSlider.tsx)) is the one slider UI used both when logging a new session (`App.tsx`) and when editing a historical one (`SessionLog.tsx`); `burnLevel` is optional on `TanningSession` since sessions logged before this field existed have none. Treat `0` as a real, meaningful value ("No burn") — code that checks for a burn level must check `!== undefined`, not truthiness.

### Housekeeping

`@google/genai`, `express`, and `dotenv` are `package.json` dependencies left over from this project's origin as a Google AI Studio scaffold ([metadata.json](metadata.json), commit "import from Google AI Studio") — none are imported anywhere under `src/`. The `clean` script's `rm -rf server.js` is a relic of the same scaffold; no `server.js` exists in this repo.
