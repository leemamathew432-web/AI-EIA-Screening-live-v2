import { RotateCcw } from 'lucide-react';
import {
  InnovationLayout,
  type CollectsRow,
  type HowItWorksStep,
  type WhoItHelpsItem,
} from '../../components/InnovationLayout';
import { PlumeMap } from '../../components/PlumeMap';
import { useObservatory } from '../../context/ObservatoryContext';

export function PlumeTrajectoryPage() {
  const { bundle, plume, plumeSim, setPlumeSim, resetPlumeSim, isPlumeSimulated } =
    useObservatory();

  if (!bundle || !plume) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-teal-100">
        Loading plume telemetry…
      </div>
    );
  }

  const liveSpeedKmh = Math.round(bundle.currentWeather.windSpeed10mMs * 3.6 * 10) / 10;
  const activeDirDeg = plumeSim.dirDeg ?? bundle.currentWeather.windDirection10mDeg;
  const simHalfConeDeg = plumeSim.halfConeDeg;
  const isSimMode = isPlumeSimulated;

  const collectsRows: CollectsRow[] = [
    {
      parameter: '10 m Wind Speed',
      source: 'Open-Meteo Forecast API',
      status: 'LIVE',
      cadence: '5 min poll',
      currentValue: `${bundle.currentWeather.windSpeed10mMs} m/s (${liveSpeedKmh} km/h)`,
    },
    {
      parameter: '10 m Wind Direction (From)',
      source: 'Open-Meteo Forecast API',
      status: 'LIVE',
      cadence: '5 min poll',
      currentValue: `${bundle.currentWeather.windDirection10mDeg}°`,
    },
    {
      parameter: 'Shortwave Solar Radiation & Cloud Cover',
      source: 'Open-Meteo Forecast API',
      status: 'LIVE',
      cadence: '5 min poll',
      currentValue: `${bundle.currentWeather.shortwaveRadiationWm2} W/m² · ${bundle.currentWeather.cloudCoverPct}%`,
    },
    {
      parameter: 'Normalized Gaussian Plume (H = 5 m)',
      source: 'Briggs (1973) Rural + P-G Class',
      status: 'MODELLED',
      cadence: 'Live on update',
      currentValue: `Class ${plume.stabilityClass} (${plume.stabilityDescription})`,
    },
  ];

  const howSteps: HowItWorksStep[] = [
    {
      step: 'Step 01',
      title: 'Downwind Azimuth Vector',
      detail: 'Converts meteorological wind-from azimuth by +180° to obtain the active transport heading.',
    },
    {
      step: 'Step 02',
      title: 'Pasquill-Gifford Class (A–F)',
      detail: 'Selects stability class from surface wind speed, solar radiation, cloud cover, and day/night flag.',
    },
    {
      step: 'Step 03',
      title: 'Briggs (1973) Rural σ_y, σ_z',
      detail: 'Computes lateral and vertical plume spread coefficients along Haversine receptor distances.',
    },
    {
      step: 'Step 04',
      title: '500 m Normalized Kernel',
      detail: 'Normalizes ground concentration against 500 m centerline (H=5 m) so unknown emission rate Q cancels.',
    },
  ];

  const downwindList = plume.downwindCampuses;
  const whoItHelps: WhoItHelpsItem[] =
    downwindList.length > 0
      ? downwindList.slice(0, 4).map((item) => ({
          audience: item.receptor.name,
          statusLabel: `${item.status} · ETA ${item.advectionEtaMin}m`,
          guidance: `Keep downwind ventilation intakes filtered; relative concentration ${item.relativeConcPctOf500m}% of 500 m centerline.`,
        }))
      : [
          {
            audience: 'IT Parks (Infopark Ph-I/II & SmartCity)',
            statusLabel: 'SIDE / OFF-PLUME / UPWIND',
            guidance: 'Current wind trajectory spares Infopark and SmartCity campuses from direct plume alignment.',
          },
          {
            audience: 'Schools & Colleges (Rajagiri, JBS, BTC, St. Charles)',
            statusLabel: 'CROSSWIND EDGE / OFF-PLUME',
            guidance: 'Normal outdoor campus schedules permitted under present downwind heading.',
          },
        ];

  const whatIfPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold text-white">
            Interactive What-If Wind & Plume Cone Controls
          </h2>
          <p className="text-xs text-teal-100/70">
            Test hypothetical wind headings, speeds, and dispersion cone angles against the 7 Kakkanad receptors.
          </p>
        </div>
        {isSimMode && (
          <button
            type="button"
            onClick={resetPlumeSim}
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
            <span className="text-teal-200">Wind Direction (From)</span>
            <span className="text-teal-300 font-bold">{Math.round(activeDirDeg)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={359}
            value={Math.round(activeDirDeg)}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPlumeSim((prev) => ({ ...prev, dirDeg: val }));
            }}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between font-mono text-xs mb-1">
            <span className="text-teal-200">Wind Speed</span>
            <span className="text-teal-300 font-bold">{plume.windSpeedKmh} km/h</span>
          </div>
          <input
            type="range"
            min={1}
            max={40}
            step={0.5}
            value={plumeSim.speedKmh ?? liveSpeedKmh}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPlumeSim((prev) => ({ ...prev, speedKmh: val }));
            }}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between font-mono text-xs mb-1">
            <span className="text-teal-200">Half-Cone Angle</span>
            <span className="text-teal-300 font-bold">±{simHalfConeDeg}°</span>
          </div>
          <input
            type="range"
            min={8}
            max={30}
            step={1}
            value={simHalfConeDeg}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPlumeSim((prev) => ({ ...prev, halfConeDeg: val }));
            }}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );

  // Radial Receptor Clock SVG helper
  const maxKm = 10.5;
  const cx = 175;
  const cy = 175;
  const maxR = 138;

  return (
    <InnovationLayout
      code="I-1"
      title="Live Downwind Plume Trajectory & Receptor Arrival Cone"
      subtitle="Projects a dynamic Gaussian atmospheric dispersion cone from Brahmapuram (9.9880° N, 76.3680° E) across 7 Kakkanad receptors using live Open-Meteo wind vectors and Briggs (1973) rural dispersion."
      badgeType="MODELLED"
      badgeDetail={`Pasquill-Gifford Class ${plume.stabilityClass} · Briggs (1973) Gaussian`}
      badgeFormulaName="Gaussian Ground-Level Plume (500 m Normalized)"
      badgeHowText="Normalizes ground-level Gaussian plume concentration against the 500 m downwind centerline (H = 5 m) so unknown source emission rate Q cancels out cleanly."
      isSimulationMode={isSimMode}
      whatIfPanel={whatIfPanel}
      collectsRows={collectsRows}
      howItWorksSteps={howSteps}
      howItWorksLatex={String.raw`\frac{C(x,y)}{C(500,0)} = \frac{\sigma_y(500)\,\sigma_z(500)}{\sigma_y(x)\,\sigma_z(x)} \exp\!\left(-\frac{y^2}{2\sigma_y^2}\right) \exp\!\left(-\frac{H^2}{2}\left[\frac{1}{\sigma_z(x)^2} - \frac{1}{\sigma_z(500)^2}\right]\right)`}
      whoItHelps={whoItHelps}
      whyUseful="Replaces static air-quality snapshots with directional advection timing: facility managers at Infopark, SmartCity, and schools immediately see whether they lie upwind, crosswind, or directly inside the active downwind smoke corridor."
      limitations={[
        'Assumes flat open-country terrain (Briggs 1973 rural parameterization) without urban canyon wake deflection.',
        'Unknown real-time emission flux Q cancels via 500 m normalization; percentages reflect relative attenuation rather than absolute µg/m³.',
        'Steady-state plume heading does not track historical smoke parcels after sudden wind reversals.',
      ]}
      sources={[
        {
          name: 'Open-Meteo Weather Forecast API',
          detail: 'Live 10 m wind speed (m/s), wind direction (°), solar radiation, and cloud cover.',
          url: 'https://open-meteo.com/en/docs',
        },
        {
          name: 'Briggs (1973) & Pasquill-Gifford Dispersion Methodology',
          detail: 'Rural open-country σ_y, σ_z dispersion curves and atmospheric stability classification.',
        },
      ]}
    >
      {/* Map + Radial Receptor Clock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <PlumeMap plume={plume} heightClass="h-[440px]" />
        </div>

        {/* Radial Receptor Clock SVG */}
        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-5 lg:col-span-4">
          <div>
            <h3 className="font-display text-base font-bold text-white">
              Radial Receptor Clock
            </h3>
            <p className="text-xs text-teal-100/70">
              Azimuth bearings & scaled radial distances from Brahmapuram center.
            </p>
          </div>

          <svg viewBox="0 0 350 350" className="mx-auto w-full max-w-[320px]">
            {/* Distance rings */}
            {[2.5, 5, 10].map((km) => (
              <g key={km}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={(km / maxKm) * maxR}
                  fill="none"
                  stroke="#0f524e"
                  strokeDasharray="3 3"
                />
                <text
                  x={cx + 4}
                  y={cy - (km / maxKm) * maxR + 10}
                  className="fill-teal-300/70 text-[9px] font-mono"
                >
                  {km} km
                </text>
              </g>
            ))}

            {/* Cardinal labels */}
            <text x={cx} y="16" textAnchor="middle" className="fill-teal-200 text-[11px] font-mono font-bold">
              N
            </text>
            <text x="336" y={cy + 4} textAnchor="middle" className="fill-teal-200 text-[11px] font-mono font-bold">
              E
            </text>
            <text x={cx} y="342" textAnchor="middle" className="fill-teal-200 text-[11px] font-mono font-bold">
              S
            </text>
            <text x="14" y={cy + 4} textAnchor="middle" className="fill-teal-200 text-[11px] font-mono font-bold">
              W
            </text>

            {/* Downwind cone wedge */}
            {(() => {
              const a1 = ((plume.downwindBearingDeg - simHalfConeDeg - 90) * Math.PI) / 180;
              const a2 = ((plume.downwindBearingDeg + simHalfConeDeg - 90) * Math.PI) / 180;
              const x1 = cx + maxR * Math.cos(a1);
              const y1 = cy + maxR * Math.sin(a1);
              const x2 = cx + maxR * Math.cos(a2);
              const y2 = cy + maxR * Math.sin(a2);
              return (
                <path
                  d={`M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${maxR} ${maxR} 0 0 1 ${x2.toFixed(
                    1
                  )} ${y2.toFixed(1)} Z`}
                  fill="#f43f5e"
                  fillOpacity="0.24"
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                />
              );
            })()}

            {/* Receptors */}
            {plume.receptors.map((item) => {
              const r = Math.min(maxR, (item.distanceKm / maxKm) * maxR);
              const rad = ((item.bearingDeg - 90) * Math.PI) / 180;
              const rx = cx + r * Math.cos(rad);
              const ry = cy + r * Math.sin(rad);
              const color =
                item.status === 'DIRECT DOWNWIND'
                  ? '#f43f5e'
                  : item.status === 'CROSSWIND EDGE'
                  ? '#f59e0b'
                  : '#10b981';

              return (
                <g key={item.receptor.id}>
                  <circle cx={rx} cy={ry} r="4.5" fill={color} stroke="#032423" strokeWidth="1.2" />
                  <text
                    x={rx + 6}
                    y={ry + 3}
                    className="fill-teal-50 text-[8.5px] font-mono"
                  >
                    {item.receptor.shortName}
                  </text>
                </g>
              );
            })}

            <circle cx={cx} cy={cy} r="5" fill="#f59e0b" />
          </svg>

          <div className="border-t border-teal-800/60 pt-2.5 font-mono text-xs text-teal-200/80">
            Heading {plume.downwindBearingDeg}° ({plume.downwindCompass}) · {plume.windSpeedKmh} km/h
          </div>
        </div>
      </div>

      {/* Receptor Matrix Table */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-white">
          7-Receptor Haversine Plume Impact Matrix
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-teal-800/70 font-mono text-teal-300">
                <th className="py-3 pr-4">Receptor</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4 text-right">Distance</th>
                <th className="py-3 pr-4 text-right">Bearing</th>
                <th className="py-3 pr-4 text-right">Offset</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4 text-right">Advection ETA</th>
                <th className="py-3 text-right">Rel. Conc (% of 500 m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50 font-mono tabular-nums">
              {plume.receptors.map((item) => {
                const statusColor =
                  item.status === 'DIRECT DOWNWIND'
                    ? 'text-rose-400 font-bold'
                    : item.status === 'CROSSWIND EDGE'
                    ? 'text-amber-300 font-bold'
                    : 'text-emerald-300';
                return (
                  <tr key={item.receptor.id} className="hover:bg-[#032423]/60">
                    <td className="py-3 pr-4 font-sans text-sm font-semibold text-white">
                      {item.receptor.name}
                    </td>
                    <td className="py-3 pr-4 font-sans text-teal-100/75">
                      {item.receptor.category}
                    </td>
                    <td className="py-3 pr-4 text-right text-teal-100">
                      {item.distanceKm.toFixed(2)} km ({item.distanceMeters} m)
                    </td>
                    <td className="py-3 pr-4 text-right text-teal-200">{item.bearingDeg}°</td>
                    <td className="py-3 pr-4 text-right text-teal-200">
                      {item.angularOffsetDeg}°
                    </td>
                    <td className={`py-3 pr-4 ${statusColor}`}>{item.status}</td>
                    <td className="py-3 pr-4 text-right text-white">
                      {item.advectionEtaMin !== null ? `${item.advectionEtaMin} min` : '—'}
                    </td>
                    <td className="py-3 text-right text-teal-300">
                      {item.relativeConcPctOf500m.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </InnovationLayout>
  );
}
