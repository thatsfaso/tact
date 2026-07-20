/**
 * Tact story proxy — Cloudflare Worker
 *
 * Keeps API keys out of the browser. The site is a static page, so it cannot
 * hold a secret; this Worker is the only piece that can. It accepts a one-line
 * story idea and returns story prose, nothing else.
 *
 * Story generation is a chain of providers, tried in order. Groq answers in
 * about a second; Agnes is the fallback when Groq is missing or refuses; and if
 * the whole Worker fails, the page itself falls back to its in-browser model
 * and then to the reader's own words. No single service can take the site down.
 *
 * Deliberate design choices:
 *  - The system prompt lives HERE, not in the request. A caller can only ever
 *    ask for a children's story, so the proxy cannot be repurposed as a general
 *    purpose language model by whoever finds the URL.
 *  - Requests are accepted only from the site's own origins.
 *  - Rate limiting (HTTP 429) from every provider is passed through as `busy`
 *    so the page can fall back to in-browser generation instead of failing.
 *
 * Secrets: set each with `npx wrangler secret put <NAME>`.
 *   GROQ_API_KEY   — from console.groq.com (free)
 *   AGNES_API_KEY  — from agnes-ai.com (free)
 * A provider whose key is missing is simply skipped.
 *
 * Deploy: see worker/README.md
 */

const ALLOWED_ORIGINS = [
  'https://tactbraille.com',
  'https://www.tactbraille.com',
  'https://thatsfaso.github.io',
  'http://localhost:8080',
];

// Providers in order of preference. Groq first: llama-3.3-70b-versatile is a
// production model on their free tier and generates a whole story in about a
// second. Agnes second: free as well, but its inference latency has been seen
// swinging from eight seconds to timeouts, which is what motivated the chain.
// Timeouts are per provider: a short leash for the fast one, a long leash for
// the slow one, because waiting on Agnes still beats a 1.8 GB model download.
function providers(env) {
  return [
    {
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.3-70b-versatile',
      key: env.GROQ_API_KEY,
      timeoutMs: 12000,
    },
    {
      name: 'agnes',
      url: 'https://apihub.agnes-ai.com/v1/chat/completions',
      model: 'agnes-2.0-flash',
      key: env.AGNES_API_KEY,
      timeoutMs: 40000,
    },
  ].filter(function (p) { return !!p.key; });
}

// The page holds a fixed number of Braille CELLS, and Italian words are longer
// than English ones, so the same word count fills a different amount of page.
// Measured against the real paginator: about 65 Italian words, or 75 English
// words, fill the two pages without spilling onto a third.
const WORD_TARGET = { Italian: '55', English: '62' };
// Hard ceiling: past this the story spills onto a third, mostly empty page.
const CAP = { Italian: '64', English: '72' };
// Italian needs about 67 words to fill two cards, English about 76, and both
// read best near ten words a sentence — so each language gets its own count.
const SENTENCES = { Italian: 'SIX or SEVEN', English: 'SEVEN or EIGHT' };
const SENT_MAX = { Italian: 'seven', English: 'eight' };

// targetWords, when supplied, overrides the language default. The page owns the
// only accurate measure of how much text fits, so it can measure a first story
// and ask for a second one of the exact length that fills the pages.
function buildSystemPrompt(language, targetWords) {
  const wanted = Number(targetWords) || Number(WORD_TARGET[language]) || 80;
  const target = String(Math.max(45, wanted));
  return (
    "You are a beloved children's picture-book author writing for young blind children who will read your words in Braille. Your stories are warm, vivid, and gently magical.\n\n" +
    "Write a complete little story from the user's idea. Craft it with care:\n" +
    '- Give it a clear arc: a calm beginning, a small wish or problem, a turn, and a warm, satisfying ending.\n' +
    '- Use rich SENSORY detail a blind child can feel: textures, sounds, warmth, smell, movement. Favour touch and sound over colour and sight.\n' +
    '- Use concrete, simple words a 6-year-old knows.\n' +
    '- Write about ' + target + ' words as ' + (SENTENCES[language] || 'SIX or SEVEN') + ' sentences in total. Never more than ' + (SENT_MAX[language] || 'seven') + '.\n' +
    '- HARD LIMIT: the whole story must stay under ' + (targetWords ? (Number(targetWords) + 6) : CAP[language]) + ' words. Going over ruins the printed page, so count as you write and stop before the limit.\n' +
    '- Most sentences should run eight to fourteen words, joining ideas with words like and, but, so, until, while, because. Let one or two be short for rhythm. Never write a chain of tiny three or four word sentences.\n' +
    '- Give it a gentle rhythm; you may softly repeat a kind phrase.\n\n' +
    'Output ONLY the story prose: no title, no quotation marks, no notes, no markdown. Write in the SAME language as the request.\n\n' +
    'Match the length, rhythm and sentence count of this example (English):\n' +
    'The little snail woke to cool dew along her shell. Today, she decided, she would climb the tall leaf that swayed above her. Slowly, slowly she began, her soft belly feeling every bump of the green stem. Birds sang somewhere warm and near. The wind pushed against her, and she held on tighter until it passed. At the top, the sun wrapped around her like a blanket. She rested there, and she smiled.'
  );
}

