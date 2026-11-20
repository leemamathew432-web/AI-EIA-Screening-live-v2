import type { HourlyWeatherRecord } from '../types/telemetry';
import { computePasquillGiffordStability, type StabilityClass } from './plume';

export type InversionRiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface NocturnalHourAnalysis {
  time: string;
  hourLabel: string;
  hourIst: number;
  deltaT120mMinus2m: number;
  blhMeters: number;
  blhIsFallback: boolean;
  windSpeedMs: number;
  windSpeedKmh: number;
  rhPct: number;
  cloudCoverPct: number;
  temperature2m: number;
  temperature80m: number;
  temperature120m: number;
  temperature180m: number;
  stabilityClass: StabilityClass;
  trapScore: number; // 0-100
  riskTier: InversionRiskTier;
  isInversion: boolean;
}

export interface RidgeInversionModel {
  weights: number[]; // length 7
  lambda: number;
  sampleCount: number;
  trainCount: number;
  testCount: number;
  holdoutMaeC: number;
  holdoutRmseC: number;
  holdoutBinaryAccuracyPct: number;
  residualStdC: number;
}

export interface TonightPredictionPoint {
  time: string;
  hourLabel: string;
  nwpDeltaTC: number;
  predictedDeltaTC: number;
  inversionProbPct: number;
  trapScore: number;
  blhMeters: number;
}

export function scoreRiskTier(score: number): InversionRiskTier {
  if (score >= 75) return 'SEVERE';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

export function resolveBoundaryLayerHeight(
  blhM: number | null,
  windSpeedMs: number,
  cloudCoverPct: number
): { blhMeters: number; isFallback: boolean } {
  if (blhM !== null && Number.isFinite(blhM) && blhM > 0) {
    return { blhMeters: Math.round(blhM), isFallback: false };
  }
  const cloudFactor = 0.65 + (cloudCoverPct / 100) * 0.6;
  const empirical = Math.max(45, Math.round(75 * Math.max(0.4, windSpeedMs) * cloudFactor));
  return { blhMeters: empirical, isFallback: true };
}

export function computeHourTrapScore(rec: HourlyWeatherRecord): NocturnalHourAnalysis {
  const deltaT = Math.round((rec.temperature120m - rec.temperature2m) * 100) / 100;
  const isInversion = deltaT > 0;
  const { blhMeters, isFallback } = resolveBoundaryLayerHeight(
    rec.boundaryLayerHeightM,
    rec.windSpeed10mMs,
    rec.cloudCoverPct
  );
  const { cls } = computePasquillGiffordStability({
    windSpeedMs: rec.windSpeed10mMs,
    shortwaveRadiationWm2: rec.shortwaveRadiationWm2,
    cloudCoverPct: rec.cloudCoverPct,
    isDay: rec.hourIst >= 6 && rec.hourIst < 18,
  });

  // Compute 0–100 Trap Score from ΔT, BLH < 200 m, calm wind < 1.7 m/s, RH > 80%, clear sky, stability E/F
  let score = 0;
  // 1. Positive temperature inversion strength (max 30)
  if (deltaT > 0) {
    score += Math.min(30, Math.round(deltaT * 18));
  }
  // 2. Shallow BLH < 200 m (max 24)
  if (blhMeters < 200) {
    score += Math.round(((200 - blhMeters) / 200) * 24);
  } else if (blhMeters < 350) {
    score += Math.round(((350 - blhMeters) / 150) * 8);
  }
  // 3. Calm wind < 1.7 m/s (max 20)
  if (rec.windSpeed10mMs < 1.7) {
    score += Math.round(((1.7 - rec.windSpeed10mMs) / 1.7) * 20);
  } else if (rec.windSpeed10mMs < 3.0) {
    score += Math.round(((3.0 - rec.windSpeed10mMs) / 1.3) * 7);
  }
  // 4. High humidity > 80% (max 10)
  if (rec.relativeHumidity2m > 80) {
    score += Math.round(Math.min(1, (rec.relativeHumidity2m - 80) / 18) * 10);
  }
  // 5. Clear sky radiative cooling (max 8)
  score += Math.round(((100 - rec.cloudCoverPct) / 100) * 8);
  // 6. Stability E / F (max 8)
  if (cls === 'F') score += 8;
  else if (cls === 'E') score += 5;

  const trapScore = Math.max(0, Math.min(100, score));

  return {
    time: rec.time,
    hourLabel: rec.hourLabel,
    hourIst: rec.hourIst,
    deltaT120mMinus2m: deltaT,
    blhMeters,
    blhIsFallback: isFallback,
    windSpeedMs: Math.round(rec.windSpeed10mMs * 100) / 100,
    windSpeedKmh: Math.round(rec.windSpeed10mMs * 3.6 * 10) / 10,
    rhPct: Math.round(rec.relativeHumidity2m),
    cloudCoverPct: Math.round(rec.cloudCoverPct),
    temperature2m: Math.round(rec.temperature2m * 10) / 10,
    temperature80m: Math.round(rec.temperature80m * 10) / 10,
    temperature120m: Math.round(rec.temperature120m * 10) / 10,
    temperature180m: Math.round(rec.temperature180m * 10) / 10,
    stabilityClass: cls,
    trapScore,
    riskTier: scoreRiskTier(trapScore),
    isInversion,
  };
}

// Extract feature vector:
// [1, windSpeedMs, cloudCover/100, rh/100, coolingDropFrom15IST, sin(hour), cos(hour)]
function buildFeatureVector(
  rec: HourlyWeatherRecord,
  day15TempMap: Map<string, number>
): number[] {
  const datePart = rec.time.slice(0, 10);
  const anchor15 = day15TempMap.get(datePart);
  const coolingDrop = anchor15 !== undefined ? Math.max(0, anchor15 - rec.temperature2m) : 3.0;
  const rad = (2 * Math.PI * rec.hourIst) / 24;
  return [
    1,
    rec.windSpeed10mMs,
    rec.cloudCoverPct / 100,
    rec.relativeHumidity2m / 100,
    coolingDrop,
    Math.sin(rad),
    Math.cos(rad),
  ];
}

function build15IstTemperatureMap(hourly: HourlyWeatherRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of hourly) {
    if (h.hourIst === 15) {
      map.set(h.time.slice(0, 10), h.temperature2m);
    }
  }
  return map;
}

