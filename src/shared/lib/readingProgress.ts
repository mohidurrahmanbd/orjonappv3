import { Routine, Question, SubcategoryItem } from '../types';
import { getRoutineMatchingQuestions } from './routineUtils';

export interface RoutineReadingProgress {
  readCount: number;
  totalQuestions: number;
  percentage: number;
  readQuestionIds: string[];
}

const getCleanUserKey = (userKey?: string): string => {
  if (!userKey) return 'user';
  const clean = userKey.trim().toLowerCase();
  return clean.replace(/[^a-z0-9_@.-]/gi, '_') || 'user';
};

export const getRoutineStorageKey = (userKey: string | undefined, routineId: string): string => {
  const u = getCleanUserKey(userKey);
  return `bcs_routine_read_mcqs_${u}_${routineId}`;
};

export const getUserAllReadStorageKey = (userKey: string | undefined): string => {
  const u = getCleanUserKey(userKey);
  return `bcs_user_all_read_mcqs_${u}`;
};

export const getUserAllReadQuestionIds = (userKey: string | undefined): string[] => {
  try {
    const key = getUserAllReadStorageKey(userKey);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    }
  } catch (e) {
    console.error('Failed to parse all read question IDs from localStorage', e);
  }
  return [];
};

export const markUserQuestionsAsRead = (
  userKey: string | undefined,
  questionIds: string[]
): string[] => {
  if (!questionIds || questionIds.length === 0) {
    return getUserAllReadQuestionIds(userKey);
  }
  try {
    const existing = getUserAllReadQuestionIds(userKey);
    const combinedSet = new Set([...existing, ...questionIds.map(String)]);
    const updated = Array.from(combinedSet);
    const key = getUserAllReadStorageKey(userKey);
    localStorage.setItem(key, JSON.stringify(updated));

    const u = getCleanUserKey(userKey);
    window.dispatchEvent(new CustomEvent('mcq_reading_progress_updated', {
      detail: { userKey: u, readCount: updated.length }
    }));

    return updated;
  } catch (e) {
    console.error('Failed to save all read question IDs to localStorage', e);
    return [];
  }
};

export const calculateQuestionsReadingProgress = (
  userKey: string | undefined,
  questionsList: Question[],
  cachedReadSet?: Set<string>
): { readCount: number; totalCount: number; percentage: number } => {
  const totalCount = questionsList.length;
  if (totalCount === 0) {
    return { readCount: 0, totalCount: 0, percentage: 0 };
  }

  const readSet = cachedReadSet || new Set(getUserAllReadQuestionIds(userKey));
  const readCount = questionsList.filter(q => readSet.has(String(q.id))).length;
  const percentage = Math.min(100, Math.round((readCount / totalCount) * 100));

  return { readCount, totalCount, percentage };
};

export const getStoredReadQuestionIds = (userKey: string | undefined, routineId: string): string[] => {
  try {
    const key = getRoutineStorageKey(userKey, routineId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    }
  } catch (e) {
    console.error('Failed to parse read question IDs from localStorage', e);
  }
  return [];
};

export const saveStoredReadQuestionIds = (
  userKey: string | undefined,
  routineId: string,
  questionIds: string[],
  percentage?: number
): void => {
  try {
    const key = getRoutineStorageKey(userKey, routineId);
    const uniqueIds = Array.from(new Set(questionIds.map(String)));
    localStorage.setItem(key, JSON.stringify(uniqueIds));

    const u = getCleanUserKey(userKey);
    if (typeof percentage === 'number') {
      localStorage.setItem(`bcs_routine_perc_${u}_${routineId}`, String(percentage));
    }

    // Trigger local storage event for cross-component re-renders
    window.dispatchEvent(new CustomEvent('routine_reading_progress_updated', {
      detail: { userKey: u, routineId, percentage, readCount: uniqueIds.length }
    }));
  } catch (e) {
    console.error('Failed to save read question IDs to localStorage', e);
  }
};

