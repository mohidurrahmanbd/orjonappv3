import { doc, getDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, CategoryItem, SubcategoryItem, LiveExam, Routine, Course } from '../../types';
import { 
  getQuestionsByIds, 
  getQuestionsByCategory, 
  getQuestionsBySubcategory,
  insertQuestions,
  getAllCategories,
  getCategoryById,
  insertCategories,
  getAllSubcategories,
  getSubcategoryById,
  insertSubcategories
} from './sqliteService';
import { upsertQuestionsToIDB, saveCategoriesToIDB, saveSubcategoriesToIDB } from '../indexedDB';

export interface HybridLoadResult {
  questions: Question[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  source: 'sqlite' | 'hybrid' | 'firestore';
  missingQuestionsFetched: number;
}

/**
 * Normalizes question object before saving/displaying
 */
function normalizeQuestionDoc(data: any, id: string): Question {
  return {
    ...data,
    id: data.id || id,
    categories: data.categories || (data.categoriesJson ? JSON.parse(data.categoriesJson) : undefined),
    subcategories: data.subcategories || (data.subcategoriesJson ? JSON.parse(data.subcategoriesJson) : undefined),
    examPath: data.examPath || (data.examPathJson ? JSON.parse(data.examPathJson) : undefined),
    subjectPath: data.subjectPath || (data.subjectPathJson ? JSON.parse(data.subjectPathJson) : undefined),
    comments: data.comments || (data.commentsJson ? JSON.parse(data.commentsJson) : undefined),
    userExplanations: data.userExplanations || (data.userExplanationsJson ? JSON.parse(data.userExplanationsJson) : undefined)
  };
}

/**
 * Fetches missing question IDs in chunks from Firestore
 */
async function fetchMissingQuestionsFromFirestore(missingIds: string[]): Promise<Question[]> {
  if (!missingIds || missingIds.length === 0) return [];
  
  const fetchedQuestions: Question[] = [];
  const CHUNK_SIZE = 30; // Firestore 'in' query limit is 30

  for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
    const chunk = missingIds.slice(i, i + CHUNK_SIZE);
    try {
      // Attempt query with documentId() 'in' filter
      const q = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
      const snap = await getDocs(q);
      
      const foundInChunk = new Set<string>();
      snap.forEach((d) => {
        foundInChunk.add(d.id);
        fetchedQuestions.push(normalizeQuestionDoc(d.data(), d.id));
      });

      // For any IDs not found by doc ID query, fetch individually by doc(db, 'questions', id) or 'id' field
      const remaining = chunk.filter(id => !foundInChunk.has(id));
      if (remaining.length > 0) {
        for (const remId of remaining) {
          try {
            const singleSnap = await getDoc(doc(db, 'questions', remId));
            if (singleSnap.exists()) {
              fetchedQuestions.push(normalizeQuestionDoc(singleSnap.data(), singleSnap.id));
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
            fetchedQuestions.push(normalizeQuestionDoc(singleSnap.data(), singleSnap.id));
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
        // Fetch missing category from Firestore
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
        // Fetch missing subcategory from Firestore
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
    // 1. Query SQLite for matching IDs
    const sqliteQuestions = await getQuestionsByIds(rawIds);
    const sqliteFoundMap = new Map<string, Question>();
    sqliteQuestions.forEach(q => sqliteFoundMap.set(String(q.id), q));

    // 2. Identify missing IDs
    const missingIds = rawIds.filter(id => !sqliteFoundMap.has(id));

    if (missingIds.length > 0) {
      console.log(`[HybridLoader] ${missingIds.length} questions not found in local SQLite. Fetching missing from Firestore...`);
      const fetched = await fetchMissingQuestionsFromFirestore(missingIds);
      missingQuestionsCount = fetched.length;

      if (fetched.length > 0) {
        // 3. Store newly downloaded records locally in SQLite & IDB
        await insertQuestions(fetched);
        await upsertQuestionsToIDB(fetched, []);
        fetched.forEach(q => sqliteFoundMap.set(String(q.id), q));
      }
    }

    // Assemble questions in requested order
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

  // If no explicit question IDs provided, load by category / subcategory from SQLite
  if (target.subcategoryName) {
    const localQuestions = await getQuestionsBySubcategory(target.subcategoryName);
    if (localQuestions.length > 0) {
      return {
        questions: localQuestions,
        categories: resultCategories,
        subcategories: resultSubcategories,
        source: 'sqlite',
        missingQuestionsFetched: 0
      };
    }
  }

  if (target.categoryName) {
    const localQuestions = await getQuestionsByCategory(target.categoryName);
    if (localQuestions.length > 0) {
      return {
        questions: localQuestions,
        categories: resultCategories,
        subcategories: resultSubcategories,
        source: 'sqlite',
        missingQuestionsFetched: 0
      };
    }
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
