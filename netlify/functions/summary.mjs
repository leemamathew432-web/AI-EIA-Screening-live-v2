// AI Daily Summary — Netlify Function (server side, free Google Gemini API).
// The key is read from the Netlify environment variable GEMINI_API_KEY and never sent to the browser.
// URL: /.netlify/functions/summary   POST { language: "en" | "ml", liveData: {...} }

const SYSTEM_TEXT = `You write a short public summary for the AI-EIA Screening portal (Brahmapuram dumpsite, Kakkanad, Kadambrayar River, Kochi).
Use ONLY the numbers in LIVE DATA; never invent or change values. Write exactly 4 short bullet points, max 90 words total,
simple language for residents. Start with 'As of HH:MM IST' using the time in LIVE DATA.
1) Air quality now (AQI value, category, main pollutant) and who should take care.
2) Where the dumpsite smoke is heading and which places are affected (or 'no place directly affected').
3) Tonight's smog-trap risk with peak time and one simple precaution.
4) River oxygen status and the overall EIA screening verdict.
No medical diagnosis. This is a screening tool, not an official alert.`;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json(400, { error: 'Use POST.' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  const language = body?.language;
  if ((language !== 'en' && language !== 'ml') || !body?.liveData || typeof body.liveData !== 'object') {
    return json(400, { error: 'Invalid request.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'AI summary is not configured yet.' });

  // Default kept to the model already confirmed working on this site.
  const model = (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest').trim();
  const liveData = JSON.stringify(body.liveData).slice(0, 8000);

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_TEXT }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    'LIVE DATA:\n' +
                    liveData +
                    '\n\nWrite the summary in ' +
                    (language === 'ml' ? 'Malayalam' : 'English') +
                    '.',
                },
              ],
            },
          ],
          // Malayalam script uses more tokens than English, so allow a little more room for it.
          generationConfig: { maxOutputTokens: language === 'ml' ? 700 : 350, temperature: 0.3 },
        }),
      },
    );

    if (r.status === 429) {
      return json(429, { error: 'Free AI limit reached for today. Please try again tomorrow.' });
    }
    if (!r.ok) {
      return json(502, { error: 'AI summary is unavailable right now. Please try again.' });
    }
    const data = await r.json();
    const summary = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();
    if (!summary) return json(502, { error: 'AI summary is unavailable right now. Please try again.' });
    return json(200, { summary, model });
  } catch {
    return json(502, { error: 'AI summary is unavailable right now. Please try again.' });
  }
};
