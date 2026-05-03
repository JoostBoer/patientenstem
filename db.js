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
    instelling_id INTEGER NOT NULL,
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
`);

// Migrate: if existing reviews table had NOT NULL rating, rebuild it
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'").get();
  if (tableInfo && tableInfo.sql && /rating INTEGER NOT NULL/.test(tableInfo.sql)) {
    db.exec(`
      BEGIN;
      ALTER TABLE reviews RENAME TO reviews_old;
      CREATE TABLE reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instelling_id INTEGER NOT NULL,
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
      INSERT INTO reviews SELECT * FROM reviews_old;
      DROP TABLE reviews_old;
      CREATE INDEX IF NOT EXISTS idx_reviews_instelling ON reviews(instelling_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
      COMMIT;
    `);
    console.log('Migrated reviews table: rating is now optional');
  }
} catch (e) {
  console.warn('Migration check failed:', e.message);
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

if (require.main === module && process.argv.includes('--seed')) {
  const n = seedInstellingen();
  console.log(`Seeded ${n} instellingen into ${DB_PATH}`);
  process.exit(0);
}

module.exports = { db, seedInstellingen };
