import { BIOMINING_MILESTONES } from '../data/published';
import type { ReceptorDefinition } from '../data/receptors';
import type { HourlyAirRecord, HourlyWeatherRecord } from '../types/telemetry';
import { computeHourTrapScore, type NocturnalHourAnalysis } from './inversion';
import { classifyNaqi, computeIndianNaqi, type NaqiCategory, type NaqiResult } from './naqi';
import { computePlumeSimulation, type PlumeSimulationResult } from './plume';
import {
  DEFAULT_RIVER_PARAMS,
  computeRiverWashout,
  type RiverAssumedParameters,
  type RiverWashoutResult,
} from './river';

export type SignificanceScore = 1 | 2 | 3 | 4;
export type SignificanceLabel = 'Low' | 'Moderate' | 'High' | 'Severe';
export type OverallVerdictTier = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface EiaMatrixRow {
  number: number;
  id:
    | 'air-receptors'
    | 'night-trapping'
    | 'air-quality'
    | 'water'
    | 'land-waste'
    | 'health-institutions'
    | 'fire'
    | 'social';
  component: string;
  sourceLabel: string;
  sourcePath: string | null;
  indicator: string;
  valueDisplay: string;
  score: SignificanceScore | null;
  significance: SignificanceLabel | 'No data';
  weight: number;
  weightedScore: number | null;
  dataStatus: 'LIVE' | 'MODELLED' | 'PUBLISHED' | 'MISSING';
  statusTimeOrDate: string;
  mitigation: string;
}

export interface LeopoldCell {
  component: 'Air' | 'Water' | 'Land' | 'Health' | 'Social';
  magnitude: number | null; // -4..+4, null means '–' (no interaction) or missing data
  noData?: boolean;
  reason: string;
  sourceRef: string;
}

export interface LeopoldRow {
  activity: string;
  cells: LeopoldCell[];
}

export interface EiaOutlookHour {
  time: string;
  hourLabel: string;
  scores: {
    airReceptors: SignificanceScore;
    nightTrapping: SignificanceScore;
    airQuality: SignificanceScore | null;
    water: SignificanceScore;
  };
}

export interface EiaMatrixResult {
  rows: EiaMatrixRow[];
  missingInputs: string[];
  usedWeightSum: number;
  overallScore: number;
  verdict: OverallVerdictTier;
  verdictDescription: string;
  topDrivers: EiaMatrixRow[];
  distribution: Record<SignificanceLabel, number>;
  leopold: LeopoldRow[];
}

export interface EiaHistoryPoint {
  timestampIso: string;
  timeLabelIst: string;
  overallScore: number;
  verdict: OverallVerdictTier;
  rowScores: Record<string, number | null>;
}

export function scoreToLabel(score: SignificanceScore): SignificanceLabel {
  if (score === 1) return 'Low';
  if (score === 2) return 'Moderate';
  if (score === 3) return 'High';
  return 'Severe';
}

export function scoreAirReceptors(plume: PlumeSimulationResult): {
  weightedReceptorCount: number;
  affectedNames: string[];
  directDownwindSchool: boolean;
  score: SignificanceScore;
} {
  let count = 0;
  let directDownwindSchool = false;
  const affectedNames: string[] = [];

  for (const r of plume.receptors) {
    const base =
      r.status === 'DIRECT DOWNWIND'
        ? 1
        : r.status === 'CROSSWIND EDGE'
        ? 0.5
        : 0;
    if (base > 0) {
      const isSchoolOrKg =
        r.receptor.category === 'School' || r.receptor.category === 'Kindergarten';
      const mult = isSchoolOrKg ? 2 : 1;
      count += base * mult;
      affectedNames.push(r.receptor.shortName);
      if (isSchoolOrKg && r.status === 'DIRECT DOWNWIND') {
        directDownwindSchool = true;
      }
    }
  }

  const roundedCount = Math.round(count * 10) / 10;
  let score: SignificanceScore = 1;
  if (directDownwindSchool || roundedCount > 3) score = 4;
  else if (roundedCount > 1) score = 3;
  else if (roundedCount > 0) score = 2;

  return { weightedReceptorCount: roundedCount, affectedNames, directDownwindSchool, score };
}

