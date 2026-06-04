import { FitzpatrickType, TanningSession } from '../types';

export const FITZPATRICK_TYPES: FitzpatrickType[] = [
  {
    type: 1,
    name: 'Type I',
    description: 'Very fair skin, red/blond hair, freckles. Always burns, never tans.',
    medInSed: 2.0, // 200 J/m²
    medInJm2: 200,
    skinColor: '#FBF0EC',
    bgClass: 'bg-[#FBF0EC] border-pink-200 text-pink-900',
  },
  {
    type: 2,
    name: 'Type II',
    description: 'Fair skin, blue/green eyes. Burns easily, tans minimally.',
    medInSed: 2.5, // 250 J/m²
    medInJm2: 250,
    skinColor: '#F7E2D6',
    bgClass: 'bg-[#F7E2D6] border-orange-200 text-orange-900',
  },
  {
    type: 3,
    name: 'Type III',
    description: 'Creamy white skin, hazel/brown eyes. Burns moderately, tans gradually.',
    medInSed: 3.5, // 350 J/m²
    medInJm2: 350,
    skinColor: '#ECD1BF',
    bgClass: 'bg-[#ECD1BF] border-orange-300 text-amber-950',
  },
  {
    type: 4,
    name: 'Type IV',
    description: 'Light brown or olive skin, dark hair. Burns minimally, tans easily.',
    medInSed: 4.5, // 450 J/m²
    medInJm2: 450,
    skinColor: '#D0A98F',
    bgClass: 'bg-[#D0A98F] border-amber-400 text-amber-950',
  },
  {
    type: 5,
    name: 'Type V',
    description: 'Dark brown skin, dark eyes/hair. Rarely burns, tans profusely.',
    medInSed: 6.0, // 600 J/m²
    medInJm2: 600,
    skinColor: '#A17255',
    bgClass: 'bg-[#A17255] border-amber-600 text-amber-50',
  },
  {
    type: 6,
    name: 'Type VI',
    description: 'Deeply pigmented dark brown to black skin. Never burns, rapid pigment response.',
    medInSed: 10.0, // 1000 J/m²
    medInJm2: 1000,
    skinColor: '#613D27',
    bgClass: 'bg-[#613D27] border-neutral-800 text-neutral-100',
  },
];

/**
 * Parses "HH:MM" string to a decimal hour
 */
export function parseTimeToDecimal(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 12.0; // fallback
  return h + m / 60;
}

/**
 * Converts a "HH:MM" string to minutes of the day (0 to 1440)
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 720; // fallback to noon
  return h * 60 + m;
}

/**
 * Converts minutes of the day (0 to 1435) to a "HH:MM" string
 */
export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1435, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Integrates precision hourly UV Index values between start and end decimal hours.
 * Uses exact trapezoidal integration over linear interpolation models of UV index.
 */
export function integrateUvi(hourlyVals: number[], startHour: number, endHour: number): number {
  if (endHour <= startHour) return 0;

  // Ensure hourlyVals has 25 elements representing 0:00 to 24:00 (index 24 is same as midnight / 23:00)
  const uvi = [...hourlyVals];
  if (uvi.length === 0) return 0;
  
  while (uvi.length < 25) {
    // Append 0s or replicate the last available UV value
    uvi.push(0);
  }

  const getUvi = (t: number): number => {
    if (t <= 0) return uvi[0];
    if (t >= 24) return 0; // midnight is 0 UV
    const h0 = Math.floor(t);
    const h1 = h0 + 1;
    const val0 = uvi[h0];
    const val1 = h1 >= 24 ? 0 : uvi[h1];
    const frac = t - h0;
    return val0 * (1 - frac) + val1 * frac;
  };

  // Find all integer nodes between startHour and endHour
  const nodes: number[] = [startHour];
  const firstInt = Math.ceil(startHour);
  const lastInt = Math.floor(endHour);

  for (let i = firstInt; i <= lastInt; i++) {
    if (i > startHour && i < endHour) {
      nodes.push(i);
    }
  }
  nodes.push(endHour);

  // Eliminate duplicate nodes
  const uniqueNodes = Array.from(new Set(nodes)).sort((a, b) => a - b);

  let integral = 0;
  for (let i = 0; i < uniqueNodes.length - 1; i++) {
    const x = uniqueNodes[i];
    const y = uniqueNodes[i + 1];
    const uvX = getUvi(x);
    const uvY = getUvi(y);
    const segmentIntegral = (y - x) * (uvX + uvY) / 2;
    integral += segmentIntegral;
  }

  return integral;
}

/**
 * Calculates UV Radiation dose output in standard erythemal dose (SED), Joules per m²,
 * and percentage/multiple of Minimum Erythemal Dose (MED).
 * 
 * Physics Conversion:
 * 1 UV Index = 25 mW/m² = 0.025 W/m² of erythemally active UV radiation.
 * Hence, 1 UVI-hour = 0.025 W/m² * 3600s = 90 J/m²
 * 1 Standard Erythemal Dose (SED) = 100 J/m²
 * 1 UVI-hour = 0.9 SED = 90 J/m²
 */
export function calculateDoseMetrics(uviHours: number, skinTypeNum: number) {
  const skinType = FITZPATRICK_TYPES.find((t) => t.type === skinTypeNum) || FITZPATRICK_TYPES[1];
  
  const jm2Dose = uviHours * 90; // Joule/m²
  const sedDose = uviHours * 0.9; // Standard Erythemal Dose
  const medRatio = jm2Dose / skinType.medInJm2; // how many MEDs

  let burnRisk: TanningSession['burnRisk'] = 'Low';
  if (medRatio >= 1.5) {
    burnRisk = 'Extreme'; // Massive sunburn expected
  } else if (medRatio >= 1.0) {
    burnRisk = 'High'; // Skin starts to burn (erythema threshold reached)
  } else if (medRatio >= 0.5) {
    burnRisk = 'Moderate'; // Good tanning stimulus, safe limit
  } else {
    burnRisk = 'Low'; // Minimal risk, safe
  }

  return {
    jm2Dose,
    sedDose,
    medRatio,
    burnRisk,
  };
}

/**
 * Categorizes UV index rating for contextual formatting.
 */
export function getUviCategory(uvi: number): {
  label: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
  colorClass: string;
  bgClass: string;
} {
  if (uvi < 3) return { label: 'Low', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50 border-emerald-100' };
  if (uvi < 6) return { label: 'Moderate', colorClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-100' };
  if (uvi < 8) return { label: 'High', colorClass: 'text-orange-600', bgClass: 'bg-orange-50 border-orange-100' };
  if (uvi < 11) return { label: 'Very High', colorClass: 'text-rose-600', bgClass: 'bg-rose-50 border-rose-100' };
  return { label: 'Extreme', colorClass: 'text-violet-600', bgClass: 'bg-violet-50 border-violet-100' };
}
