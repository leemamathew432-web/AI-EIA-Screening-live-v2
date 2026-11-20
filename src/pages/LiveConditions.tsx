import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  CloudFog,
  Eye,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DataStatusBadge } from '../components/DataStatusBadge';
import { useObservatory } from '../context/ObservatoryContext';
import { AiInsight } from '../components/AiInsight';
import { classifyNaqi, type NaqiCategory } from '../physics/naqi';
import { getNowKolkataIsoPrefix } from '../services/openMeteo';

type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Very High';

type ConditionId =
  | 'asthma'
  | 'heart'
  | 'allergies'
  | 'sinus'
  | 'cold-flu'
  | 'copd'
  | 'eye'
  | 'children-elderly';

interface CategoryStyle {
  hex: string;
  textOnPill: string;
  range: string;
  healthMessage: string;
}

const NAQI_CATEGORY_STYLES: Record<NaqiCategory, CategoryStyle> = {
  Good: {
    hex: '#009966',
    textOnPill: '#ffffff',
    range: '0–50',
    healthMessage: 'Minimal impact.',
  },
  Satisfactory: {
    hex: '#8BC34A',
    textOnPill: '#042f2e',
    range: '51–100',
    healthMessage: 'Minor breathing discomfort to sensitive people.',
  },
  Moderate: {
    hex: '#FFDE33',
    textOnPill: '#042f2e',
    range: '101–200',
    healthMessage:
      'Breathing discomfort to people with lung disease such as asthma, and discomfort to people with heart disease, children and older adults.',
  },
  Poor: {
    hex: '#FF9933',
    textOnPill: '#042f2e',
    range: '201–300',
    healthMessage: 'Breathing discomfort to most people on prolonged exposure.',
  },
  'Very Poor': {
    hex: '#CC0033',
    textOnPill: '#ffffff',
    range: '301–400',
    healthMessage: 'Respiratory illness on prolonged exposure.',
  },
  Severe: {
    hex: '#7E0023',
    textOnPill: '#ffffff',
    range: '401–500',
    healthMessage: 'Affects healthy people and seriously impacts those with existing diseases.',
  },
};

const NAQI_SCALE_SEGMENTS: Array<{
  label: NaqiCategory;
  range: string;
  hex: string;
  widthPct: number;
}> = [
  { label: 'Good', range: '0–50', hex: '#009966', widthPct: 10 },
  { label: 'Satisfactory', range: '51–100', hex: '#8BC34A', widthPct: 10 },
  { label: 'Moderate', range: '101–200', hex: '#FFDE33', widthPct: 20 },
  { label: 'Poor', range: '201–300', hex: '#FF9933', widthPct: 20 },
  { label: 'Very Poor', range: '301–400', hex: '#CC0033', widthPct: 20 },
  { label: 'Severe', range: '401–500', hex: '#7E0023', widthPct: 20 },
];

const WHO_LIMITS: Record<'PM2.5' | 'PM10' | 'NO2', number> = {
  'PM2.5': 15,
  PM10: 45,
  NO2: 25,
};

const RISK_LEVELS: RiskLevel[] = ['Low', 'Moderate', 'High', 'Very High'];

const RISK_STYLES: Record<
  RiskLevel,
  {
    pillClass: string;
    panelBgClass: string;
    strokeHex: string;
    stepBgClass: string;
  }
> = {
  Low: {
    pillClass: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
    panelBgClass: 'border-emerald-500/30 bg-emerald-500/10',
    strokeHex: '#34d399',
    stepBgClass: 'bg-emerald-400 text-[#042f2e]',
  },
  Moderate: {
    pillClass: 'border-amber-300/50 bg-amber-400/20 text-amber-200',
    panelBgClass: 'border-amber-400/30 bg-amber-400/10',
    strokeHex: '#fbbf24',
    stepBgClass: 'bg-amber-300 text-[#042f2e]',
  },
  High: {
    pillClass: 'border-orange-400/55 bg-orange-500/20 text-orange-200',
    panelBgClass: 'border-orange-400/35 bg-orange-500/10',
    strokeHex: '#fb923c',
    stepBgClass: 'bg-orange-400 text-[#042f2e]',
  },
  'Very High': {
    pillClass: 'border-rose-400/60 bg-rose-500/25 text-rose-200',
    panelBgClass: 'border-rose-500/40 bg-rose-500/12',
    strokeHex: '#fb7185',
    stepBgClass: 'bg-rose-500 text-white',
  },
};

interface ConditionSpec {
  id: ConditionId;
  tabLabel: string;
  title: string;
  riskTargetPhrase: string;
  isHighSensitivity: boolean;
  whatItIs: string;
  affectHeading: string;
  howPollutionAffects: string;
  whatMayHappen: string;
  dos: string[];
  donts: string[];
  doctorLabel: string;
  seeDoctorIf: string;
  icon: typeof Wind;
}

