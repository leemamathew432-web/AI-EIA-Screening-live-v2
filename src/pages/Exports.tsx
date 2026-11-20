import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import PptxGenJS from 'pptxgenjs';
import { useRef, useState } from 'react';
import { useObservatory } from '../context/ObservatoryContext';
import { BIOMINING_LAST_VERIFIED, BIOMINING_MILESTONES } from '../data/published';
import { computeHourTrapScore } from '../physics/inversion';
import { degToCompass16 } from '../physics/plume';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const UNSUPPORTED_COLOR_FN_RE = /(^|[^a-zA-Z0-9_-])(oklab|oklch|lab|lch|color-mix|color)\(/gi;

function replaceUnsupportedColorFunctions(
  value: string,
  convert: (expr: string) => string
): string {
  UNSUPPORTED_COLOR_FN_RE.lastIndex = 0;
  let result = '';
  let cursor = 0;

  while (cursor < value.length) {
    UNSUPPORTED_COLOR_FN_RE.lastIndex = cursor;
    const match = UNSUPPORTED_COLOR_FN_RE.exec(value);
    if (!match) {
      result += value.slice(cursor);
      break;
    }

    const prefix = match[1] ?? '';
    const fnStart = match.index + prefix.length;
    const openParenIdx = fnStart + match[2].length;

    let depth = 1;
    let i = openParenIdx + 1;
    while (i < value.length && depth > 0) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')') depth--;
      i++;
    }

    if (depth !== 0) {
      result += value.slice(cursor);
      break;
    }

    const expr = value.slice(fnStart, i);
    result += value.slice(cursor, fnStart) + convert(expr);
    cursor = i;
  }

  return result;
}

function sanitizeCloneForHtml2Canvas(clonedDoc: Document, clonedRoot: HTMLElement) {
  const win = clonedDoc.defaultView;
  if (!win) return;

  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const cache = new Map<string, string>();
  const toRgba = (expr: string): string => {
    const cached = cache.get(expr);
    if (cached) return cached;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = expr;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const alpha = Math.round((a / 255) * 1000) / 1000;
    const rgba = alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    cache.set(expr, rgba);
    return rgba;
  };

  const targetSet = new Set<Element>();
  if (clonedDoc.documentElement) targetSet.add(clonedDoc.documentElement);
  if (clonedDoc.body) targetSet.add(clonedDoc.body);

  let ancestor: HTMLElement | null = clonedRoot;
  while (ancestor) {
    targetSet.add(ancestor);
    ancestor = ancestor.parentElement;
  }
  clonedRoot.querySelectorAll('*').forEach((el) => targetSet.add(el));

  const pending: Array<{ el: HTMLElement | SVGElement; updates: Array<[string, string]> }> = [];

  for (const node of targetSet) {
    if (!('style' in node)) continue;
    const el = node as HTMLElement | SVGElement;
    const cs = win.getComputedStyle(el);
    const updates: Array<[string, string]> = [];

    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      if (!prop || prop.startsWith('--')) continue;
      const val = cs.getPropertyValue(prop);
      if (!val) continue;
      UNSUPPORTED_COLOR_FN_RE.lastIndex = 0;
      if (UNSUPPORTED_COLOR_FN_RE.test(val)) {
        const nextVal = replaceUnsupportedColorFunctions(val, toRgba);
        if (nextVal !== val) {
          updates.push([prop, nextVal]);
        }
      }
    }

    if (updates.length > 0) {
      pending.push({ el, updates });
    }
  }

  for (const { el, updates } of pending) {
    for (const [prop, nextVal] of updates) {
      el.style.setProperty(prop, nextVal, 'important');
    }
  }
}

