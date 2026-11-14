// netlify/functions/ask.mjs
// The "Ask AI" helper's server side. It runs on Netlify, not in the browser, so the
// OpenRouter key stays secret: it lives in the Netlify environment variable
// OPENROUTER_API_KEY and is never sent to the page or saved in this repo.
//
// The page sends: { results: "<text copy of what the page shows>", history: [...], question: "..." }
// This function adds the helper's rules, asks a free AI model on OpenRouter, and returns { answer }.
// It never scores anything. Scores come from the fixed rules in js/scoring.js.

// Free models on OpenRouter, tried in order. If one is busy, OpenRouter tries the next.
// They change over time; set OPENROUTER_MODEL in Netlify to override the first choice.
const MODELS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free',
];

// Limits so the public endpoint can't be used for long, expensive requests.
const MAX_QUESTION = 300;      // characters
const MAX_RESULTS = 20000;     // characters of page text
const MAX_HISTORY = 8;         // earlier messages kept in the conversation
const MAX_ANSWER_TOKENS = 400;

// What the helper is told before every conversation. It keeps the helper inside our rules.
const HELPER_RULES = `You help a farmer read the results of the Field Shift Rotation Explorer, a rule-based tool
that compares three crop rotations for one field using NASA POWER weather data, MODIS greenness data,
USDA soil survey data and a crop-traits table.
Rules you must follow:
- Use only the facts in the RESULTS block. If the answer is not there, say you don't know and suggest
  asking a local extension agent.
- Never tell the farmer what to plant. Say what the results show and what is worth checking locally.
- Never invent numbers, yields, prices or crop facts. Never change or recompute the scores.
- The scores come from fixed, written rules, not from AI, and they have not been tested against real farm
  results. Never call them predictions, proven or scientifically validated.
- Never say how many tons of soil a field loses. The tool uses the RUSLE factors only as risk indicators.
- Use plain words and short sentences. Explain any technical term in one sentence.
- Use US units first (°F, inches).
- Keep answers under 120 words. Plain text only, no markdown.`;

const reply = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

// Only answer requests sent by our own page (same site), or from local testing.
function fromOurSite(req) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = new URL(origin).host;
  return host === req.headers.get('host') || host.startsWith('localhost:') || host === 'localhost';
}

export default async req => {
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  if (!fromOurSite(req)) return reply(403, { error: 'Requests must come from the Field Shift site.' });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return reply(503, { error: 'not-set-up' });

  let body;
  try { body = await req.json(); } catch { return reply(400, { error: 'Bad request.' }); }
  const question = String(body.question || '').trim().slice(0, MAX_QUESTION);
  const results = String(body.results || '').slice(0, MAX_RESULTS);
  if (!question || !results) return reply(400, { error: 'Missing question or results.' });

  // Earlier turns of this chat, so follow-up questions make sense. Only plain user/assistant text.
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const models = process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL, ...MODELS] : MODELS;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'x-title': 'Field Shift Rotation Explorer',
      },
      body: JSON.stringify({
        models,
        max_tokens: MAX_ANSWER_TOKENS,
        temperature: 0.3,
        messages: [
          { role: 'system', content: `${HELPER_RULES}\n\nRESULTS:\n${results}` },
          ...history,
          { role: 'user', content: question },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('OpenRouter error', res.status, JSON.stringify(data).slice(0, 500));
      return reply(res.status === 429 ? 429 : 502, { error: res.status === 429 ? 'busy' : 'ai-error' });
    }
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) return reply(502, { error: 'ai-error' });
    return reply(200, { answer, model: data.model });
  } catch (err) {
    console.error('OpenRouter request failed', err);
    return reply(502, { error: 'ai-error' });
  }
};
