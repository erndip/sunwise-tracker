/**
 * Self-reported burn outcome, 0 (none) through 4 (severe).
 * See BURN_LEVELS in utils/burnLevel for the labels and palette.
 */
export type BurnLevel = 0 | 1 | 2 | 3 | 4;

export interface TanningSession {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  uviIntegral: number; // UVI-hours
  sedDose: number; // Dose in SED
  jm2Dose: number; // Dose in J/m²
  forecastUvi: number[]; // 24 hourly UVI values for that day
  // Optional because sessions logged before burn tracking existed have none;
  // those render as "Not recorded" until the user edits them.
  burnLevel?: BurnLevel;
  notes?: string;
  createdAt?: number; // epoch ms when logged; used for stable "newest first" ordering
}

/**
 * The fields of a logged session the user can revise after the fact. Both are
 * always supplied together — the log's Edit control saves them as one action —
 * so empty `notes` unambiguously means "clear it", never "leave it alone".
 */
export interface SessionEdit {
  notes: string;
  burnLevel: BurnLevel;
}

export interface LocationGeo {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
