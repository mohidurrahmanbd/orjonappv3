import { doc, writeBatch, collection, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Course, LiveExam, Routine, Attempt, User } from '../types';
import { incrementGlobalVersion } from './sync/versionSyncService';

export interface CollectionCounts {
  questions: number;
  users: number;
  bookmarks: number;
  attempts: number;
  categories: number;
  subcategories: number;
  notices: number;
  routines: number;
  courses: number;
  live_exams: number;
  audit_logs: number;
  upload_history: number;
}

export interface MigrationReport {
  timestamp: string;
  source: 'localStorage' | 'JSON File' | 'Direct Input';
  counts: CollectionCounts;
  totalDocuments: number;
  status: 'success' | 'partial' | 'error';
  logs: string[];
}

function getVersionKeyForCollection(collectionName: string): 'questionVersion' | 'categoryVersion' | 'subcategoryVersion' | 'courseVersion' | 'examVersion' | 'routineVersion' | null {
  switch (collectionName) {
    case 'courses': return 'courseVersion';
    case 'live_exams': return 'examVersion';
    case 'routines': return 'routineVersion';
    case 'questions': return 'questionVersion';
    case 'categories': return 'categoryVersion';
    case 'subcategories': return 'subcategoryVersion';
    default: return null;
  }
}

// Batch write helper (max 450 per batch to stay under Firestore limit of 500)
async function uploadCollectionInBatches<T extends { id?: string }>(
  collectionName: string,
  items: T[],
  idPrefix: string,
  onProgress?: (msg: string) => void
): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const versionKey = getVersionKeyForCollection(collectionName);
  let newVersion: number | null = null;
  if (versionKey) {
    try {
      newVersion = await incrementGlobalVersion(versionKey);
    } catch {}
  }

  const chunkSize = 400;
  let successCount = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((item, index) => {
      const docId = String(item?.id || `${idPrefix}_${i + index + 1}`);
      const docRef = doc(db, collectionName, docId);
      
      // Clean undefined values and attach timestamp for incremental sync compatibility
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      const existingUpdatedAt = (item as any)?.updatedAt;
      const existingCreatedAt = (item as any)?.createdAt;
      const existingSubmittedAt = (item as any)?.submittedAt;

      let resolvedUpdatedAt = existingUpdatedAt;
      if (!resolvedUpdatedAt) {
        if (collectionName === 'courses' || collectionName === 'live_exams' || collectionName === 'routines') {
          resolvedUpdatedAt = existingCreatedAt || nowIso;
        } else if (collectionName === 'attempts') {
          resolvedUpdatedAt = existingSubmittedAt || existingCreatedAt || nowIso;
        } else {
          resolvedUpdatedAt = typeof existingCreatedAt === 'number' ? existingCreatedAt : (typeof existingCreatedAt === 'string' ? existingCreatedAt : nowMs);
        }
      }

      const isExamOrCourseOrRoutine = collectionName === 'courses' || collectionName === 'live_exams' || collectionName === 'routines';
      const isAttempt = collectionName === 'attempts';

      const itemVersion = (item as any)?.version || newVersion || 1;

      const cleanItem = JSON.parse(JSON.stringify({
        ...item,
        id: docId,
        ...(versionKey ? { version: itemVersion } : {}),
        ...(isExamOrCourseOrRoutine ? {
          createdAt: existingCreatedAt || nowIso,
          updatedAt: resolvedUpdatedAt
        } : isAttempt ? {
          submittedAt: existingSubmittedAt || nowIso,
          updatedAt: resolvedUpdatedAt
        } : {
          updatedAt: resolvedUpdatedAt
        })
      }));
      batch.set(docRef, cleanItem, { merge: true });
    });

    await batch.commit();
    successCount += chunk.length;
    if (onProgress) {
      onProgress(`${collectionName}: ${successCount}/${items.length} টি ডকুমেন্ট মাইগ্রেট করা হয়েছে...`);
    }
  }

  return successCount;
}

export interface FirestoreCountsResult {
  counts: CollectionCounts;
  total: number;
  success: boolean;
  errors: string[];
}

export async function fetchFirestoreDocumentCounts(): Promise<FirestoreCountsResult> {
  const collections = [
    'questions', 'courses', 'routines', 'live_exams',
    'categories', 'subcategories', 'notices', 'audit_logs',
    'users', 'bookmarks', 'attempts', 'upload_history'
  ] as const;

  const counts: CollectionCounts = {
    questions: 0,
    courses: 0,
    routines: 0,
    live_exams: 0,
    categories: 0,
    subcategories: 0,
    notices: 0,
    audit_logs: 0,
    users: 0,
    bookmarks: 0,
    attempts: 0,
    upload_history: 0
  };

  const errors: string[] = [];

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      counts[colName] = snap.size;
    } catch (err: any) {
      console.warn(`Error counting ${colName}:`, err);
      counts[colName] = 0;
      errors.push(`${colName}: ${err?.message || String(err)}`);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    counts,
    total,
    success: errors.length === 0,
    errors
  };
}

