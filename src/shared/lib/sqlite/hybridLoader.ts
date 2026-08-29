import { doc, getDoc, getDocs, collection, query, where, documentId, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, CategoryItem, SubcategoryItem, LiveExam, Routine, Course } from '../../types';
import { 
  getQuestionsByIds, 
  getQuestionsByCategory, 
  getQuestionsBySubcategory,
  insertQuestions,
  getCategoryById,
  insertCategories,
  getSubcategoryById,
  insertSubcategories
} from './sqliteService';
import { 
  getQuestionsFromIDB, 
  upsertQuestionsToIDB, 
  saveCategoriesToIDB, 
  saveSubcategoriesToIDB, 
  normalizeQuestion 
} from '../indexedDB';
import { 
  getGlobalSyncVersions, 
  getLocalSyncVersions, 
  saveLocalSyncVersions 
} from '../sync/versionSyncService';

export interface HybridLoadResult {
  questions: Question[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  source: 'sqlite' | 'hybrid' | 'firestore';
  missingQuestionsFetched: number;
}

export interface ScopedQuestionQuery {
  category?: string;
  categoryName?: string;
  subcategory?: string;
  subcategoryName?: string;
  topic?: string;
  examId?: string;
  questionIds?: string[];
  limitCount?: number;
  forceRefresh?: boolean;
}

/**
 * Normalizes question object before saving/displaying
 */
function normalizeQuestionDoc(data: any, id: string): Question {
  return normalizeQuestion({
    ...data,
    id: data.id || id,
    categories: data.categories || (data.categoriesJson ? JSON.parse(data.categoriesJson) : undefined),
    subcategories: data.subcategories || (data.subcategoriesJson ? JSON.parse(data.subcategoriesJson) : undefined),
    examPath: data.examPath || (data.examPathJson ? JSON.parse(data.examPathJson) : undefined),
    subjectPath: data.subjectPath || (data.subjectPathJson ? JSON.parse(data.subjectPathJson) : undefined),
    comments: data.comments || (data.commentsJson ? JSON.parse(data.commentsJson) : undefined),
    userExplanations: data.userExplanations || (data.userExplanationsJson ? JSON.parse(data.userExplanationsJson) : undefined)
  });
}

/**
 * Fetches missing question IDs in chunks of 30 from Firestore
 */
async function fetchMissingQuestionsFromFirestore(missingIds: string[]): Promise<Question[]> {
  if (!missingIds || missingIds.length === 0) return [];
  
  const fetchedQuestions: Question[] = [];
  const CHUNK_SIZE = 30; // Firestore 'in' query limit is 30

  for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
    const chunk = missingIds.slice(i, i + CHUNK_SIZE);
    try {
      const q = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
      const snap = await getDocs(q);
      
      const foundInChunk = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          foundInChunk.add(d.id);
          fetchedQuestions.push(normalizeQuestionDoc(data, d.id));
        }
      });

      // For any IDs not found by doc ID query, fetch individually as fallback
      const remaining = chunk.filter(id => !foundInChunk.has(id));
      if (remaining.length > 0) {
        for (const remId of remaining) {
          try {
            const singleSnap = await getDoc(doc(db, 'questions', remId));
            if (singleSnap.exists()) {
              const data = singleSnap.data();
              if (!data.deletedAt && !data.isDeleted) {
                fetchedQuestions.push(normalizeQuestionDoc(data, singleSnap.id));
              }
            }
          } catch (e) {
            console.warn(`[HybridLoader] Doc fetch fallback for ${remId}:`, e);
          }
        }
      }
    } catch (err) {
      console.warn(`[HybridLoader] Batch Firestore question fetch fallback for chunk:`, err);
      for (const id of chunk) {
        try {
          const singleSnap = await getDoc(doc(db, 'questions', id));
          if (singleSnap.exists()) {
            const data = singleSnap.data();
            if (!data.deletedAt && !data.isDeleted) {
              fetchedQuestions.push(normalizeQuestionDoc(data, singleSnap.id));
            }
          }
        } catch (e) {
          console.warn(`[HybridLoader] Single question fetch error for ${id}:`, e);
        }
      }
    }
  }

  return fetchedQuestions;
}

