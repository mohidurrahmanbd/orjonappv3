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
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  commitAtomicMutationWithEventLog,
  commitAtomicBulkDeleteWithEventLog
} from './eventLogService';
import {
  fetchDeleteLogPage,
  applySingleEventToLocalStorage
} from './globalEventSyncService';
import {
  GlobalSyncVersions,
  Question,
  CategoryItem,
  SubcategoryItem,
  Course,
  LiveExam,
  Routine,
  Coupon,
  CourseEnrollment,
  PaymentSettings
} from '../../types';
import {
  getSQLiteDatabase,
  initSQLite
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
import { BUNDLED_CATEGORIES, BUNDLED_SUBCATEGORIES, BUNDLED_QUESTIONS } from '../sqlite/bundledData';
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

/**
 * Bundled APK Baseline Versions (Phase 4 Step 4E)
 * Actual checkpoint established by the bundled database in the APK.
 * - questionVersion: 10 (115 bundled questions up to version 10)
 * - categoryVersion: 1 (4 bundled categories at version 1)
 * - subcategoryVersion: 9 (362 bundled subcategories up to version 9)
 * - courseVersion: 1 (bundled baseline schema initialized at v1)
 * - examVersion: 1 (bundled baseline schema initialized at v1)
 * - routineVersion: 1 (bundled baseline schema initialized at v1)
 * - couponVersion: 1
 * - paymentSettingsVersion: 1
 * - globalVersion: 10 (chronological event checkpoint corresponding to the bundled baseline snapshot)
 * - updatedAt: '2026-09-20T09:32:35.592144+00:00'
 */
export const BUNDLED_BASELINE_VERSIONS: Readonly<GlobalSyncVersions> = Object.freeze({
  questionVersion: 10,
  categoryVersion: 1,
  subcategoryVersion: 9,
  courseVersion: 1,
  examVersion: 1,
  routineVersion: 1,
  couponVersion: 1,
  paymentSettingsVersion: 1,
  globalVersion: 10,
  updatedAt: '2026-09-20T09:32:35.592144+00:00'
});

export const DEFAULT_GLOBAL_VERSIONS: GlobalSyncVersions = {
  questionVersion: 10,
  categoryVersion: 1,
  subcategoryVersion: 9,
  courseVersion: 1,
  examVersion: 1,
  routineVersion: 1,
  couponVersion: 1,
  paymentSettingsVersion: 1,
  globalVersion: 10,
  updatedAt: '2026-09-20T09:32:35.592144+00:00'
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
        couponVersion: Number(data.couponVersion || 1),
        paymentSettingsVersion: Number(data.paymentSettingsVersion || 1),
        globalVersion: Number(data.globalVersion || 0),
        latestAppVersion: data.latestAppVersion,
        minimumSupportedAppVersion: data.minimumSupportedAppVersion,
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
 * Atomically increment a specific collection version and globalVersion in `meta/versions`.
 * Uses Firestore transaction to guarantee strict monotonicity and prevent race conditions.
 */
export async function incrementGlobalVersion(
  entity: 'questionVersion' | 'categoryVersion' | 'subcategoryVersion' | 'courseVersion' | 'examVersion' | 'routineVersion' | 'couponVersion' | 'paymentSettingsVersion'
): Promise<number> {
  try {
    const versionDocRef = doc(db, 'meta', 'versions');
    const nowIso = new Date().toISOString();

    const newVal = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(versionDocRef);
      const data = snap.exists() ? snap.data() : {};
      const currentVal = Number(data?.[entity] || 1);
      const nextVal = currentVal + 1;
      const currentGlobal = Number(data?.globalVersion || 0);
      const nextGlobal = currentGlobal + 1;

      transaction.set(
        versionDocRef,
        {
          [entity]: nextVal,
          globalVersion: nextGlobal,
          updatedAt: nowIso
        },
        { merge: true }
      );

      return nextVal;
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
    couponVersion: 0,
    paymentSettingsVersion: 0,
    globalVersion: 0,
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
        couponVersion: Number(parsed.couponVersion || 0),
        paymentSettingsVersion: Number(parsed.paymentSettingsVersion || 0),
        globalVersion: Number(parsed.globalVersion || 0),
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
      if (k === 'couponVersion' && v > (versions.couponVersion || 0)) versions.couponVersion = v;
      if (k === 'paymentSettingsVersion' && v > (versions.paymentSettingsVersion || 0)) versions.paymentSettingsVersion = v;
      if (k === 'globalVersion' && v > (versions.globalVersion || 0)) versions.globalVersion = v;
      if (k === 'updatedAt' && !versions.updatedAt && r.value) versions.updatedAt = String(r.value);
    });
  } catch {}

  // Fresh Install Bundled Baseline Checkpoint Initialization:
  // For bundled collections (questions, categories, subcategories, courses, live_exams, routines),
  // initialize the local checkpoint to the actual version represented by the bundled APK baseline.
  // DO NOT invent or blindly hardcode version "1".
  if (versions.globalVersion === 0) {
    versions.globalVersion = BUNDLED_BASELINE_VERSIONS.globalVersion;
    if (versions.questionVersion === 0) versions.questionVersion = BUNDLED_BASELINE_VERSIONS.questionVersion;
    if (versions.categoryVersion === 0) versions.categoryVersion = BUNDLED_BASELINE_VERSIONS.categoryVersion;
    if (versions.subcategoryVersion === 0) versions.subcategoryVersion = BUNDLED_BASELINE_VERSIONS.subcategoryVersion;
    if (versions.courseVersion === 0) versions.courseVersion = BUNDLED_BASELINE_VERSIONS.courseVersion;
    if (versions.examVersion === 0) versions.examVersion = BUNDLED_BASELINE_VERSIONS.examVersion;
    if (versions.routineVersion === 0) versions.routineVersion = BUNDLED_BASELINE_VERSIONS.routineVersion;
    if (versions.couponVersion === 0) versions.couponVersion = BUNDLED_BASELINE_VERSIONS.couponVersion;
    if (versions.paymentSettingsVersion === 0) versions.paymentSettingsVersion = BUNDLED_BASELINE_VERSIONS.paymentSettingsVersion;
    if (!versions.updatedAt) versions.updatedAt = BUNDLED_BASELINE_VERSIONS.updatedAt;

    // Persist immediately across storage layers so subsequent reads retain checkpoint
    saveLocalSyncVersions(versions).catch(() => {});
  } else {
    // For bundled collections, ensure local version never remains 0 solely due to missing key
    if (versions.questionVersion === 0) versions.questionVersion = BUNDLED_BASELINE_VERSIONS.questionVersion;
    if (versions.categoryVersion === 0) versions.categoryVersion = BUNDLED_BASELINE_VERSIONS.categoryVersion;
    if (versions.subcategoryVersion === 0) versions.subcategoryVersion = BUNDLED_BASELINE_VERSIONS.subcategoryVersion;
    if (versions.courseVersion === 0) versions.courseVersion = BUNDLED_BASELINE_VERSIONS.courseVersion;
    if (versions.examVersion === 0) versions.examVersion = BUNDLED_BASELINE_VERSIONS.examVersion;
    if (versions.routineVersion === 0) versions.routineVersion = BUNDLED_BASELINE_VERSIONS.routineVersion;
  }

  return versions;
}

