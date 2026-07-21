# Tact story proxy

Tact is a static page, so it cannot keep a secret. This small Cloudflare Worker
is the only component that can: it holds the Agnes API key and turns a one-line
story idea into story prose.

The site works without it. If this Worker is missing, unreachable, or rate
limited, the page falls back to generating the story in the browser, and then to
turning the visitor's own words into Braille. The cloud path is an accelerator,
not a dependency.

## What it does

- Accepts `POST` with `{ "prompt": "a fox who guarded a castle", "lang": "it" }`
- Returns `{ "story": "..." }`
- Holds the system prompt itself, so it can only ever write a children's story
- Accepts requests only from the site's own origins
- Reports upstream rate limiting as `busy` so the page can fall back

## Deploy

You need a free Cloudflare account, plus at least one model key: Groq from
<https://console.groq.com> (recommended, fast) or Agnes from <https://agnes-ai.com>.

```bash
cd worker
npx wrangler login          # opens the browser, authorises your account
npx wrangler secret put GROQ_API_KEY    # from console.groq.com, tried first
npx wrangler secret put AGNES_API_KEY   # from agnes-ai.com, the fallback
npx wrangler deploy
```

Either key alone is enough: a provider whose key is missing is skipped.

The providers are raced, not queued. The preferred one starts immediately; if
it has not answered within 1.6 seconds, or the moment it refuses, the next one
starts alongside it and the first story to arrive wins. A provider that fails
is then skipped for a minute, so a sick service costs one slow request instead
of every request.

That matters more than it sounds. With a strict queue, a first provider that
hangs imposes its whole timeout on every single story before anything else is
tried — twelve dead seconds each, with a perfectly healthy provider waiting
behind it. Preference ordering is only safe when providers fail fast.

**Free tiers are the real capacity limit.** Groq's free allowance is measured
in tokens per minute and per day, and a busy day exhausts it: every request
then comes back `busy` in about 20 milliseconds and the race moves on. Two
models on one key are two separate buckets, not twice the quota. If this
endpoint needs to survive real traffic, add a key from a third, independent
provider rather than relying on one account.

`wrangler deploy` prints the Worker URL, something like
`https://tact-story-proxy.<your-subdomain>.workers.dev`.

Check it is alive and that the key was stored, without spending a request on
the model:

```bash
curl https://tact-story-proxy.<your-subdomain>.workers.dev/health
# {"ok":true,"configured":true,"providers":["groq:llama-3.3-70b-versatile","groq-fast:llama-3.1-8b-instant","agnes:agnes-2.0-flash"]}
```

The Groq key buys two links in the chain, not one: the 70B model and the 8B
one are separate rate-limit buckets, so the busiest allowance running out drops
to another sub-second model rather than all the way down the chain.

`configured: false` means the secret is missing: run `wrangler secret put
AGNES_API_KEY` again and redeploy.

Put that URL in `index.html`, in the `CLOUD_ENDPOINT` constant near the top of
the story-generation script. Leaving it empty disables the cloud path entirely
and the page uses in-browser generation, which is a safe default.

## If you forked this project

You do **not** need any of this to run Tact. Clone the repository, open
`index.html`, and it works: the page generates the story with its in-browser
model, and if that is unavailable it turns your own words into a real Braille
page. Nothing here is required.

What you do not get without your own key is the fast path. The endpoint in
`index.html` points at this project's own Worker, which accepts requests only
from its own origins, so a fork receives `403` and the page falls back
automatically. That is by design rather than an obstacle: one project's free
allowance cannot fund everybody's stories.

To get sub-second generation on your own deployment:

1. Get a free key from <https://console.groq.com>
2. Deploy this Worker to your own Cloudflare account (steps above)
3. Add your site's origin to `ALLOWED_ORIGINS` in `story-proxy.js`
4. Point `CLOUD_ENDPOINT` in `index.html` at your Worker URL

The origin check is not a security boundary — any non-browser client can send
whatever header it likes — and it is not meant to be one. Two real protections
sit behind it. The system prompt is fixed server-side, so the endpoint can only
ever write a children's story and cannot be repurposed as a general-purpose
model. And every request passes an exact rate limit (20 a minute per IP, 240 a
minute overall, counted by a Durable Object) before it is allowed to reach any
model, so even a caller who fakes the origin header cannot spend more than
pocket change of the deployment's allowance. A refused request gets the same
`busy` answer a rate-limited provider produces, and the page falls back to its
in-browser model as usual.

## Notes

- The key is stored encrypted by Cloudflare and is never sent to the browser.
- `ALLOWED_ORIGINS` in `story-proxy.js` lists the origins allowed to call the
  Worker. Add any new domain there.
- The origin check stops casual reuse from other websites; the enforced
  boundary is the Durable Object rate limiter above, plus the fixed
  server-side system prompt.
- The limits (20/min per IP, 240/min overall) live in `story-proxy.js`, next
  to the check that applies them. Cloudflare's own `[[ratelimits]]` binding
  was tried first and is deliberately not used: its counters are cached per
  isolate and synced lazily, and a burst of thirty separate requests on one
  key sailed straight through a limit of twenty.
