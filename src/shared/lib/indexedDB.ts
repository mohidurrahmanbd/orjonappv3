import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Question, Course, LiveExam, Routine, CategoryItem, SubcategoryItem } from '../types';
import { 
  insertCourses as insertCoursesToSQLite, 
  deleteCourse as deleteCourseFromSQLite, 
  insertLiveExams as insertLiveExamsToSQLite, 
  deleteLiveExam as deleteLiveExamFromSQLite, 
  insertRoutines as insertRoutinesToSQLite, 
  deleteRoutine as deleteRoutineFromSQLite 
} from './sqlite/sqliteService';

const DB_NAME = 'OrjonQuestionsDB';
const DB_VERSION = 3;
const STORE_QUESTIONS = 'questions';
const STORE_COURSES = 'courses';
const STORE_LIVE_EXAMS = 'live_exams';
const STORE_ROUTINES = 'routines';
const STORE_CATEGORIES = 'categories';
const STORE_SUBCATEGORIES = 'subcategories';
const STORE_META = 'metadata';

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

export function getDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const idb = (event.target as IDBOpenDBRequest).result;
        if (!idb.objectStoreNames.contains(STORE_QUESTIONS)) {
          idb.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORE_COURSES)) {
          idb.createObjectStore(STORE_COURSES, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORE_LIVE_EXAMS)) {
          idb.createObjectStore(STORE_LIVE_EXAMS, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORE_ROUTINES)) {
          idb.createObjectStore(STORE_ROUTINES, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORE_CATEGORIES)) {
          idb.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORE_SUBCATEGORIES)) {
          idb.createObjectStore(STORE_SUBCATEGORIES, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORE_META)) {
          idb.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event: Event) => {
        const idb = (event.target as IDBOpenDBRequest).result;
        idb.onversionchange = () => {
          idb.close();
          dbPromise = null;
        };
        resolve(idb);
      };

      request.onerror = (event: Event) => {
        console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        dbPromise = null;
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (e) {
      console.warn('Exception opening IndexedDB:', e);
      dbPromise = null;
      reject(e);
    }
  });

  return dbPromise;
}

/**
 * Fetch all questions stored in local IndexedDB.
 */
export async function getQuestionsFromIDB(): Promise<Question[]> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_QUESTIONS, 'readonly');
      const store = tx.objectStore(STORE_QUESTIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        resolve(items as Question[]);
      };

      request.onerror = () => {
        console.warn('Error reading questions from IndexedDB:', request.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for getQuestions:', err);
    return [];
  }
}

/**
 * Get stored metadata for IndexedDB questions (e.g. lastSyncedAt timestamp).
 */
export async function getQuestionsMetaFromIDB(): Promise<{ lastSyncedAt: number; count: number; version?: number } | null> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get('questions_meta');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Update metadata timestamp (lastSyncedAt) in IndexedDB.
 */