export async function migrateDataToFirestore(
  dataMap: Record<string, any>,
  sourceName: 'localStorage' | 'JSON File' | 'Direct Input' = 'localStorage',
  onProgress?: (msg: string) => void
): Promise<MigrationReport> {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  addLog(`🔥 Firebase Firestore-এ ডাটা মাইগ্রেশন শুরু হচ্ছে... (Source: ${sourceName})`);

  // Helper to parse key data from raw map or JSON object
  const parseKeyData = (keyPrimary: string, keyFallback: string): any[] => {
    let raw = dataMap[keyPrimary] || dataMap[keyFallback];
    if (!raw && dataMap.data && typeof dataMap.data === 'object') {
      raw = dataMap.data[keyPrimary] || dataMap.data[keyFallback];
    }
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  };

  const questions = parseKeyData('orjon_questions', 'medha_questions');
  const courses = parseKeyData('orjon_courses', 'medha_courses');
  const routines = parseKeyData('orjon_routines', 'medha_routines');
  const liveExams = parseKeyData('orjon_live_exams', 'medha_live_exams');
  const categories = parseKeyData('orjon_categories', 'medha_categories');
  const subcategories = parseKeyData('orjon_subcategories', 'medha_subcategories');
  const notices = parseKeyData('orjon_notices', 'medha_notices');
  const auditLogs = parseKeyData('orjon_audit_logs', 'medha_audit_logs');
  const users = parseKeyData('orjon_users', 'medha_users');
  const bookmarks = parseKeyData('orjon_bookmarks', 'medha_bookmarks');
  const attempts = parseKeyData('orjon_attempts', 'medha_attempts');
  const uploadHistory = parseKeyData('orjon_upload_history', 'medha_upload_history');

  addLog(`📊 স্থানান্তরের জন্য ডাটা চিহ্নিত করা হয়েছে: ${questions.length}টি প্রশ্ন, ${courses.length}টি কোর্স, ${routines.length}টি রুটিন, ${users.length}জন ইউজার, ${attempts.length}টি রেজাল্ট, ${categories.length}টি ক্যাটাগরি...`);

  const counts: CollectionCounts = {
    questions: 0,
    courses: 0,
    routines: 0,
    live_exams: 0,
    categories: 0,
    subcategories: 0,
    notices: 0,
    audit_logs: 0,
    users: 0,
    bookmarks: 0,
    attempts: 0,
    upload_history: 0
  };

  try {
    if (questions.length > 0) {
      addLog('🚀 `questions` কালেকশন আপলোড হচ্ছে...');
      counts.questions = await uploadCollectionInBatches('questions', questions, 'q', onProgress);
    }

    if (courses.length > 0) {
      addLog('🚀 `courses` কালেকশন আপলোড হচ্ছে...');
      counts.courses = await uploadCollectionInBatches('courses', courses, 'course', onProgress);
    }

    if (routines.length > 0) {
      addLog('🚀 `routines` কালেকশন আপলোড হচ্ছে...');
      counts.routines = await uploadCollectionInBatches('routines', routines, 'rt', onProgress);
    }

    if (liveExams.length > 0) {
      addLog('🚀 `live_exams` কালেকশন আপলোড হচ্ছে...');
      counts.live_exams = await uploadCollectionInBatches('live_exams', liveExams, 'le', onProgress);
    }

    if (categories.length > 0) {
      addLog('🚀 `categories` কালেকশন আপলোড হচ্ছে...');
      counts.categories = await uploadCollectionInBatches('categories', categories, 'cat', onProgress);
    }

    if (subcategories.length > 0) {
      addLog('🚀 `subcategories` কালেকশন আপলোড হচ্ছে...');
      counts.subcategories = await uploadCollectionInBatches('subcategories', subcategories, 'subcat', onProgress);
    }

    if (notices.length > 0) {
      addLog('🚀 `notices` কালেকশন আপলোড হচ্ছে...');
      counts.notices = await uploadCollectionInBatches('notices', notices, 'notice', onProgress);
    }

    if (auditLogs.length > 0) {
      addLog('🚀 `audit_logs` কালেকশন আপলোড হচ্ছে...');
      counts.audit_logs = await uploadCollectionInBatches('audit_logs', auditLogs, 'log', onProgress);
    }

    if (users.length > 0) {
      addLog('🚀 `users` কালেকশন আপলোড হচ্ছে...');
      counts.users = await uploadCollectionInBatches('users', users, 'user', onProgress);
    }

    if (bookmarks.length > 0) {
      addLog('🚀 `bookmarks` কালেকশন আপলোড হচ্ছে...');
      const formattedBookmarks = bookmarks.map((b, idx) => 
        typeof b === 'object' ? b : { id: `bm_${idx+1}`, value: b }
      );
      counts.bookmarks = await uploadCollectionInBatches('bookmarks', formattedBookmarks, 'bm', onProgress);
    }

    if (attempts.length > 0) {
      addLog('🚀 `attempts` কালেকশন আপলোড হচ্ছে...');
      counts.attempts = await uploadCollectionInBatches('attempts', attempts, 'att', onProgress);
    }

    if (uploadHistory.length > 0) {
      addLog('🚀 `upload_history` কালেকশন আপলোড হচ্ছে...');
      counts.upload_history = await uploadCollectionInBatches('upload_history', uploadHistory, 'uh', onProgress);
    }

    const totalDocCount = Object.values(counts).reduce((a, b) => a + b, 0);
    addLog(`✅ সকল ডাটা সফলভাবে Firestore-এ মাইগ্রেট করা হয়েছে! মোট নথি: ${totalDocCount}টি।`);

    return {
      timestamp: new Date().toISOString(),
      source: sourceName,
      counts,
      totalDocuments: totalDocCount,
      status: 'success',
      logs
    };
  } catch (error: any) {
    addLog(`❌ মাইগ্রেশনে ত্রুটি ঘটেছে: ${error?.message || String(error)}`);
    return {
      timestamp: new Date().toISOString(),
      source: sourceName,
      counts,
      totalDocuments: Object.values(counts).reduce((a, b) => a + b, 0),
      status: 'error',
      logs
    };
  }
}

