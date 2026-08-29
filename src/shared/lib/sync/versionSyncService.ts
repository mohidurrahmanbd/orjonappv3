import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  GlobalSyncVersions,
  Question,
  CategoryItem,
  SubcategoryItem,
  Course,
  LiveExam,
  Routine
} from '../../types';
import {
  getSQLiteDatabase
} from '../sqlite/sqliteConnection';
import {
  insertCategory,
  insertCategories,
  deleteCategory as deleteCategoryFromSQLite,
  insertSubcategory,
  insertSubcategories,
  deleteSubcategory as deleteSubcategoryFromSQLite,
  insertQuestion,
  insertQuestions,
  deleteQuestion as deleteQuestionFromSQLite,
  deleteQuestions as deleteQuestionsFromSQLite,
  insertCourse,
  insertCourses,
  deleteCourse as deleteCourseFromSQLite,
  insertLiveExam,
  insertLiveExams,
  deleteLiveExam as deleteLiveExamFromSQLite,
  insertRoutine,
  insertRoutines,
  deleteRoutine as deleteRoutineFromSQLite,
  getAllQuestions as getAllQuestionsFromSQLite,
  getAllCategories as getAllCategoriesFromSQLite,
  getAllSubcategories as getAllSubcategoriesFromSQLite,
  getAllCourses as getAllCoursesFromSQLite,
  getAllLiveExams as getAllLiveExamsFromSQLite,
  getAllRoutines as getAllRoutinesFromSQLite
} from '../sqlite/sqliteService';
import {
  getDB,
  saveQuestionsToIDB,
  upsertQuestionsToIDB,
  saveCategoriesToIDB,
  upsertCategoriesToIDB,
  saveSubcategoriesToIDB,
  upsertSubcategoriesToIDB,
  saveCoursesToIDB,
  upsertCoursesToIDB,
  saveLiveExamsToIDB,
  upsertLiveExamsToIDB,
  saveRoutinesToIDB,
  upsertRoutinesToIDB,
  getQuestionsFromIDB,
  getCategoriesFromIDB,
  getSubcategoriesFromIDB,
  getCoursesFromIDB,
  getLiveExamsFromIDB,
  getRoutinesFromIDB,
  normalizeQuestion,
  normalizeCourse,
  normalizeLiveExam,
  normalizeRoutine
} from '../indexedDB';

// Storage keys
export const GLOBAL_VERSION_DOC_PATH = 'meta/versions';
const LOCAL_STORAGE_VERSIONS_KEY = 'orjon_sync_versions';

export const DEFAULT_GLOBAL_VERSIONS: GlobalSyncVersions = {
  questionVersion: 1,
  categoryVersion: 1,
  subcategoryVersion: 1,
  courseVersion: 1,
  examVersion: 1,
  routineVersion: 1,
  updatedAt: new Date().toISOString()
};

export interface DifferentialSyncResult {
  hasChanges: boolean;
  questionsUpdated: number;
  questionsRemoved: number;
  categoriesUpdated: number;
  categoriesRemoved: number;
  subcategoriesUpdated: number;
  subcategoriesRemoved: number;
  coursesUpdated: number;
  coursesRemoved: number;
  examsUpdated: number;
  examsRemoved: number;
  routinesUpdated: number;
  routinesRemoved: number;
  serverVersions: GlobalSyncVersions;
  localVersions: GlobalSyncVersions;
  timestamp: string;
}

export interface DifferentialSyncOptions {
  onProgress?: (stage: string, percent?: number) => void;
  onQuestionsUpdate?: (questions: Question[]) => void;
  onCategoriesUpdate?: (categories: CategoryItem[]) => void;
  onSubcategoriesUpdate?: (subcategories: SubcategoryItem[]) => void;
  onCoursesUpdate?: (courses: Course[]) => void;
  onLiveExamsUpdate?: (exams: LiveExam[]) => void;
  onRoutinesUpdate?: (routines: Routine[]) => void;
}

/**
 * 1. Global Version Management in Firestore
 */

/**
 * Fetch global version document from Firestore (`meta/versions`).
 * If it doesn't exist yet, creates and initializes it with default versions.
 */
export async function getGlobalSyncVersions(): Promise<GlobalSyncVersions> {
  try {
    const versionDocRef = doc(db, 'meta', 'versions');
    const snap = await getDoc(versionDocRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        questionVersion: Number(data.questionVersion || 1),
        categoryVersion: Number(data.categoryVersion || 1),
        subcategoryVersion: Number(data.subcategoryVersion || 1),
        courseVersion: Number(data.courseVersion || 1),
        examVersion: Number(data.examVersion || 1),
        routineVersion: Number(data.routineVersion || 1),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }

    // Initialize document if absent
    const initialVersions: GlobalSyncVersions = {
      ...DEFAULT_GLOBAL_VERSIONS,
      updatedAt: new Date().toISOString()
    };
    await setDoc(versionDocRef, initialVersions);
    console.log('[VersionSync] Initialized Firestore meta/versions doc:', initialVersions);
    return initialVersions;
  } catch (err) {
    console.warn('[VersionSync] Error getting global sync versions from Firestore:', err);
    // Fallback to local or default
    return getLocalSyncVersions();
  }
}

/**
 * Atomically increment a specific collection version in `meta/versions`.
 */
