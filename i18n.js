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

// The locale to use when none is present in the URL path:
// explicit ?lang override (back-compat) > cookie > Accept-Language > default.
function preferredLocale(req) {
  const fromQuery = req.query && req.query.lang;
  if (fromQuery && dictionaries[fromQuery]) return fromQuery;
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.lang && dictionaries[cookies.lang]) return cookies.lang;
  const accept = (req.headers['accept-language'] || '').toLowerCase();
  for (const part of accept.split(',')) {
    const code = part.trim().slice(0, 2);
    if (dictionaries[code]) return code;
  }
  return DEFAULT_LOCALE;
}

// First path segment, if it is a known locale (e.g. "/nl/over" -> "nl").
function localeFromPath(pathname) {
  const seg = pathname.split('/')[1];
  return dictionaries[seg] ? seg : null;
}

function setLocals(res, locale, basePath) {
  res.locals.locale = locale;
  res.locals.locales = available;
  res.locals.basePath = basePath; // path WITHOUT the /<locale> prefix, e.g. "/over"
  res.locals.t = makeT(locale);
  // Build an in-locale link: url('/over') -> '/nl/over', url('/') -> '/nl'.
  res.locals.url = function (p) {
    if (!p || p === '/') return '/' + locale;
    return '/' + locale + p;
  };
  // Build the same page in another locale (for the language switcher).
  res.locals.altUrl = function (code, p) {
    const bp = p === undefined ? basePath : p;
    if (!bp || bp === '/') return '/' + code;
    return '/' + code + bp;
  };
}

function middleware(req, res, next) {
  const pathLocale = localeFromPath(req.path);

  if (pathLocale) {
    // Strip the /<locale> prefix so the existing routes keep matching,
    // preserving any query string.
    let basePath = req.path.slice(1 + pathLocale.length);
    if (basePath === '') basePath = '/';
    const qi = req.url.indexOf('?');
    const search = qi >= 0 ? req.url.slice(qi) : '';
    req.url = basePath + search;

    setLocals(res, pathLocale, basePath);
    res.cookie('lang', pathLocale, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    return next();
  }

  // No locale in the path. For GET/HEAD page requests, redirect to the
  // locale-prefixed canonical URL. Skip asset-like paths (those with an extension).
  const isGet = req.method === 'GET' || req.method === 'HEAD';
  const looksLikeFile = /\.[a-z0-9]+$/i.test(req.path);

  if (isGet && !looksLikeFile) {
    const target = preferredLocale(req);
    const qi = req.url.indexOf('?');
    let search = qi >= 0 ? req.url.slice(qi) : '';
    // Drop the now-redundant ?lang= param from the redirect target.
    if (search) {
      const sp = new URLSearchParams(search.slice(1));
      sp.delete('lang');
      const rest = sp.toString();
      search = rest ? '?' + rest : '';
    }
    const dest = '/' + target + (req.path === '/' ? '' : req.path) + search;
    res.cookie('lang', target, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    return res.redirect(302, dest);
  }

  // Non-GET (e.g. an API POST) or an asset-like path: serve without redirecting.
  setLocals(res, preferredLocale(req), req.path);
  next();
}

module.exports = { middleware, makeT, available, DEFAULT_LOCALE, dictionaries };
