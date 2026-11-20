import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  computeEiaVerdict,
  type EiaHistoryPoint,
  type EiaMatrixResult,
} from '../physics/eiaMatrix';
import {
  computeHourTrapScore,
  extractTonightWindow,
  predictTonightInversion,
  trainInversionPredictor,
  type NocturnalHourAnalysis,
  type RidgeInversionModel,
  type TonightPredictionPoint,
} from '../physics/inversion';
import { computeIndianNaqi, type NaqiResult } from '../physics/naqi';
import { computePlumeSimulation, type PlumeSimulationResult } from '../physics/plume';
import {
  DEFAULT_RIVER_PARAMS,
  computeRiverWashout,
  type RiverAssumedParameters,
  type RiverWashoutResult,
} from '../physics/river';
import {
  fetchOpenMeteoBundle,
  formatIstTime,
  getNowKolkataIsoPrefix,
  loadCachedBundle,
} from '../services/openMeteo';
import type { OpenMeteoBundle } from '../types/telemetry';

const POLL_SECONDS = 300; // 5 minutes
const EIA_HISTORY_STORAGE_KEY = 'aieia_eia_matrix_history_v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function loadEiaHistory(): EiaHistoryPoint[] {
  try {
    const raw = localStorage.getItem(EIA_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EiaHistoryPoint[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return parsed.filter((p) => new Date(p.timestampIso).getTime() >= cutoff);
  } catch {
    return [];
  }
}

function saveEiaHistoryPoint(point: EiaHistoryPoint): EiaHistoryPoint[] {
  const existing = loadEiaHistory();
  if (existing.some((p) => p.timestampIso === point.timestampIso)) {
    return existing;
  }
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const next = [...existing, point]
    .filter((p) => new Date(p.timestampIso).getTime() >= cutoff)
    .slice(-2016); // up to 7 days of 5-min samples
  try {
    localStorage.setItem(EIA_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export interface PlumeSimulationParams {
  dirDeg: number | null;
  speedKmh: number | null;
  halfConeDeg: number;
}

const DEFAULT_PLUME_SIM: PlumeSimulationParams = {
  dirDeg: null,
  speedKmh: null,
  halfConeDeg: 15,
};

interface ObservatoryContextValue {
  bundle: OpenMeteoBundle | null;
  loading: boolean;
  fetchError: string | null;
  istClock: string;
  countdownSeconds: number;
  refreshNow: () => Promise<void>;
  naqi: NaqiResult | null;
  plume: PlumeSimulationResult | null;
  plumeSim: PlumeSimulationParams;
  setPlumeSim: (updater: (prev: PlumeSimulationParams) => PlumeSimulationParams) => void;
  resetPlumeSim: () => void;
  isPlumeSimulated: boolean;
  tonightHours: NocturnalHourAnalysis[];
  ridgeModel: RidgeInversionModel | null;
  tonightPredictions: TonightPredictionPoint[];
  riverAssumedParams: RiverAssumedParameters;
  setRiverAssumedParams: (p: RiverAssumedParameters) => void;
  riverWashout: RiverWashoutResult | null;
  eiaMatrix: EiaMatrixResult | null;
  eiaHistory: EiaHistoryPoint[];
}

const ObservatoryContext = createContext<ObservatoryContextValue | null>(null);

export function ObservatoryProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<OpenMeteoBundle | null>(() => loadCachedBundle());
  const [loading, setLoading] = useState<boolean>(!loadCachedBundle());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [istClock, setIstClock] = useState<string>(() => formatIstTime());
  const [countdownSeconds, setCountdownSeconds] = useState<number>(POLL_SECONDS);
  const [riverAssumedParams, setRiverAssumedParams] =
    useState<RiverAssumedParameters>(DEFAULT_RIVER_PARAMS);
  const [plumeSim, setPlumeSim] = useState<PlumeSimulationParams>(DEFAULT_PLUME_SIM);
  const [eiaHistory, setEiaHistory] = useState<EiaHistoryPoint[]>(() => loadEiaHistory());

  const resetPlumeSim = useCallback(() => {
    setPlumeSim(DEFAULT_PLUME_SIM);
  }, []);

  const isPlumeSimulated =
    plumeSim.dirDeg !== null || plumeSim.speedKmh !== null || plumeSim.halfConeDeg !== 15;

  const refreshNow = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const next = await fetchOpenMeteoBundle();
      setBundle(next);
      setCountdownSeconds(POLL_SECONDS);
    } catch (err) {
      setFetchError(
        err instanceof Error
          ? err.message
          : 'Live Open-Meteo data unavailable.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNow();
    const pollId = window.setInterval(() => {
      refreshNow();
    }, POLL_SECONDS * 1000);

    const tickId = window.setInterval(() => {
      setIstClock(formatIstTime());
      setCountdownSeconds((prev) => (prev <= 1 ? POLL_SECONDS : prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, [refreshNow]);

  const computed = useMemo(() => {
    if (!bundle) {
      return {
        naqi: null,
        plume: null,
        tonightHours: [],
        ridgeModel: null,
        tonightPredictions: [],
        riverWashout: null,
        eiaMatrix: null,
      };
    }

    const nowPrefix = getNowKolkataIsoPrefix();

    const naqi = computeIndianNaqi({
      hourlyAir: bundle.hourlyAir,
      nowIsoPrefix: nowPrefix,
      pm25: bundle.currentAir.pm25,
      pm10: bundle.currentAir.pm10,
      no2: bundle.currentAir.no2,
      so2: bundle.currentAir.so2,
      ozone: bundle.currentAir.ozone,
      coMgM3: bundle.currentAir.coMgM3,
      currentPm25: bundle.currentAir.pm25,
      currentPm10: bundle.currentAir.pm10,
      currentNo2: bundle.currentAir.no2,
      currentSo2: bundle.currentAir.so2,
      currentOzone: bundle.currentAir.ozone,
      currentCoMgM3: bundle.currentAir.coMgM3,
    });

    const activeWindSpeedMs =
      plumeSim.speedKmh !== null ? plumeSim.speedKmh / 3.6 : bundle.currentWeather.windSpeed10mMs;
    const activeWindDirDeg = plumeSim.dirDeg ?? bundle.currentWeather.windDirection10mDeg;

    const plume = computePlumeSimulation({
      windSpeedMs: activeWindSpeedMs,
      windDirectionFromDeg: activeWindDirDeg,
      shortwaveRadiationWm2: bundle.currentWeather.shortwaveRadiationWm2,
      cloudCoverPct: bundle.currentWeather.cloudCoverPct,
      isDay: bundle.currentWeather.isDay,
      halfConeDeg: plumeSim.halfConeDeg,
    });
    const tonightRaw = extractTonightWindow(bundle.hourlyWeather, nowPrefix);
    const tonightHours = tonightRaw.map(computeHourTrapScore);
    const ridgeModel = trainInversionPredictor(bundle.hourlyWeather, nowPrefix);
    const tonightPredictions = predictTonightInversion(
      ridgeModel,
      tonightRaw,
      bundle.hourlyWeather
    );

    const riverWashout = computeRiverWashout({
      rainfallMmPerDay: bundle.daily.precipitationSumToday,
      airTempC: bundle.currentWeather.temperature2m,
      riverParams: riverAssumedParams,
    });

    const eiaMatrix = computeEiaVerdict({
      plume,
      tonightHours,
      riverWashout,
      naqi,
      lastUpdatedIst: bundle.lastGoodIstLabel,
      isStaleCache: bundle.isStaleCache,
    });

    return {
      naqi,
      plume,
      tonightHours,
      ridgeModel,
      tonightPredictions,
      riverWashout,
      eiaMatrix,
    };
  }, [bundle, riverAssumedParams, plumeSim]);

  // Persist 7-day EIA screening verdict history on each fresh bundle timestamp
  useEffect(() => {
    if (!bundle || !computed.eiaMatrix || bundle.isStaleCache || isPlumeSimulated) return;
    const rowScores: Record<string, number | null> = {};
    for (const r of computed.eiaMatrix.rows) {
      rowScores[r.id] = r.score;
    }
    const nextHistory = saveEiaHistoryPoint({
      timestampIso: bundle.fetchedAtIso,
      timeLabelIst: bundle.lastGoodIstLabel.slice(0, 5),
      overallScore: computed.eiaMatrix.overallScore,
      verdict: computed.eiaMatrix.verdict,
      rowScores,
    });
    setEiaHistory(nextHistory);
  }, [bundle, computed.eiaMatrix, isPlumeSimulated]);

  return (
    <ObservatoryContext.Provider
      value={{
        bundle,
        loading,
        fetchError,
        istClock,
        countdownSeconds,
        refreshNow,
        ...computed,
        plumeSim,
        setPlumeSim,
        resetPlumeSim,
        isPlumeSimulated,
        riverAssumedParams,
        setRiverAssumedParams,
        eiaHistory,
      }}
    >
      {children}
    </ObservatoryContext.Provider>
  );
}

export function useObservatory() {
  const ctx = useContext(ObservatoryContext);
  if (!ctx) throw new Error('useObservatory must be used inside ObservatoryProvider');
  return ctx;
}
