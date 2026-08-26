import React from 'react';
import UserPortal from '../user/UserPortal';
import { 
  Question, 
  LiveExam, 
  Notice, 
  Routine, 
  User, 
  Attempt, 
  Bookmark, 
  CategoryItem, 
  SubcategoryItem, 
  Course, 
  Coupon, 
  CourseEnrollment, 
  PaymentSettings 
} from '../shared/types';

export interface UserAppProps {
  user: User;
  questions: Question[];
  liveExams: LiveExam[];
  notices: Notice[];
  routines: Routine[];
  courses?: Course[];
  coupons?: Coupon[];
  courseEnrollments?: CourseEnrollment[];
  paymentSettings?: PaymentSettings;
  onEnrollCourse?: (enrollment: Omit<CourseEnrollment, 'id' | 'enrolledAt'>) => void;
  attempts: Attempt[];
  allAttempts?: Attempt[];
  bookmarks: Bookmark[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  onAddBookmark: (questionId: string, folder: string) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  onSaveAttempt: (attempt: Omit<Attempt, 'id' | 'submittedAt'>) => void;
  onUpdateQuestion?: (id: string, q: Partial<Question>) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onLogout: () => void;
  allowUserExplanation?: boolean;
  showMcqCount?: boolean;
  directExamId?: string | null;
  onRegisterPrompt?: () => void;
  onFetchQuestionsLazy?: (filter: { category?: string; subcategory?: string; topic?: string; examId?: string; forceRefresh?: boolean }) => Promise<Question[]>;
}

export default function UserApp(props: UserAppProps) {
  return <UserPortal {...props} />;
}