/**
 * Explicitly initializes local stores and checkpoints from the bundled APK baseline on fresh install.
 * Required flow:
 * Bundled APK baseline → Local Store → Local global checkpoint → differential event sync
 */
export async function initializeFreshInstallBundledBaseline(): Promise<GlobalSyncVersions> {
  // 1. Initialize SQLite
  try {
    await initSQLite();
  } catch {}

  // 2. Populate IDB from SQLite or bundled constants if empty
  try {
    const localQs = await getQuestionsFromIDB();
    if (localQs.length === 0) {
      const sqliteQs = await getAllQuestionsFromSQLite();
      if (sqliteQs && sqliteQs.length > 0) {
        await saveQuestionsToIDB(sqliteQs);
      } else if (BUNDLED_QUESTIONS.length > 0) {
        await saveQuestionsToIDB(BUNDLED_QUESTIONS);
      }
    }
  } catch {}

  try {
    const localCats = await getCategoriesFromIDB();
    if (localCats.length === 0) {
      const sqliteCats = await getAllCategoriesFromSQLite();
      if (sqliteCats && sqliteCats.length > 0) {
        await saveCategoriesToIDB(sqliteCats);
      } else if (BUNDLED_CATEGORIES.length > 0) {
        await saveCategoriesToIDB(BUNDLED_CATEGORIES);
      }
    }
  } catch {}

  try {
    const localSubs = await getSubcategoriesFromIDB();
    if (localSubs.length === 0) {
      const sqliteSubs = await getAllSubcategoriesFromSQLite();
      if (sqliteSubs && sqliteSubs.length > 0) {
        await saveSubcategoriesToIDB(sqliteSubs);
      } else if (BUNDLED_SUBCATEGORIES.length > 0) {
        await saveSubcategoriesToIDB(BUNDLED_SUBCATEGORIES);
      }
    }
  } catch {}

  // 3. Establish and return local global checkpoint
  const versions = await getLocalSyncVersions();
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
    couponVersion: Number(versions.couponVersion || 0),
    paymentSettingsVersion: Number(versions.paymentSettingsVersion || 0),
    globalVersion: Number(versions.globalVersion || 0),
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
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['couponVersion', String(cleanVersions.couponVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['paymentSettingsVersion', String(cleanVersions.paymentSettingsVersion)]);
    await dbInstance.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?);', ['globalVersion', String(cleanVersions.globalVersion)]);
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

    const localCourseVersion = (localVersions.courseVersion && localVersions.courseVersion > 0)
      ? localVersions.courseVersion
      : BUNDLED_BASELINE_VERSIONS.courseVersion;
    const serverCourseVersion = serverVersions.courseVersion || 1;

    // Zero reads optimization: version matches baseline/server
    if (localCourseVersion >= serverCourseVersion) {
      console.log(`[VersionSync] Courses up to date (v${localCourseVersion}). 0 collection reads.`);
      return { hasChanges: false, updatedCount: 0, removedCount: 0 };
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

/**
 * Metadata-First Coupon Sync
 * 1. Checks `meta/versions` (1 doc read).
 * 2. If local couponVersion matches server couponVersion: 0 collection reads!
 * 3. If server couponVersion > local couponVersion: fetches only modified coupons (version > localCouponVersion).
 * 4. Filters out soft-deleted / tombstoned coupons.
 */
export async function syncCouponsMetadataFirst(
  onUpdate?: (coupons: Coupon[]) => void
): Promise<{ hasChanges: boolean; updatedCount: number; removedCount: number }> {
  try {
    const serverVersions = await getGlobalSyncVersions();
    const localVersions = await getLocalSyncVersions();

    let localCoupons: Coupon[] = [];
    try {
      const raw = localStorage.getItem('orjon_coupons');
      if (raw) localCoupons = JSON.parse(raw);
    } catch {}

    const localCouponVersion = localVersions.couponVersion || 0;
    const serverCouponVersion = serverVersions.couponVersion || 1;

    // Zero reads optimization: version matches and local data present
    if (localCouponVersion >= serverCouponVersion && localCoupons.length > 0) {
      console.log(`[VersionSync] Coupons up to date (v${localCouponVersion}). 0 collection reads.`);
      return { hasChanges: false, updatedCount: 0, removedCount: 0 };
    }

    // Initial fresh sync (local version is 0)
    if (localCouponVersion === 0) {
      console.log(`[VersionSync] Initial coupons sync (v${serverCouponVersion})...`);
      const snap = await getDocs(collection(db, 'coupons'));
      const activeCoupons: Coupon[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          activeCoupons.push({
            ...data,
            id: String(data.id || d.id),
            version: data.version || serverCouponVersion,
            createdAt: data.createdAt || new Date().toISOString()
          } as Coupon);
        }
      });

      try {
        localStorage.setItem('orjon_coupons', JSON.stringify(activeCoupons));
      } catch {}
      if (onUpdate) onUpdate(activeCoupons);

      localVersions.couponVersion = serverCouponVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);

      return { hasChanges: activeCoupons.length > 0, updatedCount: activeCoupons.length, removedCount: 0 };
    }

    // Differential sync: fetch only coupons with version > localCouponVersion
    if (serverCouponVersion > localCouponVersion) {
      console.log(`[VersionSync] Differential coupons sync: local v${localCouponVersion} -> server v${serverCouponVersion}`);
      const qDiff = query(
        collection(db, 'coupons'),
        where('version', '>', localCouponVersion)
      );
      const snap = await getDocs(qDiff);

      if (!snap.empty) {
        const toUpsertMap = new Map<string, Coupon>();
        const toRemoveIds = new Set<string>();

        snap.forEach((d) => {
          const data = d.data();
          const couponId = String(data.id || d.id);
          if (data.deletedAt || data.isDeleted) {
            toRemoveIds.add(couponId);
          } else {
            toUpsertMap.set(couponId, {
              ...data,
              id: couponId,
              version: data.version || serverCouponVersion,
              createdAt: data.createdAt || new Date().toISOString()
            } as Coupon);
          }
        });

        let merged = localCoupons.filter(c => !toRemoveIds.has(c.id) && !toUpsertMap.has(c.id));
        merged = [...merged, ...Array.from(toUpsertMap.values())];

        try {
          localStorage.setItem('orjon_coupons', JSON.stringify(merged));
        } catch {}
        if (onUpdate) onUpdate(merged);

        localVersions.couponVersion = serverCouponVersion;
        localVersions.updatedAt = new Date().toISOString();
        await saveLocalSyncVersions(localVersions);

        return { hasChanges: true, updatedCount: toUpsertMap.size, removedCount: toRemoveIds.size };
      }

      localVersions.couponVersion = serverCouponVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);
    }

    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  } catch (err) {
    console.warn('[VersionSync] syncCouponsMetadataFirst notice:', err);
    return { hasChanges: false, updatedCount: 0, removedCount: 0 };
  }
}

