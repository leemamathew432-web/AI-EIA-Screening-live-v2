import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useObservatory } from '../context/ObservatoryContext';

// AI Daily Summary — calls the Netlify Function /.netlify/functions/daily-summary.
// The Gemini key stays on the server (Netlify env var GEMINI_API_KEY).

export function AiDailySummary() {
  const { naqi, plume, tonightHours, riverWashout, eiaMatrix, istClock } = useObservatory();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [madeAt, setMadeAt] = useState<string | null>(null);

  if (!naqi || !plume || !riverWashout || !eiaMatrix) return null;

  const peak =
    tonightHours.length > 0
      ? tonightHours.reduce((a, b) => (b.trapScore > a.trapScore ? b : a), tonightHours[0])
      : null;

  async function generate() {
    if (!naqi || !plume || !riverWashout || !eiaMatrix) return;
    setLoading(true);
    setError(null);
    try {
      const inPlume = plume.receptors
        .filter((r) => r.status === 'DIRECT DOWNWIND' || r.status === 'CROSSWIND EDGE')
        .map((r) => `${r.receptor.shortName} (${r.status}, ${r.distanceKm} km)`)
        .join(', ');
      const body = {
        timeIst: istClock,
        aqi: naqi.aqi,
        aqiCategory: naqi.category,
        dominantPollutant: naqi.dominantPollutant,
        averaging: naqi.dominantAveragingPeriod,
        windKmh: plume.windSpeedKmh,
        windFromDeg: plume.windFromDeg,
        downwindCompass: plume.downwindCompass,
        stabilityClass: plume.stabilityClass,
        stabilityDescription: plume.stabilityDescription,
        receptorsInPlume: inPlume,
        peakTrapScore: peak ? peak.trapScore : 'n/a',
        peakTrapTier: peak ? peak.riskTier : 'n/a',
        peakTrapHour: peak ? peak.hourLabel : 'n/a',
        minDo: riverWashout.criticalMinDoMgL,
        riverStatus: riverWashout.status,
        verdict: eiaMatrix.verdict,
        overallScore: eiaMatrix.overallScore.toFixed(2),
        drivers: eiaMatrix.topDrivers.map((d) => `${d.component} (${d.score})`).join(' · '),
      };
      const res = await fetch('/.netlify/functions/daily-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 404) {
        setError('AI summary works only on the deployed Netlify site.');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok || !data.summary) {
        setError(data.error || 'AI summary is not available right now. Try again later.');
        return;
      }
      setSummary(data.summary);
      setMadeAt(istClock);
    } catch {
      setError('AI summary is not available right now. Try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-300" />
          <h2 className="font-display text-base font-bold text-white">AI Daily Summary</h2>
          <span className="rounded-md border border-teal-600/60 bg-[#032423] px-2 py-0.5 font-mono text-[10px] text-teal-200/90">
            Gemini
          </span>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/80 bg-[#032423] px-4 py-2 text-xs font-semibold text-teal-300 hover:border-teal-400 hover:text-white transition-colors disabled:opacity-60 self-start sm:self-center"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          <span>{loading ? 'Generating…' : summary ? 'Refresh summary' : 'Generate summary'}</span>
        </button>
      </div>

      {!summary && !error && (
        <p className="mt-3 text-xs text-teal-100/70">
          Plain-language summary of the live readings on this page, written by Google Gemini.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-amber-300">{error}</p>}
      {summary && (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-line text-sm leading-relaxed text-teal-50/90">{summary}</p>
          <p className="font-mono text-[10px] text-teal-200/60">
            Generated {madeAt} · AI text from live data; numbers come from the models on this site.
          </p>
        </div>
      )}
    </section>
  );
}