export function getAllLocalStorageMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      map[key] = localStorage.getItem(key) || '';
    }
  }
  return map;
}

// Direct Firestore Question Operations
export async function fetchQuestionsFromFirestore(): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'questions'));
    if (!snap.empty) {
      const docs: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        docs.push({
          ...data,
          id: data.id || d.id
        });
      });
      return docs;
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.GET, 'questions'); } catch {}
    }
    console.warn('Failed to fetch questions from Firestore:', err);
  }
  return [];
}

export async function addQuestionToFirestore(question: any): Promise<boolean> {
  try {
    const docId = String(question.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    const docRef = doc(db, 'questions', docId);
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('questionVersion');
    } catch {}
    const now = Date.now();
    const cleanItem = JSON.parse(JSON.stringify({
      ...question,
      id: docId,
      version: question?.version || newVersion,
      updatedAt: question?.updatedAt || now
    }));
    await setDoc(docRef, cleanItem, { merge: true });
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'questions'); } catch {}
    }
    console.error('Error adding question to Firestore:', err);
    return false;
  }
}

export async function updateQuestionInFirestore(id: string, questionData: any): Promise<boolean> {
  try {
    const docRef = doc(db, 'questions', String(id));
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('questionVersion');
    } catch {}
    const now = Date.now();
    const cleanItem = JSON.parse(JSON.stringify({
      ...questionData,
      version: questionData?.version || newVersion,
      updatedAt: questionData?.updatedAt || now
    }));
    await updateDoc(docRef, cleanItem);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.UPDATE, `questions/${id}`); } catch {}
    }
    console.error('Error updating question in Firestore:', err);
    return false;
  }
}

export async function deleteQuestionFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'questions', String(id));
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('questionVersion');
    } catch {}
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    try {
      await setDoc(docRef, {
        isDeleted: true,
        deletedAt: nowIso,
        version: newVersion,
        updatedAt: nowMs
      }, { merge: true });
    } catch {}
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.DELETE, `questions/${id}`); } catch {}
    }
    console.error('Error deleting question from Firestore:', err);
    return false;
  }
}

export async function bulkUploadQuestionsToFirestore(items: any[]): Promise<number> {
  return await uploadCollectionInBatches('questions', items, 'q');
}

export async function bulkDeleteQuestionsFromFirestore(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  try {
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('questionVersion');
    } catch {}
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, 'questions', String(id)));
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error bulk deleting questions from Firestore:', err);
    return false;
  }
}

// Generic Firestore Collection Operations for Users, Attempts, Bookmarks, Notices, Routines, Live Exams
export async function fetchCollectionFromFirestore<T = any>(colName: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, colName));
    if (!snap.empty) {
      const docs: T[] = [];
      snap.forEach(d => {
        const data = d.data();
        docs.push({
          ...data,
          id: data.id || d.id
        } as T);
      });
      return docs;
    }
  } catch (err) {
    console.warn(`Failed to fetch ${colName} from Firestore:`, err);
  }
  return [];
}

