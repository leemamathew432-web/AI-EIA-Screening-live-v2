import {
  AlertTriangle,
  BookOpen,
  Cpu,
  ExternalLink,
  HelpCircle,
  Radio,
  Sliders,
} from 'lucide-react';
import { useState } from 'react';
import type { DataBadgeType } from '../types/telemetry';

interface DataStatusBadgeProps {
  type: DataBadgeType;
  detail?: string;
  formulaName?: string;
  howText?: string;
  sourceUrl?: string;
}

export function DataStatusBadge({
  type,
  detail,
  formulaName,
  howText,
  sourceUrl,
}: DataStatusBadgeProps) {
  const [showHow, setShowHow] = useState(false);

  const meta = {
    LIVE: {
      icon: Radio,
      color: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
      defaultDetail: detail ?? 'Updated via Open-Meteo · 5 min poll',
    },
    MODELLED: {
      icon: Cpu,
      color: 'text-teal-300 border-teal-400/35 bg-teal-400/10',
      defaultDetail: formulaName ?? detail ?? 'Computed in-browser',
    },
    PUBLISHED: {
      icon: BookOpen,
      color: 'text-amber-300 border-amber-400/35 bg-amber-400/10',
      defaultDetail: detail ?? 'Verified published record',
    },
    ASSUMED: {
      icon: AlertTriangle,
      color: 'text-amber-200 border-amber-500/40 bg-amber-500/10',
      defaultDetail: detail ?? 'Assumed parameter — replace with field data',
    },
    'SIMULATION MODE': {
      icon: Sliders,
      color: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
      defaultDetail: detail ?? 'What-If slider override active',
    },
  }[type];

  const Icon = meta.icon;

  return (
    <div className="relative inline-flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap ${meta.color}`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span>{type}</span>
      </span>

      <span className="font-mono text-xs text-teal-100/80">{meta.defaultDetail}</span>

      {type === 'MODELLED' && howText && (
        <button
          type="button"
          onClick={() => setShowHow((p) => !p)}
          className="inline-flex items-center gap-1 rounded border border-teal-700/70 bg-[#032423] px-1.5 py-0.5 font-mono text-[11px] text-teal-200 hover:border-teal-400 cursor-pointer"
        >
          <HelpCircle className="h-3 w-3" />
          <span>How?</span>
        </button>
      )}

      {type === 'PUBLISHED' && sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 underline hover:text-amber-200"
        >
          <span>Source</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {showHow && howText && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 rounded-lg border border-teal-500/40 bg-[#032423] p-3 text-xs leading-relaxed text-teal-50 shadow-2xl">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] font-semibold text-teal-300">
            <span>{formulaName ?? 'Calculation Basis'}</span>
            <button
              type="button"
              onClick={() => setShowHow(false)}
              className="text-teal-200 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <p>{howText}</p>
        </div>
      )}
    </div>
  );
}
