import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DataStatusBadge } from './DataStatusBadge';
import { MathBlock } from './MathBlock';
import type { DataBadgeType } from '../types/telemetry';

export interface CollectsRow {
  parameter: string;
  source: string;
  status: DataBadgeType;
  cadence: string;
  currentValue: string;
}

export interface HowItWorksStep {
  step: string;
  title: string;
  detail: string;
}

export interface WhoItHelpsItem {
  audience: string;
  statusLabel: string;
  guidance: string;
}

export interface SourceLinkItem {
  name: string;
  detail: string;
  url?: string;
}

interface InnovationLayoutProps {
  code: 'I-1' | 'I-2' | 'I-3' | 'I-4';
  title: string;
  subtitle: string;
  badgeType: DataBadgeType;
  badgeDetail: string;
  badgeFormulaName?: string;
  badgeHowText?: string;
  isSimulationMode?: boolean;
  whatIfPanel?: ReactNode;
  children: ReactNode; // Live Output & Interactive Visual
  collectsRows?: CollectsRow[];
  howItWorksSteps?: HowItWorksStep[];
  howItWorksLatex?: string;
  whoItHelps: WhoItHelpsItem[];
  whyUseful: string;
  limitations: string[];
  sources: SourceLinkItem[];
  hideTechnicalSections?: boolean; // True for I-4
}

const OBS_TABS = [
  { code: 'I-1', label: 'Plume Trajectory', path: '/observations/plume-trajectory' },
  { code: 'I-2', label: 'Night Inversion', path: '/observations/night-inversion' },
  { code: 'I-3', label: 'River Leachate', path: '/observations/river-leachate' },
  { code: 'I-4', label: 'Biomining Tracker', path: '/observations/biomining-tracker' },
];

export function InnovationLayout({
  code,
  title,
  subtitle,
  badgeType,
  badgeDetail,
  badgeFormulaName,
  badgeHowText,
  isSimulationMode = false,
  whatIfPanel,
  children,
  collectsRows,
  howItWorksSteps,
  howItWorksLatex,
  whoItHelps,
  whyUseful,
  limitations,
  sources,
  hideTechnicalSections = false,
}: InnovationLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Sub-navigation across I-1 to I-4 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-800/70 bg-[#032423] p-1.5">
        {OBS_TABS.map((tab) => {
          const active = tab.code === code;
          return (
            <Link
              key={tab.code}
              to={tab.path}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-teal-400 text-[#042f2e] font-bold'
                  : 'text-teal-100/80 hover:bg-[#063836] hover:text-white'
              }`}
            >
              <span className="font-mono mr-1.5">{tab.code}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Header */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-xs font-bold text-teal-300">
            Observation {code}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {isSimulationMode && (
              <DataStatusBadge type="SIMULATION MODE" detail="What-If sliders active" />
            )}
            <DataStatusBadge
              type={badgeType}
              detail={badgeDetail}
              formulaName={badgeFormulaName}
              howText={badgeHowText}
            />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl text-balance">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-teal-100/80">{subtitle}</p>
      </section>

      {/* Optional What-If Panel (omitted for I-4) */}
      {!hideTechnicalSections && whatIfPanel && (
        <section className="rounded-xl border border-teal-800/70 bg-[#032423] p-5">
          {whatIfPanel}
        </section>
      )}

      {/* Primary Live Output & Interactive Visuals */}
      <div className="space-y-8">{children}</div>

      {/* What It Collects (omitted for I-4) */}
      {!hideTechnicalSections && collectsRows && collectsRows.length > 0 && (
        <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">What It Collects</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-teal-800/70 font-mono text-teal-300">
                  <th className="py-2.5 pr-4">Parameter</th>
                  <th className="py-2.5 pr-4">Source</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Cadence</th>
                  <th className="py-2.5 text-right">Current Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-800/50">
                {collectsRows.map((row) => (
                  <tr key={row.parameter}>
                    <td className="py-2.5 pr-4 font-semibold text-white">{row.parameter}</td>
                    <td className="py-2.5 pr-4 text-teal-100/80">{row.source}</td>
                    <td className="py-2.5 pr-4">
                      <DataStatusBadge type={row.status} detail="" />
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-teal-200/75">{row.cadence}</td>
                    <td className="py-2.5 text-right font-mono text-teal-300 tabular-nums">
                      {row.currentValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* How It Works + KaTeX Equation (omitted for I-4) */}
      {!hideTechnicalSections && howItWorksSteps && howItWorksSteps.length > 0 && (
        <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white">How It Works</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((s) => (
              <div
                key={s.step}
                className="rounded-lg border border-teal-800/70 bg-[#032423] p-4 space-y-1.5"
              >
                <div className="font-mono text-xs font-bold text-teal-300">{s.step}</div>
                <div className="text-sm font-bold text-white">{s.title}</div>
                <p className="text-xs leading-relaxed text-teal-100/75">{s.detail}</p>
              </div>
            ))}
          </div>
          {howItWorksLatex && <MathBlock latex={howItWorksLatex} />}
        </section>
      )}

      {/* Who It Helps & Why It Is Useful */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-7 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Who It Helps</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {whoItHelps.map((item) => (
              <div
                key={item.audience}
                className="rounded-lg border border-teal-800/70 bg-[#032423] p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{item.audience}</span>
                  <span className="font-mono text-[11px] font-semibold text-teal-300">
                    {item.statusLabel}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-teal-100/80">{item.guidance}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 lg:col-span-5 space-y-3">
          <h2 className="font-display text-lg font-bold text-white">Why It Is Useful</h2>
          <p className="text-sm leading-relaxed text-teal-100/85">{whyUseful}</p>
        </div>
      </section>

      {/* Limitations & Assumptions + Sources & References */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-500/30 bg-[#032423] p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-amber-300">
            Limitations & Assumptions
          </h2>
          <ul className="space-y-2 text-xs leading-relaxed text-teal-100/80 list-disc pl-4">
            {limitations.map((lim) => (
              <li key={lim}>{lim}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-white">
            Sources & References
          </h2>
          <div className="divide-y divide-teal-800/60">
            {sources.map((src) => (
              <div key={src.name} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-teal-50">{src.name}</span>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-teal-300 underline hover:text-teal-200 shrink-0"
                    >
                      Open Link
                    </a>
                  )}
                </div>
                <p className="mt-0.5 text-teal-100/70">{src.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
