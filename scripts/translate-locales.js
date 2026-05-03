/* Auto-translate locales/nl.json to other languages via Anthropic API.
 * Usage:
 *   node scripts/translate-locales.js de fr es it pt ja zh ar ru tr pl
 * Requires ANTHROPIC_API_KEY in .env
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"](.*)['"]$/, '$1');
  }
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

const SOURCE = path.join(__dirname, '..', 'locales', 'nl.json');
const TARGETS_DIR = path.join(__dirname, '..', 'locales');

const LANG_NAMES = {
  de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
  ja: 'Japanese', zh: 'Simplified Chinese', ar: 'Arabic', ru: 'Russian',
  tr: 'Turkish', pl: 'Polish', ko: 'Korean', sv: 'Swedish', da: 'Danish',
  no: 'Norwegian', fi: 'Finnish',
};

async function translate(sourceJson, targetCode) {
  const targetName = LANG_NAMES[targetCode] || targetCode;
  const system = [
    'You translate UI strings for a sensitive open-source platform where psychiatric patients share their experiences.',
    'Rules:',
    '- Translate VALUES, not keys. Preserve JSON structure exactly.',
    '- Keep placeholder tokens like {naam}, {n}, {site}, {pvp}, {igj}, {github} EXACTLY as-is.',
    '- Keep HTML tags like <strong>, <a href="...">...</a> intact.',
    '- Tone: warm, calm, respectful. Not corporate. Not medical-cold.',
    '- For "site.naam" (currently "Patiëntenstem"): translate it as a meaningful equivalent for the target language (e.g., "Patientvoice" in English, "Voix du Patient" in French). Keep it short.',
    '- For Dutch-only references like PVP / IGJ: keep them in original Dutch — they are Dutch institutions. Add a brief target-language gloss in parens if helpful.',
    '- Do NOT add disclaimers about translation quality.',
    '- Output ONLY the translated JSON, no preface, no markdown fences.',
    `- Target language: ${targetName}`,
  ].join('\n');

  const userMsg = 'Translate this Dutch UI JSON to ' + targetName + '. Output only the JSON.\n\n' + JSON.stringify(sourceJson, null, 2);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  let text = data.content[0].text.trim();
  text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

async function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) { console.error('Usage: node scripts/translate-locales.js de fr es ...'); process.exit(1); }

  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

  for (const code of targets) {
    process.stdout.write(`Translating to ${code} (${LANG_NAMES[code] || code})... `);
    try {
      const translated = await translate(source, code);
      const outPath = path.join(TARGETS_DIR, `${code}.json`);
      fs.writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n', 'utf8');
      console.log('ok');
    } catch (e) {
      console.error('FAILED:', e.message);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
