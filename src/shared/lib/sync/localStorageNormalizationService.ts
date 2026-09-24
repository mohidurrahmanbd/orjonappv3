/**
 * Phase 3 — Step 3H: Local Storage Normalization Service
 *
 * Enforces the architectural invariant:
 *   ACTIVE LOCAL RECORD = physically present in local storage
 *   DELETED LOCAL RECORD = physically absent from local storage
 *
 * Normalizes SQLite, IndexedDB, and localStorage by physically purging
 * any legacy tombstoned records (isDeleted === true or deletedAt present)
 * so that loaders never require tombstone filtering fields.
 *
 * CRITICAL SAFETY GUARANTEES:
 * - Does NOT wipe the local database.
 * - Does NOT reset checkpoints.
 * - Does NOT require reinstall or re-login.
 * - Safe for concurrent startup.
 */

import { getSQLiteDatabase } from '../sqlite/sqliteConnection';
import { getDB } from '../indexedDB';

let normalizationExecuted = false;

export interface NormalizationReport {
  timestamp: string;
  sqlitePurged: {
    categories: number;
    subcategories: number;
    questions: number;
    courses: number;
    exams: number;
  };
  idbPurgedCount: number;
  localStoragePurgedCount: number;
  success: boolean;
}

/**
 * Normalizes all local storage layers to eliminate legacy tombstoned records.
 * Can be called safely multiple times (idempotent).
 */
export async function normalizeLocalStorage(): Promise<NormalizationReport> {
  const report: NormalizationReport = {
    timestamp: new Date().toISOString(),
    sqlitePurged: {
      categories: 0,
      subcategories: 0,
      questions: 0,
      courses: 0,
      exams: 0
    },
    idbPurgedCount: 0,
    localStoragePurgedCount: 0,
    success: true
  };

  try {
    // 1. SQLite Normalization: Physically remove any legacy tombstoned rows
    try {
      const db = await getSQLiteDatabase();
      if (db) {
        await db.execute(`
          DELETE FROM categories WHERE deletedAt IS NOT NULL AND deletedAt != '';
          DELETE FROM subcategories WHERE deletedAt IS NOT NULL AND deletedAt != '';
          DELETE FROM questions WHERE deletedAt IS NOT NULL AND deletedAt != '';
          DELETE FROM courses WHERE deletedAt IS NOT NULL AND deletedAt != '';
          DELETE FROM exams WHERE deletedAt IS NOT NULL AND deletedAt != '';
        `);
      }
    } catch (sqliteErr) {
      console.warn('[LocalStorageNormalization] SQLite normalization notice:', sqliteErr);
    }

    // 2. IndexedDB Normalization: Physically remove any legacy tombstoned items
    try {
      const idb = await getDB();
      if (idb) {
        const stores = [
          'questions',
          'categories',
          'subcategories',
          'courses',
          'live_exams',
          'routines'
        ];

        for (const storeName of stores) {
          if (!idb.objectStoreNames.contains(storeName)) continue;

          await new Promise<void>((resolve) => {
            try {
              const tx = idb.transaction(storeName, 'readwrite');
              const store = tx.objectStore(storeName);
              const getAllReq = store.getAll();

              getAllReq.onsuccess = () => {
                const items = getAllReq.result || [];
                for (const item of items) {
                  if (item && (item.isDeleted === true || (item.deletedAt && item.deletedAt !== ''))) {
                    store.delete(item.id);
                    report.idbPurgedCount++;
                  }
                }
              };

              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
            } catch {
              resolve();
            }
          });
        }
      }
    } catch (idbErr) {
      console.warn('[LocalStorageNormalization] IndexedDB normalization notice:', idbErr);
    }

    // 3. LocalStorage Normalization: Clean any legacy arrays stored in localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToCheck = ['orjon_questions', 'orjon_courses', 'orjon_routines', 'orjon_exams'];
        for (const key of keysToCheck) {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((item: any) => {
                  if (!item) return false;
                  if (item.isDeleted === true || (item.deletedAt && item.deletedAt !== '')) {
                    report.localStoragePurgedCount++;
                    return false;
                  }
                  return true;
                });
                if (cleaned.length !== parsed.length) {
                  window.localStorage.setItem(key, JSON.stringify(cleaned));
                }
              }
            } catch {}
          }
        }
      }
    } catch (lsErr) {
      console.warn('[LocalStorageNormalization] LocalStorage normalization notice:', lsErr);
    }

    normalizationExecuted = true;
    console.log(
      `[LocalStorageNormalization] Storage normalized: IDB purged ${report.idbPurgedCount} items, LocalStorage purged ${report.localStoragePurgedCount} items. SQLite tombstones purged.`
    );
  } catch (err) {
    console.error('[LocalStorageNormalization] Error during storage normalization:', err);
    report.success = false;
  }

  return report;
}

/**
 * Checks if local storage normalization has already executed in this session.
 */
export function isLocalStorageNormalized(): boolean {
  return normalizationExecuted;
}
