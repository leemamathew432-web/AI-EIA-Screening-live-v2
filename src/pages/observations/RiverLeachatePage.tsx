import L from 'leaflet';
import { RotateCcw, Sliders } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
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
  BRAHMAPURAM_SOURCE,
  KADAMBAYAR_RIVER_POLYLINE,
  RIVER_ENTRY_NODE_INDEX,
  pointAlongPolyline,
} from '../../data/receptors';
import {
  DEFAULT_RIVER_PARAMS,
  computeRiverWashout,
  type RiverAssumedParameters,
} from '../../physics/river';

export function RiverLeachatePage() {
  const { bundle, riverAssumedParams, setRiverAssumedParams } = useObservatory();
  const [simRainMm, setSimRainMm] = useState<number | null>(null);
  const [showAssumedDrawer, setShowAssumedDrawer] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const activeRain = simRainMm ?? bundle?.daily.precipitationSumToday ?? 0;
  const isSimMode = simRainMm !== null;

  const washout = bundle
    ? computeRiverWashout({
        rainfallMmPerDay: activeRain,
        airTempC: bundle.currentWeather.temperature2m,
        riverParams: riverAssumedParams,
      })
    : null;

  // Initialize Leaflet River Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [9.986, 76.382],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri World Imagery', maxZoom: 18 }
    ).addTo(map);
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap / CARTO', maxZoom: 18 }
    ).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update DO-coloured Kadambrayar River & Sag Pin
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group || !washout) return;
    group.clearLayers();

    const riverColor =
      washout.status === 'ANOXIC' || washout.status === 'CRITICAL'
        ? '#f43f5e'
        : washout.status === 'STRESSED'
        ? '#f59e0b'
        : '#10b981';

    // Upstream clean reach (0..4)
    L.polyline(KADAMBAYAR_RIVER_POLYLINE.slice(0, RIVER_ENTRY_NODE_INDEX + 1), {
      color: '#38bdf8',
      weight: 4,
      opacity: 0.9,
    }).addTo(group);

    // Downstream leachate-impacted reach (4..9)
    L.polyline(KADAMBAYAR_RIVER_POLYLINE.slice(RIVER_ENTRY_NODE_INDEX), {
      color: riverColor,
      weight: 5,
      opacity: 0.92,
    }).addTo(group);

    // Leachate entry node
    const entryNode = KADAMBAYAR_RIVER_POLYLINE[RIVER_ENTRY_NODE_INDEX];
    L.circleMarker(entryNode, {
      radius: 6,
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: 0.9,
    })
      .bindPopup('<div class="text-xs"><strong>Brahmapuram Leachate Entry Node (0 km)</strong></div>')
      .addTo(group);

    // Source marker
    L.circleMarker([BRAHMAPURAM_SOURCE.lat, BRAHMAPURAM_SOURCE.lon], {
      radius: 6,
      color: '#2dd4bf',
      fillColor: '#042f2e',
      fillOpacity: 0.9,
    })
      .bindPopup('<div class="text-xs"><strong>Brahmapuram Dumpsite (44 ha)</strong></div>')
      .addTo(group);

    // Dynamic critical oxygen sag pin along river polyline
    const sagLatLon = pointAlongPolyline(
      KADAMBAYAR_RIVER_POLYLINE,
      RIVER_ENTRY_NODE_INDEX,
      washout.criticalSagDistanceKm
    );

    L.circleMarker(sagLatLon, {
      radius: 9,
      color: '#ffffff',
      fillColor: riverColor,
      fillOpacity: 0.95,
      weight: 2,
    })
      .bindPopup(
        `<div class="text-xs leading-relaxed">
          <strong>${
            washout.isSagBeyondReach
              ? 'Study Reach End (12 km)'
              : 'Critical Oxygen Sag Point'
          }</strong><br/>
          ${
            washout.isSagBeyondReach
              ? `Lowest point beyond 12 km study reach (≈ ${washout.trueCriticalSagDistanceKm} km, ${washout.trueCriticalSagTimeDays} days)`
              : `Distance: ${washout.criticalSagDistanceKm} km downstream`
          }<br/>
          Min DO in reach: ${washout.criticalMinDoMgL} mg/L (${washout.status})
        </div>`
      )
      .addTo(group);
  }, [washout]);

  if (!bundle || !washout) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-teal-100">
        Loading Kadambrayar hydrology…
      </div>
    );
  }

  const statusTone =
    washout.status === 'ANOXIC' || washout.status === 'CRITICAL'
      ? 'text-rose-400'
      : washout.status === 'STRESSED'
      ? 'text-amber-300'
      : 'text-emerald-300';

  const collectsRows: CollectsRow[] = [
    {
      parameter: 'Today & 72h/24h Precipitation',
      source: 'Open-Meteo Forecast API',
      status: 'LIVE',
      cadence: 'Hourly / Daily',
      currentValue: `${bundle.daily.precipitationSumToday} mm/day`,
    },
    {
      parameter: 'Air Temperature (Water Temp Proxy)',
      source: 'Open-Meteo Forecast API',
      status: 'LIVE',
      cadence: '5 min poll',
      currentValue: `${bundle.currentWeather.temperature2m}°C → Water ~${washout.waterTempC}°C`,
    },
    {
      parameter: 'River Velocity, Flow & BOD/DO Baseline',
      source: 'Literature Hydrology Defaults',
      status: 'ASSUMED',
      cadence: 'User Editable',
      currentValue: `u=${riverAssumedParams.riverVelocityMs} m/s · Q=${riverAssumedParams.riverFlowM3s} m³/s`,
    },
    {
      parameter: '1D Streeter-Phelps DO Sag Profile',
      source: 'Rational Method + APHA DO Saturation',
      status: 'MODELLED',
      cadence: 'Live on update',
      currentValue: washout.isSagBeyondReach
        ? `Reach min DO ${washout.criticalMinDoMgL} mg/L · Lowest point >12 km (≈ ${washout.trueCriticalSagDistanceKm} km)`
        : `Min DO ${washout.criticalMinDoMgL} mg/L @ ${washout.criticalSagDistanceKm} km`,
    },
  ];

  const howSteps: HowItWorksStep[] = [
    {
      step: 'Step 01',
      title: 'Rational Runoff Pulse',
      detail: 'Computes Q_runoff = C · i · A across the 44 ha Brahmapuram footprint from daily rain.',
    },
    {
      step: 'Step 02',
      title: 'Mass-Balance Mixing',
      detail: 'Blends high-BOD leachate pulse with baseline Kadambrayar flow at the entry node.',
    },
    {
      step: 'Step 03',
      title: 'Arrhenius Kinetics',
      detail: 'Scales deoxygenation k_d(T) and reaeration k_a(T) to tropical river temperature.',
    },
    {
      step: 'Step 04',
      title: 'Critical Sag Distance x_c',
      detail: 'Evaluates Streeter-Phelps D(t) over 0–12 km and places the critical pin along the river.',
    },
  ];

  const whoItHelps: WhoItHelpsItem[] = [
    {
      audience: 'Water-Supply Intake & Irrigation Operators',
      statusLabel: `${washout.status} (${washout.criticalMinDoMgL} mg/L)`,
      guidance:
        washout.criticalMinDoMgL < 4.0
          ? 'Projected DO drops below CPCB 4.0 mg/L ecological limit; increase raw-water aeration and organics monitoring.'
          : 'Dissolved oxygen stays above 4.0 mg/L threshold under current rainfall runoff.',
    },
    {
      audience: 'Kadambrayar Fisheries & Regulatory Inspectors',
      statusLabel: washout.isSagBeyondReach
        ? `Sag ≈ ${washout.trueCriticalSagDistanceKm} km`
        : `Sag @ ${washout.criticalSagDistanceKm} km`,
      guidance: washout.isSagBeyondReach
        ? `Lowest point beyond 12 km study reach (≈ ${washout.trueCriticalSagDistanceKm} km, ${washout.trueCriticalSagTimeDays} days); monitor the 12 km Ambalamugal–Chitrapuzha reach boundary.`
        : `Deploy grab sampling near ${washout.criticalSagDistanceKm} km downstream of the Brahmapuram leachate node after heavy rain.`,
    },
  ];

  const assumedFields: Array<{
    key: keyof RiverAssumedParameters;
    label: string;
    unit: string;
    step: number;
  }> = [
    { key: 'riverVelocityMs', label: 'River Velocity', unit: 'm/s', step: 0.05 },
    { key: 'riverFlowM3s', label: 'River Discharge Q', unit: 'm³/s', step: 0.5 },
    { key: 'baselineRiverBodMgL', label: 'Baseline BOD₅', unit: 'mg/L', step: 0.2 },
    { key: 'baselineRiverDoMgL', label: 'Baseline DO', unit: 'mg/L', step: 0.2 },
    { key: 'deoxygenationKd20PerDay', label: 'k_d (20°C)', unit: '1/day', step: 0.05 },
    { key: 'reaerationKa20PerDay', label: 'k_a (20°C)', unit: '1/day', step: 0.05 },
    { key: 'runoffCoeffC', label: 'Runoff Coeff C', unit: 'ratio', step: 0.05 },
    { key: 'leachateBodMgL', label: 'Leachate BOD₅', unit: 'mg/L', step: 20 },
  ];

  const whatIfPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold text-white">
            Simulated Daily Rainfall Intensity & Assumed Hydrology Parameters
          </h2>
          <p className="text-xs text-teal-100/70">
            Test storm washout scenarios (0–100 mm/day) or edit baseline Kadambrayar river parameters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAssumedDrawer((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-[#063836] px-3 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-300 cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{showAssumedDrawer ? 'Hide Assumed Parameters' : 'Edit Assumed Parameters'}</span>
          </button>
          {isSimMode && (
            <button
              type="button"
              onClick={() => setSimRainMm(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 bg-[#063836] px-3 py-1.5 text-xs font-semibold text-teal-200 hover:border-teal-400 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Rain</span>
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between font-mono text-xs mb-1">
          <span className="text-teal-200">Simulated Daily Rainfall Intensity</span>
          <span className="text-sky-300 font-bold">{activeRain.toFixed(1)} mm/day</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={activeRain}
          onChange={(e) => setSimRainMm(Number(e.target.value))}
          className="w-full accent-sky-400 cursor-pointer"
        />
      </div>

      {showAssumedDrawer && (
        <div className="rounded-lg border border-amber-400/35 bg-[#042f2e] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DataStatusBadge
              type="ASSUMED"
              detail="Assumed parameter — replace with field data"
            />
            <button
              type="button"
              onClick={() => setRiverAssumedParams(DEFAULT_RIVER_PARAMS)}
              className="text-xs font-mono text-teal-300 underline cursor-pointer"
            >
              Restore Literature Defaults
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {assumedFields.map((f) => (
              <label key={f.key} className="block space-y-1 text-xs">
                <span className="font-mono text-teal-200/80">
                  {f.label} ({f.unit})
                </span>
                <input
                  type="number"
                  step={f.step}
                  value={riverAssumedParams[f.key]}
                  onChange={(e) =>
                    setRiverAssumedParams({
                      ...riverAssumedParams,
                      [f.key]: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded border border-teal-700 bg-[#032423] px-2.5 py-1.5 font-mono text-xs text-white"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <InnovationLayout
      code="I-3"
      title="Rain-Triggered Kadambrayar River Leachate & Oxygen-Sag Forecaster"
      subtitle="Couples Open-Meteo precipitation with Rational Method site runoff (44 ha) and 1D Streeter-Phelps oxygen-sag kinetics along the Kadambrayar River."
      badgeType="MODELLED"
      badgeDetail={`Streeter-Phelps DO Sag · Status: ${washout.status}`}
      badgeFormulaName="Rational Method + 1D Streeter-Phelps"
      badgeHowText="Computes site leachate pulse Q = C·i·A (44 ha), mixes BOD5/DO at the river entry node, and integrates temperature-adjusted deoxygenation and reaeration over 0–12 km."
      isSimulationMode={isSimMode}
      whatIfPanel={whatIfPanel}
      collectsRows={collectsRows}
      howItWorksSteps={howSteps}
      howItWorksLatex={String.raw`Q_{\text{runoff}} = C \cdot i \cdot A, \qquad D(t) = \frac{k_d L_0}{k_a - k_d}\!\left(e^{-k_d t} - e^{-k_a t}\right) + D_0 e^{-k_a t}`}
      whoItHelps={whoItHelps}
      whyUseful="Demonstrates real-time physical causality between monsoon rainfall over Brahmapuram and downstream dissolved oxygen depletion in the Kadambrayar River."
      limitations={[
        'River discharge, velocity, and leachate BOD5 use literature defaults (tagged ASSUMED) until calibrated by Kerala PCB grab samples.',
        'Assumes complete instantaneous lateral mixing at the entry node without tidal backwater effects from Chitrapuzha.',
        'Does not model benthic sediment oxygen demand (SOD) accumulation from multi-year leachate deposition.',
      ]}
      sources={[
        {
          name: 'Open-Meteo Forecast API (Hourly & Daily Precipitation)',
          detail: 'Provides past 72 h + next 24 h hourly rainfall and daily totals.',
          url: 'https://open-meteo.com/en/docs',
        },
        {
          name: 'APHA Standard Methods & Streeter-Phelps (1925)',
          detail: 'Freshwater DO saturation temperature formula and 1D river BOD-DO sag kinetics.',
        },
      ]}
    >
      {/* 4 KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono tabular-nums">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
          <div className="text-xs text-teal-200/75">Critical Min DO</div>
          <div className={`mt-1.5 text-3xl font-bold ${statusTone}`}>
            {washout.criticalMinDoMgL} mg/L
          </div>
          <div className={`mt-1 text-xs font-bold ${statusTone}`}>Status: {washout.status}</div>
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
          <div className="text-xs text-teal-200/75">Critical Sag Distance x_c</div>
          {washout.isSagBeyondReach ? (
            <>
              <div className="mt-1.5 text-sm font-bold leading-snug text-amber-200">
                Lowest point beyond 12 km study reach (≈ {washout.trueCriticalSagDistanceKm} km,{' '}
                {washout.trueCriticalSagTimeDays} days)
              </div>
              <div className="mt-1 text-xs text-teal-100/70">
                12 km reach travel time: {washout.criticalSagTimeDays} days
              </div>
            </>
          ) : (
            <>
              <div className="mt-1.5 text-3xl font-bold text-white">
                {washout.criticalSagDistanceKm} km
              </div>
              <div className="mt-1 text-xs text-teal-100/70">
                Travel time {washout.criticalSagTimeDays} days downstream
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
          <div className="text-xs text-teal-200/75">Runoff Pulse Q</div>
          <div className="mt-1.5 text-3xl font-bold text-sky-300">
            {washout.runoffPulseM3s} m³/s
          </div>
          <div className="mt-1 text-xs text-teal-100/70">
            44 ha footprint @ {washout.rainfallMmPerDay} mm/day
          </div>
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-5">
          <div className="text-xs text-teal-200/75">Initial Mixed BOD₅</div>
          <div className="mt-1.5 text-3xl font-bold text-amber-300">
            {washout.mixedInitialBodMgL} mg/L
          </div>
          <div className="mt-1 text-xs text-teal-100/70">
            Sat DO {washout.doSaturationMgL} mg/L @ {washout.waterTempC}°C
          </div>
        </div>
      </section>

      {/* DO Sag Curve + Leaflet River Map */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              0–12 km Streeter-Phelps Dissolved Oxygen Sag Curve
            </h2>
            <p className="text-xs text-teal-100/75">
              Dashed rose line marks the 4.0 mg/L CPCB ecological stress threshold.
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={washout.curve}
                margin={{ top: 10, right: 20, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0f524e" />
                <XAxis
                  dataKey="distanceKm"
                  tick={{ fill: '#99f6e4', fontSize: 11 }}
                  unit=" km"
                />
                <YAxis
                  domain={[0, 9]}
                  tick={{ fill: '#99f6e4', fontSize: 11 }}
                  unit=" mg/L"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#032423',
                    borderColor: '#38bdf8',
                    fontSize: '12px',
                    color: '#ecfdf5',
                  }}
                />
                <ReferenceLine
                  y={4.0}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: '4.0 mg/L CPCB Limit', fill: '#fda4af', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="doMgL"
                  name="Dissolved Oxygen (mg/L)"
                  stroke="#38bdf8"
                  strokeWidth={2.8}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-teal-800/70 bg-[#063836] lg:col-span-6 flex flex-col">
          <div className="border-b border-teal-800/70 bg-[#032423] px-4 py-2.5 text-xs font-mono text-teal-200">
            Kadambrayar River DO-Coloured Trace ·{' '}
            {washout.isSagBeyondReach
              ? `Lowest point beyond 12 km study reach (≈ ${washout.trueCriticalSagDistanceKm} km)`
              : `Critical Sag Pin @ ${washout.criticalSagDistanceKm} km`}
          </div>
          <div ref={mapContainerRef} className="h-[340px] w-full flex-1 z-10" />
        </div>
      </section>
    </InnovationLayout>
  );
}
