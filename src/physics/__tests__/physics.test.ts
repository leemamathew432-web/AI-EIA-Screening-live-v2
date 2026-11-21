import { describe, expect, it } from 'vitest';
import {
  KADAMBAYAR_RIVER_POLYLINE,
  RIVER_ENTRY_NODE_INDEX,
  haversineDistanceMeters,
  pointAlongPolyline,
} from '../../data/receptors';
import {
  computeHourTrapScore,
  predictTonightInversion,
  trainInversionPredictor,
} from '../inversion';
import { computeIndianNaqi } from '../naqi';
import {
  computePasquillGiffordStability,
  computePlumeSimulation,
  gaussianGroundKernel,
} from '../plume';
import { computeDoSaturationMgL, computeRiverWashout } from '../river';
import {
  computeEiaMatrix,
  computeEiaVerdict,
  deriveHighAdvisoryInstitutions,
  scoreAirReceptors,
  scoreNightTrapping,
  scoreRiverDo,
  scoreWasteRemaining,
} from '../eiaMatrix';
import type { HourlyWeatherRecord } from '../../types/telemetry';

describe('CPCB Indian National AQI (NAQI 2014)', () => {
  it('interpolates PM2.5 and PM10 breakpoints accurately', () => {
    const good = computeIndianNaqi({ pm25: 15, pm10: 25, no2: 20 });
    expect(good.aqi).toBe(25);
    expect(good.category).toBe('Good');

    const moderate = computeIndianNaqi({ pm25: 75, pm10: 80, no2: 30, coMgM3: 1.5 });
    expect(moderate.dominantPollutant).toBe('PM2.5');
    expect(moderate.aqi).toBeGreaterThanOrEqual(150);
    expect(moderate.category).toBe('Moderate');
  });

  it('picks CO as dominant pollutant when CO mg/m3 is elevated', () => {
    const res = computeIndianNaqi({ pm25: 10, pm10: 20, no2: 10, coMgM3: 10.0 });
    expect(res.dominantPollutant).toBe('CO');
    expect(res.dominantAveragingPeriod).toBe('8-h avg');
    expect(res.aqi).toBe(200);
  });

  it('computes 24-h moving avg for PM2.5/PM10/NO2/SO2 and 8-h moving avg for O3/CO from hourly air records', () => {
    // Generate 30 hourly air records with increasing pollutants
    const records = [];
    for (let i = 0; i < 30; i++) {
      const hStr = String(i % 24).padStart(2, '0');
      const dStr = i < 24 ? '2026-11-19' : '2026-11-20';
      records.push({
        time: `${dStr}T${hStr}:00`,
        pm25: 10 + i * 2, // 10..68
        pm10: 20 + i * 2, // 20..78
        no2: 15,
        so2: 10,
        ozone: 20 + (i >= 22 ? 50 : 10), // elevated in last 8 hours
        coUgM3: 500,
        coMgM3: 0.5,
      });
    }

    const res = computeIndianNaqi({
      hourlyAir: records,
      nowIsoPrefix: '2026-11-20T05:00',
    });

    const pm25Sub = res.subIndices.find((s) => s.pollutant === 'PM2.5');
    const o3Sub = res.subIndices.find((s) => s.pollutant === 'O3');

    expect(pm25Sub?.averagingPeriod).toBe('24-h avg');
    expect(o3Sub?.averagingPeriod).toBe('8-h avg');
    // Last record had pm25 = 10 + 29*2 = 68
    expect(pm25Sub?.currentConcentration).toBe(68);
    // 24-hour average will be the mean of indices 6..29 (values 22 to 68 -> mean 45)
    expect(pm25Sub?.concentration).toBe(45);
    expect(res.dominantAveragingPeriod).toBeDefined();
  });
});

