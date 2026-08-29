import React from 'react';
import AdminPanel from '../admin/AdminPanel';
import { 
  Question, 
  LiveExam, 
  Notice, 
  Routine, 
  User, 
  Attempt, 
  CategoryItem, 
  SubcategoryItem, 
  AuditLog, 
  Course, 
  Coupon, 
  CourseEnrollment, 
  PaymentSettings,
  ScheduledExamConfig
} from '../shared/types';

export interface AdminAppProps {
  questions: Question[];
  liveExams: LiveExam[];
  notices: Notice[];
  routines: Routine[];
  courses?: Course[];
  users: User[];
  attempts: Attempt[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  onAddCategory: (name: string, subHeading?: string) => void;
  onAddSubcategory: (name: string, parentCategory: string, date?: string, subHeading?: string, text?: string) => void;
  onDeleteCategory: (id: string) => Promise<boolean> | void;
  onDeleteSubcategory: (id: string) => Promise<boolean> | void;
  onBulkDeleteSubcategories?: (ids: string[]) => Promise<boolean> | void;
  onBulkMoveSubcategories?: (ids: string[], newParentCategory: string) => void;
  onUpdateCategory?: (id: string, newName: string, subHeading?: string) => void;
  onUpdateSubcategory?: (id: string, newName: string, newParent: string, date?: string, subHeading?: string, text?: string) => void;
  onAddQuestion: (q: Omit<Question, 'id'>) => void;
  onUpdateQuestion: (id: string, q: Partial<Question>) => void;
  onDeleteQuestion: (id: string) => Promise<boolean> | void;
  onBulkDeleteQuestions: (ids: string[]) => Promise<boolean> | void;
  onBulkMoveQuestions: (ids: string[], targetCategory: string, targetSubcategory?: string, mode?: 'move' | 'link') => void;
  onBulkUploadQuestions: (questionsList: Omit<Question, 'id'>[]) => void;
  onSaveNotice: (text: string) => void;
  onCreateLiveExam: (exam: Omit<LiveExam, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateLiveExam?: (id: string, updatedExam: Partial<LiveExam>) => void;
  onDeleteLiveExam: (id: string) => Promise<boolean> | void;
  onSaveRoutine: (
    title: string, 
    details: string, 
    courseId?: string, 
    courseName?: string, 
    selectedCategories?: string[], 
    selectedSubcategories?: string[], 
    selectedLeafCategories?: string[], 
    examConfig?: ScheduledExamConfig
  ) => void;
  onUpdateRoutine?: (id: string, updatedRoutine: Partial<Routine>) => void;
  onDeleteRoutine: (id: string) => Promise<boolean> | void;
  onSaveCourse?: (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCourse?: (id: string, updatedCourse: Partial<Course>) => void;
  onDeleteCourse?: (id: string) => Promise<boolean> | void;
  coupons?: Coupon[];
  courseEnrollments?: CourseEnrollment[];
  paymentSettings?: PaymentSettings;
  onSaveCoupon?: (coupon: Omit<Coupon, 'id' | 'createdAt'>) => void;
  onUpdateCoupon?: (id: string, updatedCoupon: Partial<Coupon>) => void;
  onDeleteCoupon?: (id: string) => Promise<boolean> | void;
  onUpdatePaymentSettings?: (settings: Partial<PaymentSettings>) => void;
  onDeleteEnrollment?: (id: string) => Promise<boolean> | void;
  onLogout: () => void;
  allowUserExplanation: boolean;
  onToggleUserExplanation: (allowed: boolean) => void;
  showMcqCount?: boolean;
  onToggleMcqCount?: (show: boolean) => void;
  onUpdateAdminPassword?: (newPassword: string) => void;
  auditLogs?: AuditLog[];
  onAddAuditLog?: (action: string, details: string, type?: AuditLog['type']) => void;
  onClearAuditLogs?: () => void;
  sessionTimeoutMinutes?: number;
  onUpdateSessionTimeout?: (mins: number) => void;
  onFetchQuestionsLazy?: (filter: { category?: string; subcategory?: string; topic?: string; examId?: string; forceRefresh?: boolean }) => Promise<Question[]>;
  onLoadUsersOnDemand?: () => void;
  onLoadAuditLogsOnDemand?: () => void;
  onLoadAttemptsOnDemand?: () => void;
}

export default function AdminApp(props: AdminAppProps) {
  return <AdminPanel {...props} />;
}
