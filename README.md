# Patiëntenstem

> An open-source platform where psychiatric patients can share their experiences. Anonymously. With voice or text. AI helps if you want it. Eleven languages out of the box.

Patients in psychiatric care are not always heard. Especially not when admitted, or under involuntary treatment. Most clinicians have good intentions, but good intentions don't prevent harm. Patient stories can.

This is the software. The mission is bigger than the code.

## Looking for someone to pick this up

This was built in one Sunday morning by a person who had a hard experience in a Dutch psychiatric clinic. The intention is to give patients a voice without forcing them through a complaint procedure or a lawyer. The code is here. The licence is MIT.

If this matters to you and you want to host it, fork it, run it for your country or your context: **please do**. Open an issue if you'd like to talk first.

## What it does

- Anonymous experience reviews per psychiatric provider (10 large Dutch providers seeded; trivial to add more)
- **Microphone input** in the form and feedback widget (Web Speech API, no server transcription, NL/EN voice recognition built in, more via browser)
- **AI rewrite** that takes a written or spoken story and proposes a more coherent version while keeping all content, names and emotional weight (Anthropic API)
- **Floating feedback bubble** on every page so users can suggest improvements
- **11 languages** out of the box (NL, EN, DE, FR, ES, IT, PT, JA, ZH, AR, PL, TR — auto-translated from Dutch via Anthropic and reviewable as JSON files)
- No accounts, no tracking, no advertising, no external scripts beyond Google Fonts (removable)
- Honeypot anti-spam, takedown request flow for moderation

## Run it locally

Requires Node.js 18+.

```bash
git clone <this-repo> patientenstem
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

Edit `seeds/instellingen.json`, add a row, send a PR. Or open an issue.

## Adding a language

Easiest path: copy `locales/en.json` to `locales/<your-code>.json`, translate the values, send a PR.

Auto-translate is also available:

```bash
node scripts/translate-locales.js de fr es ja
```

This translates `locales/nl.json` to the requested codes via Anthropic API. Review the output before committing.

## Deployment

Anything that runs Node and has persistent disk works. The whole app is one process and a SQLite file. Suggested:

- VPS with `pm2` or systemd
- Fly.io / Railway / Render
- Run behind a reverse proxy (nginx / Caddy) for HTTPS

Set `ANTHROPIC_API_KEY` in environment for AI rewrite. Set `GITHUB_URL` to your repo URL.

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
