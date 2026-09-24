import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Question,
  CategoryItem,
  SubcategoryItem,
  Course,
  LiveExam,
  Routine,
  Coupon,
  PaymentSettings,
  GlobalSyncVersions
} from '../../types';
import { ChangeLogEvent, DeleteLogEvent, validateDeleteLogEvent } from './eventLogService';
import {
  getLocalSyncVersions,
  saveLocalSyncVersions,
  getGlobalSyncVersions,
  performDifferentialSync,
  BUNDLED_BASELINE_VERSIONS
} from './versionSyncService';
import {
  insertQuestion,
  deleteQuestion as deleteQuestionFromSQLite,
  insertCategory,
  deleteCategory as deleteCategoryFromSQLite,
  insertSubcategory,
  deleteSubcategory as deleteSubcategoryFromSQLite,
  insertCourse,
  deleteCourse as deleteCourseFromSQLite,
  insertLiveExam,
  deleteLiveExam as deleteLiveExamFromSQLite,
  insertRoutine,
  deleteRoutine as deleteRoutineFromSQLite
} from '../sqlite/sqliteService';
import {
  upsertQuestionsToIDB,
  upsertCategoriesToIDB,
  upsertSubcategoriesToIDB,
  upsertCoursesToIDB,
  upsertLiveExamsToIDB,
  upsertRoutinesToIDB,
  normalizeQuestion,
  normalizeCourse,
  normalizeLiveExam,
  normalizeRoutine
} from '../indexedDB';

export type UnifiedSyncEvent =
  | ({ logType: 'change' } & ChangeLogEvent)
  | ({ logType: 'delete'; data?: never } & DeleteLogEvent);

export interface GlobalEventSyncOptions {
  pageSize?: number;
  onProgress?: (status: string, progress: number) => void;
  onQuestionsUpdate?: (questions: Question[]) => void;
  onCategoriesUpdate?: (categories: CategoryItem[]) => void;
  onSubcategoriesUpdate?: (subcategories: SubcategoryItem[]) => void;
  onCoursesUpdate?: (courses: Course[]) => void;
  onLiveExamsUpdate?: (exams: LiveExam[]) => void;
  onRoutinesUpdate?: (routines: Routine[]) => void;
  /**
   * By default, if local globalVersion is 0, the sync service will establish
   * a safe baseline first rather than replaying from 0 (preventing missed pre-Phase 2 data).
   * Setting forceAllowFromZero=true allows testing/replaying from version 0 explicitly.
   */
  forceAllowFromZero?: boolean;
}

export interface GlobalEventSyncResult {
  success: boolean;
  eventsProcessed: number;
  eventsApplied: {
    questions: number;
    categories: number;
    subcategories: number;
    courses: number;
    exams: number;
    routines: number;
    coupons: number;
    paymentSettings: number;
  };
  eventsDeleted: {
    questions: number;
    categories: number;
    subcategories: number;
    courses: number;
    exams: number;
    routines: number;
    coupons: number;
  };
  initialCheckpoint: number;
  finalCheckpoint: number;
  hasChanges: boolean;
  gapDetected?: boolean;
  gapAtVersion?: number;
  error?: string;
  readsCount: {
    changeLogReads: number;
    deleteLogReads: number;
    primaryDocumentReads: 0;
  };
}

/**
 * Paged query for change_log events strictly greater than a given globalVersion.
 */