export function scoreNightTrapping(peakTrapScore: number): SignificanceScore {
  if (peakTrapScore >= 90) return 4;
  if (peakTrapScore >= 70) return 3;
  if (peakTrapScore >= 40) return 2;
  return 1;
}

export function scoreNaqiCategory(category: NaqiCategory): SignificanceScore {
  if (category === 'Very Poor' || category === 'Severe') return 4;
  if (category === 'Poor') return 3;
  if (category === 'Moderate') return 2;
  return 1;
}

export function scoreRiverDo(minDoMgL: number): SignificanceScore {
  if (minDoMgL < 2) return 4;
  if (minDoMgL < 4) return 3;
  if (minDoMgL < 5) return 2;
  return 1;
}

export function scoreWasteRemaining(pctRemaining: number): SignificanceScore {
  if (pctRemaining > 70) return 4;
  if (pctRemaining > 40) return 3;
  if (pctRemaining > 10) return 2;
  return 1;
}

export function deriveHighAdvisoryInstitutions(
  plume: PlumeSimulationResult,
  naqiCategory: NaqiCategory
): { count: number; names: string[]; score: SignificanceScore } {
  const names: string[] = [];

  const isPoorOrWorse =
    naqiCategory === 'Poor' ||
    naqiCategory === 'Very Poor' ||
    naqiCategory === 'Severe';

  for (const item of plume.receptors) {
    const cat: ReceptorDefinition['category'] = item.receptor.category;
    if (cat === 'Urban Centre') continue;
    const isSensitiveCampus =
      cat === 'School' || cat === 'Kindergarten' || cat === 'College';

    // Advisory is High+ based on live AQI and sensitivity:
    // Sensitive campuses (School, Kindergarten, College) reach High at Moderate AQI, Very High at Poor+
    // Other institutions (IT Parks) reach High at Poor AQI, Very High at Very Poor/Severe
    const hasHighPlusAdvisory =
      isPoorOrWorse || (naqiCategory === 'Moderate' && isSensitiveCampus);

    const inPlume =
      item.status === 'DIRECT DOWNWIND' || item.status === 'CROSSWIND EDGE';

    // Count an institution only if its advisory is High+ AND
    // (it is DIRECT DOWNWIND or CROSSWIND EDGE in I-1, OR the AQI is Poor or worse)
    if (hasHighPlusAdvisory && (inPlume || isPoorOrWorse)) {
      names.push(item.receptor.shortName);
    }
  }

  const count = names.length;
  let score: SignificanceScore = 1;
  if (count >= 4) score = 4;
  else if (count >= 2) score = 3;
  else if (count === 1) score = 2;

  return { count, names, score };
}

const HIGH_MITIGATIONS: Record<EiaMatrixRow['id'], string> = {
  'air-receptors':
    'Alert downwind schools/offices; keep windows closed; move outdoor activity.',
  'night-trapping':
    'Avoid early-morning outdoor activity; suspend night-time excavation and burning on site.',
  'air-quality':
    'Issue public AQI advisory; masks for sensitive groups; dust suppression on site.',
  water: 'Divert stormwater; check leachate collection drains; PCB water sampling downstream.',
  'land-waste': 'Speed up biomining; cover exposed piles; monitor methane.',
  'health-institutions': 'Send advisory notices to listed institutions; reschedule sports.',
  fire: 'Fire-watch staff on duty; water spraying on exposed piles; fire tender on standby.',
  social: 'Acknowledge complaints; on-site inspection; publish response.',
};

const VERDICT_DESCRIPTIONS: Record<OverallVerdictTier, string> = {
  LOW: 'No significant impact. Routine monitoring.',
  MODERATE: 'Monitor closely; targeted mitigation.',
  HIGH: 'Significant impact. Mitigation required now.',
  SEVERE: 'Immediate action; detailed EIA / regulatory review recommended.',
};

