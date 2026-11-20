import L from 'leaflet';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  InnovationLayout,
  type WhoItHelpsItem,
} from '../../components/InnovationLayout';
import {
  BASELINE_VOLUME_LABEL,
  BIOMINING_LAST_VERIFIED,
  BIOMINING_MILESTONES,
  CONTRACT_VALUE_CRORE,
  CONTRACT_VENDOR,
  TROMMEL_OFFTAKE,
} from '../../data/published';
import {
  ACTIVE_SECTOR_POLYGON,
  RECLAIMED_SECTOR_POLYGON,
} from '../../data/receptors';

export function BiominingTrackerPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [9.988, 76.368],
      zoom: 16,
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

    L.polygon(RECLAIMED_SECTOR_POLYGON, {
      color: '#10b981',
      weight: 2,
      fillColor: '#10b981',
      fillOpacity: 0.35,
    })
      .bindPopup('<div class="text-xs"><strong>Reclaimed Sector (~18 acres)</strong><br/>Per 03 Feb 2025 verified reports</div>')
      .addTo(map);

    L.polygon(ACTIVE_SECTOR_POLYGON, {
      color: '#f59e0b',
      weight: 2,
      fillColor: '#f59e0b',
      fillOpacity: 0.25,
    })
      .bindPopup('<div class="text-xs"><strong>Active / Remaining Sector</strong><br/>Ongoing biomining operations</div>')
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const timelineData = BIOMINING_MILESTONES.map((m) => ({
    date: m.dateLabel,
    percent: m.percentBiomined,
    note: m.wasteTreatedNote,
  }));

  const donutData = [
    { name: 'Processed (75%)', value: 75, color: '#10b981' },
    { name: 'Remaining (25%)', value: 25, color: '#f59e0b' },
  ];

  // Illustrative relative subsurface fire/CH4 potential decay curve: (1 - f)^1.35
  const illustrativeDecayData = [
    { milestone: '0% (Mar 2023)', potentialPct: 100 },
    { milestone: '40% (Jun 2024)', potentialPct: Math.round(Math.pow(1 - 0.4, 1.35) * 100) },
    { milestone: '75% (03 Feb 2025)', potentialPct: Math.round(Math.pow(1 - 0.75, 1.35) * 100) },
    { milestone: '100% Target', potentialPct: 0 },
  ];

  const whoItHelps: WhoItHelpsItem[] = [
    {
      audience: 'Civic Auditors & Municipal Oversight',
      statusLabel: '75% Biomined',
      guidance: `Tracks strictly dated remediation progress under the ₹${CONTRACT_VALUE_CRORE} Cr ${CONTRACT_VENDOR} contract without extrapolated projections.`,
    },
    {
      audience: 'Nearby Residents & Urban Planners',
      statusLabel: '18 Acres Reclaimed',
      guidance: `Monitors physical land recovery from the ${BASELINE_VOLUME_LABEL} 2023 baseline toward permanent waste-free capping.`,
    },
  ];

  return (
    <InnovationLayout
      code="I-4"
      title="Biomining Remediation & Land Recovery Tracker"
      subtitle={`Tracks dated, verified municipal milestones across the ${BASELINE_VOLUME_LABEL} legacy-waste mound and ₹${CONTRACT_VALUE_CRORE} crore ${CONTRACT_VENDOR} biomining contract.`}
      badgeType="PUBLISHED"
      badgeDetail={`Verified ${BIOMINING_LAST_VERIFIED} · 75% Biomined / 18 Acres Reclaimed`}
      hideTechnicalSections={true}
      whoItHelps={whoItHelps}
      whyUseful="Anchors public discourse in verifiable, dated municipal engineering progress rather than outdated 2023 fire statistics."
      limitations={[
        'Plots strictly dated, published municipal and press milestones through 03 Feb 2025 without extrapolating unverified completion dates.',
        'Reclaimed (~18 acres) vs active sector polygons are approximate boundaries digitized for spatial visualization.',
        'Subsurface fire/CH₄ decay bars represent an illustrative mass-scaling model only — not borehole gas telemetry.',
      ]}
      sources={[
        {
          name: 'The Hindu (20 Mar 2023)',
          detail: '02 Mar 2023 major 12-day legacy-waste fire event baseline (~5.5 lakh m³).',
          url: 'https://www.thehindu.com/opinion/op-ed/kochis-brahmapuram-a-dump-fire-that-raises-a-stink/article66638572.ece',
        },
        {
          name: 'ThePrint (Nov 2023)',
          detail: '₹118 crore Bhumi Green Energy contract — Kochi Municipal Corporation signs legacy waste biomining agreement.',
          url: 'https://theprint.in/india/kochi-corp-signs-agreement-with-firm-for-biomining-legacy-waste-at-brahmapuram/1845112/',
        },
        {
          name: 'The Hindu (15 Jun 2024)',
          detail: 'Bhumi Green Energy mid-term biomining progress milestone across Brahmapuram cells.',
          url: 'https://www.thehindu.com/news/national/kerala/biomining-of-50-of-legacy-waste-at-brahmapuram-completed-claims-firm/article68294174.ece',
        },
        {
          name: 'Times of India & Onmanorama (03 Feb 2025)',
          detail: '~75% biomining complete and 18 acres reclaimed.',
          url: 'https://timesofindia.indiatimes.com/city/kochi/75-biomining-of-legacy-waste-completed-at-brahmapuram/articleshow/117894122.cms',
        },
      ]}
    >
      {/* Top Verification Banner */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-[#032423] px-5 py-3.5 text-xs">
        <div className="flex items-center gap-2 text-emerald-300 font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Last verified on {BIOMINING_LAST_VERIFIED}</span>
        </div>
        <span className="font-mono text-teal-100/80">
          Baseline {BASELINE_VOLUME_LABEL} · Contract ₹{CONTRACT_VALUE_CRORE} Cr ({CONTRACT_VENDOR})
        </span>
      </section>

      {/* Dated Biomining Progress Timeline LineChart + Processed vs Remaining Donut */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-8 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Dated Biomining Progress Timeline (% Legacy Waste Treated)
            </h2>
            <p className="text-xs text-teal-100/75">
              Strictly plots verified, dated milestones (02 Mar 2023 → 03 Feb 2025).
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timelineData}
                margin={{ top: 12, right: 44, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0f524e" />
                <XAxis
                  dataKey="date"
                  padding={{ left: 12, right: 18 }}
                  tick={{ fill: '#99f6e4', fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} tick={{ fill: '#99f6e4', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#032423',
                    borderColor: '#10b981',
                    fontSize: '12px',
                    color: '#ecfdf5',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="percent"
                  name="Biomined (%)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#2dd4bf', stroke: '#042f2e', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Processed vs Remaining Donut (75% / 25%) */}
        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-4 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Processed vs Remaining Share
            </h2>
            <p className="text-xs text-teal-100/75">18 acres reclaimed by 03 Feb 2025</p>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#032423',
                    borderColor: '#2dd4bf',
                    fontSize: '12px',
                    color: '#ecfdf5',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around font-mono text-xs tabular-nums border-t border-teal-800/60 pt-3">
            <span className="text-emerald-300 font-bold">75% Processed</span>
            <span className="text-amber-300 font-bold">25% Remaining</span>
          </div>
        </div>
      </section>

      {/* Leaflet Reclaimed vs Active Sector Map + Trommel Off-take Bars */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-teal-800/70 bg-[#063836] lg:col-span-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-teal-800/70 bg-[#032423] px-4 py-2.5 text-xs font-mono text-teal-200">
            <span>Reclaimed (~18 acres) vs Active Sector Map</span>
            <span className="text-emerald-300">9.9880° N, 76.3680° E</span>
          </div>
          <div ref={mapContainerRef} className="h-[320px] w-full flex-1 z-10" />
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-6 space-y-5">
          <div>
            <div className="font-mono text-[11px] font-bold text-amber-300">
              ILLUSTRATIVE SPLIT · NO SITE-SPECIFIC BREAKDOWN PUBLISHED
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-white">
              Trommel Material Recovery Off-Take Streams
            </h2>
            <p className="text-xs text-teal-100/75">
              Illustrative municipal legacy-waste trommel output distribution (for screening reference; site-specific KMC mass-balance percentages are not published).
            </p>
          </div>

          <div className="space-y-4">
            {TROMMEL_OFFTAKE.map((item) => (
              <div key={item.stream} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="font-sans font-semibold text-white">{item.stream}</span>
                  <span className="text-teal-300 font-bold">{item.sharePct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#032423]">
                  <div
                    className="h-full bg-teal-400"
                    style={{ width: `${item.sharePct}%` }}
                  />
                </div>
                <div className="text-[11px] text-teal-100/65">{item.destination}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explicitly tagged ILLUSTRATIVE MODEL ONLY subsurface fire/CH4 potential decay bar chart */}
      <section className="rounded-xl border border-amber-400/35 bg-[#063836] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-bold text-amber-300">
              ILLUSTRATIVE MODEL ONLY · NOT A MEASURED BOREHOLE VALUE
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-white">
              Relative Subsurface Fire & Methane Potential Decay
            </h2>
            <p className="text-xs text-teal-100/75">
              Conceptual fuel-load scaling (1 − M_biomined / M_baseline)^1.35 illustrating hazard reduction as organic waste is cleared.
            </p>
          </div>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={illustrativeDecayData}
              margin={{ top: 10, right: 20, left: -12, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#0f524e" />
              <XAxis dataKey="milestone" tick={{ fill: '#99f6e4', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#99f6e4', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#032423',
                  borderColor: '#f59e0b',
                  fontSize: '12px',
                  color: '#ecfdf5',
                }}
              />
              <Bar
                dataKey="potentialPct"
                name="Illustrative Relative Potential (%)"
                fill="#f59e0b"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </InnovationLayout>
  );
}
