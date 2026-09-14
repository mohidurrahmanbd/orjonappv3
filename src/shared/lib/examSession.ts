import { Question, Attempt } from '../types';

export interface ActiveExamSession {
  examEndTime: number; // absolute unix timestamp in milliseconds
  quizExamId: string;
  quizTitle: string;
  quizQuestions: Question[];
  userSelectedAnswers: Record<number, string>;
  quizTimeLimitMinutes: number | 'unlimited';
  quizAnswerMode: 'instant' | 'after_exam';
  userPhone?: string;
  userEmail?: string;
  startedAt: number;
}

const ACTIVE_EXAM_STORAGE_KEY = 'orjon_active_exam_session';

/**
 * Persist active exam session to localStorage.
 */
export function saveActiveExamSession(session: ActiveExamSession): void {
  try {
    localStorage.setItem(ACTIVE_EXAM_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save active exam session:', err);
  }
}

/**
 * Retrieve active exam session from localStorage.
 */
export function getActiveExamSession(): ActiveExamSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_EXAM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.examEndTime !== 'number' ||
      !Array.isArray(parsed.quizQuestions)
    ) {
      return null;
    }
    return parsed as ActiveExamSession;
  } catch (err) {
    console.error('Failed to parse active exam session:', err);
    return null;
  }
}

/**
 * Synchronously update persisted answers for the active exam session.
 */
export function updateActiveExamAnswers(answers: Record<number, string>): void {
  try {
    const existing = getActiveExamSession();
    if (!existing) return;
    existing.userSelectedAnswers = answers;
    localStorage.setItem(ACTIVE_EXAM_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to update active exam answers:', err);
  }
}

/**
 * Clear the persisted active exam session upon submission or cancellation.
 */
export function clearActiveExamSession(): void {
  try {
    localStorage.removeItem(ACTIVE_EXAM_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear active exam session:', err);
  }
}

/**
 * Calculate remaining seconds from an absolute exam end timestamp.
 */
export function calculateRemainingSeconds(examEndTime: number): number {
  return Math.max(0, Math.ceil((examEndTime - Date.now()) / 1000));
}

/**
 * Check if the exam has expired based on wall-clock time.
 */
export function isExamSessionExpired(examEndTime: number): boolean {
  return Date.now() >= examEndTime;
}

/**
 * Score an active exam session deterministically.
 */
export function scoreExamSession(
  session: ActiveExamSession,
  user?: { phone?: string; email?: string; name?: string } | null
): Attempt {
  const questionsToScore = session.quizQuestions || [];
  const answersToScore = session.userSelectedAnswers || {};

  let correctCount = 0;
  let wrongCount = 0;
  const catAnalysis: Record<string, { correct: number; total: number }> = {};
  const incorrectQIds: string[] = [];

  questionsToScore.forEach((q, i) => {
    const selected = answersToScore[i];
    const isCorrect = selected === q.correct;
    const qCats = q.categories && q.categories.length > 0 ? q.categories : [q.category];

    qCats.forEach(cat => {
      if (!catAnalysis[cat]) {
        catAnalysis[cat] = { correct: 0, total: 0 };
      }
      catAnalysis[cat].total++;
      if (isCorrect) {
        catAnalysis[cat].correct++;
      }
    });

    if (isCorrect) {
      correctCount++;
    } else {
      if (selected && selected !== 'Skipped') {
        wrongCount++;
      }
      incorrectQIds.push(q.id);
    }
  });

  const negativeMarks = wrongCount * 0.5;
  const finalScore = Math.max(0, correctCount - negativeMarks);

  const attemptUserPhone = user?.phone || session.userPhone || user?.email || session.userEmail || '';
  const attemptUserEmail = user?.email || session.userEmail || attemptUserPhone;
  const attemptUsername = user?.name || 'শিক্ষার্থী';
  const nowIso = new Date().toISOString();

  return {
    id: `attempt_${Date.now()}`,
    userPhone: attemptUserPhone,
    username: attemptUsername,
    examId: session.quizExamId,
    examTitle: session.quizTitle,
    score: finalScore,
    correctCount,
    wrongCount,
    totalQuestions: questionsToScore.length,
    categoryAnalysis: catAnalysis,
    incorrectQuestionIds: incorrectQIds,
    userSelectedAnswers: answersToScore,
    activeQuizQuestions: questionsToScore,
    submittedAt: nowIso,
    updatedAt: nowIso,
    userEmail: attemptUserEmail
  };
}

type ExamAutoSubmitHandler = (session: ActiveExamSession) => Promise<void> | void;
let globalAutoSubmitHandler: ExamAutoSubmitHandler | null = null;
let isGlobalSubmitting = false;

/**
 * Register a component's handler for auto-submitting active exam sessions (e.g., from UserPortal).
 */
export function registerExamAutoSubmitHandler(handler: ExamAutoSubmitHandler): () => void {
  globalAutoSubmitHandler = handler;
  return () => {
    if (globalAutoSubmitHandler === handler) {
      globalAutoSubmitHandler = null;
    }
  };
}

/**
 * Auto-submit an expired active exam session with answers persisted, ensuring it runs
 * before session logout or on background resume.
 */
export async function autoSubmitExpiredExamSession(
  session: ActiveExamSession,
  user?: { phone?: string; email?: string; name?: string } | null,
  fallbackSaveAttempt?: (attempt: Attempt) => void
): Promise<Attempt | null> {
  if (isGlobalSubmitting) {
    return null;
  }
  isGlobalSubmitting = true;

  try {
    // If a live registered handler exists (e.g. from mounted UserPortal), execute it
    if (globalAutoSubmitHandler) {
      try {
        await Promise.resolve(globalAutoSubmitHandler(session));
      } catch (e) {
        console.error('Error in registered exam auto-submit handler:', e);
      }
    }

    const finishedAttempt = scoreExamSession(session, user);

    if (fallbackSaveAttempt) {
      try {
        fallbackSaveAttempt(finishedAttempt);
      } catch (e) {
        console.error('Error in fallbackSaveAttempt:', e);
      }
    } else {
      // Direct localStorage fallback persistence
      try {
        const stored = localStorage.getItem('orjon_attempts') || localStorage.getItem('medha_attempts');
        let currentAttempts: Attempt[] = stored ? JSON.parse(stored) : [];
        const exists = currentAttempts.some(
          a => a.examId === session.quizExamId && Math.abs(new Date(a.submittedAt).getTime() - Date.now()) < 30000
        );
        if (!exists) {
          currentAttempts = [finishedAttempt, ...currentAttempts];
          localStorage.setItem('orjon_attempts', JSON.stringify(currentAttempts));
        }
      } catch (e) {
        console.error('Error saving attempt to localStorage fallback:', e);
      }
    }

    clearActiveExamSession();
    return finishedAttempt;
  } finally {
    isGlobalSubmitting = false;
  }
}