const CONDITIONS: ConditionSpec[] = [
  {
    id: 'asthma',
    tabLabel: 'Asthma',
    title: 'Asthma',
    riskTargetPhrase: 'asthma flare-up',
    isHighSensitivity: true,
    whatItIs: 'Airways in the lungs become swollen and narrow, making breathing hard.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects:
      'Fine dust (PM2.5) and gases (NO₂, ozone) irritate the airways and trigger attacks.',
    whatMayHappen: 'Wheezing, coughing at night, chest tightness, shortness of breath.',
    dos: [
      'Keep your reliever inhaler with you',
      'Take prescribed medicines regularly',
      'Stay indoors with windows closed on high days',
      'Use an air purifier in the bedroom',
      'Wear an N95 mask outside',
    ],
    donts: [
      'Exercise outdoors',
      'Smoke or stay near smoke',
      'Go towards the dumpsite side',
    ],
    doctorLabel: 'See a doctor if',
    seeDoctorIf:
      "The inhaler doesn't help, lips turn bluish, or you can't speak full sentences.",
    icon: Wind,
  },
  {
    id: 'heart',
    tabLabel: 'Heart Issues',
    title: 'Heart Issues',
    riskTargetPhrase: 'heart symptoms',
    isHighSensitivity: true,
    whatItIs: 'High BP, heart disease or a past heart attack.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects: 'PM2.5 enters the blood, raises BP and strains the heart.',
    whatMayHappen: 'Tiredness, palpitations, chest discomfort, breathlessness on effort.',
    dos: [
      'Take heart/BP medicines on time',
      'Do light exercise indoors',
      'Drink enough water',
      'Check BP if unwell',
    ],
    donts: [
      'Heavy work or exercise outdoors',
      'Early-morning walks in smog',
      'Ignore chest pain',
    ],
    doctorLabel: 'See a doctor (emergency) if',
    seeDoctorIf:
      'Chest pain or pressure, pain spreading to arm or jaw, sudden breathlessness, fainting.',
    icon: HeartPulse,
  },
  {
    id: 'allergies',
    tabLabel: 'Allergies',
    title: 'Allergies',
    riskTargetPhrase: 'allergy flare-up',
    isHighSensitivity: false,
    whatItIs: 'The body over-reacts to dust, mould or particles.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects: 'Dust (PM10) and smoke make the nose and eyes more sensitive.',
    whatMayHappen: 'Sneezing, runny or blocked nose, itchy eyes, skin itching.',
    dos: [
      'Wash face and hands after coming in',
      'Saline nose rinse',
      'Keep windows closed',
      'Clean with a damp cloth',
    ],
    donts: [
      'Dry-sweep dust',
      'Dry clothes outside on dusty days',
      'Rub your eyes',
    ],
    doctorLabel: 'See a doctor if',
    seeDoctorIf:
      'Face or lips swell, breathing is difficult, or symptoms last over 2 weeks.',
    icon: Sparkles,
  },
  {
    id: 'sinus',
    tabLabel: 'Sinus',
    title: 'Sinus',
    riskTargetPhrase: 'sinus symptoms',
    isHighSensitivity: false,
    whatItIs: 'The air spaces around the nose become swollen.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects: 'Particles and damp air irritate the nose and block drainage.',
    whatMayHappen: 'Blocked nose, headache, pressure on the face, thick mucus.',
    dos: [
      'Steam inhalation',
      'Saline nose rinse',
      'Warm drinks',
      'Mask outdoors',
    ],
    donts: [
      'Smoke',
      'Stay in damp, mouldy rooms',
      'Overuse nasal sprays without advice',
    ],
    doctorLabel: 'See a doctor if',
    seeDoctorIf: 'High fever, swelling around the eyes, or symptoms over 10 days.',
    icon: CloudFog,
  },
  {
    id: 'cold-flu',
    tabLabel: 'Cold/Flu',
    title: 'Cold / Flu',
    riskTargetPhrase: 'cold/flu symptoms',
    isHighSensitivity: false,
    whatItIs: 'Virus infections of the nose and throat.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects:
      "Pollution doesn't cause the virus, but irritated airways catch infections more easily and heal slower.",
    whatMayHappen: 'Sore throat, cough, runny nose, mild fever; cough may last longer.',
    dos: [
      'Rest',
      'Warm fluids',
      'Wash hands often',
      'Cover coughs',
      'Mask in crowds',
    ],
    donts: [
      'Go to school or work with fever',
      'Take antibiotics without a doctor',
    ],
    doctorLabel: 'See a doctor if',
    seeDoctorIf:
      'Fever over 3 days, breathing difficulty, or infants/elderly getting worse.',
    icon: ShieldAlert,
  },
  {
    id: 'copd',
    tabLabel: 'COPD',
    title: 'COPD',
    riskTargetPhrase: 'COPD flare-up',
    isHighSensitivity: true,
    whatItIs:
      'Long-term lung damage, common in smokers and people exposed to smoke for years.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects:
      'Polluted air causes flare-ups where breathing becomes much harder.',
    whatMayHappen: 'More breathlessness, more cough and mucus, tiredness.',
    dos: [
      'Use inhalers as prescribed',
      'Follow your action plan',
      'Stay indoors on high days',
      'Breathing exercises indoors',
    ],
    donts: [
      'Smoke',
      'Cook on wood fires without ventilation',
      'Go out early morning in smog',
    ],
    doctorLabel: 'See a doctor (urgently) if',
    seeDoctorIf: 'Severe breathlessness, confusion or drowsiness, bluish lips.',
    icon: Stethoscope,
  },
  {
    id: 'eye',
    tabLabel: 'Eye Irritation',
    title: 'Eye Irritation',
    riskTargetPhrase: 'eye irritation symptoms',
    isHighSensitivity: false,
    whatItIs:
      'Surface dryness and irritation of the eyes caused by smoke, dust, and gases.',
    affectHeading: 'How pollution affects it',
    howPollutionAffects: 'Smoke and dust dry out and irritate the eyes.',
    whatMayHappen: 'Redness, burning, watering, itching.',
    dos: [
      'Wash eyes with clean water',
      'Wear glasses outside',
      'Use lubricating drops if advised',
    ],
    donts: [
      'Rub your eyes',
      'Wear contact lenses for long hours on high days',
    ],
    doctorLabel: 'See a doctor if',
    seeDoctorIf: 'Pain, blurred vision, or redness lasting more than 2 days.',
    icon: Eye,
  },
  {
    id: 'children-elderly',
    tabLabel: 'Children & Elderly',
    title: 'Children & Elderly',
    riskTargetPhrase: 'breathing symptoms',
    isHighSensitivity: true,
    whatItIs:
      'Growing lungs in children and age-related heart or lung sensitivity in older adults.',
    affectHeading: 'Why more at risk',
    howPollutionAffects:
      'Children breathe faster and play outside, and their lungs are still growing. Elderly people often have heart or lung problems.',
    whatMayHappen: 'Cough, wheezing, tiredness, breathlessness during play or walks.',
    dos: [
      'Schedule outdoor games and PT in the cleanest hours',
      'Watch for cough and breathlessness',
      'Keep medicines ready',
    ],
    donts: [
      'Outdoor sports when risk is High or above',
      'Early-morning walks in smog',
    ],
    doctorLabel: 'See a doctor if',
    seeDoctorIf:
      'Fast or difficult breathing, a child too tired to play, or an elderly person becoming confused.',
    icon: Users,
  },
];

