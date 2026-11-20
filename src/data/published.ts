export interface BiominingMilestone {
  id: string;
  dateLabel: string;
  isoDate: string;
  percentBiomined: number;
  wasteTreatedNote: string;
  reclaimedAcres: number;
  summary: string;
  sourceName: string;
  publishedDate: string;
  url: string;
  secondarySourceName?: string;
  secondaryUrl?: string;
}

export const BIOMINING_LAST_VERIFIED = '03 Feb 2025';
export const BASELINE_VOLUME_LABEL = '~5.5 lakh m³';
export const CONTRACT_VALUE_CRORE = 118;
export const CONTRACT_VENDOR = 'Bhumi Green Energy';

export const BIOMINING_MILESTONES: BiominingMilestone[] = [
  {
    id: 'm1-fire',
    dateLabel: '02 Mar 2023',
    isoDate: '2023-03-02',
    percentBiomined: 0,
    wasteTreatedNote: '0% biomined (baseline ~5.5 lakh m³ legacy mound)',
    reclaimedAcres: 0,
    summary: 'Major 12-day legacy-waste fire across the Brahmapuram dumpsite mound.',
    sourceName: 'The Hindu',
    publishedDate: '20 Mar 2023',
    url: 'https://www.thehindu.com/opinion/op-ed/kochis-brahmapuram-a-dump-fire-that-raises-a-stink/article66638572.ece',
  },
  {
    id: 'm2-contract',
    dateLabel: '15 Nov 2023',
    isoDate: '2023-11-15',
    percentBiomined: 0,
    wasteTreatedNote: '₹118 crore remediation contract awarded',
    reclaimedAcres: 0,
    summary:
      'Kochi Municipal Corporation signs ₹118 crore legacy-waste biomining agreement with Bhumi Green Energy.',
    sourceName: 'ThePrint',
    publishedDate: '15 Nov 2023',
    url: 'https://theprint.in/india/kochi-corp-signs-agreement-with-firm-for-biomining-legacy-waste-at-brahmapuram/1845112/',
  },
  {
    id: 'm3-midterm',
    dateLabel: '15 Jun 2024',
    isoDate: '2024-06-15',
    percentBiomined: 40,
    wasteTreatedNote: '~40%–50% treated (≈ 2.93 lakh MT); 11 acres emptied',
    reclaimedAcres: 11,
    summary:
      'Bhumi Green Energy reports mid-term trommel screening milestone across Brahmapuram legacy-waste cells.',
    sourceName: 'The Hindu',
    publishedDate: '15 Jun 2024',
    url: 'https://www.thehindu.com/news/national/kerala/biomining-of-50-of-legacy-waste-at-brahmapuram-completed-claims-firm/article68294174.ece',
  },
  {
    id: 'm4-latest',
    dateLabel: '03 Feb 2025',
    isoDate: '2025-02-03',
    percentBiomined: 75,
    wasteTreatedNote: '~75% biomining complete; 18 acres reclaimed',
    reclaimedAcres: 18,
    summary:
      '75% of legacy waste biomined with 18 acres reclaimed across the Brahmapuram site.',
    sourceName: 'Times of India',
    publishedDate: '03 Feb 2025',
    url: 'https://timesofindia.indiatimes.com/city/kochi/75-biomining-of-legacy-waste-completed-at-brahmapuram/articleshow/117894122.cms',
    secondarySourceName: 'Onmanorama',
    secondaryUrl:
      'https://www.onmanorama.com/news/kerala/2025/02/03/brahmapura-waste-dumping-yard-to-have-a-makeover.html',
  },
];

export interface TrommelMaterialStream {
  stream: string;
  sharePct: number;
  destination: string;
}

// Illustrative municipal trommel material off-take split (no Brahmapuram-specific fraction breakdown published)
export const TROMMEL_OFFTAKE: TrommelMaterialStream[] = [
  { stream: 'Bio-Soil / Fine Compost', sharePct: 46, destination: 'Site grading & soil cover' },
  { stream: 'Refuse Derived Fuel (RDF)', sharePct: 28, destination: 'Cement kiln co-processing' },
  { stream: 'Inert Fractions', sharePct: 21, destination: 'Engineered inert fill' },
  { stream: 'Recyclables (Metals / Plastics)', sharePct: 5, destination: 'Authorized recyclers' },
];

