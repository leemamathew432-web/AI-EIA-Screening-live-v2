import type { HourlyAirRecord } from '../types/telemetry';

export type NaqiCategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe';

export interface NaqiSubIndex {
  pollutant: 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'O3' | 'CO';
  label: string;
  concentration: number; // 24-h or 8-h average
  currentConcentration: number; // current 1-h instantaneous value
  averagingPeriod: '24-h avg' | '8-h avg';
  unit: string;
  naaqsLimit: number | null;
  subIndex: number;
}

export interface NaqiResult {
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: NaqiSubIndex['pollutant'];
  dominantAveragingPeriod: '24-h avg' | '8-h avg';
  subIndices: NaqiSubIndex[];
  isAveragesReady: boolean;
}

export interface NaqiComputeInput {
  hourlyAir?: HourlyAirRecord[];
  nowIsoPrefix?: string;

  // Direct pollutant concentrations (averages or fallback values)
  pm25?: number;
  pm10?: number;
  no2?: number;
  so2?: number;
  ozone?: number;
  coMgM3?: number;

  // Optional 1-h instantaneous/current values
  currentPm25?: number;
  currentPm10?: number;
  currentNo2?: number;
  currentSo2?: number;
  currentOzone?: number;
  currentCoMgM3?: number;
}

type Breakpoint = [number, number, number, number]; // [cLow, cHigh, iLow, iHigh]

const PM25_BP: Breakpoint[] = [
  [0, 30, 0, 50],
  [30, 60, 51, 100],
  [60, 90, 101, 200],
  [90, 120, 201, 300],
  [120, 250, 301, 400],
  [250, 500, 401, 500],
];

const PM10_BP: Breakpoint[] = [
  [0, 50, 0, 50],
  [50, 100, 51, 100],
  [100, 250, 101, 200],
  [250, 350, 201, 300],
  [350, 430, 301, 400],
  [430, 800, 401, 500],
];

const NO2_BP: Breakpoint[] = [
  [0, 40, 0, 50],
  [40, 80, 51, 100],
  [80, 180, 101, 200],
  [180, 280, 201, 300],
  [280, 400, 301, 400],
  [400, 800, 401, 500],
];

const SO2_BP: Breakpoint[] = [
  [0, 40, 0, 50],
  [40, 80, 51, 100],
  [80, 380, 101, 200],
  [380, 800, 201, 300],
  [800, 1600, 301, 400],
  [1600, 2400, 401, 500],
];

const O3_BP: Breakpoint[] = [
  [0, 50, 0, 50],
  [50, 100, 51, 100],
  [100, 168, 101, 200],
  [168, 208, 201, 300],
  [208, 748, 301, 400],
  [748, 1000, 401, 500],
];

// CO in mg/m³ (8-hr)
const CO_BP: Breakpoint[] = [
  [0, 1.0, 0, 50],
  [1.0, 2.0, 51, 100],
  [2.0, 10.0, 101, 200],
  [10.0, 17.0, 201, 300],
  [17.0, 34.0, 301, 400],
  [34.0, 60.0, 401, 500],
];

export function interpolateBreakpoint(value: number, bps: Breakpoint[]): number {
  const v = Math.max(0, value);
  for (const [cLow, cHigh, iLow, iHigh] of bps) {
    if (v <= cHigh) {
      const span = cHigh - cLow;
      if (span <= 0) return iLow;
      return Math.round(((iHigh - iLow) / span) * (v - cLow) + iLow);
    }
  }
  return 500;
}

