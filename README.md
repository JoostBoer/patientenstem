# Patiëntenstem

> An open-source platform where psychiatric patients can share their experiences. Anonymously. With voice or text. AI helps if you want it. Eleven languages out of the box.

**Live at [ourpatientvoice.org](https://ourpatientvoice.org/)** — that is the canonical home of this project. The site is where patients actually share stories; this repository is the code that runs it.

Patients in psychiatric care are not always heard. Especially not when admitted, or under involuntary treatment. Most clinicians have good intentions, but good intentions don't prevent harm. Patient stories can.

## How this project works

The project runs as a single, central instance at [ourpatientvoice.org](https://ourpatientvoice.org/). [@JoostBoer](https://github.com/JoostBoer) maintains the repository and reviews every contribution. Pull requests that are merged here go live on the site.

If you want to help — by adding a provider, translating a language, fixing a bug, or improving the experience — open an issue or a PR. The code is MIT-licensed, but the goal is one shared home for patient voices, not many scattered copies.

## What it does

- Anonymous experience reviews per psychiatric provider (10 large Dutch providers seeded; trivial to add more)
- **Microphone input** in the form and feedback widget (Web Speech API, no server transcription, NL/EN voice recognition built in, more via browser)
- **AI rewrite** that takes a written or spoken story and proposes a more coherent version while keeping all content, names and emotional weight (Anthropic API)
- **Floating feedback bubble** on every page so users can suggest improvements
- **11 languages** out of the box (NL, EN, DE, FR, ES, IT, PT, JA, ZH, AR, TR — auto-translated from Dutch via Anthropic and reviewable as JSON files)
- **SEO-friendly multilingual URLs**: every language has its own crawlable path (`/nl/`, `/de/`, `/fr/`, …) with `hreflang` alternates, a `canonical` tag, and a generated `sitemap.xml`
- No accounts, no tracking, no advertising, no external scripts beyond Google Fonts (removable)
- Honeypot anti-spam, takedown request flow for moderation

## Run it locally (for contributors)

Requires Node.js 18+.

```bash
git clone https://github.com/JoostBoer/patientenstem.git
cd patientenstem
npm install
cp .env.example .env
# Optional: add ANTHROPIC_API_KEY to .env to enable AI rewrites
npm start
```

Open http://localhost:3000

The first start seeds 10 Dutch GGZ providers from `seeds/instellingen.json` into a SQLite database in `data/patientenstem.db`. To re-seed manually:

```bash
npm run seed
```

## Tech

- Node.js + Express
- EJS templates (server-rendered, **no build step**)
- SQLite via `better-sqlite3`
- Web Speech API for microphone input (browser-native)
- Anthropic API for the optional AI rewrite feature
- Plain CSS, no framework
- Three runtime dependencies. That's the whole thing.

## Adding a provider

Edit `seeds/instellingen.json`, add a row, send a PR. Or open an issue. Once merged, the provider appears on [ourpatientvoice.org](https://ourpatientvoice.org/).

## URLs & internationalisation

The language lives in the URL path, so every translation is its own indexable page:

```
/nl            /nl/over      /nl/instelling/<slug>
/de  /fr  /es  /en  …
```

- `/` (and any un-prefixed path) 302-redirects to the visitor's preferred language — from a `?lang=` override, a `lang` cookie, or the `Accept-Language` header, falling back to `nl`.
- Each page emits a `<link rel="canonical">`, one `hreflang` alternate per language, and an `hreflang="x-default"`.
- `/sitemap.xml` lists every page in every language with alternates; `/robots.txt` points crawlers to it.
- Set `SITE_URL` in `.env` (default `https://ourpatientvoice.org`) so canonical/sitemap/Open Graph URLs are absolute and correct.

In templates, build internal links with the locale helpers instead of hard-coding paths: `url('/over')` → `/nl/over` for the current language, and `altUrl('de', basePath)` → the same page in German.

## Adding a language

Easiest path: copy `locales/en.json` to `locales/<your-code>.json`, translate the values, send a PR.

Auto-translate is also available:

```bash
node scripts/translate-locales.js de fr es ja
```

This translates `locales/nl.json` to the requested codes via Anthropic API. Review the output before committing. Merged translations go live on [ourpatientvoice.org](https://ourpatientvoice.org/).

## Moderation

Reviews are not pre-moderated. The takedown request flow logs requests in the `takedown_verzoeken` table. Reasons to remove a story:

- Personal attacks on named individuals beyond describing what happened
- Verifiably false factual claims
- The patient who wrote it asks for it back

Implement your own moderation policy as you fork. There is no central moderator.

## What this isn't

- Not a substitute for a formal complaint (PVP, klachtencommissie, IGJ in NL)
- Not factual research — stories are personal experiences
- Not a place for personal attacks or doxxing

## Crisis

If you're struggling now: in NL, **113 Suicide Prevention** at 113 / 0800-0113, free, day and night. Immediate danger: 112. Outside NL: search "crisis line" + your country.

## Licence

MIT. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
