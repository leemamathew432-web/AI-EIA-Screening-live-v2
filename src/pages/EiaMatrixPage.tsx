import { AlertTriangle, Check, CheckCircle2, Copy, RefreshCw, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useObservatory } from '../context/ObservatoryContext';
import type { OverallVerdictTier, SignificanceLabel } from '../physics/eiaMatrix';

interface FitRow {
  observation: string;
  path: string;
  component: string;
  stars: number;
  relevanceLabel: 'High' | 'Medium';
  why: string;
}

const TABLE_1_ROWS: FitRow[] = [
  {
    observation: 'I-1 Plume trajectory',
    path: '/observations/plume-trajectory',
    component: 'Air: impact on sensitive receptors',
    stars: 5,
    relevanceLabel: 'High',
    why: 'EIA screening asks "which sensitive receptors (schools, hospitals, homes) are within the impact zone?" I-1 answers that directly, with distances and directions.',
  },
  {
    observation: 'I-2 Night inversion',
    path: '/observations/night-inversion',
    component: 'Air: meteorology and dispersion',
    stars: 4,
    relevanceLabel: 'High',
    why: 'EIA requires site meteorology (wind, stability, mixing height). I-2 is exactly that baseline, made live.',
  },
  {
    observation: 'I-3 River leachate and oxygen',
    path: '/observations/river-leachate',
    component: 'Water: surface-water impact',
    stars: 4,
    relevanceLabel: 'High',
    why: 'Water-quality impact on a nearby river is a core EIA item. Streeter-Phelps is a standard EIA water model.',
  },
  {
    observation: 'I-4 Biomining and land recovery',
    path: '/observations/biomining-tracker',
    component: 'Land and waste: mitigation progress',
    stars: 3,
    relevanceLabel: 'Medium',
    why: 'It shows the remediation, which is the mitigation step, rather than predicting impact. Useful context, but it relies on published figures, not a model.',
  },
  {
    observation: 'Live Conditions (NAQI)',
    path: '/live-conditions',
    component: 'Air quality: public health baseline',
    stars: 4,
    relevanceLabel: 'High',
    why: 'Ambient air quality against CPCB NAAQS (24-h and 8-h moving averages) is a mandatory EIA baseline parameter.',
  },
];

function getSignificanceStyle(sig: SignificanceLabel | 'No data'): string {
  switch (sig) {
    case 'Low':
      return 'text-emerald-400 font-medium';
    case 'Moderate':
      return 'text-amber-300 font-medium';
    case 'High':
      return 'text-orange-400 font-bold';
    case 'Severe':
      return 'text-rose-400 font-bold';
    default:
      return 'text-teal-200/70';
  }
}

function getVerdictTextStyle(level: OverallVerdictTier): string {
  switch (level) {
    case 'LOW':
      return 'text-emerald-400 font-bold';
    case 'MODERATE':
      return 'text-amber-300 font-bold';
    case 'HIGH':
      return 'text-orange-400 font-bold';
    case 'SEVERE':
      return 'text-rose-400 font-bold';
  }
}

function getVerdictBadgeClasses(level: OverallVerdictTier): string {
  switch (level) {
    case 'SEVERE':
      return 'border-rose-500/60 bg-rose-500/20 text-rose-300';
    case 'HIGH':
      return 'border-orange-500/60 bg-orange-500/20 text-orange-300';
    case 'MODERATE':
      return 'border-amber-400/60 bg-amber-400/20 text-amber-300';
    case 'LOW':
      return 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300';
  }
}