export function classifyNaqi(aqi: number): NaqiCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function computeIndianNaqi(input: NaqiComputeInput): NaqiResult {
  let pm25Val = input.pm25 ?? 0;
  let pm10Val = input.pm10 ?? 0;
  let no2Val = input.no2 ?? 0;
  let so2Val = input.so2 ?? 0;
  let o3Val = input.ozone ?? 0;
  let coVal = input.coMgM3 ?? 0;

  let curPm25 = input.currentPm25 ?? pm25Val;
  let curPm10 = input.currentPm10 ?? pm10Val;
  let curNo2 = input.currentNo2 ?? no2Val;
  let curSo2 = input.currentSo2 ?? so2Val;
  let curO3 = input.currentOzone ?? o3Val;
  let curCo = input.currentCoMgM3 ?? coVal;

  let isAveragesReady = false;

  if (input.hourlyAir && input.hourlyAir.length > 0) {
    const now = input.nowIsoPrefix ?? '';
    const pastRecords = now
      ? input.hourlyAir.filter((h) => h.time <= now)
      : input.hourlyAir;
    const history = pastRecords.length > 0 ? pastRecords : input.hourlyAir;

    // PM2.5, PM10, NO2, SO2: average of last 24 hourly values
    const last24 = history.slice(-24);
    // O3 and CO: average of last 8 hourly values
    const last8 = history.slice(-8);
    const latest = history[history.length - 1];

    if (last24.length > 0) {
      pm25Val = last24.reduce((s, h) => s + (h.pm25 || 0), 0) / last24.length;
      pm10Val = last24.reduce((s, h) => s + (h.pm10 || 0), 0) / last24.length;
      no2Val = last24.reduce((s, h) => s + (h.no2 || 0), 0) / last24.length;
      so2Val = last24.reduce((s, h) => s + (h.so2 || 0), 0) / last24.length;
    }
    if (last8.length > 0) {
      o3Val = last8.reduce((s, h) => s + (h.ozone || 0), 0) / last8.length;
      coVal = last8.reduce((s, h) => s + (h.coMgM3 || 0), 0) / last8.length;
    }
    if (latest) {
      curPm25 = input.currentPm25 ?? latest.pm25;
      curPm10 = input.currentPm10 ?? latest.pm10;
      curNo2 = input.currentNo2 ?? latest.no2;
      curSo2 = input.currentSo2 ?? latest.so2;
      curO3 = input.currentOzone ?? latest.ozone;
      curCo = input.currentCoMgM3 ?? latest.coMgM3;
    }

    // Averages are ready once at least 8 hours of hourly history are available
    if (last8.length >= 8) {
      isAveragesReady = true;
    }
  }

  const subIndices: NaqiSubIndex[] = [
    {
      pollutant: 'PM2.5',
      label: 'PM₂.₅',
      concentration: Math.round(pm25Val * 10) / 10,
      currentConcentration: Math.round(curPm25 * 10) / 10,
      averagingPeriod: '24-h avg',
      unit: 'µg/m³',
      naaqsLimit: 60,
      subIndex: interpolateBreakpoint(pm25Val, PM25_BP),
    },
    {
      pollutant: 'PM10',
      label: 'PM₁₀',
      concentration: Math.round(pm10Val * 10) / 10,
      currentConcentration: Math.round(curPm10 * 10) / 10,
      averagingPeriod: '24-h avg',
      unit: 'µg/m³',
      naaqsLimit: 100,
      subIndex: interpolateBreakpoint(pm10Val, PM10_BP),
    },
    {
      pollutant: 'NO2',
      label: 'NO₂',
      concentration: Math.round(no2Val * 10) / 10,
      currentConcentration: Math.round(curNo2 * 10) / 10,
      averagingPeriod: '24-h avg',
      unit: 'µg/m³',
      naaqsLimit: 80,
      subIndex: interpolateBreakpoint(no2Val, NO2_BP),
    },
    {
      pollutant: 'SO2',
      label: 'SO₂',
      concentration: Math.round(so2Val * 10) / 10,
      currentConcentration: Math.round(curSo2 * 10) / 10,
      averagingPeriod: '24-h avg',
      unit: 'µg/m³',
      naaqsLimit: 80,
      subIndex: interpolateBreakpoint(so2Val, SO2_BP),
    },
    {
      pollutant: 'O3',
      label: 'O₃',
      concentration: Math.round(o3Val * 10) / 10,
      currentConcentration: Math.round(curO3 * 10) / 10,
      averagingPeriod: '8-h avg',
      unit: 'µg/m³',
      naaqsLimit: 100,
      subIndex: interpolateBreakpoint(o3Val, O3_BP),
    },
    {
      pollutant: 'CO',
      label: 'CO',
      concentration: Math.round(coVal * 100) / 100,
      currentConcentration: Math.round(curCo * 100) / 100,
      averagingPeriod: '8-h avg',
      unit: 'mg/m³',
      naaqsLimit: 2.0,
      subIndex: interpolateBreakpoint(coVal, CO_BP),
    },
  ];

  let best = subIndices[0];
  for (const s of subIndices) {
    if (s.subIndex > best.subIndex) {
      best = s;
    }
  }

  return {
    aqi: best.subIndex,
    category: classifyNaqi(best.subIndex),
    dominantPollutant: best.pollutant,
    dominantAveragingPeriod: best.averagingPeriod,
    subIndices,
    isAveragesReady,
  };
}
