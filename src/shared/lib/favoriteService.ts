import { Question, User } from '../types';

/**
 * Versioned schema identifier for favorite storage payload
 */
export const FAVORITE_STORAGE_SCHEMA_VERSION = 1;

/**
 * Storage key prefix for user-isolated local favorites
 */
const FAVORITE_STORAGE_KEY_PREFIX = 'orjon_mcq_favs_v1_';

/**
 * In-memory fallback cache when window.localStorage is not available
 */
const inMemoryFallbackCache: Record<string, Record<string, FavoriteMCQRecord>> = {};

/**
 * Minimal serializable snapshot of a question for offline reading
 */
export interface FavoriteQuestionSnapshot {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: 'Option A' | 'Option B' | 'Option C' | 'Option D' | string;
  explanation?: string;
  category?: string;
  subcategory?: string;
  categories?: string[];
  subcategories?: string[];
  csvCategory?: string;
  csvSubcategory?: string;
  subjectCategory?: string;
  subjectSubcategory?: string;
}

/**
 * Individual favorite question record
 */
export interface FavoriteMCQRecord {
  questionId: string;
  favoritedAt: number;        // UTC epoch timestamp in milliseconds (Date.now())
  dateKey: string;            // Local calendar date in YYYY-MM-DD format (e.g. "2026-10-24")
  subjectName: string;        // Resolved academic subject or top category for grouping
  chapterName?: string;       // Subcategory or chapter title if available
  questionSnapshot: FavoriteQuestionSnapshot;
}

/**
 * Complete root storage structure saved in localStorage
 */
export interface FavoriteStoragePayload {
  version: number;
  updatedAt: number;
  records: Record<string, FavoriteMCQRecord>; // Keyed by normalized questionId
}

/**
 * Derives a clean, safe, deterministic user identifier key from existing User properties.
 * Introduces zero network requests. Isolates favorites between accounts on shared devices.
 */
export const getCleanUserKey = (user?: Partial<User> | null): string => {
  if (!user) return 'guest';
  const rawKey =
    user.phone ||
    user.userId ||
    user.authUid ||
    user.id ||
    user.email ||
    user.name ||
    'guest';
  return String(rawKey).trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
};

/**
 * Computes the unique localStorage key for a given user identifier.
 */
export const getFavoriteStorageKey = (userKey?: string): string => {
  const sanitized = (userKey || 'guest').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
  return `${FAVORITE_STORAGE_KEY_PREFIX}${sanitized}`;
};

/**
 * Formats a local calendar date as "YYYY-MM-DD".
 * Uses local timezone to accurately reflect the user's active study day.
 */
export const getLocalDateKey = (timestamp: number = Date.now()): string => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Resolves a normalized subject name from question metadata.
 */
export const resolveSubjectName = (question: Partial<Question>, fallbackSubject?: string): string => {
  if (fallbackSubject && fallbackSubject.trim() && fallbackSubject !== 'সব প্রশ্ন') {
    return fallbackSubject.trim();
  }
  if (question.subjectCategory && question.subjectCategory.trim()) {
    return question.subjectCategory.trim();
  }
  if (question.csvCategory && question.csvCategory.trim()) {
    return question.csvCategory.trim();
  }
  if (question.category && question.category.trim()) {
    return question.category.trim();
  }
  if (Array.isArray(question.categories) && question.categories.length > 0) {
    const firstCat = question.categories.find(c => c && c.trim());
    if (firstCat) return firstCat.trim();
  }
  if (question.subcategory && question.subcategory.trim()) {
    return question.subcategory.trim();
  }
  return 'সাধারণ';
};

/**
 * Resolves a subcategory or chapter name from question metadata.
 */
export const resolveChapterName = (question: Partial<Question>): string | undefined => {
  if (question.subjectSubcategory && question.subjectSubcategory.trim()) {
    return question.subjectSubcategory.trim();
  }
  if (question.csvSubcategory && question.csvSubcategory.trim()) {
    return question.csvSubcategory.trim();
  }
  if (question.subcategory && question.subcategory.trim()) {
    return question.subcategory.trim();
  }
  if (Array.isArray(question.subcategories) && question.subcategories.length > 0) {
    const firstSub = question.subcategories.find(s => s && s.trim());
    if (firstSub) return firstSub.trim();
  }
  return undefined;
};

/**
 * Creates a minimal serializable snapshot sufficient for offline review.
 */
