export interface LatLon {
  lat: number;
  lon: number;
}

export interface ReceptorDefinition {
  id: string;
  name: string;
  shortName: string;
  category: 'IT Park' | 'College' | 'Urban Centre' | 'School' | 'Kindergarten';
  lat: number;
  lon: number;
}

// Brahmapuram Solid Waste Dumpsite (~108–110 acres, 5 km study radius)
export const BRAHMAPURAM_SOURCE: LatLon = {
  lat: 9.988, // VERIFY ON GOOGLE MAPS
  lon: 76.368, // VERIFY ON GOOGLE MAPS
};

export const STUDY_RADIUS_METERS = 5000;
export const SITE_AREA_HA = 44; // ~108.7 acres

// Approximate 110-acre Brahmapuram site boundary polygon
export const SITE_BOUNDARY_POLYGON: [number, number][] = [
  [9.9912, 76.3646],
  [9.9916, 76.3705],
  [9.9876, 76.3724],
  [9.9844, 76.3694],
  [9.9851, 76.3642],
];

// Approximate Reclaimed Sector (~18 acres per Feb 2025 reports) vs Active Sector
export const RECLAIMED_SECTOR_POLYGON: [number, number][] = [
  [9.9912, 76.3646],
  [9.9915, 76.3684],
  [9.9888, 76.3688],
  [9.9884, 76.3645],
];

export const ACTIVE_SECTOR_POLYGON: [number, number][] = [
  [9.9884, 76.3645],
  [9.9888, 76.3688],
  [9.9915, 76.3684],
  [9.9916, 76.3705],
  [9.9876, 76.3724],
  [9.9844, 76.3694],
  [9.9851, 76.3642],
];

export const RECEPTORS: ReceptorDefinition[] = [
  {
    id: 'infopark-1',
    name: 'Infopark Phase-I, Kakkanad',
    shortName: 'Infopark Ph-I',
    category: 'IT Park',
    lat: 10.0101, // VERIFY ON GOOGLE MAPS
    lon: 76.363, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'infopark-2',
    name: 'Infopark Phase-II, Kakkanad',
    shortName: 'Infopark Ph-II',
    category: 'IT Park',
    lat: 10.0065, // VERIFY ON GOOGLE MAPS
    lon: 76.3756, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'smartcity',
    name: 'SmartCity Kochi',
    shortName: 'SmartCity',
    category: 'IT Park',
    lat: 9.996, // VERIFY ON GOOGLE MAPS
    lon: 76.379, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'rajagiri',
    name: 'Rajagiri Valley Campus, Kakkanad',
    shortName: 'Rajagiri Valley',
    category: 'College',
    lat: 9.995, // VERIFY ON GOOGLE MAPS
    lon: 76.3581, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'kochi-center',
    name: 'Kochi City Centre / MG Road',
    shortName: 'MG Road',
    category: 'Urban Centre',
    lat: 9.9639, // VERIFY ON GOOGLE MAPS
    lon: 76.2875, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'jbs-brahmapuram',
    name: 'Govt. J.B.S. Brahmapuram',
    shortName: 'Govt. JBS',
    category: 'School',
    lat: 9.9838, // VERIFY ON GOOGLE MAPS
    lon: 76.3742, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'btc-puthencruz',
    name: 'B.T.C. Public School & Kindergarten, Puthencruz',
    shortName: 'BTC Puthencruz',
    category: 'Kindergarten',
    lat: 9.9785, // VERIFY ON GOOGLE MAPS
    lon: 76.391, // VERIFY ON GOOGLE MAPS
  },
  {
    id: 'st-charles-thuthiyoor',
    name: 'St. Charles Borromeo School, Thuthiyoor',
    shortName: 'St. Charles',
    category: 'School',
    lat: 9.9988, // VERIFY ON GOOGLE MAPS
    lon: 76.3422, // VERIFY ON GOOGLE MAPS
  },
];

// 10 ordered coordinates along Kadambrayar River:
// index 0: upstream Manakkakadavu; index 4: Brahmapuram leachate entry node; index 9: Ambalamugal/Chitrapuzha
export const KADAMBAYAR_RIVER_POLYLINE: [number, number][] = [
  [10.0138, 76.3905], // 0: Upstream Manakkakadavu
  [10.0074, 76.3852], // 1
  [10.0011, 76.3806], // 2
  [9.9952, 76.3771], // 3
  [9.9896, 76.3748], // 4: Brahmapuram leachate entry node
  [9.9841, 76.3779], // 5
  [9.9786, 76.3822], // 6
  [9.9728, 76.3871], // 7
  [9.9671, 76.3926], // 8
  [9.9612, 76.3982], // 9: Downstream Ambalamugal / Chitrapuzha
];

export const RIVER_ENTRY_NODE_INDEX = 4;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function forwardAzimuthDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): [number, number] {
  const R = 6371;
  const angDist = distanceKm / R;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) +
      Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [toDeg(lat2), toDeg(lon2)];
}

/**
 * Interpolate a [lat, lon] point along a polyline starting from `startIndex`
 * at `distanceKm` downstream. Clamps to final node if distance exceeds polyline length.
 */
export function pointAlongPolyline(
  polyline: [number, number][],
  startIndex: number,
  distanceKm: number
): [number, number] {
  if (polyline.length === 0) return [BRAHMAPURAM_SOURCE.lat, BRAHMAPURAM_SOURCE.lon];
  const idx = Math.max(0, Math.min(startIndex, polyline.length - 1));
  let remainingM = Math.max(0, distanceKm * 1000);

  for (let i = idx; i < polyline.length - 1; i++) {
    const [latA, lonA] = polyline[i];
    const [latB, lonB] = polyline[i + 1];
    const segLenM = haversineDistanceMeters(latA, lonA, latB, lonB);
    if (remainingM <= segLenM && segLenM > 0) {
      const f = remainingM / segLenM;
      return [latA + (latB - latA) * f, lonA + (lonB - lonA) * f];
    }
    remainingM -= segLenM;
  }

  return polyline[polyline.length - 1];
}