export async function incrementGlobalVersion(
  entity: 'questionVersion' | 'categoryVersion' | 'subcategoryVersion' | 'courseVersion' | 'examVersion' | 'routineVersion'
): Promise<number> {
  try {
    const versionDocRef = doc(db, 'meta', 'versions');
    const nowIso = new Date().toISOString();

    const snap = await getDoc(versionDocRef);
    if (!snap.exists()) {
      const initial: GlobalSyncVersions = {
        ...DEFAULT_GLOBAL_VERSIONS,
        [entity]: 2,
        updatedAt: nowIso
      };
      await setDoc(versionDocRef, initial);
      return 2;
    }

    const currentVal = Number(snap.data()?.[entity] || 1);
    const newVal = currentVal + 1;
    await updateDoc(versionDocRef, {
      [entity]: increment(1),
      updatedAt: nowIso
    });
    return newVal;
  } catch (err) {
    console.warn(`[VersionSync] Error incrementing global ${entity}:`, err);
    return 1;
  }
}

/**
 * 2. Local Version Management (SQLite sync_meta + IDB metadata + localStorage)
 */

/**
 * Get current local sync versions across all layers.
 */
export async function getLocalSyncVersions(): Promise<GlobalSyncVersions> {
  let versions: GlobalSyncVersions = {
    questionVersion: 0,
    categoryVersion: 0,
    subcategoryVersion: 0,
    courseVersion: 0,
    examVersion: 0,
    routineVersion: 0,
    updatedAt: ''
  };

  // Check localStorage first
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VERSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      versions = {
        questionVersion: Number(parsed.questionVersion || 0),
        categoryVersion: Number(parsed.categoryVersion || 0),
        subcategoryVersion: Number(parsed.subcategoryVersion || 0),
        courseVersion: Number(parsed.courseVersion || 0),
        examVersion: Number(parsed.examVersion || 0),
        routineVersion: Number(parsed.routineVersion || 0),
        updatedAt: parsed.updatedAt || ''
      };
    }
  } catch {}

  // Check SQLite sync_meta
  try {
    const dbInstance = await getSQLiteDatabase();
    const res = await dbInstance.query('SELECT key, value FROM sync_meta;');
    const rows = res?.values || [];
    rows.forEach((r: any) => {
      const k = r.key;
      const v = Number(r.value);
      if (k === 'questionVersion' && v > versions.questionVersion) versions.questionVersion = v;
      if (k === 'categoryVersion' && v > versions.categoryVersion) versions.categoryVersion = v;
      if (k === 'subcategoryVersion' && v > versions.subcategoryVersion) versions.subcategoryVersion = v;
      if (k === 'courseVersion' && v > versions.courseVersion) versions.courseVersion = v;
      if (k === 'examVersion' && v > versions.examVersion) versions.examVersion = v;
      if (k === 'routineVersion' && v > versions.routineVersion) versions.routineVersion = v;
    });
  } catch {}

  return versions;
}

/**
 * Save updated local sync versions to all storage layers (localStorage, SQLite, IndexedDB).
 */
