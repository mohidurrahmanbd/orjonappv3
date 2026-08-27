import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DB_NAME, DB_VERSION, CREATE_TABLES_SQL } from './schema';
import { BUNDLED_CATEGORIES, BUNDLED_SUBCATEGORIES, BUNDLED_QUESTIONS } from './bundledData';

let sqlitePlugin: any = null;
let sqliteConnection: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;
let isInitialized = false;

// Fallback in-memory/web store for browser development environment pre-populated with bundled assets
class WebSQLiteFallback {
  private tables: Record<string, Map<string, any>> = {
    categories: new Map(),
    subcategories: new Map(),
    questions: new Map(),
    courses: new Map(),
    exams: new Map(),
    sync_meta: new Map()
  };

  constructor() {
    this.seedBundledData();
  }

  public seedBundledData() {
    // 1. Categories
    if (this.tables.categories.size === 0) {
      BUNDLED_CATEGORIES.forEach(c => {
        this.tables.categories.set(c.id, {
          id: c.id,
          name: c.name,
          subheading: c.subHeading || '',
          createdat: '2026-08-01T00:00:00Z',
          updatedat: '2026-08-01T00:00:00Z'
        });
      });
    }

    // 2. Subcategories
    if (this.tables.subcategories.size === 0) {
      BUNDLED_SUBCATEGORIES.forEach(s => {
        this.tables.subcategories.set(s.id, {
          id: s.id,
          name: s.name,
          parentcategory: s.parentCategory || '',
          parentcategoryid: s.parentCategoryId || '',
          date: s.date || '',
          subheading: s.subHeading || '',
          text: s.text || '',
          details: s.details || '',
          createdat: s.createdAt || '2026-08-01T00:00:00Z',
          updatedat: '2026-08-01T00:00:00Z'
        });
      });
    }

    // 3. Questions
    if (this.tables.questions.size === 0) {
      BUNDLED_QUESTIONS.forEach(q => {
        this.tables.questions.set(q.id, {
          id: q.id,
          text: q.text || '',
          optiona: q.optionA || '',
          optionb: q.optionB || '',
          optionc: q.optionC || '',
          optiond: q.optionD || '',
          correct: q.correct || 'Option A',
          explanation: q.explanation || '',
          category: q.category || '',
          subcategory: q.subcategory || '',
          categoriesjson: JSON.stringify(q.categories || []),
          subcategoriesjson: JSON.stringify(q.subcategories || []),
          csvcategory: q.csvCategory || '',
          csvsubcategory: q.csvSubcategory || '',
          examcategory: q.examCategory || '',
          examsubcategory: q.examSubcategory || '',
          exampathjson: JSON.stringify(q.examPath || []),
          subjectcategory: q.subjectCategory || '',
          subjectsubcategory: q.subjectSubcategory || '',
          subjectpathjson: JSON.stringify(q.subjectPath || []),
          commentsjson: JSON.stringify(q.comments || []),
          userexplanationsjson: JSON.stringify(q.userExplanations || []),
          createdat: q.createdAt || '2026-08-01T00:00:00Z',
          date: q.date || '',
          updatedat: '2026-08-01T00:00:00Z'
        });
      });
    }
  }

  async execute(sql: string): Promise<any> {
    return { changes: { changes: 0 } };
  }