export function computeEiaVerdict(params: {
  plume: PlumeSimulationResult | null;
  tonightHours: NocturnalHourAnalysis[];
  riverWashout: RiverWashoutResult | null;
  naqi: NaqiResult | null;
  lastUpdatedIst: string;
  isStaleCache?: boolean;
}): EiaMatrixResult {
  const { plume, tonightHours, riverWashout, naqi, lastUpdatedIst, isStaleCache } = params;

  const missingInputs: string[] = [];

  // 1. Air — sensitive receptors (I-1)
  const r1 = plume ? scoreAirReceptors(plume) : null;
  if (!r1) missingInputs.push('I-1 Plume Trajectory');

  // 2. Air — night trapping (I-2)
  const peakNight =
    tonightHours.length > 0
      ? tonightHours.reduce(
          (best, cur) => (cur.trapScore > best.trapScore ? cur : best),
          tonightHours[0]
        )
      : null;
  const r2Score = peakNight ? scoreNightTrapping(peakNight.trapScore) : null;
  if (!peakNight) missingInputs.push('I-2 Night Inversion');

  // 3. Air quality — public health (Live Conditions NAQI)
  const r3Score = naqi ? scoreNaqiCategory(naqi.category) : null;
  if (!naqi) missingInputs.push('Live Conditions NAQI');

  // 4. Water — Kadambrayar River (I-3)
  const r4Score = riverWashout ? scoreRiverDo(riverWashout.criticalMinDoMgL) : null;
  if (!riverWashout) missingInputs.push('I-3 River Oxygen Sag');

  // 5. Land & waste (I-4 Biomining)
  const latestBiomining = BIOMINING_MILESTONES[BIOMINING_MILESTONES.length - 1];
  const pctRemaining = latestBiomining ? 100 - latestBiomining.percentBiomined : null;
  const r5Score = pctRemaining !== null ? scoreWasteRemaining(pctRemaining) : null;
  if (pctRemaining === null) missingInputs.push('I-4 Biomining Recovery');

  // 6. Health — institutions (Derived from AQI + I-1)
  const r6 = plume && naqi ? deriveHighAdvisoryInstitutions(plume, naqi.category) : null;
  if (!r6) missingInputs.push('I-5 Health Advisory (Derived)');

  // 7. Fire hazard (I-6 not active)
  missingInputs.push('I-6 Fire Weather Index (Not available)');

  // 8. Social — community complaints (I-7 not active)
  missingInputs.push('I-7 Citizen Reports (No data)');

  const makeRow = (
    base: Omit<EiaMatrixRow, 'significance' | 'weightedScore' | 'mitigation'>
  ): EiaMatrixRow => {
    const significance = base.score ? scoreToLabel(base.score) : 'No data';
    const weightedScore =
      base.score !== null ? Math.round(base.score * base.weight * 1000) / 1000 : null;
    const mitigation =
      base.score === null
        ? 'Input missing — excluded from overall score.'
        : base.score === 1
        ? 'Routine monitoring'
        : HIGH_MITIGATIONS[base.id];
    return {
      ...base,
      significance,
      weightedScore,
      mitigation,
    };
  };

  const liveBadge = isStaleCache ? 'MODELLED' : 'LIVE';

  const rows: EiaMatrixRow[] = [
    makeRow({
      number: 1,
      id: 'air-receptors',
      component: 'Air — sensitive receptors',
      sourceLabel: 'I-1 Plume Trajectory',
      sourcePath: '/observations/plume-trajectory',
      indicator: 'Weighted receptors in plume (Direct=1, Crosswind=0.5; schools/KG ×2)',
      valueDisplay: r1
        ? `${r1.weightedReceptorCount} weighted (${r1.affectedNames.length ? r1.affectedNames.join(', ') : 'none downwind'})`
        : 'No data',
      score: r1?.score ?? null,
      weight: 0.2,
      dataStatus: r1 ? 'MODELLED' : 'MISSING',
      statusTimeOrDate: `${lastUpdatedIst} IST`,
    }),
    makeRow({
      number: 2,
      id: 'night-trapping',
      component: 'Air — night trapping',
      sourceLabel: 'I-2 Night Inversion',
      sourcePath: '/observations/night-inversion',
      indicator: 'Peak Trap Score tonight (0–100)',
      valueDisplay: peakNight ? `${peakNight.trapScore}/100 @ ${peakNight.hourLabel} IST` : 'No data',
      score: r2Score,
      weight: 0.15,
      dataStatus: peakNight ? 'MODELLED' : 'MISSING',
      statusTimeOrDate: `${lastUpdatedIst} IST`,
    }),
    makeRow({
      number: 3,
      id: 'air-quality',
      component: 'Air quality — public health',
      sourceLabel: 'Live Conditions (NAQI)',
      sourcePath: '/live-conditions',
      indicator: 'CPCB NAQI (24-h & 8-h averages)',
      valueDisplay: naqi
        ? `${naqi.aqi} (${naqi.category}) · Prominent: ${naqi.dominantPollutant} (${naqi.dominantAveragingPeriod})`
        : 'No data',
      score: r3Score,
      weight: 0.2,
      dataStatus: naqi ? 'MODELLED' : 'MISSING',
      statusTimeOrDate: `${lastUpdatedIst} IST`,
    }),
    makeRow({
      number: 4,
      id: 'water',
      component: 'Water — Kadambrayar River',
      sourceLabel: 'I-3 River Oxygen Sag',
      sourcePath: '/observations/river-leachate',
      indicator: 'Critical minimum DO (mg/L)',
      valueDisplay: riverWashout ? `${riverWashout.criticalMinDoMgL} mg/L` : 'No data',
      score: r4Score,
      weight: 0.15,
      dataStatus: riverWashout ? 'MODELLED' : 'MISSING',
      statusTimeOrDate: `${lastUpdatedIst} IST`,
    }),
    makeRow({
      number: 5,
      id: 'land-waste',
      component: 'Land & waste',
      sourceLabel: 'I-4 Biomining Recovery',
      sourcePath: '/observations/biomining-tracker',
      indicator: '% legacy waste remaining',
      valueDisplay:
        pctRemaining !== null && latestBiomining
          ? `${pctRemaining}% remaining (${latestBiomining.percentBiomined}% cleared)`
          : 'No data',
      score: r5Score,
      weight: 0.1,
      dataStatus: pctRemaining !== null ? 'PUBLISHED' : 'MISSING',
      statusTimeOrDate: latestBiomining?.publishedDate ?? '03 Feb 2025',
    }),
    makeRow({
      number: 6,
      id: 'health-institutions',
      component: 'Health — institutions',
      sourceLabel: 'Derived (NAQI + I-1)',
      sourcePath: '/live-conditions',
      indicator: 'Institutions at High or Very High advisory',
      valueDisplay: r6
        ? `${r6.count} institution(s)${r6.names.length ? ` (${r6.names.slice(0, 3).join(', ')}${r6.names.length > 3 ? '…' : ''})` : ''}`
        : 'No data',
      score: r6?.score ?? null,
      weight: 0.1,
      dataStatus: r6 ? liveBadge : 'MISSING',
      statusTimeOrDate: `${lastUpdatedIst} IST`,
    }),
    makeRow({
      number: 7,
      id: 'fire',
      component: 'Fire hazard',
      sourceLabel: 'I-6 Fire Weather',
      sourcePath: null,
      indicator: 'Fire Weather Index (0–100)',
      valueDisplay: 'Not available (No data)',
      score: null,
      weight: 0.05,
      dataStatus: 'MISSING',
      statusTimeOrDate: 'Not enabled',
    }),
    makeRow({
      number: 8,
      id: 'social',
      component: 'Social — community complaints',
      sourceLabel: 'I-7 Citizen Reports',
      sourcePath: null,
      indicator: 'Consistent plume reports (last 24 h)',
      valueDisplay: 'No data',
      score: null,
      weight: 0.05,
      dataStatus: 'MISSING',
      statusTimeOrDate: 'Not enabled',
    }),
  ];

  const validRows = rows.filter((r) => r.score !== null);
  const usedWeightSum =
    Math.round(validRows.reduce((acc, r) => acc + r.weight, 0) * 1000) / 1000;
  const weightedTotal = validRows.reduce((acc, r) => acc + (r.weightedScore ?? 0), 0);
  const overallScore =
    usedWeightSum > 0 ? Math.round((weightedTotal / usedWeightSum) * 100) / 100 : 1;

  const anySevere = validRows.some((r) => r.score === 4);
  const anyHigh = validRows.some((r) => r.score === 3);

  let verdict: OverallVerdictTier = 'LOW';
  if (anySevere || overallScore >= 3.25) {
    verdict = 'SEVERE';
  } else if (overallScore >= 2.5) {
    verdict = 'HIGH';
  } else if (overallScore >= 1.5 || anyHigh) {
    verdict = 'MODERATE';
  }

  const distribution: Record<SignificanceLabel, number> = {
    Low: 0,
    Moderate: 0,
    High: 0,
    Severe: 0,
  };
  for (const r of validRows) {
    if (r.significance !== 'No data') {
      distribution[r.significance]++;
    }
  }

  const topDrivers = [...validRows]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.weight - a.weight)
    .slice(0, 2);

  const rowScore = (id: EiaMatrixRow['id']) => rows.find((r) => r.id === id)?.score ?? null;
  const s1 = rowScore('air-receptors');
  const s3 = rowScore('air-quality');
  const s4 = rowScore('water');
  const s5 = rowScore('land-waste');
  const s6 = rowScore('health-institutions');
  const s7 = rowScore('fire');
  const s8 = rowScore('social');

  const neg = (s: SignificanceScore | null) => (s !== null ? -s : null);

  const leopold: LeopoldRow[] = [
    {
      activity: 'Legacy waste piles',
      cells: [
        {
          component: 'Air',
          magnitude: neg(s3),
          noData: s3 === null,
          reason: 'Gas/particulate emission burden driven by NAQI air quality score.',
          sourceRef: 'Live Conditions (NAQI)',
        },
        {
          component: 'Water',
          magnitude: neg(s4),
          noData: s4 === null,
          reason: 'Unlined waste pile leachate depleting downstream Kadambrayar DO.',
          sourceRef: 'I-3 River Oxygen Sag',
        },
        {
          component: 'Land',
          magnitude: neg(s5),
          noData: s5 === null,
          reason: 'Remaining un-reclaimed legacy waste volume occupying site footprint.',
          sourceRef: 'I-4 Biomining Recovery',
        },
        {
          component: 'Health',
          magnitude: neg(s6),
          noData: s6 === null,
          reason: 'Downwind sensitive campuses & institutions facing High+ exposure advisory.',
          sourceRef: 'Derived (NAQI + I-1)',
        },
        {
          component: 'Social',
          magnitude: neg(s8),
          noData: s8 === null,
          reason:
            s8 === null
              ? 'I-7 Citizen Reports feed is not connected (No data).'
              : 'Community odour/smoke reports logged in last 24 h.',
          sourceRef: 'I-7 Citizen Reports',
        },
      ],
    },
    {
      activity: 'Biomining excavation',
      cells: [
        {
          component: 'Air',
          magnitude: neg(s1),
          noData: s1 === null,
          reason: 'Excavation dust and odour carried along live downwind receptor plume.',
          sourceRef: 'I-1 Plume Trajectory',
        },
        {
          component: 'Water',
          magnitude: null,
          reason: 'No direct water-column scoring link assigned for dry excavation.',
          sourceRef: '—',
        },
        {
          component: 'Land',
          magnitude: s5 !== null ? 4 - s5 : null,
          noData: s5 === null,
          reason: 'Beneficial land recovery (+(4 − land score)) as legacy waste is cleared.',
          sourceRef: 'I-4 Biomining Recovery',
        },
        {
          component: 'Health',
          magnitude: null,
          reason: 'Evaluated under aggregate ambient air and downwind institution rows.',
          sourceRef: '—',
        },
        {
          component: 'Social',
          magnitude: null,
          reason: 'Evaluated under community complaints row when active.',
          sourceRef: '—',
        },
      ],
    },
    {
      activity: 'Rain runoff / leachate',
      cells: [
        {
          component: 'Air',
          magnitude: null,
          reason: 'No direct airborne dispersion score assigned to stormwater runoff.',
          sourceRef: '—',
        },
        {
          component: 'Water',
          magnitude: neg(s4),
          noData: s4 === null,
          reason: 'Stormwater runoff flushes BOD load into Kadambrayar River.',
          sourceRef: 'I-3 River Oxygen Sag',
        },
        {
          component: 'Land',
          magnitude: null,
          reason: 'Soil disturbance tracked under legacy waste / biomining.',
          sourceRef: '—',
        },
        {
          component: 'Health',
          magnitude: null,
          reason: 'Indirect water-use exposure tracked via DO threshold.',
          sourceRef: '—',
        },
        {
          component: 'Social',
          magnitude: null,
          reason: 'No direct social score assigned to runoff row.',
          sourceRef: '—',
        },
      ],
    },
    {
      activity: 'Fire / smouldering risk',
      cells: [
        {
          component: 'Air',
          magnitude: neg(s7),
          noData: s7 === null,
          reason: s7 === null ? 'I-6 Fire Weather Index not available (No data).' : 'Smoke release driven by Fire Weather Index.',
          sourceRef: 'I-6 Fire Weather',
        },
        {
          component: 'Water',
          magnitude: null,
          reason: 'No direct river DO link in screening matrix.',
          sourceRef: '—',
        },
        {
          component: 'Land',
          magnitude: null,
          reason: 'No direct land score assigned.',
          sourceRef: '—',
        },
        {
          component: 'Health',
          magnitude: neg(s7),
          noData: s7 === null,
          reason: s7 === null ? 'I-6 Fire Weather Index not available (No data).' : 'Acute smoke inhalation risk from fire weather.',
          sourceRef: 'I-6 Fire Weather',
        },
        {
          component: 'Social',
          magnitude: neg(s7),
          noData: s7 === null,
          reason: s7 === null ? 'I-6 Fire Weather Index not available (No data).' : 'Community smoke distress linked to fire weather.',
          sourceRef: 'I-6 Fire Weather',
        },
      ],
    },
  ];

  return {
    rows,
    missingInputs,
    usedWeightSum,
    overallScore,
    verdict,
    verdictDescription: VERDICT_DESCRIPTIONS[verdict],
    topDrivers,
    distribution,
    leopold,
  };
}