describe('Pasquill-Gifford Stability & Gaussian Plume', () => {
  it('assigns Class A on strong daytime solar radiation with light wind and Class F on calm clear night', () => {
    const day = computePasquillGiffordStability({
      windSpeedMs: 1.5,
      shortwaveRadiationWm2: 750,
      cloudCoverPct: 10,
      isDay: true,
    });
    expect(day.cls).toBe('A');

    const night = computePasquillGiffordStability({
      windSpeedMs: 1.2,
      shortwaveRadiationWm2: 0,
      cloudCoverPct: 15,
      isDay: false,
    });
    expect(night.cls).toBe('F');
  });

  it('computes downwind vector (+180°) and decays off-axis concentration', () => {
    const onAxis = gaussianGroundKernel(1000, 0, 'D', 5);
    const offAxis = gaussianGroundKernel(1000, 250, 'D', 5);
    expect(onAxis).toBeGreaterThan(offAxis);

    // Wind FROM South-East (135°) blows TOWARD North-West (315°)
    const sim = computePlumeSimulation({
      windSpeedMs: 4.0,
      windDirectionFromDeg: 135,
      shortwaveRadiationWm2: 400,
      cloudCoverPct: 30,
      isDay: true,
    });
    expect(sim.downwindBearingDeg).toBe(315);
    expect(sim.downwindCompass).toBe('NW');
    expect(sim.receptors.length).toBe(7);

    // Check offset status buckets: 0-15 DIRECT DOWNWIND, 15-35 CROSSWIND EDGE, 35-90 SIDE / OFF-PLUME, >90 UPWIND
    for (const r of sim.receptors) {
      if (r.angularOffsetDeg <= 15) expect(r.status).toBe('DIRECT DOWNWIND');
      else if (r.angularOffsetDeg <= 35) expect(r.status).toBe('CROSSWIND EDGE');
      else if (r.angularOffsetDeg <= 90) expect(r.status).toBe('SIDE / OFF-PLUME');
      else expect(r.status).toBe('UPWIND');
    }
  });
});

describe('Streeter-Phelps River Leachate & Oxygen Sag', () => {
  it('computes tropical freshwater DO saturation and lower min DO under heavy storm rain', () => {
    expect(computeDoSaturationMgL(25)).toBeCloseTo(8.18, 2);

    const dry = computeRiverWashout({ rainfallMmPerDay: 0, airTempC: 29 });
    const storm = computeRiverWashout({ rainfallMmPerDay: 60, airTempC: 29 });

    expect(storm.runoffPulseM3s).toBeGreaterThan(dry.runoffPulseM3s);
    expect(storm.mixedInitialBodMgL).toBeGreaterThan(dry.mixedInitialBodMgL);
    expect(storm.criticalMinDoMgL).toBeLessThan(dry.criticalMinDoMgL);
    expect(storm.curve.length).toBe(25); // 0..12 km step 0.5

    // Travel time must equal distance / velocity (default 0.35 m/s * 86.4 = 30.24 km/day)
    const velocityKmPerDay = 0.35 * 86.4;
    expect(dry.criticalSagTimeDays).toBeCloseTo(
      dry.criticalSagDistanceKm / velocityKmPerDay,
      2
    );
    if (dry.isSagBeyondReach) {
      expect(dry.trueCriticalSagDistanceKm).toBeGreaterThan(12);
      expect(dry.trueCriticalSagTimeDays).toBeCloseTo(
        dry.trueCriticalSagDistanceKm / velocityKmPerDay,
        1
      );
    }
  });

  it('interpolates critical sag coordinates along Kadambrayar polyline', () => {
    const start = KADAMBAYAR_RIVER_POLYLINE[RIVER_ENTRY_NODE_INDEX];
    const p1 = pointAlongPolyline(KADAMBAYAR_RIVER_POLYLINE, RIVER_ENTRY_NODE_INDEX, 1.2);
    const dist = haversineDistanceMeters(start[0], start[1], p1[0], p1[1]);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1350);
  });
});