export async function updateQuestionsMetaTimestamp(timestamp: number = Date.now()): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_QUESTIONS, STORE_META], 'readwrite');
      const qStore = tx.objectStore(STORE_QUESTIONS);
      const metaStore = tx.objectStore(STORE_META);

      const countReq = qStore.count();
      countReq.onsuccess = () => {
        metaStore.put({
          key: 'questions_meta',
          lastSyncedAt: timestamp,
          count: countReq.result || 0,
          version: 1
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Bulk save all questions to IndexedDB.
 */
export async function saveQuestionsToIDB(questions: Question[]): Promise<void> {
  if (!questions || !Array.isArray(questions)) return;
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_QUESTIONS, STORE_META], 'readwrite');
      const qStore = tx.objectStore(STORE_QUESTIONS);
      const metaStore = tx.objectStore(STORE_META);

      // Clear existing store and repopulate
      qStore.clear();

      for (const q of questions) {
        if (q && q.id !== undefined && q.id !== null) {
          qStore.put(q);
        }
      }

      metaStore.put({
        key: 'questions_meta',
        lastSyncedAt: Date.now(),
        count: questions.length,
        version: 1
      });

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => {
        console.warn('Error saving questions to IndexedDB:', e);
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for saveQuestions:', err);
  }
}

/**
 * Incremental upsert & delete in IndexedDB without wiping unchanged cached records.
 */
export async function upsertQuestionsToIDB(
  toUpsert: Question[],
  toRemoveIds: (string | number)[] = []
): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_QUESTIONS, STORE_META], 'readwrite');
      const qStore = tx.objectStore(STORE_QUESTIONS);
      const metaStore = tx.objectStore(STORE_META);

      for (const id of toRemoveIds) {
        if (id !== undefined && id !== null) {
          qStore.delete(id);
        }
      }

      for (const q of toUpsert) {
        if (q && q.id !== undefined && q.id !== null) {
          qStore.put(q);
        }
      }

      // Read current count or update metadata timestamp
      const countReq = qStore.count();
      countReq.onsuccess = () => {
        metaStore.put({
          key: 'questions_meta',
          lastSyncedAt: Date.now(),
          count: countReq.result || 0,
          version: 1
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => {
        console.warn('Error upserting questions to IndexedDB:', e);
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for upsertQuestions:', err);
  }
}

/**
 * Save or update a single question in IndexedDB.
 */
export async function saveSingleQuestionToIDB(question: Question): Promise<void> {
  if (!question || question.id === undefined) return;
  await upsertQuestionsToIDB([question], []);
}

/**
 * Delete a single question from IndexedDB.
 */
export async function deleteQuestionFromIDB(id: string | number): Promise<void> {
  if (!id) return;
  await upsertQuestionsToIDB([], [id]);
}

/**
 * Delete multiple questions from IndexedDB.
 */
export async function deleteMultipleQuestionsFromIDB(ids: (string | number)[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  await upsertQuestionsToIDB([], ids);
}

// Helper to normalize question categories from variations
export function normalizeQuestion(q: any): Question {
  let cat = (q.category || '').trim();
  const lower = cat.toLowerCase();
  if (
    lower === 'জব সলিউশন পরীক্ষা' ||
    lower === 'জব সলউশন পরিক্ষা' ||
    lower === 'জব সলউশন পরীক্ষা' ||
    lower === 'জব সলিউশন ব্যাংক' ||
    lower === 'job solution' ||
    lower === 'job solutions' ||
    lower === 'জব সলিউশন' ||
    lower === 'জব সলউশন'
  ) {
    cat = 'জব সলিউশন পরীক্ষা';
  } else if (
    lower === 'সাল ভিত্তিক জব সলিউশন' ||
    lower === 'সাল ভিক্তিক জব সলউশন' ||
    lower === 'সাল ভিত্তিক জব সল্যুশন' ||
    lower === 'year-based job solution' ||
    lower === 'সাল ভিত্তিক' ||
    lower === 'সাল ভিক্তিক'
  ) {
    cat = 'সাল ভিত্তিক জব সলিউশন';
  }

  return {
    ...q,
    id: String(q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
    category: cat
  } as Question;
}

/**
 * Perform incremental background sync with Firestore using timestamp (updatedAt > lastSyncedAt).
 * Downloads ONLY new, updated, or deleted records since lastSyncedAt.
 */
export async function performIncrementalSyncFromFirestore(
  onUpdate?: (updatedQuestions: Question[]) => void
): Promise<{ hasChanges: boolean; totalCount: number }> {
  try {
    const syncStartTime = Date.now();
    const meta = await getQuestionsMetaFromIDB();
    const lastSyncedAt = meta?.lastSyncedAt || 0;
    const localCachedQuestions = await getQuestionsFromIDB();

    // If local cache is missing or never synced, perform full initial sync
    if (lastSyncedAt === 0 || localCachedQuestions.length === 0) {
      const snap = await getDocs(collection(db, 'questions'));
      if (!snap.empty) {
        const fetched: Question[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.isDeleted) {
            fetched.push(normalizeQuestion({
              ...data,
              id: data.id || docSnap.id
            }));
          }
        });
        if (fetched.length > 0) {
          await saveQuestionsToIDB(fetched);
          if (onUpdate) onUpdate(fetched);
          return { hasChanges: true, totalCount: fetched.length };
        }
      }
      await updateQuestionsMetaTimestamp(syncStartTime);
      return { hasChanges: false, totalCount: localCachedQuestions.length };
    }

    // Query ONLY documents modified after lastSyncedAt
    const q = query(collection(db, 'questions'), where('updatedAt', '>', lastSyncedAt));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Zero bandwidth downloaded! Update lastSyncedAt timestamp so future queries only check after this point
      await updateQuestionsMetaTimestamp(syncStartTime);
      return { hasChanges: false, totalCount: localCachedQuestions.length };
    }

    const modifiedOrAdded: Question[] = [];
    const removedIds: (string | number)[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const qId = String(data.id || docSnap.id);
      if (data.isDeleted) {
        removedIds.push(qId);
      } else {
        modifiedOrAdded.push(normalizeQuestion({
          ...data,
          id: qId
        }));
      }
    });

    if (modifiedOrAdded.length > 0 || removedIds.length > 0) {
      await upsertQuestionsToIDB(modifiedOrAdded, removedIds);
      const freshlyMerged = await getQuestionsFromIDB();
      if (onUpdate) onUpdate(freshlyMerged);
      return { hasChanges: true, totalCount: freshlyMerged.length };
    }

    await updateQuestionsMetaTimestamp(syncStartTime);
    return { hasChanges: false, totalCount: localCachedQuestions.length };
  } catch (err) {
    console.warn('Incremental sync check error (using local cache):', err);
    return { hasChanges: false, totalCount: 0 };
  }
}