export async function saveItemToFirestore(colName: string, item: any, idPrefix: string = 'doc'): Promise<boolean> {
  try {
    const docId = String(item.id || item.phone || `${idPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    const docRef = doc(db, colName, docId);
    const nowIso = new Date().toISOString();
    const versionKey = getVersionKeyForCollection(colName);
    let newVersion = item.version;
    if (versionKey) {
      try {
        newVersion = await incrementGlobalVersion(versionKey);
      } catch {}
    }
    const cleanItem = JSON.parse(JSON.stringify({
      ...item,
      id: docId,
      ...(versionKey ? { version: newVersion || 1 } : {}),
      updatedAt: item.updatedAt || nowIso
    }));
    await setDoc(docRef, cleanItem, { merge: true });
    return true;
  } catch (err) {
    console.error(`Error saving item to ${colName} in Firestore:`, err);
    return false;
  }
}

export async function deleteItemFromFirestore(colName: string, id: string): Promise<boolean> {
  try {
    const docRef = doc(db, colName, String(id));
    const versionKey = getVersionKeyForCollection(colName);
    const nowIso = new Date().toISOString();
    let newVersion = 1;
    if (versionKey) {
      try {
        newVersion = await incrementGlobalVersion(versionKey);
      } catch {}
      // Update with tombstone so incremental differential sync detects deletion across devices
      try {
        await setDoc(docRef, {
          isDeleted: true,
          deletedAt: nowIso,
          version: newVersion,
          updatedAt: nowIso
        }, { merge: true });
      } catch (err) {
        console.warn(`Tombstone update notice for ${colName}/${id}:`, err);
      }
    }
    // Delete document directly in Firestore
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Error deleting item from ${colName} in Firestore:`, err);
    return false;
  }
}

export async function bulkDeleteItemsFromFirestore(colName: string, ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  try {
    const versionKey = getVersionKeyForCollection(colName);
    let newVersion = 1;
    if (versionKey) {
      try {
        newVersion = await incrementGlobalVersion(versionKey);
      } catch {}
    }
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, colName, String(id)));
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error(`Error bulk deleting items from ${colName} in Firestore:`, err);
    return false;
  }
}

export async function bulkSaveItemsToFirestore<T extends { id?: string }>(colName: string, items: T[], idPrefix: string = 'doc'): Promise<boolean> {
  if (!items || items.length === 0) return true;
  try {
    const versionKey = getVersionKeyForCollection(colName);
    let newVersion: number | null = null;
    if (versionKey) {
      try {
        newVersion = await incrementGlobalVersion(versionKey);
      } catch {}
    }
    const nowIso = new Date().toISOString();
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((item, idx) => {
        const docId = String(item.id || `${idPrefix}_${Date.now()}_${i + idx}`);
        const docRef = doc(db, colName, docId);
        const itemVersion = (item as any)?.version || newVersion || 1;
        const cleanItem = JSON.parse(JSON.stringify({
          ...item,
          id: docId,
          ...(versionKey ? { version: itemVersion } : {}),
          updatedAt: (item as any)?.updatedAt || nowIso
        }));
        batch.set(docRef, cleanItem, { merge: true });
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error(`Error bulk saving items to ${colName} in Firestore:`, err);
    return false;
  }
}

export async function syncCollectionToFirestore(colName: string, items: any[], idPrefix: string = 'doc'): Promise<number> {
  return await uploadCollectionInBatches(colName, items, idPrefix);
}

/**
 * Saves or updates a single verified user document in Firestore.
 * Avoids any full collection reads (0 reads, 1 write).
 * Enforces requirement: user.emailVerified === true.
 */
export async function syncSingleUserToFirestore(user: User): Promise<boolean> {
  if (!user || user.emailVerified !== true) {
    return false;
  }
  try {
    const docId = String(user.userId || user.phone || user.email || `user_${Date.now()}`);
    const docRef = doc(db, 'users', docId);
    const nowIso = new Date().toISOString();
    const { password, ...rest } = user as any;
    const cleanUser = JSON.parse(JSON.stringify({
      ...rest,
      id: docId,
      userId: user.userId || docId,
      updatedAt: (user as any).updatedAt || nowIso
    }));
    await setDoc(docRef, cleanUser, { merge: true });
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'users'); } catch {}
    }
    console.warn('Failed to sync single user to Firestore:', err);
    return false;
  }
}

/**
 * Saves a single exam attempt to Firestore if it's an official Live Exam.
 * Chapter/Custom/Demo exam results are stored ONLY locally.
 * Avoids any collection reads (0 reads, 1 write).
 */
export async function syncSingleAttemptToFirestore(attempt: Attempt): Promise<boolean> {
  if (!attempt) return false;
  const isOfficial = !attempt.examId.startsWith('prep_') && 
                     !attempt.examId.startsWith('job_') && 
                     !attempt.examId.startsWith('custom_') && 
                     !attempt.examId.startsWith('demo_');
  if (!isOfficial) return false;

  try {
    const docId = String(attempt.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    const docRef = doc(db, 'attempts', docId);
    const nowIso = new Date().toISOString();
    const cleanAttempt = JSON.parse(JSON.stringify({
      ...attempt,
      id: docId,
      updatedAt: (attempt as any).updatedAt || attempt.submittedAt || nowIso
    }));
    await setDoc(docRef, cleanAttempt, { merge: true });
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'attempts'); } catch {}
    }
    console.warn('Failed to sync single attempt to Firestore:', err);
    return false;
  }
}