/**
 * Metadata-First Payment Settings Sync
 * 1. Checks `meta/versions` (1 doc read).
 * 2. If local paymentSettingsVersion matches server paymentSettingsVersion: 0 collection reads!
 * 3. Reads Firestore collection only when version changes.
 */
export async function syncPaymentSettingsMetadataFirst(
  onUpdate?: (settings: PaymentSettings) => void
): Promise<{ hasChanges: boolean }> {
  try {
    const serverVersions = await getGlobalSyncVersions();
    const localVersions = await getLocalSyncVersions();

    let localSettings: PaymentSettings | null = null;
    try {
      const raw = localStorage.getItem('orjon_payment_settings');
      if (raw) localSettings = JSON.parse(raw);
    } catch {}

    const localPSVersion = localVersions.paymentSettingsVersion || 0;
    const serverPSVersion = serverVersions.paymentSettingsVersion || 1;

    // Zero reads optimization: version matches and local data present with numbers
    if (localPSVersion >= serverPSVersion && localSettings && (localSettings.bkashNumber || localSettings.nagadNumber || localSettings.rocketNumber)) {
      console.log(`[VersionSync] Payment settings up to date (v${localPSVersion}). 0 collection reads.`);
      return { hasChanges: false };
    }

    // Version differs or empty local settings: fetch from Firestore
    console.log(`[VersionSync] Fetching payment_settings from Firestore (server v${serverPSVersion})...`);
    const snap = await getDocs(collection(db, 'payment_settings'));
    if (!snap.empty) {
      const docData = snap.docs[0].data() as PaymentSettings;
      const cleanSettings: PaymentSettings = {
        bkashNumber: docData.bkashNumber || '',
        bkashType: docData.bkashType || 'Personal',
        nagadNumber: docData.nagadNumber || '',
        nagadType: docData.nagadType || 'Personal',
        rocketNumber: docData.rocketNumber || '',
        rocketType: docData.rocketType || 'Personal',
        instructions: docData.instructions || '',
        version: docData.version || serverPSVersion,
        updatedAt: docData.updatedAt || new Date().toISOString()
      };

      try {
        localStorage.setItem('orjon_payment_settings', JSON.stringify(cleanSettings));
      } catch {}
      if (onUpdate) onUpdate(cleanSettings);

      localVersions.paymentSettingsVersion = serverPSVersion;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);

      return { hasChanges: true };
    }

    localVersions.paymentSettingsVersion = serverPSVersion;
    localVersions.updatedAt = new Date().toISOString();
    await saveLocalSyncVersions(localVersions);
    return { hasChanges: false };
  } catch (err) {
    console.warn('[VersionSync] syncPaymentSettingsMetadataFirst notice:', err);
    return { hasChanges: false };
  }
}