export interface RegistrySource {
  id: string;
  name: string;
  type: 'LIVE' | 'MODELLED' | 'PUBLISHED';
  parameters: string;
  cadence: string;
  notes: string;
  url: string;
}

export const MASTER_DATA_SOURCES: RegistrySource[] = [
  {
    id: 'open-meteo-forecast',
    name: 'Open-Meteo Weather Forecast API',
    type: 'LIVE',
    parameters:
      'temperature_2m, temperature_80m/120m/180m, relative_humidity_2m, wind_speed_10m (m/s), wind_direction_10m, cloud_cover, precipitation, shortwave_radiation, boundary_layer_height (past 14d + 48h)',
    cadence: '5-minute poll (Asia/Kolkata)',
    notes: 'Free keyless REST endpoint supplying 14-day unmodified nocturnal history and live boundary-layer telemetry.',
    url: 'https://open-meteo.com/en/docs',
  },
  {
    id: 'open-meteo-aq',
    name: 'Open-Meteo Air Quality API (CAMS)',
    type: 'MODELLED',
    parameters: 'pm2_5, pm10, nitrogen_dioxide, sulphur_dioxide, ozone, carbon_monoxide',
    cadence: 'Hourly CAMS model (5-min poll)',
    notes: 'CAMS global atmospheric reanalysis/forecast model — not a physical CPCB ground monitoring station.',
    url: 'https://open-meteo.com/en/docs/air-quality-api',
  },
  {
    id: 'cpcb-naqi',
    name: 'PIB / MoEFCC — National Air Quality Index (NAQI 2014)',
    type: 'PUBLISHED',
    parameters: '24-h NAAQS limits (PM2.5 60, PM10 100, NO2 80 µg/m³) & 0–500 breakpoint interpolation',
    cadence: 'Statutory Standard',
    notes: 'Official Press Information Bureau (Govt. of India) release on CPCB NAQI categories and breakpoints.',
    url: 'https://www.pib.gov.in/newsite/printrelease.aspx?relid=110654&reg=48&lang=2',
  },
  {
    id: 'hindu-2023',
    name: 'The Hindu — Brahmapuram Fire Aftermath',
    type: 'PUBLISHED',
    parameters: '02 Mar 2023 12-day legacy-waste fire baseline (~5.5 lakh m³)',
    cadence: 'Published 20 Mar 2023',
    notes: 'Dated baseline event reference for Observation I-4.',
    url: 'https://www.thehindu.com/opinion/op-ed/kochis-brahmapuram-a-dump-fire-that-raises-a-stink/article66638572.ece',
  },
  {
    id: 'theprint-2023',
    name: 'ThePrint (Nov 2023) — ₹118 crore Bhumi Green Energy contract',
    type: 'PUBLISHED',
    parameters: '₹118 crore legacy-waste biomining agreement with Bhumi Green Energy (Nov 2023)',
    cadence: 'Published 15 Nov 2023',
    notes: 'Kochi Municipal Corporation signs agreement with Bhumi Green Energy for biomining legacy waste.',
    url: 'https://theprint.in/india/kochi-corp-signs-agreement-with-firm-for-biomining-legacy-waste-at-brahmapuram/1845112/',
  },
  {
    id: 'hindu-2024',
    name: 'The Hindu — Brahmapuram Biomining Progress',
    type: 'PUBLISHED',
    parameters: 'Bhumi Green Energy mid-term biomining status (~40%–50% / 2.93 lakh MT)',
    cadence: 'Published 15 Jun 2024',
    notes: 'Dated mid-term remediation verification for Observation I-4.',
    url: 'https://www.thehindu.com/news/national/kerala/biomining-of-50-of-legacy-waste-at-brahmapuram-completed-claims-firm/article68294174.ece',
  },
  {
    id: 'toi-onmanorama-2025',
    name: 'Times of India & Onmanorama — 75% Biomining Milestone',
    type: 'PUBLISHED',
    parameters: '~75% legacy waste biomined; 18 acres reclaimed (03 Feb 2025)',
    cadence: 'Published 03 Feb 2025',
    notes: 'Latest verified remediation benchmark used in Observation I-4.',
    url: 'https://timesofindia.indiatimes.com/city/kochi/75-biomining-of-legacy-waste-completed-at-brahmapuram/articleshow/117894122.cms',
  },
];