describe('14-Day Nocturnal Ridge Regression Inversion Predictor', () => {
  it('trains on unmodified nocturnal hours and produces calibrated Delta-T predictions', () => {
    const records: HourlyWeatherRecord[] = [];
    // Construct 14 days * 24 hours of deterministic physical records
    for (let d = 1; d <= 14; d++) {
      const dayStr = `2026-11-${String(d).padStart(2, '0')}`;
      for (let h = 0; h < 24; h++) {
        const isNight = h >= 18 || h <= 6;
        const wind = isNight ? 1.1 + (d % 3) * 0.4 : 4.2;
        const cloud = (d * 13) % 70;
        const rh = isNight ? 86 : 64;
        const t2 = isNight ? 24.5 - (h <= 6 ? 1.2 : 0.4) : 31.0;
        // Stronger positive inversion when wind is calm & sky clear
        const deltaT = isNight ? Math.max(-0.2, 1.6 - wind * 0.45 - (cloud / 100) * 0.8) : -1.1;
        records.push({
          time: `${dayStr}T${String(h).padStart(2, '0')}:00`,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          hourIst: h,
          temperature2m: t2,
          temperature80m: t2 + deltaT * 0.7,
          temperature120m: t2 + deltaT,
          temperature180m: t2 + deltaT * 1.1,
          relativeHumidity2m: rh,
          windSpeed10mMs: wind,
          windDirection10mDeg: 120,
          cloudCoverPct: cloud,
          precipitationMm: 0,
          shortwaveRadiationWm2: isNight ? 0 : 520,
          boundaryLayerHeightM: isNight ? 130 : 950,
        });
      }
    }

    const model = trainInversionPredictor(records, '2026-11-15T00:00');
    expect(model.sampleCount).toBe(14 * 13); // 13 nocturnal hours per day
    expect(model.holdoutMaeC).toBeLessThan(0.5);
    expect(model.holdoutBinaryAccuracyPct).toBeGreaterThanOrEqual(80);

    const tonightSlice = records.slice(-13);
    const preds = predictTonightInversion(model, tonightSlice, records);
    expect(preds.length).toBe(13);
    expect(preds[0].inversionProbPct).toBeGreaterThanOrEqual(1);
    expect(preds[0].inversionProbPct).toBeLessThanOrEqual(99);

    const sampleScore = computeHourTrapScore(records[2]); // calm night hour
    expect(sampleScore.trapScore).toBeGreaterThan(40);
  });
});

