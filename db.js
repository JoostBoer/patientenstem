const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'patientenstem.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS instellingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    naam TEXT NOT NULL,
    aanbieder TEXT,
    plaats TEXT,
    type TEXT,
    beschrijving TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instelling_id INTEGER,
    behandelaar_id INTEGER,
    rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    titel TEXT,
    ervaring TEXT NOT NULL,
    rol TEXT,
    periode TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'gepubliceerd',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (instelling_id) REFERENCES instellingen(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_instelling ON reviews(instelling_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

  CREATE TABLE IF NOT EXISTS takedown_verzoeken (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    reden TEXT NOT NULL,
    contact_email TEXT,
    afgehandeld INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
  );

  -- Clinicians (BIG-registered professionals). Professional fields ONLY, by design:
  -- name + role + optional BIG number + the provider they work at. No private-life data.
  -- Entries are added deliberately (seed/PR), never created from the public form,
  -- so the platform cannot be used to spin up a profile of an arbitrary person.
  CREATE TABLE IF NOT EXISTS behandelaars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    naam TEXT NOT NULL,
    functie TEXT,
    big_nummer TEXT,
    instelling_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (instelling_id) REFERENCES instellingen(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_behandelaars_instelling ON behandelaars(instelling_id);

  -- Right of reply: a clinician's response to a specific review. Held in a
  -- moderation queue ('ingediend') with an identity note, published only after a
  -- maintainer verifies the responder really is that clinician.
  CREATE TABLE IF NOT EXISTS weerwoorden (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    tekst TEXT NOT NULL,
    identiteit_notitie TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'ingediend',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_weerwoorden_review ON weerwoorden(review_id);
  CREATE INDEX IF NOT EXISTS idx_weerwoorden_status ON weerwoorden(status);
`);

// Migrate older reviews tables to the current shape: optional rating, optional
// instelling_id, and a behandelaar_id column (a review targets an institution
// and/or a clinician). Rebuild only when something is actually out of date.
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'").get();
  const sql = (tableInfo && tableInfo.sql) || '';
  const needsRebuild =
    /rating INTEGER NOT NULL/.test(sql) ||
    /instelling_id INTEGER NOT NULL/.test(sql) ||
    !/behandelaar_id/.test(sql);
  if (sql && needsRebuild) {
    db.exec(`
      BEGIN;
      ALTER TABLE reviews RENAME TO reviews_old;
      CREATE TABLE reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instelling_id INTEGER,
        behandelaar_id INTEGER,
        rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
        titel TEXT,
        ervaring TEXT NOT NULL,
        rol TEXT,
        periode TEXT,
        contact_email TEXT,
        status TEXT NOT NULL DEFAULT 'gepubliceerd',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (instelling_id) REFERENCES instellingen(id) ON DELETE CASCADE
      );
      INSERT INTO reviews (id, instelling_id, rating, titel, ervaring, rol, periode, contact_email, status, created_at)
        SELECT id, instelling_id, rating, titel, ervaring, rol, periode, contact_email, status, created_at FROM reviews_old;
      DROP TABLE reviews_old;
      CREATE INDEX IF NOT EXISTS idx_reviews_instelling ON reviews(instelling_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
      COMMIT;
    `);
    console.log('Migrated reviews table to current schema');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reviews_behandelaar ON reviews(behandelaar_id)`);
} catch (e) {
  console.warn('Reviews migration failed:', e.message);
}

function seedInstellingen() {
  const seedPath = path.join(__dirname, 'seeds', 'instellingen.json');
  const items = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const insert = db.prepare(`
    INSERT INTO instellingen (slug, naam, aanbieder, plaats, type, beschrijving)
    VALUES (@slug, @naam, @aanbieder, @plaats, @type, @beschrijving)
    ON CONFLICT(slug) DO UPDATE SET
      naam = excluded.naam,
      aanbieder = excluded.aanbieder,
      plaats = excluded.plaats,
      type = excluded.type,
      beschrijving = excluded.beschrijving
  `);

  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  tx(items);

  return items.length;
}

// Clinicians are seeded from seeds/behandelaars.json when present. The file ships
// empty on purpose: real people are added deliberately, via a reviewed PR.
function seedBehandelaars() {
  const seedPath = path.join(__dirname, 'seeds', 'behandelaars.json');
  if (!fs.existsSync(seedPath)) return 0;
  const items = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  if (!Array.isArray(items) || items.length === 0) return 0;

  const findInstelling = db.prepare(`SELECT id FROM instellingen WHERE slug = ?`);
  const insert = db.prepare(`
    INSERT INTO behandelaars (slug, naam, functie, big_nummer, instelling_id)
    VALUES (@slug, @naam, @functie, @big_nummer, @instelling_id)
    ON CONFLICT(slug) DO UPDATE SET
      naam = excluded.naam,
      functie = excluded.functie,
      big_nummer = excluded.big_nummer,
      instelling_id = excluded.instelling_id
  `);

  const tx = db.transaction((rows) => {
    for (const row of rows) {
      const instelling = row.instelling_slug ? findInstelling.get(row.instelling_slug) : null;
      insert.run({
        slug: row.slug,
        naam: row.naam,
        functie: row.functie || null,
        big_nummer: row.big_nummer || null,
        instelling_id: instelling ? instelling.id : null,
      });
    }
  });
  tx(items);
  return items.length;
}

if (require.main === module && process.argv.includes('--seed')) {
  const n = seedInstellingen();
  const m = seedBehandelaars();
  console.log(`Seeded ${n} instellingen and ${m} behandelaars into ${DB_PATH}`);
  process.exit(0);
}

module.exports = { db, seedInstellingen, seedBehandelaars };