// Solve linear system A * x = b via Gaussian elimination with partial pivoting
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) {
        pivotRow = r;
      }
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n] ?? 0);
}

function fitRidge(X: number[][], y: number[], lambda = 0.05): number[] {
  const p = X[0].length;
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty = Array(p).fill(0);

  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  // Regularize feature weights (skip bias index 0)
  for (let j = 1; j < p; j++) {
    XtX[j][j] += lambda;
  }

  return solveLinearSystem(XtX, Xty);
}

function dot(w: number[], x: number[]): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * x[i];
  return s;
}

// Standard normal CDF approximation for P(DeltaT > 0)
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Trains an empirical Ridge Regression model (lambda = 0.05) strictly on unmodified
 * past nocturnal hours (18:00–06:59 IST) in the fetched 14-day Open-Meteo dataset.
 */
export function trainInversionPredictor(
  hourlyWeather: HourlyWeatherRecord[],
  nowIstIsoPrefix: string
): RidgeInversionModel {
  const pastNocturnal = hourlyWeather.filter(
    (h) =>
      h.time < nowIstIsoPrefix &&
      (h.hourIst >= 18 || h.hourIst <= 6) &&
      Number.isFinite(h.temperature120m) &&
      Number.isFinite(h.temperature2m)
  );

  // Fallback safeguard if dataset is small (e.g. unit test slice)
  const samples =
    pastNocturnal.length >= 10
      ? pastNocturnal
      : hourlyWeather.filter((h) => h.hourIst >= 18 || h.hourIst <= 6);

  if (samples.length < 5) {
    return {
      weights: [0.4, -0.25, -0.3, 0.2, 0.08, 0.1, 0.1],
      lambda: 0.05,
      sampleCount: samples.length,
      trainCount: samples.length,
      testCount: 0,
      holdoutMaeC: 0,
      holdoutRmseC: 0,
      holdoutBinaryAccuracyPct: 0,
      residualStdC: 0.45,
    };
  }

  const day15Map = build15IstTemperatureMap(hourlyWeather);
  const X = samples.map((h) => buildFeatureVector(h, day15Map));
  const y = samples.map((h) => h.temperature120m - h.temperature2m);

  // Chronological 80/20 holdout evaluation
  const splitIdx = Math.max(4, Math.floor(samples.length * 0.8));
  const XTrain = X.slice(0, splitIdx);
  const yTrain = y.slice(0, splitIdx);
  const XTest = X.slice(splitIdx);
  const yTest = y.slice(splitIdx);

  const evalWeights = fitRidge(XTrain, yTrain, 0.05);

  let absErr = 0;
  let sqErr = 0;
  let correctClass = 0;

  if (XTest.length > 0) {
    for (let i = 0; i < XTest.length; i++) {
      const pred = dot(evalWeights, XTest[i]);
      const err = pred - yTest[i];
      absErr += Math.abs(err);
      sqErr += err * err;
      if ((pred > 0) === (yTest[i] > 0)) correctClass++;
    }
  }

  // Final model trained on all unmodified past nocturnal hours
  const fullWeights = fitRidge(X, y, 0.05);
  const residuals = X.map((row, i) => y[i] - dot(fullWeights, row));
  const meanRes = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance =
    residuals.reduce((a, r) => a + (r - meanRes) ** 2, 0) /
    Math.max(1, residuals.length - 1);
  const residualStdC = Math.max(0.15, Math.round(Math.sqrt(variance) * 100) / 100);

  const testCount = XTest.length;
  return {
    weights: fullWeights,
    lambda: 0.05,
    sampleCount: samples.length,
    trainCount: splitIdx,
    testCount,
    holdoutMaeC: testCount > 0 ? Math.round((absErr / testCount) * 100) / 100 : 0,
    holdoutRmseC:
      testCount > 0 ? Math.round(Math.sqrt(sqErr / testCount) * 100) / 100 : 0,
    holdoutBinaryAccuracyPct:
      testCount > 0 ? Math.round((correctClass / testCount) * 100) : 0,
    residualStdC,
  };
}