/**
 * Version-aware scoped question lazy loader:
 * Loading priority:
 * 1. React Memory & Local Cache (SQLite / IndexedDB)
 * 2. meta/versions check
 * 3. Targeted scoped Firestore fetch (only if local missing or version outdated)
 * 4. Local cache update (IndexedDB + SQLite)
 */
export async function loadScopedQuestionsLazy(target: ScopedQuestionQuery): Promise<Question[]> {
  try {
    const boundLimit = target.limitCount || 100;
    let localMatches: Question[] = [];

    const sub = (target.subcategoryName || target.subcategory || '').trim();
    const cat = (target.categoryName || target.category || '').trim();

    // 1. Check local SQLite and IndexedDB
    if (target.questionIds && target.questionIds.length > 0) {
      const rawIds = target.questionIds.map(String);
      const sqliteQs = await getQuestionsByIds(rawIds);
      localMatches = sqliteQs;
    } else if (sub) {
      const sqliteQs = await getQuestionsBySubcategory(sub);
      if (sqliteQs.length > 0) {
        localMatches = sqliteQs;
      } else {
        const idbQs = await getQuestionsFromIDB();
        const subLower = sub.toLowerCase();
        localMatches = idbQs.filter(q => 
          (q.subcategory && q.subcategory.trim().toLowerCase() === subLower) ||
          (q.subcategories && q.subcategories.some(s => s.trim().toLowerCase() === subLower))
        );
      }
    } else if (cat) {
      const sqliteQs = await getQuestionsByCategory(cat);
      if (sqliteQs.length > 0) {
        localMatches = sqliteQs;
      } else {
        const idbQs = await getQuestionsFromIDB();
        const catLower = cat.toLowerCase();
        localMatches = idbQs.filter(q => 
          (q.category && q.category.trim().toLowerCase() === catLower) ||
          (q.csvCategory && q.csvCategory.trim().toLowerCase() === catLower) ||
          (q.categories && q.categories.some(c => c.trim().toLowerCase() === catLower))
        );
      }
    } else if (target.examId) {
      const idbQs = await getQuestionsFromIDB();
      localMatches = idbQs.filter(q => (q as any).examId === target.examId);
    }

    // 2. Version Gating: Check server meta/versions vs local sync version
    let isServerVersionNewer = false;
    let serverQuestionVersion = 1;
    try {
      const serverVersions = await getGlobalSyncVersions();
      const localVersions = await getLocalSyncVersions();
      serverQuestionVersion = serverVersions.questionVersion || 1;
      const localQuestionVersion = localVersions.questionVersion || 0;

      if (serverQuestionVersion > localQuestionVersion) {
        isServerVersionNewer = true;
      }
    } catch {
      // If version check fails, rely on presence of local matches
    }

    // If local matches exist and server version is NOT newer and not forced -> Return immediately with 0 Firestore reads!
    if (localMatches.length > 0 && !isServerVersionNewer && !target.forceRefresh) {
      return localMatches;
    }

    // 3. Targeted Firestore Fetch (Bounded & Scoped)
    let fetchedFromFirestore: Question[] = [];
    const qColRef = collection(db, 'questions');

    if (target.questionIds && target.questionIds.length > 0) {
      const existingIdSet = new Set(localMatches.map(q => String(q.id)));
      const missingIds = target.questionIds.map(String).filter(id => !existingIdSet.has(id));
      if (missingIds.length > 0) {
        const missingFetched = await fetchMissingQuestionsFromFirestore(missingIds);
        fetchedFromFirestore.push(...missingFetched);
      }
    } else if (sub) {
      const qSub = query(
        qColRef, 
        where('subcategory', '==', sub),
        limit(boundLimit)
      );
      const snap = await getDocs(qSub);
      snap.forEach(d => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          fetchedFromFirestore.push(normalizeQuestionDoc(data, d.id));
        }
      });
    } else if (cat) {
      const qCat = query(
        qColRef, 
        where('category', '==', cat),
        limit(boundLimit)
      );
      const snap = await getDocs(qCat);
      snap.forEach(d => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          fetchedFromFirestore.push(normalizeQuestionDoc(data, d.id));
        }
      });
    } else if (target.examId) {
      const qExam = query(
        qColRef, 
        where('examId', '==', target.examId),
        limit(boundLimit)
      );
      const snap = await getDocs(qExam);
      snap.forEach(d => {
        const data = d.data();
        if (!data.deletedAt && !data.isDeleted) {
          fetchedFromFirestore.push(normalizeQuestionDoc(data, d.id));
        }
      });
    }

    // 4. Local Cache Update
    if (fetchedFromFirestore.length > 0) {
      await insertQuestions(fetchedFromFirestore);
      await upsertQuestionsToIDB(fetchedFromFirestore, []);

      // Merge results
      const map = new Map<string, Question>();
      localMatches.forEach(q => map.set(String(q.id), q));
      fetchedFromFirestore.forEach(q => map.set(String(q.id), q));
      const combined = Array.from(map.values());

      // Update local question version if server version was newer
      if (isServerVersionNewer) {
        const localVersions = await getLocalSyncVersions();
        localVersions.questionVersion = serverQuestionVersion;
        localVersions.updatedAt = new Date().toISOString();
        await saveLocalSyncVersions(localVersions);
      }

      return combined;
    }

    return localMatches;
  } catch (err) {
    console.warn('[HybridLoader] loadScopedQuestionsLazy notice (using local cache):', err);
    return [];
  }
}

