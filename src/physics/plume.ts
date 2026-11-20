import {
  BRAHMAPURAM_SOURCE,
  RECEPTORS,
  destinationPoint,
  forwardAzimuthDeg,
  haversineDistanceMeters,
  type ReceptorDefinition,
} from '../data/receptors';

export type StabilityClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type ReceptorPlumeStatus =
  | 'DIRECT DOWNWIND'
  | 'CROSSWIND EDGE'
  | 'SIDE / OFF-PLUME'
  | 'UPWIND';

export interface ReceptorPlumeImpact {
  receptor: ReceptorDefinition;
  distanceMeters: number;
  distanceKm: number;
  bearingDeg: number;
  angularOffsetDeg: number;
  status: ReceptorPlumeStatus;
  advectionEtaMin: number | null;
  relativeConcPctOf500m: number;
}

export interface PlumeSimulationResult {
  stabilityClass: StabilityClass;
  stabilityDescription: string;
  windFromDeg: number;
  downwindBearingDeg: number;
  downwindCompass: string;
  windSpeedMs: number;
  windSpeedKmh: number;
  halfConeDeg: number;
  coreConePolygon: [number, number][];
  outerConePolygon: [number, number][];
  receptors: ReceptorPlumeImpact[];
  downwindCampuses: ReceptorPlumeImpact[];
}

export function degToCompass16(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function angularDifferenceDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function computePasquillGiffordStability(params: {
  windSpeedMs: number;
  shortwaveRadiationWm2: number;
  cloudCoverPct: number;
  isDay: boolean;
}): { cls: StabilityClass; label: string } {
  const { windSpeedMs, shortwaveRadiationWm2, cloudCoverPct, isDay } = params;
  const u = Math.max(0, windSpeedMs);

  if (isDay && shortwaveRadiationWm2 > 20) {
    // Insolation strength: strong > 600, moderate 300-600, slight < 300
    const strong = shortwaveRadiationWm2 >= 600;
    const moderate = shortwaveRadiationWm2 >= 300 && shortwaveRadiationWm2 < 600;

    if (u < 2) {
      if (strong) return { cls: 'A', label: 'Extremely Unstable' };
      if (moderate) return { cls: 'A', label: 'Extremely Unstable' };
      return { cls: 'B', label: 'Moderately Unstable' };
    }
    if (u < 3) {
      if (strong) return { cls: 'A', label: 'Extremely Unstable' };
      if (moderate) return { cls: 'B', label: 'Moderately Unstable' };
      return { cls: 'C', label: 'Slightly Unstable' };
    }
    if (u < 5) {
      if (strong) return { cls: 'B', label: 'Moderately Unstable' };
      if (moderate) return { cls: 'C', label: 'Slightly Unstable' };
      return { cls: 'C', label: 'Slightly Unstable' };
    }
    if (u < 6) {
      if (strong) return { cls: 'C', label: 'Slightly Unstable' };
      return { cls: 'D', label: 'Neutral' };
    }
    return { cls: 'D', label: 'Neutral' };
  }

  // Nighttime Pasquill-Gifford stability
  if (cloudCoverPct >= 50) {
    if (u < 2.5) return { cls: 'E', label: 'Slightly Stable' };
    return { cls: 'D', label: 'Neutral' };
  }
  if (u < 2.0) return { cls: 'F', label: 'Moderately Stable (Inversion)' };
  if (u < 3.5) return { cls: 'E', label: 'Slightly Stable' };
  return { cls: 'D', label: 'Neutral' };
}

// Briggs (1973) Rural Open-Country Dispersion Coefficients (x in metres -> sigma in metres)
export function briggsRuralSigma(xMeters: number, cls: StabilityClass): {
  sigmaY: number;
  sigmaZ: number;
} {
  const x = Math.max(50, xMeters);
  switch (cls) {
    case 'A':
      return {
        sigmaY: (0.22 * x) / Math.sqrt(1 + 0.0001 * x),
        sigmaZ: 0.2 * x,
      };
    case 'B':
      return {
        sigmaY: (0.16 * x) / Math.sqrt(1 + 0.0001 * x),
        sigmaZ: 0.12 * x,
      };
    case 'C':
      return {
        sigmaY: (0.11 * x) / Math.sqrt(1 + 0.0001 * x),
        sigmaZ: (0.08 * x) / Math.sqrt(1 + 0.0002 * x),
      };
    case 'D':
      return {
        sigmaY: (0.08 * x) / Math.sqrt(1 + 0.0001 * x),
        sigmaZ: (0.06 * x) / Math.sqrt(1 + 0.0015 * x),
      };
    case 'E':
      return {
        sigmaY: (0.06 * x) / Math.sqrt(1 + 0.0001 * x),
        sigmaZ: (0.03 * x) / (1 + 0.0003 * x),
      };
    case 'F':
    default:
      return {
        sigmaY: (0.04 * x) / Math.sqrt(1 + 0.0001 * x),
        sigmaZ: (0.016 * x) / (1 + 0.0003 * x),
      };
  }
}

// Ground-level Gaussian Plume factor (C * u / Q) with H = 5 m and ground reflection
export function gaussianGroundKernel(
  xMeters: number,
  yMeters: number,
  cls: StabilityClass,
  H = 5
): number {
  if (xMeters <= 10) return 0;
  const { sigmaY, sigmaZ } = briggsRuralSigma(xMeters, cls);
  const lateral = Math.exp(-0.5 * (yMeters / sigmaY) ** 2);
  const vertical = Math.exp(-0.5 * (H / sigmaZ) ** 2);
  return (1 / (Math.PI * sigmaY * sigmaZ)) * lateral * vertical;
}

function buildConePolygon(
  downwindBearingDeg: number,
  halfAngleDeg: number,
  radiusKm: number
): [number, number][] {
  const pts: [number, number][] = [[BRAHMAPURAM_SOURCE.lat, BRAHMAPURAM_SOURCE.lon]];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const angle = downwindBearingDeg - halfAngleDeg + (2 * halfAngleDeg * i) / steps;
    pts.push(
      destinationPoint(
        BRAHMAPURAM_SOURCE.lat,
        BRAHMAPURAM_SOURCE.lon,
        (angle + 360) % 360,
        radiusKm
      )
    );
  }
  pts.push([BRAHMAPURAM_SOURCE.lat, BRAHMAPURAM_SOURCE.lon]);
  return pts;
}