function computeDiseaseRiskLevel(
  category: NaqiCategory,
  isHighSensitivity: boolean
): RiskLevel {
  if (isHighSensitivity) {
    if (category === 'Good') return 'Low';
    if (category === 'Satisfactory') return 'Moderate';
    if (category === 'Moderate') return 'High';
    return 'Very High'; // Poor, Very Poor, Severe
  }
  if (category === 'Good' || category === 'Satisfactory') return 'Low';
  if (category === 'Moderate') return 'Moderate';
  if (category === 'Poor') return 'High';
  return 'Very High'; // Very Poor, Severe
}

function ConditionIllustration({
  id,
  stroke,
}: {
  id: ConditionId;
  stroke: string;
}): ReactNode {
  const common = {
    viewBox: '0 0 120 120',
    fill: 'none',
    stroke,
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-28 w-28 mx-auto',
  };

  switch (id) {
    case 'asthma':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M60 18v34" />
          <path d="M60 44c-12 0-26 10-30 26-3 14 4 28 16 28 8 0 12-5 14-12" />
          <path d="M60 44c12 0 26 10 30 26 3 14-4 28-16 28-8 0-12-5-14-12" />
          <path d="M48 56c-5 5-8 11-9 18" strokeOpacity="0.65" />
          <path d="M72 56c5 5 8 11 9 18" strokeOpacity="0.65" />
          <circle cx="44" cy="78" r="2.5" fill={stroke} />
          <circle cx="76" cy="78" r="2.5" fill={stroke} />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M60 95S22 72 22 46a20 20 0 0 1 38-9 20 20 0 0 1 38 9c0 26-38 49-38 49Z" />
          <path d="M34 56h14l6-14 10 26 7-12h15" />
        </svg>
      );
    case 'allergies':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="60" cy="60" r="22" />
          <path d="M60 22v10M60 88v10M22 60h10M88 60h10M33 33l7 7M80 80l7 7M87 33l-7 7M40 80l-7 7" />
          <circle cx="52" cy="54" r="2" fill={stroke} />
          <circle cx="66" cy="64" r="2" fill={stroke} />
          <circle cx="63" cy="51" r="1.5" fill={stroke} />
        </svg>
      );
    case 'sinus':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M44 24c16 0 30 12 30 28v10l8 12H68v16c0 5-4 8-10 8H42" />
          <path d="M46 42c6 0 12 4 12 10s-6 10-12 10" strokeOpacity="0.8" />
          <path d="M52 68h10c4 0 6 3 6 7" strokeOpacity="0.8" />
          <circle cx="52" cy="48" r="2.5" fill={stroke} />
        </svg>
      );
    case 'cold-flu':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M60 20L90 32v24c0 22-14 36-30 44-16-8-30-22-30-44V32L60 20Z" />
          <path d="M60 44v24M48 56h24" />
          <circle cx="46" cy="42" r="2" fill={stroke} />
          <circle cx="74" cy="42" r="2" fill={stroke} />
        </svg>
      );
    case 'copd':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M60 20v30" />
          <path d="M60 48c-14 2-28 14-28 30 0 12 8 20 18 20 6 0 10-4 10-10" />
          <path d="M60 48c14 2 28 14 28 30 0 12-8 20-18 20-6 0-10-4-10-10" />
          <path d="M36 74h14M70 74h14M40 84h10M70 84h10" strokeOpacity="0.7" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M18 60s16-24 42-24 42 24 42 24-16 24-42 24-42-24-42-24Z" />
          <circle cx="60" cy="60" r="13" />
          <circle cx="60" cy="60" r="4" fill={stroke} />
          <path d="M34 32l4 5M86 32l-4 5" strokeOpacity="0.7" />
        </svg>
      );
    case 'children-elderly':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="44" cy="36" r="10" />
          <path d="M28 94V66c0-9 7-16 16-16s16 7 16 16v28" />
          <circle cx="78" cy="48" r="8" />
          <path d="M66 94V72c0-7 5-12 12-12s12 5 12 12v22" />
        </svg>
      );
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function useCountUp(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const startVal = prevRef.current;
    if (startVal === target) {
      setDisplay(target);
      return;
    }
    let rafId = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startVal + (target - startVal) * eased);
      setDisplay(next);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      prevRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}