/**
 * Batch saves multiple official attempts (e.g. for guest migration) directly to Firestore
 * using writeBatch without downloading the attempts collection (0 reads, N writes).
 */
export async function syncMultipleAttemptsToFirestore(attempts: Attempt[]): Promise<number> {
  if (!Array.isArray(attempts) || attempts.length === 0) return 0;
  const officialAttempts = attempts.filter(a => 
    !a.examId.startsWith('prep_') && 
    !a.examId.startsWith('job_') && 
    !a.examId.startsWith('custom_') && 
    !a.examId.startsWith('demo_')
  );
  if (officialAttempts.length === 0) return 0;

  try {
    const chunkSize = 400;
    let count = 0;
    const nowIso = new Date().toISOString();
    for (let i = 0; i < officialAttempts.length; i += chunkSize) {
      const chunk = officialAttempts.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((att, idx) => {
        const docId = String(att.id || `att_${Date.now()}_${i + idx}`);
        const docRef = doc(db, 'attempts', docId);
        const cleanAttempt = JSON.parse(JSON.stringify({
          ...att,
          id: docId,
          updatedAt: (att as any).updatedAt || att.submittedAt || nowIso
        }));
        batch.set(docRef, cleanAttempt, { merge: true });
        count++;
      });
      await batch.commit();
    }
    return count;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'attempts'); } catch {}
    }
    console.warn('Failed to sync multiple attempts to Firestore:', err);
    return 0;
  }
}

// Direct Firestore Course Operations
export async function fetchCoursesFromFirestore(): Promise<Course[]> {
  try {
    const snap = await getDocs(collection(db, 'courses'));
    if (!snap.empty) {
      const docs: Course[] = [];
      snap.forEach(d => {
        const data = d.data();
        const nowIso = new Date().toISOString();
        docs.push({
          ...data,
          id: data.id || d.id,
          createdAt: data.createdAt || nowIso,
          updatedAt: data.updatedAt || data.createdAt || nowIso
        } as Course);
      });
      return docs;
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.GET, 'courses'); } catch {}
    }
    console.warn('Failed to fetch courses from Firestore:', err);
  }
  return [];
}

export async function addCourseToFirestore(course: Course): Promise<boolean> {
  try {
    const docId = String(course.id || `course_${Date.now()}`);
    const docRef = doc(db, 'courses', docId);
    const nowIso = new Date().toISOString();
    let newVersion = (course as any).version || 1;
    try {
      newVersion = await incrementGlobalVersion('courseVersion');
    } catch {}

    const cleanItem = JSON.parse(JSON.stringify({
      ...course,
      id: docId,
      version: newVersion,
      createdAt: course.createdAt || nowIso,
      updatedAt: course.updatedAt || nowIso
    }));
    await setDoc(docRef, cleanItem, { merge: true });
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'courses'); } catch {}
    }
    console.error('Error adding course to Firestore:', err);
    return false;
  }
}

export async function updateCourseInFirestore(id: string, courseData: Partial<Course>): Promise<boolean> {
  try {
    const docRef = doc(db, 'courses', String(id));
    const nowIso = new Date().toISOString();
    let newVersion = (courseData as any).version;
    try {
      newVersion = await incrementGlobalVersion('courseVersion');
    } catch {}

    const cleanItem = JSON.parse(JSON.stringify({
      ...courseData,
      version: newVersion || 1,
      updatedAt: courseData.updatedAt || nowIso
    }));
    await updateDoc(docRef, cleanItem);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.UPDATE, `courses/${id}`); } catch {}
    }
    console.error('Error updating course in Firestore:', err);
    return false;
  }
}

export async function deleteCourseFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'courses', String(id));
    const nowIso = new Date().toISOString();
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('courseVersion');
    } catch {}

    // Mark as soft deleted first with bumped version so differential sync picks up deletion
    try {
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: nowIso,
        version: newVersion,
        updatedAt: nowIso
      });
    } catch {}

    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.DELETE, `courses/${id}`); } catch {}
    }
    console.error('Error deleting course from Firestore:', err);
    return false;
  }
}

/**
 * Migration function for existing Firestore course documents that lack an `updatedAt` field.
 * Scans all documents in the 'courses' collection in Firestore and updates any missing `updatedAt`
 * using their existing `createdAt` or current timestamp.
 */
