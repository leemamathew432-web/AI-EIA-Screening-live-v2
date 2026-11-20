import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useObservatory } from '../context/ObservatoryContext';
import { BIOMINING_MILESTONES, BASELINE_VOLUME_LABEL } from '../data/published';

// "AI explains this page" box — one per page.
// Sends ONLY the page's own computed numbers to /.netlify/functions/ai-insight
// (Gemini key stays on the server as GEMINI_API_KEY).

export type AiInsightPage = 'live' | 'I-1' | 'I-2' | 'I-3' | 'I-4' | 'eia';

const TITLES: Record<AiInsightPage, string> = {
  live: 'AI Explains: Live Air Quality',
  'I-1': 'AI Explains: Plume Trajectory',
  'I-2': 'AI Explains: Night Inversion',
  'I-3': 'AI Explains: River Oxygen Sag',
  'I-4': 'AI Explains: Biomining Progress',
  eia: 'AI Explains: EIA Verdict',
};

export function AiInsight({ page }: { page: AiInsightPage }) {
  const obs = useObservatory();
  const { naqi, plume, tonightHours, tonightPredictions, ridgeModel, riverWashout, eiaMatrix, istClock } = obs;
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [madeAt, setMadeAt] = useState<string | null>(null);

  function buildFacts(): string[] | null {
    switch (page) {
      case 'live': {
        if (!naqi) return null;
        const subs = naqi.subIndices.map(
          (s) =>
            `${s.pollutant}: ${s.concentration} ${s.unit} (${s.averagingPeriod}), now ${s.currentConcentration} ${s.unit}, sub-index ${s.subIndex}`,
        );
        return [
          `CPCB NAQI ${naqi.aqi} (${naqi.category}); prominent ${naqi.dominantPollutant} (${naqi.dominantAveragingPeriod})`,
          ...subs,
        ];
      }
      case 'I-1': {
        if (!plume) return null;
        const rows = plume.receptors.map(
          (r) =>
            `${r.receptor.shortName} (${r.receptor.category}): ${r.status}, ${r.distanceKm} km` +
            (r.advectionEtaMin !== null ? `, smoke ETA ${r.advectionEtaMin} min` : '') +
            (r.relativeConcPctOf500m > 0 ? `, relative conc ${r.relativeConcPctOf500m}% of 500 m` : ''),
        );
        return [
          `Wind ${plume.windSpeedKmh} km/h from ${plume.windFromDeg} deg; plume heading ${plume.downwindBearingDeg} deg (${plume.downwindCompass})`,
          `Pasquill-Gifford class ${plume.stabilityClass} (${plume.stabilityDescription}); core cone ±${plume.halfConeDeg} deg`,
          `Values are ${obs.isPlumeSimulated ? 'WHAT-IF slider values (simulation)' : 'live'}`,
          ...rows,
        ];
      }
      case 'I-2': {
        if (tonightHours.length === 0) return null;
        const peak = tonightHours.reduce((a, b) => (b.trapScore > a.trapScore ? b : a), tonightHours[0]);
        const minBlh = Math.min(...tonightHours.map((h) => h.blhMeters));
        const hours = tonightPredictions.map(
          (p) => `${p.hourLabel}: trap ${p.trapScore}, inversion probability ${p.inversionProbPct}%`,
        );
        return [
          `Peak trap score tonight ${peak.trapScore}/100 (${peak.riskTier}) at ${peak.hourLabel} IST; lowest mixing ceiling ${minBlh} m`,
          ridgeModel
            ? `Ridge model hold-out accuracy ${ridgeModel.holdoutBinaryAccuracyPct}%, MAE ${ridgeModel.holdoutMaeC} C`
            : 'Ridge model not trained',
          ...hours,
        ];
      }
      case 'I-3': {
        if (!riverWashout) return null;
        const r = riverWashout;
        return [
          `Rainfall today ${r.rainfallMmPerDay} mm; water temperature ${r.waterTempC} C; DO saturation ${r.doSaturationMgL} mg/L`,
          `Runoff pulse ${r.runoffPulseM3s} m3/s; mixed BOD ${r.mixedInitialBodMgL} mg/L; mixed DO ${r.mixedInitialDoMgL} mg/L`,
          `Critical minimum DO ${r.criticalMinDoMgL} mg/L (${r.status}) at ${r.criticalSagDistanceKm} km downstream` +
            (r.isSagBeyondReach ? ' (true sag point is beyond the 12 km study reach)' : ''),
          'River velocity, flow and leachate BOD are assumed parameters (illustrative), not measured.',
        ];
      }
      case 'I-4': {
        const last = BIOMINING_MILESTONES[BIOMINING_MILESTONES.length - 1];
        return [
          `Baseline legacy waste ${BASELINE_VOLUME_LABEL}`,
          ...BIOMINING_MILESTONES.map(
            (m) => `${m.dateLabel}: ${m.percentBiomined}% biomined, ${m.reclaimedAcres} acres reclaimed (${m.sourceName})`,
          ),
          `Latest published figure: ${last.percentBiomined}% on ${last.dateLabel}; ${100 - last.percentBiomined}% remaining`,
        ];
      }
      case 'eia': {
        if (!eiaMatrix) return null;
        return [
          `Verdict ${eiaMatrix.verdict}, overall ${eiaMatrix.overallScore.toFixed(2)} / 4`,
          ...eiaMatrix.rows.map(
            (r) => `${r.component}: ${r.valueDisplay}; score ${r.score ?? 'no data'}`,
          ),
        ];
      }
    }
  }

  async function generate() {
    const facts = buildFacts();
    if (!facts) {
      setError('Live data is still loading. Try again in a moment.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/.netlify/functions/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, facts }),
      });
      if (res.status === 404) {
        setError('AI explanation works only on the deployed Netlify site.');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setError(data.error || 'AI explanation is not available right now. Try again later.');
        return;
      }
      setText(data.text);
      setMadeAt(istClock);
    } catch {
      setError('AI explanation is not available right now. Try again later.');
    } finally {
      setLoading(false);
    }
  }

  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const isBullet = (l: string) => /^[*\-•]\s+/.test(l);
  const strip = (l: string) => l.replace(/^[*\-•]\s+/, '').replace(/\*\*/g, '');

  return (
    <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-300" />
          <h2 className="font-display text-base font-bold text-white">{TITLES[page]}</h2>
          <span className="rounded-md border border-teal-600/60 bg-[#032423] px-2 py-0.5 font-mono text-[10px] text-teal-200/90">
            Gemini
          </span>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/80 bg-[#032423] px-4 py-2 text-xs font-semibold text-teal-300 hover:border-teal-400 hover:text-white transition-colors disabled:opacity-60 self-start sm:self-center cursor-pointer"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          <span>{loading ? 'Explaining…' : text ? 'Refresh explanation' : 'Explain in simple words'}</span>
        </button>
      </div>

      {!text && !error && (
        <p className="mt-3 text-xs text-teal-100/70">
          Plain-language explanation of the numbers on this page, written by Google Gemini.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-amber-300">{error}</p>}
      {text && (
        <div className="mt-3 space-y-2">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-teal-50/90">
            {lines.filter(isBullet).map((l, i) => (
              <li key={i}>{strip(l)}</li>
            ))}
          </ul>
          {lines
            .filter((l) => !isBullet(l))
            .map((l, i) => (
              <p key={i} className="text-sm text-teal-100/80">
                {strip(l)}
              </p>
            ))}
          <p className="font-mono text-[10px] text-teal-200/60">
            Generated {madeAt} · AI text from this page's data; numbers come from the models on this site.
          </p>
        </div>
      )}
    </section>
  );
}
