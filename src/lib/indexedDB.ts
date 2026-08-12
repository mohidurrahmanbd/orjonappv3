import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Question } from '../types';

const DB_NAME = 'OrjonQuestionsDB';
const DB_VERSION = 1;
const STORE_QUESTIONS = 'questions';
const STORE_META = 'metadata';

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

function getDB(): Promise<IDBDatabase> {
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

/**
 * Perform incremental background sync with Firestore using updatedAt / docChanges.
 * Downloads ONLY new, updated, or deleted records since lastSyncedAt.
 */
export async function performIncrementalSyncFromFirestore(
  onUpdate?: (updatedQuestions: Question[]) => void
): Promise<{ hasChanges: boolean; totalCount: number }> {
  try {
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
          fetched.push({
            ...data,
            id: data.id || docSnap.id
          } as Question);
        });
        await saveQuestionsToIDB(fetched);
        if (onUpdate) onUpdate(fetched);
        return { hasChanges: true, totalCount: fetched.length };
      }
      return { hasChanges: false, totalCount: 0 };
    }

    // Query ONLY documents modified after lastSyncedAt
    const q = query(collection(db, 'questions'), where('updatedAt', '>', lastSyncedAt));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Zero bandwidth downloaded! Return cached dataset
      return { hasChanges: false, totalCount: localCachedQuestions.length };
    }

    const modifiedOrAdded: Question[] = [];
    const removedIds: string[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isDeleted) {
        removedIds.push(docSnap.id);
      } else {
        modifiedOrAdded.push({
          ...data,
          id: data.id || docSnap.id
        } as Question);
      }
    });

    if (modifiedOrAdded.length > 0 || removedIds.length > 0) {
      await upsertQuestionsToIDB(modifiedOrAdded, removedIds);
      const freshlyMerged = await getQuestionsFromIDB();
      if (onUpdate) onUpdate(freshlyMerged);
      return { hasChanges: true, totalCount: freshlyMerged.length };
    }

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
        firestoreDocs.push({ ...data, id: data.id || d.id } as Question);
      });
    } else if (filter.subcategory) {
      const qSub = query(qColRef, where('subcategory', '==', filter.subcategory));
      const snap = await getDocs(qSub);
      snap.forEach(d => {
        const data = d.data();
        firestoreDocs.push({ ...data, id: data.id || d.id } as Question);
      });
    } else if (filter.examId) {
      const qExam = query(qColRef, where('examId', '==', filter.examId));
      const snap = await getDocs(qExam);
      snap.forEach(d => {
        const data = d.data();
        firestoreDocs.push({ ...data, id: data.id || d.id } as Question);
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

/**
 * Real-time Firestore subscriber for questions collection with incremental IndexedDB diff sync.
 */
export function subscribeQuestionsFromFirestore(
  onUpdate: (questions: Question[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    let isInitialSnapshot = true;
    const qColRef = collection(db, 'questions');

    const unsubscribe = onSnapshot(
      qColRef,
      async (snapshot) => {
        try {
          if (snapshot.empty) {
            onUpdate([]);
            return;
          }

          // Inspect snapshot changes for exact incremental diffs
          const docChanges = snapshot.docChanges();

          if (!isInitialSnapshot && docChanges.length === 0) {
            // No changes present
            return;
          }

          const upsertList: Question[] = [];
          const removeIds: (string | number)[] = [];

          if (isInitialSnapshot) {
            // Initial snapshot load: process full snapshot
            const fullDataset: Question[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              fullDataset.push({
                ...data,
                id: data.id || docSnap.id
              } as Question);
            });
            await saveQuestionsToIDB(fullDataset);
            onUpdate(fullDataset);
            isInitialSnapshot = false;
          } else {
            // Process ONLY modified, added, or removed docs (Incremental Sync)
            docChanges.forEach((change) => {
              const docSnap = change.doc;
              const data = docSnap.data();
              const qId = data.id || docSnap.id;

              if (change.type === 'removed' || data.isDeleted) {
                removeIds.push(qId);
              } else {
                upsertList.push({
                  ...data,
                  id: qId
                } as Question);
              }
            });

            if (upsertList.length > 0 || removeIds.length > 0) {
              await upsertQuestionsToIDB(upsertList, removeIds);
              const mergedDataset = await getQuestionsFromIDB();
              onUpdate(mergedDataset);
            }
          }
        } catch (e) {
          console.warn('Error processing snapshot changes:', e);
        }
      },
      (err) => {
        console.warn('Real-time Firestore questions listener notice:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('Could not establish real-time listener for questions:', e);
    if (onError) onError(e);
    return () => {};
  }
}