export async function migrateCoursesMissingUpdatedAt(): Promise<{ updatedCount: number; totalCount: number; success: boolean }> {
  try {
    const snap = await getDocs(collection(db, 'courses'));
    if (snap.empty) {
      return { updatedCount: 0, totalCount: 0, success: true };
    }

    const chunkSize = 400;
    const docsToUpdate: { ref: any; updatedAt: string }[] = [];
    const nowIso = new Date().toISOString();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.updatedAt) {
        const fallbackUpdatedAt = data.createdAt || nowIso;
        docsToUpdate.push({ ref: docSnap.ref, updatedAt: fallbackUpdatedAt });
      }
    });

    for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
      const chunk = docsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.update(item.ref, { updatedAt: item.updatedAt });
      });
      await batch.commit();
    }

    return { updatedCount: docsToUpdate.length, totalCount: snap.size, success: true };
  } catch (err: any) {
    console.error('Error migrating course documents missing updatedAt:', err);
    return { updatedCount: 0, totalCount: 0, success: false };
  }
}

// ==========================================
// EXAM & ROUTINE FIRESTORE CRUD & MIGRATIONS
// ==========================================

export async function fetchLiveExamsFromFirestore(): Promise<LiveExam[]> {
  try {
    const snap = await getDocs(collection(db, 'live_exams'));
    if (!snap.empty) {
      const docs: LiveExam[] = [];
      snap.forEach(d => {
        const data = d.data();
        const nowIso = new Date().toISOString();
        docs.push({
          ...data,
          id: data.id || d.id,
          createdAt: data.createdAt || nowIso,
          updatedAt: data.updatedAt || data.createdAt || nowIso
        } as LiveExam);
      });
      return docs;
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.GET, 'live_exams'); } catch {}
    }
    console.warn('Failed to fetch live exams from Firestore:', err);
  }
  return [];
}

export async function addLiveExamToFirestore(exam: LiveExam): Promise<boolean> {
  try {
    const docId = String(exam.id || `exam_${Date.now()}`);
    const docRef = doc(db, 'live_exams', docId);
    const nowIso = new Date().toISOString();
    let newVersion = (exam as any).version || 1;
    try {
      newVersion = await incrementGlobalVersion('examVersion');
    } catch {}

    const cleanItem = JSON.parse(JSON.stringify({
      ...exam,
      id: docId,
      version: newVersion,
      createdAt: exam.createdAt || nowIso,
      updatedAt: exam.updatedAt || nowIso
    }));
    await setDoc(docRef, cleanItem, { merge: true });
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'live_exams'); } catch {}
    }
    console.error('Error adding live exam to Firestore:', err);
    return false;
  }
}

export async function updateLiveExamInFirestore(id: string, examData: Partial<LiveExam>): Promise<boolean> {
  try {
    const docRef = doc(db, 'live_exams', String(id));
    const nowIso = new Date().toISOString();
    let newVersion = (examData as any).version;
    try {
      newVersion = await incrementGlobalVersion('examVersion');
    } catch {}

    const cleanItem = JSON.parse(JSON.stringify({
      ...examData,
      version: newVersion || 1,
      updatedAt: examData.updatedAt || nowIso
    }));
    await updateDoc(docRef, cleanItem);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.UPDATE, `live_exams/${id}`); } catch {}
    }
    console.error('Error updating live exam in Firestore:', err);
    return false;
  }
}

export async function deleteLiveExamFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'live_exams', String(id));
    const nowIso = new Date().toISOString();
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('examVersion');
    } catch {}

    try {
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: nowIso,
        version: newVersion,
        updatedAt: nowIso
      });
    } catch {}

    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.DELETE, `live_exams/${id}`); } catch {}
    }
    console.error('Error deleting live exam from Firestore:', err);
    return false;
  }
}

export async function fetchRoutinesFromFirestore(): Promise<Routine[]> {
  try {
    const snap = await getDocs(collection(db, 'routines'));
    if (!snap.empty) {
      const docs: Routine[] = [];
      snap.forEach(d => {
        const data = d.data();
        const nowIso = new Date().toISOString();
        docs.push({
          ...data,
          id: data.id || d.id,
          createdAt: data.createdAt || nowIso,
          updatedAt: data.updatedAt || data.createdAt || nowIso
        } as Routine);
      });
      return docs;
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.GET, 'routines'); } catch {}
    }
    console.warn('Failed to fetch routines from Firestore:', err);
  }
  return [];
}

export async function addRoutineToFirestore(routine: Routine): Promise<boolean> {
  try {
    const docId = String(routine.id || `routine_${Date.now()}`);
    const docRef = doc(db, 'routines', docId);
    const nowIso = new Date().toISOString();
    let newVersion = (routine as any).version || 1;
    try {
      newVersion = await incrementGlobalVersion('routineVersion');
    } catch {}

    const cleanItem = JSON.parse(JSON.stringify({
      ...routine,
      id: docId,
      version: newVersion,
      createdAt: routine.createdAt || nowIso,
      updatedAt: routine.updatedAt || nowIso
    }));
    await setDoc(docRef, cleanItem, { merge: true });
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.WRITE, 'routines'); } catch {}
    }
    console.error('Error adding routine to Firestore:', err);
    return false;
  }
}