/**
 * Resolves a stable identifier for local user caching (e.g. enrolled courses).
 * Prioritizes permanently immutable identifiers (verified email, phone, Auth UID)
 * so that user.userId changes during future migrations do not orphan local caches.
 */
export function getUserStableStorageKey(user?: { id?: string; userId?: string; phone?: string; email?: string } | null): string {
  const email = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
  if (email) return `email_${email}`;
  const phone = (user?.phone || '').trim();
  if (phone) return `phone_${phone}`;
  const authUid = auth.currentUser?.uid || (user as any)?.authUid || (user?.id && !user.id.startsWith('user_') ? user.id : '');
  if (authUid) return `uid_${authUid}`;
  const rawId = (user?.userId || user?.id || '').trim();
  if (rawId && !rawId.startsWith('user_')) return `id_${rawId}`;
  return 'default_user';
}

/**
 * Retrieves cached enrolled course IDs using the stable identifier strategy,
 * with automatic transparent migration from legacy keys.
 */
export function getStoredEnrolledCourseIds(user?: { id?: string; userId?: string; phone?: string; email?: string; authUid?: string } | null): string[] {
  try {
    const stableKey = getUserStableStorageKey(user);
    const primary = localStorage.getItem(`orjon_enrolled_courses_${stableKey}`);
    if (primary) {
      return JSON.parse(primary);
    }
    // Backward compatibility fallback: check legacy keys
    const legacyKeys = [
      user?.userId ? `orjon_enrolled_courses_${user.userId}` : '',
      (user as any)?.authUid ? `orjon_enrolled_courses_${(user as any).authUid}` : '',
      auth.currentUser?.uid ? `orjon_enrolled_courses_${auth.currentUser.uid}` : '',
      user?.phone ? `orjon_enrolled_courses_${user.phone}` : '',
      user?.email ? `orjon_enrolled_courses_${user.email}` : '',
      'orjon_enrolled_courses_user'
    ].filter(Boolean);

    for (const key of legacyKeys) {
      const legacyVal = localStorage.getItem(key);
      if (legacyVal) {
        const parsed = JSON.parse(legacyVal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Transparently populate stable key for future instant lookups
          localStorage.setItem(`orjon_enrolled_courses_${stableKey}`, legacyVal);
          return parsed;
        }
      }
    }
  } catch {}
  return [];
}

/**
 * Persists enrolled course IDs to localStorage using the stable identifier strategy,
 * while maintaining backward-compatible mirror entries on legacy keys.
 */
export function setStoredEnrolledCourseIds(
  courseIds: string[],
  user?: { id?: string; userId?: string; phone?: string; email?: string; authUid?: string } | null
): void {
  try {
    const stableKey = getUserStableStorageKey(user);
    const jsonStr = JSON.stringify(courseIds);
    localStorage.setItem(`orjon_enrolled_courses_${stableKey}`, jsonStr);

    // Maintain legacy keys for seamless backward compatibility
    if (user?.userId) {
      localStorage.setItem(`orjon_enrolled_courses_${user.userId}`, jsonStr);
    }
    if ((user as any)?.authUid) {
      localStorage.setItem(`orjon_enrolled_courses_${(user as any).authUid}`, jsonStr);
    }
    if (auth.currentUser?.uid) {
      localStorage.setItem(`orjon_enrolled_courses_${auth.currentUser.uid}`, jsonStr);
    }
    if (user?.phone) {
      localStorage.setItem(`orjon_enrolled_courses_${user.phone}`, jsonStr);
    }
  } catch {}
}

/**
 * On-Demand User Course Enrollment Sync
 * Restores user enrollments only when opening Courses, Purchased Courses, or Course-linked Exams.
 * Queries ONLY the authenticated user's records to minimize reads and prevent full collection downloads.
 */