/**
 * Lazy-load questions for a specific category, subcategory, topic, or examId.
 * Cache-First: Checks IndexedDB cache first. If found locally, returns immediately with 0 Firestore reads.
 * If missing, queries Firestore for ONLY the specific requested category, subcategory, or examId.
 */
export async function fetchQuestionsLazyFromFirestore(filter: {
  category?: string;
  subcategory?: string;
  topic?: string;
  examId?: string;
  forceRefresh?: boolean;
}): Promise<Question[]> {
  try {
    const cached = await getQuestionsFromIDB();
    
    // Filter local cache first
    let localMatches = cached;
    if (filter.category) {
      const targetCat = filter.category.trim().toLowerCase();
      localMatches = localMatches.filter(q => 
        (q.category && q.category.trim().toLowerCase() === targetCat) ||
        (q.csvCategory && q.csvCategory.trim().toLowerCase() === targetCat) ||
        (q.categories && q.categories.some(c => c.trim().toLowerCase() === targetCat))
      );
    }
    if (filter.subcategory) {
      const targetSub = filter.subcategory.trim().toLowerCase();
      localMatches = localMatches.filter(q => 
        (q.subcategory && q.subcategory.trim().toLowerCase() === targetSub) ||
        (q.subcategories && q.subcategories.some(s => s.trim().toLowerCase() === targetSub))
      );
    }
    if (filter.topic) {
      const targetTopic = filter.topic.trim().toLowerCase();
      localMatches = localMatches.filter(q => 
        (q as any).topic && ((q as any).topic as string).trim().toLowerCase() === targetTopic
      );
    }
    if (filter.examId) {
      localMatches = localMatches.filter(q => (q as any).examId === filter.examId);
    }

    // Cache-First: If matching questions exist in local IndexedDB and forceRefresh is false, return immediately!
    if (localMatches.length > 0 && !filter.forceRefresh) {
      return localMatches;
    }

    // Otherwise, fetch ONLY the specific subset from Firestore using targeted queries
    const qColRef = collection(db, 'questions');
    let firestoreDocs: Question[] = [];

    if (filter.category) {
      const qCat = query(qColRef, where('category', '==', filter.category));
      const snap = await getDocs(qCat);
      snap.forEach(d => {
        const data = d.data();
        firestoreDocs.push(normalizeQuestion({ ...data, id: data.id || d.id }));
      });
    } else if (filter.subcategory) {
      const qSub = query(qColRef, where('subcategory', '==', filter.subcategory));
      const snap = await getDocs(qSub);
      snap.forEach(d => {
        const data = d.data();
        firestoreDocs.push(normalizeQuestion({ ...data, id: data.id || d.id }));
      });
    } else if (filter.examId) {
      const qExam = query(qColRef, where('examId', '==', filter.examId));
      const snap = await getDocs(qExam);
      snap.forEach(d => {
        const data = d.data();
        firestoreDocs.push(normalizeQuestion({ ...data, id: data.id || d.id }));
      });
    }

    if (firestoreDocs.length > 0) {
      // Upsert newly fetched questions into IndexedDB for instant future hits
      await upsertQuestionsToIDB(firestoreDocs, []);
      return firestoreDocs;
    }

    return localMatches;
  } catch (err) {
    console.warn('Lazy question fetch notice (using local cache):', err);
    return await getQuestionsFromIDB();
  }
}

// ==========================================
// COURSE INDEXEDDB CACHING & INCREMENTAL SYNC
// ==========================================

