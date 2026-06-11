import React, { useState, useEffect } from 'react';
import {
  Sun,
  MapPin,
  Clock,
  Calendar,
  AlertCircle,
  HelpCircle,
  Loader2,
  Navigation,
  Sparkles,
  Info,
  CalendarDays,
  Flame,
  PlusCircle,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { integrateUvi, calculateDoseMetrics, parseTimeToDecimal, FITZPATRICK_TYPES, timeToMinutes, minutesToTime, getLocalDateISO } from './utils/uvCalculator';
import { UvChart } from './components/UvChart';
import { FitzpatrickSelector } from './components/FitzpatrickSelector';
import { SessionLog } from './components/SessionLog';
import { AuthButton } from './components/AuthButton';
import { useAuth } from './contexts/AuthContext';
import { useSessions } from './hooks/useSessions';
import { TanningSession, LocationGeo } from './types';

// Default Demo Location on first render: Madison WI, USA
const DEFAULT_LOCATION: LocationGeo = {
  name: 'Madison',
  country: 'United States',
  admin1: 'Wisconsin',
  latitude: 43.0731,
  longitude: -89.4012,
  timezone: 'America/Chicago',
};

// Popular default destination shortcuts
const QUICK_LOCATIONS: LocationGeo[] = [
  { name: 'Madison', latitude: 43.0731, longitude: -89.4012, admin1: 'Wisconsin', country: 'United States', timezone: 'America/Chicago' },
  { name: 'Miami', latitude: 25.7743, longitude: -80.1937, admin1: 'Florida', country: 'United States', timezone: 'America/New_York' },
  { name: 'San Diego', latitude: 32.7157, longitude: -117.1611, admin1: 'California', country: 'United States', timezone: 'America/Los_Angeles' },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, admin1: 'New South Wales', country: 'Australia', timezone: 'Australia/Sydney' },
  { name: 'Barcelona', latitude: 41.3851, longitude: 2.1734, admin1: 'Catalonia', country: 'Spain', timezone: 'Europe/Madrid' },
  { name: 'Honolulu', latitude: 21.3069, longitude: -157.8583, admin1: 'Hawaii', country: 'United States', timezone: 'Pacific/Honolulu' },
];

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'calculator' | 'log' | 'learn'>('calculator');

  // Input states
  const [locationQuery, setLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationGeo[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationGeo>(DEFAULT_LOCATION);
  const [currentDate, setCurrentDate] = useState(() => getLocalDateISO());
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('13:00');
  const [skinType, setSkinType] = useState<number>(3); // Default to Fitzpatrick Type III
  const [sessionNotes, setSessionNotes] = useState('');

  // Weather API states
  const [forecastUvi, setForecastUvi] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Auth + persistence. Sessions are offline-first (localStorage) and sync to
  // the signed-in user's Firestore account when available — see useSessions.
  const { user, isConfigured } = useAuth();
  const { sessions, syncState, addSession, updateNotes, deleteSession, clearAll } = useSessions();

  // Load skin type preference from localStorage on mount
  useEffect(() => {
    const savedSkin = localStorage.getItem('sunwise_skintype');
    if (savedSkin) {
      const parsedSkin = parseInt(savedSkin, 10);
      if (!isNaN(parsedSkin) && parsedSkin >= 1 && parsedSkin <= 6) {
        setSkinType(parsedSkin);
      }
    }
  }, []);

  // Save skin type preference whenever changed
  const handleSkinTypeChange = (newType: number) => {
    setSkinType(newType);
    localStorage.setItem('sunwise_skintype', String(newType));
  };

  // Fetch UV forecast from Open-Meteo
  useEffect(() => {
    const fetchUvData = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const { latitude, longitude, timezone } = selectedLocation;
        // Fetch up to 7 days forecast. Open-Meteo provides hourly uv_index.
        // We filter or access the array corresponding to our selected date.
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=uv_index&timezone=${encodeURIComponent(timezone)}&start_date=${currentDate}&end_date=${currentDate}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to retrieve forecast data from weather service.');
        }
        
        const data = await response.json();
        if (data && data.hourly && data.hourly.uv_index) {
          // Open-Meteo hourly.time is like "2026-06-03T00:00"
          const dates: string[] = data.hourly.time;
          const uvs: number[] = data.hourly.uv_index;

          // Find values belonging to selectedDate
          const targetPrefix = currentDate;
          const targetIndices = dates
            .map((t, idx) => (t.startsWith(targetPrefix) ? idx : -1))
            .filter((idx) => idx !== -1);

          let dailyUvs: number[] = [];
          
          // Only use data if we found exactly 24 hourly entries for the selected date
          if (targetIndices.length === 24) {
            dailyUvs = targetIndices.map((idx) => uvs[idx]);
          } else if (targetIndices.length > 0) {
            // Partial data found for the date — use what we have
            dailyUvs = targetIndices.map((idx) => uvs[idx]);
            // Pad with zeros if needed
            while (dailyUvs.length < 24) {
              dailyUvs.push(0);
            }
          } else {
            // No data found for the selected date
            // Check if it's because the date is outside the forecast window
            const firstDateStr = dates[0]?.split('T')[0] || '';
            const lastDateStr = dates[dates.length - 1]?.split('T')[0] || '';
            if (currentDate < firstDateStr || currentDate > lastDateStr) {
              setApiError(`Selected date (${currentDate}) is outside the available forecast window (${firstDateStr} to ${lastDateStr}). Showing typical profile.`);
            } else {
              setApiError('Could not extract UV data for selected date. Showing typical profile.');
            }
            // Use mock fallback only when date is truly unavailable
            dailyUvs = Array.from({ length: 24 }, (_, h) => {
              if (h >= 6 && h <= 18) {
                const dist = Math.abs(h - 12);
                return Math.max(0, 6.5 * Math.exp(-(dist * dist) / 10));
              }
              return 0;
            });
          }

          // If all values are zero, use mock Gaussian distribution as safety fallback
          if (dailyUvs.length === 0 || dailyUvs.every((v) => v === 0)) {
            dailyUvs = Array.from({ length: 24 }, (_, h) => {
              // Bell curve centered at 12pm
              if (h >= 6 && h <= 18) {
                const dist = Math.abs(h - 12);
                return Math.max(0, 6.5 * Math.exp(-(dist * dist) / 10));
              }
              return 0;
            });
          }

          setForecastUvi(dailyUvs);
        } else {
          throw new Error('Malformed forecast response.');
        }
      } catch (err: any) {
        setApiError(err.message || 'Error occurred while loading UV index values. Using fallback average profile.');
        // Setup reasonable fallback bell-curve UV index array for safety
        const fallback = Array.from({ length: 24 }, (_, h) => {
          if (h >= 6 && h <= 18) {
            const dist = Math.abs(h - 12);
            return Math.max(0, 7.2 * Math.exp(-(dist * dist) / 12));
          }
          return 0;
        });
        setForecastUvi(fallback);
      } finally {
        setLoading(false);
      }
    };

    fetchUvData();
  }, [selectedLocation, currentDate]);

  // Geocode location search
  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationQuery.trim()) return;

    setSearchLoading(true);
    setApiError(null);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=5&language=en&format=json`
      );
      if (!response.ok) {
        throw new Error('Geocoding service unavailable.');
      }
      const data = await response.json();
      if (data && data.results && data.results.length > 0) {
        const resultsMap: LocationGeo[] = data.results.map((r: any) => ({
          name: r.name,
          country: r.country || '',
          admin1: r.admin1 || '',
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone || 'UTC',
        }));
        setSearchResults(resultsMap);
      } else {
        setApiError(`Could not find coordinates for "${locationQuery}". Try typing in a larger nearby city.`);
      }
    } catch (err: any) {
      setApiError(err.message || 'Geocoding search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Gelocate user utilizing device GPS coordinates
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setApiError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Set standard location label but perform forecast direct query with coordinates.
        // We reverse-geocode coordinates of GPS to display a beautiful name.
        let resolvedLabel = 'Detected GPS Location';
        let customTimezone = 'UTC';

        try {
          const revGeocodeUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto`;
          const response = await fetch(revGeocodeUrl);
          if (response.ok) {
            const data = await response.json();
            if (data && data.timezone) {
              customTimezone = data.timezone;
            }
          }
        } catch (_err) {}

        const newLoc: LocationGeo = {
          name: 'Your Current Spot',
          latitude,
          longitude,
          admin1: `[${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°]`,
          country: 'Local Device',
          timezone: customTimezone,
        };

        setSelectedLocation(newLoc);
        setLocationQuery('');
        setSearchResults([]);
      },
      (err) => {
        setApiError('Unable to fetch GPS position. Ensure you granted permissions in your browser frame.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Perform quick selections
  const handleQuickLocSelect = (loc: typeof QUICK_LOCATIONS[0]) => {
    setSelectedLocation(loc);
    setSearchResults([]);
    setLocationQuery('');
  };

  // Calculate integrated metrics for the currently selected session window
  const startHourNum = parseTimeToDecimal(startTime);
  const endHourNum = parseTimeToDecimal(endTime);
  const minForecastDate = getLocalDateISO();
  const maxForecastDate = getLocalDateISO(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
  
  // UV Hours Integral calculation
  const uviHoursIntegral = integrateUvi(forecastUvi, startHourNum, endHourNum);
  
  // Detailed radiation metrics (SED, J/m², MED multiplier, burn risk)
  const { jm2Dose, sedDose, medRatio, burnRisk } = calculateDoseMetrics(uviHoursIntegral, skinType);

  // Dynamic Skin Info Details
  const activeSkinType = FITZPATRICK_TYPES.find((t) => t.type === skinType) || FITZPATRICK_TYPES[2];

  // Calculate Peak Burn Rate insights
  const peakUvi = Math.max(0.1, ...forecastUvi);
  // Rate in J/m² per minute = 1.5 * peakUvi.
  // Minutes to reach 1 MED at peak sun = medInJm2 / (1.5 * peakUvi)
  const peakRateJm2Min = 1.5 * peakUvi;
  const minutesToBurnAtPeak = Math.max(2, activeSkinType.medInJm2 / peakRateJm2Min);

  // Save session action
  const handleSaveSession = () => {
    const newSession: TanningSession = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      location: `${selectedLocation.name}, ${selectedLocation.country}`,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      date: currentDate,
      startTime,
      endTime,
      skinType,
      uviIntegral: uviHoursIntegral,
      sedDose,
      jm2Dose,
      medRatio,
      burnRisk,
      forecastUvi,
      notes: sessionNotes.trim() ? sessionNotes.trim() : undefined,
    };

    addSession(newSession); // persists locally and to the cloud when signed in
    setSessionNotes(''); // reset pre-log notes
    setActiveTab('log'); // bounce to log tab so they immediately see their added card
  };

  // Clear all log entries
  const handleClearAllSessions = () => {
    if (confirm('Are you strictly sure you want to clear your entire exposure logs database? This cannot be undone.')) {
      clearAll();
    }
  };

  // Current UTC date for the header status badge (re-derived each render).
  const todayUtc = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* Premium Warm Amber Navigation Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">

          {/* Logo & Headline (sign-in sits beside it on mobile) */}
          <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
            <div className="flex items-center space-x-2.5 shrink-0">
              <div className="p-2 bg-amber-500 rounded-xl text-white shadow-md shadow-amber-500/20">
                <Sun className="w-5 h-5 fill-white shrink-0" />
              </div>
              <div>
                <h1 id="app-title" className="text-base font-bold text-slate-900 dark:text-amber-400 tracking-tight">
                  Sunwise Tracker
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">
                  UV exposure calculus
                </p>
              </div>
            </div>
            <div className="sm:hidden">
              <AuthButton />
            </div>
          </div>

          {/* Tab Navigation Center */}
          <nav className="flex space-x-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full sm:w-auto justify-between sm:justify-start overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'calculator'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-amber-400'
              }`}
            >
              Integrator
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'log'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-amber-400'
              }`}
            >
              Exposure Log
              {sessions.length > 0 && (
                <span className="bg-amber-600 dark:bg-slate-800 text-white dark:text-amber-400 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {sessions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('learn')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'learn'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-amber-400'
              }`}
            >
              Scientific Basis
            </button>
          </nav>

          {/* Right cluster: status badge + auth (auth shown beside the logo on mobile instead) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 p-1.5 px-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
              <span>{todayUtc} UTC</span>
            </div>
            <AuthButton />
          </div>

        </div>
      </header>

      {/* Main Container workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Dynamic State Alert Banner */}
        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/60 flex items-start space-x-2.5 text-xs text-rose-800 dark:text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            <div>
              <h4 className="font-semibold text-rose-900 dark:text-rose-300">Observation Alert</h4>
              <p className="mt-0.5 leading-relaxed">{apiError}</p>
            </div>
          </div>
        )}

        {/* Tab 1: Integrative UV Dosage Calculator */}
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

              {/* Geocoding, weather station, and location card inputs */}
              <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      1. Environment Location & Date
                    </h3>
                  </div>
                  {loading && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
                </div>

                {/* Autocomplete Input Form */}
                <form onSubmit={handleLocationSearch} className="space-y-2.5">
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search city (e.g. Barcelona, Ibiza)"
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="px-4 py-2 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                    <button
                      type="button"
                      onClick={handleGeolocate}
                      title="Geolocate using device GPS"
                      className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl inline-flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <Navigation className="w-4 h-4 shrink-0" />
                    </button>
                  </div>

                  {/* Geocoder Search Results List */}
                  {searchResults.length > 0 && (
                    <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg p-1.5 max-h-48 overflow-y-auto space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-slate-400 p-1 px-2 tracking-wider">
                        Select Matching Location:
                      </p>
                      {searchResults.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedLocation(r);
                            setSearchResults([]);
                            setLocationQuery('');
                          }}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 text-xs transition-colors flex items-center justify-between border-0 cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {r.name}, {r.admin1 ? `${r.admin1}, ` : ''}{r.country}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </form>

                {/* Quick Selection Shortcuts */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Quick Preset Destinations:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_LOCATIONS.map((ql, idx) => {
                      const isSess = selectedLocation.latitude === ql.latitude && selectedLocation.longitude === ql.longitude;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleQuickLocSelect(ql)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                            isSess
                              ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300 font-semibold'
                              : 'bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {ql.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Static Meta Display for Loaded Site */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 p-3.5 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                    Active Coordinates
                  </div>
                  <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedLocation.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedLocation.latitude.toFixed(4)}°N, {selectedLocation.longitude.toFixed(4)}°E
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-2">
                    Date Selector (7-Day Range)
                  </div>
                  <div className="relative mt-1">
                    <input
                      type="date"
                      min={minForecastDate}
                      max={maxForecastDate}
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                      className="block w-full max-w-full min-w-0 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                    />
                    <p className="mt-2 text-[10px] text-slate-400">
                      Select a date within the 7-day forecast window ({minForecastDate} to {maxForecastDate}).
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Local Station Timezone:</span>
                    <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                      {selectedLocation.timezone}
                    </span>
                  </div>
                </div>

              </div>

              {/* Time Interval window selector */}
              <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    2. Sunbathing Exposure window
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                    />
                    <div className="pt-2 px-0.5 space-y-1">
                      <input
                        type="range"
                        min="0"
                        max="1435"
                        step="10"
                        value={timeToMinutes(startTime)}
                        onChange={(e) => setStartTime(minutesToTime(parseInt(e.target.value, 10)))}
                        className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none outline-none"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span>00:00</span>
                        <span className="font-bold text-amber-500">{startTime}</span>
                        <span>23:55</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                    />
                    <div className="pt-2 px-0.5 space-y-1">
                      <input
                        type="range"
                        min="0"
                        max="1435"
                        step="10"
                        value={timeToMinutes(endTime)}
                        onChange={(e) => setEndTime(minutesToTime(parseInt(e.target.value, 10)))}
                        className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none outline-none"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span>00:00</span>
                        <span className="font-bold text-amber-500">{endTime}</span>
                        <span>23:55</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exposure length insight */}
                {startHourNum >= endHourNum ? (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center space-x-2 text-xs text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>EndTime must strictly be later than your StartTime parameters.</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Exposure Length:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {Math.floor(endHourNum - startHourNum)}h {Math.round(((endHourNum - startHourNum) % 1) * 60)}m
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic SVGCurve integrated highlights chart — surfaced near the top on mobile */}
              <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2.5 sm:p-5 shadow-sm">
                <UvChart
                  forecastUvi={forecastUvi}
                  startTime={startTime}
                  endTime={endTime}
                  locationName={selectedLocation.name}
                />
              </div>

              {/* Fitzpatrick skin selector */}
              <div className="lg:col-span-5 lg:col-start-1 lg:row-start-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <FitzpatrickSelector selectedType={skinType} onChange={handleSkinTypeChange} />
              </div>

              {/* Advanced radiation calculation outputs card */}
              <div className="lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:row-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
                
                {/* Section title & badge */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      Dose Integral Calculations
                    </h3>
                  </div>
                  <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-400">
                    <span>Physics Engine</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase font-bold text-slate-600 dark:text-slate-300">
                      v1.4-active
                    </span>
                  </div>
                </div>

                {/* Primary Metric: UVI Hours Exposure */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  
                  {/* Huge Circular Indicator style display */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/20 dark:from-slate-950 dark:to-slate-900 border border-amber-200/40 dark:border-slate-800/80 p-5 rounded-2xl text-center shadow-inner space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      UV Exposure Area Integral
                    </div>
                    <div className="text-4xl md:text-5xl font-black text-amber-500 font-mono tracking-tight my-2">
                      {uviHoursIntegral.toFixed(3)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      UVI-hours
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-mono leading-relaxed">
                      ∫ uvi(t) dt from {startTime} to {endTime}
                    </p>
                  </div>

                  {/* Biological damage metrics list (SED, J/m², MED ratio) */}
                  <div className="space-y-4">
                    
                    {/* Erythemal Dose standard metric J/m2 */}
                    <div className="flex justify-between items-center">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          Erythemal Energy Dose
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono">
                          1 UVI-hour = 90 J/m²
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {Math.round(jm2Dose)}
                        </span>{' '}
                        <span className="text-xs text-slate-400 font-normal">J/m²</span>
                      </div>
                    </div>

                    {/* SED Standard Erythemal Dose */}
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/85 pt-3.5">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          Standard Erythemal Dose (SED)
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono">
                          1 SED = 100 J/m² Erythemal energy
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {sedDose.toFixed(2)}
                        </span>{' '}
                        <span className="text-xs text-slate-400 font-normal">SED</span>
                      </div>
                    </div>

                    {/* MED Threshold representation (how much of sunburn limit did they receive?) */}
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/85 pt-3.5">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          Sunburn Threshold Ratio (MED)
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono">
                          Fraction of your skin sunburn limit
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`text-sm font-bold ${
                          medRatio >= 1.0 ? 'text-rose-500' : medRatio >= 0.5 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {Math.round(medRatio * 100)}%
                        </span>{' '}
                        <span className="text-[10px] text-slate-400 font-normal">({medRatio.toFixed(2)} MED)</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Progress bar visual indicating percentage of sunburn limit loaded */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Skin Erythema Threshold Load (1.0 MED)
                    </span>
                    <span className="font-mono">
                      {medRatio.toFixed(2)} / 1.0 MED
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-200/50 dark:border-slate-900 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, medRatio * 100)}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        medRatio >= 1.0
                          ? 'bg-rose-500 shadow-lg shadow-rose-500/20'
                          : medRatio >= 0.5
                          ? 'bg-amber-500 border-amber-400'
                          : 'bg-emerald-500 border-emerald-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Risk and Action Warning Box */}
                <div className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
                  medRatio >= 1.0
                    ? 'bg-rose-50/50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/60 dark:text-rose-300'
                    : medRatio >= 0.5
                    ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/60 dark:text-amber-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/60 dark:text-emerald-300'
                }`}>
                  <div className={`p-2 rounded-xl shrink-0 ${
                    medRatio >= 1.0 ? 'bg-rose-100 dark:bg-rose-950' : medRatio >= 0.5 ? 'bg-amber-100 dark:bg-amber-950' : 'bg-emerald-100 dark:bg-emerald-950'
                  }`}>
                    <Flame className={`w-5 h-5 ${
                      medRatio >= 1.0 ? 'text-rose-500' : medRatio >= 0.5 ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Biomedical Exposure Outcome: Risk Level &apos;{burnRisk}&apos;
                    </h4>
                    <p className="text-xs leading-relaxed opacity-90">
                      {medRatio >= 1.5 ? (
                        <span>
                          <strong>Danger:</strong> Massive erythema (severe sunburn) is predicted. Your dose ({sedDose.toFixed(1)} SED) far exceeds your Type {skinType} safe capacity of {activeSkinType.medInSed} SED. Limit exposure instantly, use high SPF sunscreen, or move inside!
                        </span>
                      ) : medRatio >= 1.0 ? (
                        <span>
                          <strong>Sunburn Warning:</strong> Your dose exceeds {activeSkinType.medInSed} SED. Skin redness, cell inflammation, and peeling will likely occur. Move to shade.
                        </span>
                      ) : medRatio >= 0.5 ? (
                        <span>
                          <strong>Optimal Tanning Dose:</strong> Excellent UV stimulus for melanin activation (tanning) without inducing cellular sunburn. Ensure you flip occasionally to distribute this radiation evenly.
                        </span>
                      ) : (
                        <span>
                          <strong>Safe Exposure Range:</strong> Mild solar absorption. Safe exposure window. Excellent for vitamin D3 production, very low risk of skin redness.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Optional Pre-logging Notes */}
                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-200/65 dark:border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="session-pre-notes" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 cursor-pointer">
                      <span>Add Session Notes (Before Logging)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono italic">Optional</span>
                  </div>
                  <textarea
                    id="session-pre-notes"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Enter notes (e.g., Applied SPF 30 sunscreen, outdoor lounge chair, intermittent cloud cover...)"
                    rows={2}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                {/* Dermatology Sun Advice widget */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4.5 border border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-amber-500" />
                      Dermatological Sun Warning Peak Advice
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
                      Peak UV index today is <strong className="text-slate-700 dark:text-slate-200">{peakUvi.toFixed(1)} UVI</strong> around solar noon. For your {activeSkinType.name} skin, the calculated safe direct midday peak threshold is <strong className="text-slate-700 dark:text-slate-200">{Math.round(minutesToBurnAtPeak)} minutes</strong> before cell sunburn.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSession}
                    disabled={startHourNum >= endHourNum}
                    className="shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold p-3 px-5 rounded-xl cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 transition-all outline-none"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>Log Session</span>
                  </button>
                </div>

              </div>

          </div>
        )}

        {/* Tab 2: Exposure Sessions Log Module */}
        {activeTab === 'log' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            {/* Sync status: where these logs live */}
            {isConfigured && (
              user ? (
                <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                  <Cloud className="w-4 h-4 shrink-0" />
                  <span>
                    {syncState === 'syncing' ? 'Syncing…' : 'Synced to your Google account'}
                    {user.email ? <span className="font-medium"> · {user.email}</span> : null}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <CloudOff className="w-4 h-4 shrink-0" />
                  <span>Saved on this device — sign in to sync your logs across devices.</span>
                </div>
              )
            )}
            <SessionLog
              sessions={sessions}
              onDelete={deleteSession}
              onClearAll={handleClearAllSessions}
              onUpdateNotes={updateNotes}
            />
          </div>
        )}

        {/* Tab 3: Scientific Explanation (Educational details regarding Integration & Radiation Physics) */}
        {activeTab === 'learn' && (
          <div className="max-w-3xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-amber-400">
                The Science of UV Radiation & Integration Calculus
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                How we construct physical, mathematically rigorous integrals to compute cellular tanning dosages.
              </p>
            </div>

            <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  What is the UV Index?
                </h3>
                <p>
                  The Ultraviolet Index (UVI) is an international scientific standard scale representing the intensity of erythemal (sunburn-producing) ultraviolet radiation at the Earth's surface. A value of 0 indicates zero radiation (nighttime), while values over 11 represent extreme risks where fair-skinned individuals can suffer burns in under 10 minutes.
                </p>
                <div className="bg-slate-50 dark:bg-slate-950 p-4.5 rounded-2xl font-mono text-xs text-slate-500 leading-normal border border-slate-100 dark:border-slate-900">
                  <span className="font-bold text-slate-800 dark:text-amber-300 uppercase block mb-1.5">[Physical Definition]</span>
                  1 UV Index unit is defined explicitly as 25 milliwatts of erythemally active UV radiation per square meter (25 mW/m² or 0.025 Watts/m²).
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Integrating UV Index (Calculus of Sunbathing)
                </h3>
                <p>
                  Solar intensity fluctuations follow an hourly curve, starting at 0 at sunrise, peaking as the sun crosses the local meridian (solar noon), and declining back to 0 at sunset.
                </p>
                <p>
                  Because solar irradiance changes continuously, calculating total exposure over a tanning session requires solving the integral of the UV curve over the session interval:
                </p>
                <div className="bg-slate-50 dark:bg-slate-950 p-4.5 rounded-2xl font-mono text-xs text-slate-500 leading-normal border border-slate-100 dark:border-slate-900 block text-center">
                  Total Exposure (UVI-hours) = ∫ [UVI(t) · dt] from t_start to t_end
                </div>
                <p>
                  This application performs this integration utilizing the Trapezoidal Rule over a piecewise linear interpolation model between hourly nodes fetched directly from meteorology systems.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  What are SED and MED?
                </h3>
                <p>
                  Standard physical metrics represent the biological effects of solar radiation on skin cells:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li>
                    <strong>SED (Standard Erythemal Dose):</strong> A normalized unit of solar UV exposure. Exactly 1 SED = 100 J/m² of erythemally weighted ultraviolet radiation. It is completely independent of individual skin characteristics.
                  </li>
                  <li>
                    <strong>MED (Minimum Erythemal Dose):</strong> The amount of ultraviolet energy that produces a mild, barely perceptible sunburn on an individual's skin. Crucially, your MED depends entirely on your Fitzpatrick skin type.
                  </li>
                </ul>
              </section>

              <section className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-5">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Fitzpatrick Skin Classification Breakdown
                </h3>
                <p className="text-xs">
                  Developed in 1975 by dermatologist Thomas B. Fitzpatrick, this classification divides human skin into six standard types based on baseline pigment and responses to direct solar exposure:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {FITZPATRICK_TYPES.map((ft) => (
                    <div
                      key={ft.type}
                      className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center space-x-3 bg-slate-50/40 dark:bg-slate-950/20"
                    >
                      <span
                        style={{ backgroundColor: ft.skinColor }}
                        className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 shadow-sm shrink-0"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {ft.name} — Sunburn threshold: {ft.medInSed.toFixed(1)} SED
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          {ft.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </div>

          </div>
        )}

      </main>

      {/* Humble Footer, beautifully balanced with no margin clutter */}
      <footer className="mt-12 sm:mt-20 border-t border-slate-200/50 dark:border-slate-900 py-5 sm:h-16 sm:py-0 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left text-[11px] sm:text-xs text-slate-400 dark:text-slate-650 px-4 sm:px-8 max-w-7xl mx-auto font-mono">
        <span>Sunwise Integration Calculus Model</span>
        <span className="font-medium">Continuous UV Forecast Network Protocol</span>
      </footer>

    </div>
  );
}