function KochiSkylineSvg() {
  return (
    <svg
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 inset-x-0 h-20 w-full opacity-[0.12] sm:h-24"
    >
      <g fill="#011716">
        {/* Ground strip */}
        <rect x="0" y="106" width="1200" height="14" />

        {/* Left coconut palms */}
        <path d="M55 108 Q60 80 64 56 L68 57 Q64 82 60 108 Z" />
        <path d="M65 56 Q44 48 34 59 Q50 55 65 58 Z" />
        <path d="M66 56 Q52 38 40 42 Q55 46 66 56 Z" />
        <path d="M66 56 Q80 40 94 46 Q78 49 66 57 Z" />
        <path d="M67 57 Q88 53 96 64 Q80 58 66 58 Z" />

        {/* Low-rise Kakkanad residential & shops */}
        <rect x="112" y="72" width="44" height="36" rx="2" />
        <rect x="164" y="60" width="52" height="48" rx="2" />
        <polygon points="164,60 190,46 216,60" />

        {/* IT Park glass towers */}
        <rect x="248" y="34" width="54" height="74" rx="3" />
        <rect x="308" y="20" width="66" height="88" rx="4" />
        <rect x="326" y="10" width="30" height="10" rx="2" />
        <rect x="382" y="42" width="48" height="66" rx="3" />

        {/* Mid coconut palm cluster */}
        <path d="M468 108 Q473 84 477 62 L481 63 Q477 85 473 108 Z" />
        <path d="M478 62 Q458 55 449 65 Q464 60 478 63 Z" />
        <path d="M479 62 Q467 45 456 49 Q470 53 479 62 Z" />
        <path d="M479 62 Q495 46 507 52 Q492 54 479 63 Z" />

        {/* Mid commercial block */}
        <rect x="536" y="66" width="62" height="42" rx="2" />
        <rect x="606" y="50" width="56" height="58" rx="3" />
        <rect x="670" y="76" width="44" height="32" rx="2" />

        {/* SmartCity twin towers silhouette */}
        <rect x="760" y="26" width="60" height="82" rx="4" />
        <rect x="828" y="38" width="54" height="70" rx="3" />
        <rect x="890" y="58" width="46" height="50" rx="2" />

        {/* Right residential & palms */}
        <rect x="974" y="68" width="52" height="40" rx="2" />
        <polygon points="974,68 1000,54 1026,68" />
        <rect x="1038" y="78" width="40" height="30" rx="2" />

        <path d="M1116 108 Q1122 80 1126 52 L1130 53 Q1126 82 1121 108 Z" />
        <path d="M1127 52 Q1105 44 1094 55 Q1112 50 1127 54 Z" />
        <path d="M1128 52 Q1115 34 1102 38 Q1117 42 1128 52 Z" />
        <path d="M1128 52 Q1144 36 1158 43 Q1142 46 1128 53 Z" />
        <path d="M1129 53 Q1152 50 1160 61 Q1144 55 1128 54 Z" />
      </g>
    </svg>
  );
}

