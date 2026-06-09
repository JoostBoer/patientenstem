const path = require('path');
const fs = require('fs');
const express = require('express');

// Minimal .env loader (no dotenv dep)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"](.*)['"]$/, '$1');
  }
}

const { db, seedInstellingen } = require('./db');
const i18n = require('./i18n');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(i18n.middleware);

app.locals.siteNaamFallback = 'Patiëntenstem';
app.locals.GITHUB_URL = process.env.GITHUB_URL || 'https://github.com/';
app.locals.SITE_URL = (process.env.SITE_URL || 'https://ourpatientvoice.org').replace(/\/$/, '');
app.locals.DEFAULT_LOCALE = i18n.DEFAULT_LOCALE;

const stmts = {
  alleInstellingen: db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM reviews r WHERE r.instelling_id = i.id AND r.status = 'gepubliceerd') AS aantal_reviews,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.instelling_id = i.id AND r.status = 'gepubliceerd') AS gemiddelde
    FROM instellingen i
    ORDER BY i.naam
  `),
  instellingBySlug: db.prepare(`SELECT * FROM instellingen WHERE slug = ?`),
  alleSlugs: db.prepare(`SELECT slug FROM instellingen ORDER BY naam`),
  reviewsForInstelling: db.prepare(`
    SELECT * FROM reviews
    WHERE instelling_id = ? AND status = 'gepubliceerd'
    ORDER BY created_at DESC
  `),
  reviewById: db.prepare(`SELECT * FROM reviews WHERE id = ?`),
  insertReview: db.prepare(`
    INSERT INTO reviews (instelling_id, rating, titel, ervaring, rol, periode, contact_email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  insertTakedown: db.prepare(`
    INSERT INTO takedown_verzoeken (review_id, reden, contact_email)
    VALUES (?, ?, ?)
  `),
};

const ensureFeedbackTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bericht TEXT NOT NULL,
    contact_email TEXT,
    locale TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
ensureFeedbackTable.run();
const insertFeedback = db.prepare(`INSERT INTO feedback (bericht, contact_email, locale, user_agent) VALUES (?, ?, ?, ?)`);

if (db.prepare('SELECT COUNT(*) AS n FROM instellingen').get().n === 0) {
  const n = seedInstellingen();
  console.log(`First boot: seeded ${n} instellingen`);
}

app.get('/', (req, res) => {
  const instellingen = stmts.alleInstellingen.all();
  res.render('home', { instellingen });
});

app.get('/over', (req, res) => {
  res.render('over');
});

app.get('/instelling/:slug', (req, res, next) => {
  const instelling = stmts.instellingBySlug.get(req.params.slug);
  if (!instelling) return next();
  const reviews = stmts.reviewsForInstelling.all(instelling.id);
  const gemiddelde = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;
  res.render('instelling', { instelling, reviews, gemiddelde, posted: req.query.posted === '1' });
});

app.get('/instelling/:slug/schrijven', (req, res, next) => {
  const instelling = stmts.instellingBySlug.get(req.params.slug);
  if (!instelling) return next();
  res.render('nieuw-review', { instelling, errors: [], values: {} });
});

app.post('/instelling/:slug/schrijven', (req, res, next) => {
  const instelling = stmts.instellingBySlug.get(req.params.slug);
  if (!instelling) return next();

  const { rating, ervaring, rol, periode, contact_email, hp } = req.body;

  if (hp && hp.trim() !== '') return res.redirect(`${res.locals.url('/instelling/' + instelling.slug)}?posted=1`);

  const t = res.locals.t;
  const errors = [];
  let r = parseInt(rating, 10);
  if (!r || r < 1 || r > 5) r = null;
  if (!ervaring || ervaring.trim().length < 10) errors.push(t('nieuw.fout_te_kort'));
  if (ervaring && ervaring.length > 8000) errors.push(t('nieuw.fout_te_lang'));

  if (errors.length) {
    return res.status(400).render('nieuw-review', {
      instelling,
      errors,
      values: { rating, ervaring, rol, periode, contact_email },
    });
  }

  stmts.insertReview.run(
    instelling.id,
    r,
    null,
    ervaring.trim(),
    (rol || '').trim().slice(0, 80) || null,
    (periode || '').trim().slice(0, 80) || null,
    (contact_email || '').trim().slice(0, 200) || null,
  );

  res.redirect(`${res.locals.url('/instelling/' + instelling.slug)}?posted=1`);
});

app.get('/review/:id/melden', (req, res, next) => {
  const review = stmts.reviewById.get(req.params.id);
  if (!review) return next();
  const instelling = db.prepare('SELECT * FROM instellingen WHERE id = ?').get(review.instelling_id);
  res.render('melden', { review, instelling, gemeld: false });
});