export const computeEiaMatrix = computeEiaVerdict;

export function computeNext24HourOutlook(params: {
  hourlyWeather: HourlyWeatherRecord[];
  hourlyAir: HourlyAirRecord[];
  nowIsoPrefix: string;
  riverParams?: RiverAssumedParameters;
}): EiaOutlookHour[] {
  const { hourlyWeather, hourlyAir, nowIsoPrefix, riverParams = DEFAULT_RIVER_PARAMS } = params;
  const airMap = new Map(hourlyAir.map((a) => [a.time, a]));

  const startIdx = hourlyWeather.findIndex((h) => h.time >= nowIsoPrefix);
  const anchor = startIdx >= 0 ? startIdx : Math.max(0, hourlyWeather.length - 24);
  const next24 = hourlyWeather.slice(anchor, anchor + 24);

  return next24.map((h, offset) => {
    const idx = anchor + offset;
    // Rolling 24h precipitation ending at hour idx
    const rainSlice = hourlyWeather.slice(Math.max(0, idx - 23), idx + 1);
    const rolling24RainMm = rainSlice.reduce((sum, item) => sum + item.precipitationMm, 0);

    const plumeH = computePlumeSimulation({
      windSpeedMs: h.windSpeed10mMs,
      windDirectionFromDeg: h.windDirection10mDeg,
      shortwaveRadiationWm2: h.shortwaveRadiationWm2,
      cloudCoverPct: h.cloudCoverPct,
      isDay: h.hourIst >= 6 && h.hourIst < 18,
      halfConeDeg: 15,
    });
    const airReceptors = scoreAirReceptors(plumeH).score;

    const invH = computeHourTrapScore(h);
    const nightTrapping = scoreNightTrapping(invH.trapScore);

    const airRec = airMap.get(h.time);
    const airQuality = airRec
      ? scoreNaqiCategory(
          computeIndianNaqi({
            pm25: airRec.pm25,
            pm10: airRec.pm10,
            no2: airRec.no2,
          }).category
        )
      : null;

    const riverH = computeRiverWashout({
      rainfallMmPerDay: rolling24RainMm,
      airTempC: h.temperature2m,
      riverParams,
    });
    const water = scoreRiverDo(riverH.criticalMinDoMgL);

    return {
      time: h.time,
      hourLabel: h.hourLabel,
      scores: {
        airReceptors,
        nightTrapping,
        airQuality,
        water,
      },
    };
  });
}

export function scaleAqiToCategory(aqi: number): NaqiCategory {
  return classifyNaqi(Math.max(0, Math.min(500, Math.round(aqi))));
}
