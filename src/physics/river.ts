import { SITE_AREA_HA } from '../data/receptors';

export type RiverStatus = 'SAFE' | 'STRESSED' | 'CRITICAL' | 'ANOXIC';

export interface RiverAssumedParameters {
  riverVelocityMs: number;
  riverFlowM3s: number;
  baselineRiverBodMgL: number;
  baselineRiverDoMgL: number;
  deoxygenationKd20PerDay: number;
  reaerationKa20PerDay: number;
  runoffCoeffC: number;
  leachateBodMgL: number;
}

export const DEFAULT_RIVER_PARAMS: RiverAssumedParameters = {
  riverVelocityMs: 0.35,
  riverFlowM3s: 6.5,
  baselineRiverBodMgL: 3.2,
  baselineRiverDoMgL: 6.4,
  deoxygenationKd20PerDay: 0.35,
  reaerationKa20PerDay: 0.65,
  runoffCoeffC: 0.45,
  leachateBodMgL: 420,
};

export interface StreeterPhelpsPoint {
  distanceKm: number;
  travelTimeDays: number;
  doMgL: number;
  bodRemainingMgL: number;
  deficitMgL: number;
  status: RiverStatus;
}

export interface RiverWashoutResult {
  rainfallMmPerDay: number;
  waterTempC: number;
  doSaturationMgL: number;
  runoffPulseM3s: number;
  mixedInitialBodMgL: number;
  mixedInitialDoMgL: number;
  kdTempAdjusted: number;
  kaTempAdjusted: number;
  criticalSagTimeDays: number;
  criticalSagDistanceKm: number;
  trueCriticalSagDistanceKm: number;
  trueCriticalSagTimeDays: number;
  isSagBeyondReach: boolean;
  criticalMinDoMgL: number;
  status: RiverStatus;
  curve: StreeterPhelpsPoint[];
}

export function classifyRiverDo(doMgL: number): RiverStatus {
  if (doMgL < 2.0) return 'ANOXIC';
  if (doMgL < 4.0) return 'CRITICAL';
  if (doMgL < 5.5) return 'STRESSED';
  return 'SAFE';
}

// APHA Standard Methods freshwater DO saturation approximation (mg/L)
export function computeDoSaturationMgL(tempC: number): number {
  const t = Math.max(0, Math.min(40, tempC));
  const doSat =
    14.652 -
    0.41022 * t +
    0.007991 * t * t -
    0.000077774 * t * t * t;
  return Math.round(doSat * 100) / 100;
}

