import type {
  HourlyAirRecord,
  HourlyWeatherRecord,
  OpenMeteoBundle,
} from '../types/telemetry';

const STORAGE_KEY = 'aieia_campus_openmeteo_v1';

const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=9.988&longitude=76.368&timezone=Asia%2FKolkata&wind_speed_unit=ms&past_days=14&forecast_days=2' +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,is_day,shortwave_radiation' +
  '&hourly=temperature_2m,temperature_80m,temperature_120m,temperature_180m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation,shortwave_radiation,boundary_layer_height' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset';

const AIR_QUALITY_URL =
  'https://air-quality-api.open-meteo.com/v1/air-quality' +
  '?latitude=9.988&longitude=76.368&timezone=Asia%2FKolkata&past_days=1&forecast_days=2' +
  '&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide' +
  '&hourly=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide';

export function formatIstTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatIstShortHHMM(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getNowKolkataIsoPrefix(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const h = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${h}:00`;
}

export function loadCachedBundle(): OpenMeteoBundle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OpenMeteoBundle;
  } catch {
    return null;
  }
}

export async function fetchOpenMeteoBundle(): Promise<OpenMeteoBundle> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);

    const [weatherRes, aqRes] = await Promise.all([
      fetch(FORECAST_URL, { signal: controller.signal }),
      fetch(AIR_QUALITY_URL, { signal: controller.signal }),
    ]);

    window.clearTimeout(timer);

    if (!weatherRes.ok || !aqRes.ok) {
      throw new Error(`Open-Meteo HTTP error (${weatherRes.status}/${aqRes.status})`);
    }

    const weather = await weatherRes.json();
    const aq = await aqRes.json();

    const wCur = weather.current ?? {};
    const wH = weather.hourly ?? {};
    const wD = weather.daily ?? {};
    const aCur = aq.current ?? {};
    const aH = aq.hourly ?? {};

    const wTimes: string[] = wH.time ?? [];
    const hourlyWeather: HourlyWeatherRecord[] = wTimes.map((t, i) => {
      const hourStr = t.slice(11, 13) || '00';
      const hourIst = parseInt(hourStr, 10);
      const t2 = Number(wH.temperature_2m?.[i]);
      const t80 = Number(wH.temperature_80m?.[i] ?? t2);
      const t120 = Number(wH.temperature_120m?.[i] ?? t80);
      const t180 = Number(wH.temperature_180m?.[i] ?? t120);
      const rawBlh = wH.boundary_layer_height?.[i];
      return {
        time: t,
        hourLabel: t.slice(11, 16),
        hourIst,
        temperature2m: t2,
        temperature80m: t80,
        temperature120m: t120,
        temperature180m: t180,
        relativeHumidity2m: Number(wH.relative_humidity_2m?.[i] ?? 75),
        windSpeed10mMs: Number(wH.wind_speed_10m?.[i] ?? 0),
        windDirection10mDeg: Number(wH.wind_direction_10m?.[i] ?? 0),
        cloudCoverPct: Number(wH.cloud_cover?.[i] ?? 0),
        precipitationMm: Number(wH.precipitation?.[i] ?? 0),
        shortwaveRadiationWm2: Number(wH.shortwave_radiation?.[i] ?? 0),
        boundaryLayerHeightM:
          rawBlh !== null && rawBlh !== undefined && Number.isFinite(Number(rawBlh))
            ? Number(rawBlh)
            : null,
      };
    });

    const aTimes: string[] = aH.time ?? [];
    const hourlyAir: HourlyAirRecord[] = aTimes.map((t, i) => {
      const coUg = Number(aH.carbon_monoxide?.[i] ?? aCur.carbon_monoxide ?? 0);
      return {
        time: t,
        pm25: Number(aH.pm2_5?.[i] ?? aCur.pm2_5 ?? 0),
        pm10: Number(aH.pm10?.[i] ?? aCur.pm10 ?? 0),
        no2: Number(aH.nitrogen_dioxide?.[i] ?? aCur.nitrogen_dioxide ?? 0),
        so2: Number(aH.sulphur_dioxide?.[i] ?? aCur.sulphur_dioxide ?? 0),
        ozone: Number(aH.ozone?.[i] ?? aCur.ozone ?? 0),
        coUgM3: coUg,
        coMgM3: coUg / 1000,
      };
    });

    const nowPrefix = getNowKolkataIsoPrefix();
    const curWeatherHour =
      hourlyWeather.find((h) => h.time >= nowPrefix) ??
      hourlyWeather[hourlyWeather.length - 1];

    // Find today's index in daily arrays (past_days=14 => index 14 is today)
    const dailyTimes: string[] = wD.time ?? [];
    const todayDate = nowPrefix.slice(0, 10);
    const todayIdx = Math.max(
      0,
      dailyTimes.findIndex((d) => d === todayDate)
    );

    const coUgM3 = Number(aCur.carbon_monoxide ?? 0);
    const fetchedAtIso = new Date().toISOString();

    const bundle: OpenMeteoBundle = {
      fetchedAtIso,
      lastGoodIstLabel: formatIstTime(new Date(fetchedAtIso)),
      isStaleCache: false,
      errorMessage: null,
      currentWeather: {
        temperature2m: Number(wCur.temperature_2m ?? 0),
        apparentTemperature: Number(wCur.apparent_temperature ?? 0),
        relativeHumidity2m: Number(wCur.relative_humidity_2m ?? 0),
        windSpeed10mMs: Number(wCur.wind_speed_10m ?? 0),
        windDirection10mDeg: Number(wCur.wind_direction_10m ?? 0),
        windGusts10mMs: Number(wCur.wind_gusts_10m ?? 0),
        cloudCoverPct: Number(wCur.cloud_cover ?? 0),
        precipitationMm: Number(wCur.precipitation ?? 0),
        isDay: Boolean(wCur.is_day),
        shortwaveRadiationWm2: Number(wCur.shortwave_radiation ?? 0),
        boundaryLayerHeightM: curWeatherHour?.boundaryLayerHeightM ?? null,
      },
      daily: {
        tempMax: Number(wD.temperature_2m_max?.[todayIdx] ?? wCur.temperature_2m ?? 0),
        tempMin: Number(wD.temperature_2m_min?.[todayIdx] ?? wCur.temperature_2m ?? 0),
        precipitationSumToday: Number(wD.precipitation_sum?.[todayIdx] ?? 0),
        sunrise: String(wD.sunrise?.[todayIdx] ?? ''),
        sunset: String(wD.sunset?.[todayIdx] ?? ''),
      },
      currentAir: {
        pm25: Number(aCur.pm2_5 ?? 0),
        pm10: Number(aCur.pm10 ?? 0),
        no2: Number(aCur.nitrogen_dioxide ?? 0),
        so2: Number(aCur.sulphur_dioxide ?? 0),
        ozone: Number(aCur.ozone ?? 0),
        coUgM3,
        coMgM3: coUgM3 / 1000,
      },
      hourlyWeather,
      hourlyAir,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    } catch {
      // Ignore quota errors
    }

    return bundle;
  } catch (err) {
    const cached = loadCachedBundle();
    if (cached) {
      const hhmm = formatIstShortHHMM(cached.fetchedAtIso);
      return {
        ...cached,
        isStaleCache: true,
        errorMessage: `Data unavailable — last good value at ${hhmm} IST`,
      };
    }
    throw err instanceof Error
      ? err
      : new Error('Live Open-Meteo data unavailable and no cached telemetry present.');
  }
}