export async function fetchChangeLogPage(
  sinceGlobalVersion: number,
  pageSize: number = 100
): Promise<ChangeLogEvent[]> {
  try {
    const q = query(
      collection(db, 'change_log'),
      where('globalVersion', '>', sinceGlobalVersion),
      orderBy('globalVersion', 'asc'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const events: ChangeLogEvent[] = [];
    snap.forEach((d) => events.push(d.data() as ChangeLogEvent));
    return events;
  } catch (err) {
    console.error('[GlobalEventSync] Error querying change_log page:', err);
    throw err;
  }
}

/**
 * Paged query for delete_log events strictly greater than a given globalVersion.
 */
export async function fetchDeleteLogPage(
  sinceGlobalVersion: number,
  pageSize: number = 100
): Promise<DeleteLogEvent[]> {
  try {
    const q = query(
      collection(db, 'delete_log'),
      where('globalVersion', '>', sinceGlobalVersion),
      orderBy('globalVersion', 'asc'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const events: DeleteLogEvent[] = [];
    snap.forEach((d) => events.push(d.data() as DeleteLogEvent));
    return events;
  } catch (err) {
    console.error('[GlobalEventSync] Error querying delete_log page:', err);
    throw err;
  }
}

/**
 * Applies a single event to the appropriate local storage layer:
 * - SQLite authoritative: questions, categories, subcategories (mirrored to IDB cache)
 * - IndexedDB authoritative: courses, live_exams, routines (mirrored to SQLite)
 * - localStorage: coupons, payment_settings
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * ZERO primary Firestore documents are read. Data is applied directly from the event snapshot or entityId.
 */
export async function applySingleEventToLocalStorage(event: UnifiedSyncEvent): Promise<void> {
  const { entity, collection: collName, entityId, action, data } = event;
  const isDelete = action === 'delete';

  // Phase 3 Step 2: Delete Log Validation Layer
  // Reject invalid delete events and guarantee no corrupted or orphan states are applied
  if (isDelete) {
    const valResult = validateDeleteLogEvent(event);
    if (!valResult.valid) {
      console.error(`[GlobalEventSync] Invalid delete_log event rejected: ${valResult.error}`, event);
      throw new Error(`INVALID_DELETE_LOG_EVENT: ${valResult.error}`);
    }
  }

  // Normalize target identifier
  const target = (entity || collName || '').toLowerCase().trim();

  // 1. QUESTIONS
  if (target === 'question' || target === 'questions') {
    const qId = String(entityId);
    if (isDelete) {
      await deleteQuestionFromSQLite(qId);
      await upsertQuestionsToIDB([], [qId]);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for question ${qId}`);
      const normQ = normalizeQuestion({
        ...data,
        id: qId,
        version: event.entityVersion || data.version,
        isDeleted: false,
        deletedAt: null
      });
      await insertQuestion(normQ);
      await upsertQuestionsToIDB([normQ], []);
    }
    return;
  }

  // 2. CATEGORIES
  if (target === 'category' || target === 'categories') {
    const catId = String(entityId);
    if (isDelete) {
      await deleteCategoryFromSQLite(catId);
      await upsertCategoriesToIDB([], [catId]);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for category ${catId}`);
      const cat: CategoryItem = {
        ...data,
        id: catId,
        version: event.entityVersion || data.version,
        isDeleted: false,
        deletedAt: null
      };
      await insertCategory(cat);
      await upsertCategoriesToIDB([cat], []);
    }
    return;
  }

  // 3. SUBCATEGORIES
  if (target === 'subcategory' || target === 'subcategories') {
    const subId = String(entityId);
    if (isDelete) {
      await deleteSubcategoryFromSQLite(subId);
      await upsertSubcategoriesToIDB([], [subId]);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for subcategory ${subId}`);
      const sub: SubcategoryItem = {
        ...data,
        id: subId,
        version: event.entityVersion || data.version,
        isDeleted: false,
        deletedAt: null
      };
      await insertSubcategory(sub);
      await upsertSubcategoriesToIDB([sub], []);
    }
    return;
  }

  // 4. COURSES
  if (target === 'course' || target === 'courses') {
    const courseId = String(entityId);
    if (isDelete) {
      await upsertCoursesToIDB([], [courseId]);
      await deleteCourseFromSQLite(courseId);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for course ${courseId}`);
      const normCourse = normalizeCourse({
        ...data,
        id: courseId,
        version: event.entityVersion || data.version,
        isDeleted: false,
        deletedAt: null
      });
      await upsertCoursesToIDB([normCourse], []);
      await insertCourse(normCourse);
    }
    return;
  }

  // 5. LIVE EXAMS
  if (target === 'live_exam' || target === 'live_exams' || target === 'liveexam') {
    const examId = String(entityId);
    if (isDelete) {
      await upsertLiveExamsToIDB([], [examId]);
      await deleteLiveExamFromSQLite(examId);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for live_exam ${examId}`);
      const normExam = normalizeLiveExam({
        ...data,
        id: examId,
        version: event.entityVersion || data.version,
        isDeleted: false,
        deletedAt: null
      });
      await upsertLiveExamsToIDB([normExam], []);
      await insertLiveExam(normExam);
    }
    return;
  }

  // 6. ROUTINES
  if (target === 'routine' || target === 'routines') {
    const routineId = String(entityId);
    if (isDelete) {
      await upsertRoutinesToIDB([], [routineId]);
      await deleteRoutineFromSQLite(routineId);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for routine ${routineId}`);
      const normRoutine = normalizeRoutine({
        ...data,
        id: routineId,
        version: event.entityVersion || data.version,
        isDeleted: false,
        deletedAt: null
      });
      await upsertRoutinesToIDB([normRoutine], []);
      await insertRoutine(normRoutine);
    }
    return;
  }

  // 7. COUPONS
  if (target === 'coupon' || target === 'coupons') {
    const couponId = String(entityId);
    let coupons: Coupon[] = [];
    try {
      const raw = localStorage.getItem('orjon_coupons');
      if (raw) coupons = JSON.parse(raw);
    } catch {}

    if (isDelete) {
      coupons = coupons.filter(c => String(c.id) !== couponId);
    } else {
      if (!data) throw new Error(`[GlobalEventSync] Missing snapshot data for coupon ${couponId}`);
      const cleanCoupon = {
        ...data,
        id: couponId,
        version: event.entityVersion || data.version
      };
      const existingIdx = coupons.findIndex(c => String(c.id) === couponId);
      if (existingIdx >= 0) {
        coupons[existingIdx] = cleanCoupon;
      } else {
        coupons.push(cleanCoupon);
      }
    }
    try {
      localStorage.setItem('orjon_coupons', JSON.stringify(coupons));
    } catch {}
    return;
  }

  // 8. PAYMENT SETTINGS
  if (target === 'payment_settings' || target === 'paymentsettings') {
    if (!isDelete && data) {
      const cleanSettings: PaymentSettings = {
        bkashNumber: data.bkashNumber || '',
        bkashType: data.bkashType || 'Personal',
        nagadNumber: data.nagadNumber || '',
        nagadType: data.nagadType || 'Personal',
        rocketNumber: data.rocketNumber || '',
        rocketType: data.rocketType || 'Personal',
        instructions: data.instructions || '',
        version: event.entityVersion || data.version,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      try {
        localStorage.setItem('orjon_payment_settings', JSON.stringify(cleanSettings));
      } catch {}
    }
    return;
  }

  console.warn(`[GlobalEventSync] Unhandled entity type "${target}" (id: ${entityId}). Skipping.`);
}

/**
 * Maps an entity type to the corresponding versionKey in GlobalSyncVersions.
 */
function getVersionKeyForEntity(target: string): keyof GlobalSyncVersions | null {
  const norm = target.toLowerCase().trim();
  if (norm === 'question' || norm === 'questions') return 'questionVersion';
  if (norm === 'category' || norm === 'categories') return 'categoryVersion';
  if (norm === 'subcategory' || norm === 'subcategories') return 'subcategoryVersion';
  if (norm === 'course' || norm === 'courses') return 'courseVersion';
  if (norm === 'live_exam' || norm === 'live_exams' || norm === 'liveexam') return 'examVersion';
  if (norm === 'routine' || norm === 'routines') return 'routineVersion';
  if (norm === 'coupon' || norm === 'coupons') return 'couponVersion';
  if (norm === 'payment_settings' || norm === 'paymentsettings') return 'paymentSettingsVersion';
  return null;
}

/**
 * Establishes a safe global checkpoint for a client whose local globalVersion is uninitialized (0).
 * Runs the authoritative differential sync to align all local collections with server state,
 * then persists the server's current globalVersion as the safe baseline checkpoint.
 */
export async function establishSafeGlobalCheckpoint(): Promise<number> {
  console.log('[GlobalEventSync] Establishing safe baseline checkpoint via existing sync engine...');
  const serverVersions = await getGlobalSyncVersions();
  await performDifferentialSync();
  const localVersions = await getLocalSyncVersions();

  const safeCheckpoint = Math.max(Number(serverVersions.globalVersion || 0), BUNDLED_BASELINE_VERSIONS.globalVersion);
  localVersions.globalVersion = safeCheckpoint;
  localVersions.updatedAt = new Date().toISOString();
  await saveLocalSyncVersions(localVersions);

  console.log(`[GlobalEventSync] Safe baseline established at globalVersion: ${safeCheckpoint}`);
  return safeCheckpoint;
}

/**
 * Core Global Event Sync Engine.
 *
 * Reads:
 *   change_log (filtered by globalVersion > localCheckpoint)
 *   delete_log (filtered by globalVersion > localCheckpoint)
 *
 * Guarantees:
 * 1. Strict ascending event ordering.
 * 2. Gap detection: halts sync if any expected monotonic version is absent.
 * 3. Atomic checkpoint persistence: checkpoint only advances after successful local write.
 * 4. Zero primary Firestore collection reads for change events (uses full snapshots).
 * 5. Safe pagination supporting 100, 1,000, 10,000+ events.
 * 6. Dual-sync compatibility: coexists peacefully with per-collection differential sync.
 */
export async function performGlobalEventSync(
  options: GlobalEventSyncOptions = {}
): Promise<GlobalEventSyncResult> {
  const pageSize = options.pageSize || 100;
  const result: GlobalEventSyncResult = {
    success: true,
    eventsProcessed: 0,
    eventsApplied: {
      questions: 0,
      categories: 0,
      subcategories: 0,
      courses: 0,
      exams: 0,
      routines: 0,
      coupons: 0,
      paymentSettings: 0
    },
    eventsDeleted: {
      questions: 0,
      categories: 0,
      subcategories: 0,
      courses: 0,
      exams: 0,
      routines: 0,
      coupons: 0
    },
    initialCheckpoint: 0,
    finalCheckpoint: 0,
    hasChanges: false,
    readsCount: {
      changeLogReads: 0,
      deleteLogReads: 0,
      primaryDocumentReads: 0
    }
  };

  try {
    options.onProgress?.('গ্লোবাল ইভেন্ট লগ চেক করা হচ্ছে...', 10);

    const localVersions = await getLocalSyncVersions();
    let currentCheckpoint = Number(localVersions.globalVersion || 0);
    result.initialCheckpoint = currentCheckpoint;

    // Safety Baseline Check:
    // If local globalVersion is 0, historical events before Phase 2 are not in change_log.
    // We must ensure the client has an established baseline before relying on event logs.
    if (currentCheckpoint === 0 && !options.forceAllowFromZero) {
      console.log('[GlobalEventSync] Baseline uninitialized (globalVersion === 0). Establishing baseline...');
      currentCheckpoint = await establishSafeGlobalCheckpoint();
      result.initialCheckpoint = currentCheckpoint;
      result.finalCheckpoint = currentCheckpoint;
      return result;
    }

    // Check server global version to short-circuit if already up-to-date
    const serverVersions = await getGlobalSyncVersions();
    const serverGlobalVersion = Number(serverVersions.globalVersion || 0);

    if (currentCheckpoint >= serverGlobalVersion && serverGlobalVersion > 0) {
      console.log(`[GlobalEventSync] Already up to date at globalVersion ${currentCheckpoint}. 0 log queries needed.`);
      result.finalCheckpoint = currentCheckpoint;
      return result;
    }

    let hasMore = true;
    let loopGuard = 0;
    const MAX_PAGES = 500; // Safeguard against runaway loops (50,000 events)

    while (hasMore && loopGuard < MAX_PAGES) {
      loopGuard++;

      // Fetch next pages from change_log and delete_log in parallel
      const [changeEvents, deleteEvents] = await Promise.all([
        fetchChangeLogPage(currentCheckpoint, pageSize),
        fetchDeleteLogPage(currentCheckpoint, pageSize)
      ]);

      result.readsCount.changeLogReads += changeEvents.length;
      result.readsCount.deleteLogReads += deleteEvents.length;

      // If both pages are empty, we have fully caught up
      if (changeEvents.length === 0 && deleteEvents.length === 0) {
        hasMore = false;
        break;
      }

      // Unify and sort strictly by ascending globalVersion
      const unifiedEvents: UnifiedSyncEvent[] = [
        ...changeEvents.map(e => ({ ...e, logType: 'change' as const })),
        ...deleteEvents.map(e => ({ ...e, logType: 'delete' as const }))
      ].sort((a, b) => a.globalVersion - b.globalVersion);

      const maxChangeVersion = changeEvents.length > 0 ? changeEvents[changeEvents.length - 1].globalVersion : 0;
      const isChangePageFull = changeEvents.length === pageSize;

      let expectedVersion = currentCheckpoint + 1;

      for (let i = 0; i < unifiedEvents.length; i++) {
        const event = unifiedEvents[i];

        // 1. Skip duplicate or already applied versions
        if (event.globalVersion < expectedVersion) {
          continue;
        }

        // 2. Gap Detection
        if (event.globalVersion > expectedVersion) {
          // Check if this is a pagination boundary where the change page was truncated
          if (isChangePageFull && expectedVersion > maxChangeVersion) {
            // Not a gap: more change events exist beyond this page. Break to query next page.
            break;
          }

          // True Gap Detected!
          console.error(
            `[GlobalEventSync] Gap detected! Expected globalVersion ${expectedVersion}, but encountered ${event.globalVersion}. Sync halted.`
          );
          result.success = false;
          result.gapDetected = true;
          result.gapAtVersion = expectedVersion;
          result.error = `GAP_DETECTED: Missing globalVersion ${expectedVersion}. Encountered ${event.globalVersion}`;
          result.finalCheckpoint = currentCheckpoint;
          return result;
        }

        // 3. Apply event to local storage
        try {
          await applySingleEventToLocalStorage(event);
        } catch (applyErr: any) {
          console.error(
            `[GlobalEventSync] Local application failure at globalVersion ${event.globalVersion}:`,
            applyErr
          );
          result.success = false;
          result.error = `APPLY_FAILED at globalVersion ${event.globalVersion}: ${applyErr?.message || String(applyErr)}`;
          result.finalCheckpoint = currentCheckpoint;
          // Halt immediately: do not advance checkpoint past failed event
          return result;
        }

        // 4. Update tracking metrics
        result.eventsProcessed++;
        result.hasChanges = true;
        const target = (event.entity || event.collection || '').toLowerCase().trim();
        const isDelete = event.action === 'delete';

        if (target.includes('question')) {
          if (isDelete) result.eventsDeleted.questions++;
          else result.eventsApplied.questions++;
        } else if (target.includes('subcategor')) {
          if (isDelete) result.eventsDeleted.subcategories++;
          else result.eventsApplied.subcategories++;
        } else if (target.includes('categor')) {
          if (isDelete) result.eventsDeleted.categories++;
          else result.eventsApplied.categories++;
        } else if (target.includes('course')) {
          if (isDelete) result.eventsDeleted.courses++;
          else result.eventsApplied.courses++;
        } else if (target.includes('exam')) {
          if (isDelete) result.eventsDeleted.exams++;
          else result.eventsApplied.exams++;
        } else if (target.includes('routine')) {
          if (isDelete) result.eventsDeleted.routines++;
          else result.eventsApplied.routines++;
        } else if (target.includes('coupon')) {
          if (isDelete) result.eventsDeleted.coupons++;
          else result.eventsApplied.coupons++;
        } else if (target.includes('payment')) {
          result.eventsApplied.paymentSettings++;
        }

        // 5. Advance in-memory checkpoint
        currentCheckpoint = event.globalVersion;
        expectedVersion = currentCheckpoint + 1;

        // 6. Update local per-collection version in memory
        const vKey = getVersionKeyForEntity(target);
        if (vKey && event.entityVersion) {
          (localVersions as any)[vKey] = Math.max(Number(localVersions[vKey] || 0), event.entityVersion);
        }
      }

      // Persist the advanced checkpoint to storage after each batch
      localVersions.globalVersion = currentCheckpoint;
      localVersions.updatedAt = new Date().toISOString();
      await saveLocalSyncVersions(localVersions);

      // If neither page was full, no more events exist
      if (changeEvents.length < pageSize && deleteEvents.length < pageSize) {
        hasMore = false;
      }
    }

    result.finalCheckpoint = currentCheckpoint;
    options.onProgress?.('গ্লোবাল ইভেন্ট সিঙ্ক সফল হয়েছে!', 100);
    return result;
  } catch (err: any) {
    console.error('[GlobalEventSync] Unexpected error during global sync:', err);
    result.success = false;
    result.error = err?.message || String(err);
    return result;
  }
}