export async function updateRoutineInFirestore(id: string, routineData: Partial<Routine>): Promise<boolean> {
  try {
    const docRef = doc(db, 'routines', String(id));
    const nowIso = new Date().toISOString();
    let newVersion = (routineData as any).version;
    try {
      newVersion = await incrementGlobalVersion('routineVersion');
    } catch {}

    const cleanItem = JSON.parse(JSON.stringify({
      ...routineData,
      version: newVersion || 1,
      updatedAt: routineData.updatedAt || nowIso
    }));
    await updateDoc(docRef, cleanItem);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.UPDATE, `routines/${id}`); } catch {}
    }
    console.error('Error updating routine in Firestore:', err);
    return false;
  }
}

export async function deleteRoutineFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'routines', String(id));
    const nowIso = new Date().toISOString();
    let newVersion = 1;
    try {
      newVersion = await incrementGlobalVersion('routineVersion');
    } catch {}

    try {
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: nowIso,
        version: newVersion,
        updatedAt: nowIso
      });
    } catch {}

    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      try { handleFirestoreError(err, OperationType.DELETE, `routines/${id}`); } catch {}
    }
    console.error('Error deleting routine from Firestore:', err);
    return false;
  }
}

/**
 * Migration function for existing Firestore live exam documents that lack an `updatedAt` field.
 * Scans all documents in the 'live_exams' collection in Firestore and updates any missing `updatedAt`
 * using their existing `createdAt` or current timestamp.
 */
export async function migrateLiveExamsMissingUpdatedAt(): Promise<{ updatedCount: number; totalCount: number; success: boolean }> {
  try {
    const snap = await getDocs(collection(db, 'live_exams'));
    if (snap.empty) {
      return { updatedCount: 0, totalCount: 0, success: true };
    }

    const chunkSize = 400;
    const docsToUpdate: { ref: any; updatedAt: string }[] = [];
    const nowIso = new Date().toISOString();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.updatedAt) {
        const fallbackUpdatedAt = data.createdAt || nowIso;
        docsToUpdate.push({ ref: docSnap.ref, updatedAt: fallbackUpdatedAt });
      }
    });

    for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
      const chunk = docsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.update(item.ref, { updatedAt: item.updatedAt });
      });
      await batch.commit();
    }

    return { updatedCount: docsToUpdate.length, totalCount: snap.size, success: true };
  } catch (err: any) {
    console.error('Error migrating live exam documents missing updatedAt:', err);
    return { updatedCount: 0, totalCount: 0, success: false };
  }
}

/**
 * Migration function for existing Firestore routine documents that lack an `updatedAt` field.
 * Scans all documents in the 'routines' collection in Firestore and updates any missing `updatedAt`
 * using their existing `createdAt` or current timestamp.
 */
export async function migrateRoutinesMissingUpdatedAt(): Promise<{ updatedCount: number; totalCount: number; success: boolean }> {
  try {
    const snap = await getDocs(collection(db, 'routines'));
    if (snap.empty) {
      return { updatedCount: 0, totalCount: 0, success: true };
    }

    const chunkSize = 400;
    const docsToUpdate: { ref: any; updatedAt: string }[] = [];
    const nowIso = new Date().toISOString();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.updatedAt) {
        const fallbackUpdatedAt = data.createdAt || nowIso;
        docsToUpdate.push({ ref: docSnap.ref, updatedAt: fallbackUpdatedAt });
      }
    });

    for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
      const chunk = docsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.update(item.ref, { updatedAt: item.updatedAt });
      });
      await batch.commit();
    }

    return { updatedCount: docsToUpdate.length, totalCount: snap.size, success: true };
  } catch (err: any) {
    console.error('Error migrating routine documents missing updatedAt:', err);
    return { updatedCount: 0, totalCount: 0, success: false };
  }
}

/**
 * Migration function for existing Firestore attempt documents that lack an `updatedAt` field.
 * Scans all documents in the 'attempts' collection in Firestore and updates any missing `updatedAt`
 * using their existing `submittedAt`, `createdAt`, or current timestamp.
 */
export async function migrateAttemptsMissingUpdatedAt(): Promise<{ updatedCount: number; totalCount: number; success: boolean }> {
  try {
    const snap = await getDocs(collection(db, 'attempts'));
    if (snap.empty) {
      return { updatedCount: 0, totalCount: 0, success: true };
    }

    const chunkSize = 400;
    const docsToUpdate: { ref: any; updatedAt: string }[] = [];
    const nowIso = new Date().toISOString();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.updatedAt) {
        const fallbackUpdatedAt = data.submittedAt || data.createdAt || nowIso;
        docsToUpdate.push({ ref: docSnap.ref, updatedAt: fallbackUpdatedAt });
      }
    });

    for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
      const chunk = docsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.update(item.ref, { updatedAt: item.updatedAt });
      });
      await batch.commit();
    }

    return { updatedCount: docsToUpdate.length, totalCount: snap.size, success: true };
  } catch (err: any) {
    console.error('Error migrating attempt documents missing updatedAt:', err);
    return { updatedCount: 0, totalCount: 0, success: false };
  }
}