export function Exports() {
  const {
    bundle,
    naqi,
    plume,
    tonightHours,
    ridgeModel,
    riverWashout,
  } = useObservatory();

  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!bundle || !naqi || !plume || !riverWashout || !ridgeModel) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-teal-100">
        Loading live telemetry for export…
      </div>
    );
  }

  const peakNight = tonightHours.reduce(
    (best, cur) => (cur.trapScore > best.trapScore ? cur : best),
    tonightHours[0] ?? { trapScore: 0, riskTier: 'LOW', blhMeters: 0, hourLabel: '--:--' }
  );

  const stamp = new Date().toISOString().slice(0, 10);

  // 1. PDF Snapshot (A4) via jsPDF + html2canvas
  const handlePdfExport = async () => {
    if (!sheetRef.current) return;
    setBusy('pdf');
    setExportError(null);
    try {
      const target = sheetRef.current;
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#042f2e',
        onclone: (clonedDoc, clonedElement) => {
          sanitizeCloneForHtml2Canvas(clonedDoc, clonedElement);
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(4, 47, 46);
      pdf.rect(0, 0, pdfW, pageH, 'F');
      const rawH = (canvas.height * pdfW) / canvas.width;
      const renderW = rawH > pageH ? (pdfW * pageH) / rawH : pdfW;
      const renderH = rawH > pageH ? pageH : rawH;
      pdf.addImage(imgData, 'PNG', (pdfW - renderW) / 2, 0, renderW, renderH);
      pdf.save(`ai-eia-campus-snapshot-${stamp}.pdf`);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'PDF snapshot export failed.'
      );
    } finally {
      setBusy(null);
    }
  };

  // 2. PPTX Summary Deck (16:9) via pptxgenjs — 5 slides (Cover + I-1 to I-4)
  const handlePptxExport = async () => {
    setBusy('pptx');
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.title = 'AI-EIA Screening Executive Briefing';

      const bg = '042F2E';
      const card = '063836';
      const teal = '2DD4BF';
      const white = 'FFFFFF';
      const muted = '99F6E4';

      const header = (s: PptxGenJS.Slide, code: string, title: string) => {
        s.background = { color: bg };
        s.addText(code, { x: 0.6, y: 0.35, w: 12, h: 0.3, fontSize: 12, bold: true, color: teal });
        s.addText(title, { x: 0.6, y: 0.65, w: 12, h: 0.5, fontSize: 22, bold: true, color: white });
      };

      // Slide 1: Cover
      const s1 = pptx.addSlide();
      s1.background = { color: bg };
      s1.addText('AI-EIA Screening', { x: 0.8, y: 1.7, w: 11.5, h: 0.8, fontSize: 36, bold: true, color: white });
      s1.addText('Brahmapuram – Kakkanad – Kadambrayar River Real-Time Environmental Intelligence Portal', {
        x: 0.8, y: 2.55, w: 11, h: 0.7, fontSize: 16, color: muted,
      });
      s1.addText(
        `Indian NAQI (CAMS, 24-h & 8-h avg): ${naqi.aqi} (${naqi.category})  |  Prominent: ${naqi.dominantPollutant} (${naqi.dominantAveragingPeriod})  |  Wind: ${plume.windSpeedKmh} km/h (${plume.downwindCompass})`,
        { x: 0.8, y: 3.7, w: 11.5, h: 0.45, fontSize: 13, color: teal }
      );
      s1.addText(`Telemetry Sync: ${bundle.lastGoodIstLabel} IST (9.9880° N, 76.3680° E)`, {
        x: 0.8, y: 4.3, w: 11, h: 0.4, fontSize: 11, color: muted,
      });

      // Slide 2: I-1 Plume Trajectory
      const s2 = pptx.addSlide();
      header(s2, 'OBSERVATION I-1', 'Downwind Plume Trajectory & Receptor Arrival Cone');
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: 'Receptor', options: { bold: true, color: teal, fill: { color: card } } },
          { text: 'Dist (km)', options: { bold: true, color: teal, fill: { color: card } } },
          { text: 'Status', options: { bold: true, color: teal, fill: { color: card } } },
          { text: 'ETA', options: { bold: true, color: teal, fill: { color: card } } },
          { text: '% of 500m', options: { bold: true, color: teal, fill: { color: card } } },
        ],
        ...plume.receptors.map((r) => [
          { text: r.receptor.name, options: { color: white, fill: { color: bg } } },
          { text: r.distanceKm.toFixed(2), options: { color: muted, fill: { color: bg } } },
          { text: r.status, options: { color: white, fill: { color: bg } } },
          { text: r.advectionEtaMin !== null ? `${r.advectionEtaMin} min` : '—', options: { color: white, fill: { color: bg } } },
          { text: `${r.relativeConcPctOf500m.toFixed(1)}%`, options: { color: teal, fill: { color: bg } } },
        ]),
      ];
      s2.addTable(rows, { x: 0.6, y: 1.4, w: 12.1, fontSize: 10.5, border: { color: '0F524E', pt: 1 } });

      // Slide 3: I-2 Nocturnal Inversion
      const s3 = pptx.addSlide();
      header(s3, 'OBSERVATION I-2', 'Nocturnal Inversion & 14-Day Ridge Regression Predictor');
      s3.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.5, w: 5.8, h: 4.4, fill: { color: card }, line: { color: '0F524E', width: 1 } });
      s3.addText(
        `Peak Trap Score Tonight: ${peakNight.trapScore}% (${peakNight.riskTier})\nPeak Hour: ${peakNight.hourLabel} IST\nBLH Ceiling: ${peakNight.blhMeters} m`,
        { x: 0.85, y: 1.8, w: 5.3, h: 3.6, fontSize: 14, color: white }
      );
      s3.addShape(pptx.ShapeType.rect, { x: 6.9, y: 1.5, w: 5.8, h: 4.4, fill: { color: card }, line: { color: '0F524E', width: 1 } });
      s3.addText(
        `14-Day Ridge Predictor (λ = 0.05)\nUnmodified Nocturnal Samples: ${ridgeModel.sampleCount}\nHoldout MAE: ${ridgeModel.holdoutMaeC}°C\nHoldout RMSE: ${ridgeModel.holdoutRmseC}°C\nBinary Accuracy (ΔT > 0): ${ridgeModel.holdoutBinaryAccuracyPct}%`,
        { x: 7.15, y: 1.8, w: 5.3, h: 3.6, fontSize: 14, color: teal }
      );

      // Slide 4: I-3 River Leachate
      const s4 = pptx.addSlide();
      header(s4, 'OBSERVATION I-3', 'Kadambrayar River Leachate & Streeter-Phelps Oxygen Sag');
      s4.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.5, w: 12.1, h: 4.3, fill: { color: card }, line: { color: '0F524E', width: 1 } });
      s4.addText(
        `Today Rainfall: ${bundle.daily.precipitationSumToday} mm/day\nRunoff Pulse Q: ${riverWashout.runoffPulseM3s} m³/s (44 ha site)\nInitial Mixed BOD₅: ${riverWashout.mixedInitialBodMgL} mg/L\nCritical Min DO: ${riverWashout.criticalMinDoMgL} mg/L (${riverWashout.status})\nCritical Sag Distance x_c: ${riverWashout.criticalSagDistanceKm} km downstream`,
        { x: 0.9, y: 1.9, w: 11.4, h: 3.4, fontSize: 16, color: white }
      );

      // Slide 5: I-4 Biomining
      const s5 = pptx.addSlide();
      header(s5, 'OBSERVATION I-4', `Biomining & Land Recovery Tracker (Verified ${BIOMINING_LAST_VERIFIED})`);
      BIOMINING_MILESTONES.forEach((m, i) => {
        const y = 1.45 + i * 1.15;
        s5.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 12.1, h: 0.95, fill: { color: card }, line: { color: '0F524E', width: 1 } });
        s5.addText(`${m.dateLabel} — ${m.wasteTreatedNote}`, { x: 0.8, y: y + 0.1, w: 11.6, h: 0.35, fontSize: 13, bold: true, color: teal });
        s5.addText(`${m.summary} (Source: ${m.sourceName}, published ${m.publishedDate})`, { x: 0.8, y: y + 0.48, w: 11.6, h: 0.35, fontSize: 10.5, color: white });
      });

      await pptx.writeFile({ fileName: `ai-eia-campus-briefing-${stamp}.pptx` });
    } finally {
      setBusy(null);
    }
  };

  // 3. DOCX Audit Report via `docx`
  const handleDocxExport = async () => {
    setBusy('docx');
    try {
      const receptorRows = [
        new TableRow({
          children: ['Receptor', 'Distance (km)', 'Status', 'ETA', '% of 500m'].map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
              })
          ),
        }),
        ...plume.receptors.map(
          (r) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(r.receptor.name)] }),
                new TableCell({ children: [new Paragraph(r.distanceKm.toFixed(2))] }),
                new TableCell({ children: [new Paragraph(r.status)] }),
                new TableCell({
                  children: [
                    new Paragraph(r.advectionEtaMin !== null ? `${r.advectionEtaMin} min` : '—'),
                  ],
                }),
                new TableCell({
                  children: [new Paragraph(`${r.relativeConcPctOf500m.toFixed(1)}%`)],
                }),
              ],
            })
        ),
      ];

      const doc = new DocxDocument({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'AI-EIA Screening — Environmental Audit Report',
                    bold: true,
                    size: 32,
                  }),
                ],
              }),
              new Paragraph(
                `Study Coordinates: 9.9880° N, 76.3680° E (Brahmapuram–Kakkanad–Kadambrayar) · Telemetry Sync: ${bundle.lastGoodIstLabel} IST`
              ),
              new Paragraph(' '),
              new Paragraph({
                children: [new TextRun({ text: '1. Live Conditions', bold: true, size: 24 })],
              }),
              new Paragraph(
                `Indian NAQI (CPCB 24-h & 8-h averages from CAMS model): ${naqi.aqi} (${naqi.category}), Prominent Pollutant: ${naqi.dominantPollutant} (${naqi.dominantAveragingPeriod}).`
              ),
              new Paragraph(
                `2 m Temperature: ${bundle.currentWeather.temperature2m}°C (Feels ${bundle.currentWeather.apparentTemperature}°C) · Wind: ${plume.windSpeedKmh} km/h (${plume.windSpeedMs} m/s) from ${plume.windFromDeg}° (${degToCompass16(plume.windFromDeg)}) · Stability Class ${plume.stabilityClass}.`
              ),
              new Paragraph(' '),
              new Paragraph({
                children: [
                  new TextRun({
                    text: '2. Tonight Peak Inversion & Ridge Predictor (I-2)',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph(
                `Peak Trap Score: ${peakNight.trapScore}% (${peakNight.riskTier}) at ${peakNight.hourLabel} IST · BLH Ceiling: ${peakNight.blhMeters} m · 14-day Ridge Holdout MAE: ${ridgeModel.holdoutMaeC}°C, Accuracy: ${ridgeModel.holdoutBinaryAccuracyPct}%.`
              ),
              new Paragraph(' '),
              new Paragraph({
                children: [
                  new TextRun({
                    text: '3. Kadambrayar Critical DO (I-3)',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph(
                `Today Precipitation: ${bundle.daily.precipitationSumToday} mm · Critical Min DO: ${riverWashout.criticalMinDoMgL} mg/L (${riverWashout.status}) at ${riverWashout.criticalSagDistanceKm} km downstream.`
              ),
              new Paragraph(' '),
              new Paragraph({
                children: [
                  new TextRun({
                    text: '4. Receptor Plume Impact Table (I-1)',
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: receptorRows,
              }),
              new Paragraph(' '),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `5. Biomining Milestones (Verified ${BIOMINING_LAST_VERIFIED})`,
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              ...BIOMINING_MILESTONES.map(
                (m) =>
                  new Paragraph(
                    `${m.dateLabel}: ${m.wasteTreatedNote} — Source: ${m.sourceName}, published ${m.publishedDate} (${m.url})`
                  )
              ),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `ai-eia-campus-audit-${stamp}.docx`);
    } finally {
      setBusy(null);
    }
  };

  // 4. CSV Raw Hourly Telemetry
  const handleCsvExport = () => {
    setBusy('csv');
    try {
      const airMap = new Map(bundle.hourlyAir.map((a) => [a.time, a]));
      const header = [
        'time_ist',
        'temp_2m_c',
        'temp_120m_c',
        'delta_t_120m_2m',
        'rh_pct',
        'wind_speed_ms',
        'wind_dir_deg',
        'cloud_pct',
        'precip_mm',
        'blh_m',
        'trap_score',
        'cams_pm25_ugm3',
        'cams_pm10_ugm3',
        'cams_no2_ugm3',
        'cams_so2_ugm3',
        'cams_o3_ugm3',
        'cams_co_mgm3',
      ];
      const rows = bundle.hourlyWeather.map((w) => {
        const analysis = computeHourTrapScore(w);
        const air = airMap.get(w.time);
        return [
          w.time,
          w.temperature2m,
          w.temperature120m,
          analysis.deltaT120mMinus2m,
          w.relativeHumidity2m,
          w.windSpeed10mMs,
          w.windDirection10mDeg,
          w.cloudCoverPct,
          w.precipitationMm,
          analysis.blhMeters,
          analysis.trapScore,
          air?.pm25 ?? '',
          air?.pm10 ?? '',
          air?.no2 ?? '',
          air?.so2 ?? '',
          air?.ozone ?? '',
          air?.coMgM3 ?? '',
        ];
      });
      const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
        `ai-eia-campus-hourly-${stamp}.csv`
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="font-mono text-xs text-teal-300">
          100% Client-Side Report Generation
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Export Centre
        </h1>
        <p className="max-w-2xl text-sm text-teal-100/80">
          Generate portable A4 PDF snapshots, 5-slide 16:9 PowerPoint briefings, structured DOCX
          audit reports, and raw hourly Open-Meteo + CAMS CSV archives directly in your browser.
        </p>
      </div>

      {exportError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/50 bg-rose-950/50 px-4 py-3 text-xs text-rose-200"
        >
          {exportError}
        </div>
      )}

      {/* 4 Export Action Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-2">
            <FileText className="h-6 w-6 text-teal-300" />
            <h2 className="font-display text-lg font-bold text-white">PDF Snapshot (A4)</h2>
            <p className="text-xs leading-relaxed text-teal-100/75">
              Renders the live executive telemetry sheet below via html2canvas + jsPDF.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePdfExport}
            disabled={busy === 'pdf'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-2.5 text-xs font-bold text-[#042f2e] hover:bg-teal-300 disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{busy === 'pdf' ? 'Capturing PDF…' : 'Download PDF'}</span>
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-2">
            <Presentation className="h-6 w-6 text-amber-300" />
            <h2 className="font-display text-lg font-bold text-white">PPTX Summary Deck (16:9)</h2>
            <p className="text-xs leading-relaxed text-teal-100/75">
              5 widescreen slides (Cover + I-1 to I-4 observations) via pptxgenjs.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePptxExport}
            disabled={busy === 'pptx'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-500/60 bg-teal-400/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-400/25 disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{busy === 'pptx' ? 'Building PPTX…' : 'Download PPTX'}</span>
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-2">
            <FileText className="h-6 w-6 text-sky-300" />
            <h2 className="font-display text-lg font-bold text-white">DOCX Audit Report</h2>
            <p className="text-xs leading-relaxed text-teal-100/75">
              Structured Word document with NAQI, inversion, river DO, receptor table & sources.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDocxExport}
            disabled={busy === 'docx'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-700 bg-[#032423] px-4 py-2.5 text-xs font-bold text-white hover:border-teal-400 disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{busy === 'docx' ? 'Building DOCX…' : 'Download DOCX'}</span>
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-300" />
            <h2 className="font-display text-lg font-bold text-white">CSV Raw Telemetry</h2>
            <p className="text-xs leading-relaxed text-teal-100/75">
              14-day + 48-h hourly weather, CAMS air quality, and inversion trap scores.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCsvExport}
            disabled={busy === 'csv'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-700 bg-[#032423] px-4 py-2.5 text-xs font-bold text-white hover:border-teal-400 disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </section>

      {/* Executive Telemetry Sheet Preview (captured for A4 PDF Snapshot) */}
      <section
        ref={sheetRef}
        className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-800/60 pb-3">
          <div>
            <div className="font-mono text-xs text-teal-300">
              AI-EIA Screening · Executive Telemetry Sheet
            </div>
            <h2 className="font-display text-lg font-bold text-white">
              Brahmapuram – Kakkanad – Kadambrayar River Snapshot
            </h2>
          </div>
          <span className="font-mono text-xs text-teal-200">
            Synced {bundle.lastGoodIstLabel} IST
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 font-mono text-xs tabular-nums">
          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-teal-200/70">Indian NAQI (24-h &amp; 8-h avg)</div>
            <div className="mt-1 text-xl font-bold text-teal-300">
              {naqi.aqi} ({naqi.category})
            </div>
            <div className="mt-0.5 text-[11px] text-teal-200/75">
              Prominent: {naqi.dominantPollutant} ({naqi.dominantAveragingPeriod})
            </div>
          </div>
          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-teal-200/70">Temperature & Wind</div>
            <div className="mt-1 text-xl font-bold text-white">
              {bundle.currentWeather.temperature2m}°C · {plume.windSpeedKmh} km/h
            </div>
          </div>
          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-teal-200/70">Tonight Peak Inversion</div>
            <div className="mt-1 text-xl font-bold text-amber-300">
              {peakNight.trapScore}% ({peakNight.riskTier})
            </div>
          </div>
          <div className="rounded-lg border border-teal-800/70 bg-[#032423] p-4">
            <div className="text-teal-200/70">Kadambrayar Critical DO</div>
            <div className="mt-1 text-xl font-bold text-sky-300">
              {riverWashout.criticalMinDoMgL} mg/L ({riverWashout.status})
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
