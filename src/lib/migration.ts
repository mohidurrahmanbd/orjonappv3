import { doc, writeBatch, collection, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

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

  const chunkSize = 400;
  let successCount = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((item, index) => {
      const docId = String(item?.id || `${idPrefix}_${i + index + 1}`);
      const docRef = doc(db, collectionName, docId);
      
      // Clean undefined values and attach timestamp for incremental sync compatibility
      const now = Date.now();
      const cleanItem = JSON.parse(JSON.stringify({
        ...item,
        id: docId,
        updatedAt: (item as any)?.updatedAt || now
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
    const now = Date.now();
    const cleanItem = JSON.parse(JSON.stringify({
      ...question,
      id: docId,
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
    const now = Date.now();
    const cleanItem = JSON.parse(JSON.stringify({
      ...questionData,
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
  try {
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
    const cleanItem = JSON.parse(JSON.stringify({ ...item, id: docId }));
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
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Error deleting item from ${colName} in Firestore:`, err);
    return false;
  }
}

export async function syncCollectionToFirestore(colName: string, items: any[], idPrefix: string = 'doc'): Promise<number> {
  return await uploadCollectionInBatches(colName, items, idPrefix);
}

