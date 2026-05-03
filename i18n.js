const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, 'locales');
const DEFAULT_LOCALE = 'nl';

const dictionaries = {};
const available = [];

for (const file of fs.readdirSync(LOCALES_DIR)) {
  if (!file.endsWith('.json')) continue;
  const code = file.replace(/\.json$/, '');
  dictionaries[code] = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
  available.push(code);
}

function lookup(dict, key) {
  const parts = key.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

function makeT(locale) {
  const primary = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
  const fallback = dictionaries[DEFAULT_LOCALE];
  return function t(key, vars) {
    let value = lookup(primary, key);
    if (value === undefined) value = lookup(fallback, key);
    if (value === undefined) return key;
    if (typeof value !== 'string') return key;
    return interpolate(value, vars);
  };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

function detectLocale(req) {
  const fromQuery = req.query && req.query.lang;
  if (fromQuery && dictionaries[fromQuery]) return fromQuery;
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.lang && dictionaries[cookies.lang]) return cookies.lang;
  const accept = (req.headers['accept-language'] || '').toLowerCase();
  for (const code of available) {
    if (accept.startsWith(code) || accept.includes(`,${code}`) || accept.includes(` ${code}`)) return code;
  }
  return DEFAULT_LOCALE;
}

function middleware(req, res, next) {
  const locale = detectLocale(req);
  res.locals.locale = locale;
  res.locals.locales = available;
  res.locals.t = makeT(locale);
  if (req.query && req.query.lang && dictionaries[req.query.lang]) {
    res.cookie('lang', req.query.lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
  }
  next();
}

module.exports = { middleware, makeT, available, DEFAULT_LOCALE };