function corsHeaders(origin, allowed) {
  const h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
  if (allowed) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function reply(body, status, origin, allowed) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin, allowed) });
}

// One attempt against one provider. Resolves to the story string, or throws an
// Error whose .kind distinguishes rate limiting from everything else.
async function askProvider(p, language, idea, targetWords) {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Trim the key: a value pasted into a terminal often carries a trailing
      // newline or space, which makes the upstream reject every request.
      'Authorization': 'Bearer ' + String(p.key).trim(),
    },
    body: JSON.stringify({
      model: p.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(language, targetWords) },
        { role: 'user', content: 'Write the story in ' + language + ' about: ' + idea },
      ],
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: 600,
      // Identical requests come back byte-for-byte identical from some
      // providers, so the same idea would always produce the same story.
      // A fresh seed per request makes each telling different.
      seed: Math.floor(Math.random() * 1e9),
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  });

  if (res.status === 429) {
    const e = new Error(p.name + '-rate-limited');
    e.kind = 'busy';
    throw e;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch (err) { /* ignore */ }
    const e = new Error(p.name + ' HTTP ' + res.status + ' ' + detail);
    e.kind = 'upstream';
    throw e;
  }

  const data = await res.json();
  const story = ((data.choices && data.choices[0] && data.choices[0].message &&
                  data.choices[0].message.content) || '').trim();
  if (story.length < 8) {
    const e = new Error(p.name + ' empty story');
    e.kind = 'upstream';
    throw e;
  }
  return story;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    const chain = providers(env);

    // Health check: confirms the Worker is deployed and which providers have a
    // key, without revealing them and without spending a request on any model.
    // curl https://<worker-url>/health
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return reply({
        ok: true,
        configured: chain.length > 0,
        providers: chain.map(function (p) { return p.name + ':' + p.model; }),
      }, 200, origin, allowed);
    }

    // The story brief lives here, and the in-browser model needs the same one.
    // Serving it means there is one copy rather than two that quietly drift
    // apart. The page falls back to its built-in copy if this is unreachable,
    // which is the only case where the two can differ.
    if (request.method === 'GET' && new URL(request.url).pathname === '/brief') {
      const lang = new URL(request.url).searchParams.get('lang') === 'it' ? 'Italian' : 'English';
      return reply({ prompt: buildSystemPrompt(lang, 0) }, 200, origin, allowed);
    }

    if (!allowed) return reply({ error: 'origin' }, 403, origin, false);
    if (request.method !== 'POST') return reply({ error: 'method' }, 405, origin, allowed);
    if (chain.length === 0) return reply({ error: 'unconfigured' }, 503, origin, allowed);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return reply({ error: 'bad-request' }, 400, origin, allowed);
    }

    // Cap the idea length: this is a one-line prompt, not a document.
    const idea = String(body.prompt || '').trim().slice(0, 300);
    if (!idea) return reply({ error: 'empty-prompt' }, 400, origin, allowed);
    const language = body.lang === 'it' ? 'Italian' : 'English';
    // Optional: the page measured a first story and knows exactly how long the
    // next one should be. Clamped so a caller cannot ask for an essay.
    let targetWords = Number(body.targetWords) || 0;
    if (targetWords) targetWords = Math.max(40, Math.min(110, Math.round(targetWords)));

    // Walk the chain. A provider that is rate limited gets one quick retry,
    // because a second of waiting beats moving down the chain; any other
    // failure moves on immediately. Only if every provider fails does the
    // page's own fallback (in-browser model, then the reader's words) engage.
    let sawBusy = false;
    let lastError = '';
    for (const p of chain) {
      try {
        return reply({ story: await askProvider(p, language, idea, targetWords), provider: p.name }, 200, origin, allowed);
      } catch (e) {
        if (e.kind === 'busy') {
          sawBusy = true;
          try {
            await new Promise(function (r) { setTimeout(r, 1200); });
            return reply({ story: await askProvider(p, language, idea, targetWords), provider: p.name }, 200, origin, allowed);
          } catch (e2) {
            if (e2.kind === 'busy') { lastError = e2.message; continue; }
            lastError = e2.message;
            continue;
          }
        }
        lastError = e.message;
        continue;
      }
    }

    if (sawBusy) return reply({ error: 'busy' }, 429, origin, allowed);
    return reply({ error: 'upstream', detail: String(lastError).slice(0, 200) }, 502, origin, allowed);
  },
};