/**
 * Unified migration function for all existing exam-related documents (live_exams, routines, attempts) in Firestore.
 */
export async function migrateAllExamDocumentsMissingUpdatedAt(): Promise<{
  liveExams: { updatedCount: number; totalCount: number };
  routines: { updatedCount: number; totalCount: number };
  attempts: { updatedCount: number; totalCount: number };
  success: boolean;
}> {
  const [liveExamsRes, routinesRes, attemptsRes] = await Promise.all([
    migrateLiveExamsMissingUpdatedAt(),
    migrateRoutinesMissingUpdatedAt(),
    migrateAttemptsMissingUpdatedAt()
  ]);

  return {
    liveExams: { updatedCount: liveExamsRes.updatedCount, totalCount: liveExamsRes.totalCount },
    routines: { updatedCount: routinesRes.updatedCount, totalCount: routinesRes.totalCount },
    attempts: { updatedCount: attemptsRes.updatedCount, totalCount: attemptsRes.totalCount },
    success: liveExamsRes.success && routinesRes.success && attemptsRes.success
  };
}

/**
 * Migration function to ensure all documents in a collection have version, updatedAt, deletedAt fields.
 */
export async function migrateCollectionToVersionSchema(
  collectionName: 'questions' | 'categories' | 'subcategories' | 'courses' | 'live_exams' | 'routines',
  defaultVersion: number = 1
): Promise<{ updatedCount: number; totalCount: number; success: boolean }> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    if (snap.empty) {
      return { updatedCount: 0, totalCount: 0, success: true };
    }

    const chunkSize = 400;
    const docsToUpdate: { ref: any; data: Record<string, any> }[] = [];
    const nowIso = new Date().toISOString();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const needsVersion = data.version === undefined || data.version === null;
      const needsUpdatedAt = !data.updatedAt;
      const needsDeletedAt = data.deletedAt === undefined;

      if (needsVersion || needsUpdatedAt || needsDeletedAt) {
        const updatePayload: Record<string, any> = {};
        if (needsVersion) updatePayload.version = defaultVersion;
        if (needsUpdatedAt) updatePayload.updatedAt = data.createdAt || nowIso;
        if (needsDeletedAt) updatePayload.deletedAt = data.isDeleted ? (data.updatedAt || nowIso) : null;
        docsToUpdate.push({ ref: docSnap.ref, data: updatePayload });
      }
    });

    for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
      const chunk = docsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.update(item.ref, item.data);
      });
      await batch.commit();
    }

    return { updatedCount: docsToUpdate.length, totalCount: snap.size, success: true };
  } catch (err: any) {
    console.error(`Error migrating collection ${collectionName} to version schema:`, err);
    return { updatedCount: 0, totalCount: 0, success: false };
  }
}

/**
 * Master migration to update all Firestore collections to the version-based schema.
 */
export async function migrateAllCollectionsToVersionSchema(): Promise<{
  questions: { updatedCount: number; totalCount: number };
  categories: { updatedCount: number; totalCount: number };
  subcategories: { updatedCount: number; totalCount: number };
  courses: { updatedCount: number; totalCount: number };
  liveExams: { updatedCount: number; totalCount: number };
  routines: { updatedCount: number; totalCount: number };
  success: boolean;
}> {
  const [qRes, catRes, subRes, courseRes, examRes, routineRes] = await Promise.all([
    migrateCollectionToVersionSchema('questions', 1),
    migrateCollectionToVersionSchema('categories', 1),
    migrateCollectionToVersionSchema('subcategories', 1),
    migrateCollectionToVersionSchema('courses', 1),
    migrateCollectionToVersionSchema('live_exams', 1),
    migrateCollectionToVersionSchema('routines', 1)
  ]);

  return {
    questions: { updatedCount: qRes.updatedCount, totalCount: qRes.totalCount },
    categories: { updatedCount: catRes.updatedCount, totalCount: catRes.totalCount },
    subcategories: { updatedCount: subRes.updatedCount, totalCount: subRes.totalCount },
    courses: { updatedCount: courseRes.updatedCount, totalCount: courseRes.totalCount },
    liveExams: { updatedCount: examRes.updatedCount, totalCount: examRes.totalCount },
    routines: { updatedCount: routineRes.updatedCount, totalCount: routineRes.totalCount },
    success: qRes.success && catRes.success && subRes.success && courseRes.success && examRes.success && routineRes.success
  };
}