app.post('/review/:id/melden', (req, res, next) => {
  const review = stmts.reviewById.get(req.params.id);
  if (!review) return next();
  const instelling = db.prepare('SELECT * FROM instellingen WHERE id = ?').get(review.instelling_id);
  const reden = (req.body.reden || '').trim().slice(0, 2000);
  const email = (req.body.contact_email || '').trim().slice(0, 200) || null;
  if (reden.length < 10) {
    return res.status(400).render('melden', {
      review,
      instelling,
      gemeld: false,
      error: res.locals.t('melden.fout_te_kort'),
    });
  }
  stmts.insertTakedown.run(review.id, reden, email);
  res.render('melden', { review, instelling, gemeld: true });
});

app.post('/api/feedback', (req, res) => {
  const bericht = (req.body.bericht || '').trim().slice(0, 4000);
  if (bericht.length < 2) return res.status(400).json({ ok: false, error: 'leeg' });
  const email = (req.body.contact_email || '').trim().slice(0, 200) || null;
  insertFeedback.run(bericht, email, res.locals.locale || 'nl', (req.headers['user-agent'] || '').slice(0, 300));
  res.json({ ok: true });
});

app.post('/api/ai-rewrite', async (req, res) => {
  const tekst = (req.body.tekst || '').trim();
  if (tekst.length < 30) return res.status(400).json({ ok: false, error: 'te_kort' });
  if (tekst.length > 8000) return res.status(400).json({ ok: false, error: 'te_lang' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, error: 'no_api_key', hint: 'Set ANTHROPIC_API_KEY in .env to enable AI rewrites.' });

  const locale = res.locals.locale || 'nl';
  const LANG_NAMES = {
    nl: 'Dutch', en: 'English', de: 'German', fr: 'French', es: 'Spanish',
    it: 'Italian', pt: 'Portuguese', ja: 'Japanese', zh: 'Simplified Chinese',
    ar: 'Arabic', tr: 'Turkish', pl: 'Polish', ru: 'Russian', ko: 'Korean',
  };
  const langInstr = `Write in ${LANG_NAMES[locale] || 'the same language as the input'}.`;

  const system = [
    'You help patients with mental health treatment experiences write a more coherent version of their story.',
    'Strict rules:',
    '- Keep ALL content, facts, names, and emotional weight exactly as the writer expressed them.',
    '- Do NOT soften criticism. Do NOT add disclaimers. Do NOT remove names of clinicians or providers.',
    '- Do NOT add information that is not in the original.',
    '- Improve flow, paragraphing, and clarity. Fix obvious typos.',
    '- Keep the writer\'s voice. Do not make it sound corporate or clinical.',
    '- Output ONLY the rewritten story. No preface, no commentary, no markdown.',
    langInstr,
  ].join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: tekst }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('Anthropic API error:', r.status, err.slice(0, 200));
      return res.status(502).json({ ok: false, error: 'upstream' });
    }
    const data = await r.json();
    const out = data.content && data.content[0] && data.content[0].text;
    if (!out) return res.status(502).json({ ok: false, error: 'empty' });
    res.json({ ok: true, tekst: out.trim() });
  } catch (e) {
    console.error('AI rewrite failed:', e.message);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

// robots.txt — allow everything, point crawlers at the sitemap.
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${app.locals.SITE_URL}/sitemap.xml\n`);
});

// sitemap.xml — every indexable page in every locale, with hreflang alternates
// so search engines understand the language variants belong together.
app.get('/sitemap.xml', (req, res) => {
  const SITE = app.locals.SITE_URL;
  const locales = i18n.available;
  // Locale-agnostic base paths worth indexing (forms/report pages are left out).
  const paths = ['/', '/over'];
  for (const row of stmts.alleSlugs.all()) paths.push(`/instelling/${row.slug}`);

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urlFor = (loc, p) => `${SITE}/${loc}${p === '/' ? '' : p}`;

  const entries = [];
  for (const p of paths) {
    for (const loc of locales) {
      const alternates = locales
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(urlFor(l, p))}"/>`)
        .join('\n');
      entries.push(
        `  <url>\n` +
        `    <loc>${esc(urlFor(loc, p))}</loc>\n` +
        alternates + '\n' +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(urlFor(i18n.DEFAULT_LOCALE, p))}"/>\n` +
        `  </url>`
      );
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join('\n') + '\n' +
    `</urlset>\n`;

  res.type('application/xml').send(xml);
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Patiëntenstem draait op http://localhost:${PORT}`);
});