export async function saveLocalSyncVersions(versions: GlobalSyncVersions): Promise<void> {
  const cleanVersions: GlobalSyncVersions = {
    questionVersion: Number(versions.questionVersion || 0),
    categoryVersion: Number(versions.categoryVersion || 0),
    subcategoryVersion: Number(versions.subcategoryVersion || 0),
    courseVersion: Number(versions.courseVersion || 0),
    examVersion: Number(versions.examVersion || 0),
    routineVersion: Number(versions.routineVersion || 0),
    updatedAt: versions.updatedAt || new Date().toISOString()
  };

  // 1. Save to localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_VERSIONS_KEY, JSON.stringify(cleanVersions));
  } catch {}

  // 2. Save to SQLite sync_meta table
  try {
    const dbInstance = await getSQLiteDatabase();
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['questionVersion', String(cleanVersions.questionVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['categoryVersion', String(cleanVersions.categoryVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['subcategoryVersion', String(cleanVersions.subcategoryVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['courseVersion', String(cleanVersions.courseVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['examVersion', String(cleanVersions.examVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['routineVersion', String(cleanVersions.routineVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['updatedAt', cleanVersions.updatedAt || '']);
  } catch (err) {
    console.warn('[VersionSync] SQLite sync_meta write notice:', err);
  }

  // 3. Save to IndexedDB metadata store
  try {
    const idb = await getDB();
    const tx = idb.transaction('metadata', 'readwrite');
    const store = tx.objectStore('metadata');
    store.put({
      key: 'sync_versions',
      ...cleanVersions
    });
  } catch (err) {
    console.warn('[VersionSync] IDB sync_versions write notice:', err);
  }
}

/**
 * 3. CORE DIFFERENTIAL SYNCHRONIZATION ENGINE
 *
 * Checks `meta/versions` from Firestore.
 * For each entity:
 *  - If localVersion >= serverVersion and local data is present: 0 Firestore reads!
 *  - If serverVersion > localVersion:
 *      Downloads only documents where `version > localVersion`.
 *      Extracts modified/added records vs soft-deleted records (`deletedAt != null` or `isDeleted == true`).
 *      Upserts active records to SQLite & IndexedDB.
 *      Removes soft-deleted records from SQLite & IndexedDB.
 *      Updates localVersion to serverVersion.
 */

/**
 * Metadata-First Course Sync
 * 1. Checks `meta/versions` (1 doc read).
 * 2. If local courseVersion matches server courseVersion: 0 collection reads!
 * 3. If server courseVersion > local courseVersion: fetches only modified courses (version > localCourseVersion).
 */
export async function syncCoursesMetadataFirst(
  onUpdate?: (courses: Course[]) => void
): Promise<{ hasChanges: boolean; updatedCount: number; removedCount: number }> {
  try {
    const serverVersions = await getGlobalSyncVersions();
    const localVersions = await getLocalSyncVersions();
    const localCourses = await getCoursesFromIDB();

    const localCourseVersion = localVersions.courseVersion || 0;
    const serverCourseVersion = serverVersions.courseVersion || 1;

    // Zero reads optimization: version matches and local data present
    if (localCourseVersion >= serverCourseVersion && localCourses.length > 0) {
      console.log(`[VersionSync] Courses up to date (v${localCourseVersion}). 0 collection reads.`);
      return { hasChanges: false, updatedCount: 0, removedCount: 0 };
    }

    // If initial fresh sync (local version is 0)
    if (localCourseVersion === 0) {
      console.log(`[VersionSync] Initial courses sync (v${serverCourseVersion})...`);
      const snap = await getDocs(collection(db, 'courses'));
      const activeCourses: Course[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          activeCourses.push(normalizeCourse({
            ...data,
            id: String(data.id || d.id),
            version: data.version || serverCourseVersion,
            updatedAt: data.updatedAt || new Date().toISOString(),
            deletedAt: null
          }));
        }
      });

      if (activeCourses.length > 0) {
        await saveCoursesToIDB(activeCourses);
        await insertCourses(activeCourses);
        try {
          localStorage.setItem('orjon_courses', JSON.stringify(activeCourses));
        } catch {}
        if (onUpdate) onUpdate(activeCourses);
      }

      localVersions.courseVersion = serverCourseVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);

      return { hasChanges: activeCourses.length > 0, updatedCount: activeCourses.length, removedCount: 0 };
    }

    // Differential sync: fetch only courses with version > localCourseVersion
    if (serverCourseVersion > localCourseVersion) {
      console.log(`[VersionSync] Differential courses sync: local v${localCourseVersion} -> server v${serverCourseVersion}`);
      const qDiff = query(
        collection(db, 'courses'),
        where('version', '>', localCourseVersion)
      );
      const snap = await getDocs(qDiff);

      if (!snap.empty) {
        const toUpsert: Course[] = [];
        const toRemoveIds: string[] = [];

        snap.forEach((d) => {
          const data = d.data();
          const courseId = String(data.id || d.id);
          if (data.deletedAt || data.isDeleted) {
            toRemoveIds.push(courseId);
          } else {
            toUpsert.push(normalizeCourse({
              ...data,
              id: courseId,
              version: data.version || serverCourseVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (toUpsert.length > 0 || toRemoveIds.length > 0) {
          await upsertCoursesToIDB(toUpsert, toRemoveIds);
          if (toUpsert.length > 0) await insertCourses(toUpsert);
          for (const id of toRemoveIds) await deleteCourseFromSQLite(id);

          const allUpdated = await getCoursesFromIDB();
          if (onUpdate) onUpdate(allUpdated);

          localVersions.courseVersion = serverCourseVersion;
          localVersions.updatedAt = new Date().toISOString();
          await saveLocalSyncVersions(localVersions);

          return { hasChanges: true, updatedCount: toUpsert.length, removedCount: toRemoveIds.length };
        }
      }

      localVersions.courseVersion = serverCourseVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);
    }

    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  } catch (err) {
    console.warn('[VersionSync] syncCoursesMetadataFirst notice:', err);
    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  }
}

/**
 * Metadata-First Live Exam Sync
 * 1. Checks `meta/versions` (1 doc read).
 * 2. If local examVersion matches server examVersion: 0 collection reads!
 * 3. If server examVersion > local examVersion: fetches only modified live exams (version > localExamVersion).
 */
export async function syncLiveExamsMetadataFirst(
  onUpdate?: (exams: LiveExam[]) => void
): Promise<{ hasChanges: boolean; updatedCount: number; removedCount: number }> {
  try {
    const serverVersions = await getGlobalSyncVersions();
    const localVersions = await getLocalSyncVersions();
    const localExams = await getLiveExamsFromIDB();

    const localExamVersion = localVersions.examVersion || 0;
    const serverExamVersion = serverVersions.examVersion || 1;

    if (localExamVersion >= serverExamVersion && localExams.length > 0) {
      console.log(`[VersionSync] Live Exams up to date (v${localExamVersion}). 0 collection reads.`);
      return { hasChanges: false, updatedCount: 0, removedCount: 0 };
    }

    if (localExamVersion === 0) {
      console.log(`[VersionSync] Initial live exams sync (v${serverExamVersion})...`);
      const snap = await getDocs(collection(db, 'live_exams'));
      const activeExams: LiveExam[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          activeExams.push(normalizeLiveExam({
            ...data,
            id: String(data.id || d.id),
            version: data.version || serverExamVersion,
            updatedAt: data.updatedAt || new Date().toISOString(),
            deletedAt: null
          }));
        }
      });

      if (activeExams.length > 0) {
        await saveLiveExamsToIDB(activeExams);
        await insertLiveExams(activeExams);
        try {
          localStorage.setItem('orjon_live_exams', JSON.stringify(activeExams));
        } catch {}
        if (onUpdate) onUpdate(activeExams);
      }

      localVersions.examVersion = serverExamVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);

      return { hasChanges: activeExams.length > 0, updatedCount: activeExams.length, removedCount: 0 };
    }

    if (serverExamVersion > localExamVersion) {
      console.log(`[VersionSync] Differential live exams sync: local v${localExamVersion} -> server v${serverExamVersion}`);
      const qDiff = query(
        collection(db, 'live_exams'),
        where('version', '>', localExamVersion)
      );
      const snap = await getDocs(qDiff);

      if (!snap.empty) {
        const toUpsert: LiveExam[] = [];
        const toRemoveIds: string[] = [];

        snap.forEach((d) => {
          const data = d.data();
          const id = String(data.id || d.id);
          if (data.deletedAt || data.isDeleted) {
            toRemoveIds.push(id);
          } else {
            toUpsert.push(normalizeLiveExam({
              ...data,
              id,
              version: data.version || serverExamVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (toUpsert.length > 0 || toRemoveIds.length > 0) {
          await upsertLiveExamsToIDB(toUpsert, toRemoveIds);
          if (toUpsert.length > 0) await insertLiveExams(toUpsert);
          for (const id of toRemoveIds) await deleteLiveExamFromSQLite(id);

          const allUpdated = await getLiveExamsFromIDB();
          if (onUpdate) onUpdate(allUpdated);

          localVersions.examVersion = serverExamVersion;
          localVersions.updatedAt = new Date().toISOString();
          await saveLocalSyncVersions(localVersions);

          return { hasChanges: true, updatedCount: toUpsert.length, removedCount: toRemoveIds.length };
        }
      }

      localVersions.examVersion = serverExamVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);
    }

    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  } catch (err) {
    console.warn('[VersionSync] syncLiveExamsMetadataFirst notice:', err);
    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  }
}

/**
 * Metadata-First Routine Sync
 * 1. Checks `meta/versions` (1 doc read).
 * 2. If local routineVersion matches server routineVersion: 0 collection reads!
 * 3. If server routineVersion > local routineVersion: fetches only modified routines (version > localRoutineVersion).
 */
export async function syncRoutinesMetadataFirst(
  onUpdate?: (routines: Routine[]) => void
): Promise<{ hasChanges: boolean; updatedCount: number; removedCount: number }> {
  try {
    const serverVersions = await getGlobalSyncVersions();
    const localVersions = await getLocalSyncVersions();
    const localRoutines = await getRoutinesFromIDB();

    const localRoutineVersion = localVersions.routineVersion || 0;
    const serverRoutineVersion = serverVersions.routineVersion || 1;

    if (localRoutineVersion >= serverRoutineVersion && localRoutines.length > 0) {
      console.log(`[VersionSync] Routines up to date (v${localRoutineVersion}). 0 collection reads.`);
      return { hasChanges: false, updatedCount: 0, removedCount: 0 };
    }

    if (localRoutineVersion === 0) {
      console.log(`[VersionSync] Initial routines sync (v${serverRoutineVersion})...`);
      const snap = await getDocs(collection(db, 'routines'));
      const activeRoutines: Routine[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          activeRoutines.push(normalizeRoutine({
            ...data,
            id: String(data.id || d.id),
            version: data.version || serverRoutineVersion,
            updatedAt: data.updatedAt || new Date().toISOString(),
            deletedAt: null
          }));
        }
      });

      if (activeRoutines.length > 0) {
        await saveRoutinesToIDB(activeRoutines);
        await insertRoutines(activeRoutines);
        try {
          localStorage.setItem('orjon_routines', JSON.stringify(activeRoutines));
        } catch {}
        if (onUpdate) onUpdate(activeRoutines);
      }

      localVersions.routineVersion = serverRoutineVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);

      return { hasChanges: activeRoutines.length > 0, updatedCount: activeRoutines.length, removedCount: 0 };
    }

    if (serverRoutineVersion > localRoutineVersion) {
      console.log(`[VersionSync] Differential routines sync: local v${localRoutineVersion} -> server v${serverRoutineVersion}`);
      const qDiff = query(
        collection(db, 'routines'),
        where('version', '>', localRoutineVersion)
      );
      const snap = await getDocs(qDiff);

      if (!snap.empty) {
        const toUpsert: Routine[] = [];
        const toRemoveIds: string[] = [];

        snap.forEach((d) => {
          const data = d.data();
          const id = String(data.id || d.id);
          if (data.deletedAt || data.isDeleted) {
            toRemoveIds.push(id);
          } else {
            toUpsert.push(normalizeRoutine({
              ...data,
              id,
              version: data.version || serverRoutineVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (toUpsert.length > 0 || toRemoveIds.length > 0) {
          await upsertRoutinesToIDB(toUpsert, toRemoveIds);
          if (toUpsert.length > 0) await insertRoutines(toUpsert);
          for (const id of toRemoveIds) await deleteRoutineFromSQLite(id);

          const allUpdated = await getRoutinesFromIDB();
          if (onUpdate) onUpdate(allUpdated);

          localVersions.routineVersion = serverRoutineVersion;
          localVersions.updatedAt = new Date().toISOString();
          await saveLocalSyncVersions(localVersions);

          return { hasChanges: true, updatedCount: toUpsert.length, removedCount: toRemoveIds.length };
        }
      }

      localVersions.routineVersion = serverRoutineVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);
    }

    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  } catch (err) {
    console.warn('[VersionSync] syncRoutinesMetadataFirst notice:', err);
    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  }
}

/**
 * Unified Metadata-First Sync for Live Exams and Routines
 */
export async function syncExamsAndRoutinesMetadataFirst(
  onUpdate?: (data: { liveExams: LiveExam[]; routines: Routine[] }) => void
): Promise<{ hasChanges: boolean; liveExamChanges: number; routineChanges: number }> {
  try {
    const [examRes, routineRes] = await Promise.all([
      syncLiveExamsMetadataFirst(),
      syncRoutinesMetadataFirst()
    ]);

    const hasChanges = examRes.hasChanges || routineRes.hasChanges;
    if (hasChanges && onUpdate) {
      const [freshLE, freshR] = await Promise.all([
        getLiveExamsFromIDB(),
        getRoutinesFromIDB()
      ]);
      onUpdate({ liveExams: freshLE, routines: freshR });
    }

    return {
      hasChanges,
      liveExamChanges: examRes.updatedCount + examRes.removedCount,
      routineChanges: routineRes.updatedCount + routineRes.removedCount
    };
  } catch (err) {
    console.warn('[VersionSync] syncExamsAndRoutinesMetadataFirst notice:', err);
    return { hasChanges: false, liveExamChanges: 0, routineChanges: 0 };
  }
}

export async function performDifferentialSync(
  options: DifferentialSyncOptions = {}
): Promise<DifferentialSyncResult> {
  const result: DifferentialSyncResult = {
    hasChanges: false,
    questionsUpdated: 0,
    questionsRemoved: 0,
    categoriesUpdated: 0,
    categoriesRemoved: 0,
    subcategoriesUpdated: 0,
    subcategoriesRemoved: 0,
    coursesUpdated: 0,
    coursesRemoved: 0,
    examsUpdated: 0,
    examsRemoved: 0,
    routinesUpdated: 0,
    routinesRemoved: 0,
    serverVersions: { ...DEFAULT_GLOBAL_VERSIONS },
    localVersions: { ...DEFAULT_GLOBAL_VERSIONS },
    timestamp: new Date().toISOString()
  };

  try {
    options.onProgress?.('সার্ভার ভার্সন চেক করা হচ্ছে...', 10);
    const serverVersions = await getGlobalSyncVersions();
    const localVersions = await getLocalSyncVersions();

    result.serverVersions = serverVersions;
    result.localVersions = { ...localVersions };

    console.log('[VersionSync] Version Check:', {
      server: serverVersions,
      local: localVersions
    });

    const updatedLocalVersions = { ...localVersions };

    // --- 1. QUESTIONS SYNC ---
    try {
      options.onProgress?.('প্রশ্নমালা সিঙ্ক করা হচ্ছে...', 25);
      const localQuestions = await getQuestionsFromIDB();
      const needsFullQuestionSync = localVersions.questionVersion === 0;

      if (needsFullQuestionSync) {
        // Initial Full Fetch of Active Questions
        const snap = await getDocs(collection(db, 'questions'));
        const activeQuestions: Question[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const isDeleted = Boolean(data.deletedAt || data.isDeleted);
          if (!isDeleted) {
            activeQuestions.push(normalizeQuestion({
              ...data,
              id: data.id || d.id,
              version: data.version || serverVersions.questionVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (activeQuestions.length > 0) {
          await saveQuestionsToIDB(activeQuestions);
          await insertQuestions(activeQuestions);
          result.questionsUpdated = activeQuestions.length;
          result.hasChanges = true;
          options.onQuestionsUpdate?.(activeQuestions);
        }
        updatedLocalVersions.questionVersion = serverVersions.questionVersion;
      } else if (serverVersions.questionVersion > localVersions.questionVersion) {
        // Differential Sync for Questions
        const qDiff = query(
          collection(db, 'questions'),
          where('version', '>', localVersions.questionVersion)
        );
        const snap = await getDocs(qDiff);

        if (!snap.empty) {
          const toUpsert: Question[] = [];
          const toRemoveIds: string[] = [];

          snap.forEach((d) => {
            const data = d.data();
            const qId = String(data.id || d.id);
            const isDeleted = Boolean(data.deletedAt || data.isDeleted);

            if (isDeleted) {
              toRemoveIds.push(qId);
            } else {
              toUpsert.push(normalizeQuestion({
                ...data,
                id: qId,
                version: data.version || serverVersions.questionVersion,
                updatedAt: data.updatedAt || new Date().toISOString(),
                deletedAt: null
              }));
            }
          });

          if (toUpsert.length > 0 || toRemoveIds.length > 0) {
            // Update IndexedDB
            await upsertQuestionsToIDB(toUpsert, toRemoveIds);
            // Update SQLite
            if (toUpsert.length > 0) await insertQuestions(toUpsert);
            if (toRemoveIds.length > 0) await deleteQuestionsFromSQLite(toRemoveIds);

            result.questionsUpdated = toUpsert.length;
            result.questionsRemoved = toRemoveIds.length;
            result.hasChanges = true;

            const allUpdated = await getQuestionsFromIDB();
            options.onQuestionsUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.questionVersion = serverVersions.questionVersion;
      }
    } catch (qErr) {
      console.warn('[VersionSync] Questions sync notice:', qErr);
    }

    // --- 2. CATEGORIES SYNC ---
    try {
      options.onProgress?.('ক্যাটাগরি সিঙ্ক করা হচ্ছে...', 40);
      const localCats = await getCategoriesFromIDB();
      const needsFullCatSync = localVersions.categoryVersion === 0;

      if (needsFullCatSync) {
        const snap = await getDocs(collection(db, 'categories'));
        const activeCats: CategoryItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!data.deletedAt && !data.isDeleted) {
            activeCats.push({
              id: String(data.id || d.id),
              name: data.name || '',
              subHeading: data.subHeading || undefined,
              version: data.version || serverVersions.categoryVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            });
          }
        });

        if (activeCats.length > 0) {
          await saveCategoriesToIDB(activeCats);
          await insertCategories(activeCats);
          result.categoriesUpdated = activeCats.length;
          result.hasChanges = true;
          options.onCategoriesUpdate?.(activeCats);
        }
        updatedLocalVersions.categoryVersion = serverVersions.categoryVersion;
      } else if (serverVersions.categoryVersion > localVersions.categoryVersion) {
        const qDiff = query(
          collection(db, 'categories'),
          where('version', '>', localVersions.categoryVersion)
        );
        const snap = await getDocs(qDiff);

        if (!snap.empty) {
          const toUpsert: CategoryItem[] = [];
          const toRemoveIds: string[] = [];

          snap.forEach((d) => {
            const data = d.data();
            const catId = String(data.id || d.id);
            if (data.deletedAt || data.isDeleted) {
              toRemoveIds.push(catId);
            } else {
              toUpsert.push({
                id: catId,
                name: data.name || '',
                subHeading: data.subHeading || undefined,
                version: data.version || serverVersions.categoryVersion,
                updatedAt: data.updatedAt || new Date().toISOString(),
                deletedAt: null
              });
            }
          });

          if (toUpsert.length > 0 || toRemoveIds.length > 0) {
            await upsertCategoriesToIDB(toUpsert, toRemoveIds);
            if (toUpsert.length > 0) await insertCategories(toUpsert);
            for (const id of toRemoveIds) await deleteCategoryFromSQLite(id);

            result.categoriesUpdated = toUpsert.length;
            result.categoriesRemoved = toRemoveIds.length;
            result.hasChanges = true;

            const allUpdated = await getCategoriesFromIDB();
            options.onCategoriesUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.categoryVersion = serverVersions.categoryVersion;
      }
    } catch (cErr) {
      console.warn('[VersionSync] Categories sync notice:', cErr);
    }

    // --- 3. SUBCATEGORIES SYNC ---
    try {
      options.onProgress?.('সাব-ক্যাটাগরি সিঙ্ক করা হচ্ছে...', 55);
      const localSubs = await getSubcategoriesFromIDB();
      const needsFullSubSync = localVersions.subcategoryVersion === 0;

      if (needsFullSubSync) {
        const snap = await getDocs(collection(db, 'subcategories'));
        const activeSubs: SubcategoryItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!data.deletedAt && !data.isDeleted) {
            activeSubs.push({
              id: String(data.id || d.id),
              name: data.name || '',
              parentCategory: data.parentCategory || '',
              parentCategoryId: data.parentCategoryId || undefined,
              date: data.date || undefined,
              subHeading: data.subHeading || undefined,
              text: data.text || undefined,
              details: data.details || undefined,
              createdAt: data.createdAt || undefined,
              updatedAt: data.updatedAt || new Date().toISOString(),
              version: data.version || serverVersions.subcategoryVersion,
              deletedAt: null
            });
          }
        });

        if (activeSubs.length > 0) {
          await saveSubcategoriesToIDB(activeSubs);
          await insertSubcategories(activeSubs);
          result.subcategoriesUpdated = activeSubs.length;
          result.hasChanges = true;
          options.onSubcategoriesUpdate?.(activeSubs);
        }
        updatedLocalVersions.subcategoryVersion = serverVersions.subcategoryVersion;
      } else if (serverVersions.subcategoryVersion > localVersions.subcategoryVersion) {
        const qDiff = query(
          collection(db, 'subcategories'),
          where('version', '>', localVersions.subcategoryVersion)
        );
        const snap = await getDocs(qDiff);

        if (!snap.empty) {
          const toUpsert: SubcategoryItem[] = [];
          const toRemoveIds: string[] = [];

          snap.forEach((d) => {
            const data = d.data();
            const subId = String(data.id || d.id);
            if (data.deletedAt || data.isDeleted) {
              toRemoveIds.push(subId);
            } else {
              toUpsert.push({
                id: subId,
                name: data.name || '',
                parentCategory: data.parentCategory || '',
                parentCategoryId: data.parentCategoryId || undefined,
                date: data.date || undefined,
                subHeading: data.subHeading || undefined,
                text: data.text || undefined,
                details: data.details || undefined,
                createdAt: data.createdAt || undefined,
                updatedAt: data.updatedAt || new Date().toISOString(),
                version: data.version || serverVersions.subcategoryVersion,
                deletedAt: null
              });
            }
          });

          if (toUpsert.length > 0 || toRemoveIds.length > 0) {
            await upsertSubcategoriesToIDB(toUpsert, toRemoveIds);
            if (toUpsert.length > 0) await insertSubcategories(toUpsert);
            for (const id of toRemoveIds) await deleteSubcategoryFromSQLite(id);

            result.subcategoriesUpdated = toUpsert.length;
            result.subcategoriesRemoved = toRemoveIds.length;
            result.hasChanges = true;

            const allUpdated = await getSubcategoriesFromIDB();
            options.onSubcategoriesUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.subcategoryVersion = serverVersions.subcategoryVersion;
      }
    } catch (sErr) {
      console.warn('[VersionSync] Subcategories sync notice:', sErr);
    }

    // --- 4. COURSES SYNC ---
    try {
      options.onProgress?.('কোর্স সিঙ্ক করা হচ্ছে...', 70);
      const localCourses = await getCoursesFromIDB();
      const needsFullCourseSync = localVersions.courseVersion === 0;

      if (needsFullCourseSync) {
        const snap = await getDocs(collection(db, 'courses'));
        const activeCourses: Course[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!data.deletedAt && !data.isDeleted) {
            activeCourses.push(normalizeCourse({
              ...data,
              id: String(data.id || d.id),
              version: data.version || serverVersions.courseVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (activeCourses.length > 0) {
          await saveCoursesToIDB(activeCourses);
          await insertCourses(activeCourses);
          try {
            localStorage.setItem('orjon_courses', JSON.stringify(activeCourses));
          } catch {}
          result.coursesUpdated = activeCourses.length;
          result.hasChanges = true;
          options.onCoursesUpdate?.(activeCourses);
        }
        updatedLocalVersions.courseVersion = serverVersions.courseVersion;
      } else if (serverVersions.courseVersion > localVersions.courseVersion) {
        const qDiff = query(
          collection(db, 'courses'),
          where('version', '>', localVersions.courseVersion)
        );
        const snap = await getDocs(qDiff);

        if (!snap.empty) {
          const toUpsert: Course[] = [];
          const toRemoveIds: string[] = [];

          snap.forEach((d) => {
            const data = d.data();
            const courseId = String(data.id || d.id);
            if (data.deletedAt || data.isDeleted) {
              toRemoveIds.push(courseId);
            } else {
              toUpsert.push(normalizeCourse({
                ...data,
                id: courseId,
                version: data.version || serverVersions.courseVersion,
                updatedAt: data.updatedAt || new Date().toISOString(),
                deletedAt: null
              }));
            }
          });

          if (toUpsert.length > 0 || toRemoveIds.length > 0) {
            await upsertCoursesToIDB(toUpsert, toRemoveIds);
            if (toUpsert.length > 0) await insertCourses(toUpsert);
            for (const id of toRemoveIds) await deleteCourseFromSQLite(id);

            result.coursesUpdated = toUpsert.length;
            result.coursesRemoved = toRemoveIds.length;
            result.hasChanges = true;

            const allUpdated = await getCoursesFromIDB();
            try {
              localStorage.setItem('orjon_courses', JSON.stringify(allUpdated));
            } catch {}
            options.onCoursesUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.courseVersion = serverVersions.courseVersion;
      }
    } catch (cErr) {
      console.warn('[VersionSync] Courses sync notice:', cErr);
    }

    // --- 5. LIVE EXAMS & ROUTINES SYNC ---
    try {
      options.onProgress?.('লাইভ পরীক্ষা ও রুটিন সিঙ্ক করা হচ্ছে...', 85);

      // 5a. Live Exams
      const localExams = await getLiveExamsFromIDB();
      const needsFullExamSync = localVersions.examVersion === 0;

      if (needsFullExamSync) {
        const snap = await getDocs(collection(db, 'live_exams'));
        const activeExams: LiveExam[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!data.deletedAt && !data.isDeleted) {
            activeExams.push(normalizeLiveExam({
              ...data,
              id: String(data.id || d.id),
              version: data.version || serverVersions.examVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (activeExams.length > 0) {
          await saveLiveExamsToIDB(activeExams);
          await insertLiveExams(activeExams);
          try {
            localStorage.setItem('orjon_live_exams', JSON.stringify(activeExams));
          } catch {}
          result.examsUpdated = activeExams.length;
          result.hasChanges = true;
          options.onLiveExamsUpdate?.(activeExams);
        }
        updatedLocalVersions.examVersion = serverVersions.examVersion;
      } else if (serverVersions.examVersion > localVersions.examVersion) {
        const qDiff = query(
          collection(db, 'live_exams'),
          where('version', '>', localVersions.examVersion)
        );
        const snap = await getDocs(qDiff);

        if (!snap.empty) {
          const toUpsert: LiveExam[] = [];
          const toRemoveIds: string[] = [];

          snap.forEach((d) => {
            const data = d.data();
            const id = String(data.id || d.id);
            if (data.deletedAt || data.isDeleted) {
              toRemoveIds.push(id);
            } else {
              toUpsert.push(normalizeLiveExam({
                ...data,
                id,
                version: data.version || serverVersions.examVersion,
                updatedAt: data.updatedAt || new Date().toISOString(),
                deletedAt: null
              }));
            }
          });

          if (toUpsert.length > 0 || toRemoveIds.length > 0) {
            await upsertLiveExamsToIDB(toUpsert, toRemoveIds);
            if (toUpsert.length > 0) await insertLiveExams(toUpsert);
            for (const id of toRemoveIds) await deleteLiveExamFromSQLite(id);

            result.examsUpdated = toUpsert.length;
            result.examsRemoved = toRemoveIds.length;
            result.hasChanges = true;

            const allUpdated = await getLiveExamsFromIDB();
            try {
              localStorage.setItem('orjon_live_exams', JSON.stringify(allUpdated));
            } catch {}
            options.onLiveExamsUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.examVersion = serverVersions.examVersion;
      }

      // 5b. Routines
      const localRoutines = await getRoutinesFromIDB();
      const needsFullRoutineSync = localVersions.routineVersion === 0;

      if (needsFullRoutineSync) {
        const snap = await getDocs(collection(db, 'routines'));
        const activeRoutines: Routine[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!data.deletedAt && !data.isDeleted) {
            activeRoutines.push(normalizeRoutine({
              ...data,
              id: String(data.id || d.id),
              version: data.version || serverVersions.routineVersion,
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            }));
          }
        });

        if (activeRoutines.length > 0) {
          await saveRoutinesToIDB(activeRoutines);
          await insertRoutines(activeRoutines);
          try {
            localStorage.setItem('orjon_routines', JSON.stringify(activeRoutines));
          } catch {}
          result.routinesUpdated = activeRoutines.length;
          result.hasChanges = true;
          options.onRoutinesUpdate?.(activeRoutines);
        }
        updatedLocalVersions.routineVersion = serverVersions.routineVersion;
      } else if (serverVersions.routineVersion > localVersions.routineVersion) {
        const qDiff = query(
          collection(db, 'routines'),
          where('version', '>', localVersions.routineVersion)
        );
        const snap = await getDocs(qDiff);

        if (!snap.empty) {
          const toUpsert: Routine[] = [];
          const toRemoveIds: string[] = [];

          snap.forEach((d) => {
            const data = d.data();
            const id = String(data.id || d.id);
            if (data.deletedAt || data.isDeleted) {
              toRemoveIds.push(id);
            } else {
              toUpsert.push(normalizeRoutine({
                ...data,
                id,
                version: data.version || serverVersions.routineVersion,
                updatedAt: data.updatedAt || new Date().toISOString(),
                deletedAt: null
              }));
            }
          });

          if (toUpsert.length > 0 || toRemoveIds.length > 0) {
            await upsertRoutinesToIDB(toUpsert, toRemoveIds);
            if (toUpsert.length > 0) await insertRoutines(toUpsert);
            for (const id of toRemoveIds) await deleteRoutineFromSQLite(id);

            result.routinesUpdated = toUpsert.length;
            result.routinesRemoved = toRemoveIds.length;
            result.hasChanges = true;

            const allUpdated = await getRoutinesFromIDB();
            try {
              localStorage.setItem('orjon_routines', JSON.stringify(allUpdated));
            } catch {}
            options.onRoutinesUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.routineVersion = serverVersions.routineVersion;
      }
    } catch (eErr) {
      console.warn('[VersionSync] Exams and routines sync notice:', eErr);
    }

    // Save final updated local versions
    updatedLocalVersions.updatedAt = new Date().toISOString();
    await saveLocalSyncVersions(updatedLocalVersions);
    result.localVersions = updatedLocalVersions;

    options.onProgress?.('সিঙ্ক সফলভাবে সম্পন্ন হয়েছে!', 100);
    return result;
  } catch (err) {
    console.error('[VersionSync] Differential sync critical error:', err);
    return result;
  }
}

/**
 * 4. SOFT DELETE AND VERSION INCREMENT HELPERS
 */

/**
 * Soft delete a question: marks deletedAt timestamp, isDeleted: true, increments questionVersion.
 * Removes question from local SQLite and IndexedDB.
 */
export async function softDeleteQuestion(id: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const newVersion = await incrementGlobalVersion('questionVersion');

    // 1. Update Firestore
    const qDocRef = doc(db, 'questions', id);
    await updateDoc(qDocRef, {
      deletedAt: nowIso,
      isDeleted: true,
      updatedAt: nowIso,
      version: newVersion
    });

    // 2. Remove locally from SQLite & IDB
    await deleteQuestionFromSQLite(id);
    await upsertQuestionsToIDB([], [id]);

    // 3. Update local version checkpoint
    const local = await getLocalSyncVersions();
    local.questionVersion = newVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteQuestion error:', err);
    return false;
  }
}

/**
 * Soft delete a category.
 */
export async function softDeleteCategory(id: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const newVersion = await incrementGlobalVersion('categoryVersion');

    const catDocRef = doc(db, 'categories', id);
    await updateDoc(catDocRef, {
      deletedAt: nowIso,
      isDeleted: true,
      updatedAt: nowIso,
      version: newVersion
    });

    await deleteCategoryFromSQLite(id);
    await upsertCategoriesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.categoryVersion = newVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteCategory error:', err);
    return false;
  }
}

/**
 * Soft delete a subcategory.
 */
export async function softDeleteSubcategory(id: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const newVersion = await incrementGlobalVersion('subcategoryVersion');

    const subDocRef = doc(db, 'subcategories', id);
    await updateDoc(subDocRef, {
      deletedAt: nowIso,
      isDeleted: true,
      updatedAt: nowIso,
      version: newVersion
    });

    await deleteSubcategoryFromSQLite(id);
    await upsertSubcategoriesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.subcategoryVersion = newVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteSubcategory error:', err);
    return false;
  }
}

/**
 * Soft delete a course.
 */
export async function softDeleteCourse(id: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const newVersion = await incrementGlobalVersion('courseVersion');

    const courseDocRef = doc(db, 'courses', id);
    await updateDoc(courseDocRef, {
      deletedAt: nowIso,
      isDeleted: true,
      updatedAt: nowIso,
      version: newVersion
    });

    await deleteCourseFromSQLite(id);
    await upsertCoursesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.courseVersion = newVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteCourse error:', err);
    return false;
  }
}

/**
 * Soft delete a live exam.
 */
export async function softDeleteLiveExam(id: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const newVersion = await incrementGlobalVersion('examVersion');

    const examDocRef = doc(db, 'live_exams', id);
    await updateDoc(examDocRef, {
      deletedAt: nowIso,
      isDeleted: true,
      updatedAt: nowIso,
      version: newVersion
    });

    await deleteLiveExamFromSQLite(id);
    await upsertLiveExamsToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.examVersion = newVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteLiveExam error:', err);
    return false;
  }
}

/**
 * Soft delete a routine.
 */
export async function softDeleteRoutine(id: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const newVersion = await incrementGlobalVersion('routineVersion');

    const routineDocRef = doc(db, 'routines', id);
    await updateDoc(routineDocRef, {
      deletedAt: nowIso,
      isDeleted: true,
      updatedAt: nowIso,
      version: newVersion
    });

    await deleteRoutineFromSQLite(id);
    await upsertRoutinesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.routineVersion = newVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteRoutine error:', err);
    return false;
  }
}