export function computeRiverWashout(params: {
  rainfallMmPerDay: number;
  airTempC: number;
  riverParams?: RiverAssumedParameters;
}): RiverWashoutResult {
  const rp = params.riverParams ?? DEFAULT_RIVER_PARAMS;
  const rain = Math.max(0, params.rainfallMmPerDay);
  const waterTempC = Math.max(20, Math.min(34, params.airTempC - 1.5));
  const doSat = computeDoSaturationMgL(waterTempC);

  // Rational Method: Q_runoff = C * i * A (44 ha = 440,000 m²)
  const areaM2 = SITE_AREA_HA * 10000;
  const intensityMs = rain / 1000 / 86400; // mm/day -> m/s
  const runoffPulseM3s = rp.runoffCoeffC * intensityMs * areaM2;

  // Mass-balance mixing at Brahmapuram leachate entry node
  const totalQ = rp.riverFlowM3s + runoffPulseM3s;
  const leachateDoMgL = 0.5;
  const mixedInitialBodMgL =
    (rp.riverFlowM3s * rp.baselineRiverBodMgL + runoffPulseM3s * rp.leachateBodMgL) /
    totalQ;
  const mixedInitialDoMgL = Math.min(
    doSat,
    (rp.riverFlowM3s * rp.baselineRiverDoMgL + runoffPulseM3s * leachateDoMgL) / totalQ
  );

  // Temperature corrections (Arrhenius theta)
  const kd = rp.deoxygenationKd20PerDay * Math.pow(1.047, waterTempC - 20);
  const ka = rp.reaerationKa20PerDay * Math.pow(1.024, waterTempC - 20);

  // Ultimate CBOD L0 ≈ 1.46 * BOD5
  const L0 = mixedInitialBodMgL * 1.46;
  const D0 = Math.max(0, doSat - mixedInitialDoMgL);

  const velocityKmPerDay = Math.max(0.05, rp.riverVelocityMs) * 86.4;

  const evalDeficitAtTime = (tDays: number): number => {
    if (Math.abs(ka - kd) < 1e-5) {
      return (kd * L0 * tDays + D0) * Math.exp(-ka * tDays);
    }
    return (
      ((kd * L0) / (ka - kd)) * (Math.exp(-kd * tDays) - Math.exp(-ka * tDays)) +
      D0 * Math.exp(-ka * tDays)
    );
  };

  // Analytical critical time t_c
  let tCritDays = 0;
  if (kd * L0 > ka * D0 && Math.abs(ka - kd) > 1e-5) {
    const ratio = (ka / kd) * (1 - (D0 * (ka - kd)) / (kd * L0));
    if (ratio > 0) {
      tCritDays = Math.max(0, Math.log(ratio) / (ka - kd));
    }
  }
  const xCritKmRaw = tCritDays * velocityKmPerDay;
  const clampedCritKm = Math.min(12, Math.max(0, xCritKmRaw));

  const curve: StreeterPhelpsPoint[] = [];
  let minDo = doSat;
  let minDoKm = 0;

  for (let dKm = 0; dKm <= 12; dKm += 0.5) {
    const tDays = dKm / velocityKmPerDay;
    const deficit = evalDeficitAtTime(tDays);
    const doVal = Math.max(0, Math.round((doSat - deficit) * 100) / 100);
    const bodRem = Math.round(L0 * Math.exp(-kd * tDays) * 100) / 100;
    if (doVal < minDo) {
      minDo = doVal;
      minDoKm = dKm;
    }
    curve.push({
      distanceKm: dKm,
      travelTimeDays: Math.round(tDays * 100) / 100,
      doMgL: doVal,
      bodRemainingMgL: bodRem,
      deficitMgL: Math.round(deficit * 100) / 100,
      status: classifyRiverDo(doVal),
    });
  }

  // Exact DO at critical distance if inside 0-12 km
  const critT = clampedCritKm / velocityKmPerDay;
  const critDo = Math.max(
    0,
    Math.round((doSat - evalDeficitAtTime(critT)) * 100) / 100
  );
  const finalMinDo = Math.min(minDo, critDo);
  const finalCritKm =
    critDo <= minDo ? Math.round(clampedCritKm * 100) / 100 : minDoKm;
  const finalCritTimeDays = Math.round((finalCritKm / velocityKmPerDay) * 100) / 100;

  const isSagBeyondReach = xCritKmRaw > 12;
  const trueCriticalSagDistanceKm = isSagBeyondReach
    ? Math.round(xCritKmRaw * 10) / 10
    : finalCritKm;
  const trueCriticalSagTimeDays = isSagBeyondReach
    ? Math.round((xCritKmRaw / velocityKmPerDay) * 100) / 100
    : finalCritTimeDays;

  return {
    rainfallMmPerDay: Math.round(rain * 10) / 10,
    waterTempC: Math.round(waterTempC * 10) / 10,
    doSaturationMgL: doSat,
    runoffPulseM3s: Math.round(runoffPulseM3s * 10000) / 10000,
    mixedInitialBodMgL: Math.round(mixedInitialBodMgL * 100) / 100,
    mixedInitialDoMgL: Math.round(mixedInitialDoMgL * 100) / 100,
    kdTempAdjusted: Math.round(kd * 1000) / 1000,
    kaTempAdjusted: Math.round(ka * 1000) / 1000,
    criticalSagTimeDays: finalCritTimeDays,
    criticalSagDistanceKm: finalCritKm,
    trueCriticalSagDistanceKm,
    trueCriticalSagTimeDays,
    isSagBeyondReach,
    criticalMinDoMgL: finalMinDo,
    status: classifyRiverDo(finalMinDo),
    curve,
  };
}