export function computePlumeSimulation(params: {
  windSpeedMs: number;
  windDirectionFromDeg: number;
  shortwaveRadiationWm2: number;
  cloudCoverPct: number;
  isDay: boolean;
  halfConeDeg?: number;
}): PlumeSimulationResult {
  const halfConeDeg = params.halfConeDeg ?? 15;
  const outerHalfConeDeg = Math.min(45, Math.round(halfConeDeg * (35 / 15)));
  const windSpeedMs = Math.max(0.2, params.windSpeedMs);
  const downwindBearingDeg = (params.windDirectionFromDeg + 180) % 360;

  const stability = computePasquillGiffordStability({
    windSpeedMs,
    shortwaveRadiationWm2: params.shortwaveRadiationWm2,
    cloudCoverPct: params.cloudCoverPct,
    isDay: params.isDay,
  });

  // Reference kernel at 500 m centerline (Q cancels)
  const ref500m = gaussianGroundKernel(500, 0, stability.cls, 5);

  const receptors: ReceptorPlumeImpact[] = RECEPTORS.map((receptor) => {
    const distanceMeters = Math.round(
      haversineDistanceMeters(
        BRAHMAPURAM_SOURCE.lat,
        BRAHMAPURAM_SOURCE.lon,
        receptor.lat,
        receptor.lon
      )
    );
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
    const bearingDeg = Math.round(
      forwardAzimuthDeg(
        BRAHMAPURAM_SOURCE.lat,
        BRAHMAPURAM_SOURCE.lon,
        receptor.lat,
        receptor.lon
      )
    );
    const angularOffsetDeg = Math.round(
      angularDifferenceDeg(downwindBearingDeg, bearingDeg)
    );

    let status: ReceptorPlumeStatus = 'UPWIND';
    if (angularOffsetDeg <= halfConeDeg) {
      status = 'DIRECT DOWNWIND';
    } else if (angularOffsetDeg <= outerHalfConeDeg) {
      status = 'CROSSWIND EDGE';
    } else if (angularOffsetDeg <= 90) {
      status = 'SIDE / OFF-PLUME';
    } else {
      status = 'UPWIND';
    }

    const radOffset = (angularOffsetDeg * Math.PI) / 180;
    const xDownwind = distanceMeters * Math.cos(radOffset);
    const yCrosswind = Math.abs(distanceMeters * Math.sin(radOffset));

    let relativeConcPctOf500m = 0;
    if (xDownwind > 20 && ref500m > 0) {
      const kernel = gaussianGroundKernel(xDownwind, yCrosswind, stability.cls, 5);
      relativeConcPctOf500m = Math.min(
        100,
        Math.round((kernel / ref500m) * 10000) / 100
      );
    }

    const advectionEtaMin =
      angularOffsetDeg <= outerHalfConeDeg
        ? Math.max(1, Math.round(distanceMeters / windSpeedMs / 60))
        : null;

    return {
      receptor,
      distanceMeters,
      distanceKm,
      bearingDeg,
      angularOffsetDeg,
      status,
      advectionEtaMin,
      relativeConcPctOf500m,
    };
  });

  const downwindCampuses = receptors.filter(
    (r) => r.status === 'DIRECT DOWNWIND' || r.status === 'CROSSWIND EDGE'
  );

  return {
    stabilityClass: stability.cls,
    stabilityDescription: stability.label,
    windFromDeg: Math.round(params.windDirectionFromDeg),
    downwindBearingDeg: Math.round(downwindBearingDeg),
    downwindCompass: degToCompass16(downwindBearingDeg),
    windSpeedMs: Math.round(windSpeedMs * 100) / 100,
    windSpeedKmh: Math.round(windSpeedMs * 3.6 * 10) / 10,
    halfConeDeg,
    coreConePolygon: buildConePolygon(downwindBearingDeg, halfConeDeg, 5.2),
    outerConePolygon: buildConePolygon(downwindBearingDeg, outerHalfConeDeg, 5.2),
    receptors,
    downwindCampuses,
  };
}
