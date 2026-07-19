/**
 * Tact story proxy — Cloudflare Worker
 *
 * Keeps the Agnes API key out of the browser. The site is a static page, so it
 * cannot hold a secret; this Worker is the only piece that can. It accepts a
 * one-line story idea and returns story prose, nothing else.
 *
 * Deliberate design choices:
 *  - The system prompt lives HERE, not in the request. A caller can only ever
 *    ask for a children's story, so the proxy cannot be repurposed as a general
 *    purpose language model by whoever finds the URL.
 *  - Requests are accepted only from the site's own origins.
 *  - Upstream rate limiting (HTTP 429) is passed through as `busy` so the page
 *    can fall back to in-browser generation instead of failing.
 *
 * NOTE: the system prompt below mirrors SYSTEM_PROMPT in index.html. If you
 * change the story brief in one place, change it in the other.
 *
 * Deploy: see worker/README.md
 */

const ALLOWED_ORIGINS = [
  'https://tactbraille.com',
  'https://www.tactbraille.com',
  'https://thatsfaso.github.io',
  'http://localhost:8080',
];

const AGNES_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
const AGNES_MODEL = 'agnes-2.0-flash';

// The page holds a fixed number of Braille CELLS, and Italian words are longer
// than English ones, so the same word count fills a different amount of page.
// Measured against the real paginator: about 65 Italian words, or 75 English
// words, fill the two pages without spilling onto a third. Asking for one number in both languages left Italian
// stories short and English ones overflowing onto a third page.
const WORD_TARGET = { Italian: '55', English: '62' };
// Hard ceiling: past this the story spills onto a third, mostly empty page.
const CAP = { Italian: '64', English: '72' };

// targetWords, when supplied, overrides the language default. The page owns the
// only accurate measure of how much text fits, so it can measure a first story
// and ask for a second one of the exact length that fills the pages.
// The model reliably overshoots a requested word count, and by a different
// amount per language (measured: about +2 in Italian, +10 in English, with
// eight sentences allowed). Ask for less so it delivers what was actually
// wanted. This belongs here, in the one place that knows which model runs.
const BIAS = { Italian: 0, English: 0 };
// Italian needs about 67 words to fill two cards, English about 76, and both
// read best near ten words a sentence — so each language gets its own count.
const SENTENCES = { Italian: 'SIX or SEVEN', English: 'SEVEN or EIGHT' };
const SENT_MAX = { Italian: 'seven', English: 'eight' };

function buildSystemPrompt(language, targetWords) {
  const wanted = Number(targetWords) || Number(WORD_TARGET[language]) || 80;
  const target = String(Math.max(45, wanted - (BIAS[language] || 0)));
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    // Health check: confirms the Worker is deployed and whether the key is set,
    // without revealing it and without spending a request on the model.
    // curl https://<worker-url>/health
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return reply({ ok: true, configured: !!env.AGNES_API_KEY, model: AGNES_MODEL }, 200, origin, allowed);
    }

    if (!allowed) return reply({ error: 'origin' }, 403, origin, false);
    if (request.method !== 'POST') return reply({ error: 'method' }, 405, origin, allowed);
    if (!env.AGNES_API_KEY) return reply({ error: 'unconfigured' }, 503, origin, allowed);

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

    // Trim the key: a value pasted into a terminal often carries a trailing
    // newline or space, which makes the upstream reject every request.
    const apiKey = String(env.AGNES_API_KEY).trim();

    function callModel() {
      return fetch(AGNES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: AGNES_MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(language, targetWords) },
            { role: 'user', content: 'Write the story in ' + language + ' about: ' + idea },
          ],
          temperature: 0.85,
          top_p: 0.9,
          max_tokens: 600,
          // Identical requests come back byte-for-byte identical, so the same
          // idea would always produce the same story. A fresh seed per request
          // makes each telling different.
          seed: Math.floor(Math.random() * 1e9),
        }),
        // Generous: the model normally answers in under ten seconds, but slows
        // down under load. Waiting is better than failing over to a fallback
        // that would take longer still.
        signal: AbortSignal.timeout(40000),
      });
    }

    let upstream;
    try {
      upstream = await callModel();
      // One quick retry when the model is momentarily rate limited: a second of
      // waiting beats sending the visitor down the in-browser path, which would
      // mean downloading a model.
      if (upstream.status === 429) {
        await new Promise(function (r) { setTimeout(r, 1200); });
        upstream = await callModel();
      }
    } catch (e) {
      // Timeout or network failure: the page falls back to in-browser generation.
      return reply({ error: 'upstream-unreachable' }, 504, origin, allowed);
    }

    if (upstream.status === 429) return reply({ error: 'busy' }, 429, origin, allowed);
    if (!upstream.ok) {
      // Surface enough of the upstream failure to diagnose it (a bad key, a
      // renamed model). The key itself is never included.
      let detail = '';
      try { detail = (await upstream.text()).slice(0, 300); } catch (e) { /* ignore */ }
      return reply({ error: 'upstream', status: upstream.status, detail }, 502, origin, allowed);
    }

    let data;
    try {
      data = await upstream.json();
    } catch (e) {
      return reply({ error: 'bad-upstream-json' }, 502, origin, allowed);
    }

    const story = ((data.choices && data.choices[0] && data.choices[0].message &&
                    data.choices[0].message.content) || '').trim();
    if (story.length < 8) return reply({ error: 'empty-story' }, 502, origin, allowed);

    return reply({ story }, 200, origin, allowed);
  },
};
