const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'leadflow.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notion_token TEXT NOT NULL DEFAULT '',
      notion_database_id TEXT NOT NULL DEFAULT '',
      wa_template TEXT NOT NULL DEFAULT 'Halo, saya {nama} tertarik produk {produk}',
      current_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cs_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      order_weight INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      product TEXT NOT NULL,
      assigned_cs TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'PENDING'
    );
  `);

  // Seed settings if empty
  const stmt = db.prepare('SELECT COUNT(*) as count FROM settings');
  const count = stmt.get().count;
  if (count === 0) {
    db.prepare('INSERT INTO settings (notion_token, notion_database_id, wa_template, current_index) VALUES (?, ?, ?, ?)').run('', '', 'Halo, saya {nama} tertarik produk {produk}', 0);
  }
}

initDb();

module.exports = db;
