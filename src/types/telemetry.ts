export type DataBadgeType = 'LIVE' | 'MODELLED' | 'PUBLISHED' | 'ASSUMED' | 'SIMULATION MODE';

export interface HourlyWeatherRecord {
  time: string; // ISO Asia/Kolkata e.g. 2026-11-19T18:00
  hourLabel: string; // HH:00
  hourIst: number; // 0-23
  temperature2m: number;
  temperature80m: number;
  temperature120m: number;
  temperature180m: number;
  relativeHumidity2m: number;
  windSpeed10mMs: number;
  windDirection10mDeg: number;
  cloudCoverPct: number;
  precipitationMm: number;
  shortwaveRadiationWm2: number;
  boundaryLayerHeightM: number | null;
}

export interface HourlyAirRecord {
  time: string;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  ozone: number;
  coUgM3: number;
  coMgM3: number;
}

export interface OpenMeteoBundle {
  fetchedAtIso: string;
  lastGoodIstLabel: string;
  isStaleCache: boolean;
  errorMessage: string | null;
  currentWeather: {
    temperature2m: number;
    apparentTemperature: number;
    relativeHumidity2m: number;
    windSpeed10mMs: number;
    windDirection10mDeg: number;
    windGusts10mMs: number;
    cloudCoverPct: number;
    precipitationMm: number;
    isDay: boolean;
    shortwaveRadiationWm2: number;
    boundaryLayerHeightM: number | null;
  };
  daily: {
    tempMax: number;
    tempMin: number;
    precipitationSumToday: number;
    sunrise: string;
    sunset: string;
  };
  currentAir: {
    pm25: number;
    pm10: number;
    no2: number;
    so2: number;
    ozone: number;
    coUgM3: number;
    coMgM3: number;
  };
  hourlyWeather: HourlyWeatherRecord[]; // 14 past days + 2 forecast days
  hourlyAir: HourlyAirRecord[]; // 1 past day + 2 forecast days
}
