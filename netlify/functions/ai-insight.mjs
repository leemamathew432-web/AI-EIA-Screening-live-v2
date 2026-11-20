// "AI explains this page" — Netlify Function (server side).
// Uses the Netlify environment variable GEMINI_API_KEY (never sent to the browser).
// URL: /.netlify/functions/ai-insight   POST { page, facts: string[] }

const MODEL = (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest').trim();
const CACHE_MS = 30 * 60 * 1000; // same page + same numbers within 30 min -> reuse answer
const LIMIT_PER_HOUR = 20; // per visitor IP, all pages together

const PAGES = {
  live: {
    name: 'Live Conditions (CPCB Indian National AQI)',
    ask: '1) what the AQI number and category mean for people, 2) which pollutant matters most and why, 3) who should be careful (children, elderly, asthma), 4) one practical advice.',
  },
  'I-1': {
    name: 'I-1 Plume Trajectory (Gaussian plume from the Brahmapuram dumpsite)',
    ask: '1) which way the smoke is going and how fast, 2) which places are in the plume and how soon smoke reaches them, 3) what the stability class means in simple words, 4) one practical advice for the affected places.',
  },
  'I-2': {
    name: 'I-2 Night Inversion (trap score and ridge-regression inversion probability)',
    ask: '1) what an inversion / trapping means in simple words, 2) when tonight the risk is highest and how high, 3) how confident the model is, 4) one practical advice (e.g. timing of outdoor activity).',
  },
  'I-3': {
    name: 'I-3 River Oxygen Sag (Streeter-Phelps model of the Kadambrayar River)',
    ask: '1) how rain washes leachate into the river, 2) what the lowest dissolved oxygen value means for fish and water life, 3) where along the river it happens, 4) note that some inputs are assumed, not measured.',
  },
  'I-4': {
    name: 'I-4 Biomining Recovery (published progress of legacy waste removal)',
    ask: '1) how much legacy waste has been cleared and how much remains, 2) how progress changed over the dates, 3) why biomining matters for fire and air risk, 4) note that the figures are published reports, not live sensors.',
  },
  eia: {
    name: 'EIA Impact Matrix (weighted screening verdict)',
    ask: '1) what the overall verdict and score mean, 2) which components drive it and why, 3) which components have no data, 4) the most important action suggested by the verdict.',
  },
};

let cache = new Map();
const hits = new Map();

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY is not set in Netlify.' });

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= LIMIT_PER_HOUR) return json(429, { error: 'Too many requests. Try again later.' });
  list.push(now);
  hits.set(ip, list);

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Bad JSON' });
  }
  const page = PAGES[body?.page];
  if (!page) return json(400, { error: 'Unknown page' });
  if (!Array.isArray(body.facts) || body.facts.length === 0) return json(400, { error: 'No facts' });

  const facts = body.facts
    .slice(0, 20)
    .map((f) => String(f ?? '').replace(/[\r\n]+/g, ' ').slice(0, 220))
    .join('\n');

  const key = body.page + '|' + facts;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return json(200, { text: hit.text, model: MODEL, cached: true });

  const prompt = `You explain one page of the AI-EIA Screening website (Brahmapuram dumpsite, Kakkanad, Kadambrayar River, Kochi, India) to the general public.
Page: ${page.name}
Use ONLY the facts below. Do not invent or change any number, place name, score or verdict.
Write 4 bullet points in simple English, max 25 words each, each starting with "* ", covering:
${page.ask}
End with this exact line: Screening-level estimate, not an official CPCB/KSPCB report.

FACTS:
${facts}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
      },
    );
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `Gemini error ${r.status}`;
      return json(r.status === 429 ? 429 : 502, { error: msg });
    }
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();
    if (!text) return json(502, { error: 'Empty reply from Gemini' });
    if (cache.size > 50) cache = new Map();
    cache.set(key, { text, at: now });
    return json(200, { text, model: MODEL, cached: false });
  } catch {
    return json(502, { error: 'Could not reach Gemini' });
  }
};
