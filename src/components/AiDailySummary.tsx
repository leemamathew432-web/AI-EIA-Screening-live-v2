import { Loader2, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { useObservatory } from '../context/ObservatoryContext';

// AI Daily Summary — Dashboard only.
// Calls the Netlify Function /.netlify/functions/summary (Gemini key stays on the server).

type Lang = 'en' | 'ml';

const DAILY_LIMIT = 10;
const LIMIT_KEY = 'aieia_ai_summary_count_v1';
const CACHE_MS = 5 * 60 * 1000;

function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function readCount(): number {
  try {
    const raw = localStorage.getItem(LIMIT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date: string; count: number };
    return parsed.date === todayIst() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function bumpCount(): void {
  try {
    localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: todayIst(), count: readCount() + 1 }));
  } catch {
    // ignore storage errors
  }
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AiDailySummary() {
  const { naqi, plume, tonightHours, riverWashout, eiaMatrix } = useObservatory();
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryTime, setSummaryTime] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Partial<Record<Lang, { text: string; time: string; at: number }>>>({});

  if (!naqi || !plume || !riverWashout || !eiaMatrix) return null;

  function buildLiveData(time: string) {
    if (!naqi || !plume || !riverWashout || !eiaMatrix) return null;
    const pm25 = naqi.subIndices.find((s) => s.pollutant === 'PM2.5');
    const peak =
      tonightHours.length > 0
        ? tonightHours.reduce((a, b) => (b.trapScore > a.trapScore ? b : a), tonightHours[0])
        : null;
    const minCeiling = tonightHours.length > 0 ? Math.min(...tonightHours.map((h) => h.blhMeters)) : null;
    return {
      time: `${time} IST`,
      aqi: {
        value: naqi.aqi,
        category: naqi.category,
        prominentPollutant: naqi.dominantPollutant,
        averaging: naqi.dominantAveragingPeriod,
        pm25_24hAvg: pm25 ? `${pm25.concentration} ${pm25.unit}` : 'n/a',
      },
      wind: {
        speedKmh: plume.windSpeedKmh,
        stabilityClass: plume.stabilityClass,
        stabilityName: plume.stabilityDescription,
      },
      plume: {
        headingDeg: plume.downwindBearingDeg,
        direction: plume.downwindCompass,
        affectedPlaces: plume.receptors
          .filter((r) => r.status === 'DIRECT DOWNWIND' || r.status === 'CROSSWIND EDGE')
          .map((r) => ({
            name: r.receptor.shortName,
            status: r.status,
            etaMin: r.advectionEtaMin,
          })),
      },
      tonight: peak
        ? {
            peakTrapPct: peak.trapScore,
            level: peak.riskTier,
            peakTime: `${peak.hourLabel} IST`,
            minCeilingM: minCeiling,
          }
        : 'no data',
      river: {
        criticalMinDoMgL: riverWashout.criticalMinDoMgL,
        status: riverWashout.status,
        sagNote: riverWashout.isSagBeyondReach
          ? 'Lowest oxygen point is beyond the 12 km study reach'
          : `Lowest oxygen at about ${riverWashout.criticalSagDistanceKm} km downstream`,
      },
      eia: {
        verdict: eiaMatrix.verdict,
        score: `${eiaMatrix.overallScore.toFixed(2)} / 4`,
        topDrivers: eiaMatrix.topDrivers.map((d) => `${d.component} (${d.score})`),
      },
    };
  }

  async function explain(lang: Lang) {
    setError(null);

    const cached = cache.current[lang];
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setSummary(cached.text);
      setSummaryTime(cached.time);
      return;
    }

    if (readCount() >= DAILY_LIMIT) {
      setError('Daily summary limit reached. Please try again tomorrow.');
      return;
    }

    const time = nowHHMM();
    const liveData = buildLiveData(time);
    if (!liveData) return;

    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, liveData }),
      });
      const data = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok || !data.summary) {
        setError(
          data.error ||
            (res.status === 404
              ? 'AI summary works only on the deployed Netlify site.'
              : 'AI summary is unavailable right now. Please try again.'),
        );
        return;
      }
      bumpCount();
      cache.current[lang] = { text: data.summary, time, at: Date.now() };
      setSummary(data.summary);
      setSummaryTime(time);
    } catch {
      setError('AI summary is unavailable right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const lines = (summary || '')
    .split('\n')
    .map((l) => l.trim().replace(/^[*\-•]\s+/, '').replace(/\*/g, '').trim())
    .filter(Boolean)
    // drop the disclaimer line (already shown in the footer)
    .filter((l) => !/screening tool, not an official alert/i.test(l));
  // join a lone "As of HH:MM IST:" line with the next bullet
  const bullets: string[] = [];
  for (const l of lines) {
    const prev = bullets[bullets.length - 1];
    if (prev !== undefined && /^As of \d{1,2}:\d{2} IST:?$/i.test(prev)) {
      bullets[bullets.length - 1] = `${prev.replace(/:?$/, ':')} ${l}`;
    } else {
      bullets.push(l);
    }
  }

  return (
    <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-base font-bold text-white">AI Daily Summary</h2>
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
            <Sparkles className="h-3 w-3" />
            AI-GENERATED
          </span>
        </div>
        <p className="text-xs text-teal-100/80">
          Plain-language summary of the live readings above, written by Google Gemini.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => explain('en')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/80 bg-[#032423] px-4 py-2 text-xs font-semibold text-teal-300 hover:border-teal-400 hover:text-white transition-colors disabled:opacity-60 cursor-pointer"
        >
          Explain in English
        </button>
        <button
          type="button"
          onClick={() => explain('ml')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/80 bg-[#032423] px-4 py-2 text-xs font-semibold text-teal-300 hover:border-teal-400 hover:text-white transition-colors disabled:opacity-60 cursor-pointer"
        >
          മലയാളത്തിൽ വിശദീകരിക്കുക
        </button>
      </div>

      {loading && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-teal-200/90">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Generating summary…
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      {summary && !loading && (
        <div className="mt-4 space-y-2">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-teal-50/90">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <p className="font-mono text-[10px] text-teal-200/60">
            AI-generated · based on live data at {summaryTime} IST · Screening tool, not an official alert.
          </p>
        </div>
      )}
    </section>
  );
}