export async function syncUserEnrollmentsOnDemand(
  user?: { id?: string; userId?: string; phone?: string; email?: string } | null,
  onUpdate?: (enrolledCourseIds: string[], enrollments: CourseEnrollment[]) => void
): Promise<{ enrolledCourseIds: string[]; enrollments: CourseEnrollment[] }> {
  const cachedCourseIds: string[] = getStoredEnrolledCourseIds(user);

  let cachedEnrollments: CourseEnrollment[] = [];
  try {
    const raw = localStorage.getItem('orjon_course_enrollments');
    if (raw) cachedEnrollments = JSON.parse(raw);
  } catch {}

  const authUser = auth.currentUser;
  const userEmail = (authUser?.email || user?.email || '').trim().toLowerCase();
  const userId = authUser?.uid || (user as any)?.authUid || (user?.id && !user.id.startsWith('user_') ? user.id : user?.userId);

  if (!userEmail && !userId && !user?.phone) {
    return { enrolledCourseIds: cachedCourseIds, enrollments: cachedEnrollments };
  }

  try {
    const enrollmentsCol = collection(db, 'course_enrollments');
    let snap;
    if (userEmail) {
      const q = query(enrollmentsCol, where('userEmail', '==', userEmail));
      snap = await getDocs(q);
      if (snap.empty && user?.phone) {
        const qPhone = query(enrollmentsCol, where('userPhone', '==', user.phone));
        snap = await getDocs(qPhone);
      }
    } else if (userId) {
      const q = query(enrollmentsCol, where('userId', '==', userId));
      snap = await getDocs(q);
    } else if (user?.phone) {
      const qPhone = query(enrollmentsCol, where('userPhone', '==', user.phone));
      snap = await getDocs(qPhone);
    }

    if (snap && !snap.empty) {
      const serverEnrollments: CourseEnrollment[] = [];
      const serverCourseIds: string[] = [];
      snap.forEach((d) => {
        const data = d.data() as CourseEnrollment;
        if (data.courseId) {
          serverCourseIds.push(data.courseId);
          serverEnrollments.push({
            ...data,
            id: d.id,
            enrolledAt: data.enrolledAt || new Date().toISOString()
          });
        }
      });

      const mergedCourseIds = Array.from(new Set([...cachedCourseIds, ...serverCourseIds]));

      const enrollmentMap = new Map<string, CourseEnrollment>();
      cachedEnrollments.forEach(e => { if (e.id) enrollmentMap.set(e.id, e); });
      serverEnrollments.forEach(e => { if (e.id) enrollmentMap.set(e.id, e); });
      const mergedEnrollments = Array.from(enrollmentMap.values());

      try {
        setStoredEnrolledCourseIds(mergedCourseIds, user);
        localStorage.setItem('orjon_course_enrollments', JSON.stringify(mergedEnrollments));
      } catch {}

      if (onUpdate) {
        onUpdate(mergedCourseIds, mergedEnrollments);
      }

      return { enrolledCourseIds: mergedCourseIds, enrollments: mergedEnrollments };
    }
  } catch (err) {
    console.warn('[VersionSync] syncUserEnrollmentsOnDemand notice:', err);
  }

  return { enrolledCourseIds: cachedCourseIds, enrollments: cachedEnrollments };
}