/**
 * When a Course, Routine, or Live Exam is opened:
 * 1. Read assigned category IDs, subcategory IDs, and question IDs.
 * 2. Attempt to load matching data from local SQLite first.
 * 3. If required records are not available locally, fetch ONLY missing records from Firestore.
 * 4. Store newly downloaded records locally in SQLite (and IndexedDB).
 */
export async function loadDataForExamOrRoutineOrCourse(target: {
  questionIds?: string[];
  categoryIds?: string[];
  subcategoryIds?: string[];
  categoryName?: string;
  subcategoryName?: string;
  forceRefresh?: boolean;
}): Promise<HybridLoadResult> {
  const resultQuestions: Question[] = [];
  const resultCategories: CategoryItem[] = [];
  const resultSubcategories: SubcategoryItem[] = [];
  let missingQuestionsCount = 0;

  // ------------------------------------------
  // A. CATEGORIES & SUBCATEGORIES
  // ------------------------------------------
  if (target.categoryIds && target.categoryIds.length > 0) {
    for (const catId of target.categoryIds) {
      const localCat = await getCategoryById(catId);
      if (localCat) {
        resultCategories.push(localCat);
      } else {
        try {
          const snap = await getDoc(doc(db, 'categories', catId));
          if (snap.exists()) {
            const data = snap.data();
            const fetchedCat: CategoryItem = { id: snap.id, name: data.name, subHeading: data.subHeading };
            resultCategories.push(fetchedCat);
            await insertCategories([fetchedCat]);
            await saveCategoriesToIDB([fetchedCat]);
          }
        } catch (e) {
          console.warn(`[HybridLoader] Category fetch error for ${catId}:`, e);
        }
      }
    }
  }

  if (target.subcategoryIds && target.subcategoryIds.length > 0) {
    for (const subId of target.subcategoryIds) {
      const localSub = await getSubcategoryById(subId);
      if (localSub) {
        resultSubcategories.push(localSub);
      } else {
        try {
          const snap = await getDoc(doc(db, 'subcategories', subId));
          if (snap.exists()) {
            const data = snap.data();
            const fetchedSub: SubcategoryItem = {
              id: snap.id,
              name: data.name,
              parentCategory: data.parentCategory || '',
              parentCategoryId: data.parentCategoryId,
              date: data.date,
              subHeading: data.subHeading,
              text: data.text,
              details: data.details,
              createdAt: data.createdAt
            };
            resultSubcategories.push(fetchedSub);
            await insertSubcategories([fetchedSub]);
            await saveSubcategoriesToIDB([fetchedSub]);
          }
        } catch (e) {
          console.warn(`[HybridLoader] Subcategory fetch error for ${subId}:`, e);
        }
      }
    }
  }

  // ------------------------------------------
  // B. QUESTIONS LOADING (Explicit IDs or Category/Subcategory Filter)
  // ------------------------------------------
  if (target.questionIds && target.questionIds.length > 0) {
    const rawIds = target.questionIds.map(String);
    const sqliteQuestions = await getQuestionsByIds(rawIds);
    const sqliteFoundMap = new Map<string, Question>();
    sqliteQuestions.forEach(q => sqliteFoundMap.set(String(q.id), q));

    const missingIds = rawIds.filter(id => !sqliteFoundMap.has(id));

    if (missingIds.length > 0) {
      console.log(`[HybridLoader] ${missingIds.length} questions missing locally. Fetching targeted chunk from Firestore...`);
      const fetched = await fetchMissingQuestionsFromFirestore(missingIds);
      missingQuestionsCount = fetched.length;

      if (fetched.length > 0) {
        await insertQuestions(fetched);
        await upsertQuestionsToIDB(fetched, []);
        fetched.forEach(q => sqliteFoundMap.set(String(q.id), q));
      }
    }

    rawIds.forEach(id => {
      const found = sqliteFoundMap.get(id);
      if (found) {
        resultQuestions.push(found);
      }
    });

    return {
      questions: resultQuestions,
      categories: resultCategories,
      subcategories: resultSubcategories,
      source: missingIds.length === 0 ? 'sqlite' : 'hybrid',
      missingQuestionsFetched: missingQuestionsCount
    };
  }

  // If no explicit question IDs, use scoped lazy loader
  if (target.subcategoryName || target.categoryName) {
    const scopedQs = await loadScopedQuestionsLazy({
      categoryName: target.categoryName,
      subcategoryName: target.subcategoryName,
      forceRefresh: target.forceRefresh
    });

    return {
      questions: scopedQs,
      categories: resultCategories,
      subcategories: resultSubcategories,
      source: 'hybrid',
      missingQuestionsFetched: 0
    };
  }

  return {
    questions: resultQuestions,
    categories: resultCategories,
    subcategories: resultSubcategories,
    source: 'sqlite',
    missingQuestionsFetched: 0
  };
}

