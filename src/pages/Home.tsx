import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  RefreshCw,
  ShieldAlert,
  Wind,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataStatusBadge } from '../components/DataStatusBadge';
import { PlumeMap } from '../components/PlumeMap';
import { AiDailySummary } from '../components/AiDailySummary';
import { useObservatory } from '../context/ObservatoryContext';
import { BIOMINING_LAST_VERIFIED } from '../data/published';

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Home() {
  const {
    bundle,
    loading,
    fetchError,
    istClock,
    countdownSeconds,
    refreshNow,
    naqi,
    plume,
    tonightHours,
    riverWashout,
    eiaMatrix,
    isPlumeSimulated,
    resetPlumeSim,
  } = useObservatory();

  if (!bundle || !naqi || !plume || !riverWashout || !eiaMatrix) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-8 space-y-4">
          <div className="font-display text-lg font-bold text-white">
            {fetchError ? 'Live Telemetry Unavailable' : 'Connecting to Open-Meteo Telemetry…'}
          </div>
          <p className="text-sm text-teal-100/80">
            {fetchError ??
              'Fetching 14-day boundary-layer weather and CAMS air quality for Brahmapuram (9.9880° N, 76.3680° E).'}
          </p>
          {fetchError && (
            <button
              type="button"
              onClick={refreshNow}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-xs font-bold text-[#042f2e] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Live Fetch</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const peakNightHour = tonightHours.reduce(
    (best, cur) => (cur.trapScore > best.trapScore ? cur : best),
    tonightHours[0] ?? {
      trapScore: 0,
      riskTier: 'LOW',
      blhMeters: 0,
      hourLabel: '--:--',
    }
  );

  const minCeilingM =
    tonightHours.length > 0
      ? Math.min(...tonightHours.map((h) => h.blhMeters))
      : 0;

  const naqiColor =
    naqi.aqi > 200
      ? 'text-rose-400'
      : naqi.aqi > 100
      ? 'text-amber-400'
      : 'text-emerald-300';

  const invColor =
    peakNightHour.riskTier === 'SEVERE' || peakNightHour.riskTier === 'HIGH'
      ? 'text-rose-400'
      : peakNightHour.riskTier === 'MODERATE'
      ? 'text-amber-400'
      : 'text-emerald-300';

  const directCount = plume.receptors.filter((r) => r.status === 'DIRECT DOWNWIND').length;
  const edgeCount = plume.receptors.filter((r) => r.status === 'CROSSWIND EDGE').length;
  const plumeTeaserSummary =
    directCount > 0
      ? `${directCount} receptor(s) inside cone${edgeCount > 0 ? `, ${edgeCount} on plume edge` : ''}`
      : edgeCount > 0
      ? `${edgeCount} receptor(s) on the plume edge`
      : '0 receptors inside cone or on edge';

  const riverTeaserLocation = riverWashout.isSagBeyondReach
    ? `Lowest point beyond 12 km study reach (≈ ${riverWashout.trueCriticalSagDistanceKm} km, ${riverWashout.trueCriticalSagTimeDays} days)`
    : `at ${riverWashout.criticalSagDistanceKm} km`;

  const observationCards = [
    {
      code: 'I-1',
      statusType: 'MODELLED' as const,
      title: 'Downwind Plume Trajectory',
      teaser: `Downwind heading ${plume.downwindBearingDeg}° (${plume.downwindCompass}) · ${plumeTeaserSummary}.`,
      path: '/observations/plume-trajectory',
    },
    {
      code: 'I-2',
      statusType: 'MODELLED' as const,
      title: 'Nocturnal Inversion Predictor',
      teaser: `Tonight peak trap score ${peakNightHour.trapScore}% (${peakNightHour.riskTier}) with ${minCeilingM} m ceiling · 14-day Ridge model.`,
      path: '/observations/night-inversion',
    },
    {
      code: 'I-3',
      statusType: 'MODELLED' as const,
      title: 'River Leachate & Oxygen Sag',
      teaser: `Today rain ${bundle.daily.precipitationSumToday} mm · Critical DO ${riverWashout.criticalMinDoMgL} mg/L (${riverWashout.status}) · ${riverTeaserLocation}.`,
      path: '/observations/river-leachate',
    },
    {
      code: 'I-4',
      statusType: 'PUBLISHED' as const,
      title: 'Biomining & Land Recovery',
      teaser: `75% legacy waste biomined & 18 acres reclaimed (verified ${BIOMINING_LAST_VERIFIED}).`,
      path: '/observations/biomining-tracker',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Stale cache alert if offline or API failed */}
      {bundle.isStaleCache && bundle.errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/50 bg-[#032423] px-4 py-3 text-xs font-mono text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{bundle.errorMessage}</span>
        </div>
      )}

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

      {/* Hero Dashboard Bar */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-teal-200/85">
              <span>5 km radius · 9.9880° N, 76.3680° E</span>
              <span aria-hidden="true" className="text-teal-700">·</span>
              <span className="tabular-nums font-semibold text-teal-300">
                {istClock} IST
              </span>
              <span aria-hidden="true" className="text-teal-700">·</span>
              <span className="tabular-nums">
                Next poll {formatCountdown(countdownSeconds)}
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl text-balance">
              Brahmapuram–Kakkanad Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-teal-100/80">
              Real-time Gaussian plume dispersion, 14-day nocturnal Ridge inversion prediction,
              Kadambrayar River Streeter-Phelps oxygen sag, and verified biomining tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <DataStatusBadge
              type={bundle.isStaleCache ? 'ASSUMED' : 'LIVE'}
              detail={
                bundle.isStaleCache
                  ? `Cached ${bundle.lastGoodIstLabel} IST`
                  : `Updated ${bundle.lastGoodIstLabel} IST · 5 min poll`
              }
            />
            <button
              type="button"
              onClick={refreshNow}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-xs font-bold text-[#042f2e] hover:bg-teal-300 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh now</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Live Intelligence Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 01 · Indian NAQI (CAMS) */}
        <Link
          to="/live-conditions"
          className="group flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-5 transition-colors hover:border-teal-400/70"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-teal-300">
              <span>01 · Indian NAQI (CAMS)</span>
              <span>MODELLED</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className={`font-mono text-4xl font-bold tabular-nums ${naqiColor}`}>
                {naqi.aqi}
              </span>
              <div>
                <div className="text-sm font-bold text-white">{naqi.category}</div>
                <div className="font-mono text-xs text-teal-200/75">
                  Prominent:{' '}
                  {naqi.isAveragesReady ? (
                    `${naqi.dominantPollutant} (${naqi.dominantAveragingPeriod})`
                  ) : (
                    <span className="text-amber-300 font-medium">Loading averages…</span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-teal-100/70">
                CPCB NAQI (24-h &amp; 8-h averages) from hourly CAMS model.
              </p>
              {naqi.subIndices.find((s) => s.pollutant === 'PM2.5') && (
                <p className="font-mono text-[10px] text-teal-200/75">
                  PM₂.₅ (24-h avg):{' '}
                  {naqi.isAveragesReady
                    ? `${naqi.subIndices.find((s) => s.pollutant === 'PM2.5')?.concentration} µg/m³`
                    : 'Loading averages…'}{' '}
                  · Current:{' '}
                  {naqi.subIndices.find((s) => s.pollutant === 'PM2.5')?.currentConcentration} µg/m³
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-teal-300 group-hover:text-teal-200">
            <span>Live Conditions</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* 02 · Wind Vector & Stability */}
        <Link
          to="/observations/plume-trajectory"
          className="group flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-5 transition-colors hover:border-teal-400/70"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-teal-300">
              <span>02 · Wind Vector & Stability</span>
              <Compass className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-2xl font-bold text-white tabular-nums">
                  {plume.windSpeedKmh} km/h
                </div>
                <div className="font-mono text-xs text-teal-200/80 tabular-nums">
                  {plume.windSpeedMs} m/s · Class {plume.stabilityClass}
                </div>
                <div className="mt-1 text-xs text-teal-100/75">
                  {plume.stabilityDescription}
                </div>
              </div>
              <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="#032423"
                  stroke="#115e59"
                  strokeWidth="1.5"
                />
                <g transform={`rotate(${plume.downwindBearingDeg} 26 26)`}>
                  <line
                    x1="26"
                    y1="40"
                    x2="26"
                    y2="12"
                    stroke="#2dd4bf"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <polygon points="26,7 20,16 32,16" fill="#2dd4bf" />
                </g>
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-teal-300 group-hover:text-teal-200">
            <span>Inspect Stability</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* 03 · Active Plume Heading */}
        <Link
          to="/observations/plume-trajectory"
          className="group flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-5 transition-colors hover:border-teal-400/70"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-teal-300">
              <span>03 · Active Plume Heading</span>
              <Wind className="h-4 w-4" />
            </div>
            <div className="font-mono text-2xl font-bold text-white tabular-nums">
              {plume.downwindBearingDeg}° {plume.downwindCompass}
            </div>
            <div className="space-y-1 text-xs">
              {plume.downwindCampuses.length > 0 ? (
                plume.downwindCampuses.slice(0, 2).map((item) => (
                  <div
                    key={item.receptor.id}
                    className="flex items-center justify-between gap-2 font-mono text-amber-300"
                  >
                    <span className="truncate font-sans font-medium">
                      {item.receptor.shortName}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      ETA {item.advectionEtaMin}m
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>No monitored campus currently inside plume cone</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-teal-300 group-hover:text-teal-200">
            <span>Plume Trajectory</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* 04 · Tonight's Inversion Risk */}
        <Link
          to="/observations/night-inversion"
          className="group flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-5 transition-colors hover:border-teal-400/70"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-teal-300">
              <span>04 · Tonight&apos;s Inversion Risk</span>
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className={`font-mono text-3xl font-bold tabular-nums ${invColor}`}>
                {peakNightHour.trapScore}%
              </span>
              <span className={`font-mono text-xs font-bold ${invColor}`}>
                {peakNightHour.riskTier}
              </span>
            </div>
            <div className="font-mono text-xs text-teal-100/80 tabular-nums">
              Min ceiling {minCeilingM} m · Peak {peakNightHour.hourLabel} IST
            </div>
            {/* Compact nocturnal heat strip */}
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded bg-[#032423] p-0.5">
              {tonightHours.map((h) => (
                <div
                  key={h.time}
                  title={`${h.hourLabel} IST: ${h.trapScore}% (${h.riskTier})`}
                  className={`flex-1 rounded-xs ${
                    h.trapScore >= 75
                      ? 'bg-rose-500'
                      : h.trapScore >= 55
                      ? 'bg-amber-400'
                      : h.trapScore >= 30
                      ? 'bg-teal-400'
                      : 'bg-emerald-500/70'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-teal-300 group-hover:text-teal-200">
            <span>Night Inversion</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      </section>

      {/* EIA Screening Verdict (Live) Summary Card */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-base font-bold text-white">
                EIA Screening Verdict (Live)
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono text-xs font-bold ${
                  eiaMatrix.verdict === 'SEVERE'
                    ? 'border-rose-500/60 bg-rose-500/20 text-rose-300'
                    : eiaMatrix.verdict === 'HIGH'
                    ? 'border-orange-500/60 bg-orange-500/20 text-orange-300'
                    : eiaMatrix.verdict === 'MODERATE'
                    ? 'border-amber-400/60 bg-amber-400/20 text-amber-300'
                    : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {eiaMatrix.verdict === 'SEVERE' || eiaMatrix.verdict === 'HIGH' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span className="tabular-nums">
                  {eiaMatrix.verdict} · {eiaMatrix.overallScore.toFixed(2)} / 4
                </span>
              </span>
            </div>

            <p className="text-xs text-teal-100/80">
              {eiaMatrix.verdictDescription}
              {eiaMatrix.topDrivers.length > 0 && (
                <span className="ml-2 font-mono text-teal-200/90">
                  Driven by:{' '}
                  {eiaMatrix.topDrivers
                    .map((d) => `${d.component} (${d.score})`)
                    .join(' · ')}
                </span>
              )}
            </p>
          </div>

          <Link
            to="/eia-matrix"
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/80 bg-[#032423] px-4 py-2 text-xs font-semibold text-teal-300 hover:border-teal-400 hover:text-white transition-colors shrink-0 whitespace-nowrap self-start lg:self-center"
          >
            <span>View full matrix</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* AI Daily Summary (Gemini, via Netlify Function) */}
      <AiDailySummary />

      {/* Full-width Interactive Leaflet Map */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-white">
            Live GIS Plume & Kadambrayar Study Geofence
          </h2>
          <span className="font-mono text-xs text-teal-200/80">
            7 Monitored Receptors · Animated Advection Particles
          </span>
        </div>
        <PlumeMap plume={plume} heightClass="h-[440px]" />
      </section>

      {/* Environmental Observation Modules Grid (I-1 to I-4 only) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-white">
            Environmental Observation Modules
          </h2>
          <span className="font-mono text-xs text-teal-200/75">4 Active Modules (I-1 to I-4)</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {observationCards.map((card) => (
            <Link
              key={card.code}
              to={card.path}
              className="group flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-5 transition-colors hover:border-teal-400"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-teal-300">{card.code}</span>
                  <span className="text-teal-100/75">{card.statusType}</span>
                </div>
                <h3 className="font-display text-base font-bold text-white">{card.title}</h3>
                <p className="text-xs leading-relaxed text-teal-100/75">{card.teaser}</p>
              </div>

              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 group-hover:text-teal-200">
                <span>Open observation</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