  async run(statement: string, values: any[] = []): Promise<any> {
    const trimmed = statement.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('INSERT OR REPLACE INTO') || upper.startsWith('INSERT INTO')) {
      const match = trimmed.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const cols = match[2].split(',').map(c => c.trim().toLowerCase());
        const row: Record<string, any> = {};
        cols.forEach((col, idx) => {
          row[col] = values[idx];
        });
        if (this.tables[tableName]) {
          const id = row.id || row.key;
          if (id) {
            this.tables[tableName].set(id, row);
            return { changes: { changes: 1, lastId: id } };
          }
        }
      }
    } else if (upper.startsWith('UPDATE')) {
      const match = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const table = this.tables[tableName];
        if (table) {
          const id = values[values.length - 1];
          if (id && table.has(id)) {
            const existing = table.get(id);
            table.set(id, { ...existing });
            return { changes: { changes: 1 } };
          }
        }
      }
    } else if (upper.startsWith('DELETE FROM')) {
      const match = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (this.tables[tableName]) {
          if (trimmed.includes('WHERE id IN')) {
            values.forEach(v => this.tables[tableName].delete(v));
            return { changes: { changes: values.length } };
          } else if (trimmed.includes('WHERE id = ?') && values.length > 0) {
            this.tables[tableName].delete(values[0]);
            return { changes: { changes: 1 } };
          } else if (trimmed.includes('WHERE') && values.length > 0) {
            let count = 0;
            for (const [k, v] of this.tables[tableName].entries()) {
              if (v.type === values[0] || v.id === values[0]) {
                this.tables[tableName].delete(k);
                count++;
              }
            }
            return { changes: { changes: count } };
          } else {
            const count = this.tables[tableName].size;
            this.tables[tableName].clear();
            return { changes: { changes: count } };
          }
        }
      }
    }
    return { changes: { changes: 0 } };
  }

  async query(statement: string, values: any[] = []): Promise<{ values?: any[] }> {
    const trimmed = statement.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('SELECT')) {
      const fromMatch = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      if (fromMatch) {
        const tableName = fromMatch[1].toLowerCase();
        const table = this.tables[tableName];
        if (!table) return { values: [] };

        let rows = Array.from(table.values());

        // Count query
        if (trimmed.includes('COUNT(*)')) {
          if (trimmed.includes('WHERE category = ? AND subcategory = ?') && values.length >= 2) {
            rows = rows.filter(r => r.category === values[0] && r.subcategory === values[1]);
          } else if (trimmed.includes('WHERE category = ?') && values.length >= 1) {
            rows = rows.filter(r => r.category === values[0]);
          } else if (trimmed.includes('WHERE subcategory = ?') && values.length >= 1) {
            rows = rows.filter(r => r.subcategory === values[0]);
          }
          return { values: [{ count: rows.length }] };
        }

        // Simple ID IN query
        if (trimmed.includes('WHERE id IN')) {
          const idSet = new Set(values);
          rows = rows.filter(r => idSet.has(r.id));
          return { values: rows };
        }

        // Simple key filter (sync_meta)
        if (trimmed.includes('WHERE key = ?') && values[0]) {
          const single = table.get(values[0]);
          return { values: single ? [single] : [] };
        }

        // Simple ID filter
        if (trimmed.includes('WHERE id = ?') && values[0]) {
          const single = table.get(values[0]);
          if (trimmed.includes("AND type = 'live'")) {
            return { values: single && single.type === 'live' ? [single] : [] };
          }
          if (trimmed.includes("AND type = 'routine'")) {
            return { values: single && single.type === 'routine' ? [single] : [] };
          }
          return { values: single ? [single] : [] };
        }

        // Type filter (for exams table)
        if (trimmed.includes("WHERE type = 'live'")) {
          rows = rows.filter(r => r.type === 'live');
        } else if (trimmed.includes("WHERE type = 'routine'")) {
          rows = rows.filter(r => r.type === 'routine');
        } else if (trimmed.includes('WHERE type = ?') && values[0]) {
          rows = rows.filter(r => r.type === values[0]);
        }

        // Category filter
        if (trimmed.includes('WHERE category = ?') && values[0]) {
          rows = rows.filter(r => r.category === values[0]);
        }

        // Subcategory filter
        if (trimmed.includes('WHERE subcategory = ?') && values[0]) {
          rows = rows.filter(r => r.subcategory === values[0]);
        }

        // Parent Category filter
        if (trimmed.includes('WHERE parentCategory = ?') && values[0]) {
          rows = rows.filter(r => r.parentcategory === values[0] || r.parentCategory === values[0]);
        }

        // Search query
        if (trimmed.includes('WHERE text LIKE ?')) {
          const pattern = (values[0] || '').replace(/%/g, '').toLowerCase();
          rows = rows.filter(r => 
            (r.text && r.text.toLowerCase().includes(pattern)) ||
            (r.category && r.category.toLowerCase().includes(pattern)) ||
            (r.subcategory && r.subcategory.toLowerCase().includes(pattern)) ||
            (r.explanation && r.explanation.toLowerCase().includes(pattern))
          );
        }

        // Limit & offset
        const limitMatch = trimmed.match(/LIMIT\s+(\?|\d+)(?:\s+OFFSET\s+(\?|\d+))?/i);
        if (limitMatch) {
          let limit = 5000;
          let offset = 0;
          if (limitMatch[1] === '?') {
            limit = Number(values[values.length - (limitMatch[2] === '?' ? 2 : 1)]) || 5000;
          } else {
            limit = parseInt(limitMatch[1], 10);
          }
          if (limitMatch[2] === '?') {
            offset = Number(values[values.length - 1]) || 0;
          } else if (limitMatch[2]) {
            offset = parseInt(limitMatch[2], 10);
          }
          rows = rows.slice(offset, offset + limit);
        }

        return { values: rows };
      }
    }
    return { values: [] };
  }

  async close(): Promise<void> {}
}

