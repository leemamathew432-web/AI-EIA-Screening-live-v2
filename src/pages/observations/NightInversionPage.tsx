import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DataStatusBadge } from '../../components/DataStatusBadge';
import {
  InnovationLayout,
  type CollectsRow,
  type HowItWorksStep,
  type WhoItHelpsItem,
} from '../../components/InnovationLayout';
import { useObservatory } from '../../context/ObservatoryContext';
import {
  computeHourTrapScore,
  extractTonightWindow,
  predictTonightInversion,
} from '../../physics/inversion';
import { getNowKolkataIsoPrefix } from '../../services/openMeteo';

export function NightInversionPage() {
  const { bundle, ridgeModel } = useObservatory();
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(5);
  const [simWindKmh, setSimWindKmh] = useState<number | null>(null);
  const [simCloudPct, setSimCloudPct] = useState<number | null>(null);

  const isSimMode = simWindKmh !== null || simCloudPct !== null;

  const { analyses, predictions, clampedIdx } = useMemo(() => {
    if (!bundle || !ridgeModel) {
      return { analyses: [], predictions: [], clampedIdx: 0 };
    }
    const nowPrefix = getNowKolkataIsoPrefix();
    const rawTonight = extractTonightWindow(bundle.hourlyWeather, nowPrefix).map((h) => ({
      ...h,
      windSpeed10mMs: simWindKmh !== null ? simWindKmh / 3.6 : h.windSpeed10mMs,
      cloudCoverPct: simCloudPct !== null ? simCloudPct : h.cloudCoverPct,
    }));

    const analyses = rawTonight.map(computeHourTrapScore);
    const predictions = predictTonightInversion(
      ridgeModel,
      rawTonight,
      bundle.hourlyWeather
    );
    const clampedIdx = Math.min(selectedHourIdx, Math.max(0, analyses.length - 1));
    return { analyses, predictions, clampedIdx };
  }, [bundle, ridgeModel, selectedHourIdx, simWindKmh, simCloudPct]);

  if (!bundle || !ridgeModel || analyses.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-teal-100">
        Loading nocturnal atmospheric profile…
      </div>
    );
  }

  const activeHour = analyses[clampedIdx];
  const activePred = predictions[clampedIdx];

  const verticalProfileData = [
    { alt: '2 m', temp: activeHour.temperature2m },
    { alt: '80 m', temp: activeHour.temperature80m },
    { alt: '120 m', temp: activeHour.temperature120m },
    { alt: '180 m', temp: activeHour.temperature180m },
  ];

  const ridgeChartData = predictions.map((p) => ({
    hour: p.hourLabel,
    predictedDeltaT: p.predictedDeltaTC,
    nwpDeltaT: p.nwpDeltaTC,
    probPct: p.inversionProbPct,
  }));

  const collectsRows: CollectsRow[] = [
    {
      parameter: 'Vertical Temperatures (2m, 80m, 120m, 180m)',
      source: 'Open-Meteo Forecast API',
      status: 'LIVE',
      cadence: 'Hourly',
      currentValue: `${activeHour.temperature2m}°C → ${activeHour.temperature120m}°C (ΔT ${activeHour.deltaT120mMinus2m}°C)`,
    },
    {
      parameter: 'Boundary Layer Height (BLH)',
      source: activeHour.blhIsFallback
        ? 'Mechanical Fallback (75·u·cloudFactor)'
        : 'Open-Meteo NWP BLH',
      status: activeHour.blhIsFallback ? 'MODELLED' : 'LIVE',
      cadence: 'Hourly',
      currentValue: `${activeHour.blhMeters} m`,
    },
    {
      parameter: '14-Day Unmodified Nocturnal History (18:00–06:59 IST)',
      source: 'Open-Meteo Past 14 Days (Zero Synthetic Samples)',
      status: 'LIVE',
      cadence: 'Rolling 14 days',
      currentValue: `${ridgeModel.sampleCount} nocturnal hours`,
    },
    {
      parameter: 'Ridge Regression Inversion Predictor (λ = 0.05)',
      source: 'In-Browser Empirical ML Fit',
      status: 'MODELLED',
      cadence: 'Trained live on load',
      currentValue: `MAE ${ridgeModel.holdoutMaeC}°C · Acc ${ridgeModel.holdoutBinaryAccuracyPct}%`,
    },
  ];

  const howSteps: HowItWorksStep[] = [
    {
      step: 'Step 01',
      title: 'Thermal Lapse Sign',
      detail: 'Flags a ground-based inversion whenever ΔT = T(120m) − T(2m) > 0 °C.',
    },
    {
      step: 'Step 02',
      title: '0–100 Trap Score',
      detail: 'Weights ΔT strength, BLH < 200 m, calm wind < 1.7 m/s, RH > 80%, clear sky, and stability E/F.',
    },
    {
      step: 'Step 03',
      title: '14-Day Ridge Fit',
      detail: 'Fits Ridge Regression (λ=0.05) strictly on unmodified past nocturnal hours with 80/20 holdout test.',
    },
    {
      step: 'Step 04',
      title: 'Probability P(ΔT > 0)',
      detail: 'Transforms predicted ΔT and residual σ into tonight’s hourly inversion probability curve.',
    },
  ];

  const whoItHelps: WhoItHelpsItem[] = [
    {
      audience: 'Kakkanad Residents & Apartments',
      statusLabel: `${activeHour.riskTier} (${activeHour.trapScore}%)`,
      guidance:
        activeHour.trapScore >= 55
          ? 'Keep bedroom windows facing Brahmapuram shut between 23:00 and 06:30 IST; run indoor air filtration.'
          : 'Moderate vertical mixing expected tonight; monitor early-morning haze before opening balconies.',
    },
    {
      audience: 'Night-Shift IT & Healthcare Clinics',
      statusLabel: `Ceiling ${activeHour.blhMeters} m`,
      guidance:
        'Prepare bronchodilator / respiratory triage protocols when nocturnal Trap Score exceeds 55% with calm winds.',
    },
  ];

  const whatIfPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold text-white">
            Nocturnal Hour Inspector & What-If Atmospheric Overrides
          </h2>
          <p className="text-xs text-teal-100/70">
            Scrub through tonight&apos;s hours or override wind and cloud cover to observe Trap Score and Ridge ΔT response.
          </p>
        </div>
        {isSimMode && (
          <button
            type="button"
            onClick={() => {
              setSimWindKmh(null);
              setSimCloudPct(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 bg-[#063836] px-3 py-1.5 text-xs font-semibold text-teal-200 hover:border-teal-400 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Live</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <div className="flex justify-between font-mono text-xs mb-1">
            <span className="text-teal-200">Inspect Hour of Night</span>
            <span className="text-teal-300 font-bold">{activeHour.hourLabel} IST</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, analyses.length - 1)}
            value={clampedIdx}
            onChange={(e) => setSelectedHourIdx(Number(e.target.value))}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between font-mono text-xs mb-1">
            <span className="text-teal-200">Wind Speed Override</span>
            <span className="text-teal-300 font-bold">{activeHour.windSpeedKmh} km/h</span>
          </div>
          <input
            type="range"
            min={1}
            max={25}
            step={0.5}
            value={simWindKmh ?? activeHour.windSpeedKmh}
            onChange={(e) => setSimWindKmh(Number(e.target.value))}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between font-mono text-xs mb-1">
            <span className="text-teal-200">Cloud Cover Override</span>
            <span className="text-teal-300 font-bold">{activeHour.cloudCoverPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={simCloudPct ?? activeHour.cloudCoverPct}
            onChange={(e) => setSimCloudPct(Number(e.target.value))}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );

  // Particle speed/density scales visually with trapScore
  const lidY = Math.max(40, Math.min(155, 175 - (activeHour.blhMeters / 600) * 135));

  return (
    <InnovationLayout
      code="I-2"
      title="Nocturnal Inversion & Ground-Level Smog-Trap Predictor"
      subtitle="Combines Open-Meteo multi-altitude temperatures (2 m to 180 m), boundary-layer ceiling height, and an in-browser Ridge Regression model trained strictly on 14 days of unmodified nocturnal observations."
      badgeType="MODELLED"
      badgeDetail={`Trap Score ${activeHour.trapScore}% (${activeHour.riskTier}) · Ridge λ=0.05`}
      badgeFormulaName="Multi-Level Thermal Inversion + 14-Day Ridge Regression"
      badgeHowText="Trains Ridge Regression (λ = 0.05) on unmodified past nocturnal hours (18:00–06:59 IST) from Open-Meteo's 14-day history using wind, cloud cover, RH, cooling drop from 15:00 IST, and sin/cos hour features."
      isSimulationMode={isSimMode}
      whatIfPanel={whatIfPanel}
      collectsRows={collectsRows}
      howItWorksSteps={howSteps}
      howItWorksLatex={String.raw`\hat{w} = (X^\top X + \lambda I)^{-1} X^\top y, \quad \Delta T = T_{120\text{m}} - T_{2\text{m}}, \quad P(\Delta T > 0) = \Phi\!\left(\frac{\widehat{\Delta T}}{\sigma_{\text{res}}}\right)`}
      whoItHelps={whoItHelps}
      whyUseful="Explains with physical clarity why Kakkanad neighborhoods often smell concentrated dumpsite smoke after midnight even when daytime air quality looks satisfactory."
      limitations={[
        'Ridge Regression is trained solely on the past 14 days of NWP nocturnal hours; multi-season monsoon shifts are outside the rolling 14-day window.',
        'If Open-Meteo boundary_layer_height is null for an hour, mechanical fallback 75·u·cloudFactor is used and flagged explicitly.',
        'Local building heat-island pockets near Infopark can slightly raise ground 2 m temperatures relative to gridded NWP output.',
      ]}
      sources={[
        {
          name: 'Open-Meteo Forecast API (14-Day History + Multi-Altitude Temps)',
          detail: 'Provides temperature_2m, 80m, 120m, 180m, BLH, wind, RH, and cloud cover.',
          url: 'https://open-meteo.com/en/docs',
        },
      ]}
    >
      {/* Night Trap Risk Timeline Heat Strip */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Tonight&apos;s Sunset-to-Sunrise Trap Risk Timeline
            </h2>
            <p className="text-xs text-teal-100/75">
              Click any hour to inspect vertical temperature inversion and boundary ceiling.
            </p>
          </div>
          {activeHour.blhIsFallback && (
            <DataStatusBadge
              type="MODELLED"
              detail="BLH mechanical fallback active (75·u·cloudFactor)"
            />
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-[repeat(13,minmax(0,1fr))]">
          {analyses.map((item, idx) => {
            const selected = idx === clampedIdx;
            const tone =
              item.trapScore >= 75
                ? 'border-rose-500/60 bg-rose-500/20 text-rose-200'
                : item.trapScore >= 55
                ? 'border-amber-400/60 bg-amber-400/20 text-amber-200'
                : item.trapScore >= 30
                ? 'border-teal-400/50 bg-teal-400/15 text-teal-100'
                : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
            return (
              <button
                key={item.time}
                type="button"
                onClick={() => setSelectedHourIdx(idx)}
                className={`rounded-lg border p-2 text-center font-mono transition-transform cursor-pointer ${tone} ${
                  selected ? 'ring-2 ring-white scale-[1.03]' : ''
                }`}
              >
                <div className="text-[11px] font-bold">{item.hourLabel}</div>
                <div className="mt-1 text-xs font-bold tabular-nums">{item.trapScore}%</div>
                <div className="text-[10px] opacity-80">{item.riskTier}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Animated Vertical Mixing SVG + Vertical Temperature Profile Chart */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Animated Cross-Section SVG */}
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Vertical Mixing & Inversion Lid ({activeHour.hourLabel} IST)
              </h3>
              <p className="text-xs text-teal-100/70">
                Ceiling {activeHour.blhMeters} m · ΔT(120m−2m) = {activeHour.deltaT120mMinus2m}°C · Class {activeHour.stabilityClass}
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-amber-300">
              {activeHour.isInversion ? 'INVERSION ACTIVE' : 'MIXING OPEN'}
            </span>
          </div>

          <svg viewBox="0 0 520 215" className="w-full rounded-lg border border-teal-800/70 bg-[#032423]">
            <defs>
              <linearGradient id="trapGlow" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.06" />
              </linearGradient>
            </defs>

            {/* Trapped VOC Volume */}
            <rect x="0" y={lidY} width="520" height={180 - lidY} fill="url(#trapGlow)" />

            {/* Descending Orange Inversion Lid */}
            <line
              x1="0"
              y1={lidY}
              x2="520"
              y2={lidY}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="7 4"
            />
            <text
              x="14"
              y={Math.max(18, lidY - 8)}
              className="fill-amber-300 text-[11px] font-mono font-bold"
            >
              Thermal Inversion Lid: {activeHour.blhMeters} m
            </text>

            {/* Animated trapped smoke particles */}
            {[60, 125, 195, 265, 340, 410, 470].map((px, i) => {
              const py = lidY + 14 + ((i * 19) % Math.max(18, 165 - lidY));
              return (
                <circle key={px} cx={px} cy={py} r="3.5" fill="#fda4af" fillOpacity="0.8">
                  <animate
                    attributeName="cx"
                    values={`${px};${px + 18};${px}`}
                    dur={`${2.4 + (i % 3) * 0.6}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

            {/* Ground */}
            <rect x="0" y="180" width="520" height="35" fill="#042f2e" />
            <text x="14" y="201" className="fill-teal-200 text-[11px] font-mono">
              Ground Breathing Zone (0 m) · Wind {activeHour.windSpeedKmh} km/h · RH {activeHour.rhPct}%
            </text>
          </svg>
        </div>

        {/* Vertical Temperature Profile (2m -> 80m -> 120m -> 180m) */}
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-white">
              Vertical Temperature Profile (2 m → 180 m)
            </h3>
            <p className="text-xs text-teal-100/70">
              Rightward slope (higher temperature aloft at 120 m than 2 m) indicates thermal inversion.
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={verticalProfileData}
                margin={{ top: 10, right: 20, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0f524e" />
                <XAxis dataKey="alt" tick={{ fill: '#99f6e4', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#99f6e4', fontSize: 11 }} unit="°C" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#032423',
                    borderColor: '#f59e0b',
                    fontSize: '12px',
                    color: '#ecfdf5',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  name="Air Temp (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2.6}
                  dot={{ r: 4, fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 14-Day Trained Ridge Regression Predictor Section */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-800/60 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              14-Day Trained Ridge Regression Inversion Predictor (λ = 0.05)
            </h2>
            <p className="text-xs text-teal-100/75">
              Trained in-browser strictly on unmodified past nocturnal hours (18:00–06:59 IST) from Open-Meteo&apos;s 14-day dataset.
            </p>
          </div>
          {activePred && (
            <div className="font-mono text-xs text-teal-300 tabular-nums">
              {activePred.hourLabel} IST: P(ΔT &gt; 0) = {activePred.inversionProbPct}%
            </div>
          )}
        </div>

        {/* Holdout Evaluation KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 font-mono tabular-nums">
          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-xs text-teal-200/70">Unmodified Nocturnal Samples</div>
            <div className="mt-1 text-2xl font-bold text-white">{ridgeModel.sampleCount}</div>
            <div className="mt-0.5 text-[11px] text-teal-300">
              80/20 split ({ridgeModel.trainCount} / {ridgeModel.testCount})
            </div>
          </div>

          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-xs text-teal-200/70">Holdout MAE</div>
            <div className="mt-1 text-2xl font-bold text-teal-300">
              {ridgeModel.holdoutMaeC}°C
            </div>
            <div className="mt-0.5 text-[11px] text-teal-100/70">Mean absolute error</div>
          </div>

          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-xs text-teal-200/70">Holdout RMSE</div>
            <div className="mt-1 text-2xl font-bold text-amber-300">
              {ridgeModel.holdoutRmseC}°C
            </div>
            <div className="mt-0.5 text-[11px] text-teal-100/70">
              Residual σ = {ridgeModel.residualStdC}°C
            </div>
          </div>

          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-xs text-teal-200/70">Holdout Accuracy (ΔT &gt; 0)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-300">
              {ridgeModel.holdoutBinaryAccuracyPct}%
            </div>
            <div className="mt-0.5 text-[11px] text-teal-100/70">Inversion classification</div>
          </div>
        </div>

        {/* Predicted ΔT vs NWP ΔT Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ridgeChartData} margin={{ top: 10, right: 20, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f524e" />
              <XAxis dataKey="hour" tick={{ fill: '#99f6e4', fontSize: 11 }} />
              <YAxis tick={{ fill: '#99f6e4', fontSize: 11 }} unit="°C" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#032423',
                  borderColor: '#2dd4bf',
                  fontSize: '12px',
                  color: '#ecfdf5',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine
                y={0}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{ value: '0°C Inversion Threshold', fill: '#fda4af', fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="predictedDeltaT"
                name="Ridge Predicted ΔT (°C)"
                stroke="#2dd4bf"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="nwpDeltaT"
                name="Open-Meteo NWP ΔT(120m−2m)"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 2.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </InnovationLayout>
  );
}