export async function softDeleteCoupon(id: string): Promise<boolean> {
  try {
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'coupons',
      entityType: 'coupon',
      entityId: String(id),
      action: 'delete',
      versionKey: 'couponVersion'
    });
    const local = await getLocalSyncVersions();
    local.couponVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
    await saveLocalSyncVersions(local);
    return true;
  } catch (err) {
    console.error('Error soft-deleting coupon:', err);
    return false;
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
      let localQuestions = await getQuestionsFromIDB();
      if (localQuestions.length === 0) {
        try {
          const sqliteQs = await getAllQuestionsFromSQLite();
          if (sqliteQs && sqliteQs.length > 0) {
            localQuestions = sqliteQs;
            await saveQuestionsToIDB(sqliteQs);
          } else if (BUNDLED_QUESTIONS.length > 0) {
            localQuestions = [...BUNDLED_QUESTIONS];
            await saveQuestionsToIDB(localQuestions);
            await insertQuestions(localQuestions);
          }
        } catch {}
      }

      const effectiveLocalQuestionVersion = (localVersions.questionVersion && localVersions.questionVersion > 0)
        ? localVersions.questionVersion
        : BUNDLED_BASELINE_VERSIONS.questionVersion;

      const needsFullQuestionSync = effectiveLocalQuestionVersion === 0 && localQuestions.length === 0;

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
      } else if (serverVersions.questionVersion > effectiveLocalQuestionVersion) {
        // Differential Sync for Questions
        const qDiff = query(
          collection(db, 'questions'),
          where('version', '>', effectiveLocalQuestionVersion)
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
      } else {
        updatedLocalVersions.questionVersion = Math.max(effectiveLocalQuestionVersion, serverVersions.questionVersion);
      }
    } catch (qErr) {
      console.warn('[VersionSync] Questions sync notice:', qErr);
    }

    // --- 2. CATEGORIES SYNC ---
    try {
      options.onProgress?.('ক্যাটাগরি সিঙ্ক করা হচ্ছে...', 40);
      let localCats = await getCategoriesFromIDB();
      if (localCats.length === 0) {
        try {
          const sqliteCats = await getAllCategoriesFromSQLite();
          if (sqliteCats && sqliteCats.length > 0) {
            localCats = sqliteCats;
            await saveCategoriesToIDB(sqliteCats);
          } else if (BUNDLED_CATEGORIES.length > 0) {
            localCats = [...BUNDLED_CATEGORIES];
            await saveCategoriesToIDB(localCats);
            await insertCategories(localCats);
          }
        } catch {}
      }

      const effectiveLocalCatVersion = (localVersions.categoryVersion && localVersions.categoryVersion > 0)
        ? localVersions.categoryVersion
        : BUNDLED_BASELINE_VERSIONS.categoryVersion;

      const needsFullCatSync = effectiveLocalCatVersion === 0 && localCats.length === 0;

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
      } else if (serverVersions.categoryVersion > effectiveLocalCatVersion) {
        const qDiff = query(
          collection(db, 'categories'),
          where('version', '>', effectiveLocalCatVersion)
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
      } else {
        updatedLocalVersions.categoryVersion = Math.max(effectiveLocalCatVersion, serverVersions.categoryVersion);
      }
    } catch (cErr) {
      console.warn('[VersionSync] Categories sync notice:', cErr);
    }

    // --- 3. SUBCATEGORIES SYNC ---
    try {
      options.onProgress?.('সাব-ক্যাটাগরি সিঙ্ক করা হচ্ছে...', 55);
      let localSubs = await getSubcategoriesFromIDB();
      if (localSubs.length === 0) {
        try {
          await initSQLite();
          const sqliteSubs = await getAllSubcategoriesFromSQLite();
          if (sqliteSubs && sqliteSubs.length > 0) {
            localSubs = sqliteSubs;
            await saveSubcategoriesToIDB(sqliteSubs);
          }
        } catch {}
      }

      if (localSubs.length === 0 && Array.isArray(BUNDLED_SUBCATEGORIES) && BUNDLED_SUBCATEGORIES.length > 0) {
        localSubs = [...BUNDLED_SUBCATEGORIES];
        await saveSubcategoriesToIDB(localSubs);
        await insertSubcategories(localSubs);
      }

      const effectiveLocalVersion = (localVersions.subcategoryVersion && localVersions.subcategoryVersion > 0)
        ? localVersions.subcategoryVersion
        : BUNDLED_BASELINE_VERSIONS.subcategoryVersion;

      const needsFullSubSync = effectiveLocalVersion === 0 && localSubs.length === 0;

      if (needsFullSubSync) {
        console.log('[VersionSync] Empty local cache. Performing recovery subcategories sync from Firestore...');
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
          try {
            localStorage.setItem('orjon_subcategories', JSON.stringify(activeSubs));
          } catch {}
          result.subcategoriesUpdated = activeSubs.length;
          result.hasChanges = true;
          options.onSubcategoriesUpdate?.(activeSubs);
        }
        updatedLocalVersions.subcategoryVersion = serverVersions.subcategoryVersion;
      } else if (serverVersions.subcategoryVersion > effectiveLocalVersion) {
        const qDiff = query(
          collection(db, 'subcategories'),
          where('version', '>', effectiveLocalVersion)
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
            try {
              localStorage.setItem('orjon_subcategories', JSON.stringify(allUpdated));
            } catch {}
            options.onSubcategoriesUpdate?.(allUpdated);
          }
        }
        updatedLocalVersions.subcategoryVersion = serverVersions.subcategoryVersion;
      } else {
        // Zero reads: local version is up-to-date and local cache exists
        console.log(`[VersionSync] Subcategories up-to-date (v${effectiveLocalVersion}). 0 collection reads.`);
        try {
          if (!localStorage.getItem('orjon_subcategories') && localSubs.length > 0) {
            localStorage.setItem('orjon_subcategories', JSON.stringify(localSubs));
          }
        } catch {}
        updatedLocalVersions.subcategoryVersion = Math.max(effectiveLocalVersion, serverVersions.subcategoryVersion);
      }
    } catch (sErr) {
      console.warn('[VersionSync] Subcategories sync notice:', sErr);
    }

    // --- 4. COURSES SYNC ---
    try {
      options.onProgress?.('কোর্স সিঙ্ক করা হচ্ছে...', 70);
      const localCourses = await getCoursesFromIDB();
      const effectiveLocalCourseVersion = (localVersions.courseVersion && localVersions.courseVersion > 0)
        ? localVersions.courseVersion
        : BUNDLED_BASELINE_VERSIONS.courseVersion;
      const needsFullCourseSync = effectiveLocalCourseVersion === 0 && localCourses.length === 0;

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
      } else if (serverVersions.courseVersion > effectiveLocalCourseVersion) {
        const qDiff = query(
          collection(db, 'courses'),
          where('version', '>', effectiveLocalCourseVersion)
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
      } else {
        updatedLocalVersions.courseVersion = Math.max(effectiveLocalCourseVersion, serverVersions.courseVersion);
      }
    } catch (cErr) {
      console.warn('[VersionSync] Courses sync notice:', cErr);
    }

    // --- 5. LIVE EXAMS & ROUTINES SYNC ---
    try {
      options.onProgress?.('লাইভ পরীক্ষা ও রুটিন সিঙ্ক করা হচ্ছে...', 85);

      // 5a. Live Exams
      const localExams = await getLiveExamsFromIDB();
      const effectiveLocalExamVersion = (localVersions.examVersion && localVersions.examVersion > 0)
        ? localVersions.examVersion
        : BUNDLED_BASELINE_VERSIONS.examVersion;
      const needsFullExamSync = effectiveLocalExamVersion === 0 && localExams.length === 0;

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
      } else if (serverVersions.examVersion > effectiveLocalExamVersion) {
        const qDiff = query(
          collection(db, 'live_exams'),
          where('version', '>', effectiveLocalExamVersion)
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
      } else {
        updatedLocalVersions.examVersion = Math.max(effectiveLocalExamVersion, serverVersions.examVersion);
      }

      // 5b. Routines
      const localRoutines = await getRoutinesFromIDB();
      const effectiveLocalRoutineVersion = (localVersions.routineVersion && localVersions.routineVersion > 0)
        ? localVersions.routineVersion
        : BUNDLED_BASELINE_VERSIONS.routineVersion;
      const needsFullRoutineSync = effectiveLocalRoutineVersion === 0 && localRoutines.length === 0;

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
      } else if (serverVersions.routineVersion > effectiveLocalRoutineVersion) {
        const qDiff = query(
          collection(db, 'routines'),
          where('version', '>', effectiveLocalRoutineVersion)
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
      } else {
        updatedLocalVersions.routineVersion = Math.max(effectiveLocalRoutineVersion, serverVersions.routineVersion);
      }
    } catch (eErr) {
      console.warn('[VersionSync] Exams and routines sync notice:', eErr);
    }

    // Phase 3 Step 3H: Reconcile all delete_log events if server globalVersion advanced
    const sinceGlobal = localVersions.globalVersion || 0;
    const serverGlobal = serverVersions.globalVersion || 0;
    if (serverGlobal > sinceGlobal) {
      try {
        let currentDelGlobal = sinceGlobal;
        while (currentDelGlobal < serverGlobal) {
          const deleteLogEvents = await fetchDeleteLogPage(currentDelGlobal, 200);
          if (deleteLogEvents.length === 0) break;
          for (const delEvt of deleteLogEvents) {
            await applySingleEventToLocalStorage({ logType: 'delete', ...delEvt });
            if (delEvt.globalVersion > currentDelGlobal) {
              currentDelGlobal = delEvt.globalVersion;
            }
          }
          if (deleteLogEvents.length < 200) break;
        }
      } catch (delReconcileErr) {
        console.warn('[VersionSync] Reconcile delete_log notice in differential sync:', delReconcileErr);
      }
    }

    // Save final updated local versions
    updatedLocalVersions.globalVersion = serverVersions.globalVersion || 0;
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
 * Soft delete a question: marks deletedAt timestamp, isDeleted: true, records delete_log event, increments globalVersion & questionVersion.
 * Removes question from local SQLite and IndexedDB.
 */