const webFallbackInstance = new WebSQLiteFallback();

/**
 * On first launch, detect whether local SQLite database exists;
 * if not, copy questions.db from APK assets to local storage.
 */
export async function initSQLite(): Promise<SQLiteDBConnection | WebSQLiteFallback> {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    webFallbackInstance.seedBundledData();
    return webFallbackInstance;
  }

  try {
    if (!sqliteConnection) {
      sqlitePlugin = CapacitorSQLite;
      sqliteConnection = new SQLiteConnection(sqlitePlugin);
    }

    // Check if database exists
    let dbExists = false;
    try {
      const isDb = await sqliteConnection.isDatabase(DB_NAME);
      dbExists = Boolean(isDb?.result);
    } catch {
      dbExists = false;
    }

    // If database does not exist on device, copy questions.db from APK assets
    if (!dbExists) {
      console.log(`[SQLite] First launch detected: copying bundled ${DB_NAME} from APK assets...`);
      try {
        await sqliteConnection.copyFromAssets(false);
        console.log(`[SQLite] Successfully copied bundled ${DB_NAME} from APK assets.`);
      } catch (copyErr) {
        console.warn(`[SQLite] copyFromAssets notice (will create tables if needed):`, copyErr);
      }
    }

    // Open connection
    const isConn = await sqliteConnection.isConnection(DB_NAME, false);
    if (isConn?.result) {
      dbConnection = await sqliteConnection.retrieveConnection(DB_NAME, false);
    } else {
      dbConnection = await sqliteConnection.createConnection(
        DB_NAME,
        false,
        'no-encryption',
        DB_VERSION,
        false
      );
    }

    await dbConnection.open();

    // Run schema creation DDL (IF NOT EXISTS ensures bundled data is preserved)
    await dbConnection.execute(CREATE_TABLES_SQL);

    // Safely ensure migration columns exist on existing databases
    try { await dbConnection.execute('ALTER TABLE categories ADD COLUMN version INTEGER DEFAULT 1;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE categories ADD COLUMN deletedAt TEXT;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE subcategories ADD COLUMN version INTEGER DEFAULT 1;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE subcategories ADD COLUMN deletedAt TEXT;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE questions ADD COLUMN version INTEGER DEFAULT 1;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE questions ADD COLUMN deletedAt TEXT;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE courses ADD COLUMN version INTEGER DEFAULT 1;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE courses ADD COLUMN deletedAt TEXT;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE exams ADD COLUMN version INTEGER DEFAULT 1;'); } catch {}
    try { await dbConnection.execute('ALTER TABLE exams ADD COLUMN deletedAt TEXT;'); } catch {}
    try { await dbConnection.execute('CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'); } catch {}

    isInitialized = true;
    console.log(`[SQLite] Database ${DB_NAME} initialized and ready.`);
    return dbConnection;
  } catch (err) {
    console.error(`[SQLite] Error initializing SQLite database ${DB_NAME}:`, err);
    return webFallbackInstance;
  }
}

export async function getSQLiteDatabase(): Promise<SQLiteDBConnection | WebSQLiteFallback> {
  if (dbConnection && isInitialized) {
    return dbConnection;
  }
  return initSQLite();
}

export async function closeSQLiteDatabase(): Promise<void> {
  if (dbConnection && sqliteConnection) {
    try {
      await sqliteConnection.closeConnection(DB_NAME, false);
      dbConnection = null;
      isInitialized = false;
    } catch (e) {
      console.warn('[SQLite] Error closing connection:', e);
    }
  }
}