function PersonAirFigureSvg({ category }: { category: NaqiCategory }) {
  const isClean = category === 'Good' || category === 'Satisfactory';
  const isModerate = category === 'Moderate';
  const isPoor = category === 'Poor';
  const isSevere = category === 'Very Poor' || category === 'Severe';

  return (
    <svg
      viewBox="0 0 180 200"
      aria-label={`Person figure reflecting ${category} air quality`}
      className="h-44 w-40 shrink-0 select-none"
    >
      {/* Subtle smoke wisps on Very Poor / Severe */}
      {isSevere && (
        <g stroke="#e2e8f0" strokeOpacity="0.45" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M22 72 Q34 62 28 50 Q22 38 36 30" />
          <path d="M148 80 Q160 68 152 54 Q145 42 158 32" />
          <path d="M36 112 Q46 104 42 94" />
        </g>
      )}

      {/* Soft ground shadow */}
      <ellipse cx="90" cy="188" rx="46" ry="7" fill="#021c1b" fillOpacity="0.45" />

      {/* Mundu / lower garment (cream with traditional gold kasavu border) */}
      <path d="M58 134 L122 134 L126 184 L54 184 Z" fill="#f8fafc" />
      <rect x="54.5" y="176" width="71" height="4" fill="#d97706" fillOpacity="0.8" />

      {/* Kerala casual collared shirt */}
      <path
        d="M52 104 C52 90 66 84 90 84 C114 84 128 90 128 104 L132 138 L48 138 Z"
        fill="#14b8a6"
      />
      {/* Shirt collar & placket */}
      <path d="M77 84 L90 98 L103 84" fill="#0f766e" />
      <line x1="90" y1="98" x2="90" y2="136" stroke="#0d9488" strokeWidth="2" />

      {/* Neck */}
      <rect x="81" y="72" width="18" height="16" rx="6" fill="#c6865c" />

      {/* Ears */}
      <circle cx="63" cy="54" r="5.5" fill="#b7774f" />
      <circle cx="117" cy="54" r="5.5" fill="#b7774f" />

      {/* Head */}
      <ellipse cx="90" cy="52" rx="26" ry="28" fill="#d29268" />

      {/* Hair */}
      <path
        d="M64 46 C64 24 116 24 116 46 C113 33 100 29 90 29 C80 29 67 33 64 46 Z"
        fill="#1e293b"
      />

      {/* Eyes */}
      {isSevere ? (
        <g stroke="#1e293b" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M74 49 L83 52 L74 55" />
          <path d="M106 49 L97 52 L106 55" />
        </g>
      ) : (
        <g fill="#1e293b">
          <circle cx="79" cy="51" r="2.7" />
          <circle cx="101" cy="51" r="2.7" />
        </g>
      )}

      {/* Eyebrows */}
      <g stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none">
        {isClean ? (
          <>
            <path d="M74 43 Q79 41 84 43" />
            <path d="M96 43 Q101 41 106 43" />
          </>
        ) : (
          <>
            <path d="M74 44 L84 46" />
            <path d="M106 44 L96 46" />
          </>
        )}
      </g>

      {/* Mouth / Face Mask */}
      {isClean && (
        <path
          d="M80 63 Q90 71 100 63"
          fill="none"
          stroke="#472719"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}

      {isModerate && (
        <path
          d="M81 66 Q90 61 99 66"
          fill="none"
          stroke="#472719"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}

      {(isPoor || isSevere) && (
        <g>
          {/* Mask ear straps */}
          <line x1="64" y1="56" x2="72" y2="60" stroke="#e2e8f0" strokeWidth="1.8" />
          <line x1="116" y1="56" x2="108" y2="60" stroke="#e2e8f0" strokeWidth="1.8" />
          {/* Protective N95/surgical mask */}
          <path
            d="M71 57 Q90 54 109 57 L106 73 Q90 80 74 73 Z"
            fill="#f1f5f9"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <line x1="76" y1="64" x2="104" y2="64" stroke="#94a3b8" strokeWidth="1" />
        </g>
      )}

      {/* Left arm (resting casually at side) */}
      <path
        d="M52 102 Q42 122 46 144"
        fill="none"
        stroke="#14b8a6"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle cx="46" cy="146" r="5.5" fill="#d29268" />

      {/* Right arm posture by category */}
      {isClean && (
        <>
          <path
            d="M128 102 Q138 122 134 144"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <circle cx="134" cy="146" r="5.5" fill="#d29268" />
        </>
      )}

      {isModerate && (
        <>
          {/* Hand raised near the nose */}
          <path
            d="M128 102 Q136 86 105 64"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <circle cx="103" cy="63" r="5.5" fill="#d29268" />
        </>
      )}

      {isPoor && (
        <>
          {/* Coughing posture: fist near masked mouth + cough lines */}
          <path
            d="M128 102 Q135 88 108 68"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <circle cx="106" cy="68" r="6" fill="#d29268" />
          <g stroke="#fed7aa" strokeWidth="2" strokeLinecap="round">
            <line x1="115" y1="64" x2="123" y2="61" />
            <line x1="116" y1="70" x2="124" y2="70" />
          </g>
        </>
      )}

      {isSevere && (
        <>
          <path
            d="M128 102 Q138 122 134 144"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <circle cx="134" cy="146" r="5.5" fill="#d29268" />
        </>
      )}
    </svg>
  );
}

export function LiveConditions() {
  const { bundle, loading, fetchError, refreshNow, naqi } = useObservatory();
  const [selectedTab, setSelectedTab] = useState<ConditionId>('asthma');
  const [searchParams] = useSearchParams();

  const simulateRaw = searchParams.get('simulate');
  const simulatedAqi =
    simulateRaw !== null && simulateRaw.trim() !== '' && Number.isFinite(Number(simulateRaw))
      ? Math.max(0, Math.min(500, Math.round(Number(simulateRaw))))
      : null;

  const targetCardAqi = simulatedAqi ?? naqi?.aqi ?? 0;
  const animatedCardAqi = useCountUp(targetCardAqi);

  if (!bundle || !naqi) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-8 space-y-3">
          <div className="font-display text-lg font-bold text-white">
            {fetchError ? 'Live Air Quality Data Unavailable' : 'Loading live air quality…'}
          </div>
          <p className="text-sm text-teal-100/80">
            {fetchError ??
              'Fetching live CAMS pollutants and background weather parameters for Brahmapuram–Kakkanad.'}
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

  const nowPrefix = getNowKolkataIsoPrefix();
  const next24Air = bundle.hourlyAir
    .filter((h) => h.time >= nowPrefix)
    .slice(0, 24)
    .map((h) => ({
      hour: h.time.slice(11, 16),
      pm25: Math.round(h.pm25 * 10) / 10,
    }));

  const primaryPollutants = naqi.subIndices.filter(
    (s): s is typeof s & { pollutant: 'PM2.5' | 'PM10' | 'NO2' } =>
      s.pollutant === 'PM2.5' || s.pollutant === 'PM10' || s.pollutant === 'NO2'
  );

  const cardAqi = simulatedAqi ?? naqi.aqi;
  const cardCategory: NaqiCategory =
    simulatedAqi !== null ? classifyNaqi(simulatedAqi) : naqi.category;
  const catStyle = NAQI_CATEGORY_STYLES[cardCategory];
  const pointerPct = Math.min(99, Math.max(1, (cardAqi / 500) * 100));

  const pm25Sub = naqi.subIndices.find((s) => s.pollutant === 'PM2.5');
  const pm10Sub = naqi.subIndices.find((s) => s.pollutant === 'PM10');
  const pm25Val = pm25Sub ? pm25Sub.concentration : Math.round(bundle.currentAir.pm25 * 10) / 10;
  const pm10Val = pm10Sub ? pm10Sub.concentration : Math.round(bundle.currentAir.pm10 * 10) / 10;
  const pm25Ratio = pm25Val / 60;
  const pm10Ratio = pm10Val / 100;
  const updatedHm = bundle.lastGoodIstLabel.slice(0, 5);

  const activeCondition =
    CONDITIONS.find((c) => c.id === selectedTab) ?? CONDITIONS[0];

  const riskLevel: RiskLevel = computeDiseaseRiskLevel(
    cardCategory,
    activeCondition.isHighSensitivity
  );
  const riskTheme = RISK_STYLES[riskLevel];
  const riskTextColor =
    riskLevel === 'Low'
      ? 'text-emerald-300'
      : riskLevel === 'Moderate'
      ? 'text-amber-300'
      : riskLevel === 'High'
      ? 'text-orange-400'
      : 'text-rose-400';

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Stale cache alert if live API failed */}
      {bundle.isStaleCache && bundle.errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/50 bg-[#032423] px-4 py-3 text-xs font-mono text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{bundle.errorMessage}</span>
        </div>
      )}

      {/* 2. PAGE HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <DataStatusBadge
              type={bundle.isStaleCache ? 'ASSUMED' : 'LIVE'}
              detail={
                bundle.isStaleCache
                  ? `Last good value at ${bundle.lastGoodIstLabel} IST`
                  : `Updated ${bundle.lastGoodIstLabel} IST · 5 min poll`
              }
            />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Live Conditions — Air Quality (NAQI) & Health Risk
          </h1>
          <p className="max-w-3xl text-sm text-teal-100/80">
            Live CPCB Indian National AQI and health guidance for Brahmapuram–Kakkanad.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshNow}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-teal-400 px-4 py-2 text-xs font-bold text-[#042f2e] hover:bg-teal-300 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh now</span>
        </button>
      </header>

      {/* 4. SECTION A — LIVE AQI CARD (full width) */}
      <section
        className="relative overflow-hidden rounded-[28px] border p-6 sm:p-8 space-y-6"
        style={{
          borderColor: hexToRgba(catStyle.hex, 0.42),
          backgroundImage: `linear-gradient(180deg, ${hexToRgba(
            catStyle.hex,
            0.15
          )} 0%, ${hexToRgba(
            catStyle.hex,
            0.35
          )} 100%), linear-gradient(180deg, #063836 0%, #032423 100%)`,
        }}
      >
        {/* Faint drifting cloud shapes across the top */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-2 inset-x-0 h-20 overflow-hidden opacity-[0.07]"
        >
          <svg
            viewBox="0 0 600 80"
            className="animate-cloud-drift-slow absolute left-4 top-1 h-16 w-72 text-white"
            fill="currentColor"
          >
            <path d="M56 58 H198 C210 58 218 50 218 40 C218 30 210 22 200 22 C197 10 185 4 172 8 C164 -1 146 0 138 11 C128 6 114 11 110 22 C96 19 82 28 80 40 C68 40 56 47 56 58 Z" />
          </svg>
          <svg
            viewBox="0 0 600 80"
            className="animate-cloud-drift-reverse absolute right-8 top-4 h-14 w-64 text-white"
            fill="currentColor"
          >
            <path d="M36 54 H168 C178 54 185 47 185 38 C185 29 178 23 169 23 C165 12 153 8 142 12 C133 4 117 6 111 16 C101 13 89 19 86 28 C72 27 60 35 58 44 C47 44 36 48 36 54 Z" />
          </svg>
        </div>

        {/* Faint low-opacity Kochi-style skyline along the bottom edge */}
        <KochiSkylineSvg />

        {/* Card Foreground Content */}
        <div className="relative z-10 space-y-6">
          {/* 2. TOP ROW */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: catStyle.hex }}
                />
                <span
                  className="relative inline-flex h-3 w-3 rounded-full"
                  style={{ backgroundColor: catStyle.hex }}
                />
              </span>
              <h2 className="font-display text-lg font-bold text-white">Live AQI</h2>
              <span className="font-mono text-xs text-slate-300/75">
                (CPCB Indian National AQI · 24-h &amp; 8-h averages)
              </span>
              <DataStatusBadge
                type="MODELLED"
                formulaName="CPCB NAQI Breakpoints"
                howText="Computes piecewise linear sub-indices across PM2.5, PM10, NO2, SO2 (24-h averages) and O3, CO (8-h averages) using official CPCB 2014 Indian NAQI breakpoints. Overall AQI equals the highest pollutant sub-index."
              />
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className="text-[11px] font-medium text-teal-100/70">Air Quality is</span>
              <span
                className="inline-block rounded-full px-5 py-1.5 text-sm font-bold shadow-md"
                style={{
                  backgroundColor: catStyle.hex,
                  color: catStyle.textOnPill,
                }}
              >
                {cardCategory}
              </span>
            </div>
          </div>

          {/* 3. BIG NUMBER + 6. HEALTH MESSAGE + 7. ORIGINAL ILLUSTRATION */}
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span
                  className="font-mono text-[84px] sm:text-[120px] font-bold leading-none tabular-nums tracking-tight"
                  style={{ color: catStyle.hex }}
                >
                  {animatedCardAqi}
                </span>
                <span className="font-mono text-sm font-semibold text-teal-100/75">
                  AQI (IN)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-teal-100/85">
                <span>
                  Dominant Pollutant:{' '}
                  {naqi.isAveragesReady ? (
                    <strong className="text-white">
                      {naqi.dominantPollutant} ({naqi.dominantAveragingPeriod})
                    </strong>
                  ) : (
                    <strong className="text-amber-300 font-bold">Loading averages…</strong>
                  )}
                </span>
                <span className="text-teal-300/50">·</span>
                <span className="tabular-nums">Updated {updatedHm} IST</span>
                {simulatedAqi !== null && (
                  <>
                    <span className="text-teal-300/50">·</span>
                    <span className="text-amber-300 font-bold">
                      Simulated AQI: {simulatedAqi}
                    </span>
                  </>
                )}
              </div>

              {/* 6. HEALTH MESSAGE */}
              <p className="max-w-2xl text-sm leading-relaxed text-teal-50/95">
                {catStyle.healthMessage}
              </p>
            </div>

            {/* 7. ORIGINAL ILLUSTRATION (hidden on screens narrower than 640px) */}
            <div className="hidden sm:block shrink-0 pr-2">
              <PersonAirFigureSvg category={cardCategory} />
            </div>
          </div>

          {/* 4. POLLUTANT ROW (PM2.5 and PM10 side by side with 24-h avg and current hourly note) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* PM2.5 */}
            <div className="flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-[#032423]/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium text-slate-300/85">PM2.5 (24-h avg) :</span>
                  {naqi.isAveragesReady ? (
                    <>
                      <span className="font-mono text-lg font-bold text-white tabular-nums">
                        {pm25Val}
                      </span>
                      <span className="text-xs text-teal-100/75">µg/m³</span>
                    </>
                  ) : (
                    <span className="font-mono text-xs font-bold text-amber-300">
                      Loading averages…
                    </span>
                  )}
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                    pm25Ratio > 1.5
                      ? 'border-rose-400/65 bg-rose-500/25 text-rose-200'
                      : pm25Ratio > 1
                      ? 'border-orange-400/65 bg-orange-500/25 text-orange-200'
                      : 'border-teal-500/40 bg-[#042f2e]/85 text-teal-200'
                  }`}
                >
                  {pm25Ratio.toFixed(1)}× India limit (60)
                </span>
              </div>
              {pm25Sub && (
                <div className="font-mono text-[11px] text-teal-200/75">
                  Current hourly: {pm25Sub.currentConcentration} µg/m³
                </div>
              )}
            </div>

            {/* PM10 */}
            <div className="flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-[#032423]/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium text-slate-300/85">PM10 (24-h avg) :</span>
                  {naqi.isAveragesReady ? (
                    <>
                      <span className="font-mono text-lg font-bold text-white tabular-nums">
                        {pm10Val}
                      </span>
                      <span className="text-xs text-teal-100/75">µg/m³</span>
                    </>
                  ) : (
                    <span className="font-mono text-xs font-bold text-amber-300">
                      Loading averages…
                    </span>
                  )}
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                    pm10Ratio > 1.5
                      ? 'border-rose-400/65 bg-rose-500/25 text-rose-200'
                      : pm10Ratio > 1
                      ? 'border-orange-400/65 bg-orange-500/25 text-orange-200'
                      : 'border-teal-500/40 bg-[#042f2e]/85 text-teal-200'
                  }`}
                >
                  {pm10Ratio.toFixed(1)}× India limit (100)
                </span>
              </div>
              {pm10Sub && (
                <div className="font-mono text-[11px] text-teal-200/75">
                  Current hourly: {pm10Sub.currentConcentration} µg/m³
                </div>
              )}
            </div>
          </div>

          {/* 5. COLOUR SCALE BAR */}
          <div className="space-y-2 pt-1">
            {/* Category names above each segment */}
            <div className="flex w-full items-end text-[10px] sm:text-xs">
              {NAQI_SCALE_SEGMENTS.map((seg) => {
                const active = seg.label === cardCategory;
                return (
                  <div
                    key={seg.label}
                    style={{ width: `${seg.widthPct}%` }}
                    className={`truncate text-center px-0.5 transition-colors ${
                      active ? 'font-bold text-white' : 'font-normal text-teal-100/55'
                    }`}
                  >
                    {seg.label}
                  </div>
                );
              })}
            </div>

            {/* 6-colour bar + smooth white circular pointer with coloured ring */}
            <div className="relative py-1">
              <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-black/30">
                {NAQI_SCALE_SEGMENTS.map((seg) => (
                  <div
                    key={seg.label}
                    title={`${seg.label} (${seg.range})`}
                    style={{
                      width: `${seg.widthPct}%`,
                      backgroundColor: seg.hex,
                    }}
                  />
                ))}
              </div>

              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg transition-[left] duration-700 ease-out"
                style={{
                  left: `${pointerPct}%`,
                  border: `3.5px solid ${catStyle.hex}`,
                }}
              />
            </div>

            {/* Numbers below: 0, 50, 100, 200, 300, 400, 500 */}
            <div className="relative h-5 font-mono text-[11px] text-teal-100/80 tabular-nums">
              <span className="absolute left-0">0</span>
              <span className="absolute left-[10%] -translate-x-1/2">50</span>
              <span className="absolute left-[20%] -translate-x-1/2">100</span>
              <span className="absolute left-[40%] -translate-x-1/2">200</span>
              <span className="absolute left-[60%] -translate-x-1/2">300</span>
              <span className="absolute left-[80%] -translate-x-1/2">400</span>
              <span className="absolute right-0">500</span>
            </div>
          </div>

          {/* Yellow disclosure note */}
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/35 bg-[#032423]/85 px-3.5 py-2.5 text-xs text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Modelled (hourly CAMS satellite/atmospheric model) — not a CPCB ground station.
            </span>
          </div>
        </div>
      </section>

      {/* 5. SECTION B — POLLUTANT DETAILS (all 6 sub-indices with 24-h / 8-h avg and current hourly note) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* Left: Pollutant bars with averaging periods and current hourly notes */}
        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-1 border-b border-teal-800/60 pb-3">
            <h2 className="font-display text-lg font-bold text-white">
              Pollutant Sub-Indices & Limits
            </h2>
            <p className="text-xs text-teal-100/75">
              CPCB averaging: PM₂.₅, PM₁₀, NO₂, SO₂ (24-h avg) · O₃, CO (8-h avg). Amber line marks CPCB limit.
            </p>
          </div>

          <div className="space-y-4">
            {naqi.subIndices.map((p) => {
              const limit = p.naaqsLimit ?? 100;
              const scaleMax = limit * 1.5;
              const fillPct = Math.min(100, Math.round((p.concentration / scaleMax) * 100));
              const limitMarkerPct = Math.round((limit / scaleMax) * 100);
              const exceeds = p.concentration > limit;

              return (
                <div key={p.pollutant} className="space-y-1.5 rounded-lg border border-teal-800/50 bg-[#032423]/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">
                        {p.label} ({p.averagingPeriod})
                      </span>
                      <span className="rounded border border-teal-600/60 bg-[#042f2e] px-2 py-0.5 text-[11px] font-semibold text-teal-200">
                        Sub-index {p.subIndex}
                      </span>
                    </div>
                    <span className={exceeds ? 'text-rose-400 font-bold' : 'text-teal-200'}>
                      {p.concentration} {p.unit} · Limit {limit} {p.unit}
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#042f2e]">
                    <div
                      className={`h-full ${exceeds ? 'bg-rose-500' : 'bg-teal-400'}`}
                      style={{ width: `${fillPct}%` }}
                    />
                    <div
                      title={`CPCB Limit: ${limit} ${p.unit}`}
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-300"
                      style={{ left: `${limitMarkerPct}%` }}
                    />
                  </div>
                  <div className="font-mono text-[11px] text-teal-200/70">
                    Current hourly: {p.currentConcentration} {p.unit}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="font-mono text-[11px] text-teal-200/70 border-t border-teal-800/60 pt-3">
            CPCB NAQI = highest sub-index · Breakpoints applied to 24-h &amp; 8-h moving averages.
          </div>
        </div>

        {/* Right: 24-Hour CAMS PM2.5 chart with dashed line at 60 µg/m³ */}
        <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
          <div className="border-b border-teal-800/60 pb-3">
            <h2 className="font-display text-lg font-bold text-white">
              24-Hour CAMS PM₂.₅ Trajectory (µg/m³)
            </h2>
            <p className="text-xs text-teal-100/75">
              Dashed amber line indicates the 60 µg/m³ CPCB 24-h NAAQS limit.
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={next24Air} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f524e" />
                <XAxis dataKey="hour" tick={{ fill: '#99f6e4', fontSize: 10 }} interval={5} />
                <YAxis
                  domain={[0, (dataMax: number) => Math.max(70, Math.ceil(dataMax * 1.15))]}
                  tick={{ fill: '#99f6e4', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#032423',
                    borderColor: '#14b8a6',
                    fontSize: '12px',
                    color: '#ecfdf5',
                  }}
                />
                <ReferenceLine
                  y={60}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  label={{
                    value: '60 µg/m³ NAAQS',
                    position: 'insideTopRight',
                    fill: '#fcd34d',
                    fontSize: 10,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pm25"
                  name="PM₂.₅ (µg/m³)"
                  stroke="#2dd4bf"
                  fill="#2dd4bf"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* AI explanation of live air quality (Gemini) */}
      <AiInsight page="live" />

      {/* 6. SECTION C — "Prevent Health Problems: Understand Your Risks" */}
      <section className="rounded-xl border border-teal-800/70 bg-[#063836] p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-white">
            Prevent Health Problems: Understand Your Risks
          </h2>
          <p className="font-mono text-xs text-teal-200/85 tabular-nums">
            Kakkanad · based on live AQI {cardAqi} ({cardCategory})
          </p>
        </div>

        {/* 8 pill tabs (horizontally scrollable on mobile) */}
        <div
          role="tablist"
          aria-label="Health Risk Categories"
          className="flex items-center gap-2 overflow-x-auto pb-2"
        >
          {CONDITIONS.map((cond) => {
            const Icon = cond.icon;
            const active = cond.id === activeCondition.id;
            return (
              <button
                key={cond.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSelectedTab(cond.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'border-teal-300 bg-teal-400 text-[#042f2e]'
                    : 'border-teal-700/80 bg-[#032423] text-teal-100/85 hover:border-teal-400/70 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{cond.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Selected tab two-column card */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: Original line-art illustration + risk pill + 4-step meter */}
          <div
            className={`flex flex-col justify-between rounded-xl border p-6 lg:col-span-4 space-y-6 ${riskTheme.panelBgClass}`}
          >
            <div className="space-y-4 text-center">
              <div>
                <span
                  className={`inline-block rounded-full border px-3.5 py-1 font-mono text-xs font-bold ${riskTheme.pillClass}`}
                >
                  {riskLevel} risk of {activeCondition.riskTargetPhrase}
                </span>
              </div>

              <div className="py-3">
                <ConditionIllustration id={activeCondition.id} stroke={riskTheme.strokeHex} />
              </div>
            </div>

            {/* 4-step risk meter (text labels + colour) */}
            <div className="space-y-2 border-t border-teal-800/50 pt-4">
              <div className="flex items-center justify-between font-mono text-[11px] text-teal-200/80">
                <span>Symptom Risk Level</span>
                <span className="font-bold text-white">{riskLevel}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {RISK_LEVELS.map((step) => {
                  const isCurrent = step === riskLevel;
                  return (
                    <div
                      key={step}
                      className={`rounded-md border px-1.5 py-1.5 text-center font-mono text-[10px] font-bold transition-colors ${
                        isCurrent
                          ? `${riskTheme.stepBgClass} border-white/60`
                          : 'border-teal-800/80 bg-[#032423]/80 text-teal-200/60'
                      }`}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Condition details, Do's/Don'ts, Doctor threshold & Disclaimer */}
          <div className="flex flex-col justify-between rounded-xl border border-teal-800/70 bg-[#032423] p-6 lg:col-span-8 space-y-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  {activeCondition.title}
                </h3>
                <p className="mt-1 text-xs text-teal-100/80">
                  <span className="font-semibold text-teal-300">What it is: </span>
                  {activeCondition.whatItIs}
                </p>
              </div>

              <div className="rounded-lg border border-teal-800/70 bg-[#063836] px-4 py-3 text-sm leading-relaxed text-teal-100/90">
                Risk of <span className="font-bold text-white">{activeCondition.title}</span>{' '}
                symptoms is <span className={`font-bold ${riskTextColor}`}>{riskLevel}</span> at live
                AQI <span className="font-bold text-white">{cardAqi} ({cardCategory})</span>.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-teal-800/60 bg-[#042f2e] p-3.5 space-y-1 text-xs">
                  <div className="font-mono font-bold text-teal-300">
                    {activeCondition.affectHeading}
                  </div>
                  <p className="leading-relaxed text-teal-100/85">
                    {activeCondition.howPollutionAffects}
                  </p>
                </div>

                <div className="rounded-lg border border-teal-800/60 bg-[#042f2e] p-3.5 space-y-1 text-xs">
                  <div className="font-mono font-bold text-amber-300">What may happen</div>
                  <p className="leading-relaxed text-teal-100/85">
                    {activeCondition.whatMayHappen}
                  </p>
                </div>
              </div>

              {/* Do's and Don'ts */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/30 bg-[#042f2e] p-4 space-y-2">
                  <div className="font-mono text-xs font-bold text-emerald-300">Do&apos;s</div>
                  <ul className="space-y-1.5 text-xs text-teal-50/90">
                    {activeCondition.dos.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-rose-500/30 bg-[#042f2e] p-4 space-y-2">
                  <div className="font-mono text-xs font-bold text-rose-300">Don&apos;ts</div>
                  <ul className="space-y-1.5 text-xs text-teal-50/90">
                    {activeCondition.donts.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* When to see a doctor */}
              <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
                <span className="font-bold text-amber-300">{activeCondition.doctorLabel}: </span>
                {activeCondition.seeDoctorIf}
              </div>
            </div>

            {/* Footer disclaimer on every tab */}
            <div className="flex items-center gap-2 border-t border-teal-800/60 pt-3 text-[11px] text-teal-200/75">
              <Activity className="h-3.5 w-3.5 shrink-0 text-teal-300" />
              <span>
                General awareness information, not medical advice. Follow your doctor&apos;s
                instructions.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
