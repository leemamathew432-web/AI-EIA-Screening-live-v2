// AI Daily Summary — Netlify Function (server side).
// The Gemini key is read from the Netlify environment variable GEMINI_API_KEY.
// It is never sent to the browser.
// URL: /.netlify/functions/daily-summary   (POST, JSON body = live facts from the dashboard)

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const CACHE_MS = 30 * 60 * 1000; // reuse a summary for 30 min to save free-tier quota
const LIMIT_PER_HOUR = 10; // per visitor IP

let cache = { key: '', text: '', at: 0 };
const hits = new Map();

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function clean(v, max = 120) {
  return String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY is not set in Netlify.' });

  // Simple per-IP limit
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= LIMIT_PER_HOUR) return json(429, { error: 'Too many requests. Try again later.' });
  list.push(now);
  hits.set(ip, list);

  let f;
  try {
    f = await req.json();
  } catch {
    return json(400, { error: 'Bad JSON' });
  }

  const facts = [
    `Time (IST): ${clean(f.timeIst)}`,
    `CPCB NAQI: ${clean(f.aqi)} (${clean(f.aqiCategory)}), prominent pollutant ${clean(f.dominantPollutant)} (${clean(f.averaging)})`,
    `Wind: ${clean(f.windKmh)} km/h from ${clean(f.windFromDeg)} deg, plume heading ${clean(f.downwindCompass)}, Pasquill class ${clean(f.stabilityClass)} (${clean(f.stabilityDescription)})`,
    `Receptors in plume: ${clean(f.receptorsInPlume, 300) || 'none'}`,
    `Tonight peak trap score: ${clean(f.peakTrapScore)}/100 (${clean(f.peakTrapTier)}) at ${clean(f.peakTrapHour)} IST`,
    `Kadambrayar river critical minimum DO: ${clean(f.minDo)} mg/L (${clean(f.riverStatus)})`,
    `EIA screening verdict: ${clean(f.verdict)}, score ${clean(f.overallScore)} / 4, driven by ${clean(f.drivers, 200)}`,
  ].join('\n');

  // Same facts within 30 min -> return the cached summary (no Gemini call)
  const key = facts.replace(/^Time.*\n/, '');
  if (cache.key === key && now - cache.at < CACHE_MS) {
    return json(200, { summary: cache.text, model: MODEL, cached: true });
  }

  const prompt = `You are writing a short public summary for the AI-EIA Screening website (Brahmapuram dumpsite, Kakkanad, Kadambrayar River, Kochi).
Use ONLY the facts below. Do not invent numbers. Do not change the verdict.
Write 4 short bullet points in simple English (max 20 words each):
1) air quality now, 2) where the smoke/plume is going and who is affected, 3) tonight's trapping risk, 4) one practical advice for residents.
End with: "Screening-level estimate, not an official CPCB/KSPCB report."

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
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
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
    cache = { key, text, at: now };
    return json(200, { summary: text, model: MODEL, cached: false });
  } catch (e) {
    return json(502, { error: 'Could not reach Gemini' });
  }
};