export const markRoutineQuestionsAsRead = (
  userKey: string | undefined,
  routineId: string,
  newQuestionIds: string[],
  totalQuestionsCount?: number
): RoutineReadingProgress => {
  const existing = getStoredReadQuestionIds(userKey, routineId);
  const combinedSet = new Set([...existing, ...newQuestionIds]);
  const updatedIds = Array.from(combinedSet);

  const total = typeof totalQuestionsCount === 'number' && totalQuestionsCount > 0
    ? totalQuestionsCount
    : updatedIds.length;

  const percentage = total > 0 ? Math.min(100, Math.round((updatedIds.length / total) * 100)) : 0;
  saveStoredReadQuestionIds(userKey, routineId, updatedIds, percentage);

  if (newQuestionIds.length > 0) {
    markUserQuestionsAsRead(userKey, newQuestionIds);
  }

  return {
    readCount: updatedIds.length,
    totalQuestions: total,
    percentage,
    readQuestionIds: updatedIds
  };
};

export const toggleRoutineQuestionReadStatus = (
  userKey: string | undefined,
  routineId: string,
  questionId: string,
  totalQuestionsCount?: number
): RoutineReadingProgress => {
  const existing = getStoredReadQuestionIds(userKey, routineId);
  const set = new Set(existing);
  if (set.has(questionId)) {
    set.delete(questionId);
  } else {
    set.add(questionId);
  }
  const updatedIds = Array.from(set);

  const total = typeof totalQuestionsCount === 'number' && totalQuestionsCount > 0
    ? totalQuestionsCount
    : updatedIds.length;

  const percentage = total > 0 ? Math.min(100, Math.round((updatedIds.length / total) * 100)) : 0;
  saveStoredReadQuestionIds(userKey, routineId, updatedIds, percentage);

  return {
    readCount: updatedIds.length,
    totalQuestions: total,
    percentage,
    readQuestionIds: updatedIds
  };
};

export function calculateRoutineReadingProgress(
  routineOrUserKey: Routine | string | undefined,
  questionsOrRoutineId?: Question[] | string,
  subcategoriesOrRoutine?: SubcategoryItem[] | Routine,
  userKeyOrQuestions?: string | Question[],
  maybeSubcategories?: SubcategoryItem[]
): RoutineReadingProgress {
  let userKey: string | undefined;
  let routine: Routine | undefined;
  let questions: Question[] = [];
  let subcategories: SubcategoryItem[] = [];

  if (typeof routineOrUserKey === 'object' && routineOrUserKey !== null && 'title' in routineOrUserKey) {
    // Signature 1: (routine, questions, subcategories, userKey)
    routine = routineOrUserKey as Routine;
    questions = Array.isArray(questionsOrRoutineId) ? questionsOrRoutineId : [];
    subcategories = Array.isArray(subcategoriesOrRoutine) ? subcategoriesOrRoutine : [];
    userKey = typeof userKeyOrQuestions === 'string' ? userKeyOrQuestions : undefined;
  } else {
    // Signature 2: (userKey, routineId, routine, questions, subcategories)
    userKey = typeof routineOrUserKey === 'string' ? routineOrUserKey : undefined;
    if (typeof subcategoriesOrRoutine === 'object' && subcategoriesOrRoutine !== null && 'title' in subcategoriesOrRoutine) {
      routine = subcategoriesOrRoutine as Routine;
    }
    questions = Array.isArray(userKeyOrQuestions) ? userKeyOrQuestions : [];
    subcategories = Array.isArray(maybeSubcategories) ? maybeSubcategories : [];
  }

  if (!routine) {
    return { readCount: 0, totalQuestions: 0, percentage: 0, readQuestionIds: [] };
  }

  const routineId = routine.id || routine.title || 'default_routine';
  const matched = getRoutineMatchingQuestions(routine, questions, subcategories);
  const totalQuestions = matched.length;
  const storedIds = getStoredReadQuestionIds(userKey, routineId);
  const storedSet = new Set(storedIds);

  const matchedReadCount = matched.filter(q => storedSet.has(q.id)).length;

  let percentage = 0;
  if (totalQuestions > 0) {
    percentage = Math.min(100, Math.round((matchedReadCount / totalQuestions) * 100));
  } else if (storedIds.length > 0) {
    percentage = 100;
  } else {
    try {
      const u = getCleanUserKey(userKey);
      const rawPerc = localStorage.getItem(`bcs_routine_perc_${u}_${routineId}`);
      if (rawPerc !== null) {
        percentage = Math.min(100, Math.max(0, parseInt(rawPerc, 10) || 0));
      }
    } catch (e) {}
  }

  return {
    readCount: matchedReadCount,
    totalQuestions,
    percentage,
    readQuestionIds: storedIds
  };
}
