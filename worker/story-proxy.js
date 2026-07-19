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

const SYSTEM_PROMPT =
  "You are a beloved children's picture-book author writing for young blind children who will read your words in Braille. Your stories are warm, vivid, and gently magical.\n\n" +
  "Write a complete little story from the user's idea. Craft it with care:\n" +
  '- Give it a clear arc: a calm beginning, a small wish or problem, a turn, and a warm, satisfying ending.\n' +
  '- Use rich SENSORY detail a blind child can feel: textures, sounds, warmth, smell, movement. Favour touch and sound over colour and sight.\n' +
  '- Use concrete, simple words a 6-year-old knows.\n' +
  '- Let the sentences flow and vary in length. Join ideas with words like and, but, so, until, while, because. Some sentences are short; several run longer and carry the reader along. Never write a long chain of tiny three or four word sentences.\n' +
  '- Give it a gentle rhythm; you may softly repeat a kind phrase.\n' +
  '- Write about 75 to 85 words, in flowing sentences that together fill two full pages.\n\n' +
  'Output ONLY the story prose: no title, no quotation marks, no notes, no markdown. Write in the SAME language as the request.';

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

    let upstream;
    try {
      upstream = await fetch(AGNES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + env.AGNES_API_KEY,
        },
        body: JSON.stringify({
          model: AGNES_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: 'Write the story in ' + language + ' about: ' + idea },
          ],
          temperature: 0.85,
          top_p: 0.9,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      // Timeout or network failure: the page falls back to in-browser generation.
      return reply({ error: 'upstream-unreachable' }, 504, origin, allowed);
    }

    if (upstream.status === 429) return reply({ error: 'busy' }, 429, origin, allowed);
    if (!upstream.ok) return reply({ error: 'upstream' }, 502, origin, allowed);

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