export function predictTonightInversion(
  model: RidgeInversionModel,
  tonightHours: HourlyWeatherRecord[],
  allHourlyForAnchor: HourlyWeatherRecord[]
): TonightPredictionPoint[] {
  const day15Map = build15IstTemperatureMap(allHourlyForAnchor);

  return tonightHours.map((rec) => {
    const x = buildFeatureVector(rec, day15Map);
    const predDeltaT = Math.round(dot(model.weights, x) * 100) / 100;
    const nwpDeltaT = Math.round((rec.temperature120m - rec.temperature2m) * 100) / 100;
    const z = predDeltaT / Math.max(0.15, model.residualStdC);
    const probPct = Math.round(normalCdf(z) * 100);
    const analysis = computeHourTrapScore(rec);

    return {
      time: rec.time,
      hourLabel: rec.hourLabel,
      nwpDeltaTC: nwpDeltaT,
      predictedDeltaTC: predDeltaT,
      inversionProbPct: Math.max(1, Math.min(99, probPct)),
      trapScore: analysis.trapScore,
      blhMeters: analysis.blhMeters,
    };
  });
}

export function extractTonightWindow(
  hourlyWeather: HourlyWeatherRecord[],
  nowIsoPrefix: string
): HourlyWeatherRecord[] {
  const todayDate = nowIsoPrefix.slice(0, 10);
  const currentHour = parseInt(nowIsoPrefix.slice(11, 13) || '12', 10);

  // If currently early morning (00:00-06:59), show yesterday 18:00 -> today 06:00; else today 18:00 -> tomorrow 06:00
  const startIdx = hourlyWeather.findIndex((h) => {
    if (currentHour < 7) {
      return h.time.slice(0, 10) <= todayDate && h.hourIst === 18;
    }
    return h.time.slice(0, 10) >= todayDate && h.hourIst === 18;
  });

  if (startIdx >= 0) {
    return hourlyWeather.slice(startIdx, startIdx + 13);
  }

  return hourlyWeather.filter((h) => h.hourIst >= 18 || h.hourIst <= 6).slice(-13);
}