export function EiaMatrixPage() {
  const { bundle, loading, refreshNow, eiaMatrix, plume, isPlumeSimulated, resetPlumeSim } =
    useObservatory();
  const [copied, setCopied] = useState(false);

  if (!bundle || !eiaMatrix || !plume) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-8 text-sm text-teal-100">
          Connecting to live Brahmapuram–Kakkanad environmental observations…
        </div>
      </div>
    );
  }

  const activeRows = eiaMatrix.rows.filter((r) => r.score !== null);
  const updatedHm = bundle.lastGoodIstLabel.slice(0, 5);
  const verdictWithScore = `${eiaMatrix.verdict} · ${eiaMatrix.overallScore.toFixed(2)} / 4`;

  const driverSummary = eiaMatrix.topDrivers
    .map((d) => `${d.component} (${d.valueDisplay}, ${d.significance} ${d.score}/4)`)
    .join(' and ');

  const authorityStatement = `Each observation covers one EIA component (air, water, land, health). As of ${updatedHm} IST, the live screening verdict for the Brahmapuram site is ${verdictWithScore} (${eiaMatrix.verdictDescription})${
    driverSummary ? `, driven by ${driverSummary}` : ''
  }.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(authorityStatement);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Plume simulation notice when I-1 sliders override live wind */}
      {isPlumeSimulated && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-[#032423] px-4 py-3 text-xs text-amber-200">
          <span>
            What-if Plume slider values are active ({plume.downwindBearingDeg}° {plume.downwindCompass},{' '}
            {plume.windSpeedKmh} km/h, ±{plume.halfConeDeg}° cone). Dashboard &amp; EIA Matrix reflect this simulation.
          </span>
          <button
            type="button"
            onClick={resetPlumeSim}
            className="rounded-md border border-amber-400/60 bg-amber-400/15 px-3 py-1 font-mono font-bold text-amber-200 hover:bg-amber-400/25 cursor-pointer"
          >
            Reset to Live
          </button>
        </div>
      )}

      {/* Page Title Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          EIA Impact Matrix
        </h1>
        <button
          type="button"
          onClick={refreshNow}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-3.5 py-2 text-xs font-bold text-[#042f2e] hover:bg-teal-300 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* SECTION 1 — Observation Relevance Table */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6">
        <div className="overflow-x-auto rounded-lg border border-teal-800/70 bg-[#032423]">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-teal-800/80 bg-[#042f2e] text-xs font-mono uppercase tracking-wider text-teal-300">
              <tr>
                <th className="px-4 py-3">Observation</th>
                <th className="px-4 py-3">EIA component</th>
                <th className="px-4 py-3">Relevance</th>
                <th className="px-4 py-3">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50 text-teal-50/90">
              {TABLE_1_ROWS.map((row) => (
                <tr key={row.observation} className="hover:bg-[#063836]/55">
                  <td className="px-4 py-3.5 align-top font-semibold whitespace-nowrap">
                    <Link
                      to={row.path}
                      className="text-teal-300 underline decoration-teal-500/50 underline-offset-4 hover:text-teal-200"
                    >
                      {row.observation}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 align-top text-teal-100/90">{row.component}</td>
                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-0.5"
                        aria-label={`${row.stars} out of 5 stars`}
                      >
                        {Array.from({ length: row.stars }).map((_, idx) => (
                          <Star
                            key={idx}
                            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                          />
                        ))}
                      </span>
                      <span className="font-mono text-xs font-semibold text-amber-200">
                        {row.relevanceLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top text-xs leading-relaxed text-teal-100/80">
                    {row.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2 — EIA Screening Verdict (Live) */}
      <section className="space-y-4 rounded-xl border border-teal-800/70 bg-[#063836] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold text-white">
              EIA Screening Verdict (Live)
            </h2>
            <p className="text-sm leading-relaxed text-teal-100/85">
              Screening must answer one question: is the impact significant or not? This live matrix
              combines the observations using the shared weighted EIA calculation.
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-sm font-bold tabular-nums shrink-0 ${getVerdictBadgeClasses(
              eiaMatrix.verdict
            )}`}
          >
            {eiaMatrix.verdict === 'SEVERE' || eiaMatrix.verdict === 'HIGH' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{verdictWithScore}</span>
          </span>
        </div>

        {/* Small LIVE badge and Updated HH:MM IST directly above Table 2 */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${
              bundle.isStaleCache
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                bundle.isStaleCache ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span>{bundle.isStaleCache ? 'CACHED' : 'LIVE'}</span>
          </span>
          <span className="font-mono text-xs text-teal-200/85 tabular-nums">
            Updated {updatedHm} IST
          </span>
        </div>

        {/* Table 2: Component | Indicator | Today | Significance */}
        <div className="overflow-x-auto rounded-lg border border-teal-800/70 bg-[#032423]">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="border-b border-teal-800/80 bg-[#042f2e] text-xs font-mono uppercase tracking-wider text-teal-300">
              <tr>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Indicator</th>
                <th className="px-4 py-3">Today</th>
                <th className="px-4 py-3">Significance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50 text-teal-50/90">
              {activeRows.map((row) => (
                <tr key={row.id} className="hover:bg-[#063836]/55">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {row.component}
                  </td>
                  <td className="px-4 py-3 text-xs text-teal-100/85">
                    <span className="font-semibold text-teal-200">{row.sourceLabel}:</span>{' '}
                    {row.indicator}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-teal-200 tabular-nums">
                    {row.valueDisplay}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap ${getSignificanceStyle(
                      row.significance
                    )}`}
                  >
                    {row.significance} ({row.score}/4)
                    <span className="ml-2 font-mono text-[11px] font-normal text-teal-200/60">
                      w={row.weight.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-teal-500/70 bg-[#042f2e]/90 font-bold">
                <td className="px-4 py-3.5 text-white">Overall</td>
                <td className="px-4 py-3.5 text-xs font-normal text-teal-200/80">
                  Weighted average ({activeRows.length} active inputs · weights sum{' '}
                  {eiaMatrix.usedWeightSum.toFixed(2)})
                </td>
                <td className="px-4 py-3.5 font-mono text-white tabular-nums whitespace-nowrap">
                  {eiaMatrix.overallScore.toFixed(2)} / 4
                </td>
                <td className={`px-4 py-3.5 ${getVerdictTextStyle(eiaMatrix.verdict)}`}>
                  {verdictWithScore} — {eiaMatrix.verdictDescription}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3 — Statement for Authorities */}
      <section className="space-y-3 rounded-xl border border-teal-800/70 bg-[#063836] p-6">
        <h2 className="font-display text-lg font-bold text-white">Statement for Authorities</h2>
        <div className="flex flex-col gap-4 rounded-lg border border-teal-800/70 bg-[#032423] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-teal-50/95">{authorityStatement}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-teal-600/80 bg-[#063836] px-3.5 py-2 text-xs font-semibold text-teal-200 hover:border-teal-400 hover:text-white transition-colors shrink-0 cursor-pointer sm:self-center"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Required Screening Footer */}
      <p className="text-center text-xs text-teal-100/70">
        Screening-level assessment for awareness and research. Not an official EIA or regulatory
        decision.
      </p>
    </div>
  );
}