export const createQuestionSnapshot = (q: Question): FavoriteQuestionSnapshot => {
  return {
    id: String(q.id).trim(),
    text: q.text || '',
    optionA: q.optionA || '',
    optionB: q.optionB || '',
    optionC: q.optionC || '',
    optionD: q.optionD || '',
    correct: q.correct || 'Option A',
    explanation: q.explanation || '',
    category: q.category || '',
    subcategory: q.subcategory || '',
    categories: Array.isArray(q.categories) ? [...q.categories] : undefined,
    subcategories: Array.isArray(q.subcategories) ? [...q.subcategories] : undefined,
    csvCategory: q.csvCategory || undefined,
    csvSubcategory: q.csvSubcategory || undefined,
    subjectCategory: q.subjectCategory || undefined,
    subjectSubcategory: q.subjectSubcategory || undefined,
  };
};

/**
 * Loads all local favorites for a user from localStorage.
 * Handles malformed JSON, missing fields, schema verification, and fallback cache safely.
 */
export const loadLocalFavorites = (userKey?: string): Record<string, FavoriteMCQRecord> => {
  const storageKey = getFavoriteStorageKey(userKey);
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return inMemoryFallbackCache[storageKey] || {};
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const records: Record<string, FavoriteMCQRecord> = {};
    const rawRecords = parsed.records || parsed;

    if (rawRecords && typeof rawRecords === 'object') {
      for (const [key, val] of Object.entries(rawRecords)) {
        if (val && typeof val === 'object') {
          const rec = val as Partial<FavoriteMCQRecord>;
          const qId = String(rec.questionId || key).trim();
          if (qId && rec.questionSnapshot && typeof rec.questionSnapshot === 'object') {
            records[qId] = {
              questionId: qId,
              favoritedAt: typeof rec.favoritedAt === 'number' ? rec.favoritedAt : Date.now(),
              dateKey:
                typeof rec.dateKey === 'string' && rec.dateKey.trim()
                  ? rec.dateKey
                  : getLocalDateKey(rec.favoritedAt),
              subjectName:
                typeof rec.subjectName === 'string' && rec.subjectName.trim()
                  ? rec.subjectName.trim()
                  : 'সাধারণ',
              chapterName: typeof rec.chapterName === 'string' ? rec.chapterName.trim() : undefined,
              questionSnapshot: rec.questionSnapshot as FavoriteQuestionSnapshot,
            };
          }
        }
      }
    }
    inMemoryFallbackCache[storageKey] = records;
    return records;
  } catch (err) {
    console.warn('[FavoriteService] Failed to load local favorites:', err);
    return inMemoryFallbackCache[storageKey] || {};
  }
};

/**
 * Persists favorite records to localStorage safely.
 */
export const saveLocalFavorites = (
  userKey: string,
  records: Record<string, FavoriteMCQRecord>
): boolean => {
  const storageKey = getFavoriteStorageKey(userKey);
  inMemoryFallbackCache[storageKey] = records;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const payload: FavoriteStoragePayload = {
      version: FAVORITE_STORAGE_SCHEMA_VERSION,
      updatedAt: Date.now(),
      records,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[FavoriteService] Failed to persist local favorites to localStorage:', err);
    return false;
  }
};

/**
 * Fast O(1) check if a question is favorited.
 */
export const isQuestionFavorited = (
  favoritesMap: Record<string, FavoriteMCQRecord> | null | undefined,
  questionId?: string | number
): boolean => {
  if (!favoritesMap || questionId === undefined || questionId === null) return false;
  const stableId = String(questionId).trim();
  return !!favoritesMap[stableId];
};

/**
 * Adds a question to local favorites. Prevents duplicates using stable questionId mapping.
 */
export const addLocalFavorite = (
  userKey: string,
  question: Question,
  fallbackSubject?: string,
  existingMap?: Record<string, FavoriteMCQRecord>
): Record<string, FavoriteMCQRecord> => {
  if (!question || question.id === undefined || question.id === null) {
    return existingMap || {};
  }
  const stableId = String(question.id).trim();
  if (!stableId) return existingMap || {};

  const currentMap = existingMap || loadLocalFavorites(userKey);
  const now = Date.now();
  const record: FavoriteMCQRecord = {
    questionId: stableId,
    favoritedAt: now,
    dateKey: getLocalDateKey(now),
    subjectName: resolveSubjectName(question, fallbackSubject),
    chapterName: resolveChapterName(question),
    questionSnapshot: createQuestionSnapshot(question),
  };

  const nextMap: Record<string, FavoriteMCQRecord> = {
    ...currentMap,
    [stableId]: record,
  };
  saveLocalFavorites(userKey, nextMap);
  return nextMap;
};

/**
 * Removes a question from local favorites by stable questionId.
 */
