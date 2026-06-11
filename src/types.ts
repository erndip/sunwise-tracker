export interface FitzpatrickType {
  type: number; // 1 to 6
  name: string;
  description: string;
  medInSed: number; // Minimum Erythemal Dose in Standard Erythemal Doses (1 SED = 100 J/m²)
  medInJm2: number; // MED in J/m²
  skinColor: string; // TailWind color representative or HEX (for display)
  bgClass: string;
}

export interface TanningSession {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  skinType: number; // Fitzpatrick Type
  uviIntegral: number; // UVI-hours
  sedDose: number; // Dose in SED
  jm2Dose: number; // Dose in J/m²
  medRatio: number; // How many MEDs received (dose / MED)
  burnRisk: 'Low' | 'Moderate' | 'High' | 'Extreme';
  forecastUvi: number[]; // 24 hourly UVI values for that day
  notes?: string;
  createdAt?: number; // epoch ms when logged; used for stable "newest first" ordering
}

export interface LocationGeo {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