export function normalizeCourse(c: any): Course {
  const nowIso = new Date().toISOString();
  return {
    ...c,
    id: String(c.id || `course_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
    createdAt: c.createdAt || nowIso,
    updatedAt: c.updatedAt || c.createdAt || nowIso
  } as Course;
}

/**
 * Fetch all courses stored in local IndexedDB.
 */
export async function getCoursesFromIDB(): Promise<Course[]> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_COURSES, 'readonly');
      const store = tx.objectStore(STORE_COURSES);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        resolve(items.map(normalizeCourse));
      };

      request.onerror = () => {
        console.warn('Error reading courses from IndexedDB:', request.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for getCourses:', err);
    return [];
  }
}

/**
 * Get stored metadata for IndexedDB courses (e.g. lastCourseSyncedAt timestamp).
 */
export async function getCoursesMetaFromIDB(): Promise<{ lastCourseSyncedAt: string; count: number; version?: number } | null> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get('courses_meta');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Update metadata timestamp (lastCourseSyncedAt) in IndexedDB.
 */
export async function updateCoursesMetaTimestamp(lastCourseSyncedAt: string = new Date().toISOString()): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_COURSES, STORE_META], 'readwrite');
      const cStore = tx.objectStore(STORE_COURSES);
      const metaStore = tx.objectStore(STORE_META);

      const countReq = cStore.count();
      countReq.onsuccess = () => {
        metaStore.put({
          key: 'courses_meta',
          lastCourseSyncedAt,
          count: countReq.result || 0,
          version: 1
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Bulk save all courses to IndexedDB.
 */
export async function saveCoursesToIDB(courses: Course[]): Promise<void> {
  if (!courses || !Array.isArray(courses)) return;
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_COURSES, STORE_META], 'readwrite');
      const cStore = tx.objectStore(STORE_COURSES);
      const metaStore = tx.objectStore(STORE_META);

      cStore.clear();

      for (const c of courses) {
        if (c && c.id) {
          cStore.put(normalizeCourse(c));
        }
      }

      metaStore.put({
        key: 'courses_meta',
        lastCourseSyncedAt: new Date().toISOString(),
        count: courses.length,
        version: 1
      });

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => {
        console.warn('Error saving courses to IndexedDB:', e);
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for saveCourses:', err);
  }
}

/**
 * Incremental upsert & delete courses in IndexedDB without wiping unchanged records.
 */
export async function upsertCoursesToIDB(
  toUpsert: Course[],
  toRemoveIds: string[] = []
): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_COURSES, STORE_META], 'readwrite');
      const cStore = tx.objectStore(STORE_COURSES);
      const metaStore = tx.objectStore(STORE_META);

      for (const id of toRemoveIds) {
        if (id) {
          cStore.delete(id);
        }
      }

      for (const c of toUpsert) {
        if (c && c.id) {
          cStore.put(normalizeCourse(c));
        }
      }

      const countReq = cStore.count();
      countReq.onsuccess = () => {
        metaStore.put({
          key: 'courses_meta',
          lastCourseSyncedAt: new Date().toISOString(),
          count: countReq.result || 0,
          version: 1
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => {
        console.warn('Error upserting courses to IndexedDB:', e);
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for upsertCourses:', err);
  }
}

/**
 * Perform metadata-first incremental background sync with Firestore for Courses.
 * 1. Checks `meta/versions` document in Firestore (1 doc read).
 * 2. Compares local courseVersion with server courseVersion.
 * 3. If version matches & verified local cache present: ZERO collection reads!
 * 4. If local version is 0 (fresh install): downloads full collection regardless of local mock data.
 * 5. If server version > local version: queries only courses with `version > localCourseVersion`.
 * 6. Updates both IndexedDB and SQLite stores.
 */
export async function performIncrementalCourseSyncFromFirestore(
  onUpdate?: (updatedCourses: Course[]) => void
): Promise<{ hasChanges: boolean; totalCount: number }> {
  try {
    const syncStartTimeIso = new Date().toISOString();
    const meta = await getCoursesMetaFromIDB();
    const localCached = await getCoursesFromIDB();
    
    // Fresh install check: Only trust localVersion if a verified sync timestamp exists
    const hasVerifiedSync = Boolean(meta && meta.lastCourseSyncedAt && typeof meta.version === 'number' && meta.version > 0);
    const localVersion = hasVerifiedSync ? Number(meta!.version) : 0;

    // 1. Fetch server meta/versions
    let serverCourseVersion = 1;
    try {
      const versionDocRef = doc(db, 'meta', 'versions');
      const versionSnap = await getDoc(versionDocRef);
      if (versionSnap.exists()) {
        const vData = versionSnap.data();
        if (vData.courseVersion !== undefined) {
          serverCourseVersion = Number(vData.courseVersion);
        }
      }
    } catch (e) {
      console.warn('[IndexedDB] Could not check meta/versions for courses:', e);
      return { hasChanges: false, totalCount: localCached.length };
    }

    // 2. Zero-reads optimization: If versions match and verified local data exists -> 0 collection reads!
    if (localVersion >= serverCourseVersion && hasVerifiedSync && localCached.length > 0) {
      console.log(`[IndexedDB] Courses up to date (v${localVersion}). 0 collection reads.`);
      return { hasChanges: false, totalCount: localCached.length };
    }

    // 3. Initial sync if fresh install / localVersion === 0
    if (localVersion === 0) {
      console.log(`[IndexedDB] Initial courses sync from Firestore (server v${serverCourseVersion})...`);
      const snap = await getDocs(collection(db, 'courses'));
      const activeCourses: Course[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.isDeleted && !data.deletedAt) {
          activeCourses.push(normalizeCourse({
            ...data,
            id: String(data.id || docSnap.id),
            version: data.version || serverCourseVersion,
            updatedAt: data.updatedAt || syncStartTimeIso
          }));
        }
      });

      if (activeCourses.length > 0) {
        await saveCoursesToIDB(activeCourses);
        await insertCoursesToSQLite(activeCourses);
        try {
          localStorage.setItem('orjon_courses', JSON.stringify(activeCourses));
        } catch {}
        if (onUpdate) onUpdate(activeCourses);
      }

      // Save version to metadata
      try {
        const idb = await getDB();
        const tx = idb.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({
          key: 'courses_meta',
          lastCourseSyncedAt: syncStartTimeIso,
          count: activeCourses.length > 0 ? activeCourses.length : localCached.length,
          version: serverCourseVersion
        });
      } catch {}

      return {
        hasChanges: activeCourses.length > 0,
        totalCount: activeCourses.length > 0 ? activeCourses.length : localCached.length
      };
    }

    // 4. Differential sync: Query ONLY courses with version > localVersion
    const q = query(collection(db, 'courses'), where('version', '>', localVersion));
    const snap = await getDocs(q);

    if (snap.empty) {
      try {
        const idb = await getDB();
        const tx = idb.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({
          key: 'courses_meta',
          lastCourseSyncedAt: syncStartTimeIso,
          count: localCached.length,
          version: serverCourseVersion
        });
      } catch {}
      return { hasChanges: false, totalCount: localCached.length };
    }

    const modifiedOrAdded: Course[] = [];
    const removedIds: string[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const courseId = String(data.id || docSnap.id);
      if (data.isDeleted || data.deletedAt) {
        removedIds.push(courseId);
      } else {
        modifiedOrAdded.push(normalizeCourse({
          ...data,
          id: courseId,
          version: data.version || serverCourseVersion,
          updatedAt: data.updatedAt || syncStartTimeIso
        }));
      }
    });

    if (modifiedOrAdded.length > 0 || removedIds.length > 0) {
      await upsertCoursesToIDB(modifiedOrAdded, removedIds);
      if (modifiedOrAdded.length > 0) await insertCoursesToSQLite(modifiedOrAdded);
      for (const id of removedIds) await deleteCourseFromSQLite(id);

      const freshlyMerged = await getCoursesFromIDB();
      try {
        localStorage.setItem('orjon_courses', JSON.stringify(freshlyMerged));
      } catch {}
      if (onUpdate) onUpdate(freshlyMerged);

      try {
        const idb = await getDB();
        const tx = idb.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({
          key: 'courses_meta',
          lastCourseSyncedAt: syncStartTimeIso,
          count: freshlyMerged.length,
          version: serverCourseVersion
        });
      } catch {}

      return { hasChanges: true, totalCount: freshlyMerged.length };
    }

    return { hasChanges: false, totalCount: localCached.length };
  } catch (err) {
    console.warn('Incremental course sync notice (using local cache):', err);
    return { hasChanges: false, totalCount: 0 };
  }
}

// ==========================================
// EXAM & ROUTINE INDEXEDDB CACHING & SYNC
// ==========================================

export function normalizeLiveExam(e: any): LiveExam {
  const nowIso = new Date().toISOString();
  return {
    ...e,
    id: String(e.id || `exam_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
    createdAt: e.createdAt || nowIso,
    updatedAt: e.updatedAt || e.createdAt || nowIso
  } as LiveExam;
}

export function normalizeRoutine(r: any): Routine {
  const nowIso = new Date().toISOString();
  return {
    ...r,
    id: String(r.id || `routine_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
    createdAt: r.createdAt || nowIso,
    updatedAt: r.updatedAt || r.createdAt || nowIso
  } as Routine;
}

/**
 * Fetch all live exams stored in local IndexedDB.
 */
export async function getLiveExamsFromIDB(): Promise<LiveExam[]> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_LIVE_EXAMS, 'readonly');
      const store = tx.objectStore(STORE_LIVE_EXAMS);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        resolve(items.map(normalizeLiveExam));
      };

      request.onerror = () => {
        console.warn('Error reading live exams from IndexedDB:', request.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for getLiveExams:', err);
    return [];
  }
}

/**
 * Fetch all routines stored in local IndexedDB.
 */
export async function getRoutinesFromIDB(): Promise<Routine[]> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_ROUTINES, 'readonly');
      const store = tx.objectStore(STORE_ROUTINES);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        resolve(items.map(normalizeRoutine));
      };

      request.onerror = () => {
        console.warn('Error reading routines from IndexedDB:', request.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for getRoutines:', err);
    return [];
  }
}

/**
 * Bulk save live exams to IndexedDB.
 */
export async function saveLiveExamsToIDB(exams: LiveExam[]): Promise<void> {
  if (!exams || !Array.isArray(exams)) return;
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_LIVE_EXAMS, STORE_META], 'readwrite');
      const leStore = tx.objectStore(STORE_LIVE_EXAMS);
      const metaStore = tx.objectStore(STORE_META);

      leStore.clear();

      for (const e of exams) {
        if (e && e.id) {
          leStore.put(normalizeLiveExam(e));
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => {
        console.warn('Error saving live exams to IndexedDB:', e);
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for saveLiveExams:', err);
  }
}

/**
 * Bulk save routines to IndexedDB.
 */
export async function saveRoutinesToIDB(routines: Routine[]): Promise<void> {
  if (!routines || !Array.isArray(routines)) return;
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_ROUTINES, STORE_META], 'readwrite');
      const rStore = tx.objectStore(STORE_ROUTINES);

      rStore.clear();

      for (const r of routines) {
        if (r && r.id) {
          rStore.put(normalizeRoutine(r));
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => {
        console.warn('Error saving routines to IndexedDB:', e);
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB not available for saveRoutines:', err);
  }
}

/**
 * Incremental upsert & delete for live exams in IndexedDB.
 */
export async function upsertLiveExamsToIDB(
  toUpsert: LiveExam[],
  toRemoveIds: string[] = []
): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_LIVE_EXAMS, 'readwrite');
      const leStore = tx.objectStore(STORE_LIVE_EXAMS);

      for (const id of toRemoveIds) {
        if (id) leStore.delete(id);
      }

      for (const e of toUpsert) {
        if (e && e.id) leStore.put(normalizeLiveExam(e));
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('IndexedDB not available for upsertLiveExams:', err);
  }
}

/**
 * Incremental upsert & delete for routines in IndexedDB.
 */
export async function upsertRoutinesToIDB(
  toUpsert: Routine[],
  toRemoveIds: string[] = []
): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_ROUTINES, 'readwrite');
      const rStore = tx.objectStore(STORE_ROUTINES);

      for (const id of toRemoveIds) {
        if (id) rStore.delete(id);
      }

      for (const r of toUpsert) {
        if (r && r.id) rStore.put(normalizeRoutine(r));
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('IndexedDB not available for upsertRoutines:', err);
  }
}

/**
 * Get stored metadata for IndexedDB exams (e.g. lastExamSyncedAt timestamp).
 */
export async function getExamsMetaFromIDB(): Promise<{ lastExamSyncedAt: string; liveExamCount: number; routineCount: number; version?: number } | null> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get('exams_meta');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Update metadata timestamp (lastExamSyncedAt) in IndexedDB.
 */
export async function updateExamsMetaTimestamp(lastExamSyncedAt: string = new Date().toISOString()): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_LIVE_EXAMS, STORE_ROUTINES, STORE_META], 'readwrite');
      const leStore = tx.objectStore(STORE_LIVE_EXAMS);
      const rStore = tx.objectStore(STORE_ROUTINES);
      const metaStore = tx.objectStore(STORE_META);

      let leCount = 0;
      let rCount = 0;

      const countReq1 = leStore.count();
      countReq1.onsuccess = () => {
        leCount = countReq1.result || 0;
        const countReq2 = rStore.count();
        countReq2.onsuccess = () => {
          rCount = countReq2.result || 0;
          metaStore.put({
            key: 'exams_meta',
            lastExamSyncedAt,
            liveExamCount: leCount,
            routineCount: rCount,
            version: 1
          });
        };
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Perform metadata-first incremental background sync with Firestore for Exams (live_exams and routines).
 * 1. Checks `meta/versions` document in Firestore (1 doc read).
 * 2. Compares local examVersion & routineVersion with server versions.
 * 3. If versions match & local cache present: ZERO collection reads!
 * 4. If versions differ: queries only modified live_exams and routines where version > localVersion.
 * 5. Updates both IndexedDB and SQLite stores.
 */
export async function performIncrementalExamSyncFromFirestore(
  onUpdate?: (data: { liveExams: LiveExam[]; routines: Routine[] }) => void
): Promise<{ hasChanges: boolean; liveExamChanges: number; routineChanges: number }> {
  try {
    const syncStartTimeIso = new Date().toISOString();
    const meta = await getExamsMetaFromIDB();
    const localLiveExams = await getLiveExamsFromIDB();
    const localRoutines = await getRoutinesFromIDB();

    // Fresh install check: Only trust local versions if a verified sync timestamp exists
    const hasVerifiedSync = Boolean(meta && meta.lastExamSyncedAt);
    const localExamVersion = hasVerifiedSync && typeof (meta as any)?.examVersion === 'number' ? Number((meta as any).examVersion) : 0;
    const localRoutineVersion = hasVerifiedSync && typeof (meta as any)?.routineVersion === 'number' ? Number((meta as any).routineVersion) : 0;

    // 1. Fetch server meta/versions
    let serverExamVersion = 1;
    let serverRoutineVersion = 1;
    try {
      const versionDocRef = doc(db, 'meta', 'versions');
      const versionSnap = await getDoc(versionDocRef);
      if (versionSnap.exists()) {
        const vData = versionSnap.data();
        if (vData.examVersion !== undefined) serverExamVersion = Number(vData.examVersion);
        if (vData.routineVersion !== undefined) serverRoutineVersion = Number(vData.routineVersion);
      }
    } catch (e) {
      console.warn('[IndexedDB] Could not check meta/versions for exams:', e);
      return { hasChanges: false, liveExamChanges: 0, routineChanges: 0 };
    }

    // 2. Zero-reads optimization: If both versions match and verified local data exists -> 0 collection reads!
    if (
      hasVerifiedSync &&
      localExamVersion >= serverExamVersion &&
      localRoutineVersion >= serverRoutineVersion &&
      (localLiveExams.length > 0 || localRoutines.length > 0)
    ) {
      console.log(`[IndexedDB] Live Exams & Routines up to date (exam v${localExamVersion}, routine v${localRoutineVersion}). 0 collection reads.`);
      return { hasChanges: false, liveExamChanges: 0, routineChanges: 0 };
    }

    let modifiedLE: LiveExam[] = [];
    let removedLEIds: string[] = [];
    let modifiedR: Routine[] = [];
    let removedRIds: string[] = [];

    // 3. Process Live Exams (Full fetch on fresh install / localExamVersion === 0)
    if (localExamVersion === 0) {
      console.log(`[IndexedDB] Initial live exams sync from Firestore (server v${serverExamVersion})...`);
      const snapLE = await getDocs(collection(db, 'live_exams'));
      snapLE.forEach((d) => {
        const data = d.data();
        if (!data.isDeleted && !data.deletedAt) {
          modifiedLE.push(normalizeLiveExam({
            ...data,
            id: String(data.id || d.id),
            version: data.version || serverExamVersion,
            updatedAt: data.updatedAt || syncStartTimeIso
          }));
        }
      });
      if (modifiedLE.length > 0) {
        await saveLiveExamsToIDB(modifiedLE);
        await insertLiveExamsToSQLite(modifiedLE);
        try {
          localStorage.setItem('orjon_live_exams', JSON.stringify(modifiedLE));
        } catch {}
      }
    } else if (serverExamVersion > localExamVersion) {
      const qLE = query(collection(db, 'live_exams'), where('version', '>', localExamVersion));
      const snapLE = await getDocs(qLE);
      snapLE.forEach((docSnap) => {
        const data = docSnap.data();
        const id = String(data.id || docSnap.id);
        if (data.isDeleted || data.deletedAt) {
          removedLEIds.push(id);
        } else {
          modifiedLE.push(normalizeLiveExam({
            ...data,
            id,
            version: data.version || serverExamVersion,
            updatedAt: data.updatedAt || syncStartTimeIso
          }));
        }
      });

      if (modifiedLE.length > 0 || removedLEIds.length > 0) {
        await upsertLiveExamsToIDB(modifiedLE, removedLEIds);
        if (modifiedLE.length > 0) await insertLiveExamsToSQLite(modifiedLE);
        for (const id of removedLEIds) await deleteLiveExamFromSQLite(id);
      }
    }

    // 4. Process Routines (Full fetch on fresh install / localRoutineVersion === 0)
    if (localRoutineVersion === 0) {
      console.log(`[IndexedDB] Initial routines sync from Firestore (server v${serverRoutineVersion})...`);
      const snapR = await getDocs(collection(db, 'routines'));
      snapR.forEach((d) => {
        const data = d.data();
        if (!data.isDeleted && !data.deletedAt) {
          modifiedR.push(normalizeRoutine({
            ...data,
            id: String(data.id || d.id),
            version: data.version || serverRoutineVersion,
            updatedAt: data.updatedAt || syncStartTimeIso
          }));
        }
      });
      if (modifiedR.length > 0) {
        await saveRoutinesToIDB(modifiedR);
        await insertRoutinesToSQLite(modifiedR);
        try {
          localStorage.setItem('orjon_routines', JSON.stringify(modifiedR));
        } catch {}
      }
    } else if (serverRoutineVersion > localRoutineVersion) {
      const qR = query(collection(db, 'routines'), where('version', '>', localRoutineVersion));
      const snapR = await getDocs(qR);
      snapR.forEach((docSnap) => {
        const data = docSnap.data();
        const id = String(data.id || docSnap.id);
        if (data.isDeleted || data.deletedAt) {
          removedRIds.push(id);
        } else {
          modifiedR.push(normalizeRoutine({
            ...data,
            id,
            version: data.version || serverRoutineVersion,
            updatedAt: data.updatedAt || syncStartTimeIso
          }));
        }
      });

      if (modifiedR.length > 0 || removedRIds.length > 0) {
        await upsertRoutinesToIDB(modifiedR, removedRIds);
        if (modifiedR.length > 0) await insertRoutinesToSQLite(modifiedR);
        for (const id of removedRIds) await deleteRoutineFromSQLite(id);
      }
    }

    const hasLEChanges = modifiedLE.length > 0 || removedLEIds.length > 0;
    const hasRChanges = modifiedR.length > 0 || removedRIds.length > 0;

    // 5. Update metadata store
    try {
      const [freshLE, freshR] = await Promise.all([
        getLiveExamsFromIDB(),
        getRoutinesFromIDB()
      ]);
      const idb = await getDB();
      const tx = idb.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({
        key: 'exams_meta',
        lastExamSyncedAt: syncStartTimeIso,
        liveExamCount: freshLE.length,
        routineCount: freshR.length,
        version: Math.max(serverExamVersion, serverRoutineVersion),
        examVersion: serverExamVersion,
        routineVersion: serverRoutineVersion
      });

      if ((hasLEChanges || hasRChanges) && onUpdate) {
        onUpdate({ liveExams: freshLE, routines: freshR });
      }

      return {
        hasChanges: hasLEChanges || hasRChanges,
        liveExamChanges: modifiedLE.length + removedLEIds.length,
        routineChanges: modifiedR.length + removedRIds.length
      };
    } catch {
      return {
        hasChanges: hasLEChanges || hasRChanges,
        liveExamChanges: modifiedLE.length,
        routineChanges: modifiedR.length
      };
    }
  } catch (err) {
    console.warn('Incremental exam sync notice (using local cache):', err);
    return { hasChanges: false, liveExamChanges: 0, routineChanges: 0 };
  }
}

/**
 * Fetch all categories stored in local IndexedDB.
 */
export async function getCategoriesFromIDB(): Promise<CategoryItem[]> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_CATEGORIES, 'readonly');
      const store = tx.objectStore(STORE_CATEGORIES);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []) as CategoryItem[]);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Save all categories to IndexedDB.
 */
export async function saveCategoriesToIDB(categories: CategoryItem[]): Promise<void> {
  if (!categories || !Array.isArray(categories)) return;
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_CATEGORIES, 'readwrite');
      const store = tx.objectStore(STORE_CATEGORIES);
      store.clear();
      for (const c of categories) {
        if (c && c.id) store.put(c);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Upsert categories in IndexedDB.
 */
export async function upsertCategoriesToIDB(toUpsert: CategoryItem[], toRemoveIds: string[] = []): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_CATEGORIES, 'readwrite');
      const store = tx.objectStore(STORE_CATEGORIES);
      for (const id of toRemoveIds) {
        if (id) store.delete(id);
      }
      for (const c of toUpsert) {
        if (c && c.id) store.put(c);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Fetch all subcategories stored in local IndexedDB.
 */
export async function getSubcategoriesFromIDB(): Promise<SubcategoryItem[]> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_SUBCATEGORIES, 'readonly');
      const store = tx.objectStore(STORE_SUBCATEGORIES);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []) as SubcategoryItem[]);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Save all subcategories to IndexedDB.
 */
export async function saveSubcategoriesToIDB(subcategories: SubcategoryItem[]): Promise<void> {
  if (!subcategories || !Array.isArray(subcategories)) return;
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_SUBCATEGORIES, 'readwrite');
      const store = tx.objectStore(STORE_SUBCATEGORIES);
      store.clear();
      for (const s of subcategories) {
        if (s && s.id) store.put(s);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Incremental upsert & delete subcategories in IndexedDB.
 */
export async function upsertSubcategoriesToIDB(toUpsert: SubcategoryItem[], toRemoveIds: string[] = []): Promise<void> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_SUBCATEGORIES, 'readwrite');
      const store = tx.objectStore(STORE_SUBCATEGORIES);
      for (const id of toRemoveIds) {
        if (id) store.delete(id);
      }
      for (const s of toUpsert) {
        if (s && s.id) store.put(s);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}