/**
 * Convenience helper specifically for LiveExam
 */
export async function loadExamDataWithFallback(exam: LiveExam): Promise<Question[]> {
  const res = await loadDataForExamOrRoutineOrCourse({
    questionIds: exam.questionIds,
    categoryIds: exam.selectedCategories,
    subcategoryIds: exam.selectedSubcategories,
    categoryName: exam.category !== 'ALL' ? exam.category : undefined
  });
  return res.questions;
}

/**
 * Convenience helper specifically for Routine
 */
export async function loadRoutineDataWithFallback(routine: Routine): Promise<{
  questions: Question[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
}> {
  const questionIds = routine.examConfig?.questionIds;
  const res = await loadDataForExamOrRoutineOrCourse({
    questionIds,
    categoryIds: routine.selectedCategories,
    subcategoryIds: routine.selectedSubcategories
  });
  return {
    questions: res.questions,
    categories: res.categories,
    subcategories: res.subcategories
  };
}

/**
 * Convenience helper specifically for Course
 */
export async function loadCourseDataWithFallback(course: Course): Promise<{
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
}> {
  const categoryIds = course.category ? [course.category] : [];
  const res = await loadDataForExamOrRoutineOrCourse({
    categoryIds,
    categoryName: course.category
  });
  return {
    categories: res.categories,
    subcategories: res.subcategories
  };
}
