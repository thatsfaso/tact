/**
 * Tact story proxy — Cloudflare Worker
 *
 * Keeps API keys out of the browser. The site is a static page, so it cannot
 * hold a secret; this Worker is the only piece that can. It accepts a one-line
 * story idea and returns story prose, nothing else.
 *
 * Story generation runs several providers as a HEDGED race, not a queue. The
 * preferred one starts immediately; if it has not answered within a short
 * grace period the next one starts alongside it, and the first story to arrive
 * wins. A provider that fails is then skipped for a cooldown period, so one
 * sick service costs one slow request rather than every request.
 *
 * This replaced a strictly sequential chain, which had a flaw worth recording:
 * a first provider that hangs imposes its entire timeout on EVERY request
 * before anything else is even attempted. When Groq's 70B model degraded, that
 * meant twelve dead seconds per story, and readers were pushed onto the
 * in-browser model even though a healthy provider was sitting right behind it.
 * Ordering by preference is only correct when providers fail fast.
 *
 * If every provider fails, the page falls back to its in-browser model and then
 * to the reader's own words. No single service can take the site down.
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
  // 'http://localhost:8080' was here and has been removed deliberately.
  // This is an open-source project, so cloning it and serving it locally is the
  // most natural thing a reader of the repository can do — and with localhost
  // allowed, every one of those requests silently spent THIS deployment's model
  // quota. The allowance is the binding constraint on the whole service, so the
  // convenience was not worth it. Add it back temporarily when developing
  // against the live Worker; a fork's own deployment should list its own origin.
];

// Providers in order of preference. Groq first: llama-3.3-70b-versatile is a
// production model on their free tier and generates a whole story in about a
// second. Agnes second: free as well, but its inference latency has been seen
// swinging from eight seconds to timeouts, which is what motivated the chain.
// Timeouts are per provider: a short leash for the fast one, a long leash for
// the slow one, because waiting on Agnes still beats a 1.8 GB model download.
// Measured: the Llama models write much shorter sentences than Agnes for the
// same brief, landing around 35 words where 65 were asked. The fix is NOT to
// ask for more sentences: 66 words across ten sentences is seven words each,
// which contradicts the ten-to-eighteen rule below and makes the model write a
// chain of telegraphic fragments. Sentence count and word target have to agree
// arithmetically. Length comes from the worked example instead, which anchors
// these models far more than any numeric rule does — so the example runs
// deliberately longer than the story actually wants.
// Measured, the hard way: these models track the EXAMPLE's length almost one
// for one, and largely ignore the numeric target. A 115-word example produced
// 110-word stories no matter what number the brief asked for, and 90% of those
// spilled onto a third, mostly empty page. So the example is now written to the
// length the page can actually hold, and the per-sentence band is narrow enough
// that six or seven sentences cannot add up to an overflow.
const LLAMA_TUNE = {
  // English needs one sentence fewer. These models write English roughly a
  // quarter longer than Italian for an identical brief, and they overrun the
  // per-sentence ceiling freely (asked for 12 words, they write 15). Sentence
  // COUNT is the one length control they actually obey, so that is the lever
  // used to separate the two languages.
  sentences: { Italian: 'FIVE or SIX', English: 'FOUR or FIVE' },
  sentMax: { Italian: 'six', English: 'five' },
  minWords: 8, maxWords: 12,
  // Italian words are longer in Braille cells, so two pages hold about 65 of
  // them against 75 English ones — yet these models land FURTHER short in
  // Italian than in English for the same ask. Both effects push the same way,
  // hence the noticeably higher Italian number. Measured, not guessed.
  target: { Italian: '58', English: '50' },
  // Several worked examples per language, one picked at random per request.
  //
  // An English-only example left Italian unanchored, and Italian then ignored
  // the word target completely: raising it from 66 to 76 moved the output by
  // minus two words. The example is the lever; the number is nearly decorative.
  //
  // But a SINGLE example anchors phrasing as hard as it anchors length. With
  // one, two stories in three opened on "Quel giorno decise di" and closed on
  // "Poi, piano piano, sorrise" — the example's own words, lifted whole, even
  // with a line in the brief forbidding exactly that. Telling a model not to
  // copy the only pattern it has been shown does not work; showing it several
  // does. They deliberately differ in opening, in shape and in ending, so what
  // survives the averaging is the length and the gentleness, not a formula.
  example: {
    // Shorter than the Italian one on purpose: for an identical brief these
    // models write English about a quarter longer than Italian, so an example
    // of the same length would push English onto a third page.
    // Deliberately shorter than the Italian ones, and deliberately erring
    // short. An overlong story spills onto a third, half-empty page and the
    // second pass cannot take words away; a short one is simply asked to grow.
    // So the bias is downward on purpose.
    English: [
      'The little snail crept into the wet garden, and the air smelled of rain. That day she decided to climb the tall leaf above her. The wind pushed her back, so she held on until it passed. At the top the sun warmed her, and she smiled.',
      'The old drum slept in the attic under a blanket of dust. No one had played it for many winters, and its skin was cold. A small hand found it and wiped it clean. The first beat was shy, but the second filled the whole house.',
      'The silver fish lived where the water was dark and still. Above him passed wide shadows that made the weeds tremble. One day he followed a warmer thread of current upward. He touched the air with his nose, and it was salty and light.',
    ],
    Italian: [
      // This one's original opening ("Quel giorno decise di") and closing
      // ("Poi, piano piano, sorrise") were catchy enough that stories lifted
      // them verbatim even from inside a rotation. Rewritten without any line
      // quotable enough to survive being copied.
      'La piccola lumaca uscì nel giardino bagnato, e l\'aria sapeva di pioggia. Voleva arrivare in cima alla foglia più alta, così cominciò a salire. La sua pancia sentiva ogni nodo del gambo mentre andava su. Il vento la spingeva indietro, ma lei si tenne stretta finché non passò. In cima il sole la avvolse come una coperta tiepida, e lì restò a lungo.',
      'Il vecchio tamburo dormiva in soffitta, coperto di polvere e di silenzio. Nessuno lo suonava da tanti inverni, e la sua pelle era fredda. Una mano piccola lo trovò e lo pulì con la manica. Il primo colpo fu timido, ma il secondo riempì tutta la casa. La polvere danzava nell\'aria come neve leggera. Da quel giorno il tamburo non ebbe più freddo.',
      'Il pesciolino argentato viveva dove l\'acqua era scura e tranquilla. Sopra di lui passavano ombre grandi che facevano tremare le alghe. Un giorno seguì un filo di corrente più caldo e salì piano. L\'acqua diventava chiara, e sentiva le onde rumoreggiare sopra la testa. Uscì con il muso e toccò l\'aria per la prima volta. Era salata e leggera, e lui non ebbe paura.',
    ],
  },
};

function providers(env) {
  return [
    {
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.3-70b-versatile',
      key: env.GROQ_API_KEY,
      // This model answers healthy requests in well under a second, so a long
      // leash buys nothing and costs everything: it is the interval a reader
      // stares at a spinner before the hedge rescues them.
      timeoutMs: 5000,
      tune: LLAMA_TUNE,
    },
    {
      // Same account, different model, therefore a different rate-limit bucket.
      // The 70B model's free-tier allowance is the thing most likely to run out
      // on a busy day, and when it does the next stop should be another model
      // that answers in a second — not a slow one, and certainly not a 1.8 GB
      // download. Slightly weaker prose is a far better trade than either.
      name: 'groq-fast',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.1-8b-instant',
      key: env.GROQ_API_KEY,
      timeoutMs: 10000,
      tune: LLAMA_TUNE,
    },
    {
      name: 'agnes',
      url: 'https://apihub.agnes-ai.com/v1/chat/completions',
      model: 'agnes-2.0-flash',
      key: env.AGNES_API_KEY,
      // Was 40s, on the reasoning that waiting beats a 1.8 GB model download.
      // That reasoning was wrong once measured: when Agnes is degraded it does
      // not answer late, it does not answer at all, so the long leash bought
      // nothing and spent forty seconds of a reader's patience before failing
      // anyway. Healthy Agnes replies in about eight seconds; past twelve it is
      // not coming, and the in-browser model is the better use of the time.
      timeoutMs: 12000,
      tune: null,   // the defaults below were calibrated against this model
    },
  ].filter(function (p) { return !!p.key; });
}

// The page holds a fixed number of Braille CELLS, and Italian words are longer
// than English ones, so the same word count fills a different amount of page.
// Measured against the real paginator: about 65 Italian words, or 75 English
// words, fill the two pages without spilling onto a third.
const WORD_TARGET = { Italian: '55', English: '62' };
// Hard ceiling: past this the story spills onto a third, mostly empty page.
// It sits a little above the per-language target, so the ceiling stays a
// ceiling rather than contradicting the length actually being asked for.
const CAP = { Italian: '72', English: '82' };
// Italian needs about 67 words to fill two cards, English about 76, and both
// read best near ten words a sentence — so each language gets its own count.
const SENTENCES = { Italian: 'SIX or SEVEN', English: 'SEVEN or EIGHT' };
const SENT_MAX = { Italian: 'seven', English: 'eight' };
const DEFAULT_EXAMPLE = 'The little snail woke to cool dew along her shell. Today, she decided, she would climb the tall leaf that swayed above her. Slowly, slowly she began, her soft belly feeling every bump of the green stem. Birds sang somewhere warm and near. The wind pushed against her, and she held on tighter until it passed. At the top, the sun wrapped around her like a blanket. She rested there, and she smiled.';

// targetWords, when supplied, overrides the language default. The page owns the
// only accurate measure of how much text fits, so it can measure a first story
// and ask for a second one of the exact length that fills the pages.
function buildSystemPrompt(language, targetWords, tune) {
  const t = tune || {};
  // Any tune value may be a single string or one entry per language.
  const perLang = (v, fallback) => (v == null) ? fallback
    : (typeof v === 'string') ? v : (v[language] || fallback);
  const sentences = perLang(t.sentences, SENTENCES[language] || 'SIX or SEVEN');
  const sentMax = perLang(t.sentMax, SENT_MAX[language] || 'seven');
  const minW = t.minWords || 8;
  // A tune may carry one example per language, or a single shared one.
  const ex = t.example || DEFAULT_EXAMPLE;
  const forLang = (typeof ex === 'string') ? ex : (ex[language] || ex.English);
  const example = Array.isArray(forLang)
    ? forLang[Math.floor(Math.random() * forLang.length)]
    : forLang;
  const exampleLang = (typeof ex === 'string') ? 'English' : (ex[language] ? language : 'English');
  const maxW = t.maxWords || 14;
  const wanted = Number(targetWords) || Number((t.target || WORD_TARGET)[language]) || 80;
  const target = String(Math.max(45, wanted));
  return (
    "You are a beloved children's picture-book author writing for young blind children who will read your words in Braille. Your stories are warm, vivid, and gently magical.\n\n" +
    "Write a complete little story from the user's idea. Craft it with care:\n" +
    '- Give it a clear arc: a calm beginning, a small wish or problem, a turn, and a warm, satisfying ending.\n' +
    '- Something must HAPPEN. The character has to want something and reach it, or fear something and face it. A character who only rests, listens and falls asleep is a mood, not a story, and the child is left with nothing to remember.\n' +
    '- Use rich SENSORY detail a blind child can feel: textures, sounds, warmth, smell, movement. Favour touch and sound over colour and sight.\n' +
    '- Use concrete, simple words a 6-year-old knows.\n' +
    '- Write about ' + target + ' words as ' + sentences + ' sentences in total. Never more than ' + sentMax + '.\n' +
    '- HARD LIMIT: the whole story must stay under ' + (targetWords ? (Number(targetWords) + 6) : CAP[language]) + ' words. Going over ruins the printed page, so count as you write and stop before the limit.\n' +
    '- Most sentences should run ' + minW + ' to ' + maxW + ' words, joining ideas with words like and, but, so, until, while, because. Let one or two be short for rhythm. Never write a chain of tiny three or four word sentences.\n' +
    '- Give it a gentle rhythm; you may softly repeat a kind phrase.\n\n' +
    'Output ONLY the story prose: no title, no quotation marks, no notes, no markdown. Write in the SAME language as the request.\n\n' +
    // The example anchors length far better than any numeric rule, but it
    // anchors PHRASING too: without this line the stories start reusing its
    // opening and its cadence, and every story begins to sound like the same
    // story. Copy the shape, not the words.
    'Match only the length, rhythm and sentence count of this example (' + exampleLang + '). ' +
    'Do NOT reuse its words, its characters, its opening or its closing — your story must be entirely your own:\n' + example
  );
}

// How long the preferred provider gets on its own before the next one is
// started alongside it. Healthy providers answer in about 700ms, so this is
// long enough that a well-behaved service is never doubled up on, and short
// enough that a sick one is not something the reader has to sit through.
const HEDGE_MS = 1600;

// A provider that just failed is very likely to fail again in the next seconds,
// and trying it first would tax every request with its timeout. So a failure is
// remembered and that provider is demoted for a while. This lives at module
// scope: a Worker isolate is reused across requests, so it survives long enough
// to matter, and losing it on eviction is harmless — the worst case is one
// slow request that repopulates it.
const cooldownUntil = Object.create(null);
const COOLDOWN_MS = 60000;

// Run the providers as a hedged race. Resolves with the first story to arrive;
// rejects only once every provider has failed.
function raceProviders(chain, language, idea, targetWords, log) {
  const now = Date.now();
  // Anything in cooldown goes to the back, but is still tried: if every
  // provider is cooling down, the least recently failed one still gets a turn.
  const ordered = chain.slice().sort(function (a, b) {
    return ((cooldownUntil[a.name] || 0) > now ? 1 : 0) - ((cooldownUntil[b.name] || 0) > now ? 1 : 0);
  });

  return new Promise(function (resolve, reject) {
    let settled = false;
    let started = 0;
    let failed = 0;
    let sawBusy = false;

    // The next provider starts either when the current one has been slow for
    // HEDGE_MS, or the instant it fails — whichever comes first. Waiting out
    // the full hedge after a refusal that arrived in 20ms would be pure dead
    // time, and a rate-limited provider refuses almost instantly.
    function startNext() {
      if (settled || started >= ordered.length) return;
      const p = ordered[started++];
      const t0 = Date.now();
      const hedge = setTimeout(startNext, HEDGE_MS);

      askProvider(p, language, idea, targetWords).then(function (story) {
        clearTimeout(hedge);
        log.push(p.name + ':ok:' + (Date.now() - t0) + 'ms');
        delete cooldownUntil[p.name];
        if (settled) return;
        settled = true;
        resolve({ story: story, provider: p.name });
      }).catch(function (e) {
        clearTimeout(hedge);
        if (e.kind === 'busy') sawBusy = true;
        cooldownUntil[p.name] = Date.now() + COOLDOWN_MS;
        log.push(p.name + ':' + (e.kind || 'err') + ':' + (Date.now() - t0) + 'ms' +
                 (e.detail ? ' (' + String(e.detail).replace(/\s+/g, ' ').slice(0, 300) + ')' : ''));
        failed += 1;
        if (failed === ordered.length) {
          if (settled) return;
          settled = true;
          const err = new Error(log.join(' | '));
          err.busy = sawBusy;
          reject(err);
          return;
        }
        startNext();
      });
    }

    startNext();
  });
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
        { role: 'system', content: buildSystemPrompt(language, targetWords, p.tune) },
        { role: 'user', content: 'Write the story in ' + language + ' about: ' + idea },
      ],
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: 600,
      // Identical requests come back byte-for-byte identical from some
      // providers, so the same idea would always produce the same story.
      // A fresh seed per request makes each telling different.
      ...(p.omitSeed ? {} : { seed: Math.floor(Math.random() * 1e9) }),
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  });

  if (res.status === 429) {
    // Keep the upstream's own words. "Rate limited" covers two very different
    // situations — an allowance temporarily spent, and an allowance that is
    // structurally zero for this key — and only the body tells them apart.
    let why = '';
    try { why = (await res.text()).slice(0, 400); } catch (err) { /* ignore */ }
    const e = new Error(p.name + ' 429 ' + why);
    e.kind = 'busy';
    e.detail = why;
    throw e;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch (err) { /* ignore */ }
    const e = new Error(p.name + ' HTTP ' + res.status + ' ' + detail);
    e.kind = 'upstream';
    e.detail = 'HTTP ' + res.status + ' ' + detail;
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
      // Serve the Llama tune, not the default. The in-browser fallback is a
      // small instruct model of the same family, and it fails the same way the
      // hosted Llama models do: given the untuned brief it writes chains of
      // three and four word sentences. It needs the corrected one too.
      return reply({ prompt: buildSystemPrompt(lang, 0, LLAMA_TUNE) }, 200, origin, allowed);
    }

    if (!allowed) return reply({ error: 'origin' }, 403, origin, false);
    if (request.method !== 'POST') return reply({ error: 'method' }, 405, origin, allowed);

    // Diagnostic: run ONE provider in isolation and report what it did. In a
    // race a slow provider simply loses and leaves no trace, which hides the
    // difference between "refused instantly" and "took fifteen seconds to say
    // no" — and those two need opposite fixes. Behind the origin check, since
    // it spends a real model call.
    if (request.method === 'GET' && new URL(request.url).pathname === '/probe') {
      const want = new URL(request.url).searchParams.get('p') || '';
      const lang = new URL(request.url).searchParams.get('lang') === 'it' ? 'Italian' : 'English';
      const p = chain.filter(function (x) { return x.name === want; })[0];
      if (!p) return reply({ error: 'unknown-provider', known: chain.map(function (x) { return x.name; }) }, 400, origin, allowed);
      const t0 = Date.now();
      try {
        const story = await askProvider(p, lang, 'un gatto curioso', 0);
        return reply({ ok: true, model: p.model, ms: Date.now() - t0, story: story }, 200, origin, allowed);
      } catch (e) {
        return reply({ ok: false, model: p.model, ms: Date.now() - t0, kind: e.kind || 'err', detail: String(e.message).slice(0, 700) }, 200, origin, allowed);
      }
    }

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

    // Race the providers. Only if every one of them fails does the page's own
    // fallback (in-browser model, then the reader's words) engage.
    // `chain` is echoed back on both paths: it names who answered and who did
    // not, which is the difference between "the cloud is broken" and "the
    // preferred model is sick and something else covered for it".
    const log = [];
    try {
      const won = await raceProviders(chain, language, idea, targetWords, log);
      return reply({ story: won.story, provider: won.provider, chain: log }, 200, origin, allowed);
    } catch (e) {
      if (e.busy) return reply({ error: 'busy', chain: log }, 429, origin, allowed);
      return reply({ error: 'upstream', chain: log, detail: String(e.message).slice(0, 200) }, 502, origin, allowed);
    }
  },
};
