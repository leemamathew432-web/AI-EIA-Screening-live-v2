import { ExternalLink } from 'lucide-react';
import { DataStatusBadge } from '../components/DataStatusBadge';
import { MathBlock } from '../components/MathBlock';
import { MASTER_DATA_SOURCES } from '../data/published';

export function Methods() {
  const physicsCards = [
    {
      code: 'I-1',
      title: 'Gaussian Downwind Plume & Briggs (1973) Rural Dispersion',
      latex: String.raw`\frac{C(x,y)}{C(500,0)} = \frac{\sigma_y(500)\,\sigma_z(500)}{\sigma_y(x)\,\sigma_z(x)} \exp\!\left(-\frac{y^2}{2\sigma_y^2}\right) \exp\!\left(-\frac{H^2}{2}\left[\frac{1}{\sigma_z(x)^2} - \frac{1}{\sigma_z(500)^2}\right]\right)`,
      parameters: [
        {
          symbol: 'C(x, y) / C(500, 0)',
          meaning:
            'Ground-level concentration at receptor coordinates (x, y) normalized to the 500 m downwind centerline reference (reported as % of the 500 m core).',
        },
        {
          symbol: 'x, y (m)',
          meaning:
            'Downwind advection distance along the wind vector (x) and perpendicular crosswind offset (y) from the plume axis.',
        },
        {
          symbol: 'σ_y(x), σ_z(x) (m)',
          meaning:
            'Horizontal and vertical Gaussian dispersion widths from Briggs (1973) open-country curves, selected by live Pasquill–Gifford stability class (A–F).',
        },
        {
          symbol: 'H = 5 m',
          meaning:
            'Effective near-surface release height representing low-elevation smouldering or VOC/dust venting from waste mounds.',
        },
      ],
      relevance:
        'Projects a live ±15° dispersion cone from Brahmapuram across the 8 Kakkanad–Kochi receptor hubs (Infopark Ph-I/II, SmartCity Kochi, Rajagiri Valley, local schools), computing real-time arrival ETAs (x/u) and relative dilution ratios as wind shifts.',
    },
    {
      code: 'I-2',
      title: 'Thermal Inversion Detection & 14-Day Ridge Regression',
      latex: String.raw`\Delta T = T_{120\text{m}} - T_{2\text{m}} > 0, \qquad \hat{w} = (X^\top X + \lambda I)^{-1} X^\top y \;\;(\lambda = 0.05)`,
      parameters: [
        {
          symbol: 'ΔT (°C)',
          meaning:
            'Vertical temperature difference between 120 m aloft and 2 m surface air; ΔT > 0 indicates a ground-based thermal inversion acting as an atmospheric lid.',
        },
        {
          symbol: 'X, y',
          meaning:
            'Design matrix of unmodified past nocturnal hours (18:00–06:59 IST) from Open-Meteo’s 14-day history (wind, cloud cover, RH, 15:00 IST cooling drop, sin/cos hour) and observed ΔT targets.',
        },
        {
          symbol: 'ŵ, λ = 0.05',
          meaning:
            'Ridge Regression coefficient vector solved with L₂ regularization penalty λ = 0.05 to stabilize weights against collinear nocturnal weather features.',
        },
        {
          symbol: 'P(ΔT > 0)',
          meaning:
            'Inversion probability derived via the normal CDF using predicted ΔT̂ and 80/20 holdout residual standard deviation σ_res.',
        },
      ],
      relevance:
        'Explains why Kakkanad apartments and night-shift IT zones experience intense smoke and VOC accumulation after midnight even when daytime air looks clear, forecasting boundary-layer ceiling collapse before morning.',
    },
    {
      code: 'I-3',
      title: 'Rational Runoff & 1D Streeter-Phelps Oxygen Sag',
      latex: String.raw`Q_{\text{runoff}} = C \cdot i \cdot A, \qquad D(t) = \frac{k_d L_0}{k_a - k_d}\!\left(e^{-k_d t} - e^{-k_a t}\right) + D_0 e^{-k_a t}`,
      parameters: [
        {
          symbol: 'Q_runoff (m³/s)',
          meaning:
            'Stormwater leachate pulse generated from runoff coefficient C, live daily rainfall intensity i (mm/day), and the A = 44 ha Brahmapuram site footprint.',
        },
        {
          symbol: 'D(t) (mg/L)',
          meaning:
            'Dissolved oxygen deficit below APHA freshwater saturation at river travel time t = x / u_river (days) downstream of the leachate entry node.',
        },
        {
          symbol: 'L₀, D₀ (mg/L)',
          meaning:
            'Initial mixed ultimate BOD and initial DO deficit immediately after leachate runoff blends with baseline Kadambrayar River discharge.',
        },
        {
          symbol: 'k_d, k_a (1/day)',
          meaning:
            'Arrhenius temperature-adjusted BOD deoxygenation (k_d) and atmospheric reaeration (k_a) kinetic rate constants.',
        },
      ],
      relevance:
        'Links live Kochi rainfall directly to organic leachate washout entering the Kadambrayar River, pinpointing the Critical Oxygen Sag Distance (x_c) downstream and alerting when DO risks breaching CPCB’s 4.0 mg/L ecological floor.',
    },
    {
      code: 'I-4',
      title: 'Dated Biomining Milestones & Illustrative Hazard Scaling',
      latex: String.raw`P_{\text{fire, rel}} \propto \left(1 - \frac{M_{\text{biomined}}}{M_{\text{baseline}}}\right)^{1.35}`,
      parameters: [
        {
          symbol: 'M_biomined / M_baseline',
          meaning:
            'Published fraction of the ~5.5 lakh m³ (2023 baseline) legacy waste mound excavated and trommel-screened by dated audit milestones.',
        },
        {
          symbol: 'P_fire, rel (%)',
          meaning:
            'Conceptual relative subsurface fire and methane hazard index illustrating non-linear fuel-load reduction (tagged illustrative only, not borehole gas data).',
        },
      ],
      relevance:
        'Anchors environmental screening in verified municipal engineering progress (75% biomined and 18 acres reclaimed by 03 Feb 2025 under the ₹118 Cr Bhumi Green Energy contract), showing how legacy-waste clearance reduces persistent fire source risk.',
    },
  ];

  const eiaMatrix = [
    {
      code: 'I-1',
      pathway: 'Atmospheric Particulate & VOC Advection',
      driver: '10 m Wind Vector + Solar Radiation',
      receptors: '8 Kakkanad–Kochi Campuses (5 km radius)',
      output: 'Plume Alignment, Advection ETA (min), % of 500 m',
    },
    {
      code: 'I-2',
      pathway: 'Nocturnal Radiative Cooling & Boundary Trapping',
      driver: 'ΔT(120m−2m), BLH, Wind < 1.7 m/s, RH > 80%',
      receptors: 'Kakkanad Residential & Night-Shift Zones',
      output: '0–100 Trap Score + Ridge ΔT Forecast',
    },
    {
      code: 'I-3',
      pathway: 'Monsoon Stormwater Leachate Washout',
      driver: '24 h Precipitation & Rational Runoff Pulse',
      receptors: 'Kadambrayar River Downstream Reach (0–12 km)',
      output: 'Critical Min DO (mg/L) & Sag Pin Distance x_c',
    },
    {
      code: 'I-4',
      pathway: 'Legacy Mound Excavation & Land Reclamation',
      driver: 'Dated Municipal & Press Audit Records',
      receptors: '110-Acre Brahmapuram Site Perimeter',
      output: '75% Biomined, 18 Acres Reclaimed (03 Feb 2025), Illustrative Trommel Fractions',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="font-mono text-xs text-teal-300">
          Master Registry & Governing Equations
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Methods & Sources
        </h1>
        <p className="max-w-3xl text-sm text-teal-100/80">
          Transparent documentation of every live API feed, statutory standard, published audit
          citation, and mathematical equation powering AI-EIA Screening.
        </p>
      </div>

      {/* Master Registry of Data Sources Table */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-white">
          Master Registry of Data Sources
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-teal-800/70 font-mono text-teal-300">
                <th className="py-3 pr-4">Source</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Parameters</th>
                <th className="py-3 pr-4">Cadence</th>
                <th className="py-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50">
              {MASTER_DATA_SOURCES.map((src) => (
                <tr key={src.id} className="hover:bg-[#032423]/50">
                  <td className="py-3 pr-4 font-semibold text-white">
                    <div>{src.name}</div>
                    <div className="mt-0.5 font-normal text-teal-100/70">{src.notes}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <DataStatusBadge type={src.type} detail="" />
                  </td>
                  <td className="py-3 pr-4 font-mono text-teal-100/80 max-w-md">
                    {src.parameters}
                  </td>
                  <td className="py-3 pr-4 font-mono text-teal-200 whitespace-nowrap">
                    {src.cadence}
                  </td>
                  <td className="py-3 text-right">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-teal-300 underline hover:text-teal-200 whitespace-nowrap"
                    >
                      <span>Open</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Governing Physics & Parameters Cards (I-1 to I-4) */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-white">
          Governing Physics & Parameters (I-1 to I-4)
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {physicsCards.map((card) => (
            <div
              key={card.code}
              className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4"
            >
              <div className="font-mono text-xs font-bold text-teal-300">{card.code}</div>
              <h3 className="font-display text-base font-bold text-white">{card.title}</h3>
              <MathBlock latex={card.latex} />
              <div className="space-y-2 rounded-lg border border-teal-800/60 bg-[#032423] p-4">
                <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-teal-300">
                  Equation Parameters
                </div>
                <dl className="space-y-2 text-xs">
                  {card.parameters.map((param) => (
                    <div key={param.symbol} className="grid grid-cols-1 gap-0.5 sm:grid-cols-12 sm:gap-2">
                      <dt className="font-mono font-semibold text-teal-200 sm:col-span-4">
                        {param.symbol}
                      </dt>
                      <dd className="text-teal-100/80 leading-relaxed sm:col-span-8">
                        {param.meaning}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="text-xs leading-relaxed text-teal-100/85">
                <span className="font-semibold text-amber-300">Relevance to Project: </span>
                {card.relevance}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EIA Screening Pathway Matrix Table */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-white">
          EIA Screening Pathway Matrix (I-1 to I-4)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-teal-800/70 font-mono text-teal-300">
                <th className="py-3 pr-4">Module</th>
                <th className="py-3 pr-4">Environmental Pathway</th>
                <th className="py-3 pr-4">Primary Drivers</th>
                <th className="py-3 pr-4">Protected Receptors</th>
                <th className="py-3">Screening Metric</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50">
              {eiaMatrix.map((row) => (
                <tr key={row.code}>
                  <td className="py-3 pr-4 font-mono font-bold text-teal-300">{row.code}</td>
                  <td className="py-3 pr-4 font-semibold text-white">{row.pathway}</td>
                  <td className="py-3 pr-4 text-teal-100/80">{row.driver}</td>
                  <td className="py-3 pr-4 text-teal-100/80">{row.receptors}</td>
                  <td className="py-3 font-mono text-teal-200">{row.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
