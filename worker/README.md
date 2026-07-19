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

You need a free Cloudflare account and an Agnes API key from
<https://agnes-ai.com>.

```bash
cd worker
npx wrangler login          # opens the browser, authorises your account
npx wrangler secret put AGNES_API_KEY   # paste the key when prompted
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, something like
`https://tact-story-proxy.<your-subdomain>.workers.dev`.

Put that URL in `index.html`, in the `CLOUD_ENDPOINT` constant near the top of
the story-generation script. Leaving it empty disables the cloud path entirely
and the page uses in-browser generation, which is a safe default.

## Notes

- The key is stored encrypted by Cloudflare and is never sent to the browser.
- `ALLOWED_ORIGINS` in `story-proxy.js` lists the origins allowed to call the
  Worker. Add any new domain there.
- The origin check stops casual reuse from other websites; it is not a hard
  security boundary, since a non-browser client can send any header. The real
  protection is that the system prompt is fixed server-side, so the endpoint
  cannot be repurposed as a general-purpose model.
- If you later need stricter limits, Cloudflare KV or Durable Objects can add
  per-IP rate limiting.
