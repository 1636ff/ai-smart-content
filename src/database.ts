import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'engine.db');

let db;
export function getDb() {
  if (!db) { db = new Database(DB_PATH); db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); initSchema(db); }
  return db;
}
function initSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS keywords (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL UNIQUE, search_volume INTEGER DEFAULT 0, competition_score REAL DEFAULT 0, difficulty_score REAL DEFAULT 0, cpc REAL DEFAULT 0, trend_data TEXT, opportunity_score REAL DEFAULT 0, status TEXT DEFAULT 'discovered', related_keywords TEXT, source TEXT, discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword_id INTEGER REFERENCES keywords(id), title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, outline TEXT, content TEXT, seo_score REAL DEFAULT 0, word_count INTEGER DEFAULT 0, affiliate_links TEXT, status TEXT DEFAULT 'draft', published_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS revenue (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, source TEXT NOT NULL, impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, revenue REAL DEFAULT 0, article_id INTEGER REFERENCES articles(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS traffic (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, article_id INTEGER REFERENCES articles(id), pageviews INTEGER DEFAULT 0, unique_visitors INTEGER DEFAULT 0, avg_time_on_page REAL DEFAULT 0, bounce_rate REAL DEFAULT 0, source TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS task_log (id INTEGER PRIMARY KEY AUTOINCREMENT, task_name TEXT NOT NULL, status TEXT NOT NULL, details TEXT, started_at DATETIME, completed_at DATETIME, error TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
}