export const removeLocalFavorite = (
  userKey: string,
  questionId: string | number,
  existingMap?: Record<string, FavoriteMCQRecord>
): Record<string, FavoriteMCQRecord> => {
  if (questionId === undefined || questionId === null) {
    return existingMap || {};
  }
  const stableId = String(questionId).trim();
  if (!stableId) return existingMap || {};

  const currentMap = existingMap || loadLocalFavorites(userKey);
  if (!currentMap[stableId]) {
    return currentMap;
  }

  const nextMap: Record<string, FavoriteMCQRecord> = { ...currentMap };
  delete nextMap[stableId];
  saveLocalFavorites(userKey, nextMap);
  return nextMap;
};

/**
 * Toggles a question in local favorites.
 * If present -> removes it.
 * If absent -> adds it with snapshot and timestamp.
 */
export const toggleLocalFavorite = (
  userKey: string,
  question: Question,
  fallbackSubject?: string,
  existingMap?: Record<string, FavoriteMCQRecord>
): Record<string, FavoriteMCQRecord> => {
  if (!question || question.id === undefined || question.id === null) {
    return existingMap || {};
  }
  const stableId = String(question.id).trim();
  if (!stableId) return existingMap || {};

  const currentMap = existingMap || loadLocalFavorites(userKey);
  if (currentMap[stableId]) {
    return removeLocalFavorite(userKey, stableId, currentMap);
  } else {
    return addLocalFavorite(userKey, question, fallbackSubject, currentMap);
  }
};

export interface SubjectGroupedFavorites {
  subjectName: string;
  totalCount: number;
  records: FavoriteMCQRecord[];
}

export interface DateGroupedFavorites {
  dateKey: string;
  totalCount: number;
  subjects: SubjectGroupedFavorites[];
}

/**
 * Groups and sorts favorite records by Date (newest first) and then by Subject.
 * Inside each subject, records are sorted newest first.
 */
export const groupFavoritesByDateAndSubject = (
  recordsMap: Record<string, FavoriteMCQRecord> | null | undefined
): DateGroupedFavorites[] => {
  if (!recordsMap) return [];
  const records = Object.values(recordsMap).filter(
    r => r && r.questionId && r.questionSnapshot
  );
  if (records.length === 0) return [];

  // Group by dateKey
  const dateMap = new Map<string, FavoriteMCQRecord[]>();
  for (const rec of records) {
    const dKey = (rec.dateKey && rec.dateKey.trim()) ? rec.dateKey.trim() : getLocalDateKey(rec.favoritedAt);
    const existing = dateMap.get(dKey);
    if (existing) {
      existing.push(rec);
    } else {
      dateMap.set(dKey, [rec]);
    }
  }

  // Sort dates descending (newest first)
  const sortedDateKeys = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

  const result: DateGroupedFavorites[] = [];

  for (const dateKey of sortedDateKeys) {
    const dateRecords = dateMap.get(dateKey) || [];

    // Group by subjectName
    const subjectMap = new Map<string, FavoriteMCQRecord[]>();
    for (const rec of dateRecords) {
      const sName = (rec.subjectName && rec.subjectName.trim()) ? rec.subjectName.trim() : 'অন্যান্য';
      const existing = subjectMap.get(sName);
      if (existing) {
        existing.push(rec);
      } else {
        subjectMap.set(sName, [rec]);
      }
    }

    // Sort subjects deterministically
    const sortedSubjectNames = Array.from(subjectMap.keys()).sort((a, b) => {
      if (a === 'অন্যান্য') return 1;
      if (b === 'অন্যান্য') return -1;
      return a.localeCompare(b, 'bn');
    });

    const subjects: SubjectGroupedFavorites[] = sortedSubjectNames.map(sName => {
      const sRecords = subjectMap.get(sName) || [];
      // Sort newest first
      sRecords.sort((a, b) => b.favoritedAt - a.favoritedAt);
      return {
        subjectName: sName,
        totalCount: sRecords.length,
        records: sRecords,
      };
    });

    result.push({
      dateKey,
      totalCount: dateRecords.length,
      subjects,
    });
  }

  return result;
};

/**
 * Adapts a saved favorite snapshot to a standard Question shape for rendering.
 */
export const snapshotToQuestion = (record: FavoriteMCQRecord): Question => {
  const s = record.questionSnapshot;
  return {
    id: record.questionId,
    text: s.text,
    optionA: s.optionA,
    optionB: s.optionB,
    optionC: s.optionC,
    optionD: s.optionD,
    correct: (s.correct as any) || 'Option A',
    explanation: s.explanation || '',
    category: s.category || record.subjectName || '',
    subcategory: s.subcategory || record.chapterName || '',
    categories: s.categories,
    subcategories: s.subcategories,
    csvCategory: s.csvCategory,
    csvSubcategory: s.csvSubcategory,
    subjectCategory: s.subjectCategory || record.subjectName,
    subjectSubcategory: s.subjectSubcategory || record.chapterName,
  };
};