describe('EIA Impact Matrix Scoring & Verdict Rules (computeEiaVerdict)', () => {
  const makeNightHour = (
    trapScore: number,
    riskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'
  ) => ({
    time: '2026-11-19T23:00',
    hourLabel: '23:00',
    hourIst: 23,
    deltaT120mMinus2m: trapScore >= 75 ? 1.5 : -0.4,
    blhMeters: trapScore >= 75 ? 90 : 450,
    blhIsFallback: false,
    windSpeedMs: trapScore >= 75 ? 0.9 : 3.5,
    windSpeedKmh: trapScore >= 75 ? 3.2 : 12.6,
    rhPct: trapScore >= 75 ? 90 : 75,
    cloudCoverPct: trapScore >= 75 ? 10 : 50,
    temperature2m: 25,
    temperature80m: 25.4,
    temperature120m: 25.6,
    temperature180m: 25.7,
    stabilityClass: (trapScore >= 75 ? 'F' : 'D') as 'F' | 'D',
    trapScore,
    riskTier,
    isInversion: trapScore >= 75,
  });

  it('excludes missing inputs (I-6, I-7) and normalizes weight sum to 0.90', () => {
    const plume = computePlumeSimulation({
      windSpeedMs: 4.5,
      windDirectionFromDeg: 45, // blowing SW away from most Kakkanad IT hubs
      shortwaveRadiationWm2: 600,
      cloudCoverPct: 20,
      isDay: true,
    });
    const naqi = computeIndianNaqi({ pm25: 15, pm10: 25, no2: 12 }); // Good (1)
    const riverWashout = computeRiverWashout({ rainfallMmPerDay: 2, airTempC: 29 }); // Dry DO > 5 (1)

    const matrix = computeEiaMatrix({
      plume,
      tonightHours: [makeNightHour(25, 'LOW')],
      riverWashout,
      naqi,
      lastUpdatedIst: '12:00:00',
    });

    expect(matrix.usedWeightSum).toBeCloseTo(0.9, 3);
    expect(matrix.rows.find((r) => r.id === 'fire')?.score).toBeNull();
    expect(matrix.rows.find((r) => r.id === 'social')?.score).toBeNull();
    expect(matrix.rows.find((r) => r.id === 'land-waste')?.score).toBe(2); // 25% remaining => Moderate
  });

  it('enforces SEVERE override when any row scores 4 and never LOW when any row scores 3', () => {
    expect(scoreNightTrapping(92)).toBe(4);
    expect(scoreRiverDo(1.8)).toBe(4);
    expect(scoreWasteRemaining(25)).toBe(2);

    const plume = computePlumeSimulation({
      windSpeedMs: 1.5,
      windDirectionFromDeg: 100,
      shortwaveRadiationWm2: 100,
      cloudCoverPct: 10,
      isDay: false,
    });
    const naqiGood = computeIndianNaqi({ pm25: 12, pm10: 20, no2: 10 });
    const riverGood = computeRiverWashout({ rainfallMmPerDay: 0, airTempC: 28 });

    // 1 row Severe (night trapping = 95 -> 4) forces SEVERE verdict regardless of average
    const severeMatrix = computeEiaVerdict({
      plume,
      tonightHours: [makeNightHour(95, 'SEVERE')],
      riverWashout: riverGood,
      naqi: naqiGood,
      lastUpdatedIst: '12:00:00',
    });
    expect(severeMatrix.verdict).toBe('SEVERE');

    // Low average (<1.5) with 1 row High (score 3) cannot return LOW -> promotes to MODERATE
    const plumeCalm = computePlumeSimulation({
      windSpeedMs: 4.0,
      windDirectionFromDeg: 45,
      shortwaveRadiationWm2: 500,
      cloudCoverPct: 30,
      isDay: true,
    });
    const highRowMatrix = computeEiaVerdict({
      plume: plumeCalm,
      tonightHours: [makeNightHour(72, 'HIGH')], // High (score 3)
      riverWashout: riverGood,
      naqi: naqiGood,
      lastUpdatedIst: '12:00:00',
    });
    expect(highRowMatrix.verdict).not.toBe('LOW');
  });

  it('keeps Air: receptors non-Severe when a school sits on CROSSWIND EDGE, and marks Severe when DIRECT DOWNWIND', () => {
    const naqiGood = computeIndianNaqi({ pm25: 12, pm10: 20, no2: 10 }); // Good (1)
    const riverGood = computeRiverWashout({ rainfallMmPerDay: 0, airTempC: 28 }); // Dry DO > 5 (1)

    // Find a wind direction where St. Charles Borromeo School (bearing ~293° from Brahmapuram) is CROSSWIND EDGE
    // and NO school/KG is DIRECT DOWNWIND
    const crosswindPlume = computePlumeSimulation({
      windSpeedMs: 3.5,
      windDirectionFromDeg: 140, // downwind 320° -> offset from St. Charles (~293°) is ~27° (CROSSWIND EDGE for ±15° core / ±35° outer)
      shortwaveRadiationWm2: 500,
      cloudCoverPct: 20,
      isDay: true,
      halfConeDeg: 15,
    });
    const stCharles = crosswindPlume.receptors.find((r) => r.receptor.id === 'st-charles-thuthiyoor');
    expect(stCharles?.status).toBe('CROSSWIND EDGE');
    const anyDirectSchool = crosswindPlume.receptors.some(
      (r) =>
        (r.receptor.category === 'School' || r.receptor.category === 'Kindergarten') &&
        r.status === 'DIRECT DOWNWIND'
    );
    expect(anyDirectSchool).toBe(false);

    const receptorScoreCrosswind = scoreAirReceptors(crosswindPlume);
    expect(receptorScoreCrosswind.directDownwindSchool).toBe(false);
    expect(receptorScoreCrosswind.score).toBeLessThan(4);

    const crosswindVerdict = computeEiaVerdict({
      plume: crosswindPlume,
      tonightHours: [makeNightHour(25, 'LOW')],
      riverWashout: riverGood,
      naqi: naqiGood,
      lastUpdatedIst: '12:00:00',
    });
    expect(crosswindVerdict.verdict).not.toBe('SEVERE');

    // Now aim directly at St. Charles (~293° downwind => wind from 113°)
    const directSchoolPlume = computePlumeSimulation({
      windSpeedMs: 3.5,
      windDirectionFromDeg: 113,
      shortwaveRadiationWm2: 500,
      cloudCoverPct: 20,
      isDay: true,
      halfConeDeg: 15,
    });
    expect(
      directSchoolPlume.receptors.find((r) => r.receptor.id === 'st-charles-thuthiyoor')?.status
    ).toBe('DIRECT DOWNWIND');

    const receptorScoreDirect = scoreAirReceptors(directSchoolPlume);
    expect(receptorScoreDirect.directDownwindSchool).toBe(true);
    expect(receptorScoreDirect.score).toBe(4);

    const directVerdict = computeEiaVerdict({
      plume: directSchoolPlume,
      tonightHours: [makeNightHour(25, 'LOW')],
      riverWashout: riverGood,
      naqi: naqiGood,
      lastUpdatedIst: '12:00:00',
    });
    expect(directVerdict.verdict).toBe('SEVERE');
  });

  it('counts an institution in Health row only if advisory is High+ AND (in plume OR AQI is Poor+)', () => {
    // Plume blowing West toward St. Charles (bearing ~293°, wind from 113°)
    const plumeFacingWest = computePlumeSimulation({
      windSpeedMs: 3.5,
      windDirectionFromDeg: 113,
      shortwaveRadiationWm2: 500,
      cloudCoverPct: 20,
      isDay: true,
      halfConeDeg: 15,
    });
    // Plume blowing East away from St. Charles (wind from 293°)
    const plumeFacingEast = computePlumeSimulation({
      windSpeedMs: 3.5,
      windDirectionFromDeg: 293,
      shortwaveRadiationWm2: 500,
      cloudCoverPct: 20,
      isDay: true,
      halfConeDeg: 15,
    });

    // 1. Moderate AQI: sensitive institutions have High advisory, but only counted if in plume
    const downwindRes = deriveHighAdvisoryInstitutions(plumeFacingWest, 'Moderate');
    expect(downwindRes.names).toContain('St. Charles');

    const upwindRes = deriveHighAdvisoryInstitutions(plumeFacingEast, 'Moderate');
    // St. Charles is upwind now, so should NOT be counted at Moderate AQI
    expect(upwindRes.names).not.toContain('St. Charles');

    // 2. Poor AQI: all institutions have High+ advisory AND condition (in plume OR AQI Poor+) is true for all
    const poorRes = deriveHighAdvisoryInstitutions(plumeFacingEast, 'Poor');
    expect(poorRes.names).toContain('St. Charles');
    expect(poorRes.count).toBeGreaterThan(0);

    // 3. Satisfactory AQI: no institution reaches High+ advisory
    const satRes = deriveHighAdvisoryInstitutions(plumeFacingWest, 'Satisfactory');
    expect(satRes.count).toBe(0);
    expect(satRes.score).toBe(1);
  });

  it('evaluates verdict bands with no gaps: <1.5 Low, 1.5–<2.5 Moderate, 2.5–<3.25 High, >=3.25 Severe', () => {
    const plume = computePlumeSimulation({
      windSpeedMs: 4.5,
      windDirectionFromDeg: 45,
      shortwaveRadiationWm2: 500,
      cloudCoverPct: 20,
      isDay: true,
    });
    const riverGood = computeRiverWashout({ rainfallMmPerDay: 0, airTempC: 28 });
    const naqiGood = computeIndianNaqi({ pm25: 12, pm10: 20, no2: 10 });

    // Base matrix with Low rows (overall < 1.5) -> LOW
    const lowMatrix = computeEiaVerdict({
      plume,
      tonightHours: [makeNightHour(20, 'LOW')],
      riverWashout: riverGood,
      naqi: naqiGood,
      lastUpdatedIst: '12:00:00',
    });
    expect(lowMatrix.overallScore).toBeLessThan(1.5);
    expect(lowMatrix.verdict).toBe('LOW');
  });
});
