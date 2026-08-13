export interface QuestionComment {
  id: string;
  userPhone: string;
  userName: string;
  text: string;
  createdAt: string;
  pointsApproved?: boolean;
}

export interface UserExplanation {
  id: string;
  userPhone: string;
  userName: string;
  text: string;
  approved: boolean;
  createdAt: string;
  pointsApproved?: boolean;
}

export interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: 'Option A' | 'Option B' | 'Option C' | 'Option D';
  explanation: string;
  category: string;
  subcategory: string; // e.g. "45th BCS", "Primary Teacher 2023", etc.
  categories?: string[];
  subcategories?: string[];
  csvCategory?: string;
  comments?: QuestionComment[];
  userExplanations?: UserExplanation[];
  createdAt?: string;
  date?: string;
}

export interface User {
  userId?: string;         // Auto generated unique User ID e.g. MDH-7A39B
  email?: string;          // User Email address
  emailVerified?: boolean; // Email verification status
  phone: string;
  name: string;
  password?: string;
  gender: string;
  education: string;
  avatar: string;
  lifetimeAnswered: number;
  lifetimeCorrect: number;
  lifetimeWrong: number;
  createdAt: string;
  isGuest?: boolean;      // Flag if user is participating as guest
}

export const generateAutoUserId = (): string => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rand;
};

export interface Attempt {
  id: string;
  userPhone: string;
  username: string;
  examId: string;
  examTitle: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  categoryAnalysis: Record<string, { correct: number; total: number }>;
  incorrectQuestionIds: string[];
  userSelectedAnswers: Record<number, string>; // index -> selected option key or 'Skipped'
  activeQuizQuestions: Question[]; // Snapshots of questions at that exam
  submittedAt: string;
  userEmail?: string;     // Guest or registered user email
  isGuestAttempt?: boolean; // Flag indicating if attempt was taken as a guest
}

export interface Notice {
  id: string;
  text: string;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'upcoming' | 'completed';
  category?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Routine {
  id: string;
  title: string;
  details: string;
  createdAt: string;
  courseId?: string;
  courseName?: string;
}

export interface LiveExam {
  id: string;
  title: string;
  qLimit: number;
  timeLimit: number; // in minutes
  category: string; // "ALL" or specific category
  startTime: string; // ISO datetime
  expiryTime: string; // ISO datetime
  createdAt: string;
  questionIds?: string[];
}

export interface Bookmark {
  id: string;
  userPhone: string;
  questionId: string;
  folderName: string;
  createdAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  subHeading?: string;
}

export interface SubcategoryItem {
  id: string;
  name: string;
  parentCategory: string;
  date?: string; // e.g. YYYY-MM-DD
  subHeading?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  admin: string;
  timestamp: string;
  type?: 'delete' | 'update' | 'create' | 'bulk' | 'category' | 'exam' | 'routine' | 'user' | 'other';
}

export const formatBengaliDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    const dayStr = date.getDate().toString().replace(/\d/g, d => bnDigits[parseInt(d)]);
    const monthStr = months[date.getMonth()];
    const yearStr = date.getFullYear().toString().replace(/\d/g, d => bnDigits[parseInt(d)]);
    return `${dayStr} ${monthStr}, ${yearStr}`;
  } catch (e) {
    return dateStr;
  }
};

export const formatBengaliDateTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const dateFormatted = formatBengaliDate(dateStr);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    const timeStr = `${hours.toString().replace(/\d/g, d => bnDigits[parseInt(d)])}:${minutes < 10 ? '০' : ''}${minutes.toString().replace(/\d/g, d => bnDigits[parseInt(d)])} ${ampm}`;
    return `${dateFormatted} (${timeStr})`;
  } catch (e) {
    return dateStr;
  }
};