export async function softDeleteQuestion(id: string): Promise<boolean> {
  try {
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'questions',
      entityType: 'question',
      entityId: String(id),
      action: 'delete',
      versionKey: 'questionVersion'
    });

    // 2. Remove locally from SQLite & IDB
    await deleteQuestionFromSQLite(id);
    await upsertQuestionsToIDB([], [id]);

    // 3. Update local version checkpoint
    const local = await getLocalSyncVersions();
    local.questionVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteQuestion error:', err);
    return false;
  }
}

/**
 * Bulk soft delete questions: atomically records delete_log events and increments globalVersion & questionVersion.
 * Cleans local SQLite and IndexedDB.
 */
export async function bulkSoftDeleteQuestions(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  try {
    const res = await commitAtomicBulkDeleteWithEventLog(
      'questions',
      'question',
      'questionVersion',
      ids
    );

    // 2. Remove locally from SQLite & IDB
    await deleteQuestionsFromSQLite(ids);
    await upsertQuestionsToIDB([], ids);

    // 3. Update local version checkpoint
    const local = await getLocalSyncVersions();
    local.questionVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] bulkSoftDeleteQuestions error:', err);
    return false;
  }
}

/**
 * Soft delete a category.
 */
export async function softDeleteCategory(id: string): Promise<boolean> {
  try {
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'categories',
      entityType: 'category',
      entityId: String(id),
      action: 'delete',
      versionKey: 'categoryVersion'
    });

    await deleteCategoryFromSQLite(id);
    await upsertCategoriesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.categoryVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
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
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'subcategories',
      entityType: 'subcategory',
      entityId: String(id),
      action: 'delete',
      versionKey: 'subcategoryVersion'
    });

    await deleteSubcategoryFromSQLite(id);
    await upsertSubcategoriesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.subcategoryVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteSubcategory error:', err);
    return false;
  }
}

/**
 * Bulk soft delete subcategories: atomically records delete_log events and increments globalVersion & subcategoryVersion.
 * Cleans local SQLite and IndexedDB.
 */
export async function bulkSoftDeleteSubcategories(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  try {
    const res = await commitAtomicBulkDeleteWithEventLog(
      'subcategories',
      'subcategory',
      'subcategoryVersion',
      ids
    );

    // 2. Remove locally from SQLite & IDB
    for (const id of ids) {
      await deleteSubcategoryFromSQLite(id);
    }
    await upsertSubcategoriesToIDB([], ids);

    // 3. Update local version checkpoint
    const local = await getLocalSyncVersions();
    local.subcategoryVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] bulkSoftDeleteSubcategories error:', err);
    return false;
  }
}

/**
 * Soft delete a course.
 */
export async function softDeleteCourse(id: string): Promise<boolean> {
  try {
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'courses',
      entityType: 'course',
      entityId: String(id),
      action: 'delete',
      versionKey: 'courseVersion'
    });

    await deleteCourseFromSQLite(id);
    await upsertCoursesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.courseVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
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
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'live_exams',
      entityType: 'live_exam',
      entityId: String(id),
      action: 'delete',
      versionKey: 'examVersion'
    });

    await deleteLiveExamFromSQLite(id);
    await upsertLiveExamsToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.examVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
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
    const res = await commitAtomicMutationWithEventLog({
      collectionName: 'routines',
      entityType: 'routine',
      entityId: String(id),
      action: 'delete',
      versionKey: 'routineVersion'
    });

    await deleteRoutineFromSQLite(id);
    await upsertRoutinesToIDB([], [id]);

    const local = await getLocalSyncVersions();
    local.routineVersion = res.entityVersion;
    local.globalVersion = res.globalVersion;
    await saveLocalSyncVersions(local);

    return true;
  } catch (err) {
    console.error('[VersionSync] softDeleteRoutine error:', err);
    return false;
  }
}

// 5. PHASE 3 GLOBAL EVENT-BASED CLIENT SYNC RE-EXPORTS
export {
  performGlobalEventSync,
  establishSafeGlobalCheckpoint,
  applySingleEventToLocalStorage
} from './globalEventSyncService';
export type {
  GlobalEventSyncOptions,
  GlobalEventSyncResult,
  UnifiedSyncEvent
} from './globalEventSyncService';

// 6. EVENT LOG & DELETE VALIDATION RE-EXPORTS
export {
  validateDeleteLogEvent,
  VERSIONED_COLLECTIONS,
  getEntityTypeForCollection
} from './eventLogService';
export type {
  DeleteLogValidationResult,
  VersionedCollectionName
} from './eventLogService';

// 9. PHASE 3 STEP 3C, 3D & 3E DELETE AUTHORITY CUTOVER RE-EXPORTS
export {
  resolveDeletedEntityIds,
  monitorRuntimeConcordance,
  evaluateDeleteEventShadowAuthority,
  verifyCheckpointSafety,
  simulateDeleteLogOnlyBootstrap,
  generateCutoverReadinessReport,
  getDeleteAuthorityMode,
  setDeleteAuthorityMode,
  rollbackDeleteAuthority,
  verifyDeleteAuthorityReadiness,
  generateCutoverRuntimeReport,
  DELETE_AUTHORITY_MODE_STORAGE_KEY,
  // Step 3E exports
  monitorAuthorityDivergence,
  generateDualModeHealthReport,
  evaluateDualModeSafety,
  validateDualModeRollback,
  verifyDualAuthorityPilotReadiness,
  resetAuthorityModeToDefault,
  recordRuntimeMismatch,
  getRuntimeMismatchCount,
  resetRuntimeMismatchCount
} from './deleteAuthorityResolver';
export type {
  DeleteAuthorityMode,
  SetAuthorityModeResult,
  StartupAuthorityVerificationResult,
  CutoverRuntimeReport,
  ResolveDeletedIdsOptions,
  DualAuthorityResolutionResult,
  RuntimeConcordanceMetric,
  RuntimeConcordanceReport,
  ShadowAuthorityEvaluation,
  CheckpointSafetyCheckParams,
  CheckpointSafetyResult,
  FreshInstallSimulationScenario,
  FreshInstallSimulationResult,
  CutoverReadinessReport,
  // Step 3E types
  CollectionDivergenceMetric,
  AuthorityDivergenceReport,
  DualModeHealthReport,
  DualModeSafetyEvaluation,
  RollbackValidationResult
} from './deleteAuthorityResolver';
export {
  runStep3CVerification,
  runStep3DVerification,
  runStep3EVerification,
  runStep3GVerification
} from './deleteAuthorityCutoverVerifier';
export type {
  Step3CScenarioResult,
  Step3CForensicVerificationReport,
  Step3DScenarioResult,
  Step3DForensicVerificationReport,
  Step3EScenarioResult,
  Step3EVerificationReport,
  Step3GScenarioResult,
  Step3GVerificationReport
} from './deleteAuthorityCutoverVerifier';

// 9. PHASE 3 STEP 3G SAFE DELETE_LOG_ONLY WRITE CUTOVER RE-EXPORTS
export {
  runPreCutoverDependencyAudit,
  getDeleteLogWriteMode,
  setDeleteLogWriteMode,
  isDeleteLogOnlyWritesActive,
  verifyDeleteLogOnlyReadiness,
  activateDeleteLogOnlyWrites,
  rollbackDeleteLogOnlyWrites,
  generateDeleteLogOnlyHealthReport,
  DELETE_LOG_WRITE_MODE_STORAGE_KEY
} from './deleteLogWriteActivationService';
export type {
  DeleteLogWriteMode,
  DependencyClassification,
  PreCutoverDependencyItem,
  PreCutoverDependencyReport,
  DeleteLogOnlyReadinessResult,
  DeleteLogOnlyHealthReport,
  RollbackResult
} from './deleteLogWriteActivationService';




